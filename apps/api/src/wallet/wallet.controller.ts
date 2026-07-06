import { Controller, Get, Param } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { WalletService } from "./wallet.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";

@ApiTags("wallet")
@ApiBearerAuth()
@Controller("wallet")
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get("availability")
  @ApiOperation({ summary: "Which wallet targets are configured (drives UI buttons)" })
  availability() {
    return this.wallet.availability();
  }

  @Get("cats/:id/google")
  @ApiOperation({ summary: "Signed Save-to-Google-Wallet link for the member's cat" })
  google(@CurrentUser("id") userId: string, @Param("id") id: string) {
    return this.wallet.googleSaveUrl(userId, id);
  }
}
