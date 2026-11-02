import { extractText, getDocumentProxy, renderPageAsImage } from "unpdf";
import { createWorker, OEM } from "tesseract.js";
import { tmpdir } from "node:os";
import { mkdir, stat, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

const languageDir = join(tmpdir(), "zk-examiner-ocr");
let languageReady: Promise<void> | undefined;
async function prepareLanguage(signal: AbortSignal) {
  const language = join(languageDir, "eng.traineddata");
  try { if ((await stat(language)).size > 1_000_000) return; } catch { /* ephemeral cache is cold */ }
  if (languageReady) return languageReady;
  languageReady = (async () => {
    await mkdir(languageDir, { recursive: true });
    // Explicitly time-bound the cold-start download; Tesseract's internal
    // downloader does not expose a request abort signal.
    const response = await fetch("https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz", {
      signal: AbortSignal.any([signal, AbortSignal.timeout(25_000)]),
    });
    if (!response.ok || !response.body) throw new Error("OCR language unavailable");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > 20 * 1024 * 1024) throw new Error("OCR language download exceeds limit");
        chunks.push(value);
      }
    } finally { await reader.cancel(); }
    const data = gunzipSync(Buffer.concat(chunks), { maxOutputLength: 40 * 1024 * 1024 });
    const temporary = `${language}.${process.pid}.tmp`;
    await writeFile(temporary, data);
    await rename(temporary, language);
  })();
  try { await languageReady; } finally { languageReady = undefined; }
}

export type DocumentPage = { text: string; page: number; method: "text" | "ocr" };
// At most one PDF/OCR workload in this process. Requests for the same examiner
// are additionally deduplicated by the contact service.
let queue = Promise.resolve();
export async function readOfficeAction(bytes: Uint8Array, signal: AbortSignal): Promise<DocumentPage[]> {
  let release!: () => void;
  const before = queue;
  queue = new Promise<void>((resolve) => { release = resolve; });
  await before;
  let pdf: Awaited<ReturnType<typeof getDocumentProxy>> | undefined;
  let worker: Awaited<ReturnType<typeof createWorker>> | undefined;
  try {
    signal.throwIfAborted();
    pdf = await getDocumentProxy(bytes);
    if (pdf.numPages > 60) throw new Error("Document exceeds examination-contact page budget");
    const native = await extractText(pdf, { mergePages: false });
    const pages: DocumentPage[] = native.text.map((text, i) => ({ text, page: i + 1, method: "text" }));
    // ODP Office Actions often contain scanned TIFFs. OCR the final pages
    // where examiner contact paragraphs occur, rather than silently treating
    // a scanned document as having no email.
    const targets = [...new Set([pdf.numPages, Math.max(1, pdf.numPages - 1), Math.max(1, pdf.numPages - 2), 1])]
      .filter((p) => (pages[p - 1]?.text.trim().length ?? 0) < 100);
    if (!targets.length) return pages;
    await prepareLanguage(signal);
    signal.throwIfAborted();
    worker = await createWorker("eng", OEM.LSTM_ONLY, { cachePath: languageDir, langPath: languageDir, gzip: false });
    const onAbort = () => { void worker?.terminate().catch(() => {}); };
    signal.addEventListener("abort", onAbort, { once: true });
    try {
      for (const page of targets) {
        signal.throwIfAborted();
        const image = await renderPageAsImage(pdf, page, { scale: 1.7, canvasImport: () => import("@napi-rs/canvas") });
        const result = await worker.recognize(Buffer.from(image));
        if (result.data.confidence >= 70) pages[page - 1] = { text: result.data.text, page, method: "ocr" };
      }
    } finally { signal.removeEventListener("abort", onAbort); }
    return pages;
  } finally {
    await worker?.terminate().catch(() => {});
    await pdf?.loadingTask.destroy().catch(() => {});
    release();
  }
}
