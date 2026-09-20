import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { SAUDI_CITY_CODES } from "@moraqat/core";

const Trim = () =>
  Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value));

/** Checkbox-ish values arrive as strings from multipart/query — coerce honestly. */
const ToBool = () =>
  Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null || value === "") return undefined;
    if (typeof value === "boolean") return value;
    if (value === "true" || value === "1") return true;
    if (value === "false" || value === "0") return false;
    return value;
  });

export const CONTACT_PREFS = ["IN_APP", "PHONE", "WHATSAPP", "EMAIL"] as const;
export const ADOPTION_SORTS = ["recent", "city"] as const;

/**
 * Listing a cat for adoption.
 *
 * `story` is required and generously sized because it is the whole page: the
 * difference between "a cat" and "this cat" is the owner's own words (P09).
 * A rehoming fee is allowed but defaults to zero and is never encouraged —
 * Moracat takes no part in it and says so on the page (R006).
 */
export class CreateListingDto {
  @ApiProperty({ description: "The cat being rehomed — must belong to the caller" })
  @Trim()
  @IsString()
  catId!: string;

  @ApiProperty({ example: "Simba is four, gentle with everyone…" })
  @Trim()
  @IsString()
  @MinLength(20, { message: "Tell adopters a little about them — twenty characters at least." })
  @MaxLength(2000)
  story!: string;

  @ApiPropertyOptional({ description: "Why they're being rehomed — shown plainly" })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(300)
  reason?: string;

  @ApiPropertyOptional({ enum: SAUDI_CITY_CODES })
  @IsOptional()
  @Trim()
  @IsIn(SAUDI_CITY_CODES as readonly string[])
  cityCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(80)
  district?: string;

  @ApiPropertyOptional({ description: "Rehoming fee in SAR — 0 means free to a good home" })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value === "" || value == null ? undefined : Number(value)))
  @IsInt()
  @Min(0)
  @Max(5000)
  feeSar?: number;

  @ApiPropertyOptional() @IsOptional() @ToBool() @IsBoolean() goodWithKids?: boolean;
  @ApiPropertyOptional() @IsOptional() @ToBool() @IsBoolean() goodWithCats?: boolean;
  @ApiPropertyOptional() @IsOptional() @ToBool() @IsBoolean() goodWithDogs?: boolean;

  @ApiPropertyOptional({ enum: CONTACT_PREFS })
  @IsOptional()
  @IsIn(CONTACT_PREFS)
  contactPref?: (typeof CONTACT_PREFS)[number];

  /** Only kept when contactPref is PHONE/WHATSAPP, and only shared on accept. */
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(20)
  contactPhone?: string;
}

/**
 * Everything editable after publishing.
 *
 * `catId` is deliberately absent: re-pointing a listing at a different cat
 * would let a page's enquiries and history describe an animal it never was.
 */
export class UpdateListingDto {
  @IsOptional() @Trim() @IsString() @MinLength(20) @MaxLength(2000) story?: string;
  @IsOptional() @Trim() @IsString() @MaxLength(300) reason?: string;
  @IsOptional() @Trim() @IsIn(SAUDI_CITY_CODES as readonly string[]) cityCode?: string;
  @IsOptional() @Trim() @IsString() @MaxLength(80) district?: string;
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value === "" || value == null ? undefined : Number(value)))
  @IsInt()
  @Min(0)
  @Max(5000)
  feeSar?: number;
  @IsOptional() @ToBool() @IsBoolean() goodWithKids?: boolean;
  @IsOptional() @ToBool() @IsBoolean() goodWithCats?: boolean;
  @IsOptional() @ToBool() @IsBoolean() goodWithDogs?: boolean;
  @IsOptional() @IsIn(CONTACT_PREFS) contactPref?: (typeof CONTACT_PREFS)[number];
  @IsOptional() @Trim() @IsString() @MaxLength(20) contactPhone?: string;
}

export class AdoptionQueryDto {
  @IsOptional() @Trim() @IsString() @MaxLength(40) cityCode?: string;
  @IsOptional() @IsIn(["MALE", "FEMALE", "UNKNOWN"]) gender?: string;
  @IsOptional() @IsIn(["KITTEN", "ADULT", "SENIOR"]) stage?: string;
  @IsOptional() @IsIn(ADOPTION_SORTS) sort?: string;
  @IsOptional() @Trim() @IsString() @MaxLength(60) search?: string;
  @IsOptional() @IsString() page?: string;
  /** Only listings with no rehoming fee. */
  @IsOptional() @ToBool() @IsBoolean() freeOnly?: boolean;
}

export class CreateAdoptionRequestDto {
  @ApiProperty({ example: "We have a quiet flat and no other pets…" })
  @Trim()
  @IsString()
  @MinLength(20, { message: "Tell them a little about the home you're offering." })
  @MaxLength(1200)
  message!: string;
}

export class DecideAdoptionRequestDto {
  @ApiPropertyOptional({ description: "A word back to them — optional, never required" })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  note?: string;
}

/**
 * The hand-over confirmation. Same friction as a direct transfer: the owner
 * types the cat's name back before a Cat ID leaves their account (R116).
 */
export class HandoverDto {
  @ApiProperty({ description: "The cat's name, typed back by the owner" })
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  confirmCatName!: string;
}
