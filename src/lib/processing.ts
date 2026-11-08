import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
// Imported as a URL so the single-file build can inline it; we convert it to a
// blob URL at runtime because workers cannot be spawned from data: URIs.
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { detectPartner, extractAwb, extractOrderId, UNKNOWN_ID } from "./partners";
import type { JobInfo, Label } from "./types";

let workerReady: Promise<void> | null = null;

/** Prepare the pdf.js worker (idempotent, safe to call before every batch). */
export function initPdfWorker(): Promise<void> {
  if (!workerReady) {
    workerReady = (async () => {
      let src = workerUrl;
      if (src.startsWith("data:") || src.startsWith("blob:")) {
        const blob = await (await fetch(src)).blob();
        src = URL.createObjectURL(blob);
      }
      GlobalWorkerOptions.workerSrc = src;
    })();
  }
  return workerReady;
}

/* ---------------- OCR (lazy-loaded, pooled, pre-warmed) ---------------- */

interface OcrHandle {
  recognize: (img: HTMLCanvasElement) => Promise<string>;
}

/**
 * Up to two Tesseract workers so scanned pages are recognized in parallel
 * instead of queueing behind a single engine. Workers are reused for every
 * page of the session, so the engine boots at most twice, ever.
 */
const OCR_POOL_MAX = 2;
const ocrPool: OcrHandle[] = [];
const ocrCreating: Promise<OcrHandle>[] = [];
let ocrRR = 0;

async function spawnOcr(): Promise<OcrHandle> {
  const T = await import("tesseract.js");
  const worker = await T.createWorker("eng");
  return {
    recognize: async (img: HTMLCanvasElement) => {
      const { data } = await worker.recognize(img);
      return data?.text ?? "";
    },
  };
}

function getOcr(): Promise<OcrHandle> {
  if (ocrPool.length > 0) {
    ocrRR = (ocrRR + 1) % ocrPool.length;
    return Promise.resolve(ocrPool[ocrRR]);
  }
  if (ocrCreating.length < OCR_POOL_MAX) {
    const p = spawnOcr()
      .then((h) => {
        ocrPool.push(h);
        return h;
      })
      .catch((e) => {
        // free the failed slot so the next scanned page retries
        const idx = ocrCreating.indexOf(p);
        if (idx >= 0) ocrCreating.splice(idx, 1);
        throw e;
      });
    ocrCreating.push(p);
    return p;
  }
  ocrRR = (ocrRR + 1) % ocrCreating.length;
  return ocrCreating[ocrRR];
}

/** Start downloading/booting the OCR engine before any scan is found. */
export function warmOcr(): void {
  getOcr().catch(() => {
    /* offline or CDN blocked — only matters if a scanned page appears */
  });
}

/* ---------------- rendering ---------------- */

async function renderPage(
  page: any,
  targetWidth: number,
  maxScale = 3
): Promise<HTMLCanvasElement> {
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(maxScale, Math.max(0.35, targetWidth / base.width));
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport } as any).promise;
  return canvas;
}

/** Cheaply shrink an existing raster instead of re-rendering the page. */
function downscaleCanvas(src: HTMLCanvasElement, targetWidth: number): HTMLCanvasElement {
  const scale = Math.min(1, targetWidth / src.width);
  if (scale >= 1) return src;
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(src.width * scale));
  out.height = Math.max(1, Math.round(src.height * scale));
  const ctx = out.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, out.width, out.height);
  return out;
}

/* ---------------- batch runner ---------------- */

export interface BatchCallbacks {
  onJobs: (jobs: JobInfo[]) => void;
  onJob: (id: string, patch: Partial<JobInfo>) => void;
  onLabel: (label: Label) => void;
  onTotalPages: (n: number) => void;
  onPageDone: () => void;
  isCancelled: () => boolean;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

const CONCURRENCY = 3;

/**
 * Process a batch of label PDFs. Each page becomes one Label with extracted
 * text (text layer first, OCR fallback for scans), a thumbnail, the detected
 * partner, and best-effort AWB / order numbers.
 */
export async function runBatch(
  files: File[],
  store: Map<string, ArrayBuffer>,
  cb: BatchCallbacks
): Promise<void> {
  await initPdfWorker();
  warmOcr(); // pre-heat the engine so scanned pages never wait for it to boot

  const keys: string[] = [];
  const jobs: JobInfo[] = files.map((f) => {
    const id = uid();
    keys.push(`${id}:${f.name}`);
    return { id, name: f.name, size: f.size, pages: 0, state: "queued" as const };
  });
  cb.onJobs(jobs);

  async function work(index: number): Promise<void> {
    const job = jobs[index];
    const file = files[index];
    const key = keys[index];
    try {
      const bytes = await file.arrayBuffer();
      store.set(key, bytes); // keep originals for downloads
      cb.onJob(job.id, { state: "reading" });

      const doc = await getDocument({ data: bytes.slice(0) }).promise;
      cb.onJob(job.id, { pages: doc.numPages });
      cb.onTotalPages(doc.numPages);
      let cancelled = false;

      for (let p = 0; p < doc.numPages; p++) {
        if (cb.isCancelled()) {
          cancelled = true;
          cb.onJob(job.id, { state: "cancelled" });
          break;
        }
        const page = await doc.getPage(p + 1);

        // 1) embedded text layer — fast path
        let text = "";
        try {
          const tc = await page.getTextContent();
          text = (tc.items as any[])
            .map((it) => (typeof it?.str === "string" ? it.str : ""))
            .join(" ");
        } catch {
          text = "";
        }

        // 2) scanned label → OCR
        //    Speed: engine acquisition starts *while* the page rasterizes,
        //    the raster is kept at ~1100px (plenty for Tesseract, far fewer
        //    pixels to chew), and the same raster is downscaled for the
        //    thumbnail so the page is never rendered twice.
        let ocrUsed = false;
        let thumbOverride: HTMLCanvasElement | null = null;
        if (text.replace(/\s+/g, "").length < 24) {
          cb.onJob(job.id, { state: "scanning" });
          const ocrReady = getOcr();
          try {
            const ocrCanvas = await renderPage(page, 1100, 2.5);
            const ocr = await ocrReady;
            text = await ocr.recognize(ocrCanvas);
            ocrUsed = true;
            thumbOverride = downscaleCanvas(ocrCanvas, 420);
          } catch {
            /* unreadable scan → stays unknown, user can override */
          }
        }

        // 3) thumbnail for the preview grid
        const thumbCanvas = thumbOverride ?? (await renderPage(page, 420, 2));
        const thumb = thumbCanvas.toDataURL("image/jpeg", 0.82);

        cb.onLabel({
          id: uid(),
          jobId: job.id,
          fileName: file.name,
          fileKey: key,
          pageIndex: p,
          pageCount: doc.numPages,
          text,
          ocrUsed,
          thumb,
          partnerId: detectPartner(text, file.name) ?? UNKNOWN_ID,
          manual: false,
          awb: extractAwb(text),
          orderId: extractOrderId(text),
        });
        cb.onPageDone();
        try {
          page.cleanup();
        } catch {
          /* noop */
        }
      }

      await doc.destroy();
      if (!cancelled) cb.onJob(job.id, { state: "done" });
    } catch (e: any) {
      cb.onJob(job.id, {
        state: "error",
        error: e?.message || "Could not read this PDF.",
      });
    }
  }

  let next = 0;
  const runners = Array.from(
    { length: Math.min(CONCURRENCY, jobs.length) },
    async () => {
      while (true) {
        const i = next++;
        if (i >= jobs.length) break;
        await work(i);
      }
    }
  );
  await Promise.all(runners);
}
