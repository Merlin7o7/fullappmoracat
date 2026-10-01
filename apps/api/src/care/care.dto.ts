import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDateString, IsIn, IsNumber, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateCareTaskDto {
  @ApiProperty({ example: "Deworming" })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @ApiProperty({ example: "2026-11-01" })
  @IsDateString()
  dueAt!: string;

  @ApiPropertyOptional({ enum: ["DEWORM", "FLEA", "DENTAL", "CHECKUP", "CUSTOM"] })
  @IsOptional()
  @IsIn(["DEWORM", "FLEA", "DENTAL", "CHECKUP", "CUSTOM"])
  kind?: string;
}

export class CareStatusDto {
  @ApiProperty({ enum: ["DONE", "SKIPPED", "OPEN"] })
  @IsIn(["DONE", "SKIPPED", "OPEN"])
  status!: "DONE" | "SKIPPED" | "OPEN";
}

export class WeightDto {
  @ApiProperty({ example: 4.3 })
  @Type(() => Number)
  @IsNumber()
  weightKg!: number;

  @ApiPropertyOptional({ example: "2026-10-01" })
  @IsOptional()
  @IsDateString()
  measuredAt?: string;
}

export class UpdateWeightDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  weightKg?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  measuredAt?: string;
}
