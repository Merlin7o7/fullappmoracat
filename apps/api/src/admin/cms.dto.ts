import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, IsUrl, Matches, MaxLength, Min } from "class-validator";

const STATUSES = ["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"] as const;
const URL_OPTS = { protocols: ["http", "https"], require_protocol: true };

export class CreatePostDto {
  @ApiProperty() @IsString() @MaxLength(120) @Matches(/^[a-z0-9-]+$/, { message: "slug must be lowercase letters, numbers and dashes" }) slug!: string;
  @ApiProperty() @IsString() @MaxLength(180) titleEn!: string;
  @ApiProperty() @IsString() @MaxLength(180) titleAr!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(400) excerptEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(400) excerptAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40000) bodyEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40000) bodyAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsUrl(URL_OPTS) @MaxLength(600) coverUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) authorName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() categoryId?: string;
  @ApiPropertyOptional({ enum: STATUSES, default: "DRAFT" })
  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];
}
export class UpdatePostDto extends PartialType(CreatePostDto) {}

export class CreateFaqDto {
  @ApiProperty() @IsString() @MaxLength(300) questionEn!: string;
  @ApiProperty() @IsString() @MaxLength(300) questionAr!: string;
  @ApiProperty() @IsString() @MaxLength(4000) answerEn!: string;
  @ApiProperty() @IsString() @MaxLength(4000) answerAr!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) category?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
  @ApiPropertyOptional({ enum: STATUSES }) @IsOptional() @IsIn(STATUSES) status?: (typeof STATUSES)[number];
}
export class UpdateFaqDto extends PartialType(CreateFaqDto) {}

export class CreateAnnouncementDto {
  @ApiProperty() @IsString() @MaxLength(200) messageEn!: string;
  @ApiProperty() @IsString() @MaxLength(200) messageAr!: string;
  @ApiPropertyOptional() @IsOptional() @IsUrl(URL_OPTS) @MaxLength(600) linkUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() startsAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() endsAt?: string;
  @ApiPropertyOptional({ enum: STATUSES }) @IsOptional() @IsIn(STATUSES) status?: (typeof STATUSES)[number];
}
export class UpdateAnnouncementDto extends PartialType(CreateAnnouncementDto) {}
