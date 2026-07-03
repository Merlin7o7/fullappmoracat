import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import {
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
} from "class-validator";

export const GENDERS = ["MALE", "FEMALE", "UNKNOWN"] as const;
export const ACTIVITY_LEVELS = ["LOW", "MODERATE", "HIGH"] as const;
export const LIFE_STAGES = ["KITTEN", "ADULT", "SENIOR"] as const;

export type CatGender = (typeof GENDERS)[number];
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];
export type LifeStage = (typeof LIFE_STAGES)[number];

export class CreateCatDto {
  @ApiProperty({ example: "Simba" })
  @IsString()
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
  @IsString({ each: true })
  favoriteFoods?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredBrand?: string[];

  @ApiPropertyOptional({ type: [String], description: "Allergen names" })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergies?: string[];

  @ApiPropertyOptional({ type: [String], description: "Health condition names" })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  healthConditions?: string[];
}

export class UpdateCatDto extends PartialType(CreateCatDto) {}
