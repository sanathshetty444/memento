import { readFile } from "node:fs/promises";
import type { Extractor, ExtractorResult } from "./interface.js";

export class PdfExtractor implements Extractor {
  name = "pdf";

  supports(input: string): boolean {
    return input.toLowerCase().endsWith(".pdf");
  }

  async extract(input: string): Promise<ExtractorResult> {
    let pdfParse: (buffer: Buffer) => Promise<{ text: string; info?: Record<string, string> }>;

    try {
      const mod = await import("pdf-parse");
      pdfParse = mod.default ?? mod;
    } catch {
      throw new Error("pdf-parse is not installed. Install it with: npm install pdf-parse");
    }

    const buffer = await readFile(input);
    const data = await pdfParse(buffer);

    const title = data.info?.Title ?? undefined;
    const author = data.info?.Author ?? undefined;

    return {
      text: data.text,
      metadata: {
        title,
        author,
        format: "pdf",
      },
    };
  }
}
