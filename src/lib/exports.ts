import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import { getPartner } from "./partners";
import type { Group, Label } from "./types";

const docCache = new Map<string, Promise<PDFDocument>>();

export function clearDocCache(): void {
  docCache.clear();
}

function loadDoc(fileKey: string, store: Map<string, ArrayBuffer>): Promise<PDFDocument> {
  let p = docCache.get(fileKey);
  if (!p) {
    p = (async () => {
      const bytes = store.get(fileKey);
      if (!bytes) throw new Error("Original file data is missing for this label.");
      return PDFDocument.load(bytes, { ignoreEncryption: true });
    })();
    docCache.set(fileKey, p);
  }
  return p;
}

/** pdf-lib returns Uint8Array<ArrayBufferLike>; re-wrap for Blob compatibility. */
function pdfBlob(u8: Uint8Array): Blob {
  return new Blob([new Uint8Array(u8)], { type: "application/pdf" });
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function labelFileName(label: Label, index: number): string {
  const p = getPartner(label.partnerId);
  const ident = label.awb || label.orderId || `page-${label.pageIndex + 1}`;
  return `${p.code}_${ident}_${index + 1}.pdf`.replace(/[^\w.\-]+/g, "_");
}

/** Extract this label's page from its source PDF as a standalone file. */
export async function singleLabelPdf(
  label: Label,
  store: Map<string, ArrayBuffer>
): Promise<Blob> {
  const src = await loadDoc(label.fileKey, store);
  const out = await PDFDocument.create();
  const [page] = await out.copyPages(src, [label.pageIndex]);
  out.addPage(page);
  return pdfBlob(await out.save());
}

/** Merge every label of a set into one print-ready multi-page PDF. */
export async function mergedPdf(
  labels: Label[],
  store: Map<string, ArrayBuffer>
): Promise<Blob> {
  if (!labels.length) throw new Error("Nothing to bundle yet.");
  const out = await PDFDocument.create();
  for (const label of labels) {
    const src = await loadDoc(label.fileKey, store);
    const [page] = await out.copyPages(src, [label.pageIndex]);
    out.addPage(page);
  }
  return pdfBlob(await out.save());
}

/** ZIP of one partner group: a folder containing each label as its own PDF. */
export async function groupZip(
  group: Group,
  store: Map<string, ArrayBuffer>
): Promise<Blob> {
  const zip = new JSZip();
  const folder = zip.folder(`${slug(group.partner.name)}_${group.labels.length}_labels`)!;
  for (let i = 0; i < group.labels.length; i++) {
    const bytes = await singleLabelPdf(group.labels[i], store);
    folder.file(labelFileName(group.labels[i], i), bytes);
  }
  return zip.generateAsync({ type: "blob", compression: "STORE" });
}

/** ZIP of the whole batch: one folder per partner, each holding its labels. */
export async function allZip(
  groups: Group[],
  store: Map<string, ArrayBuffer>,
  onProgress?: (pct: number) => void
): Promise<Blob> {
  const zip = new JSZip();
  for (const g of groups) {
    const folder = zip.folder(`${slug(g.partner.name)}_${g.labels.length}_labels`)!;
    for (let i = 0; i < g.labels.length; i++) {
      const bytes = await singleLabelPdf(g.labels[i], store);
      folder.file(labelFileName(g.labels[i], i), bytes);
    }
  }
  return zip.generateAsync(
    { type: "blob", compression: "STORE" },
    (meta) => onProgress?.(Math.round(meta.percent))
  );
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Print a PDF blob via a hidden iframe; falls back to opening a new tab. */
export async function printBlob(blob: Blob): Promise<void> {
  const url = URL.createObjectURL(blob);
  try {
    await new Promise<void>((resolve, reject) => {
      const frame = document.createElement("iframe");
      frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
      frame.src = url;
      const fail = setTimeout(() => {
        cleanup();
        reject(new Error("print-timeout"));
      }, 20_000);
      function cleanup() {
        clearTimeout(fail);
      }
      frame.onload = () => {
        try {
          const win = frame.contentWindow;
          if (!win) throw new Error("no-window");
          win.focus();
          win.print();
          cleanup();
          resolve();
          setTimeout(() => frame.remove(), 120_000);
        } catch (e) {
          cleanup();
          frame.remove();
          reject(e);
        }
      };
      document.body.appendChild(frame);
    });
  } catch {
    window.open(url, "_blank", "noopener");
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 180_000);
  }
}
