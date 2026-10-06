export const SORTED_SIZES = ["S", "M", "L", "XL", "XXL"] as const;
export const SORTED_SKU_NUMBERS = [11, 12, 13, 14, 15, 16, 17, 18] as const;

export type Size = (typeof SORTED_SIZES)[number];
export type SkuNumber = (typeof SORTED_SKU_NUMBERS)[number];
export type DetectedSize = Size | "Unknown";

export interface ExtractedPageText {
  pageNumber: number;
  text: string;
}

export interface DetectedPage {
  pageNumber: number;
  size: DetectedSize;
  skuNumber?: SkuNumber;
  reason?: string;
}
