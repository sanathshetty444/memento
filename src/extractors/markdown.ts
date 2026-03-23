import { readFile } from "node:fs/promises";
import type { Extractor, ExtractorResult } from "./interface.js";

export class MarkdownExtractor implements Extractor {
  name = "markdown";

  supports(input: string): boolean {
    return input.endsWith(".md");
  }

  async extract(input: string): Promise<ExtractorResult> {
    const raw = await readFile(input, "utf-8");

    let body = raw;
    let title: string | undefined;
    let author: string | undefined;

    // Parse YAML frontmatter if present
    if (raw.startsWith("---")) {
      const endIndex = raw.indexOf("---", 3);
      if (endIndex !== -1) {
        const frontmatter = raw.slice(3, endIndex).trim();
        body = raw.slice(endIndex + 3).trim();

        for (const line of frontmatter.split("\n")) {
          const colonIdx = line.indexOf(":");
          if (colonIdx === -1) continue;
          const key = line.slice(0, colonIdx).trim().toLowerCase();
          const value = line
            .slice(colonIdx + 1)
            .trim()
            .replace(/^["']|["']$/g, "");
          if (key === "title") title = value;
          if (key === "author") author = value;
        }
      }
    }

    // Extract first heading as title if not found in frontmatter
    if (!title) {
      const headingMatch = body.match(/^#{1,6}\s+(.+)$/m);
      if (headingMatch) {
        title = headingMatch[1].trim();
      }
    }

    // Extract all headings as summary
    const headings = body
      .split("\n")
      .filter((line) => /^#{1,6}\s+/.test(line))
      .map((line) => line.replace(/^#+\s+/, "").trim());

    const summary = headings.length > 0 ? `Headings: ${headings.join(", ")}` : undefined;

    const text = summary ? `${summary}\n\n${body}` : body;

    return {
      text,
      metadata: {
        title,
        author,
        format: "markdown",
      },
    };
  }
}
