import { parentPort } from "node:worker_threads";
import { sortPdf, type SortProgress } from "./sort-pdf.js";

interface SortMessage {
  sourcePdf: ArrayBuffer;
}

if (!parentPort) {
  throw new Error("Sort worker must be started by a parent thread.");
}
const port = parentPort;

port.on("message", async ({ sourcePdf }: SortMessage) => {
  try {
    const result = await sortPdf(new Uint8Array(sourcePdf), (progress: SortProgress) => {
      port.postMessage({ type: "progress", progress });
    });
    const sortedPdf = new Uint8Array(result.sortedPdf);
    port.postMessage(
      {
        type: "complete",
        sortedPdf: sortedPdf.buffer,
        detectedPages: result.detectedPages,
        sorted: result.sorted,
      },
      [sortedPdf.buffer],
    );
  } catch (error: unknown) {
    port.postMessage({
      type: "error",
      error: error instanceof Error ? error.message : "The PDF could not be sorted.",
    });
  }
});
