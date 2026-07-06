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

async function renderPng(node: HTMLElement, targetWidthPx = EXPORT_WIDTH_PX): Promise<string> {
  // Settle the type + photos before capture, or the card reflows mid-render
  // and the output no longer matches the design.
  await document.fonts.ready;
  await Promise.all(
    Array.from(node.querySelectorAll("img")).map((img) => img.decode().catch(() => undefined))
  );
  const pixelRatio = targetWidthPx / Math.max(1, node.offsetWidth);
  return toPng(node, { pixelRatio, skipAutoScale: true });
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
 * "Share my Moracat ID" — capture the 9:16 story frame at exactly 1080×1920.
 * On devices with the Web Share API (phones — where Instagram lives) this opens
 * the native share sheet with the image attached; elsewhere it downloads the
 * PNG in one click. Returns how it concluded so the caller can toast honestly.
 */
export async function shareStoryPng(
  node: HTMLElement,
  baseName: string,
  shareText: string
): Promise<"shared" | "downloaded" | "cancelled"> {
  const dataUrl = await renderPng(node, STORY_WIDTH_PX);
  const filename = `${baseName}-story.png`;

  try {
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], filename, { type: "image/png" });
    if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: shareText });
        return "shared";
      } catch (err) {
        // The member closed the share sheet — that's a decision, not a failure.
        if ((err as Error).name === "AbortError") return "cancelled";
        // Any other share error falls through to a plain download.
      }
    }
  } catch {
    /* blob/File unsupported → download below */
  }

  triggerDownload(dataUrl, filename);
  return "downloaded";
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
