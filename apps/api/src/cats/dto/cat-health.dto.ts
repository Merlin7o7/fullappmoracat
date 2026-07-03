import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

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
