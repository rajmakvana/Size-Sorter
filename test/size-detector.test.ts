import { strict as assert } from "node:assert";
import test from "node:test";
import { detectPageSize } from "../src/size-detector.js";

test("detects a size from the product details table", () => {
  const page = {
    pageNumber: 4,
    text: "Order label Product Details SKU Size Qty Color Order No. TSHIRT-BLUE M 1 Blue 12345 Customer Details Name Jane",
  };

  assert.deepEqual(detectPageSize(page), { pageNumber: 4, size: "M" });
});

test("detects the SKU number before the size field", () => {
  const page = {
    pageNumber: 8,
    text: "Product Details SKU Size Qty Color Order No. Grey Shirt_14 XXL 1 Grey 12345",
  };

  assert.deepEqual(detectPageSize(page), { pageNumber: 8, size: "XXL", skuNumber: 14 });
});

test("accepts lowercase sizes and prefers an explicit size value", () => {
  const page = {
    pageNumber: 2,
    text: "Product Details SKU Size Qty Color Order No. product-m size: xl 1 black Shipping Address Delhi",
  };

  assert.deepEqual(detectPageSize(page), { pageNumber: 2, size: "XL" });
});

test("ignores repeated size text in the invoice description", () => {
  const page = {
    pageNumber: 7,
    text: "Product Details SKU Size Qty Color Order No. Shirt XL 1 Blue 12345 TAX INVOICE Description Full Sleeve Shirt - XL",
  };

  assert.deepEqual(detectPageSize(page), { pageNumber: 7, size: "XL" });
});

test("does not use unrelated page text as a size", () => {
  const page = {
    pageNumber: 1,
    text: "This label mentions S, M and L. Customer Details only.",
  };

  assert.equal(detectPageSize(page).size, "Unknown");
});

test("keeps missing and mixed sizes unknown", () => {
  const missing = {
    pageNumber: 3,
    text: "Product Details SKU Size Qty Color Order No. SKU-123 1 Blue 12345",
  };
  const mixed = {
    pageNumber: 5,
    text: "Product Details SKU Size Qty Color Order No. SKU-1 S 1 Red SKU-2 M 1 Blue",
  };

  assert.equal(detectPageSize(missing).size, "Unknown");
  assert.equal(detectPageSize(mixed).size, "Unknown");
  assert.match(detectPageSize(mixed).reason ?? "", /Multiple sizes/);
});

test("does not treat a hyphenated SKU suffix as the size field", () => {
  const page = {
    pageNumber: 6,
    text: "Product Details SKU Size Qty Color Order No. TSHIRT-M 2 Red 12345",
  };

  assert.equal(detectPageSize(page).size, "Unknown");
});
