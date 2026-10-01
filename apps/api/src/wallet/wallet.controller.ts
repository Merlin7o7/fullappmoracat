import { Controller, Get, Param, Res, UnauthorizedException } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { WalletService } from "./wallet.service";
import { ApplePassService } from "./apple-pass.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/public.decorator";
import { apiBase } from "../files/files.service";

const secret = () => process.env.JWT_ACCESS_SECRET ?? "dev-wallet-secret";
const sign = (payload: string) => createHmac("sha256", secret()).update(`wallet:${payload}`).digest("base64url");

@ApiTags("wallet")
@ApiBearerAuth()
@Controller("wallet")
export class WalletController {
  constructor(
    private readonly wallet: WalletService,
    private readonly apple: ApplePassService
  ) {}

  @Get("availability")
  @ApiOperation({ summary: "Which wallet targets are configured (drives UI buttons)" })
  availability() {
    return { ...this.wallet.availability(), apple: !!this.apple.creds() };
  }

  @Get("cats/:id/google")
  @ApiOperation({ summary: "Signed Save-to-Google-Wallet link for the member's cat" })
  google(@CurrentUser("id") userId: string, @Param("id") id: string) {
    return this.wallet.googleSaveUrl(userId, id);
  }

  /**
   * A 5-minute link the browser NAVIGATES to — Safari hands an
   * application/vnd.apple.pkpass response straight to Wallet, which a fetch()
   * of a blob cannot do. The token names the member and the cat; nothing else.
   */
  @Get("cats/:id/apple")
  @ApiOperation({ summary: "Short-lived link to the cat's Apple Wallet pass" })
  async appleLink(@CurrentUser("id") userId: string, @Param("id") id: string) {
    // Fails fast (503 / 404) before minting anything.
    await this.apple.pass(userId, id);
    const payload = Buffer.from(JSON.stringify({ u: userId, c: id, e: Math.floor(Date.now() / 1000) + 300 })).toString("base64url");
    return { url: `${apiBase()}/api/wallet/apple/${payload}.${sign(payload)}` };
  }

  @Public()
  @Get("apple/:token")
  async appleFile(@Param("token") token: string, @Res() res: Response) {
    const dot = token.lastIndexOf(".");
    const payload = token.slice(0, dot);
    const a = Buffer.from(token.slice(dot + 1));
    const b = Buffer.from(sign(payload));
    if (dot <= 0 || a.length !== b.length || !timingSafeEqual(a, b)) throw new UnauthorizedException();
    const body = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { u: string; c: string; e: number };
    if (body.e < Math.floor(Date.now() / 1000)) throw new UnauthorizedException("Link expired");
    const { buffer, fileName } = await this.apple.pass(body.u, body.c);
    res.setHeader("Content-Type", "application/vnd.apple.pkpass");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.send(buffer);
  }
}
