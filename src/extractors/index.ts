import type { Extractor, ExtractorResult } from "./interface.js";
import { MarkdownExtractor } from "./markdown.js";
import { CodeExtractor } from "./code.js";
import { UrlExtractor } from "./url.js";
import { PdfExtractor } from "./pdf.js";
import { ImageExtractor } from "./image.js";

export type { Extractor, ExtractorResult } from "./interface.js";

/**
 * Extractors in priority order.
 * URL extractor first (most specific check), then file-based extractors.
 */
const extractors: Extractor[] = [
  new UrlExtractor(),
  new MarkdownExtractor(),
  new CodeExtractor(),
  new PdfExtractor(),
  new ImageExtractor(),
];

/** Returns the first extractor that supports the given input, or null. */
export function getExtractor(input: string): Extractor | null {
  for (const extractor of extractors) {
    if (extractor.supports(input)) {
      return extractor;
    }
  }
  return null;
}

/** Convenience function: find an extractor and run it, or throw if unsupported. */
export async function extractContent(input: string): Promise<ExtractorResult> {
  const extractor = getExtractor(input);
  if (!extractor) {
    throw new Error(
      `Unsupported input format: ${input}. Supported: .md, .ts, .js, .py, .go, .rs, .java, .rb, .c, .cpp, .h, .pdf, .png, .jpg, .jpeg, .gif, .bmp, .webp, and http(s) URLs.`,
    );
  }
  return extractor.extract(input);
}
