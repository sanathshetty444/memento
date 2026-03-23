import type { Extractor, ExtractorResult } from "./interface.js";

const SUPPORTED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"]);

export class ImageExtractor implements Extractor {
  name = "image";

  supports(input: string): boolean {
    const ext = input.toLowerCase().split(".").pop();
    return ext ? SUPPORTED_EXTENSIONS.has(`.${ext}`) : false;
  }

  async extract(input: string): Promise<ExtractorResult> {
    let Tesseract: {
      recognize: (image: string, lang?: string) => Promise<{ data: { text: string } }>;
    };

    try {
      const mod = await import("tesseract.js");
      Tesseract = mod.default ?? mod;
    } catch {
      throw new Error("tesseract.js is not installed. Install it with: npm install tesseract.js");
    }

    const result = await Tesseract.recognize(input, "eng");
    const text = result.data.text.trim();

    const ext = input.split(".").pop()?.toLowerCase() ?? "unknown";

    return {
      text: text || "(No text detected in image)",
      metadata: {
        title: input.split("/").pop(),
        format: ext,
      },
    };
  }
}
