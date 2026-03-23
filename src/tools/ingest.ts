import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MemoryManager } from "../memory/memory-manager.js";
import { extractContent, getExtractor } from "../extractors/index.js";

export function registerIngestTool(server: McpServer, manager: MemoryManager) {
  server.tool(
    "memory_ingest",
    "Ingest content from a file path or URL — auto-detects format, extracts text, and saves as memory",
    {
      input: z.string().describe("File path or URL to ingest"),
      namespace: z.string().optional().describe("Project namespace (auto-detected if omitted)"),
      tags: z.array(z.string()).optional().describe("Semantic tags for the ingested content"),
    },
    async (args) => {
      const extractor = getExtractor(args.input);
      if (!extractor) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Unsupported format: ${args.input}. Supported: .md, .ts, .js, .py, .go, .rs, .java, .rb, .c, .cpp, .h, .pdf, .png, .jpg, .jpeg, .gif, .bmp, .webp, and http(s) URLs.`,
            },
          ],
          isError: true,
        };
      }

      let result;
      try {
        result = await extractContent(args.input);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Extraction failed: ${message}`,
            },
          ],
          isError: true,
        };
      }

      const format = result.metadata?.format ?? extractor.name;
      const title = result.metadata?.title;

      // Build content with metadata header
      const parts: string[] = [];
      if (title) parts.push(`Title: ${title}`);
      if (result.metadata?.author) parts.push(`Author: ${result.metadata.author}`);
      if (result.metadata?.sourceUrl) parts.push(`Source: ${result.metadata.sourceUrl}`);
      parts.push(`Format: ${format}`);
      parts.push("");
      parts.push(result.text);

      const content = parts.join("\n");

      const entries = await manager.save({
        content,
        tags: args.tags,
        namespace: args.namespace,
        source: "explicit",
        files: result.metadata?.sourceUrl ? undefined : [args.input],
        priority: "normal",
      });

      return {
        content: [
          {
            type: "text" as const,
            text: [
              `Ingested: ${args.input}`,
              `Format: ${format}`,
              `Text length: ${result.text.length} chars`,
              `Saved ${entries.length} memory ${entries.length === 1 ? "entry" : "entries"} (${entries.map((e) => e.id).join(", ")})`,
            ].join("\n"),
          },
        ],
      };
    },
  );
}
