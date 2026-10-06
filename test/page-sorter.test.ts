import { strict as assert } from "node:assert";
import test from "node:test";
import { sortPages } from "../src/page-sorter.js";

test("sorts S through XXL and puts unknown pages last", () => {
  const result = sortPages([
    { pageNumber: 1, size: "XL" },
    { pageNumber: 2, size: "M" },
    { pageNumber: 3, size: "Unknown", reason: "not found" },
    { pageNumber: 4, size: "S" },
    { pageNumber: 5, size: "XXL" },
    { pageNumber: 6, size: "L" },
  ]);

  assert.deepEqual(result.orderedPages.map((page) => page.pageNumber), [4, 2, 6, 1, 5, 3]);
  assert.deepEqual(result.counts, { S: 1, M: 1, L: 1, XL: 1, XXL: 1 });
  assert.deepEqual(result.unknownPages.map((page) => page.pageNumber), [3]);
});

test("sorts by SKU number first and size within each SKU", () => {
  const result = sortPages([
    { pageNumber: 1, skuNumber: 12, size: "S" },
    { pageNumber: 2, skuNumber: 11, size: "XL" },
    { pageNumber: 3, skuNumber: 11, size: "S" },
    { pageNumber: 4, size: "M" },
  ]);

  assert.deepEqual(result.orderedPages.map((page) => page.pageNumber), [3, 2, 1, 4]);
  assert.equal(result.skuCounts[11].S, 1);
  assert.equal(result.skuCounts[11].XL, 1);
  assert.deepEqual(result.unknownSkuPages.map((page) => page.pageNumber), [4]);
});
