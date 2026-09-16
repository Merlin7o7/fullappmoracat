import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  Equals,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsISO8601,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";
import {
  asciiDigits,
  CR_NUMBER_RE,
  NATIONAL_ADDRESS_CODE_RE,
  REGISTRATION_TEAM_ROLES,
  REOPENABLE_STEPS,
  SAUDI_CITY_CODES,
  UNIFIED_NUMBER_RE,
  VAT_NUMBER_RE,
} from "@moraqat/core";
import type { VetRole } from "@moraqat/core";
import { BranchHourDto } from "./vet-org.dto";

/** Trim strings; turn "" into undefined so optional fields stay optional. */
const trim = () =>
  Transform(({ value }) => {
    if (typeof value !== "string") return value;
    const t = value.trim();
    return t === "" ? undefined : t;
  });
/** Arabic-Indic digits → ASCII, whitespace stripped. */
const digits = () =>
  Transform(({ value }) => (typeof value === "string" ? asciiDigits(value).replace(/\s+/g, "") : value));

export const ORG_TIERS = ["founding", "standard"] as const;

// ── Admin: invite a clinic ──────────────────────────────────────────────────

export class InviteClinicDto {
  @ApiProperty({ example: "عيادة النخيل البيطرية" })
  @trim()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  nameAr!: string;

  @ApiPropertyOptional({ example: "Palm Veterinary Clinic" })
  @trim()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  nameEn?: string;

  @ApiProperty({ example: "د. نورة الحربي" })
  @trim()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  contactName!: string;

  @ApiProperty({ example: "owner@clinic.sa" })
  @trim()
  @IsEmail({}, { message: "Enter a valid email address" })
  @MaxLength(160)
  email!: string;

  @ApiProperty({ example: "0501234567" })
  @trim()
  @IsString()
  @MaxLength(20)
  phone!: string;

  @ApiPropertyOptional({ enum: ORG_TIERS, default: "standard" })
  @IsOptional()
  @IsIn(ORG_TIERS)
  tier?: (typeof ORG_TIERS)[number];

  @ApiPropertyOptional({ description: "Internal note — never shown to the clinic." })
  @trim()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class ReviewNoteDto {
  @ApiPropertyOptional()
  @trim()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class RequestChangesDto {
  @ApiProperty({ description: "What must change — the clinic reads this verbatim." })
  @trim()
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  note!: string;

  @ApiProperty({ enum: REOPENABLE_STEPS, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(REOPENABLE_STEPS, { each: true })
  steps!: string[];
}

export class RejectRegistrationDto {
  @ApiProperty()
  @trim()
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  reason!: string;
}

export class AdminOrgListQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  status?: string;

  @ApiPropertyOptional()
  @trim()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number;
}

// ── Registration: account ───────────────────────────────────────────────────

export class RegistrationTokenDto {
  @ApiProperty()
  @IsString()
  @Length(20, 200)
  token!: string;
}

export class RegistrationAccountDto extends RegistrationTokenDto {
  @ApiProperty()
  @trim()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName!: string;

  @ApiPropertyOptional()
  @trim()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;

  @ApiProperty({ example: "0501234567" })
  @trim()
  @IsString()
  @MaxLength(20)
  phone!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

// ── Registration: clinic legal details ──────────────────────────────────────

export class RegistrationClinicDto {
  @ApiProperty()
  @trim()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  nameAr!: string;

  @ApiProperty()
  @trim()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  nameEn!: string;

  @ApiProperty({ description: "Legal entity name in Arabic, exactly as on the CR." })
  @trim()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  legalNameAr!: string;

  @ApiPropertyOptional()
  @trim()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  legalNameEn?: string;

  @ApiProperty({ example: "1010123456" })
  @digits()
  @Matches(CR_NUMBER_RE, { message: "The commercial registration number is 10 digits" })
  crNumber!: string;

  @ApiProperty({ example: "7001234567" })
  @digits()
  @Matches(UNIFIED_NUMBER_RE, { message: "The unified national number is 10 digits starting with 7" })
  unifiedNumber!: string;

  @ApiProperty({ example: "2027-03-01" })
  @IsISO8601({}, { message: "Enter the CR expiry date" })
  crExpiresAt!: string;

  @ApiPropertyOptional({ example: "300000000000003" })
  @digits()
  @IsOptional()
  @Matches(VAT_NUMBER_RE, { message: "A VAT number is 15 digits, starting and ending with 3" })
  vatNumber?: string;

  @ApiPropertyOptional({ description: "Public URL from /uploads/image." })
  @trim()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;
}

// ── Registration: branches ──────────────────────────────────────────────────

export class RegistrationBranchDto {
  @ApiPropertyOptional({ description: "Existing branch id; omit to create." })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  id?: string;

  @ApiProperty()
  @trim()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  nameAr!: string;

  @ApiPropertyOptional()
  @trim()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  nameEn?: string;

  @ApiProperty({ description: "Census city code (packages/core SAUDI_CITY_CODES)." })
  @IsIn(SAUDI_CITY_CODES as unknown as string[], { message: "Choose a city" })
  cityCode!: string;

  @ApiProperty()
  @trim()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  district!: string;

  @ApiProperty()
  @trim()
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  addressLine!: string;

  @ApiPropertyOptional({ example: "RRRD2929" })
  @Transform(({ value }) =>
    typeof value === "string" ? asciiDigits(value).replace(/\s+/g, "").toUpperCase() || undefined : value
  )
  @IsOptional()
  @Matches(NATIONAL_ADDRESS_CODE_RE, { message: "The short address is 4 letters and 4 digits, e.g. RRRD2929" })
  nationalAddressCode?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsLatitude()
  lat!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsLongitude()
  lng!: number;

  @ApiPropertyOptional()
  @trim()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  mapsUrl?: string;

  @ApiProperty()
  @trim()
  @IsString()
  @MaxLength(20)
  phone!: string;

  @ApiPropertyOptional()
  @trim()
  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @ApiPropertyOptional({ type: [BranchHourDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => BranchHourDto)
  hours?: BranchHourDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emergency24h?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  services?: string[];

  @ApiProperty({ description: "MEWA veterinary licence number." })
  @trim()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  licenceNo!: string;

  @ApiProperty({ example: "2027-03-01" })
  @IsISO8601({}, { message: "Enter the licence expiry date" })
  licenceExpiresAt!: string;
}

export class RegistrationBranchesDto {
  @ApiProperty({ type: [RegistrationBranchDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => RegistrationBranchDto)
  branches!: RegistrationBranchDto[];
}

// ── Registration: documents ─────────────────────────────────────────────────

export const UPLOADABLE_DOCUMENT_KINDS = ["CR", "VAT", "MEWA_LICENCE", "INSURANCE", "OTHER"] as const;

/** Multipart fields that accompany the file. */
export class RegistrationDocumentDto {
  @ApiProperty({ enum: UPLOADABLE_DOCUMENT_KINDS })
  @IsIn(UPLOADABLE_DOCUMENT_KINDS, { message: "Unknown document kind" })
  kind!: (typeof UPLOADABLE_DOCUMENT_KINDS)[number];

  @ApiPropertyOptional({ description: "Required for MEWA_LICENCE." })
  @trim()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  branchId?: string;

  @ApiPropertyOptional()
  @trim()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  number?: string;

  @ApiPropertyOptional()
  @trim()
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}

// ── Registration: team ──────────────────────────────────────────────────────

export class RegistrationTeamMemberDto {
  @ApiProperty()
  @trim()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @ApiProperty()
  @trim()
  @IsEmail({}, { message: "Enter a valid email address" })
  @MaxLength(160)
  email!: string;

  @ApiProperty({ example: "0501234567" })
  @trim()
  @IsString()
  @MaxLength(20)
  phone!: string;

  @ApiProperty({ enum: REGISTRATION_TEAM_ROLES })
  @IsIn(REGISTRATION_TEAM_ROLES as unknown as string[], { message: "Choose a role" })
  role!: VetRole;

  @ApiPropertyOptional({ example: "د." })
  @trim()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  title?: string;

  @ApiPropertyOptional()
  @trim()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  licenceNo?: string;

  @ApiPropertyOptional()
  @trim()
  @IsOptional()
  @IsISO8601()
  licenceExpiresAt?: string;

  @ApiPropertyOptional({ type: [String], description: "Branch ids; empty = every branch." })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  branchIds?: string[];
}

export class RegistrationTeamDto {
  @ApiProperty({ type: [RegistrationTeamMemberDto] })
  @IsArray()
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => RegistrationTeamMemberDto)
  members!: RegistrationTeamMemberDto[];

  @ApiPropertyOptional({ description: "The owner is a practising veterinarian (solo practice)." })
  @IsOptional()
  @IsBoolean()
  ownerPractisesAsVet?: boolean;

  @ApiPropertyOptional({ description: "Owner's practitioner licence — required when ownerPractisesAsVet." })
  @trim()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  ownerLicenceNo?: string;

  @ApiPropertyOptional()
  @trim()
  @IsOptional()
  @IsISO8601()
  ownerLicenceExpiresAt?: string;

  @ApiPropertyOptional({ example: "د." })
  @trim()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  ownerTitle?: string;
}

/** Stored shape of PartnerOrg.registrationTeam. */
export interface RegistrationTeamMember {
  fullName: string;
  email: string;
  phone: string;
  role: VetRole;
  title?: string | null;
  licenceNo?: string | null;
  licenceExpiresAt?: string | null;
  branchIds: string[];
}

// ── Registration: submit ────────────────────────────────────────────────────

export class RegistrationSubmitDto {
  @ApiProperty()
  @IsBoolean()
  @Equals(true, { message: "Accept the partner agreement and data protection addendum to submit" })
  acceptTerms!: boolean;

  @ApiProperty({ description: "VET_PARTNER_TERMS_VERSION shown to the signatory." })
  @IsString()
  @MaxLength(40)
  termsVersion!: string;

  @ApiProperty()
  @trim()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  signedByName!: string;

  @ApiProperty({ example: "المالك / Owner" })
  @trim()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  signedByTitle!: string;
}
