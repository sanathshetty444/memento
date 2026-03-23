import type { Extractor, ExtractorResult } from "./interface.js";

function stripHtml(html: string): string {
  // Remove script and style blocks entirely
  let cleaned = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  cleaned = cleaned.replace(/<style[\s\S]*?<\/style>/gi, "");
  // Remove HTML comments
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, "");
  // Strip remaining tags
  cleaned = cleaned.replace(/<[^>]+>/g, " ");
  // Decode common HTML entities
  cleaned = cleaned
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
  // Collapse whitespace
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  return cleaned;
}

function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].trim() : undefined;
}

export class UrlExtractor implements Extractor {
  name = "url";

  supports(input: string): boolean {
    return input.startsWith("http://") || input.startsWith("https://");
  }

  async extract(input: string): Promise<ExtractorResult> {
    const response = await fetch(input, {
      headers: {
        "User-Agent": "Memento/1.0 (content extractor)",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const title = extractTitle(html);
    const text = stripHtml(html);

    return {
      text,
      metadata: {
        title,
        sourceUrl: input,
        format: "html",
      },
    };
  }
}
