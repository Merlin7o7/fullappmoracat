import { Injectable, Logger } from "@nestjs/common";

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

/**
 * Provider-agnostic transactional email.
 *
 * Production uses Resend (via its REST API — no SDK dependency, global fetch on
 * Node 20). If no provider/key is configured we fall back to a dev "log" mode
 * that prints the message (and any action link) to the server log instead of
 * sending — so local development and CI never require credentials and never
 * silently swallow mail. Swappable to SES/Postmark/SMTP by adding a branch.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger("Mail");

  private get provider(): "resend" | "log" {
    const p = (process.env.EMAIL_PROVIDER ?? "").toLowerCase();
    if (p === "resend" && process.env.RESEND_API_KEY) return "resend";
    return "log";
  }

  private get from(): string {
    return process.env.EMAIL_FROM || "Moracat <onboarding@resend.dev>";
  }

  /** Send an email. Never throws into the request path — logs and returns ok:false. */
  async send(input: SendMailInput): Promise<{ ok: boolean; id?: string }> {
    if (this.provider === "log") {
      this.logger.log(
        `[dev email → ${input.to}] ${input.subject}\n${stripToText(input.text).slice(0, 500)}`
      );
      return { ok: true, id: "logged" };
    }

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.from,
          to: [input.to],
          subject: input.subject,
          html: input.html,
          text: input.text,
          ...(input.replyTo ? { reply_to: input.replyTo } : {}),
        }),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        this.logger.error(`Resend send failed (${res.status}) to ${input.to}: ${detail}`);
        return { ok: false };
      }
      const data = (await res.json().catch(() => ({}))) as { id?: string };
      this.logger.log(`Email sent → ${input.to} (${input.subject}) id=${data.id ?? "?"}`);
      return { ok: true, id: data.id };
    } catch (err) {
      this.logger.error(`Resend send threw for ${input.to}: ${(err as Error).message}`);
      return { ok: false };
    }
  }
}

function stripToText(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}
