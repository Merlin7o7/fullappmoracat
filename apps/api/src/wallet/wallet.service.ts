import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { createSign } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Wallet passes — the Cat ID living where people actually carry cards
 * (Dossier §05; R034 wallet pass, R036 offline). Same fail-closed discipline
 * as the commerce kill-switch: without provider credentials the feature
 * reports unavailable and the web renders no buttons — we never show a dead
 * control or claim a job the product can't do yet (R040).
 *
 * Google Wallet ships first (signed "Save to Google Wallet" JWT — no SDK, no
 * network call at issue time; RS256 via node:crypto). Apple Wallet follows
 * once the Pass Type ID certificate chain exists (WALLET_APPLE_* envs) —
 * .pkpass needs a PKCS#7 CMS signature we refuse to fake.
 */

interface GoogleCreds {
  issuerId: string;
  email: string;
  key: string;
}

const b64url = (input: Buffer | string) =>
  Buffer.from(input).toString("base64url");

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  private googleCreds(): GoogleCreds | null {
    const issuerId = process.env.WALLET_GOOGLE_ISSUER_ID;
    const email = process.env.WALLET_GOOGLE_SA_EMAIL;
    // Keys arrive via env with literal "\n" — normalize to real newlines.
    const key = process.env.WALLET_GOOGLE_SA_KEY?.replace(/\\n/g, "\n");
    if (!issuerId || !email || !key) return null;
    return { issuerId, email, key };
  }

  /** Which wallet targets are live — drives which buttons the web shows. */
  availability() {
    return {
      google: !!this.googleCreds(),
      // Flips on when the Apple Pass Type ID certs land (WALLET_APPLE_*).
      apple: false,
    };
  }

  /**
   * Signed "Save to Google Wallet" link for one of the member's cats.
   * The pass mirrors the physical card: identity + the safety job — QR
   * verification token, ID number, owner, emergency contact, vaccination.
   */
  async googleSaveUrl(userId: string, catId: string) {
    const creds = this.googleCreds();
    if (!creds) {
      throw new ServiceUnavailableException({
        code: "WALLET_NOT_CONFIGURED",
        message: "Google Wallet is not configured on this environment",
      });
    }

    const cat = await this.prisma.cat.findFirst({
      where: { id: catId, userId, deletedAt: null },
      select: {
        name: true,
        catIdNumber: true,
        qrToken: true,
        idIssuedAt: true,
        vaccinationStatus: true,
      },
    });
    if (!cat) throw new NotFoundException("Cat not found");
    if (!cat.catIdNumber || !cat.qrToken) {
      throw new NotFoundException("This cat has no issued Cat ID yet");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, phone: true },
    });
    const ownerName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://moracat.sa";
    const since = cat.idIssuedAt
      ? new Date(cat.idIssuedAt).toLocaleDateString("en-GB", { month: "short", year: "numeric" })
      : null;

    // Bilingual, Arabic-first (R101) — Google renders defaultValue unless the
    // device locale matches a translatedValue.
    const ar = (value: string, en: string) => ({
      defaultValue: { language: "ar", value },
      translatedValues: [{ language: "en", value: en }],
    });

    const textModulesData = [
      { id: "cat_id", header: "رقم الهوية · CAT ID", body: cat.catIdNumber },
      ownerName && { id: "owner", header: "المالك · OWNER", body: ownerName },
      user?.phone && { id: "emergency", header: "للطوارئ · EMERGENCY", body: user.phone },
      { id: "vaccines", header: "التطعيمات · VACCINES", body: vaccinationLabel(cat.vaccinationStatus) },
      since && { id: "member_since", header: "عضو منذ · MEMBER SINCE", body: since },
    ].filter(Boolean);

    const passObject = {
      id: `${creds.issuerId}.${cat.catIdNumber}`,
      classId: `${creds.issuerId}.moracat_cat_id`,
      state: "ACTIVE",
      cardTitle: ar("مرقط", "Moracat"),
      subheader: ar("هوية القط", "Cat ID"),
      header: ar(cat.name, cat.name),
      // The brand's deep-green field — same material as the physical card.
      hexBackgroundColor: "#0b4a3b",
      logo: { sourceUri: { uri: `${siteUrl}/brand/moracat-logo-light.png` } },
      // The same secure in-ecosystem token as the card — never a public URL.
      barcode: {
        type: "QR_CODE",
        value: `MRCV1:${cat.qrToken}`,
        alternateText: cat.catIdNumber,
      },
      textModulesData,
    };

    const now = Math.floor(Date.now() / 1000);
    const claims = {
      iss: creds.email,
      aud: "google",
      typ: "savetowallet",
      iat: now,
      origins: [siteUrl],
      payload: { genericObjects: [passObject] },
    };

    const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const body = b64url(JSON.stringify(claims));
    const signature = createSign("RSA-SHA256")
      .update(`${header}.${body}`)
      .sign(creds.key, "base64url");

    return { saveUrl: `https://pay.google.com/gp/v/save/${header}.${body}.${signature}` };
  }
}

function vaccinationLabel(status: string | null): string {
  switch (status) {
    case "UP_TO_DATE": return "مكتملة · Up to date";
    case "PARTIAL": return "جزئية · Partial";
    case "NONE": return "لا يوجد · None";
    default: return "غير مسجّلة · Not recorded";
  }
}
