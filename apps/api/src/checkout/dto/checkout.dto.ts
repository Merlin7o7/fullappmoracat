import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

/**
 * Rails a customer may actually choose at checkout.
 *
 * Deliberately NOT the full `PaymentProvider` enum: WALLET and GIFT_CARD have no
 * internal settlement engine (no Wallet debit path, no GiftCardTransaction
 * ledger), so accepting them here would let a request reach a provider that
 * cannot move money. The factory refuses them too — this is the outer of two
 * gates, so a bad value is a 400 at the edge rather than a 503 mid-checkout.
 */
export const CHECKOUT_PROVIDERS = [
  "MADA", "VISA", "MASTERCARD", "APPLE_PAY", "GOOGLE_PAY",
  "STC_PAY", "TABBY", "TAMARA",
] as const;

export type CheckoutProvider = (typeof CHECKOUT_PROVIDERS)[number];

export class CheckoutDto {
  @ApiProperty()
  @IsString()
  cartId!: string;

  @ApiPropertyOptional({
    description:
      "Guest cart capability token. Required only when checking out a cart that was built anonymously and has not yet been claimed by this account.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  cartToken?: string;

  @ApiPropertyOptional({ description: "Delivery address id" })
  @IsOptional()
  @IsString()
  addressId?: string;

  @ApiProperty({ enum: CHECKOUT_PROVIDERS, example: "MADA" })
  @IsIn(CHECKOUT_PROVIDERS)
  provider!: CheckoutProvider;
}
