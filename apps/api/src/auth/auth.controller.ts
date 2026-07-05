import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import type { Request } from "express";
import { AuthService } from "./auth.service";
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
  VerifyEmailDto,
  ChangeEmailDto,
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
  @Post("register")
  @ApiOperation({ summary: "Create a new customer account" })
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.auth.register(dto, meta(req));
  }

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Authenticate with email + password" })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, meta(req));
  }

  @Public()
  @Post("otp/request")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Send an SMS one-time passcode" })
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto);
  }

  @Public()
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

  @Public()
  @Post("email/verify")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Confirm an email (or email change) using a token" })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto.token);
  }

  @ApiBearerAuth()
  @Post("email/verify/resend")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Resend the verification email to the current user" })
  resendVerification(@CurrentUser("id") userId: string) {
    return this.auth.resendVerification(userId);
  }

  @ApiBearerAuth()
  @Post("email/change")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Request an email change (password-confirmed, verified at new address)" })
  changeEmail(@CurrentUser("id") userId: string, @Body() dto: ChangeEmailDto) {
    return this.auth.requestEmailChange(userId, dto.newEmail, dto.password);
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
  @ApiOperation({ summary: "Disable 2FA" })
  disable2fa(@CurrentUser("id") userId: string) {
    return this.auth.disable2fa(userId);
  }
}
