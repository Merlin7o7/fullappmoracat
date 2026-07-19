import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { SOURCE_CODE_MAX } from "@moraqat/core";

const PLAN_INTERESTS = [
  "ESSENTIAL",
  "PREMIUM",
  "COMPLETE_CARE",
  "MULTI_CAT",
  "unsure",
] as const;

export class JoinWaitlistDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  catName?: string;

  @IsOptional()
  @IsIn(PLAN_INTERESTS)
  planInterest?: (typeof PLAN_INTERESTS)[number];

  /**
   * Where the join came from — a page name, or a `?src=` acquisition code such
   * as `stand-004` (MRC-GTM-001 §2). Widened to SOURCE_CODE_MAX so stand codes
   * and page labels share one field.
   */
  @IsOptional()
  @IsString()
  @MaxLength(SOURCE_CODE_MAX)
  source?: string;

  /**
   * Explicit permission to email this person when memberships open (PDPL,
   * R106). Optional on the wire so existing authenticated surfaces keep
   * working, but **only a literal `true` results in a stored consent stamp**,
   * and only a stored consent stamp allows us to send anything. Absent consent
   * we still record the interest — we simply stay silent until we have it.
   */
  @IsOptional()
  @IsBoolean()
  consent?: boolean;

  @IsOptional()
  @IsIn(["ar", "en"])
  locale?: "ar" | "en";
}
