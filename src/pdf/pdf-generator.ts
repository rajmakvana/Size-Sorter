import { PDFDocument } from "pdf-lib";
import type { DetectedPage } from "../types.js";

/** Copies original page objects in the requested order; it does not render or edit them. */
export async function createSortedPdf(
  sourcePdf: Uint8Array,
  orderedPages: DetectedPage[],
): Promise<Uint8Array> {
  const source = await PDFDocument.load(sourcePdf);
  const output = await PDFDocument.create();
  const pageIndexes = orderedPages.map((page) => page.pageNumber - 1);
  const copiedPages = await output.copyPages(source, pageIndexes);

  for (const page of copiedPages) {
    output.addPage(page);
  }

  return output.save();
}
