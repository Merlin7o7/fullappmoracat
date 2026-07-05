import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

/**
 * Per-cat community visibility. Everything is opt-in and private by default —
 * a cat only appears publicly after the owner explicitly sets isPublic, and each
 * field (owner name, city, gallery, age, breed) is revealed only if toggled on.
 */
export class UpdateVisibilityDto {
  @IsOptional() @IsBoolean() isPublic?: boolean;

  @IsOptional() @IsString() @MaxLength(280) bio?: string;

  @IsOptional() @IsBoolean() showOwnerName?: boolean;
  @IsOptional() @IsBoolean() showCity?: boolean;
  @IsOptional() @IsBoolean() showGallery?: boolean;
  @IsOptional() @IsBoolean() showAge?: boolean;
  @IsOptional() @IsBoolean() showBreed?: boolean;
}
