import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from "@nestjs/swagger";
import { AccountService } from "./account.service";
import { ChangePasswordDto, DeleteAccountDto, UpdateProfileDto } from "./dto/account.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";

interface UploadedImageFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

@ApiTags("account")
@ApiBearerAuth()
@Controller("account")
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Get("overview")
  @ApiOperation({ summary: "Dashboard overview aggregate" })
  overview(@CurrentUser("id") userId: string) {
    return this.account.overview(userId);
  }

  @Get("profile")
  @ApiOperation({ summary: "Get the current user's profile" })
  profile(@CurrentUser("id") userId: string) {
    return this.account.profile(userId);
  }

  @Patch("profile")
  @ApiOperation({ summary: "Update profile details" })
  updateProfile(@CurrentUser("id") userId: string, @Body() dto: UpdateProfileDto) {
    return this.account.updateProfile(userId, dto);
  }

  @Post("avatar")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 8 * 1024 * 1024 } }))
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Upload/replace the account profile picture" })
  setAvatar(@CurrentUser("id") userId: string, @UploadedFile() file: UploadedImageFile) {
    return this.account.setAvatar(userId, file);
  }

  @Post("change-password")
  @ApiOperation({ summary: "Change password (revokes all sessions)" })
  changePassword(@CurrentUser("id") userId: string, @Body() dto: ChangePasswordDto) {
    return this.account.changePassword(userId, dto);
  }

  @Get("wallet")
  @ApiOperation({ summary: "Wallet balance + transactions" })
  wallet(@CurrentUser("id") userId: string) {
    return this.account.wallet(userId);
  }

  @Get("loyalty")
  @ApiOperation({ summary: "Loyalty points, tier + history" })
  loyalty(@CurrentUser("id") userId: string) {
    return this.account.loyalty(userId);
  }

  @Get("activity")
  @ApiOperation({ summary: "Login history + active sessions" })
  activity(@CurrentUser("id") userId: string) {
    return this.account.activity(userId);
  }

  @Get("notifications")
  @ApiOperation({ summary: "Recent notifications" })
  notifications(@CurrentUser("id") userId: string) {
    return this.account.notifications(userId);
  }

  @Post("notifications/:id/read")
  @ApiOperation({ summary: "Mark a notification read" })
  markRead(@CurrentUser("id") userId: string, @Param("id") id: string) {
    return this.account.markNotificationRead(userId, id);
  }

  // ── Referral + notification preferences ───────────────────────────────────
  @Get("referral")
  @ApiOperation({ summary: "My referral code, invite link, and count of members invited" })
  referral(@CurrentUser("id") userId: string) {
    return this.account.referral(userId);
  }

  @Get("notification-preferences")
  @ApiOperation({ summary: "Email notification preferences by category" })
  notificationPreferences(@CurrentUser("id") userId: string) {
    return this.account.notificationPreferences(userId);
  }

  @Patch("notification-preferences")
  @ApiOperation({ summary: "Toggle an email notification category" })
  setNotificationPreference(@CurrentUser("id") userId: string, @Body() body: { category: string; enabled: boolean }) {
    return this.account.setNotificationPreference(userId, body.category, body.enabled);
  }

  // ── PDPL: data portability + erasure ──────────────────────────────────────
  @Get("export")
  @ApiOperation({ summary: "Export all of my data (PDPL right of access)" })
  exportData(@CurrentUser("id") userId: string) {
    return this.account.exportMyData(userId);
  }

  @Post("delete")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Delete my account (PDPL erasure — anonymized, re-auth required)" })
  deleteAccount(@CurrentUser("id") userId: string, @Body() dto: DeleteAccountDto) {
    return this.account.deleteAccount(userId, dto);
  }
}
