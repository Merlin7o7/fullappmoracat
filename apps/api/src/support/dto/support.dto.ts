import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export const TICKET_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
// Commerce topics + the community-mode member's real topics (Cat ID, community,
// account) — the web keys its picker on commerce mode; the API accepts the union.
export const TICKET_CATEGORIES = [
  "order",
  "delivery",
  "billing",
  "subscription",
  "product",
  "cat_id",
  "community",
  "account",
  "other",
] as const;

export class CreateTicketDto {
  @ApiProperty({ example: "My box arrived with a damaged litter bag" })
  @IsString()
  @MinLength(4)
  @MaxLength(160)
  subject!: string;

  @ApiProperty({ example: "The 10kg litter bag was torn on arrival…" })
  @IsString()
  @MinLength(4)
  @MaxLength(4000)
  message!: string;

  @ApiPropertyOptional({ enum: TICKET_CATEGORIES })
  @IsOptional()
  @IsIn(TICKET_CATEGORIES)
  category?: (typeof TICKET_CATEGORIES)[number];

  @ApiPropertyOptional({ enum: TICKET_PRIORITIES, default: "NORMAL" })
  @IsOptional()
  @IsIn(TICKET_PRIORITIES)
  priority?: (typeof TICKET_PRIORITIES)[number];
}

export class ReplyDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;
}
