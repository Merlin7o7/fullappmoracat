import { IsEmail, IsIn, IsOptional, IsString, MaxLength } from "class-validator";

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

  @IsOptional()
  @IsString()
  @MaxLength(60)
  source?: string;

  @IsOptional()
  @IsIn(["ar", "en"])
  locale?: "ar" | "en";
}
