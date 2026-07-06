import { Controller, Get, Param, Patch, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { NotificationsService } from "./notifications.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";

@ApiTags("notifications")
@ApiBearerAuth()
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: "List my in-app notifications (paginated, newest first)" })
  list(@CurrentUser("id") userId: string, @Query("page") page?: string) {
    return this.notifications.list(userId, Number(page) || 1);
  }

  @Get("unread-count")
  @ApiOperation({ summary: "How many of my notifications are unread (for the bell badge)" })
  unread(@CurrentUser("id") userId: string) {
    return this.notifications.unreadCount(userId);
  }

  @Patch("read-all")
  @ApiOperation({ summary: "Mark all my notifications read" })
  readAll(@CurrentUser("id") userId: string) {
    return this.notifications.markAllRead(userId);
  }

  @Patch(":id/read")
  @ApiOperation({ summary: "Mark one notification read" })
  read(@CurrentUser("id") userId: string, @Param("id") id: string) {
    return this.notifications.markRead(userId, id);
  }
}
