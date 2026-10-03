import { SORTED_SIZES, type DetectedPage, type Size } from "./types.js";

export interface SortedPages {
  orderedPages: DetectedPage[];
  counts: Record<Size, number>;
  unknownPages: DetectedPage[];
}

export function sortPages(pages: DetectedPage[]): SortedPages {
  const counts = Object.fromEntries(SORTED_SIZES.map((size) => [size, 0])) as Record<Size, number>;
  const groups = new Map<string, DetectedPage[]>();

  for (const page of pages) {
    const group = groups.get(page.size) ?? [];
    group.push(page);
    groups.set(page.size, group);
    if (page.size !== "Unknown") {
      counts[page.size] += 1;
    }
  }

  const unknownPages = groups.get("Unknown") ?? [];
  const orderedPages = [
    ...SORTED_SIZES.flatMap((size) => groups.get(size) ?? []),
    ...unknownPages,
  ];

  return { orderedPages, counts, unknownPages };
}
