/**
 * #6 Cat ID card export — download the card as a high-resolution PNG, a branded
 * PDF, or a print-ready sheet. Renders the live card DOM node so branding,
 * fonts, gradient and QR are preserved exactly. Client-side, no server round-trip.
 */
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";

// Standard ID-1 card size (credit-card), in mm — keeps print output true-to-life.
const CARD_W_MM = 85.6;
const CARD_H_MM = 54;

async function renderPng(node: HTMLElement): Promise<string> {
  // pixelRatio 3 → crisp on retina + print. cacheBust avoids stale image caching.
  return toPng(node, { pixelRatio: 3, cacheBust: true, skipAutoScale: true });
}

function triggerDownload(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** High-resolution PNG. */
export async function exportCardPng(node: HTMLElement, baseName: string) {
  const dataUrl = await renderPng(node);
  triggerDownload(dataUrl, `${baseName}.png`);
}

/** Branded PDF sized to a physical ID card. */
export async function exportCardPdf(node: HTMLElement, baseName: string) {
  const dataUrl = await renderPng(node);
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: [CARD_W_MM, CARD_H_MM] });
  pdf.addImage(dataUrl, "PNG", 0, 0, CARD_W_MM, CARD_H_MM, undefined, "FAST");
  pdf.save(`${baseName}.pdf`);
}

/** Print-ready: opens the card image in a window and invokes the print dialog. */
export async function printCard(node: HTMLElement, title: string) {
  const dataUrl = await renderPng(node);
  const w = window.open("", "_blank", "width=900,height=650");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><title>${title}</title>
    <style>
      @page { size: 85.6mm 54mm; margin: 0; }
      html,body{margin:0;height:100%;display:grid;place-items:center;background:#fff}
      img{width:85.6mm;height:54mm;object-fit:contain}
      @media print{ body{background:#fff} }
    </style></head>
    <body><img src="${dataUrl}" alt="Cat ID card" onload="setTimeout(()=>{window.print();},150)"/></body></html>`);
  w.document.close();
}
