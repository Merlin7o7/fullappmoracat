import { Injectable, Logger } from "@nestjs/common";

/**
 * SMS delivery (Twilio REST API — no SDK dependency). Extracted from
 * AuthService so claim links, found-cat relays and OTPs share one sender.
 *
 * Without credentials it logs the message and reports `queued: false`, so a
 * dev machine never needs a live provider and a misconfigured deploy fails
 * visibly in the logs rather than silently.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger("Sms");

  get configured(): boolean {
    return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);
  }

  async send(phone: string, message: string): Promise<{ queued: boolean }> {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;

    if (sid && token && from) {
      try {
        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
            "content-type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ To: phone, From: from, Body: message }).toString(),
        });
        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          this.logger.error(`Twilio SMS failed (${res.status}) to ${maskPhone(phone)}: ${detail.slice(0, 200)}`);
          return { queued: false };
        }
        this.logger.log(`SMS sent to ${maskPhone(phone)} via Twilio`);
        return { queued: true };
      } catch (err) {
        this.logger.error(`Twilio SMS error to ${maskPhone(phone)}: ${(err as Error).message}`);
        return { queued: false };
      }
    }

    // Dev / unconfigured: surface the message in the log so flows stay testable.
    this.logger.log(`[dev-sms] to ${maskPhone(phone)}: ${message}`);
    return { queued: false };
  }
}

function maskPhone(phone: string): string {
  return phone.length > 4 ? `${phone.slice(0, 4)}••••${phone.slice(-2)}` : "••••";
}
