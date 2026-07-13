/**
 * Render a PDF File's first page to a PNG File, client-side, via pdf.js.
 * Dynamically imported so pdf.js stays out of the main bundle (only loaded when
 * a PDF plan is actually imported). Returns null on any failure.
 */
export async function pdfToImage(file: File): Promise<File | null> {
  try {
    const pdfjs = await import("pdfjs-dist");
    const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

    const data = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data }).promise;
    const page = await pdf.getPage(1);

    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(2.5, 1600 / base.width); // ~1600px wide, capped
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
    return blob ? new File([blob], "plan.png", { type: "image/png" }) : null;
  } catch {
    return null;
  }
}
