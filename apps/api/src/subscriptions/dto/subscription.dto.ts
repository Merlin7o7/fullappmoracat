import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  Max,
  ValidateNested,
  ArrayMinSize,
} from "class-validator";

const INTERVALS = ["MONTHLY", "BIMONTHLY", "QUARTERLY", "CUSTOM"] as const;

export class SubItemDto {
  @ApiProperty()
  @IsString()
  productId!: string;

  @ApiProperty({ default: 1 })
  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;
}

export class CreateSubscriptionDto {
  @ApiPropertyOptional({ description: "Plan id (optional for fully custom boxes)" })
  @IsOptional()
  @IsString()
  planId?: string;

  @ApiProperty({ enum: INTERVALS, default: "MONTHLY" })
  @IsIn(INTERVALS)
  interval!: (typeof INTERVALS)[number];

  @ApiPropertyOptional({ description: "Required when interval = CUSTOM" })
  @IsOptional()
  @IsInt()
  @Min(7)
  @Max(180)
  intervalDays?: number;

  @ApiProperty({ type: [String], description: "Cat ids this box is for" })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  catIds!: string[];

  @ApiPropertyOptional({ type: [SubItemDto], description: "Additional à-la-carte items" })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubItemDto)
  items?: SubItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  addressId?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isGift?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  giftRecipient?: string;
}

export class PauseDto {
  @ApiPropertyOptional({ description: "Resume automatically after this date (ISO)" })
  @IsOptional()
  @IsString()
  until?: string;
}

/** Payment providers accepted for a membership's first charge (KSA-first order). */
const ACTIVATION_PROVIDERS = [
  "MADA", "APPLE_PAY", "STC_PAY", "VISA", "MASTERCARD", "TABBY", "TAMARA",
] as const;

export type ActivationProvider = (typeof ACTIVATION_PROVIDERS)[number];

/**
 * D3 — "subscribe + initial charge" in one honest step: charge the first month
 * FIRST (checkout.service.ts discipline), then persist subscription + order +
 * invoice atomically. Monthly only — the commitment line the member saw (R021)
 * promises "{price} SAR / month", so the API accepts nothing else here.
 */
export class ActivateSubscriptionDto {
  @ApiProperty({ description: "Plan id (the computed recommendation, or the member's adjustment)" })
  @IsString()
  planId!: string;

  @ApiProperty({ type: [String], description: "Cat ids this membership covers" })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  catIds!: string[];

  @ApiProperty({ description: "Delivery address id (kingdom-wide)" })
  @IsString()
  addressId!: string;

  @ApiProperty({ enum: ACTIVATION_PROVIDERS, example: "MADA" })
  @IsIn(ACTIVATION_PROVIDERS)
  provider!: ActivationProvider;
}
