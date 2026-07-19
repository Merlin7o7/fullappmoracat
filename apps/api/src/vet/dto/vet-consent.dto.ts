/**
 * Consent DTOs — MRC-VET-001 §06 + P3 ("trust is bilateral").
 *
 * Two audiences share this file on purpose, because they are two halves of one
 * promise: a clinic may *request* access; only the owner may *grant* it, and the
 * owner can always see who looked. Keeping both shapes side by side makes it
 * hard to add a clinic-side field that quietly bypasses the owner.
 */
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { VetPageQueryDto } from "./vet-patient.dto";

/** Grantable tiers. T0 is never granted — it is the floor that keeps a cat alive. */
export const CONSENT_TIERS = ["T1", "T2"] as const;
export type ConsentTierName = (typeof CONSENT_TIERS)[number];

/** What the API reports as *effective* access, including the ungranted floor. */
export const EFFECTIVE_TIERS = ["T0", "T1", "T2"] as const;
export type EffectiveTier = (typeof EFFECTIVE_TIERS)[number];

export class RequestConsentDto {
  @ApiProperty({ description: "The cat whose record this clinic is asking to read." })
  @IsString()
  @MaxLength(40)
  catId!: string;

  @ApiProperty({ enum: CONSENT_TIERS, description: "T1 = care summary · T2 = full cross-clinic history." })
  @IsIn(CONSENT_TIERS)
  tier!: ConsentTierName;

  @ApiPropertyOptional({
    description: "Why the clinic needs it — shown to the owner verbatim in the request.",
    example: "Reviewing Mishmish's previous urinary episodes before choosing a diet.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class GrantConsentDto {
  @ApiProperty({ description: "One of the requesting member's own cats." })
  @IsString()
  @MaxLength(40)
  catId!: string;

  @ApiProperty({ description: "The clinic organisation being trusted." })
  @IsString()
  @MaxLength(40)
  orgId!: string;

  @ApiProperty({ enum: CONSENT_TIERS })
  @IsIn(CONSENT_TIERS)
  tier!: ConsentTierName;

  @ApiPropertyOptional({
    description: "Time-box the grant (e.g. 'share for 24 hours'). Omit for a standing grant.",
    example: "2026-07-20T09:00:00.000Z",
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class RevokeConsentDto {
  @ApiPropertyOptional({
    description: "Optional note kept with the revocation. Never required — leaving is never interrogated.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class AccessLogQueryDto extends VetPageQueryDto {
  @ApiPropertyOptional({ description: "Narrow the ledger to one cat. Omit for the whole household." })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  catId?: string;

  @ApiPropertyOptional({ example: "2026-01-01" })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: "2026-12-31" })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class OwnerGrantsQueryDto extends VetPageQueryDto {
  @ApiPropertyOptional({ description: "Narrow to one cat." })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  catId?: string;
}

export class EmergencyAccessDto {
  @ApiProperty({
    description:
      "Why break-glass was used. Required, shown to the owner verbatim, and reviewable by Moracat. " +
      "Emergency access is never silent.",
    example: "Unresponsive on arrival, owner unreachable — need allergies before induction.",
  })
  @IsString()
  @MaxLength(500)
  reason!: string;

  @ApiPropertyOptional({ description: "Branch where the emergency is happening." })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  branchId?: string;
}
