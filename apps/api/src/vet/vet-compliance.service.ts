import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { VetRegistrationService } from "./vet-registration.service";

/** Warn this many days before a licence or CR lapses. */
const WARN_DAYS = [60, 30, 7] as const;
const DAY_MS = 86_400_000;

/**
 * Licence hygiene for partner clinics — MRC-VET-001 §01 "edge cases designed
 * now": MEWA licences and commercial registrations carry expiry dates.
 *
 *  • 60 / 30 / 7 days out → the clinic's owners get a bilingual reminder.
 *  • Expired MEWA licence → that branch leaves the member directory the same
 *    day. Member trust outranks partner convenience; re-uploading a renewed
 *    licence and a Moracat check puts it back.
 *
 * Runs once a day. The day-bucket comparison makes a single daily run send each
 * warning exactly once; the directory pull is idempotent.
 */
@Injectable()
export class VetComplianceService {
  private readonly logger = new Logger("VetCompliance");

  constructor(
    private readonly prisma: PrismaService,
    private readonly registration: VetRegistrationService
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM, { name: "vet-compliance", timeZone: "Asia/Riyadh" })
  async run(now: Date = new Date()) {
    try {
      const pulled = await this.pullExpiredBranches(now);
      const warned = await this.warnExpiring(now);
      if (pulled || warned) this.logger.log(`compliance: ${pulled} branch(es) pulled, ${warned} warning(s) sent`);
      return { pulled, warned };
    } catch (err) {
      this.logger.error(`compliance run failed: ${(err as Error).message}`);
      return { pulled: 0, warned: 0 };
    }
  }

  private async pullExpiredBranches(now: Date): Promise<number> {
    const expired = await this.prisma.branch.findMany({
      where: {
        directoryVisible: true,
        licenceExpiresAt: { lte: now },
        org: { isDemo: false },
      },
      select: { id: true, orgId: true, nameAr: true, nameEn: true, licenceExpiresAt: true },
    });
    for (const b of expired) {
      await this.prisma.branch.update({ where: { id: b.id }, data: { directoryVisible: false } });
      await this.prisma.auditLog.create({
        data: {
          action: "vet.compliance.branch.licence_expired",
          entityType: "Branch",
          entityId: b.id,
          metadata: { orgId: b.orgId, licenceExpiresAt: b.licenceExpiresAt?.toISOString() ?? null },
        },
      });
      await this.emailOwners(b.orgId, {
        subjectAr: `انتهى ترخيص ${b.nameAr} — أُخفي الفرع من الدليل`,
        subjectEn: `${b.nameEn}'s licence expired — hidden from the directory`,
        headingAr: "انتهى ترخيص وزارة البيئة لهذا الفرع",
        headingEn: "This branch's MEWA licence has expired",
        bodyAr: [
          `أخفينا فرع ${b.nameAr} من دليل مرقط اليوم، لأن الأعضاء يعتمدون على أن كل عيادة في الدليل مرخّصة.`,
          "ارفع الترخيص المجدَّد من بوابة العيادات وسنعيد الفرع بعد التحقق.",
        ],
        bodyEn: [
          `We've hidden ${b.nameEn} from the Moracat directory today, because members rely on every listed clinic being licensed.`,
          "Upload the renewed licence in the partner portal and we'll restore the branch once it's checked.",
        ],
      });
    }
    return expired.length;
  }

  private async warnExpiring(now: Date): Promise<number> {
    let sent = 0;
    const today = Math.floor(now.getTime() / DAY_MS);
    for (const days of WARN_DAYS) {
      const from = new Date((today + days) * DAY_MS);
      const to = new Date((today + days + 1) * DAY_MS);

      const branches = await this.prisma.branch.findMany({
        where: {
          isActive: true,
          licenceExpiresAt: { gte: from, lt: to },
          org: { isDemo: false, status: { in: ["APPROVED", "LIVE"] } },
        },
        select: { orgId: true, nameAr: true, nameEn: true },
      });
      for (const b of branches) {
        await this.emailOwners(b.orgId, {
          subjectAr: `ترخيص ${b.nameAr} ينتهي خلال ${days} يوماً`,
          subjectEn: `${b.nameEn}'s licence expires in ${days} days`,
          headingAr: `ترخيص وزارة البيئة ينتهي خلال ${days} يوماً`,
          headingEn: `The MEWA licence expires in ${days} days`,
          bodyAr: [`جدّد ترخيص فرع ${b.nameAr} وارفع النسخة الجديدة من بوابة العيادات، حتى يبقى الفرع ظاهراً للأعضاء.`],
          bodyEn: [`Renew ${b.nameEn}'s licence and upload the new copy in the partner portal so the branch stays visible to members.`],
        });
        sent++;
      }

      const orgs = await this.prisma.partnerOrg.findMany({
        where: { isDemo: false, status: { in: ["APPROVED", "LIVE"] }, crExpiresAt: { gte: from, lt: to } },
        select: { id: true, nameAr: true, nameEn: true },
      });
      for (const o of orgs) {
        await this.emailOwners(o.id, {
          subjectAr: `السجل التجاري لـ${o.nameAr} ينتهي خلال ${days} يوماً`,
          subjectEn: `${o.nameEn}'s commercial registration expires in ${days} days`,
          headingAr: `السجل التجاري ينتهي خلال ${days} يوماً`,
          headingEn: `The commercial registration expires in ${days} days`,
          bodyAr: ["جدّد السجل التجاري وأرسل لنا النسخة الجديدة على support@moracat.co."],
          bodyEn: ["Renew the commercial registration and send us the new copy at support@moracat.co."],
        });
        sent++;
      }
    }
    return sent;
  }

  private async emailOwners(orgId: string, notice: Parameters<VetRegistrationService["sendMail"]>[1]) {
    const owners = await this.prisma.partnerStaff.findMany({
      where: { orgId, role: { in: ["OWNER", "MANAGER"] }, status: "ACTIVE" },
      select: { user: { select: { email: true } } },
    });
    for (const email of new Set(owners.map((o) => o.user.email.toLowerCase()))) {
      await this.registration.sendMail(email, notice);
    }
  }
}
