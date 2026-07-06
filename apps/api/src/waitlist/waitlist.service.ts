import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { waitlistJoinedTemplate } from "../mail/mail.templates";
import type { JoinWaitlistDto } from "./dto/waitlist.dto";

@Injectable()
export class WaitlistService {
  private readonly logger = new Logger("Waitlist");

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService
  ) {}

  /**
   * Join the membership waitlist. Idempotent by email — re-submitting updates
   * the stored intent rather than erroring, so the UX is always "you're on the
   * list" and never a duplicate-key failure.
   */
  async join(dto: JoinWaitlistDto) {
    const email = dto.email.trim().toLowerCase();
    const data = {
      catName: dto.catName?.trim() || null,
      planInterest: dto.planInterest ?? null,
      source: dto.source ?? null,
      locale: dto.locale ?? "ar",
    } as const;

    const existing = await this.prisma.waitlistEntry.findUnique({ where: { email }, select: { id: true } });
    await this.prisma.waitlistEntry.upsert({
      where: { email },
      create: { email, ...data },
      update: data,
    });

    // Confirm the first join (not repeat submits) — a founding-member welcome.
    if (!existing) {
      const tpl = waitlistJoinedTemplate(data.locale === "en" ? "en" : "ar", null);
      void this.mail.send({ to: email, subject: tpl.subject, html: tpl.html, text: tpl.text });
    }

    this.logger.log(`Waitlist join: ${email} (${dto.source ?? "unknown"})`);
    return { ok: true, message: "You're on the list — we'll let you know the moment memberships open." };
  }
}
