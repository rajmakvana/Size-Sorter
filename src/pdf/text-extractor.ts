import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import type { ExtractedPageText } from "../types.js";

type PdfTextItem = {
  str?: string;
  hasEOL?: boolean;
};

export interface TextExtractionProgress {
  pageNumber: number;
  totalPages: number;
}

const standardFontDataUrl = fileURLToPath(
  new URL("../../node_modules/pdfjs-dist/standard_fonts/", import.meta.url),
);

function getItemText(item: unknown): string {
  if (typeof item !== "object" || item === null || !("str" in item)) {
    return "";
  }

  const text = (item as PdfTextItem).str;
  return typeof text === "string" ? text : "";
}

function itemHasLineBreak(item: unknown): boolean {
  return typeof item === "object" && item !== null && "hasEOL" in item
    ? Boolean((item as PdfTextItem).hasEOL)
    : false;
}

/** Extracts text only. It never writes back to or changes the source PDF. */
export async function extractPageTexts(
  pdfBytes: Uint8Array,
  onProgress?: (progress: TextExtractionProgress) => void,
): Promise<ExtractedPageText[]> {
  // PDF.js may transfer and detach the buffer supplied to it. Keep the caller's source bytes intact
  // because they are passed to pdf-lib later to copy the original pages.
  const document = await pdfjsLib.getDocument({
    data: new Uint8Array(pdfBytes),
    standardFontDataUrl,
  }).promise;
  const pages: ExtractedPageText[] = [];

  try {
    const pageConcurrency = 4;
    for (let firstPage = 1; firstPage <= document.numPages; firstPage += pageConcurrency) {
      const pageNumbers = Array.from(
        { length: Math.min(pageConcurrency, document.numPages - firstPage + 1) },
        (_, offset) => firstPage + offset,
      );
      const batch = await Promise.all(pageNumbers.map(async (pageNumber) => {
        const page = await document.getPage(pageNumber);
        try {
          const content = await page.getTextContent();
          const text = content.items
            .map((item) => `${getItemText(item)}${itemHasLineBreak(item) ? "\n" : " "}`)
            .join("")
            .trim();
          return { pageNumber, text };
        } finally {
          page.cleanup();
        }
      }));

      // Promise.all preserves pageNumbers order, so the original page order remains intact.
      for (const page of batch) {
        pages.push(page);
        onProgress?.({ pageNumber: page.pageNumber, totalPages: document.numPages });
      }
    }
  } finally {
    await document.destroy();
  }

  return pages;
}

export async function extractPageTextsFromFile(filePath: string): Promise<ExtractedPageText[]> {
  return extractPageTexts(new Uint8Array(await readFile(filePath)));
}
