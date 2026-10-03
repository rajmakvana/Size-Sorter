import { strict as assert } from "node:assert";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { createSortedPdf } from "../src/pdf/pdf-generator.js";

test("copies original pages in order without changing their dimensions", async () => {
  const source = await PDFDocument.create();
  source.addPage([100, 100]);
  source.addPage([200, 200]);
  source.addPage([300, 300]);
  const sourceBytes = await source.save();

  const sortedBytes = await createSortedPdf(new Uint8Array(sourceBytes), [
    { pageNumber: 2, size: "S" },
    { pageNumber: 3, size: "M" },
    { pageNumber: 1, size: "Unknown" },
  ]);
  const sorted = await PDFDocument.load(sortedBytes);

  assert.deepEqual(
    sorted.getPages().map((page) => [page.getWidth(), page.getHeight()]),
    [
      [200, 200],
      [300, 300],
      [100, 100],
    ],
  );
});
