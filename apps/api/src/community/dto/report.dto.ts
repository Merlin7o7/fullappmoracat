import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export const REPORT_REASONS = ["INAPPROPRIATE", "SPAM", "FAKE", "HARASSMENT", "OTHER"] as const;

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
