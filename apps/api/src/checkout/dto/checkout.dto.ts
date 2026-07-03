import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";

const PROVIDERS = [
  "MADA", "VISA", "MASTERCARD", "APPLE_PAY", "GOOGLE_PAY",
  "STC_PAY", "TABBY", "TAMARA", "WALLET", "GIFT_CARD",
] as const;

export class CheckoutDto {
  @ApiProperty()
  @IsString()
  cartId!: string;

  @ApiPropertyOptional({ description: "Delivery address id" })
  @IsOptional()
  @IsString()
  addressId?: string;

  @ApiProperty({ enum: PROVIDERS, example: "MADA" })
  @IsIn(PROVIDERS)
  provider!: (typeof PROVIDERS)[number];
}
