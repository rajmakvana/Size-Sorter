import { strict as assert } from "node:assert";
import test from "node:test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { extractPageTexts } from "../src/pdf/text-extractor.js";

test("extracts text separately for every PDF page", async () => {
  const source = await PDFDocument.create();
  const font = await source.embedFont(StandardFonts.Helvetica);
  const firstPage = source.addPage();
  firstPage.drawText("Product Details SKU Size Qty Color Order No. TEE S 1 Red 1", { font });
  const secondPage = source.addPage();
  secondPage.drawText("Product Details SKU Size Qty Color Order No. TEE XL 1 Blue 2", { font });

  const sourceBytes = new Uint8Array(await source.save());
  const pages = await extractPageTexts(sourceBytes);

  assert.equal(pages.length, 2);
  assert.match(pages[0].text, /TEE S/);
  assert.match(pages[1].text, /TEE XL/);
  assert.equal(String.fromCharCode(...sourceBytes.subarray(0, 5)), "%PDF-");
});
