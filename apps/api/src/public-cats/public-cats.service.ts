/**
 * The public face of a Cat ID (MRC-PROD-001 T6).
 *
 * A phone camera pointed at the collar tag lands here. It answers the Safety
 * job (R040 — "bring my cat home") with the least data that does it: the
 * cat's name and photo, that it is registered, and — in lost mode — a way to
 * message the owner that never reveals who the owner is. Every visit is a
 * moment a non-member meets Moracat, so the page also carries one invitation.
 */
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { deriveVaccinationStatus, normalizeSaudiPhone, parseQrValue } from "@moraqat/core";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { MailService } from "../mail/mail.service";
import { SmsService } from "../sms/sms.service";
import { EventsService } from "../events/events.service";
import { catFoundTemplate } from "../mail/mail.templates";
import type { FoundReportDto } from "./dto/found-report.dto";

const FOUND_PER_CAT_PER_DAY = 5;
const foundSmsEnabled = () => process.env.FOUND_SMS_ENABLED === "true";
const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

@Injectable()
export class PublicCatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
    private readonly sms: SmsService,
    private readonly events: EventsService
  ) {}

  private async byToken(raw: string) {
    const token = parseQrValue(raw);
    if (!token) throw new NotFoundException("Unknown code");
    const cat = await this.prisma.cat.findFirst({
      where: { qrToken: token, deletedAt: null, claimStatus: "CLAIMED" },
      select: {
        id: true, name: true, photoUrl: true, catIdNumber: true, status: true, lostModeAt: true, showBreed: true,
        userId: true, breed: { select: { nameAr: true, nameEn: true } },
        vaccinations: { select: { administeredAt: true, dueAt: true } },
        user: { select: { email: true, phone: true, firstName: true, locale: true } },
      },
    });
    if (!cat) throw new NotFoundException("Unknown code");
    return cat;
  }

  /** What a stranger may see. No owner identity, no exact number, no contact. */
  async card(raw: string) {
    const cat = await this.byToken(raw);
    this.events.emit("public_card_viewed", { catId: cat.id, source: "web", props: { lost: !!cat.lostModeAt } });
    return {
      name: cat.name,
      photoUrl: cat.photoUrl,
      breed: cat.showBreed && cat.breed ? { ar: cat.breed.nameAr, en: cat.breed.nameEn } : null,
      registered: true,
      catIdMasked: cat.catIdNumber ? `MRC-••••-${cat.catIdNumber.slice(-4)}` : null,
      vaccinationStanding: deriveVaccinationStatus(cat.vaccinations).standing,
      isLost: !!cat.lostModeAt,
      lifecycle: cat.status,
    };
  }

  /**
   * "I found this cat." Relayed to the owner on every channel we have; the
   * finder learns only that the message went through. Capped per cat per
   * day on top of the per-IP throttle so a tag can't be used to spam an owner.
   */
  async found(raw: string, dto: FoundReportDto, ip: string | undefined) {
    const cat = await this.byToken(raw);
    const since = new Date(Date.now() - 86_400_000);
    const today = await this.prisma.foundReport.count({ where: { catId: cat.id, createdAt: { gte: since } } });
    if (today >= FOUND_PER_CAT_PER_DAY) {
      throw new BadRequestException({ code: "FOUND_REPORT_LIMIT", message: "Too many reports for this cat today" });
    }
    const finderPhone = dto.finderPhone ? normalizeSaudiPhone(dto.finderPhone) : null;
    const message = dto.message.trim();
    await this.prisma.foundReport.create({
      data: {
        catId: cat.id,
        message,
        finderPhone,
        ipHash: ip ? createHash("sha256").update(ip).digest("hex").slice(0, 32) : null,
      },
    });

    const url = `${siteUrl()}/portal/cats/${cat.id}/privacy`;
    this.notifications.emit(cat.userId, {
      category: "SYSTEM",
      type: "cat_found_report",
      params: { name: cat.name, message: message.slice(0, 140), ...(finderPhone ? { phone: finderPhone } : {}) },
      data: { catId: cat.id, url, finderPhone },
    });
    const loc = cat.user.locale === "en" ? "en" : "ar";
    if (cat.user.email) {
      const tpl = catFoundTemplate(loc, cat.user.firstName, cat.name, message, finderPhone, url);
      void this.mail.send({ to: cat.user.email, subject: tpl.subject, html: tpl.html, text: tpl.text }).catch(() => undefined);
    }
    if (foundSmsEnabled() && cat.user.phone) {
      const line = loc === "ar"
        ? `مُراقط: شخص وجد ${cat.name} وترك رسالة: "${message.slice(0, 100)}"${finderPhone ? ` — رقمه ${finderPhone}` : ""}`
        : `Moracat: someone found ${cat.name} and left a message: "${message.slice(0, 100)}"${finderPhone ? ` — their number ${finderPhone}` : ""}`;
      void this.sms.send(cat.user.phone, line).catch(() => undefined);
    }
    this.events.emit("found_report_submitted", { catId: cat.id, userId: cat.userId, source: "web", props: { withPhone: !!finderPhone, lost: !!cat.lostModeAt } });
    return { delivered: true };
  }
}
