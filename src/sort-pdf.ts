import { createSortedPdf } from "./pdf/pdf-generator.js";
import { extractPageTexts } from "./pdf/text-extractor.js";
import { detectPageSizes } from "./size-detector.js";
import { sortPages, type SortedPages } from "./page-sorter.js";
import type { DetectedPage } from "./types.js";

export interface SortProgress {
  phase: "extracting" | "detecting" | "building" | "complete";
  current: number;
  total: number;
  percent: number;
  message: string;
}

export interface SortResult {
  sortedPdf: Uint8Array;
  detectedPages: DetectedPage[];
  sorted: SortedPages;
}

export async function sortPdf(
  sourcePdf: Uint8Array,
  onProgress?: (progress: SortProgress) => void,
): Promise<SortResult> {
  onProgress?.({
    phase: "extracting",
    current: 0,
    total: 0,
    percent: 10,
    message: "Opening PDF...",
  });

  const extractedPages = await extractPageTexts(sourcePdf, ({ pageNumber, totalPages }) => {
    const percent = 10 + Math.round((pageNumber / totalPages) * 70);
    onProgress?.({
      phase: "extracting",
      current: pageNumber,
      total: totalPages,
      percent,
      message: `Reading page ${pageNumber} of ${totalPages}`,
    });
  });

  onProgress?.({
    phase: "detecting",
    current: extractedPages.length,
    total: extractedPages.length,
    percent: 88,
    message: "Detecting sizes...",
  });
  const detectedPages = detectPageSizes(extractedPages);
  const sorted = sortPages(detectedPages);

  onProgress?.({
    phase: "building",
    current: extractedPages.length,
    total: extractedPages.length,
    percent: 94,
    message: "Building sorted PDF...",
  });
  const sortedPdf = await createSortedPdf(sourcePdf, sorted.orderedPages);

  onProgress?.({
    phase: "complete",
    current: extractedPages.length,
    total: extractedPages.length,
    percent: 100,
    message: "Your sorted PDF is ready.",
  });

  return { sortedPdf, detectedPages, sorted };
}
