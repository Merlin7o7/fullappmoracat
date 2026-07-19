import { randomBytes } from "node:crypto";

/**
 * Distinct key material per token class. A counter-mode PIN token and a member
 * access token must never be interchangeable: the counter token is deliberately
 * long-lived (12h), reduced-scope, and unlocked by a 4-digit PIN, so if it were
 * signed with the access secret it would also be a full-privilege bearer token
 * for that staff member's personal account. Separate secrets make that
 * substitution fail at the signature check, before any claim is read.
 */
type JwtSecretName = "JWT_ACCESS_SECRET" | "JWT_REFRESH_SECRET" | "JWT_COUNTER_SECRET";

// Per-process ephemeral secrets for dev/test ONLY — random, never a known
// constant, and consistent within a single process so sign+verify agree.
const ephemeral = new Map<JwtSecretName, string>();

/**
 * Resolve a JWT signing secret with NO known-default fallback (the old
 * `?? "change-me-…"` was a silent auth-bypass footgun). In production the
 * secret MUST come from the environment — `assertProductionConfig()` refuses to
 * boot without it, and this throws as a second line of defence. In dev/test,
 * mint a random per-process secret so the app runs locally without shipping a
 * guessable constant that could ever leak into a real deployment.
 */
export function resolveJwtSecret(name: JwtSecretName): string {
  const val = process.env[name];
  if (val && val.length >= 32) return val;

  if (process.env.NODE_ENV === "production") {
    // Unreachable in a correctly-booted prod (env.validation gates first).
    throw new Error(`${name} is missing or too short in production — refusing to sign tokens.`);
  }

  let s = ephemeral.get(name);
  if (!s) {
    s = randomBytes(48).toString("hex");
    ephemeral.set(name, s);
  }
  return s;
}
