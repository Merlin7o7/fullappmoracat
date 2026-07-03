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
import { LoginDto, RefreshDto, RegisterDto, Verify2faDto } from "./dto/auth.dto";
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
  @ApiOperation({ summary: "Authenticate and receive access + refresh tokens" })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, meta(req));
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
