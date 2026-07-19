/**
 * Visit DTOs — MRC-VET-001 §09.
 *
 * Three modes because clinics have three tempos (QUICK ≈ 20s counter moment,
 * STANDARD = the full chart, EMERGENCY = paperwork after the cat is safe).
 * Reason chips are a closed vocabulary so the day-book stays analysable, with a
 * free-text escape hatch that never blocks the front desk.
 */
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsDateString, IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { VetPageQueryDto } from "./vet-patient.dto";

export const VISIT_MODES = ["QUICK", "STANDARD", "EMERGENCY"] as const;
export type VisitModeName = (typeof VISIT_MODES)[number];

export const VISIT_STATES = ["OPEN", "CLOSED"] as const;
export type VisitStateName = (typeof VISIT_STATES)[number];

/** The reason chips the front desk taps. `other` falls through to free text. */
export const VISIT_REASONS = [
  "vaccination",
  "illness",
  "follow-up",
  "grooming",
  "dental",
  "surgery",
  "emergency",
  "other",
] as const;

export class OpenVisitDto {
  @ApiProperty({ description: "The cat being seen." })
  @IsString()
  @MaxLength(40)
  catId!: string;

  @ApiPropertyOptional({ enum: VISIT_MODES, default: "STANDARD" })
  @IsOptional()
  @IsIn(VISIT_MODES)
  mode?: VisitModeName;

  @ApiPropertyOptional({
    description: "A reason chip, or free text when the chips don't fit. Never required to start care.",
    example: "vaccination",
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;

  @ApiPropertyOptional({
    description: "Branch the cat walked into. Must be inside the staff member's branch scope.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  branchId?: string;

  @ApiPropertyOptional({ description: "What the owner reports on arrival." })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  presentingComplaint?: string;

  @ApiPropertyOptional({
    default: false,
    description:
      "When an OPEN visit already exists for this cat at this org, return it instead of erroring. " +
      "Never fork a second chart (§18).",
  })
  @IsOptional()
  @IsBoolean()
  resumeExisting?: boolean;
}

export class UpdateVisitDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  presentingComplaint?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;

  @ApiPropertyOptional({ example: "2026-08-01", description: "Schedules the owner's follow-up nudge." })
  @IsOptional()
  @IsDateString()
  followUpAt?: string;
}

export class CloseVisitDto {
  @ApiPropertyOptional({
    description:
      "Why a visit is closing with no clinical entries on it. Required in that case — a chart " +
      "that records nothing must at least say why.",
    example: "Owner left before the consult; rebooked for Sunday.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({ example: "2026-08-01" })
  @IsOptional()
  @IsDateString()
  followUpAt?: string;
}

export class OwnerSummaryDto {
  @ApiProperty({
    description:
      "Plain-language summary the owner receives in-app. Use the cat's name (R082); no jargon, " +
      "no diagnosis codes — this is a letter home, not a chart extract.",
    example: "Mishmish had her FVRCP booster today and did brilliantly. Next dose due 03 Aug.",
  })
  @IsString()
  @MaxLength(2000)
  summary!: string;

  @ApiPropertyOptional({ example: "2026-08-03", description: "Optional follow-up date to set alongside." })
  @IsOptional()
  @IsDateString()
  followUpAt?: string;
}

export class ListVisitsQueryDto extends VetPageQueryDto {
  @ApiPropertyOptional({
    example: "2026-07-19",
    description: "Day-book date (clinic-local). Defaults to today when no other filter is given.",
  })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ example: "2026-07-01" })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: "2026-07-31" })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ enum: VISIT_STATES })
  @IsOptional()
  @IsIn(VISIT_STATES)
  state?: VisitStateName;

  @ApiPropertyOptional({ enum: VISIT_MODES })
  @IsOptional()
  @IsIn(VISIT_MODES)
  mode?: VisitModeName;

  @ApiPropertyOptional({ description: "Limit to one branch." })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  branchId?: string;

  @ApiPropertyOptional({ description: "Limit to one cat's visits at this clinic." })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  catId?: string;
}
