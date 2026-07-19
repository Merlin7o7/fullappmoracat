import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, Length, Matches, MaxLength } from "class-validator";

/** A 4–6 digit counter PIN. Never printed, never set by anyone but its owner. */
export const PIN_RE = /^\d{4,6}$/;

export class SelectOrgDto {
  @ApiProperty({ description: "PartnerOrg id to act inside for subsequent requests." })
  @IsString()
  @MaxLength(40)
  orgId!: string;
}

export class AcceptInviteDto {
  @ApiProperty({ description: "The single-use token from the invitation email." })
  @IsString()
  @Length(20, 200)
  token!: string;
}

export class InvitePreviewDto {
  @ApiProperty({ description: "Invitation token — previewed before sign-in so the invitee knows what they are joining." })
  @IsString()
  @Length(20, 200)
  token!: string;
}

export class CounterUnlockDto {
  @ApiProperty({ description: "CounterDevice id this terminal was registered as." })
  @IsString()
  @MaxLength(40)
  deviceId!: string;

  @ApiProperty({ description: "PartnerStaff id of the person taking the counter." })
  @IsString()
  @MaxLength(40)
  staffId!: string;

  @ApiProperty({ example: "4821", description: "That person's 4–6 digit counter PIN." })
  @IsString()
  @Matches(PIN_RE, { message: "PIN must be 4 to 6 digits" })
  pin!: string;
}

export class CounterLockDto {
  @ApiPropertyOptional({
    description:
      "Counter session token to end. Optional — the x-moracat-counter header is used when omitted.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  token?: string;
}
