import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { SAUDI_CITY_CODES, SOURCE_CODE_MAX } from "@moraqat/core";

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

  /**
   * Community visibility is opt-out (decision 2026-08-14): absent or true means
   * the cat is published to the community at creation; false is the wizard's
   * opt-out toggle. The manage panel remains the ongoing switch.
   */
  @ApiPropertyOptional({ description: "Publish to the community (default true; false = opt out)" })
  @IsOptional()
  @IsBoolean()
  sharePublicly?: boolean;

  /**
   * PDPL people-in-photo attestation (R106), sent only when a photo was uploaded
   * with sharing on. The client only ever says "confirmed" — the server mints
   * `shareConsentAt`, and only alongside an actual `photoUrl`.
   */
  @ApiPropertyOptional({ description: "Owner confirmed anyone visible in the photo agreed to share it" })
  @IsOptional()
  @IsBoolean()
  shareConsent?: boolean;

  @ApiPropertyOptional({ description: "Breed id" })
  @IsOptional()
  @IsString()
  breedId?: string;

  /**
   * Optional again since the 2026-10-04 signup (R016 — under six inputs): the
   * sign-up asks only the cat's name; sex is invited later on the profile,
   * framed as care. Absent → the column default UNKNOWN. "UNKNOWN" remains a
   * legitimate answer for a rescue whose sex genuinely isn't known.
   */
  @ApiPropertyOptional({ enum: GENDERS, default: "UNKNOWN" })
  @IsOptional()
  @IsIn(GENDERS)
  gender?: CatGender;

  /**
   * Optional since the 2026-10-04 signup. Collected later as an approximate
   * age and converted to a date. Every consumer (care schedule, feeding,
   * card, timeline, certificates) treats a missing birth date as "unknown"
   * — never as a newborn (audited 2026-10-04).
   */
  @ApiPropertyOptional({ example: "2022-05-01" })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  /**
   * The owner deliberately confirmed a second cat with a name they already
   * use («نعم، أصدر هوية ثانية»). Without it, a same-name create within a
   * short window returns the cat already issued instead of a twin — a
   * double-submitted sign-up must never mint two Cat IDs.
   */
  @ApiPropertyOptional({ description: "Skip the short-window same-name dedupe" })
  @IsOptional()
  @IsBoolean()
  allowDuplicateName?: boolean;

  /**
   * Where the cat lives — a census city code (SAUDI_CITIES in packages/core).
   *
   * Required because the founding class printed on the Cat ID card is built
   * from it. Before this existed the card claimed «دفعة الرياض 2026» for
   * everyone, including owners in Jeddah and Makkah — a false statement on an
   * identity document (R040). Validated against the list so a typo can never
   * become a city.
   */
  // Optional since W8 («4 inputs before the ceremony»): the city is asked in
  // the "complete the file" step after the ID exists. A cat without a city
  // gets a founding class with no city in it — never a guessed one (R040).
  @ApiPropertyOptional({ example: "jeddah", enum: SAUDI_CITY_CODES })
  @IsOptional()
  @Trim()
  @IsIn(SAUDI_CITY_CODES)
  cityCode?: string;

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

  /**
   * The character & keepsake layer (personality, favourites, playful "fun"
   * answers, and card personalisation). Owner-authored and free-form by design —
   * accepted as an object here and strictly sanitised in CatsService
   * (`sanitizeProfile`): key/value whitelisting, length + count caps, and a hard
   * serialized-size ceiling. Never trusted raw into the DB.
   */
  @ApiPropertyOptional({
    description:
      "Character & keepsake layer: { personality, favorites, fun, personalization }. Sanitised server-side.",
  })
  @IsOptional()
  @IsObject()
  profile?: Record<string, unknown>;

  /**
   * Acquisition source — the `?src=` code the registration arrived with, e.g.
   * `stand-004` for the Al-Olaya counter stand (MRC-GTM-001 §2).
   *
   * Write-once at creation: `catScalarData` (the update whitelist) deliberately
   * omits it, so a later PATCH cannot rewrite where a member came from. Yield
   * per stand decides the Year-1 channel strategy and cannot be backfilled.
   */
  @ApiPropertyOptional({ example: "stand-004" })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(SOURCE_CODE_MAX)
  sourceCode?: string;
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
