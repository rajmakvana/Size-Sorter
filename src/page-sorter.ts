import {
  SORTED_SIZES,
  SORTED_SKU_NUMBERS,
  type DetectedPage,
  type Size,
  type SkuNumber,
} from "./types.js";

export type SkuSizeCounts = Record<SkuNumber, Record<Size, number>>;

export interface SortedPages {
  orderedPages: DetectedPage[];
  counts: Record<Size, number>;
  skuCounts: SkuSizeCounts;
  unknownPages: DetectedPage[];
  unknownSkuPages: DetectedPage[];
}

function createSkuCounts(): SkuSizeCounts {
  return Object.fromEntries(
    SORTED_SKU_NUMBERS.map((skuNumber) => [
      skuNumber,
      Object.fromEntries(SORTED_SIZES.map((size) => [size, 0])) as Record<Size, number>,
    ]),
  ) as SkuSizeCounts;
}

export function sortPages(pages: DetectedPage[]): SortedPages {
  const counts = Object.fromEntries(SORTED_SIZES.map((size) => [size, 0])) as Record<Size, number>;
  const skuCounts = createSkuCounts();
  const groups = new Map<SkuNumber, Map<string, DetectedPage[]>>();
  const unknownSkuGroups = new Map<string, DetectedPage[]>();
  const unknownPages: DetectedPage[] = [];
  const unknownSkuPages: DetectedPage[] = [];

  for (const page of pages) {
    if (page.size !== "Unknown") {
      counts[page.size] += 1;
    }
    if (page.size === "Unknown") {
      unknownPages.push(page);
    }

    if (page.skuNumber === undefined) {
      const group = unknownSkuGroups.get(page.size) ?? [];
      group.push(page);
      unknownSkuGroups.set(page.size, group);
      unknownSkuPages.push(page);
      continue;
    }

    const sizeGroups = groups.get(page.skuNumber) ?? new Map<string, DetectedPage[]>();
    const group = sizeGroups.get(page.size) ?? [];
    group.push(page);
    sizeGroups.set(page.size, group);
    groups.set(page.skuNumber, sizeGroups);
    if (page.size !== "Unknown") {
      skuCounts[page.skuNumber][page.size] += 1;
    }
  }

  const orderedPages = [
    ...SORTED_SKU_NUMBERS.flatMap((skuNumber) => {
      const sizeGroups = groups.get(skuNumber);
      return [
        ...SORTED_SIZES.flatMap((size) => sizeGroups?.get(size) ?? []),
        ...(sizeGroups?.get("Unknown") ?? []),
      ];
    }),
    ...SORTED_SIZES.flatMap((size) => unknownSkuGroups.get(size) ?? []),
    ...(unknownSkuGroups.get("Unknown") ?? []),
  ];

  return { orderedPages, counts, skuCounts, unknownPages, unknownSkuPages };
}
