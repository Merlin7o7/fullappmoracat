import { Controller, Get, NotFoundException, Param, Res } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Response } from "express";
import { Public } from "../common/decorators/public.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { EventsService } from "../events/events.service";

/**
 * /r/:id — the tracked action behind a reminder (T5). Counts the tap, records
 * the event, and sends the person on to the clinic (tel: or wa.me). Mounted
 * outside the /api prefix so the URL in an email is short and human.
 */
@ApiExcludeController()
@Controller("r")
export class LinksController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService
  ) {}

  @Get(":id")
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async follow(@Param("id") id: string, @Res() res: Response) {
    const link = await this.prisma.trackedLink.findUnique({ where: { id } });
    if (!link || !/^(tel:|https:\/\/)/.test(link.target)) throw new NotFoundException("Unknown link");
    await this.prisma.trackedLink.update({ where: { id }, data: { clicks: { increment: 1 }, lastClickedAt: new Date() } });
    this.events.emit("reminder_link_clicked", {
      userId: link.userId, catId: link.catId, orgId: link.orgId, source: "web",
      props: { kind: link.kind, branch: link.branchId ?? null },
    });
    res.redirect(302, link.target);
  }
}
