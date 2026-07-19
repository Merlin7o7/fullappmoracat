import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

/** Saudi commercial registration — exactly 10 digits. */
export const CR_RE = /^\d{10}$/;
/** Saudi VAT registration — exactly 15 digits. */
export const VAT_RE = /^\d{15}$/;
/** E.164-ish, matching the member-side convention. */
export const PHONE_RE = /^\+?[0-9]{8,15}$/;

export const BRANCH_DOCUMENT_KINDS = ["MEWA_LICENCE", "CR", "VAT", "INSURANCE", "OTHER"] as const;

// ── Public application ──────────────────────────────────────────────────────

export class ApplyDto {
  @ApiProperty({ example: "Olaya Veterinary Clinic" })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  clinicName!: string;

  @ApiProperty({ example: "1010123456", description: "Saudi commercial registration — 10 digits." })
  @IsString()
  @Matches(CR_RE, { message: "Commercial registration number must be 10 digits" })
  crNumber!: string;

  @ApiProperty({ example: "Dr. Noura Al-Harbi" })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  contactName!: string;

  @ApiProperty({ example: "noura@olayavet.sa" })
  @IsEmail({}, { message: "Enter a valid email address" })
  @MaxLength(160)
  contactEmail!: string;

  @ApiProperty({ example: "+966501234567" })
  @IsString()
  @Matches(PHONE_RE, { message: "Enter a valid phone number" })
  contactPhone!: string;

  @ApiProperty({ description: "City id from GET /geo/cities — the directory is city-first." })
  @IsString()
  @MaxLength(40)
  cityId!: string;

  @ApiPropertyOptional({ example: "King Abdulaziz Rd, Olaya" })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  addressLine?: string;

  @ApiPropertyOptional({ example: "MEWA-2291", description: "MEWA veterinary facility licence." })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  licenceNo?: string;

  @ApiPropertyOptional({ description: "Anything the clinic wants the review team to know." })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

// ── Org profile ─────────────────────────────────────────────────────────────

export class UpdateOrgDto {
  @ApiPropertyOptional({ example: "Olaya Veterinary Clinic" })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  nameEn?: string;

  @ApiPropertyOptional({ example: "عيادة العليا البيطرية" })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  nameAr?: string;

  @ApiPropertyOptional({ example: "300012345600003" })
  @IsOptional()
  @IsString()
  @Matches(VAT_RE, { message: "VAT number must be 15 digits" })
  vatNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false }, { message: "Logo must be a valid URL" })
  @MaxLength(500)
  logoUrl?: string;
}

// ── Branches ────────────────────────────────────────────────────────────────

export class CreateBranchDto {
  @ApiProperty({ example: "Olaya" })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  nameEn!: string;

  @ApiProperty({ example: "العليا" })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  nameAr!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  cityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  addressLine?: string;

  @ApiPropertyOptional({ example: 24.6935 })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional({ example: 46.6853 })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  lng?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  mapsUrl?: string;

  @ApiPropertyOptional({ example: "+966112345678" })
  @IsOptional()
  @IsString()
  @Matches(PHONE_RE, { message: "Enter a valid phone number" })
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail({}, { message: "Enter a valid email address" })
  @MaxLength(160)
  email?: string;

  @ApiPropertyOptional({
    description: "Opening hours as [{ day, open, close, closed }] — rendered, never parsed for logic.",
    type: "array",
    items: { type: "object" },
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  hours?: BranchHourDto[];

  @ApiPropertyOptional({ type: [String], example: ["dentistry", "surgery"] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(30)
  @MaxLength(60, { each: true })
  specialties?: string[];

  @ApiPropertyOptional({ type: [String], example: ["vaccination", "grooming"] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(40)
  @MaxLength(60, { each: true })
  services?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(12)
  @MaxLength(500, { each: true })
  photos?: string[];

  @ApiPropertyOptional({ description: "Open around the clock for emergencies." })
  @IsOptional()
  @IsBoolean()
  emergency24h?: boolean;

  @ApiPropertyOptional({
    description:
      "Show in the member-facing clinic directory. Only takes effect once Moracat has verified the org.",
  })
  @IsOptional()
  @IsBoolean()
  directoryVisible?: boolean;

  @ApiPropertyOptional({ example: "MEWA-2291" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  licenceNo?: string;

  @ApiPropertyOptional({ example: "2027-01-31" })
  @IsOptional()
  @IsISO8601({}, { message: "Licence expiry must be an ISO date" })
  licenceExpiresAt?: string;
}

/** One row of the weekly opening-hours table. */
export class BranchHourDto {
  @ApiProperty({ example: 0, description: "0 = Sunday … 6 = Saturday." })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  day!: number;

  @ApiPropertyOptional({ example: "09:00" })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "Time must be HH:mm" })
  open?: string;

  @ApiPropertyOptional({ example: "22:00" })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "Time must be HH:mm" })
  close?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  closed?: boolean;
}

/**
 * Every field optional — a branch edit is a patch, so a manager fixing the
 * phone number is never forced to re-send the whole record.
 */
export class UpdateBranchDto extends PartialType(CreateBranchDto) {
  @ApiPropertyOptional({ description: "Deactivate a branch without deleting its history." })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ── Branch documents ────────────────────────────────────────────────────────

export class CreateBranchDocumentDto {
  @ApiProperty({ enum: BRANCH_DOCUMENT_KINDS })
  @IsIn(BRANCH_DOCUMENT_KINDS, { message: "Unknown document kind" })
  kind!: (typeof BRANCH_DOCUMENT_KINDS)[number];

  @ApiProperty({ description: "Storage URL from the uploads service." })
  @IsString()
  @MaxLength(500)
  fileUrl!: string;

  @ApiPropertyOptional({ example: "2027-01-31" })
  @IsOptional()
  @IsISO8601({}, { message: "Expiry must be an ISO date" })
  expiresAt?: string;
}

// ── Counter devices ─────────────────────────────────────────────────────────

export class RegisterDeviceDto {
  @ApiProperty({ example: "Reception iPad — Olaya" })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;
}

// ── Public directory ────────────────────────────────────────────────────────

export class DirectoryQueryDto {
  @ApiPropertyOptional({ description: "Filter to one city." })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  cityId?: string;

  @ApiPropertyOptional({ description: "Only clinics open 24/7 for emergencies." })
  @IsOptional()
  @IsIn(["true", "false"])
  emergency?: string;

  @ApiPropertyOptional({ description: "Free-text match on clinic or branch name." })
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

  @ApiPropertyOptional({ default: 24, maximum: 60 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  limit?: number;
}
