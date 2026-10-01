import { Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PKPass } from "passkit-generator";
import { formatDate, qrValueFor, vaccinationStandingLabel, type VaccinationStanding } from "@moraqat/core";
import { PrismaService } from "../prisma/prisma.service";

interface AppleCreds {
  passTypeIdentifier: string;
  teamIdentifier: string;
  wwdr: Buffer;
  signerCert: Buffer;
  signerKey: Buffer;
  signerKeyPassphrase?: string;
}

const fromB64 = (v: string | undefined) => (v ? Buffer.from(v, "base64") : null);

/**
 * Apple Wallet — the Cat ID as a pass on the lock screen (W6, R034).
 *
 * A .pkpass must be PKCS#7-signed with an Apple Pass Type ID certificate. We
 * never fake that: without the full credential set the feature reports
 * unavailable and the web shows no Apple button (R040). Credentials, all
 * base64 of PEM:
 *
 *   APPLE_PASS_TYPE_ID        pass.co.moracat.catid
 *   APPLE_TEAM_ID             10-char Apple team id
 *   APPLE_PASS_CERT_PEM_B64   the Pass Type ID certificate (PEM)
 *   APPLE_PASS_KEY_PEM_B64    its private key (PEM)
 *   APPLE_PASS_KEY_PASSPHRASE optional
 *   APPLE_WWDR_PEM_B64        Apple WWDR intermediate (G4)
 *
 * The pass carries the cat, not the owner's life: name, Cat ID, the QR that
 * opens the public scan page, vaccination standing, and — only if the owner
 * set one — an emergency contact on the back.
 */
@Injectable()
export class ApplePassService {
  constructor(private readonly prisma: PrismaService) {}

  creds(): AppleCreds | null {
    const passTypeIdentifier = process.env.APPLE_PASS_TYPE_ID;
    const teamIdentifier = process.env.APPLE_TEAM_ID;
    const signerCert = fromB64(process.env.APPLE_PASS_CERT_PEM_B64);
    const signerKey = fromB64(process.env.APPLE_PASS_KEY_PEM_B64);
    const wwdr = fromB64(process.env.APPLE_WWDR_PEM_B64);
    if (!passTypeIdentifier || !teamIdentifier || !signerCert || !signerKey || !wwdr) return null;
    return { passTypeIdentifier, teamIdentifier, signerCert, signerKey, wwdr, signerKeyPassphrase: process.env.APPLE_PASS_KEY_PASSPHRASE || undefined };
  }

  private assets(): Record<string, Buffer> {
    const dirs = [join(__dirname, "..", "..", "assets", "pass"), join(process.cwd(), "assets", "pass")];
    const dir = dirs.find((d) => existsSync(join(d, "icon.png")));
    if (!dir) throw new ServiceUnavailableException({ code: "WALLET_ASSETS_MISSING", message: "Pass images are missing from this build" });
    const out: Record<string, Buffer> = {};
    for (const f of ["icon.png", "icon@2x.png", "icon@3x.png", "logo.png", "logo@2x.png"]) {
      if (existsSync(join(dir, f))) out[f] = readFileSync(join(dir, f));
    }
    return out;
  }

  async pass(userId: string, catId: string): Promise<{ buffer: Buffer; fileName: string }> {
    const creds = this.creds();
    if (!creds) {
      throw new ServiceUnavailableException({ code: "WALLET_NOT_CONFIGURED", message: "Apple Wallet is not configured on this environment" });
    }
    const cat = await this.prisma.cat.findFirst({
      where: { id: catId, userId, deletedAt: null },
      select: {
        name: true, catIdNumber: true, qrToken: true, idIssuedAt: true, vaccinationStatus: true,
        emergencyContacts: { orderBy: { isPrimary: "desc" }, take: 1, select: { name: true, phone: true } },
        user: { select: { locale: true } },
      },
    });
    if (!cat) throw new NotFoundException("Cat not found");
    if (!cat.catIdNumber || !cat.qrToken) throw new NotFoundException("This cat has no issued Cat ID yet");

    const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://moracat.co").replace(/\/+$/, "");
    const loc = cat.user.locale === "en" ? "en" : "ar";
    const standing = vaccinationStandingLabel((cat.vaccinationStatus ?? "UNKNOWN") as VaccinationStanding);

    const pass = new PKPass(
      this.assets(),
      { wwdr: creds.wwdr, signerCert: creds.signerCert, signerKey: creds.signerKey, signerKeyPassphrase: creds.signerKeyPassphrase },
      {
        formatVersion: 1,
        passTypeIdentifier: creds.passTypeIdentifier,
        teamIdentifier: creds.teamIdentifier,
        serialNumber: cat.catIdNumber,
        organizationName: "Moracat · مرقط",
        description: loc === "ar" ? `هوية ${cat.name} في مرقط` : `${cat.name}'s Moracat ID`,
        logoText: loc === "ar" ? "مرقط" : "Moracat",
        // AD 2.1: emerald ground, paper ink.
        backgroundColor: "rgb(4, 91, 70)",
        foregroundColor: "rgb(250, 247, 242)",
        labelColor: "rgb(201, 230, 214)",
        sharingProhibited: false,
      }
    );
    pass.type = "generic";
    pass.primaryFields.push({ key: "name", label: loc === "ar" ? "القط" : "CAT", value: cat.name });
    pass.secondaryFields.push({ key: "catid", label: loc === "ar" ? "رقم الهوية" : "CAT ID", value: cat.catIdNumber });
    pass.auxiliaryFields.push({ key: "vax", label: loc === "ar" ? "التطعيمات" : "VACCINES", value: loc === "ar" ? standing.ar : standing.en });
    if (cat.idIssuedAt) {
      pass.auxiliaryFields.push({
        key: "since",
        label: loc === "ar" ? "في السجل منذ" : "REGISTERED",
        value: formatDate(cat.idIssuedAt, loc, "monthYear"),
      });
    }
    const contact = cat.emergencyContacts[0];
    if (contact) {
      pass.backFields.push({ key: "emergency", label: loc === "ar" ? "للطوارئ" : "Emergency contact", value: `${contact.name} · ${contact.phone}` });
    }
    pass.backFields.push({
      key: "found",
      label: loc === "ar" ? "لقيت هذا القط؟" : "Found this cat?",
      value: loc === "ar" ? "امسح الرمز — يوصلك بصاحبه دون كشف رقمه." : "Scan the code — it reaches the owner without revealing their number.",
    });
    pass.setBarcodes({
      format: "PKBarcodeFormatQR",
      message: qrValueFor(site, cat.qrToken),
      messageEncoding: "iso-8859-1",
      altText: cat.catIdNumber,
    });
    return { buffer: pass.getAsBuffer(), fileName: `Moracat-${cat.catIdNumber}.pkpass` };
  }
}
