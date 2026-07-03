import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from "class-validator";

const ACTIVITY = ["LOW", "MODERATE", "HIGH"] as const;
const STAGE = ["KITTEN", "ADULT", "SENIOR"] as const;
const BODY = ["UNDERWEIGHT", "IDEAL", "OVERWEIGHT"] as const;

export class FeedingCalcDto {
  @ApiPropertyOptional({ example: 4.5 })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(20)
  weightKg?: number;

  @ApiPropertyOptional({ example: 36 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(360)
  ageMonths?: number;

  @ApiPropertyOptional({ enum: STAGE })
  @IsOptional()
  @IsIn(STAGE)
  lifeStage?: (typeof STAGE)[number];

  @ApiProperty({ enum: ACTIVITY })
  @IsIn(ACTIVITY)
  activity!: (typeof ACTIVITY)[number];

  @ApiProperty({ default: true })
  @IsBoolean()
  isIndoor!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  neutered?: boolean;

  @ApiPropertyOptional({ enum: BODY })
  @IsOptional()
  @IsIn(BODY)
  bodyCondition?: (typeof BODY)[number];

  @ApiPropertyOptional({ description: "Share of calories as dry food (0..1)", example: 0.7 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  dryShare?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  cats?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasHealthConditions?: boolean;

  @ApiPropertyOptional({ description: "Breed average weight fallback (kg)" })
  @IsOptional()
  @IsNumber()
  breedAvgWeightKg?: number;
}
