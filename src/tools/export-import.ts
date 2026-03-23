import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MemoryManager } from "../memory/memory-manager.js";
import type { MemoryEntry } from "../memory/types.js";
import { MAX_LIMIT } from "../memory/types.js";

/**
 * Fetch all entries from a namespace by paginating through the list.
 */
async function fetchAllEntries(manager: MemoryManager, namespace?: string): Promise<MemoryEntry[]> {
  const allEntries: MemoryEntry[] = [];
  let offset = 0;

  while (true) {
    const batch = await manager.list({
      namespace,
      limit: MAX_LIMIT,
      offset,
    });

    if (batch.length === 0) break;
    allEntries.push(...batch);
    offset += batch.length;
    if (batch.length < MAX_LIMIT) break;
  }

  return allEntries;
}

/**
 * Format entries as Markdown.
 * Each entry becomes a section with heading (summary), metadata table, and content.
 */
function formatMarkdown(entries: Omit<MemoryEntry, "embedding">[]): string {
  return entries
    .map((entry) => {
      const heading = entry.metadata.summary || entry.id;
      const meta = [
        "| Field | Value |",
        "| --- | --- |",
        `| ID | ${entry.id} |`,
        `| Timestamp | ${entry.metadata.timestamp || ""} |`,
        `| Tags | ${(entry.metadata.tags ?? []).join(", ")} |`,
        `| Source | ${entry.metadata.source || ""} |`,
        `| Namespace | ${entry.metadata.namespace || ""} |`,
      ].join("\n");

      return `## ${heading}\n\n${meta}\n\n${entry.content}`;
    })
    .join("\n\n---\n\n");
}

/**
 * Escape a value for CSV output. Wraps in quotes if it contains commas, quotes, or newlines.
 */
function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Format entries as CSV.
 * Columns: id, timestamp, tags, source, summary, content (first 200 chars).
 */
function formatCsv(entries: Omit<MemoryEntry, "embedding">[]): string {
  const header = "id,timestamp,tags,source,summary,content";
  const rows = entries.map((entry) => {
    const id = csvEscape(entry.id);
    const timestamp = csvEscape(entry.metadata.timestamp || "");
    const tags = csvEscape((entry.metadata.tags ?? []).join(";"));
    const source = csvEscape(entry.metadata.source || "");
    const summary = csvEscape(entry.metadata.summary || "");
    const content = csvEscape(entry.content.slice(0, 200));
    return `${id},${timestamp},${tags},${source},${summary},${content}`;
  });

  return [header, ...rows].join("\n");
}

export function registerExportTool(server: McpServer, manager: MemoryManager) {
  server.tool(
    "memory_export",
    "Export all memories from a namespace as JSONL, JSON, Markdown, or CSV (without embeddings to keep size down)",
    {
      namespace: z.string().optional().describe("Project namespace (auto-detected if omitted)"),
      format: z
        .enum(["jsonl", "json", "markdown", "csv"])
        .default("jsonl")
        .describe("Export format: jsonl, json, markdown, or csv"),
    },
    async (args) => {
      const allEntries = await fetchAllEntries(manager, args.namespace);

      // Strip embeddings to keep export size down
      const stripped = allEntries.map(({ embedding: _embedding, ...rest }) => rest);

      let exportData: string;
      switch (args.format) {
        case "jsonl":
          exportData = stripped.map((entry) => JSON.stringify(entry)).join("\n");
          break;
        case "json":
          exportData = JSON.stringify(stripped, null, 2);
          break;
        case "markdown":
          exportData = formatMarkdown(stripped);
          break;
        case "csv":
          exportData = formatCsv(stripped);
          break;
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Exported ${allEntries.length} ${allEntries.length === 1 ? "entry" : "entries"} (format: ${args.format})\n\n${exportData}`,
          },
        ],
      };
    },
  );
}

/**
 * Parse a CSV line handling quoted fields.
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

export function registerImportTool(server: McpServer, manager: MemoryManager) {
  server.tool(
    "memory_import",
    "Import memories from text content in various formats",
    {
      content: z.string().describe("The raw text content to import"),
      format: z
        .enum(["jsonl", "json", "markdown", "text", "csv"])
        .describe("Format of the input content"),
      namespace: z.string().optional().describe("Project namespace (auto-detected if omitted)"),
      tags: z.array(z.string()).optional().describe("Tags to apply to all imported entries"),
    },
    async (args) => {
      const entries: string[] = [];

      switch (args.format) {
        case "jsonl": {
          const lines = args.content.split("\n").filter((l) => l.trim());
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              const text = parsed.content || parsed.text || JSON.stringify(parsed);
              entries.push(text);
            } catch {
              // skip malformed lines
            }
          }
          break;
        }

        case "json": {
          try {
            const parsed = JSON.parse(args.content);
            const arr = Array.isArray(parsed) ? parsed : [parsed];
            for (const item of arr) {
              const text = item.content || item.text || JSON.stringify(item);
              entries.push(text);
            }
          } catch {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "Failed to parse JSON content",
                },
              ],
            };
          }
          break;
        }

        case "markdown": {
          // Split on ## or # headings
          const sections = args.content.split(/^(?=#{1,2} )/m);
          for (const section of sections) {
            const trimmed = section.trim();
            if (trimmed) {
              entries.push(trimmed);
            }
          }
          break;
        }

        case "text": {
          const paragraphs = args.content.split(/\n\n+/);
          for (const para of paragraphs) {
            const trimmed = para.trim();
            if (trimmed) {
              entries.push(trimmed);
            }
          }
          break;
        }

        case "csv": {
          const lines = args.content.split("\n").filter((l) => l.trim());
          if (lines.length < 2) break; // need at least header + 1 row

          const header = parseCsvLine(lines[0]);
          const contentIdx = header.findIndex((h) => h.trim().toLowerCase() === "content");
          // Fall back to last column if no "content" header
          const colIdx = contentIdx >= 0 ? contentIdx : header.length - 1;

          for (let i = 1; i < lines.length; i++) {
            const fields = parseCsvLine(lines[i]);
            const text = (fields[colIdx] || "").trim();
            if (text) {
              entries.push(text);
            }
          }
          break;
        }
      }

      // Import each entry through the full pipeline via manager.save()
      let imported = 0;
      for (const text of entries) {
        try {
          await manager.save({
            content: text,
            namespace: args.namespace,
            tags: args.tags,
            source: "import",
          });
          imported++;
        } catch {
          // skip entries that fail to save (e.g. dedup)
        }
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Imported ${imported} of ${entries.length} ${entries.length === 1 ? "entry" : "entries"} (format: ${args.format})`,
          },
        ],
      };
    },
  );
}
