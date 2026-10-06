import type { DetectedPage, ExtractedPageText, Size, SkuNumber } from "./types.js";

const SIZE_TOKEN = /(?<![A-Za-z0-9-])(XXL|XL|L|M|S)(?![A-Za-z0-9-])/gi;
const LABELED_SIZE = /\bsize\s*[:=-]?\s*(XXL|XL|L|M|S)\b/gi;
const PRODUCT_ROW = /^(.*?)\s+(?<![A-Za-z0-9-])(XXL|XL|L|M|S)(?![A-Za-z0-9-])\s+\d+\s+\S+(?:\s+\S+)*?\s+\d{5,}(?:_\d+)?\b/i;
const PRODUCT_DETAILS = /\bproduct\s+details?\b/i;
const PRODUCT_HEADER = /\bSKU\s+Size\s+Qty\s+Color\s+Order\s+No\.?\b/i;
const SECTION_END = /\b(?:tax\s+invoice|shipping|customer|seller|delivery|return|invoice|payment|price|package)\s+(?:address|details?|information|summary)?\b/i;

function normalizeWhitespace(text: string): string {
  return text.replace(/[\u00a0\u2007\u202f]/g, " ").replace(/\s+/g, " ").trim();
}

function uniqueSizes(matches: Iterable<string>): Size[] {
  const sizes = new Set<Size>();
  for (const value of matches) {
    const normalized = value.toUpperCase() as Size;
    if (["S", "M", "L", "XL", "XXL"].includes(normalized)) {
      sizes.add(normalized);
    }
  }
  return [...sizes];
}

function findSkuNumber(skuText: string): SkuNumber | undefined {
  const matches = [...skuText.matchAll(/(?<!\d)(1[1-8])(?!\d)/g)]
    .map((match) => Number(match[1]) as SkuNumber);
  const unique = [...new Set(matches)];
  return unique.length === 1 ? unique[0] : undefined;
}

function findSizeInProductSection(text: string): { sizes: Size[]; skuNumber?: SkuNumber; reason?: string } {
  const normalized = normalizeWhitespace(text);
  const productStart = normalized.search(PRODUCT_DETAILS);
  if (productStart < 0) {
    return { sizes: [], reason: "Product Details section not found" };
  }

  const productSection = normalized.slice(productStart);
  const header = PRODUCT_HEADER.exec(productSection);
  if (!header) {
    return { sizes: [], reason: "SKU Size Qty Color Order No. row not found" };
  }

  const afterHeader = productSection.slice(header.index + header[0].length);
  const nextSection = SECTION_END.exec(afterHeader);
  const productRows = nextSection ? afterHeader.slice(0, nextSection.index) : afterHeader;
  const productRow = PRODUCT_ROW.exec(productRows);
  const skuNumber = productRow ? findSkuNumber(productRow[1]) : undefined;

  // Prefer an explicit Size: value when the PDF includes one. Otherwise, use
  // the size field in the table row. The row shape prevents invoice descriptions
  // later on the page from being mistaken for a second product size.
  const labeledSizes = uniqueSizes([...productRows.matchAll(LABELED_SIZE)].map((match) => match[1]));
  const rowSizes = productRow ? uniqueSizes([productRow[2]]) : [];
  const tableSizes = rowSizes.length > 0
    ? rowSizes
    : uniqueSizes([...productRows.matchAll(SIZE_TOKEN)].map((match) => match[1]));
  const sizes = labeledSizes.length > 0 ? labeledSizes : tableSizes;

  if (sizes.length === 0) {
    return { sizes, skuNumber, reason: "No size value found in product rows" };
  }
  if (sizes.length > 1) {
    return { sizes, skuNumber, reason: `Multiple sizes found: ${sizes.join(", ")}` };
  }

  return { sizes, skuNumber };
}

export function detectPageSize(page: ExtractedPageText): DetectedPage {
  const result = findSizeInProductSection(page.text);
  if (result.sizes.length !== 1) {
    return {
      pageNumber: page.pageNumber,
      size: "Unknown",
      ...(result.skuNumber === undefined ? {} : { skuNumber: result.skuNumber }),
      reason: result.reason ?? "Size could not be determined",
    };
  }

  return {
    pageNumber: page.pageNumber,
    size: result.sizes[0],
    ...(result.skuNumber === undefined ? {} : { skuNumber: result.skuNumber }),
  };
}

export function detectPageSizes(pages: ExtractedPageText[]): DetectedPage[] {
  return pages.map(detectPageSize);
}
