import { Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CommunityLikesService } from "./community-likes.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";

/**
 * Authenticated like actions. Deliberately a SEPARATE controller from the public
 * community browse — these require a signed-in member (the global JWT guard
 * applies because nothing here is @Public).
 */
@ApiTags("community")
@ApiBearerAuth()
@Controller("community")
export class CommunityLikesController {
  constructor(private readonly likes: CommunityLikesService) {}

  @Get("my-likes")
  @ApiOperation({ summary: "Slugs of public cats I've liked (for filled-heart state)" })
  myLikes(@CurrentUser("id") userId: string) {
    return this.likes.myLikedSlugs(userId);
  }

  @Post("cats/:slug/like")
  @ApiOperation({ summary: "Love a public cat (idempotent)" })
  like(@CurrentUser("id") userId: string, @Param("slug") slug: string) {
    return this.likes.like(userId, slug);
  }

  @Delete("cats/:slug/like")
  @ApiOperation({ summary: "Remove my like from a public cat" })
  unlike(@CurrentUser("id") userId: string, @Param("slug") slug: string) {
    return this.likes.unlike(userId, slug);
  }
}
