/**
 * #6 Cat ID card export — download the card as a high-resolution PNG, a branded
 * PDF, or a print-ready sheet. Captures a dedicated fixed-width card node (the
 * card is composed in container-query units and locked to the ID-1 ratio), so
 * the exported artwork matches the designed card exactly at every screen size —
 * nothing cropped, nothing distorted (R034).
 */
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";

// Standard ID-1 card size (credit-card), in mm — keeps print output true-to-life.
const CARD_W_MM = 85.6;
const CARD_H_MM = 54;
// Target raster width ≈ 508 DPI at physical card size — crisp for print and retina.
const EXPORT_WIDTH_PX = 1712;
// Instagram Stories are 1080×1920 — the story node is 540 CSS px wide (ratio 2).
const STORY_WIDTH_PX = 1080;

// iOS/macOS Safari rasterizes the capture's foreignObject SVG lazily: the first
// draw(s) can come back partially painted — half-black output. Detect WebKit and
// warm the pipeline up, keeping only the last (fully painted) render.
const IS_WEBKIT =
  typeof navigator !== "undefined" && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

async function renderPng(node: HTMLElement, targetWidthPx = EXPORT_WIDTH_PX): Promise<string> {
  // Settle the type + photos before capture, or the card reflows mid-render
  // and the output no longer matches the design.
  await document.fonts.ready;
  await Promise.all(
    Array.from(node.querySelectorAll("img")).map((img) => img.decode().catch(() => undefined))
  );
  const pixelRatio = targetWidthPx / Math.max(1, node.offsetWidth);
  const opts = { pixelRatio, skipAutoScale: true };
  if (IS_WEBKIT) {
    await toPng(node, opts);
    await toPng(node, opts);
  }
  return toPng(node, opts);
}

/**
 * Remote cat photos (R2/Google) are re-routed through the same-origin Next
 * image proxy so the export capture can read them — a direct cross-origin
 * <img> would fail the fetch inside html-to-image and drop the photo.
 */
export function exportSafeSrc(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url, window.location.origin);
    if (u.origin === window.location.origin) return url;
    return `/_next/image?url=${encodeURIComponent(u.toString())}&w=828&q=85`;
  } catch {
    return url;
  }
}

function triggerDownload(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** High-resolution PNG (transparent outside the rounded corners). */
export async function exportCardPng(node: HTMLElement, baseName: string) {
  const dataUrl = await renderPng(node);
  triggerDownload(dataUrl, `${baseName}.png`);
}

/** Branded PDF sized exactly to a physical ID-1 card. */
export async function exportCardPdf(node: HTMLElement, baseName: string) {
  const dataUrl = await renderPng(node);
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: [CARD_W_MM, CARD_H_MM] });
  pdf.addImage(dataUrl, "PNG", 0, 0, CARD_W_MM, CARD_H_MM, undefined, "FAST");
  pdf.save(`${baseName}.pdf`);
}

/**
 * Decode a data: URL in memory. NOT `fetch(dataUrl)`: the site's CSP
 * (connect-src) forbids fetching data: URLs, which silently broke every
 * share — the File was never built, so phones never saw the share sheet.
 */
function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64 = ""] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(head ?? "")?.[1] ?? "image/png";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * Render a 9:16 story frame to a PNG File at exactly 1080×1920. Rendering is
 * slow on iPhones (WebKit needs warm-up passes), which is why sharing is split
 * from rendering: Safari only lets `navigator.share` / a download run inside a
 * fresh tap, and a multi-second render in between spends that tap. Callers
 * render first (ahead of time, or on the first tap) and hand the File to the
 * share sheet on a tap of its own — see components/story-share.tsx.
 */
export async function renderStoryFile(node: HTMLElement, baseName: string): Promise<File> {
  const dataUrl = await renderPng(node, STORY_WIDTH_PX);
  return new File([dataUrlToBlob(dataUrl)], `${baseName}-story.png`, { type: "image/png" });
}

/** The card itself as a PNG File (for the iPhone preview sheet). */
export async function renderCardFile(node: HTMLElement, baseName: string): Promise<File> {
  const dataUrl = await renderPng(node);
  return new File([dataUrlToBlob(dataUrl)], `${baseName}.png`, { type: "image/png" });
}

/** True on iPhone / iPad (iPadOS reports itself as a Mac with touch). */
export const IS_IOS =
  typeof navigator !== "undefined" &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

export function canShareFile(file: File): boolean {
  try {
    return typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

/** Download a File — must run inside a tap on Safari. */
export function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  triggerDownload(url, file.name);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Print-ready: opens the card image in a window and invokes the print dialog. */
export async function printCard(node: HTMLElement, title: string) {
  const dataUrl = await renderPng(node);
  const w = window.open("", "_blank", "width=900,height=650");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><title>${title}</title>
    <style>
      @page { size: ${CARD_W_MM}mm ${CARD_H_MM}mm; margin: 0; }
      html,body{margin:0;height:100%;display:grid;place-items:center;background:#fff}
      img{width:${CARD_W_MM}mm;height:${CARD_H_MM}mm;object-fit:contain}
      @media print{ body{background:#fff} }
    </style></head>
    <body><img src="${dataUrl}" alt="Cat ID card" onload="setTimeout(()=>{window.print();},150)"/></body></html>`);
  w.document.close();
}
