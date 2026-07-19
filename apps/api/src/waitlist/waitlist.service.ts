import { Injectable, Logger } from "@nestjs/common";
import { normaliseSourceCode } from "@moraqat/core";
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
      source: normaliseSourceCode(dto.source) ?? dto.source?.trim() ?? null,
      locale: dto.locale ?? "ar",
    } as const;

    const existing = await this.prisma.waitlistEntry.findUnique({
      where: { email },
      select: { id: true, consentAt: true, createdAt: true },
    });

    // Consent is stamped server-side and is *sticky*: a re-submit without the
    // box ticked must not silently revoke permission we already hold, and a
    // client-supplied timestamp is never trusted. Mirrors `Cat.shareConsentAt`.
    const consentAt = dto.consent === true ? (existing?.consentAt ?? new Date()) : undefined;

    const entry = await this.prisma.waitlistEntry.upsert({
      where: { email },
      create: { email, ...data, consentAt: consentAt ?? null },
      update: { ...data, ...(consentAt ? { consentAt } : {}) },
      select: { createdAt: true, consentAt: true },
    });

    // Confirm the first join (not repeat submits) — and only when we actually
    // hold permission to write to this person (PDPL, R106). Interest without
    // consent is still recorded; we simply stay silent until they say yes.
    if (!existing && entry.consentAt) {
      const tpl = waitlistJoinedTemplate(data.locale === "en" ? "en" : "ar", data.catName);
      void this.mail.send({ to: email, subject: tpl.subject, html: tpl.html, text: tpl.text });
    }

    this.logger.log(
      `Waitlist join: ${email} (src=${data.source ?? "unknown"}, consent=${entry.consentAt ? "yes" : "no"})`
    );

    return {
      ok: true,
      // The honest position: how many people joined at or before this entry.
      // It is the real queue order and nothing moves it — there is deliberately
      // no "refer a friend to jump the line" mechanic, because a position that
      // can be bought with referrals is not a position (R006).
      position: await this.prisma.waitlistEntry.count({
        where: { createdAt: { lte: entry.createdAt } },
      }),
      consentRecorded: Boolean(entry.consentAt),
      message: "You're on the list — we'll let you know the moment memberships open.",
    };
  }
}
