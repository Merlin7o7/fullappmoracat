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
import { resolveJwtSecret } from "../common/config/secrets";
import { authError } from "../common/errors";
import { PASSWORD_RULES, passwordRuleFailures } from "./password-policy";
import {
  otpEmailTemplate,
  welcomeTemplate,
  passwordResetTemplate,
  passwordChangedTemplate,
  twoFactorDisabledTemplate,
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
// No hardcoded default — resolveJwtSecret fails closed in prod (env.validation
// also refuses to boot) and mints a random per-process secret in dev/test.
const ACCESS_SECRET = resolveJwtSecret("JWT_ACCESS_SECRET");
const REFRESH_SECRET = resolveJwtSecret("JWT_REFRESH_SECRET");
const OTP_TTL_MS = Number(process.env.OTP_TTL_SECONDS ?? 300) * 1000; // 5 min
const OTP_MAX_ATTEMPTS = 5;
const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
const EMAIL_OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const EMAIL_OTP_COOLDOWN_MS = 60 * 1000; // min gap between resend requests
const EMAIL_OTP_MAX_SENDS_PER_HR = 6; // resend limit per user per hour
const EMAIL_OTP_MAX_ATTEMPTS = 5; // wrong guesses before a code is invalidated
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
      throw new BadRequestException(
        authError("TERMS_NOT_ACCEPTED", "You must accept the Terms & Privacy Policy")
      );
    }

    const email = dto.email.toLowerCase().trim();
    const phone = dto.phone ? normalizePhone(dto.phone, dto.dialCode) : null;

    const emailClash = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (emailClash) throw new ConflictException(authError("EMAIL_TAKEN", "Email is already registered"));
    if (phone) {
      const phoneClash = await this.prisma.user.findUnique({ where: { phone }, select: { id: true } });
      if (phoneClash) throw new ConflictException(authError("PHONE_TAKEN", "Mobile number is already registered"));
    }

    // Email sign-ups need a password (Google sign-ups arrive through googleAuth).
    if (!dto.password) {
      throw new BadRequestException(authError("PASSWORD_REQUIRED", "A password is required"));
    }
    this.assertStrongPassword(dto.password);

    // If a phone + OTP were supplied, treat the phone as verified on the spot.
    let phoneVerified: Date | null = null;
    if (dto.otp && phone) {
      const result = await this.verifyPhoneOtp(phone, "REGISTER", dto.otp, { consume: true });
      if (result !== "valid") throw this.otpException(result);
      phoneVerified = new Date();
    }

    const { firstName, lastName } = splitName(dto.fullName, dto.firstName, dto.lastName);
    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Attribute the signup to an inviting member only if the ref code is real
    // (never store junk from a hand-typed URL).
    let referredByCode: string | undefined;
    if (dto.ref) {
      const referrer = await this.prisma.user.findUnique({ where: { referralCode: dto.ref }, select: { id: true } });
      if (referrer) referredByCode = dto.ref;
    }

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
        referredByCode,
        termsAcceptedAt: new Date(),
        // Provision wallet + loyalty on signup.
        wallet: { create: {} },
        loyalty: { create: {} },
      },
    });

    // Send a 6-digit OTP. The account is authenticated but stays UNVERIFIED
    // until the code is confirmed — verification is a *parallel* task, not a
    // wall: only outward-publishing writes (community visibility, likes) are
    // gated on emailVerified (EmailVerifiedGuard). The Cat ID itself is never
    // held hostage to email deliverability (north star: ID in <2 min).
    // In prod the send is non-blocking; in dev/test we await so the flow (and
    // the e2e harness) can retrieve the code without email.
    let devEmailCode: string | undefined;
    if (IS_PROD) {
      // Fire-and-forget MUST catch: an unhandled rejection here (a Neon blip,
      // a rate-limit throw) kills the whole process with exit 1 — this exact
      // line was the prime suspect in the Render "Exited with status 1"
      // crashes. The member can always re-request the code from the portal.
      void this.sendEmailOtp(user.id).catch((e) => {
        this.logger.error(`post-signup verification email failed for ${user.id}: ${String(e)}`);
      });
    } else {
      const res = await this.sendEmailOtp(user.id);
      devEmailCode = (res as { devCode?: string }).devCode;
    }

    const tokens = await this.issueSession(user.id, user.email, user.isStaff, meta, REFRESH_TTL);
    return {
      user: this.publicUser(user),
      ...tokens,
      needsEmailVerification: true,
      ...(devEmailCode ? { devEmailCode } : {}),
    };
  }

  // ── Login (email + password) ──────────────────────────────────────────────
  async login(dto: LoginDto, meta: RequestMeta) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email.toLowerCase().trim(), deletedAt: null },
      include: { twoFactor: true },
    });

    // Brute-force lockout: too many recent failures for this account → refuse,
    // regardless of whether this attempt's password is correct. The error tells
    // the member exactly when to retry (R112 — every error is a recovery): the
    // lock releases when the THRESHOLD-th most recent failure ages out of the
    // window.
    if (user) {
      const recentFailures = await this.prisma.loginHistory.findMany({
        where: { userId: user.id, success: false, createdAt: { gt: new Date(Date.now() - LOCKOUT_WINDOW_MS) } },
        orderBy: { createdAt: "desc" },
        take: LOCKOUT_THRESHOLD,
        select: { createdAt: true },
      });
      const oldestFailure = recentFailures[recentFailures.length - 1];
      if (recentFailures.length >= LOCKOUT_THRESHOLD && oldestFailure) {
        const releaseAt = oldestFailure.createdAt.getTime() + LOCKOUT_WINDOW_MS;
        const retryAfterMinutes = Math.max(1, Math.ceil((releaseAt - Date.now()) / 60_000));
        throw new UnauthorizedException(
          authError("LOCKED_OUT", `Too many attempts. Please try again in ${retryAfterMinutes} minutes.`, {
            retryAfterMinutes,
          })
        );
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
      throw new UnauthorizedException(authError("BAD_CREDENTIALS", "Invalid email or password"));
    }

    // Enforce 2FA when enabled. TOTP_REQUIRED is a *structured* signal — the web
    // reveals the code field off this code, never off message text (which will
    // localize). A wrong TOTP counts toward the lockout window like a wrong
    // password, so 2FA codes can't be brute-forced past a correct password.
    if (user.twoFactor?.enabled) {
      if (!dto.totp) {
        throw new UnauthorizedException(authError("TOTP_REQUIRED", "A 2FA code is required"));
      }
      const valid = authenticator.verify({ token: dto.totp, secret: user.twoFactor.secret });
      if (!valid) {
        await this.prisma.loginHistory.create({
          data: { userId: user.id, success: false, reason: "bad_totp", ...meta },
        });
        throw new UnauthorizedException(authError("TOTP_INVALID", "Invalid 2FA code"));
      }
    }

    // A suspended/deactivated account can never obtain a fresh session — even
    // with correct credentials (the JWT strategy also blocks per-request, but
    // login must refuse up front so an abuser can't mint new tokens).
    this.assertLoginAllowed(user.status);

    return this.completeLogin(user.id, user.email, user.isStaff, this.publicUser(user), dto.rememberMe, meta);
  }

  /** Refuse suspended/deactivated accounts at any login entry point. */
  private assertLoginAllowed(status: string) {
    if (status === "SUSPENDED") {
      throw new UnauthorizedException(
        authError("ACCOUNT_SUSPENDED", "This account is suspended. Contact support.")
      );
    }
    if (status === "DEACTIVATED") {
      throw new UnauthorizedException(authError("ACCOUNT_DEACTIVATED", "This account is deactivated."));
    }
  }

  /** Structured strength check — mirrors GET /auth/password/rules (R112). */
  private assertStrongPassword(password: string) {
    const failed = passwordRuleFailures(password);
    if (failed.length > 0) {
      throw new BadRequestException(
        authError("WEAK_PASSWORD", "Password must be at least 8 characters with a letter and a number", {
          rules: PASSWORD_RULES,
          failed,
        })
      );
    }
  }

  /** Map a phone-OTP verification failure to its structured exception. */
  private otpException(reason: "invalid" | "expired" | "rate_limited") {
    switch (reason) {
      case "expired":
        return new UnauthorizedException(
          authError("OTP_EXPIRED", "Your code has expired. Request a new one.")
        );
      case "rate_limited":
        return new UnauthorizedException(
          authError("OTP_RATE_LIMITED", "Too many attempts. Request a new code.")
        );
      default:
        return new UnauthorizedException(authError("OTP_INVALID", "Incorrect code. Please try again."));
    }
  }

  // ── Login (mobile number + OTP) ───────────────────────────────────────────
  async phoneLogin(dto: PhoneLoginDto, meta: RequestMeta) {
    const phone = normalizePhone(dto.phone);

    // Look up the account BEFORE burning the code: an unregistered number must
    // not consume a still-valid OTP (the member may need it to register, R112).
    // Enumeration hygiene stays consistent with requestOtp's documented
    // approach (never reveal registration status to a blind caller): the OTP is
    // still validated first in every branch, so ACCOUNT_NOT_FOUND is only ever
    // revealed to someone who has proven possession of the phone.
    const user = await this.prisma.user.findFirst({ where: { phone, deletedAt: null } });
    const result = await this.verifyPhoneOtp(phone, "LOGIN", dto.otp, { consume: !!user });
    if (result !== "valid") throw this.otpException(result);
    if (!user) {
      throw new UnauthorizedException(authError("ACCOUNT_NOT_FOUND", "No account found for this number"));
    }
    this.assertLoginAllowed(user.status);

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

    this.assertLoginAllowed(user.status);
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

    // Per-phone send caps mirror the email-OTP path: a short cooldown and an
    // hourly ceiling so this endpoint can't be pumped to burn SMS budget. Silent
    // (still returns "sent") so it never reveals whether a number is registered.
    const now = Date.now();
    const recent = await this.prisma.otpChallenge.findMany({
      where: { phone, createdAt: { gt: new Date(now - 60 * 60 * 1000) } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (
      recent.length >= EMAIL_OTP_MAX_SENDS_PER_HR ||
      (recent[0] && now - recent[0].createdAt.getTime() < EMAIL_OTP_COOLDOWN_MS)
    ) {
      this.logger.warn(`OTP[${purpose}] rate-limited for ${maskPhone(phone)}`);
      return { sent: true };
    }

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

  /**
   * Verify a phone OTP; never throws — returns a structured reason so callers
   * can map to OTP_EXPIRED / OTP_INVALID / OTP_RATE_LIMITED. Wrong guesses
   * always count toward the attempt cap; the code is burned only when
   * `consume` is true (so a valid code isn't wasted on a doomed request, e.g.
   * a login for a number with no account).
   */
  private async verifyPhoneOtp(
    phone: string,
    purpose: OtpPurpose,
    code: string,
    opts: { consume: boolean }
  ): Promise<"valid" | "invalid" | "expired" | "rate_limited"> {
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: { phone, purpose, consumedAt: null },
      orderBy: { createdAt: "desc" },
    });
    // No live challenge at all reads as "expired" — the recovery is identical
    // (request a new code) and it leaks nothing about why.
    if (!challenge || challenge.expiresAt <= new Date()) return "expired";
    if (challenge.attempts >= OTP_MAX_ATTEMPTS) return "rate_limited";

    const matches =
      challenge.codeHash.length === this.hashToken(code).length &&
      timingSafeEqual(Buffer.from(this.hashToken(code)), Buffer.from(challenge.codeHash));

    if (!matches) {
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      return "invalid";
    }

    if (opts.consume) {
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: new Date() },
      });
    }
    return "valid";
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
      type: "password_reset_requested",
    });
    this.logger.log(`Password reset requested for ${user.email}`);
    return { sent: true, ...(IS_PROD ? {} : { devToken: token }) };
  }

  // ── Email verification via 6-digit OTP ────────────────────────────────────

  private async dispatchWelcome(email: string, name: string | null, locale: MailLocale) {
    const tpl = welcomeTemplate(this.mailLocale(locale), name);
    await this.mail.send({ to: email, subject: tpl.subject, html: tpl.html, text: tpl.text });
  }

  /** Salted, single-use hash of a short OTP (salted by user so codes can't
   *  collide across accounts, and constant-time compared on verify). */
  private hashOtp(code: string, userId: string): string {
    return this.hashToken(`${code}:${userId}`);
  }

  /**
   * Issue + email a 6-digit verification code to the authenticated user.
   * Rate-limited: a per-minute cooldown and a per-hour cap. Any previous
   * unconsumed code is invalidated so only the latest works.
   */
  async sendEmailOtp(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, email: true, firstName: true, locale: true, emailVerified: true },
    });
    if (!user) throw new UnauthorizedException("Account not found");
    if (user.emailVerified) return { alreadyVerified: true };

    const now = Date.now();
    const recent = await this.prisma.emailVerification.findMany({
      where: { userId, purpose: "VERIFY_EMAIL", createdAt: { gt: new Date(now - 60 * 60 * 1000) } },
      orderBy: { createdAt: "desc" },
    });
    if (recent.length >= EMAIL_OTP_MAX_SENDS_PER_HR) {
      throw new BadRequestException("Too many code requests. Please try again later.");
    }
    if (recent[0] && now - recent[0].createdAt.getTime() < EMAIL_OTP_COOLDOWN_MS) {
      throw new BadRequestException("Please wait a moment before requesting another code.");
    }

    // Only the newest code is valid.
    await this.prisma.emailVerification.deleteMany({ where: { userId, purpose: "VERIFY_EMAIL", usedAt: null } });

    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    await this.prisma.emailVerification.create({
      data: {
        userId,
        codeHash: this.hashOtp(code, userId),
        purpose: "VERIFY_EMAIL",
        expiresAt: new Date(now + EMAIL_OTP_TTL_MS),
      },
    });
    const tpl = otpEmailTemplate(this.mailLocale(user.locale), user.firstName, code);
    await this.mail.send({ to: user.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
    if (!IS_PROD) this.logger.log(`Email OTP for ${user.email}: ${code}`);
    // Dev/test convenience, mirroring the SMS path — never leaked in production.
    return { sent: true, ...(IS_PROD ? {} : { devCode: code }) };
  }

  /**
   * Correct the pending email while still unverified, then re-send the code.
   * The old flow pushed members back to /register — creating a duplicate
   * account and orphaning the first (with its burned member number). This is
   * the honest door: same account, corrected address, fresh code.
   */
  async changePendingEmail(userId: string, newEmail: string) {
    const email = newEmail.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, email: true, emailVerified: true },
    });
    if (!user) throw new UnauthorizedException(authError("ACCOUNT_NOT_FOUND", "Account not found"));
    if (user.emailVerified) {
      // A verified email is a credential — changing it needs the full
      // re-auth-protected account flow, not this convenience door.
      throw new BadRequestException(
        authError("EMAIL_ALREADY_VERIFIED", "Your email is already verified.")
      );
    }
    if (email === user.email) {
      // Same address — just re-send.
      return this.sendEmailOtp(userId);
    }
    const taken = await this.prisma.user.findFirst({
      where: { email, deletedAt: null, NOT: { id: userId } },
      select: { id: true },
    });
    if (taken) {
      throw new ConflictException(authError("EMAIL_TAKEN", "Email is already registered"));
    }
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { email } }),
      // Codes sent to the old address must never verify the new one.
      this.prisma.emailVerification.deleteMany({
        where: { userId, purpose: "VERIFY_EMAIL", usedAt: null },
      }),
    ]);
    return this.sendEmailOtp(userId);
  }

  /** Verify a 6-digit code for the current user; attempt-limited + brute-safe. */
  async verifyEmailOtp(userId: string, code: string) {
    const record = await this.prisma.emailVerification.findFirst({
      where: { userId, purpose: "VERIFY_EMAIL", usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (!record) throw new BadRequestException("Your code has expired. Request a new one.");
    if (record.attempts >= EMAIL_OTP_MAX_ATTEMPTS) {
      throw new BadRequestException("Too many attempts. Request a new code.");
    }

    const expected = Buffer.from(record.codeHash);
    const actual = Buffer.from(this.hashOtp(code, userId));
    const ok = expected.length === actual.length && timingSafeEqual(expected, actual);
    if (!ok) {
      await this.prisma.emailVerification.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException("Incorrect code. Please try again.");
    }

    const user = await this.prisma.$transaction(async (tx) => {
      await tx.emailVerification.update({ where: { id: record.id }, data: { usedAt: new Date() } });
      return tx.user.update({ where: { id: userId }, data: { emailVerified: new Date() } });
    });
    void this.dispatchWelcome(user.email, user.firstName, user.locale);
    return { verified: true };
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
    const [user] = await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: reset.userId }, data: { passwordHash } }),
      this.prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
      // Revoke all sessions on reset.
      this.prisma.deviceSession.updateMany({
        where: { userId: reset.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    // Security confirmation — a silent password change is what an attacker wants.
    const changed = passwordChangedTemplate(this.mailLocale(user.locale), user.firstName);
    void this.mail.send({ to: user.email, subject: changed.subject, html: changed.html, text: changed.text });
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
    const otpauthUrl = authenticator.keyuri(email, "Moracat", secret);
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

  /**
   * Disabling 2FA is a step-up action: it strips the account's strongest
   * control, so we re-authenticate first. Password by default; for password-less
   * (Google) accounts we require a current TOTP code instead. Either way the
   * member is emailed that 2FA was turned off.
   */
  async disable2fa(userId: string, dto: { password?: string; code?: string }) {
    const [user, tf] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { passwordHash: true, email: true, firstName: true, locale: true },
      }),
      this.prisma.twoFactor.findUnique({ where: { userId } }),
    ]);
    if (!user) throw new UnauthorizedException("Not authenticated");
    if (!tf) return { enabled: false }; // already off — nothing to re-auth against

    if (user.passwordHash) {
      const ok = dto.password
        ? await bcrypt.compare(dto.password, user.passwordHash)
        : false;
      if (!ok) throw new UnauthorizedException("Password is incorrect");
    } else {
      // No password on file — verify possession via a current TOTP code.
      const ok = dto.code
        ? authenticator.verify({ token: dto.code, secret: tf.secret })
        : false;
      if (!ok) throw new UnauthorizedException("A valid 2FA code is required");
    }

    await this.prisma.twoFactor.deleteMany({ where: { userId } });

    // Tell the member their strongest control was removed (parity with the
    // password-changed alert) so an attacker can't silently disable it.
    if (user.email) {
      const tpl = twoFactorDisabledTemplate(this.mailLocale(user.locale), user.firstName ?? undefined);
      void this.mail
        .send({ to: user.email, subject: tpl.subject, html: tpl.html, text: tpl.text })
        .catch(() => undefined);
    }
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
    emailVerified?: Date | null;
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
      emailVerified: !!user.emailVerified,
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
