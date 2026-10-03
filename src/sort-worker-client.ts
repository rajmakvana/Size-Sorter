import { Worker } from "node:worker_threads";
import type { SortProgress, SortResult } from "./sort-pdf.js";

interface WorkerCompleteMessage {
  type: "complete";
  sortedPdf: ArrayBuffer;
  detectedPages: SortResult["detectedPages"];
  sorted: SortResult["sorted"];
}

interface WorkerProgressMessage {
  type: "progress";
  progress: SortProgress;
}

interface WorkerErrorMessage {
  type: "error";
  error: string;
}

type WorkerMessage = WorkerCompleteMessage | WorkerProgressMessage | WorkerErrorMessage;

export function sortPdfInWorker(
  sourcePdf: Uint8Array,
  onProgress?: (progress: SortProgress) => void,
): Promise<SortResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./sort-worker.js", import.meta.url));
    let settled = false;

    const finish = (callback: () => void): void => {
      if (settled) return;
      settled = true;
      void worker.terminate();
      callback();
    };

    worker.on("message", (message: WorkerMessage) => {
      if (message.type === "progress") {
        onProgress?.(message.progress);
        return;
      }
      if (message.type === "error") {
        finish(() => reject(new Error(message.error)));
        return;
      }

      finish(() => resolve({
        sortedPdf: new Uint8Array(message.sortedPdf),
        detectedPages: message.detectedPages,
        sorted: message.sorted,
      }));
    });
    worker.on("error", (error) => finish(() => reject(error)));
    worker.on("exit", (code) => {
      if (code !== 0) finish(() => reject(new Error(`Sort worker stopped with exit code ${code}.`)));
    });

    const workerBytes = new Uint8Array(sourcePdf);
    worker.postMessage({ sourcePdf: workerBytes.buffer }, [workerBytes.buffer]);
  });
}
