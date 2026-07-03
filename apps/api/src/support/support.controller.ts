import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { SupportService } from "./support.service";
import { CreateTicketDto, ReplyDto } from "./dto/support.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";

@ApiTags("support")
@ApiBearerAuth()
@Controller("support/tickets")
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Post()
  @ApiOperation({ summary: "Open a support ticket" })
  create(@CurrentUser("id") userId: string, @Body() dto: CreateTicketDto) {
    return this.support.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: "List my tickets" })
  listMine(@CurrentUser("id") userId: string) {
    return this.support.listMine(userId);
  }

  @Get(":ticketNumber")
  @ApiOperation({ summary: "Get one of my tickets with the full thread" })
  getMine(@CurrentUser("id") userId: string, @Param("ticketNumber") ticketNumber: string) {
    return this.support.getMine(userId, ticketNumber);
  }

  @Post(":ticketNumber/reply")
  @ApiOperation({ summary: "Reply to my ticket" })
  reply(
    @CurrentUser("id") userId: string,
    @Param("ticketNumber") ticketNumber: string,
    @Body() dto: ReplyDto
  ) {
    return this.support.replyAsCustomer(userId, ticketNumber, dto.body);
  }

  @Post(":ticketNumber/close")
  @ApiOperation({ summary: "Close my ticket" })
  close(@CurrentUser("id") userId: string, @Param("ticketNumber") ticketNumber: string) {
    return this.support.closeAsCustomer(userId, ticketNumber);
  }
}

@ApiTags("admin-support")
@ApiBearerAuth()
@Controller("admin/support/tickets")
export class AdminSupportController {
  constructor(private readonly support: SupportService) {}

  @Get()
  @RequirePermissions("support.read")
  @ApiOperation({ summary: "List all tickets (optionally filter by status)" })
  listAll(@Query("status") status?: string) {
    return this.support.listAll(status);
  }

  @Get(":ticketNumber")
  @RequirePermissions("support.read")
  @ApiOperation({ summary: "Get any ticket with thread + customer" })
  getAny(@Param("ticketNumber") ticketNumber: string) {
    return this.support.getAny(ticketNumber);
  }

  @Post(":ticketNumber/reply")
  @RequirePermissions("support.write")
  @ApiOperation({ summary: "Reply as staff (notifies the customer)" })
  reply(
    @CurrentUser("id") staffId: string,
    @Param("ticketNumber") ticketNumber: string,
    @Body() dto: ReplyDto
  ) {
    return this.support.replyAsStaff(staffId, ticketNumber, dto.body);
  }

  @Post(":ticketNumber/resolve")
  @RequirePermissions("support.write")
  @ApiOperation({ summary: "Mark resolved (notifies the customer)" })
  resolve(@Param("ticketNumber") ticketNumber: string) {
    return this.support.setStatus(ticketNumber, "RESOLVED");
  }

  @Post(":ticketNumber/close")
  @RequirePermissions("support.write")
  @ApiOperation({ summary: "Close the ticket" })
  close(@Param("ticketNumber") ticketNumber: string) {
    return this.support.setStatus(ticketNumber, "CLOSED");
  }
}
