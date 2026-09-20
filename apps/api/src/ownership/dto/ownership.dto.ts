import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

const Trim = () =>
  Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value));

export const TRANSFER_REASONS = ["ADOPTION", "GIFT", "REHOME", "OTHER"] as const;

/**
 * Starting a hand-over.
 *
 * `confirmCatName` is the deliberate friction (R116 — confirm destructive
 * actions without trapping). Handing over a Cat ID is the single most
 * irreversible thing a member can do in Moracat, so the form asks them to type
 * the cat's name; the server checks it too, because a confirmation that only
 * the browser enforces is not a confirmation.
 */
export class StartTransferDto {
  @ApiProperty({ example: "adopter@example.com" })
  @Trim()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value
  )
  @IsEmail({}, { message: "Enter the new owner's email address" })
  @MaxLength(180)
  toEmail!: string;

  @ApiProperty({ description: "The cat's name, typed back by the owner" })
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  confirmCatName!: string;

  @ApiPropertyOptional({ enum: TRANSFER_REASONS })
  @IsOptional()
  @IsIn(TRANSFER_REASONS)
  reason?: (typeof TRANSFER_REASONS)[number];

  /** The handover letter — anything the next person should know. */
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class TransferTokenDto {
  @ApiProperty()
  @Trim()
  @IsString()
  @MinLength(10)
  @MaxLength(200)
  token!: string;
}
