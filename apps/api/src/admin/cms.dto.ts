import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

const STATUSES = ["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"] as const;

export class CreatePostDto {
  @ApiProperty() @IsString() @MaxLength(120) slug!: string;
  @ApiProperty() @IsString() @MaxLength(180) titleEn!: string;
  @ApiProperty() @IsString() @MaxLength(180) titleAr!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(400) excerptEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(400) excerptAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() bodyEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() bodyAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() coverUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) authorName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() categoryId?: string;
  @ApiPropertyOptional({ enum: STATUSES, default: "DRAFT" })
  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];
}
export class UpdatePostDto extends PartialType(CreatePostDto) {}

export class CreateFaqDto {
  @ApiProperty() @IsString() questionEn!: string;
  @ApiProperty() @IsString() questionAr!: string;
  @ApiProperty() @IsString() answerEn!: string;
  @ApiProperty() @IsString() answerAr!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
  @ApiPropertyOptional({ enum: STATUSES }) @IsOptional() @IsIn(STATUSES) status?: (typeof STATUSES)[number];
}
export class UpdateFaqDto extends PartialType(CreateFaqDto) {}

export class CreateAnnouncementDto {
  @ApiProperty() @IsString() @MaxLength(200) messageEn!: string;
  @ApiProperty() @IsString() @MaxLength(200) messageAr!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() linkUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() startsAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() endsAt?: string;
  @ApiPropertyOptional({ enum: STATUSES }) @IsOptional() @IsIn(STATUSES) status?: (typeof STATUSES)[number];
}
export class UpdateAnnouncementDto extends PartialType(CreateAnnouncementDto) {}
