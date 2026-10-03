# Meesho PDF Size Sorter

Web and CLI tool that extracts Meesho label text, detects clothing sizes from the `Product Details` / `SKU Size Qty Color Order No.` table, and writes a PDF with the original pages reordered as `S`, `M`, `L`, `XL`, `XXL`, then `Unknown`.

## Requirements

- Node.js 20 or newer

## Setup

```sh
npm install
npm run build
```

## Use

Start the upload website:

```sh
npm start
```

Open `http://localhost:3000`. Set `PORT` to use a different port. The web app accepts one PDF up to 50 MB, shows upload and sorting progress, and provides the sorted PDF when complete.

For the command line:

```sh
npm run sort -- input.pdf output.sorted.pdf
```

If the output path is omitted, `<input>.sorted.pdf` is created. The CLI prints the total page count, each size count, and the page number plus reason for every unknown page.

The extractor is text-only. The generator uses `pdf-lib` to copy the original page objects into a new document in sorted order; it does not recreate, resize, compress, render, or edit label content.

## Tests

```sh
npm test
npm run typecheck
```
