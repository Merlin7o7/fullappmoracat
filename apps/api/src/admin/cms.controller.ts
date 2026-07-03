import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { CmsService } from "./cms.service";
import {
  CreateAnnouncementDto,
  CreateFaqDto,
  CreatePostDto,
  UpdateAnnouncementDto,
  UpdateFaqDto,
  UpdatePostDto,
} from "./cms.dto";
import { RequirePermissions } from "../common/decorators/permissions.decorator";

@ApiTags("admin-cms")
@ApiBearerAuth()
@Controller("admin/cms")
export class CmsController {
  constructor(private readonly cms: CmsService) {}

  // ── Blog ─────────────────────────────────────────────────────────────────
  @Get("posts")
  @RequirePermissions("cms.read")
  @ApiOperation({ summary: "List all posts (any status)" })
  listPosts() {
    return this.cms.listPosts();
  }

  @Post("posts")
  @RequirePermissions("cms.write")
  @ApiOperation({ summary: "Create a post" })
  createPost(@Body() dto: CreatePostDto) {
    return this.cms.createPost(dto);
  }

  @Patch("posts/:id")
  @RequirePermissions("cms.write")
  @ApiOperation({ summary: "Update a post" })
  updatePost(@Param("id") id: string, @Body() dto: UpdatePostDto) {
    return this.cms.updatePost(id, dto);
  }

  @Post("posts/:id/publish")
  @RequirePermissions("cms.write")
  @ApiOperation({ summary: "Publish a post" })
  publish(@Param("id") id: string) {
    return this.cms.publishPost(id, true);
  }

  @Post("posts/:id/unpublish")
  @RequirePermissions("cms.write")
  @ApiOperation({ summary: "Unpublish (back to draft)" })
  unpublish(@Param("id") id: string) {
    return this.cms.publishPost(id, false);
  }

  // ── FAQs ─────────────────────────────────────────────────────────────────
  @Get("faqs")
  @RequirePermissions("cms.read")
  listFaqs() {
    return this.cms.listFaqs();
  }

  @Post("faqs")
  @RequirePermissions("cms.write")
  createFaq(@Body() dto: CreateFaqDto) {
    return this.cms.createFaq(dto);
  }

  @Patch("faqs/:id")
  @RequirePermissions("cms.write")
  updateFaq(@Param("id") id: string, @Body() dto: UpdateFaqDto) {
    return this.cms.updateFaq(id, dto);
  }

  @Delete("faqs/:id")
  @RequirePermissions("cms.write")
  deleteFaq(@Param("id") id: string) {
    return this.cms.deleteFaq(id);
  }

  // ── Announcements ─────────────────────────────────────────────────────────
  @Get("announcements")
  @RequirePermissions("cms.read")
  listAnnouncements() {
    return this.cms.listAnnouncements();
  }

  @Post("announcements")
  @RequirePermissions("cms.write")
  createAnnouncement(@Body() dto: CreateAnnouncementDto) {
    return this.cms.createAnnouncement(dto);
  }

  @Patch("announcements/:id")
  @RequirePermissions("cms.write")
  updateAnnouncement(@Param("id") id: string, @Body() dto: UpdateAnnouncementDto) {
    return this.cms.updateAnnouncement(id, dto);
  }

  @Delete("announcements/:id")
  @RequirePermissions("cms.write")
  deleteAnnouncement(@Param("id") id: string) {
    return this.cms.deleteAnnouncement(id);
  }
}
