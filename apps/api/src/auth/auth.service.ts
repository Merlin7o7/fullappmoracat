import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { randomUUID, randomInt, randomBytes, createHash, timingSafeEqual } from "node:crypto";
import * as bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { IdsService } from "../ids/ids.service";
import { MailService } from "../mail/mail.service";
import {
  verifyEmailTemplate,
  welcomeTemplate,
  passwordResetTemplate,
  emailChangeTemplate,
  type Locale as MailLocale,
} from "../mail/mail.templates";
import type {
  GoogleAuthDto,
  LoginDto,
  OtpPurpose,
  PhoneLoginDto,
  RegisterDto,
  RequestOtpDto,
} from "./dto/auth.dto";

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
// "Remember me" trades a longer-lived session for fewer re-logins (R002 —
// effort is the enemy). Default 60 days.
const REMEMBER_TTL = Number(process.env.JWT_REMEMBER_TTL ?? 5_184_000);
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "change-me-access-secret";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "change-me-refresh-secret";
const OTP_TTL_MS = Number(process.env.OTP_TTL_SECONDS ?? 300) * 1000; // 5 min
const OTP_MAX_ATTEMPTS = 5;
const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const LOCKOUT_THRESHOLD = 10; // failed attempts within the window before lockout
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const IS_PROD = process.env.NODE_ENV === "production";

@Injectable()
export class AuthService {
  private readonly logger = new Logger("Auth");

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly notifications: NotificationsService,
    private readonly ids: IdsService,
    private readonly mail: MailService
  ) {}

  // ── Registration ────────────────────────────────────────────────────────
  async register(dto: RegisterDto, meta: RequestMeta) {
    if (!dto.acceptTerms) {
      throw new BadRequestException("You must accept the Terms & Privacy Policy");
    }

    const email = dto.email.toLowerCase().trim();
    const phone = dto.phone ? normalizePhone(dto.phone, dto.dialCode) : null;

    const emailClash = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (emailClash) throw new ConflictException("Email is already registered");
    if (phone) {
      const phoneClash = await this.prisma.user.findUnique({ where: { phone }, select: { id: true } });
      if (phoneClash) throw new ConflictException("Mobile number is already registered");
    }

    // Email sign-ups need a password (Google sign-ups arrive through googleAuth).
    if (!dto.password) {
      throw new BadRequestException("A password is required");
    }

    // If a phone + OTP were supplied, treat the phone as verified on the spot.
    let phoneVerified: Date | null = null;
    if (dto.otp && phone) {
      const ok = await this.consumeOtp(phone, "REGISTER", dto.otp);
      if (!ok) throw new UnauthorizedException("Invalid or expired verification code");
      phoneVerified = new Date();
    }

    const { firstName, lastName } = splitName(dto.fullName, dto.firstName, dto.lastName);
    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email,
        memberIdNumber: await this.ids.newMemberId(),
        phone: phone ?? undefined,
        dialCode: dto.dialCode ?? "+966",
        passwordHash,
        firstName,
        lastName,
        gender: dto.gender ?? "UNSPECIFIED",
        status: "ACTIVE",
        phoneVerified,
        termsAcceptedAt: new Date(),
        // Provision wallet + loyalty on signup.
        wallet: { create: {} },
        loyalty: { create: {} },
      },
    });

    // Welcome + email-verification (non-blocking; a mail hiccup never fails
    // signup). MailService swallows its own errors and logs.
    void this.sendVerificationEmail(user.id, user.email, user.firstName, user.locale);
    void this.dispatchWelcome(user.email, user.firstName, user.locale);

    const tokens = await this.issueSession(user.id, user.email, user.isStaff, meta, REFRESH_TTL);
    return { user: this.publicUser(user), ...tokens };
  }

  // ── Login (email + password) ──────────────────────────────────────────────
  async login(dto: LoginDto, meta: RequestMeta) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email.toLowerCase().trim(), deletedAt: null },
      include: { twoFactor: true },
    });

    // Brute-force lockout: too many recent failures for this account → refuse,
    // regardless of whether this attempt's password is correct.
    if (user) {
      const recentFailures = await this.prisma.loginHistory.count({
        where: { userId: user.id, success: false, createdAt: { gt: new Date(Date.now() - LOCKOUT_WINDOW_MS) } },
      });
      if (recentFailures >= LOCKOUT_THRESHOLD) {
        throw new UnauthorizedException("Too many attempts. Please try again in a few minutes.");
      }
    }

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

    return this.completeLogin(user.id, user.email, user.isStaff, this.publicUser(user), dto.rememberMe, meta);
  }

  // ── Login (mobile number + OTP) ───────────────────────────────────────────
  async phoneLogin(dto: PhoneLoginDto, meta: RequestMeta) {
    const phone = normalizePhone(dto.phone);
    const ok = await this.consumeOtp(phone, "LOGIN", dto.otp);
    if (!ok) throw new UnauthorizedException("Invalid or expired code");

    const user = await this.prisma.user.findFirst({ where: { phone, deletedAt: null } });
    if (!user) throw new UnauthorizedException("No account found for this number");

    if (!user.phoneVerified) {
      await this.prisma.user.update({ where: { id: user.id }, data: { phoneVerified: new Date() } });
    }
    return this.completeLogin(user.id, user.email, user.isStaff, this.publicUser(user), dto.rememberMe, meta);
  }

  // ── Continue with Google ──────────────────────────────────────────────────
  async googleAuth(dto: GoogleAuthDto, meta: RequestMeta) {
    // Verify the token with Google (signature + expiry validated server-side),
    // then confirm it was minted for OUR app (audience check).
    const profile = await verifyGoogleIdToken(dto.idToken);
    if (!profile?.email) throw new UnauthorizedException("Invalid Google credential");
    const expectedAud = process.env.GOOGLE_CLIENT_ID;
    if (expectedAud && profile.aud !== expectedAud) {
      throw new UnauthorizedException("Google credential was issued for a different app");
    }
    if (IS_PROD && !expectedAud) {
      throw new BadRequestException("Google sign-in is not configured");
    }

    const email = profile.email.toLowerCase();
    let user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          memberIdNumber: await this.ids.newMemberId(),
          firstName: profile.given_name ?? null,
          lastName: profile.family_name ?? null,
          avatarUrl: profile.picture ?? null,
          emailVerified: new Date(),
          status: "ACTIVE",
          termsAcceptedAt: new Date(),
          wallet: { create: {} },
          loyalty: { create: {} },
        },
      });
      // Google emails are already verified — just welcome them.
      void this.dispatchWelcome(user.email, user.firstName, user.locale);
    }

    await this.prisma.oAuthAccount.upsert({
      where: { provider_providerAccountId: { provider: "google", providerAccountId: profile.sub } },
      update: {},
      create: { userId: user.id, provider: "google", providerAccountId: profile.sub },
    });

    return this.completeLogin(user.id, user.email, user.isStaff, this.publicUser(user), dto.rememberMe, meta);
  }

  private async completeLogin(
    userId: string,
    email: string,
    isStaff: boolean,
    publicUser: ReturnType<AuthService["publicUser"]>,
    rememberMe: boolean | undefined,
    meta: RequestMeta
  ) {
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } }),
      this.prisma.loginHistory.create({ data: { userId, success: true, ...meta } }),
    ]);
    const ttl = rememberMe ? REMEMBER_TTL : REFRESH_TTL;
    const tokens = await this.issueSession(userId, email, isStaff, meta, ttl);
    return { user: publicUser, ...tokens };
  }

  // ── SMS one-time passcodes ────────────────────────────────────────────────
  async requestOtp(dto: RequestOtpDto) {
    const phone = normalizePhone(dto.phone);
    const purpose = (dto.purpose ?? "LOGIN") as OtpPurpose;

    // For LOGIN, don't reveal whether an account exists — always claim "sent".
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await this.prisma.otpChallenge.create({
      data: {
        phone,
        purpose,
        codeHash: this.hashToken(code),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });

    await this.sendSms(phone, `Moracat code: ${code} — valid for 5 minutes.`);
    this.logger.log(`OTP[${purpose}] issued for ${maskPhone(phone)}`);
    // Dev convenience so the flow is testable without a live SMS provider.
    return { sent: true, ...(IS_PROD ? {} : { devCode: code }) };
  }

  /** Verify + burn an OTP. Returns false on any failure (never throws). */
  private async consumeOtp(phone: string, purpose: OtpPurpose, code: string): Promise<boolean> {
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: { phone, purpose, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (!challenge) return false;
    if (challenge.attempts >= OTP_MAX_ATTEMPTS) return false;

    const matches =
      challenge.codeHash.length === this.hashToken(code).length &&
      timingSafeEqual(Buffer.from(this.hashToken(code)), Buffer.from(challenge.codeHash));

    if (!matches) {
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      return false;
    }

    await this.prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });
    return true;
  }

  // ── Forgot / reset password ───────────────────────────────────────────────
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    // Never leak whether the email exists (R006 — honest, but no enumeration).
    if (!user) return { sent: true };

    const token = randomBytes(32).toString("hex");
    await this.prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(token),
        expiresAt: new Date(Date.now() + RESET_TTL_MS),
      },
    });
    const resetUrl = `${this.siteUrl()}/reset-password?token=${token}`;
    const tpl = passwordResetTemplate(this.mailLocale(user.locale), resetUrl);
    await this.mail.send({ to: user.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
    // Keep the in-app record too, so the portal feed stays the source of truth.
    await this.notifications.notify(user.id, {
      category: "SYSTEM",
      title: "إعادة تعيين كلمة المرور",
      body: "طلبت إعادة تعيين كلمة المرور. الرابط صالح لمدة ساعة.",
    });
    this.logger.log(`Password reset requested for ${user.email}`);
    return { sent: true, ...(IS_PROD ? {} : { devToken: token }) };
  }

  // ── Email verification + change ───────────────────────────────────────────

  /** Issue a fresh verification token and email the confirm link. */
  private async sendVerificationEmail(
    userId: string,
    email: string,
    name: string | null,
    locale: MailLocale
  ) {
    const token = randomBytes(32).toString("hex");
    await this.prisma.emailVerification.create({
      data: {
        userId,
        tokenHash: this.hashToken(token),
        purpose: "VERIFY_EMAIL",
        expiresAt: new Date(Date.now() + EMAIL_VERIFY_TTL_MS),
      },
    });
    const url = `${this.siteUrl()}/verify-email?token=${token}`;
    const tpl = verifyEmailTemplate(this.mailLocale(locale), name, url);
    await this.mail.send({ to: email, subject: tpl.subject, html: tpl.html, text: tpl.text });
  }

  private async dispatchWelcome(email: string, name: string | null, locale: MailLocale) {
    const tpl = welcomeTemplate(this.mailLocale(locale), name);
    await this.mail.send({ to: email, subject: tpl.subject, html: tpl.html, text: tpl.text });
  }

  /** Resend a verification email to the authenticated (still-unverified) user. */
  async resendVerification(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, email: true, firstName: true, locale: true, emailVerified: true },
    });
    if (!user) throw new UnauthorizedException("Account not found");
    if (user.emailVerified) return { alreadyVerified: true };
    await this.sendVerificationEmail(user.id, user.email, user.firstName, user.locale);
    return { sent: true };
  }

  /** Consume a VERIFY_EMAIL or CHANGE_EMAIL token. */
  async verifyEmail(token: string) {
    const record = await this.prisma.emailVerification.findFirst({
      where: { tokenHash: this.hashToken(token), usedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!record) throw new BadRequestException("Invalid or expired verification link");

    if (record.purpose === "CHANGE_EMAIL") {
      if (!record.newEmail) throw new BadRequestException("Invalid verification link");
      const clash = await this.prisma.user.findUnique({
        where: { email: record.newEmail },
        select: { id: true },
      });
      if (clash && clash.id !== record.userId) {
        throw new ConflictException("That email is already in use");
      }
      await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id: record.userId },
          data: { email: record.newEmail, emailVerified: new Date() },
        }),
        this.prisma.emailVerification.update({
          where: { id: record.id },
          data: { usedAt: new Date() },
        }),
      ]);
      return { changed: true };
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerified: new Date() },
      }),
      this.prisma.emailVerification.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);
    return { verified: true };
  }

  /** Request an email change — password-confirmed, verified at the new address. */
  async requestEmailChange(userId: string, newEmailRaw: string, password: string) {
    const newEmail = newEmailRaw.toLowerCase().trim();
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, passwordHash: true, email: true, locale: true },
    });
    if (!user) throw new UnauthorizedException("Account not found");
    if (newEmail === user.email) throw new BadRequestException("That's already your email");

    const ok = user.passwordHash ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!ok) throw new UnauthorizedException("Password is incorrect");

    const clash = await this.prisma.user.findUnique({ where: { email: newEmail }, select: { id: true } });
    if (clash) throw new ConflictException("That email is already in use");

    const token = randomBytes(32).toString("hex");
    await this.prisma.emailVerification.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(token),
        purpose: "CHANGE_EMAIL",
        newEmail,
        expiresAt: new Date(Date.now() + EMAIL_VERIFY_TTL_MS),
      },
    });
    const url = `${this.siteUrl()}/verify-email?token=${token}&mode=change`;
    const tpl = emailChangeTemplate(this.mailLocale(user.locale), url);
    await this.mail.send({ to: newEmail, subject: tpl.subject, html: tpl.html, text: tpl.text });
    return { sent: true };
  }

  private siteUrl(): string {
    return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  }

  private mailLocale(locale: string | null | undefined): MailLocale {
    return locale === "en" ? "en" : "ar";
  }

  async resetPassword(token: string, newPassword: string) {
    const reset = await this.prisma.passwordReset.findFirst({
      where: { tokenHash: this.hashToken(token), usedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!reset) throw new BadRequestException("Invalid or expired reset link");

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: reset.userId }, data: { passwordHash } }),
      this.prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
      // Revoke all sessions on reset.
      this.prisma.deviceSession.updateMany({
        where: { userId: reset.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { success: true };
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
    return this.rotateSession(session.id, user.id, user.email, user.isStaff, meta, REFRESH_TTL);
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
      randomBytes(5).toString("hex").toUpperCase()
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

  // ── SMS delivery (Twilio REST API — no SDK dependency) ────────────────────
  private async sendSms(phone: string, message: string) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;

    if (sid && token && from) {
      try {
        const res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
              "content-type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ To: phone, From: from, Body: message }).toString(),
          }
        );
        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          this.logger.error(`Twilio SMS failed (${res.status}) to ${maskPhone(phone)}: ${detail.slice(0, 200)}`);
          return { queued: false };
        }
        this.logger.log(`SMS sent to ${maskPhone(phone)} via Twilio`);
        return { queued: true };
      } catch (e) {
        this.logger.error(`Twilio SMS error: ${(e as Error).message}`);
        return { queued: false };
      }
    }

    // No provider configured — log in dev so the flow still works locally.
    if (!IS_PROD) this.logger.debug(`SMS → ${maskPhone(phone)}: ${message}`);
    return { queued: true };
  }

  // ── Session helpers ───────────────────────────────────────────────────────
  private async issueSession(
    userId: string,
    email: string,
    isStaff: boolean,
    meta: RequestMeta,
    ttl: number
  ): Promise<TokenPair> {
    const session = await this.prisma.deviceSession.create({
      data: {
        userId,
        refreshHash: "pending",
        expiresAt: new Date(Date.now() + ttl * 1000),
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
      },
    });
    return this.rotateSession(session.id, userId, email, isStaff, meta, ttl, true);
  }

  private async rotateSession(
    sessionId: string,
    userId: string,
    email: string,
    isStaff: boolean,
    meta: RequestMeta,
    ttl: number,
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
      { secret: REFRESH_SECRET, expiresIn: ttl }
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
        ...(isNew ? {} : { expiresAt: new Date(Date.now() + ttl * 1000) }),
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
    memberIdNumber?: string | null;
    email: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    dialCode?: string;
    gender?: string;
    avatarUrl?: string | null;
    primaryCatId?: string | null;
    locale: string;
    isStaff: boolean;
    status: string;
  }) {
    return {
      id: user.id,
      memberIdNumber: user.memberIdNumber ?? null,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      dialCode: user.dialCode ?? "+966",
      gender: user.gender ?? "UNSPECIFIED",
      avatarUrl: user.avatarUrl ?? null,
      primaryCatId: user.primaryCatId ?? null,
      locale: user.locale,
      isStaff: user.isStaff,
      status: user.status,
    };
  }
}

// ── Module-local helpers ────────────────────────────────────────────────────

/** Normalise a phone to E.164-ish digits with a leading '+'. */
function normalizePhone(raw: string, dialCode?: string): string {
  let p = raw.replace(/[\s-]/g, "");
  if (p.startsWith("00")) p = "+" + p.slice(2);
  if (!p.startsWith("+")) {
    // A local number (leading 0 dropped) gets the chosen dial code, default +966.
    const cc = dialCode ?? "+966";
    p = cc + p.replace(/^0+/, "");
  }
  return p;
}

function splitName(fullName?: string, firstName?: string, lastName?: string) {
  if (firstName || lastName) return { firstName: firstName ?? null, lastName: lastName ?? null };
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: null, lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") || null };
}

function maskPhone(phone: string): string {
  return phone.length > 4 ? `${phone.slice(0, 4)}••••${phone.slice(-2)}` : "••••";
}

interface GoogleProfile {
  email?: string;
  email_verified?: string | boolean;
  given_name?: string;
  family_name?: string;
  picture?: string;
  aud?: string;
  sub: string;
}

/**
 * Verify a Google ID token via Google's tokeninfo endpoint — this validates the
 * signature, issuer and expiry for us (no crypto library needed). The caller
 * additionally checks the `aud` claim against our client ID.
 */
async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile | null> {
  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
    );
    if (!res.ok) return null;
    const claims = (await res.json()) as GoogleProfile;
    return claims.sub && claims.email ? claims : null;
  } catch {
    return null;
  }
}
