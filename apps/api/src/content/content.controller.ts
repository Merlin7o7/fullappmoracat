import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { ContentService } from "./content.service";
import { Public } from "../common/decorators/public.decorator";

@ApiTags("content")
@Public()
@Controller("content")
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get("blog")
  @ApiOperation({ summary: "List published blog posts" })
  blogList(@Query("page") page?: string) {
    return this.content.blogList(page ? Number(page) : 1);
  }

  @Get("blog/:slug")
  @ApiOperation({ summary: "Read one published post" })
  blogPost(@Param("slug") slug: string) {
    return this.content.blogPost(slug);
  }

  @Get("faqs")
  @ApiOperation({ summary: "Published FAQs" })
  faqs() {
    return this.content.faqs();
  }

  @Get("announcements")
  @ApiOperation({ summary: "Active announcements" })
  announcements() {
    return this.content.announcements();
  }

  @Get("testimonials")
  @ApiOperation({ summary: "Published testimonials" })
  testimonials() {
    return this.content.testimonials();
  }
}
