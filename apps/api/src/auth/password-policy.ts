/**
 * The single source of truth for password rules.
 *
 * Exposed publicly at GET /auth/password/rules and echoed inside every
 * WEAK_PASSWORD error (with the `failed` subset) so the web can render a live
 * checklist instead of a surprise rejection (R112 — every error is a recovery;
 * trust precedes ask).
 */
export const PASSWORD_POLICY = {
  minLength: 8,
  // bcrypt silently truncates beyond 72 bytes — longer passwords would compare
  // equal on their first 72 bytes, so we refuse them outright.
  maxLength: 72,
} as const;

export type PasswordRuleId = "minLength" | "letter" | "number" | "maxLength";

/** The checklist the UI renders (maxLength is a guard, not a checklist item). */
export const PASSWORD_RULES: ReadonlyArray<{ id: PasswordRuleId; value?: number }> = [
  { id: "minLength", value: PASSWORD_POLICY.minLength },
  { id: "letter" },
  { id: "number" },
];

/** Returns the ids of every rule the candidate password fails (empty = strong). */
export function passwordRuleFailures(password: string): PasswordRuleId[] {
  const failed: PasswordRuleId[] = [];
  if (password.length < PASSWORD_POLICY.minLength) failed.push("minLength");
  // Any script counts: an Arabic-keyboard member types Arabic letters and ٠–٩,
  // and "one letter, one number" must tick for them too (R101).
  if (!/\p{L}/u.test(password)) failed.push("letter");
  if (!/\p{Nd}/u.test(password)) failed.push("number");
  // bcrypt's limit is 72 BYTES, and an Arabic letter is two — measure bytes.
  if (Buffer.byteLength(password, "utf8") > PASSWORD_POLICY.maxLength) failed.push("maxLength");
  return failed;
}
