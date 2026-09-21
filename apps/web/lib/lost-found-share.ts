/**
 * The words a lost/found notice travels with — one source for the page's
 * metadata, the link-preview poster and the share buttons, so the WhatsApp
 * message, the unfurled card and the page never disagree.
 *
 * Only ever built from the PUBLIC read of a notice: no phone, no email, no
 * reporter name. The link carries people back to the relay form instead.
 */

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://moracat.co";

export interface ShareableNotice {
  id: string;
  kind: "LOST" | "FOUND";
  status: "ACTIVE" | "REUNITED" | "CLOSED";
  catName: string | null;
  photoUrl: string | null;
  city: { ar: string | null; en: string | null } | null;
  district: string | null;
  description?: string;
  colorNote?: string | null;
  registered?: boolean;
}

/** Anonymous server-side read — exactly what a stranger opening the link sees. */
export async function fetchNoticeForShare(id: string): Promise<ShareableNotice | null> {
  try {
    const res = await fetch(`${BASE}/api/lost-found/posts/${encodeURIComponent(id)}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as ShareableNotice;
  } catch {
    return null;
  }
}

export function noticeUrl(id: string): string {
  return `${SITE}/lost-found/${id}`;
}

/** "حي الملقا، الرياض" — district first, the way a neighbour would say it. */
export function noticePlace(n: Pick<ShareableNotice, "city" | "district">, isAr: boolean): string {
  const city = (isAr ? n.city?.ar : n.city?.en) ?? n.city?.en ?? n.city?.ar ?? "";
  const parts = [n.district?.trim(), city.trim()].filter(Boolean);
  return parts.join(isAr ? "، " : ", ");
}

export function noticeShareText(n: ShareableNotice, isAr: boolean): { title: string; description: string } {
  const place = noticePlace(n, isAr);
  const name = n.catName?.trim();
  let title: string;
  if (n.status === "REUNITED") {
    title = isAr
      ? `${name ?? "القط"} رجع لأهله · مرقط`
      : `${name ?? "This cat"} is home again · Moracat`;
  } else if (n.kind === "LOST") {
    title = isAr
      ? `قط مفقود${name ? `: ${name}` : ""}${place ? ` — ${place}` : ""}`
      : `Lost cat${name ? `: ${name}` : ""}${place ? ` — ${place}` : ""}`;
  } else {
    title = isAr
      ? `قط موجود${place ? ` في ${place}` : ""} — هل تعرف أهله؟`
      : `Found cat${place ? ` in ${place}` : ""} — do you know the owner?`;
  }
  const body = (n.description ?? "").replace(/\s+/g, " ").trim();
  const fallback = isAr
    ? "شفته؟ راسل صاحبه من الصفحة — بدون ما تنكشف بياناتك ولا بياناته."
    : "Seen them? Message the reporter from the page — nobody's details are exposed.";
  const description = body ? (body.length > 155 ? `${body.slice(0, 152)}…` : body) : fallback;
  return { title, description };
}

/** The message pasted into a WhatsApp group: short, local, link last. */
export function noticeShareMessage(n: ShareableNotice, isAr: boolean): string {
  const place = noticePlace(n, isAr);
  const name = n.catName?.trim();
  const url = noticeUrl(n.id);
  if (n.kind === "LOST") {
    return isAr
      ? `قط مفقود${name ? ` اسمه ${name}` : ""}${place ? ` — ${place}` : ""}. لو شفته، راسل صاحبه من هنا (بدون ما تنكشف بياناتك):\n${url}`
      : `Lost cat${name ? ` named ${name}` : ""}${place ? ` — ${place}` : ""}. If you've seen them, message the owner here (your details stay private):\n${url}`;
  }
  return isAr
    ? `لقيت قطاً${place ? ` في ${place}` : ""}. لو تعرف أهله، راسلني من هنا:\n${url}`
    : `I found a cat${place ? ` in ${place}` : ""}. If you know the owner, reach me here:\n${url}`;
}
