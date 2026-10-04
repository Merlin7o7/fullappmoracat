/**
 * Share attribution URLs — pure helpers, safe in server components.
 * Hooks live in ./share-link (client). See that file for the why.
 *
 *   src = poster · story · qr · card · moment
 */
export type ShareSrc = "poster" | "story" | "qr" | "card" | "moment";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://moracat.co").replace(/\/$/, "");

/**
 * The landing URL for a share. `slug` is the cat's public slug when it has
 * one; the landing page re-checks visibility server-side, so a cat made
 * private later simply falls back to the generic invitation.
 */
export function shareLandingUrl({ slug, code, src }: { slug?: string | null; code?: string | null; src: ShareSrc }): string {
  const q = new URLSearchParams();
  if (code) q.set("ref", code);
  q.set("src", src);
  const path = slug ? `/i/${encodeURIComponent(slug)}` : "/i";
  return `${SITE_URL}${path}?${q.toString()}`;
}

/** /register carrying a validated ref + src (the register page's ?ref= capture reads it). */
export function registerHref(ref?: string | null, src?: string | null): string {
  const q = new URLSearchParams();
  if (ref && /^[A-Za-z0-9-]{3,40}$/.test(ref)) q.set("ref", ref);
  if (src && /^[a-z0-9-]{1,24}$/i.test(src)) q.set("src", src);
  const s = q.toString();
  return s ? `/register?${s}` : "/register";
}
