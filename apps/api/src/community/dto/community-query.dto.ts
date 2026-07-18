import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class CommunityQueryDto {
  @IsOptional() @IsString() breedId?: string;
  @IsOptional() @IsString() cityId?: string;
  @IsOptional() @IsIn(["MALE", "FEMALE", "UNKNOWN"]) gender?: string;
  @IsOptional() @IsIn(["KITTEN", "ADULT", "SENIOR"]) stage?: string;
  // "viewed"/Trending is deliberately absent: view counting only became truthful
  // (deduped, beacon-driven) recently, so a popularity door built on the old
  // inflated numbers would be a dishonest collection (R006). "new" is the
  // explicit name for recency; "recent" is kept as its alias for old clients.
  @IsOptional() @IsIn(["recent", "new", "liked", "featured"]) sort?: string;
  @IsOptional() @IsString() @MaxLength(60) search?: string;
  @IsOptional() @IsString() page?: string;
}
