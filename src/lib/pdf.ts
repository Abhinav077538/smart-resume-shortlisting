export interface PdfFileResult { text: string; name: string; }

type PdfLib = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (options: { data: ArrayBuffer; disableFontFace: boolean }) => { promise: Promise<any> };
};

declare global { interface Window { pdfjsLib?: PdfLib; } }

export const withTimeout = <T>(p: Promise<T>, ms: number, msg: string) => Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error(msg)), ms))]);
let workerReady: Promise<void> | undefined;
function initWorker() {
  const pdfjsLib = window.pdfjsLib;
  if (!pdfjsLib) throw new Error("PDF library failed to load (check internet). Paste text instead.");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  workerReady = workerReady || Promise.resolve();
  return workerReady;
}

export async function readPdf(file: File): Promise<string> {
  const pdfjsLib = window.pdfjsLib;
  if (!pdfjsLib) throw new Error("PDF library failed to load (check internet). Paste text instead.");
  await initWorker();
  const buf = await file.arrayBuffer();
  const doc = await withTimeout(pdfjsLib.getDocument({ data: buf, disableFontFace: true }).promise, 20000, "PDF took too long to open");
  let out = "";
  for (let p = 1; p <= doc.numPages; p++) {
    const pg = await withTimeout<any>(doc.getPage(p), 10000, "page timeout");
    const tc = await withTimeout<any>(pg.getTextContent(), 10000, "text timeout");
    let y: number | null = null;
    for (const it of tc.items) {
      const yy = it.transform[5];
      if (y !== null && Math.abs(yy - y) > 3) out += "\n"; else if (y !== null) out += " ";
      out += it.str; y = yy;
    }
    out += "\n";
  }
  if (out.trim().length < 20) throw new Error("No selectable text (scanned PDF?). Paste the text instead.");
  return out;
}
