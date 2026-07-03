import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { AccountService } from "./account.service";
import { ChangePasswordDto, UpdateProfileDto } from "./dto/account.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";

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
}
