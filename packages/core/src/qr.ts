/**
 * The Cat ID QR (MRC-PROD-001 T6).
 *
 * The card's QR used to encode `MRCV1:<token>` — an opaque string a phone
 * camera shows as gibberish. It now encodes a URL to the cat's public page, so
 * the Safety job (R040: "bring my cat home") works with any camera, while the
 * vet portal and partner verification keep accepting every older form.
 */

/** 20 chars from the Cat ID alphabet (no 0/O/1/I/L) — see ids.service.ts. */
const QR_TOKEN_RE = /^[23456789A-HJ-NP-Z]{20}$/i;
const LEGACY_PREFIX = "MRCV1:";

export function qrValueFor(siteUrl: string, token: string): string {
  return `${siteUrl.replace(/\/$/, "")}/c/${token}`;
}

/**
 * Pull the token out of whatever a scanner delivered: the public URL, the
 * legacy `MRCV1:` form, or a bare token. Anything else → null.
 */
export function parseQrValue(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (value.toUpperCase().startsWith(LEGACY_PREFIX)) {
    const t = value.slice(LEGACY_PREFIX.length).trim().toUpperCase();
    return QR_TOKEN_RE.test(t) ? t : null;
  }
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      const m = /^\/c\/([^/?#]+)/.exec(url.pathname);
      const t = (m?.[1] ?? url.searchParams.get("t") ?? "").toUpperCase();
      return QR_TOKEN_RE.test(t) ? t : null;
    } catch {
      return null;
    }
  }
  const t = value.replace(/[\s-]/g, "").toUpperCase();
  return QR_TOKEN_RE.test(t) ? t : null;
}
