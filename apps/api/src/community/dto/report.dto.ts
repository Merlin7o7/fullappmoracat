import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

// ANIMAL_WELFARE is listed first: a concern for the animal itself is the report
// this community exists to receive (the cat is the hero — R: safety before pride).
export const REPORT_REASONS = [
  "ANIMAL_WELFARE",
  "INAPPROPRIATE",
  "SPAM",
  "FAKE",
  "HARASSMENT",
  "OTHER",
] as const;

export class ReportCatDto {
  @ApiProperty({ enum: REPORT_REASONS })
  @IsIn(REPORT_REASONS)
  reason!: (typeof REPORT_REASONS)[number];

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  detail?: string;
}
