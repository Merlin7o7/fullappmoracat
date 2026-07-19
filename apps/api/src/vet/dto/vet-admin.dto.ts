import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export const APPLICATION_STATUSES = [
  "SUBMITTED",
  "IN_REVIEW",
  "APPROVED",
  "REJECTED",
  "WITHDRAWN",
] as const;

export const ORG_STATUSES = [
  "APPLIED",
  "IN_REVIEW",
  "APPROVED",
  "LIVE",
  "SUSPENDED",
  "OFFBOARDED",
] as const;

export const ORG_TIERS = ["founding", "standard"] as const;

export class ApplicationListQueryDto {
  @ApiPropertyOptional({ enum: APPLICATION_STATUSES })
  @IsOptional()
  @IsIn(APPLICATION_STATUSES)
  status?: (typeof APPLICATION_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  cityId?: string;

  @ApiPropertyOptional({ description: "Match on clinic name, CR number, contact name or email." })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 25, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class ApproveApplicationDto {
  @ApiPropertyOptional({
    description: "Org English name. Defaults to the applied clinic name.",
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  nameEn?: string;

  @ApiProperty({ description: "Org Arabic name — Arabic is the default experience (R101)." })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  nameAr!: string;

  @ApiPropertyOptional({
    description: "URL slug. Generated from the English name when omitted.",
    example: "olaya-veterinary-clinic",
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "Slug may only contain lowercase letters, numbers and hyphens",
  })
  @MaxLength(80)
  slug?: string;

  @ApiPropertyOptional({ enum: ORG_TIERS, default: "standard" })
  @IsOptional()
  @IsIn(ORG_TIERS)
  tier?: (typeof ORG_TIERS)[number];

  @ApiPropertyOptional({ description: "First branch English name. Defaults to the org name." })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  branchNameEn?: string;

  @ApiPropertyOptional({ description: "First branch Arabic name. Defaults to the org Arabic name." })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  branchNameAr?: string;

  @ApiPropertyOptional({ description: "Note kept on the application record." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reviewNote?: string;
}

export class RejectApplicationDto {
  @ApiProperty({ description: "Why. Sent to the clinic, so write it as a person would." })
  @IsString()
  @MinLength(4)
  @MaxLength(1000)
  reason!: string;
}

export class ReviewApplicationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reviewNote?: string;
}

export class SuspendOrgDto {
  @ApiProperty({ description: "Reason, shown to the clinic and kept in the audit trail." })
  @IsString()
  @MinLength(4)
  @MaxLength(500)
  reason!: string;
}

export class OrgListQueryDto {
  @ApiPropertyOptional({ enum: ORG_STATUSES })
  @IsOptional()
  @IsIn(ORG_STATUSES)
  status?: (typeof ORG_STATUSES)[number];

  @ApiPropertyOptional({ description: "Filter by verification state." })
  @IsOptional()
  @IsIn(["true", "false"])
  verified?: string;

  @ApiPropertyOptional({ description: "Match on org name, slug or CR number." })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 25, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class AccessLogQueryDto {
  @ApiPropertyOptional({ description: "Narrow to one cat's record." })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  catId?: string;

  @ApiPropertyOptional({ description: "Only break-glass emergency reads." })
  @IsOptional()
  @IsIn(["true", "false"])
  emergency?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 50, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
