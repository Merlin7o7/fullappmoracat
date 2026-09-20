import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { SAUDI_CITY_CODES } from "@moraqat/core";

const Trim = () =>
  Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value));

const ToBool = () =>
  Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null || value === "") return undefined;
    if (typeof value === "boolean") return value;
    if (value === "true" || value === "1") return true;
    if (value === "false" || value === "0") return false;
    return value;
  });

export const LOST_FOUND_KINDS = ["LOST", "FOUND"] as const;
export const LOST_FOUND_STATUSES = ["ACTIVE", "REUNITED", "CLOSED"] as const;
export const CONTACT_PREFS = ["IN_APP", "PHONE", "WHATSAPP", "EMAIL"] as const;

/**
 * Filing a notice.
 *
 * Deliberately short. Someone filling this in has just lost their cat, or is
 * standing in a car park holding one — every optional field is a tax they
 * cannot afford right now (R002). Only the kind, a description and when it
 * happened are required; a registered cat fills the rest in for them.
 */
export class CreateLostFoundDto {
  @ApiProperty({ enum: LOST_FOUND_KINDS })
  @IsIn(LOST_FOUND_KINDS)
  kind!: (typeof LOST_FOUND_KINDS)[number];

  /** A LOST notice about one of my registered cats — prefills everything. */
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  catId?: string;

  @ApiPropertyOptional({ description: "Their name, when there is one" })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(60)
  catName?: string;

  @ApiProperty({ example: "Grey tabby, white chest, very shy…" })
  @Trim()
  @IsString()
  @MinLength(10, { message: "A line or two about them helps people recognise them." })
  @MaxLength(1500)
  description!: string;

  @ApiPropertyOptional({ enum: SAUDI_CITY_CODES })
  @IsOptional()
  @Trim()
  @IsIn(SAUDI_CITY_CODES as readonly string[])
  cityCode?: string;

  @ApiPropertyOptional() @IsOptional() @Trim() @IsString() @MaxLength(80) district?: string;

  @ApiPropertyOptional({ description: "Nearest landmark or street — never a home address" })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(160)
  areaNote?: string;

  @ApiPropertyOptional({ enum: ["MALE", "FEMALE", "UNKNOWN"] })
  @IsOptional()
  @IsIn(["MALE", "FEMALE", "UNKNOWN"])
  gender?: string;

  @ApiPropertyOptional() @IsOptional() @Trim() @IsString() @MaxLength(80) colorNote?: string;
  @ApiPropertyOptional() @IsOptional() @ToBool() @IsBoolean() hasCollar?: boolean;

  @ApiPropertyOptional({ description: "The one identifier that reunites an unregistered cat" })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(40)
  microchipNo?: string;

  @ApiPropertyOptional() @IsOptional() @Trim() @IsString() @MaxLength(500) photoUrl?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsString({ each: true })
  extraPhotos?: string[];

  @ApiProperty({ description: "When they went missing / when you found them" })
  @IsDateString()
  happenedAt!: string;

  @ApiPropertyOptional({ enum: CONTACT_PREFS })
  @IsOptional()
  @IsIn(CONTACT_PREFS)
  contactPref?: (typeof CONTACT_PREFS)[number];

  @ApiPropertyOptional() @IsOptional() @Trim() @IsString() @MaxLength(20) contactPhone?: string;
}

/** Everything a reporter may change afterwards (the kind never changes). */
export class UpdateLostFoundDto {
  @IsOptional() @Trim() @IsString() @MaxLength(60) catName?: string;
  @IsOptional() @Trim() @IsString() @MinLength(10) @MaxLength(1500) description?: string;
  @IsOptional() @Trim() @IsIn(SAUDI_CITY_CODES as readonly string[]) cityCode?: string;
  @IsOptional() @Trim() @IsString() @MaxLength(80) district?: string;
  @IsOptional() @Trim() @IsString() @MaxLength(160) areaNote?: string;
  @IsOptional() @IsIn(["MALE", "FEMALE", "UNKNOWN"]) gender?: string;
  @IsOptional() @Trim() @IsString() @MaxLength(80) colorNote?: string;
  @IsOptional() @ToBool() @IsBoolean() hasCollar?: boolean;
  @IsOptional() @Trim() @IsString() @MaxLength(40) microchipNo?: string;
  @IsOptional() @Trim() @IsString() @MaxLength(500) photoUrl?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(6) @IsString({ each: true }) extraPhotos?: string[];
  @IsOptional() @IsDateString() happenedAt?: string;
  @IsOptional() @IsIn(CONTACT_PREFS) contactPref?: (typeof CONTACT_PREFS)[number];
  @IsOptional() @Trim() @IsString() @MaxLength(20) contactPhone?: string;
}

export class LostFoundQueryDto {
  @IsOptional() @IsIn(LOST_FOUND_KINDS) kind?: string;
  @IsOptional() @IsIn(LOST_FOUND_STATUSES) status?: string;
  @IsOptional() @Trim() @IsString() @MaxLength(40) cityCode?: string;
  @IsOptional() @IsIn(["MALE", "FEMALE", "UNKNOWN"]) gender?: string;
  /** Matches a name, a description or — exactly — a microchip number. */
  @IsOptional() @Trim() @IsString() @MaxLength(60) search?: string;
  @IsOptional() @IsString() page?: string;
}

/** Changing a notice's standing. REUNITED is the ending we hope for. */
export class SetLostFoundStatusDto {
  @ApiProperty({ enum: LOST_FOUND_STATUSES })
  @IsIn(LOST_FOUND_STATUSES)
  status!: (typeof LOST_FOUND_STATUSES)[number];
}

/**
 * "I think I've seen this cat."
 *
 * Open to signed-out visitors on purpose: the neighbour holding the cat should
 * not have to make an account first. The reunion outranks the funnel.
 */
export class LostFoundMessageDto {
  @ApiProperty({ example: "I saw a cat like this near the mosque on King Fahd…" })
  @Trim()
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  message!: string;

  @ApiPropertyOptional() @IsOptional() @Trim() @IsString() @MaxLength(60) senderName?: string;

  @ApiPropertyOptional({ description: "So the owner can call back — optional" })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(20)
  senderPhone?: string;
}
