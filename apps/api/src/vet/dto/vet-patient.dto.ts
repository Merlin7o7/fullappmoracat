/**
 * Patient-lookup and read-side DTOs — MRC-VET-001 §05/§06.
 *
 * The search DTO carries the privacy boundary in its shape: there is ONE box,
 * and the server decides what was typed. A clinic can verify anyone who
 * presents an identifier; it can browse no one who hasn't. See
 * `VetPatientsService.search` for the enforcement.
 */
import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { CLINICAL_ENTRY_TYPES, type ClinicalEntryTypeName } from "./vet-record.dto";

/** Split a `?type=A,B` or repeated `?type=A&type=B` query into a clean array. */
export const csv = (value: unknown): string[] | undefined => {
  if (value === undefined || value === null || value === "") return undefined;
  const raw = Array.isArray(value) ? value : String(value).split(",");
  const out = raw.map((v) => String(v).trim().toUpperCase()).filter(Boolean);
  return out.length ? out : undefined;
};

/**
 * Page-based pagination, capped. Every list endpoint in the clinical half
 * extends this — an unbounded medical read is both a performance and a privacy
 * hazard (a 10k-row dump is an export in disguise).
 */
export class VetPageQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class SearchPatientsQueryDto {
  @ApiPropertyOptional({
    description:
      "One omnibox. Auto-detected as Cat ID (MRC-XXXX-XXXX), QR token, microchip, " +
      "owner phone, owner email, or a name. Name queries are scoped to this clinic's own patients.",
    example: "MRC-D7Y9-X5CW",
  })
  @IsString()
  @MaxLength(120)
  q!: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 25, default: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(25)
  limit?: number;
}

export class TimelineQueryDto extends VetPageQueryDto {
  @ApiPropertyOptional({
    isArray: true,
    enum: CLINICAL_ENTRY_TYPES,
    description: "Filter by entry type — repeat the param or pass a comma-separated list.",
  })
  @IsOptional()
  @Transform(({ value }) => csv(value))
  @IsArray()
  @ArrayMaxSize(CLINICAL_ENTRY_TYPES.length)
  @IsIn(CLINICAL_ENTRY_TYPES, { each: true })
  type?: ClinicalEntryTypeName[];

  @ApiPropertyOptional({ example: "2026-01-01", description: "Inclusive lower bound on occurredAt" })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: "2026-12-31", description: "Inclusive upper bound on occurredAt" })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({
    description:
      "Opaque cursor from the previous page's `pagination.nextCursor`. Preferred over `page` " +
      "for deep timelines — it is stable while new entries are written.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  cursor?: string;
}

export class WeightSeriesQueryDto {
  @ApiPropertyOptional({
    minimum: 1,
    maximum: 120,
    default: 24,
    description: "Window in months for the trend calculation and the returned series.",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(120)
  months?: number;
}

export const PRESCRIPTION_LIST_SCOPES = ["active", "all"] as const;
export type PrescriptionListScope = (typeof PRESCRIPTION_LIST_SCOPES)[number];

export class PrescriptionListQueryDto extends VetPageQueryDto {
  @ApiPropertyOptional({ enum: PRESCRIPTION_LIST_SCOPES, default: "all" })
  @IsOptional()
  @IsIn(PRESCRIPTION_LIST_SCOPES)
  scope?: PrescriptionListScope;
}
