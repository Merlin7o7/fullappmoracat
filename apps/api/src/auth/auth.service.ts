import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { randomUUID, createHash, timingSafeEqual } from "node:crypto";
import * as bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import { PrismaService } from "../prisma/prisma.service";
import type { LoginDto, RegisterDto } from "./dto/auth.dto";

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

const ACCESS_TTL = Number(process.env.JWT_ACCESS_TTL ?? 900); // 15 min
const REFRESH_TTL = Number(process.env.JWT_REFRESH_TTL ?? 1_209_600); // 14 days
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "change-me-access-secret";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "change-me-refresh-secret";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService
  ) {}

  // ── Registration ────────────────────────────────────────────────────────
  async register(dto: RegisterDto, meta: RequestMeta) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException("Email is already registered");

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        status: "ACTIVE",
        // Provision wallet + loyalty on signup.
        wallet: { create: {} },
        loyalty: { create: {} },
      },
    });

    const tokens = await this.issueSession(user.id, user.email, user.isStaff, meta);
    return { user: this.publicUser(user), ...tokens };
  }

  // ── Login ────────────────────────────────────────────────────────────────
  async login(dto: LoginDto, meta: RequestMeta) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, deletedAt: null },
      include: { twoFactor: true },
    });

    const ok = user?.passwordHash
      ? await bcrypt.compare(dto.password, user.passwordHash)
      : false;

    if (!user || !ok) {
      if (user) {
        await this.prisma.loginHistory.create({
          data: { userId: user.id, success: false, reason: "bad_credentials", ...meta },
        });
      }
      throw new UnauthorizedException("Invalid email or password");
    }

    // Enforce 2FA when enabled.
    if (user.twoFactor?.enabled) {
      if (!dto.totp) throw new UnauthorizedException("2FA code required");
      const valid = authenticator.verify({ token: dto.totp, secret: user.twoFactor.secret });
      if (!valid) throw new UnauthorizedException("Invalid 2FA code");
    }

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
      this.prisma.loginHistory.create({ data: { userId: user.id, success: true, ...meta } }),
    ]);

    const tokens = await this.issueSession(user.id, user.email, user.isStaff, meta);
    return { user: this.publicUser(user), ...tokens };
  }

  // ── Refresh (rotation + reuse detection) ─────────────────────────────────
  async refresh(refreshToken: string, meta: RequestMeta): Promise<TokenPair> {
    let payload: { sub: string; sid: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, { secret: REFRESH_SECRET });
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const session = await this.prisma.deviceSession.findUnique({ where: { id: payload.sid } });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException("Session expired");
    }

    const matches = this.verifyToken(refreshToken, session.refreshHash);
    if (!matches) {
      // Token reuse → likely theft. Revoke the session defensively.
      await this.prisma.deviceSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException("Refresh token reuse detected");
    }

    const user = await this.prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) throw new UnauthorizedException("User not found");

    // Rotate the refresh token in place.
    return this.rotateSession(session.id, user.id, user.email, user.isStaff, meta);
  }

  // ── Logout ────────────────────────────────────────────────────────────────
  async logout(refreshToken: string) {
    try {
      const payload = await this.jwt.verifyAsync<{ sid: string }>(refreshToken, {
        secret: REFRESH_SECRET,
      });
      await this.prisma.deviceSession.updateMany({
        where: { id: payload.sid, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } catch {
      /* already invalid — nothing to do */
    }
    return { success: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return user ? this.publicUser(user) : null;
  }

  // ── Two-factor authentication ────────────────────────────────────────────
  async setup2fa(userId: string, email: string) {
    const secret = authenticator.generateSecret();
    await this.prisma.twoFactor.upsert({
      where: { userId },
      update: { secret, enabled: false, verifiedAt: null },
      create: { userId, secret, enabled: false },
    });
    const otpauthUrl = authenticator.keyuri(email, "Moraqat", secret);
    return { secret, otpauthUrl };
  }

  async enable2fa(userId: string, code: string) {
    const tf = await this.prisma.twoFactor.findUnique({ where: { userId } });
    if (!tf) throw new UnauthorizedException("Start 2FA setup first");
    if (!authenticator.verify({ token: code, secret: tf.secret })) {
      throw new UnauthorizedException("Invalid 2FA code");
    }
    const backupCodes = Array.from({ length: 8 }, () =>
      Math.random().toString(36).slice(2, 10).toUpperCase()
    );
    await this.prisma.twoFactor.update({
      where: { userId },
      data: { enabled: true, verifiedAt: new Date(), backupCodes },
    });
    return { enabled: true, backupCodes };
  }

  async disable2fa(userId: string) {
    await this.prisma.twoFactor.deleteMany({ where: { userId } });
    return { enabled: false };
  }

  // ── Session helpers ───────────────────────────────────────────────────────
  private async issueSession(
    userId: string,
    email: string,
    isStaff: boolean,
    meta: RequestMeta
  ): Promise<TokenPair> {
    const session = await this.prisma.deviceSession.create({
      data: {
        userId,
        refreshHash: "pending",
        expiresAt: new Date(Date.now() + REFRESH_TTL * 1000),
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
      },
    });
    return this.rotateSession(session.id, userId, email, isStaff, meta, true);
  }

  private async rotateSession(
    sessionId: string,
    userId: string,
    email: string,
    isStaff: boolean,
    meta: RequestMeta,
    isNew = false
  ): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, email, isStaff },
      { secret: ACCESS_SECRET, expiresIn: ACCESS_TTL }
    );
    const refreshToken = await this.jwt.signAsync(
      // `jti` guarantees every rotation yields a unique token even within the
      // same second (JWT `iat` is second-granular) — critical for reliable
      // rotation and reuse detection.
      { sub: userId, sid: sessionId, jti: randomUUID() },
      { secret: REFRESH_SECRET, expiresIn: REFRESH_TTL }
    );
    // NOTE: refresh tokens are hashed with SHA-256, NOT bcrypt. bcrypt silently
    // truncates input at 72 bytes; JWTs share a >72-byte prefix, so bcrypt would
    // treat distinct tokens as equal. Tokens are already high-entropy (jti), so
    // a fast cryptographic digest is both correct and sufficient here.
    const refreshHash = this.hashToken(refreshToken);

    await this.prisma.deviceSession.update({
      where: { id: sessionId },
      data: {
        refreshHash,
        lastActiveAt: new Date(),
        ...(isNew ? {} : { expiresAt: new Date(Date.now() + REFRESH_TTL * 1000) }),
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
      },
    });

    return { accessToken, refreshToken, expiresIn: ACCESS_TTL };
  }

  /** SHA-256 hex digest of a token (full-length, collision-safe). */
  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  /** Constant-time comparison of a token against a stored SHA-256 digest. */
  private verifyToken(token: string, storedHash: string): boolean {
    const computed = this.hashToken(token);
    if (computed.length !== storedHash.length) return false;
    return timingSafeEqual(Buffer.from(computed), Buffer.from(storedHash));
  }

  private publicUser(user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    locale: string;
    isStaff: boolean;
    status: string;
  }) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      locale: user.locale,
      isStaff: user.isStaff,
      status: user.status,
    };
  }
}
