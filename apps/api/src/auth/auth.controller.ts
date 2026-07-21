import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { AuthService } from "./auth.service";
import { TurnstileGuard } from "../security/turnstile.guard";

/**
 * Tight per-route limits on the credential + code-sending surfaces (the global
 * default is a loose 120/min meant for ordinary reads). These blunt credential
 * stuffing and stop the SMS/email OTP endpoints from being pumped for cost.
 */
const STRICT = { default: { limit: 8, ttl: 60_000 } } as const;
const OTP_SEND = { default: { limit: 4, ttl: 60_000 } } as const;
import {
  ForgotPasswordDto,
  GoogleAuthDto,
  LoginDto,
  PhoneLoginDto,
  RefreshDto,
  RegisterDto,
  RequestOtpDto,
  ResetPasswordDto,
  Verify2faDto,
  Disable2faDto,
  VerifyOtpDto,
  ChangePendingEmailDto,
} from "./dto/auth.dto";
import { Public } from "../common/decorators/public.decorator";
import { CurrentUser, type AuthUser } from "../common/decorators/current-user.decorator";

function meta(req: Request) {
  return {
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  };
}

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle(STRICT)
  // Proof-of-humanity on the account door (no-op until Turnstile is configured).
  // Registration is the other half of census integrity: gate the account and the
  // cat, and a script can't cheaply mint either (R006).
  @UseGuards(TurnstileGuard)
  @Post("register")
  @ApiOperation({ summary: "Create a new customer account" })
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.auth.register(dto, meta(req));
  }

  @Public()
  @Throttle(STRICT)
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Authenticate with email + password" })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, meta(req));
  }

  @Public()
  @Throttle(OTP_SEND)
  @Post("otp/request")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Send an SMS one-time passcode" })
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto);
  }

  @Public()
  @Throttle(STRICT)
  @Post("otp/login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Authenticate with mobile number + OTP" })
  phoneLogin(@Body() dto: PhoneLoginDto, @Req() req: Request) {
    return this.auth.phoneLogin(dto, meta(req));
  }

  @Public()
  @Post("google")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Continue with Google" })
  google(@Body() dto: GoogleAuthDto, @Req() req: Request) {
    return this.auth.googleAuth(dto, meta(req));
  }

  @Public()
  @Throttle(OTP_SEND)
  @Post("password/forgot")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Request a password-reset link" })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Public()
  @Post("password/reset")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Reset a password using a reset token" })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.newPassword);
  }

  @ApiBearerAuth()
  @Throttle(OTP_SEND)
  @Post("email/otp/send")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Send/resend a 6-digit email verification code to the current user" })
  sendEmailOtp(@CurrentUser("id") userId: string) {
    return this.auth.sendEmailOtp(userId);
  }

  @ApiBearerAuth()
  @Post("email/otp/verify")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Verify the 6-digit email code for the current user" })
  verifyEmailOtp(@CurrentUser("id") userId: string, @Body() dto: VerifyOtpDto) {
    return this.auth.verifyEmailOtp(userId, dto.code);
  }

  // "Wrong email? Fix it here" used to re-register — orphaning the first
  // account and burning its member number. This is the real door: while the
  // email is still unverified, correct it in place and re-send the code.
  @ApiBearerAuth()
  @Throttle(OTP_SEND)
  @Patch("email")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Correct the pending (unverified) email address and re-send the code" })
  changePendingEmail(@CurrentUser("id") userId: string, @Body() dto: ChangePendingEmailDto) {
    return this.auth.changePendingEmail(userId, dto.email);
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Exchange a refresh token for a new token pair (rotated)" })
  refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.auth.refresh(dto.refreshToken, meta(req));
  }

  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Revoke the current device session" })
  logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @ApiBearerAuth()
  @Get("me")
  @ApiOperation({ summary: "Get the authenticated user's profile" })
  me(@CurrentUser("id") userId: string) {
    return this.auth.me(userId);
  }

  @ApiBearerAuth()
  @Post("2fa/setup")
  @ApiOperation({ summary: "Begin 2FA enrolment — returns a secret + otpauth URL" })
  setup2fa(@CurrentUser() user: AuthUser) {
    return this.auth.setup2fa(user.id, user.email);
  }

  @ApiBearerAuth()
  @Post("2fa/enable")
  @ApiOperation({ summary: "Confirm 2FA with a code — returns backup codes" })
  enable2fa(@CurrentUser("id") userId: string, @Body() dto: Verify2faDto) {
    return this.auth.enable2fa(userId, dto.code);
  }

  @ApiBearerAuth()
  @Post("2fa/disable")
  @ApiOperation({ summary: "Disable 2FA — requires the account password (or a current code)" })
  disable2fa(@CurrentUser("id") userId: string, @Body() dto: Disable2faDto) {
    return this.auth.disable2fa(userId, dto);
  }
}
