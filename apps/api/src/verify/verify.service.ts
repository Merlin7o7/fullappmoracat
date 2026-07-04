import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const IS_PROD = process.env.NODE_ENV === "production";
const TOKEN_PREFIX = "MRCV1:";

/**
 * QR verification (#2). The Cat ID card's QR encodes an opaque token — NOT a URL.
 * A generic phone camera scanning it just sees meaningless text (no public page).
 * Only the Moracat app / an authorized partner (holding the partner key) can
 * resolve it here, and we return the minimum needed to verify identity +
 * membership — never a public profile or sensitive data.
 */
@Injectable()
export class VerifyService {
  constructor(private readonly prisma: PrismaService) {}

  async verifyCat(rawToken: string, partnerKey?: string) {
    this.authorize(partnerKey);

    const token = rawToken.startsWith(TOKEN_PREFIX) ? rawToken.slice(TOKEN_PREFIX.length) : rawToken;
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
      if (partnerKey !== expected) throw new UnauthorizedException("Invalid partner key");
      return;
    }
    // No key configured: allowed in dev for testing, refused in production.
    if (IS_PROD) throw new ServiceUnavailableException("Verification is not configured");
  }
}
