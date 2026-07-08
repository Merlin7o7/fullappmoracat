import { SetMetadata } from "@nestjs/common";

export const REQUIRE_EMAIL_VERIFIED_KEY = "requireEmailVerified";

/**
 * Marks a controller or handler as requiring a verified email. Enforced by
 * EmailVerifiedGuard (global). Use on UGC / public-content write surfaces so an
 * unverified throwaway account can't post to the community (R006 trust).
 */
export const RequireEmailVerified = () => SetMetadata(REQUIRE_EMAIL_VERIFIED_KEY, true);
