export const SORTED_SIZES = ["S", "M", "L", "XL", "XXL"] as const;

export type Size = (typeof SORTED_SIZES)[number];
export type DetectedSize = Size | "Unknown";

export interface ExtractedPageText {
  pageNumber: number;
  text: string;
}

export interface DetectedPage {
  pageNumber: number;
  size: DetectedSize;
  reason?: string;
}
