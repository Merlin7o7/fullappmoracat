import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { timingSafeEqual } from "node:crypto";
import { parseQrValue } from "@moraqat/core";
import { PrismaService } from "../prisma/prisma.service";

/** Constant-time string compare — avoids leaking the partner key via timing. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

const IS_PROD = process.env.NODE_ENV === "production";

/**
 * Partner verification (#2). The card's QR now encodes the public page URL
 * (T6 — a phone camera gets the Safety job); this endpoint is the deeper,
 * partner-keyed read that also reports membership standing. It accepts the
 * URL, the legacy `MRCV1:` form, or a bare token, and returns the minimum
 * needed to verify identity + membership — never a public profile or
 * sensitive data.
 */
@Injectable()
export class VerifyService {
  constructor(private readonly prisma: PrismaService) {}

  async verifyCat(rawToken: string, partnerKey?: string) {
    this.authorize(partnerKey);

    const token = parseQrValue(rawToken);
    if (!token) throw new NotFoundException("Unknown or revoked code");
    const cat = await this.prisma.cat.findFirst({
      where: { qrToken: token, deletedAt: null },
      select: {
        name: true,
        catIdNumber: true,
        idIssuedAt: true,
        status: true,
        membershipStatus: true,
        breed: { select: { nameEn: true, nameAr: true } },
        user: { select: { firstName: true } },
      },
    });
    if (!cat) throw new NotFoundException("Unknown or revoked code");

    const active = cat.membershipStatus === "ACTIVE" && cat.status === "ACTIVE";
    return {
      valid: true,
      catName: cat.name,
      catIdNumber: cat.catIdNumber,
      breed: cat.breed ? { en: cat.breed.nameEn, ar: cat.breed.nameAr } : null,
      ownerName: cat.user?.firstName ?? null, // first name only — no contact details
      membershipStatus: active ? "ACTIVE" : "INACTIVE",
      membershipActive: active,
      lifecycle: cat.status, // ACTIVE / ARCHIVED / DECEASED
      issuedAt: cat.idIssuedAt,
    };
  }

  private authorize(partnerKey?: string) {
    const expected = process.env.PARTNER_VERIFY_KEY;
    if (expected) {
      if (!partnerKey || !safeEqual(partnerKey, expected)) {
        throw new UnauthorizedException("Invalid partner key");
      }
      return;
    }
    // No key configured: allowed in dev for testing, refused in production.
    if (IS_PROD) throw new ServiceUnavailableException("Verification is not configured");
  }
}
