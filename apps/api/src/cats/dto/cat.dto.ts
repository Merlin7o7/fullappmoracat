import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

/** Trim incoming strings so " " can never masquerade as a real value. */
const Trim = () =>
  Transform(({ value }) => (typeof value === "string" ? value.trim() : value));

export const GENDERS = ["MALE", "FEMALE", "UNKNOWN"] as const;
export const ACTIVITY_LEVELS = ["LOW", "MODERATE", "HIGH"] as const;
export const LIFE_STAGES = ["KITTEN", "ADULT", "SENIOR"] as const;
export const CAT_STATUSES = ["ACTIVE", "ARCHIVED", "DECEASED"] as const;
export const VACCINATION_STATUSES = ["UP_TO_DATE", "PARTIAL", "NONE", "UNKNOWN"] as const;

export type CatGender = (typeof GENDERS)[number];
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];
export type LifeStage = (typeof LIFE_STAGES)[number];
export type CatStatus = (typeof CAT_STATUSES)[number];

export class CreateCatDto {
  @ApiProperty({ example: "Simba" })
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  photoUrl?: string;

  @ApiPropertyOptional({ description: "Breed id" })
  @IsOptional()
  @IsString()
  breedId?: string;

  @ApiPropertyOptional({ enum: GENDERS })
  @IsOptional()
  @IsIn(GENDERS)
  gender?: CatGender;

  @ApiPropertyOptional({ example: "2022-05-01" })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional({ example: 4.5 })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(20)
  weightKg?: number;

  @ApiPropertyOptional({ enum: LIFE_STAGES })
  @IsOptional()
  @IsIn(LIFE_STAGES)
  lifeStage?: LifeStage;

  @ApiPropertyOptional({ enum: ACTIVITY_LEVELS, default: "MODERATE" })
  @IsOptional()
  @IsIn(ACTIVITY_LEVELS)
  activityLevel?: ActivityLevel;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isIndoor?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  diet?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vetNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  microchipNo?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  favoriteFoods?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  preferredBrand?: string[];

  @ApiPropertyOptional({ type: [String], description: "Allergen names" })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  allergies?: string[];

  @ApiPropertyOptional({ type: [String], description: "Health condition names" })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  healthConditions?: string[];

  // ── Full-registration profile (#3) ──
  @ApiPropertyOptional({ example: "Ginger tabby" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  coatColor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isNeutered?: boolean;

  @ApiPropertyOptional({ enum: VACCINATION_STATUSES })
  @IsOptional()
  @IsIn(VACCINATION_STATUSES)
  vaccinationStatus?: (typeof VACCINATION_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(280)
  currentMedications?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  emergencyNotes?: string;
}

export class UpdateCatDto extends PartialType(CreateCatDto) {}

export class ListCatsQueryDto {
  @ApiPropertyOptional({ description: "Search by name or Cat ID number" })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  search?: string;

  @ApiPropertyOptional({ enum: CAT_STATUSES, description: "Filter by lifecycle status" })
  @IsOptional()
  @IsIn(CAT_STATUSES)
  status?: CatStatus;
}

export class MarkDeceasedDto {
  @ApiPropertyOptional({ example: "2026-06-30" })
  @IsOptional()
  @IsDateString()
  deceasedAt?: string;
}
