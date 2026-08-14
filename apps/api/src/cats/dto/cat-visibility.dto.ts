import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

/**
 * Per-cat community visibility. Cats are published by default at registration
 * (opt-out, decision 2026-08-14) with an anonymous owner posture — this DTO is
 * the ongoing opt-out plus the per-field privacy dials: each field (owner name,
 * city, gallery, age, breed) is revealed only if toggled on.
 */
export class UpdateVisibilityDto {
  @IsOptional() @IsBoolean() isPublic?: boolean;

  @IsOptional() @IsString() @MaxLength(280) bio?: string;

  /**
   * PDPL photo-consent attestation (R106). `true` means the owner just confirmed
   * that any people visible in the cat's photos agreed to their publication.
   * The server stamps `shareConsentAt = now()` itself — a client can only ever
   * say "confirmed", never supply a timestamp.
   */
  @IsOptional() @IsBoolean() consent?: boolean;

  /**
   * The owner's public display name, shown beside shared cats when
   * `showOwnerName` is on. Lives on the User (one handle across all their
   * cats); an empty string clears it. Set by the ceremony's share-time
   * identity fork (D6) and editable from the community panel.
   */
  @IsOptional() @IsString() @MaxLength(60) ownerNickname?: string;

  @IsOptional() @IsBoolean() showOwnerName?: boolean;
  @IsOptional() @IsBoolean() showCity?: boolean;
  @IsOptional() @IsBoolean() showGallery?: boolean;
  @IsOptional() @IsBoolean() showAge?: boolean;
  @IsOptional() @IsBoolean() showBreed?: boolean;
}
