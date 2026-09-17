import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsObject, IsOptional, IsString, Matches, MaxLength } from "class-validator";
import { CLIENT_EVENTS, type ClientEvent } from "@moraqat/core";

export class TrackEventDto {
  @ApiProperty({ enum: CLIENT_EVENTS })
  @IsIn(CLIENT_EVENTS as readonly string[])
  name!: ClientEvent;

  /** Random, non-identifying browser id so a funnel can be followed before sign-up. */
  @ApiPropertyOptional({ example: "5f0c7c2e-…" })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9_-]+$/)
  anonId?: string;

  @ApiPropertyOptional({ description: "Coarse dimensions only; PII keys are dropped server-side" })
  @IsOptional()
  @IsObject()
  props?: Record<string, unknown>;
}
