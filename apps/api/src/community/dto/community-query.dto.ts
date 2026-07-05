import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class CommunityQueryDto {
  @IsOptional() @IsString() breedId?: string;
  @IsOptional() @IsString() cityId?: string;
  @IsOptional() @IsIn(["MALE", "FEMALE", "UNKNOWN"]) gender?: string;
  @IsOptional() @IsIn(["KITTEN", "ADULT", "SENIOR"]) stage?: string;
  @IsOptional() @IsIn(["recent", "viewed", "featured"]) sort?: string;
  @IsOptional() @IsString() @MaxLength(60) search?: string;
  @IsOptional() @IsString() page?: string;
}
