import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, Matches, MaxLength } from "class-validator";

export class AcceptClaimDto {
  /** "This is my existing cat" — merge the clinic-created record into it. */
  @ApiPropertyOptional({ description: "An existing cat of yours to merge the clinic record into" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  mergeIntoCatId?: string;

  /** Proof of the invited phone when the account's number differs. */
  @ApiPropertyOptional({ example: "123456" })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4,6}$/, { message: "Code must be 4–6 digits" })
  phoneOtpCode?: string;
}
