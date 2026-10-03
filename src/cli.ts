import { readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";
import { sortPdf } from "./sort-pdf.js";
import { SORTED_SIZES } from "./types.js";

function defaultOutputPath(inputPath: string): string {
  const extension = extname(inputPath) || ".pdf";
  return `${resolve(dirname(inputPath), basename(inputPath, extension))}.sorted${extension}`;
}

function printUsage(): void {
  console.error("Usage: npm run sort -- <input.pdf> [output.pdf]");
}

async function main(): Promise<void> {
  const [, , inputArgument, outputArgument] = process.argv;
  if (!inputArgument) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const inputPath = resolve(inputArgument);
  const outputPath = resolve(outputArgument ?? defaultOutputPath(inputArgument));
  if (inputPath === outputPath) {
    throw new Error("Output PDF must be different from the input PDF.");
  }

  const sourcePdf = new Uint8Array(await readFile(inputPath));
  const result = await sortPdf(sourcePdf);
  await writeFile(outputPath, result.sortedPdf);

  console.log(`Processed ${result.detectedPages.length} page(s).`);
  for (const size of SORTED_SIZES) {
    console.log(`${size.padEnd(3)} ${result.sorted.counts[size]}`);
  }
  console.log(`Unknown ${result.sorted.unknownPages.length}`);
  if (result.sorted.unknownPages.length > 0) {
    console.log("Unknown page details:");
    for (const page of result.sorted.unknownPages) {
      console.log(`  Page ${page.pageNumber}: ${page.reason ?? "Size could not be determined"}`);
    }
  }
  console.log(`Sorted PDF: ${outputPath}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
