import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";

export const ACQUISITION_SOURCES = [
  "ADOPTED",
  "PURCHASED_BREEDER",
  "PURCHASED_SHOP",
  "RESCUED_STRAY",
  "GIFT",
  "BORN_AT_HOME",
  "OTHER",
] as const;
export type AcquisitionSource = (typeof ACQUISITION_SOURCES)[number];

/** Trim strings; an empty string means "clear this field" (→ null). */
const TrimToNull = () =>
  Transform(({ value }) => (typeof value === "string" ? value.trim() || null : value));

/**
 * The owner-editable health profile (MRC-PROD-001 T3). Every field is
 * optional and PATCH-semantic: absent = unchanged, null/"" = cleared, list =
 * replaced. This is the ONE place an owner edits allergies and conditions, so
 * unlike the profile journey it may send an empty list on purpose.
 */
export class HealthProfileDto {
  @ApiPropertyOptional({ example: "968000011122233", nullable: true })
  @IsOptional()
  @TrimToNull()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(30)
  microchipNo?: string | null;

  @ApiPropertyOptional({ type: [String], description: "Allergen names — replaces the list" })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  allergies?: string[];

  @ApiPropertyOptional({ type: [String], description: "Health condition names — replaces the list" })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  healthConditions?: string[];

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @TrimToNull()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(280)
  currentMedications?: string | null;

  @ApiPropertyOptional({ example: "Royal Canin Indoor 27", nullable: true })
  @IsOptional()
  @TrimToNull()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(120)
  currentFood?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @TrimToNull()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(500)
  emergencyNotes?: string | null;

  @ApiPropertyOptional({ enum: ACQUISITION_SOURCES, nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsIn(ACQUISITION_SOURCES)
  acquisitionSource?: AcquisitionSource | null;

  @ApiPropertyOptional({ example: "Al Olaya", nullable: true })
  @IsOptional()
  @TrimToNull()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(80)
  district?: string | null;

  /** The clinic reminders route to. Must be a live, directory-visible branch. */
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @TrimToNull()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(40)
  homeBranchId?: string | null;
}

/** The person to reach when the owner can't be — visible to any treating clinic (T0). */
export class EmergencyContactDto {
  @ApiProperty({ example: "Sara" })
  @IsString()
  @MaxLength(80)
  name!: string;

  @ApiProperty({ example: "+966500000000" })
  @IsString()
  @Matches(/^\+?[0-9]{8,15}$/, { message: "Invalid phone number" })
  phone!: string;

  @ApiPropertyOptional({ example: "Sister" })
  @IsOptional()
  @TrimToNull()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(60)
  relation?: string | null;
}

export const DOCUMENT_KINDS = [
  "adoption",
  "pedigree",
  "lab",
  "insurance",
  "other",
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export class CreateVaccinationDto {
  @ApiProperty({ example: "Tricat" })
  @IsString()
  @MaxLength(80)
  name!: string;

  @ApiProperty({ example: "2026-01-15" })
  @IsDateString()
  administeredAt!: string;

  @ApiPropertyOptional({ example: "2027-01-15" })
  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  vetName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  clinic?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  batchNo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(280)
  notes?: string;
}

export class CreateVetVisitDto {
  @ApiProperty({ example: "2026-03-02" })
  @IsDateString()
  visitedAt!: string;

  @ApiProperty({ example: "Annual check-up" })
  @IsString()
  @MaxLength(160)
  reason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  clinic?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  vetName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(280)
  diagnosis?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({ example: 4.6 })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(20)
  weightKg?: number;

  @ApiPropertyOptional({ example: 150 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;
}

export class CreateDocumentDto {
  @ApiProperty({ example: "Adoption certificate" })
  @IsString()
  @MaxLength(120)
  title!: string;

  @ApiProperty({ enum: DOCUMENT_KINDS })
  @IsIn(DOCUMENT_KINDS)
  kind!: DocumentKind;

  @ApiProperty({ example: "https://…" })
  @IsString()
  url!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(280)
  notes?: string;
}
