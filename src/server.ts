import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { basename, extname, resolve } from "node:path";
import express, { type Request, type Response, type NextFunction } from "express";
import helmet from "helmet";
import multer from "multer";
import { type SortProgress } from "./sort-pdf.js";
import { sortPdfInWorker } from "./sort-worker-client.js";
import type { SkuSizeCounts } from "./page-sorter.js";
import { SORTED_SIZES, type Size } from "./types.js";

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const JOB_TTL_MS = 30 * 60 * 1000;
const PORT = Number(process.env.PORT ?? 3000);
const HOST = "0.0.0.0";
const NETWORK_HOST = process.env.NETWORK_HOST ?? "192.168.1.86";

type JobStatus = "queued" | "processing" | "complete" | "failed";

interface Job {
  id: string;
  status: JobStatus;
  progress: SortProgress;
  originalName: string;
  result?: Uint8Array;
  counts?: Record<Size, number>;
  skuCounts?: SkuSizeCounts;
  totalPages?: number;
  unknownPages?: number;
  unknownSkuPages?: number;
  error?: string;
  listeners: Set<Response>;
}

const jobs = new Map<string, Job>();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
});

const publicDirectory = fileURLToPath(new URL("../public/", import.meta.url));
const viewsDirectory = fileURLToPath(new URL("../views/", import.meta.url));

function initialProgress(): SortProgress {
  return {
    phase: "extracting",
    current: 0,
    total: 0,
    percent: 0,
    message: "Waiting to start...",
  };
}

function publicJob(job: Job): Record<string, unknown> {
  return {
    id: job.id,
    status: job.status,
    progress: job.progress,
    originalName: job.originalName,
    counts: job.counts,
    skuCounts: job.skuCounts,
    totalPages: job.totalPages,
    unknownPages: job.unknownPages,
    unknownSkuPages: job.unknownSkuPages,
    error: job.error,
  };
}

function sendEvent(response: Response, event: string, payload: unknown): void {
  response.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

function publish(job: Job, event: string): void {
  const payload = publicJob(job);
  for (const response of job.listeners) {
    sendEvent(response, event, payload);
    if (job.status === "complete" || job.status === "failed") {
      response.end();
      job.listeners.delete(response);
    }
  }
}

function scheduleCleanup(job: Job): void {
  setTimeout(() => {
    jobs.delete(job.id);
  }, JOB_TTL_MS).unref();
}

async function processJob(job: Job, sourcePdf: Uint8Array): Promise<void> {
  job.status = "processing";
  job.progress = { ...job.progress, percent: 3, message: "Starting..." };
  publish(job, "progress");

  try {
    const result = await sortPdfInWorker(sourcePdf, (progress) => {
      job.progress = progress;
      publish(job, "progress");
    });

    job.status = "complete";
    job.result = result.sortedPdf;
    job.counts = result.sorted.counts;
    job.skuCounts = result.sorted.skuCounts;
    job.totalPages = result.detectedPages.length;
    job.unknownPages = result.sorted.unknownPages.length;
    job.unknownSkuPages = result.sorted.unknownSkuPages.length;
    job.progress = {
      phase: "complete",
      current: result.detectedPages.length,
      total: result.detectedPages.length,
      percent: 100,
      message: "Your sorted PDF is ready.",
    };
    publish(job, "complete");
  } catch (error: unknown) {
    job.status = "failed";
    job.error = error instanceof Error ? error.message : "The PDF could not be sorted.";
    job.progress = { ...job.progress, message: "Sorting failed." };
    publish(job, "job-error");
  } finally {
    scheduleCleanup(job);
  }
}

function uploadMiddleware(request: Request, response: Response, next: NextFunction): void {
  upload.single("pdf")(request, response, (error: unknown) => {
    if (error) {
      next(error);
      return;
    }
    next();
  });
}

function safeDownloadName(originalName: string): string {
  const stem = basename(originalName, extname(originalName))
    .replace(/[^A-Za-z0-9 _.-]/g, "")
    .trim() || "sorted-pdf";
  return `${stem}.sorted.pdf`;
}

export function createApp(): express.Express {
  const app = express();
  app.set("view engine", "ejs");
  app.set("views", viewsDirectory);
  app.use(helmet());
  app.use(express.static(publicDirectory));

  app.get("/", (_request, response) => {
    response.render("index");
  });

  app.get("/healthz", (_request, response) => {
    response.json({ ok: true });
  });

  app.post("/api/jobs", uploadMiddleware, (request, response, next) => {
    try {
      const file = request.file;
      if (!file) {
        response.status(400).json({ error: "Choose a PDF file to upload." });
        return;
      }
      if (!file.originalname.toLowerCase().endsWith(".pdf")) {
        response.status(415).json({ error: "Only PDF files are supported." });
        return;
      }
      if (file.buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
        response.status(415).json({ error: "The uploaded file is not a readable PDF." });
        return;
      }

      const job: Job = {
        id: randomUUID(),
        status: "queued",
        progress: initialProgress(),
        originalName: file.originalname,
        listeners: new Set(),
      };
      jobs.set(job.id, job);
      response.status(202).json({ jobId: job.id });
      void processJob(job, new Uint8Array(file.buffer));
    } catch (error: unknown) {
      next(error);
    }
  });

  app.get("/api/jobs/:id", (request, response) => {
    const job = jobs.get(request.params.id);
    if (!job) {
      response.status(404).json({ error: "Sorting job not found or expired." });
      return;
    }
    response.set("Cache-Control", "no-store").json(publicJob(job));
  });

  app.get("/api/jobs/:id/events", (request, response) => {
    const job = jobs.get(request.params.id);
    if (!job) {
      response.status(404).json({ error: "Sorting job not found or expired." });
      return;
    }

    response.status(200).set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    response.flushHeaders();

    if (job.status === "complete") {
      sendEvent(response, "complete", publicJob(job));
      response.end();
      return;
    }
    if (job.status === "failed") {
      sendEvent(response, "error", publicJob(job));
      response.end();
      return;
    }

    job.listeners.add(response);
    sendEvent(response, "progress", publicJob(job));
    const heartbeat = setInterval(() => response.write(": keep-alive\n\n"), 15_000);
    request.on("close", () => {
      clearInterval(heartbeat);
      job.listeners.delete(response);
    });
  });

  app.get("/api/jobs/:id/download", (request, response) => {
    const job = jobs.get(request.params.id);
    if (!job) {
      response.status(404).json({ error: "Sorted PDF not found or expired." });
      return;
    }
    if (job.status !== "complete" || !job.result) {
      response.status(409).json({ error: "Sorting is not complete yet." });
      return;
    }

    response.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeDownloadName(job.originalName)}"`,
      "Content-Length": String(job.result.byteLength),
    });
    response.send(Buffer.from(job.result));
  });

  app.use("/api", (_request, response) => {
    response.status(404).json({ error: "API endpoint not found." });
  });

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      response.status(413).json({ error: "That file is larger than the 50 MB limit." });
      return;
    }
    if (error instanceof multer.MulterError) {
      response.status(400).json({ error: "Only one PDF file can be uploaded at a time." });
      return;
    }
    response.status(500).json({ error: "The upload could not be processed." });
  });

  return app;
}

const isMainModule = process.argv[1]
  ? resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isMainModule) {
  createApp().listen(PORT, HOST, () => {
    console.log(`Meesho PDF Size Sorter running at http://localhost:${PORT}`);
    console.log(`Network: http://${NETWORK_HOST}:${PORT}`);
  });
}
