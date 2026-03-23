import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MemoryManager } from "../memory/memory-manager.js";
import type { MemoryEntry } from "../memory/types.js";

export function registerSessionSummaryTool(server: McpServer, manager: MemoryManager) {
  server.tool(
    "memory_session_summary",
    "Combine memories from a session into a single high-importance summary",
    {
      sessionId: z
        .string()
        .optional()
        .describe("Specific session to summarize. If omitted, uses the most recent session."),
      namespace: z.string().optional().describe("Project namespace (auto-detected if omitted)"),
    },
    async (args) => {
      // Step 1: List all entries in the namespace (fetch a large batch)
      const allEntries = await manager.list({
        namespace: args.namespace,
        limit: 100,
      });

      if (allEntries.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No memory entries found in this namespace.",
            },
          ],
        };
      }

      // Step 2: Filter to matching sessionId, or find the most recent session
      let targetSessionId = args.sessionId;

      if (!targetSessionId) {
        // Find the most recent session by sorting entries by timestamp descending
        const sorted = [...allEntries].sort(
          (a, b) =>
            new Date(b.metadata.timestamp).getTime() - new Date(a.metadata.timestamp).getTime(),
        );
        // Find the first entry that has a sessionId
        const mostRecent = sorted.find((e) => e.metadata.sessionId);
        if (!mostRecent?.metadata.sessionId) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No entries with sessionId found. Cannot determine session to summarize.",
              },
            ],
          };
        }
        targetSessionId = mostRecent.metadata.sessionId;
      }

      // Filter entries belonging to the target session
      const sessionEntries = allEntries.filter(
        (e: MemoryEntry) => e.metadata.sessionId === targetSessionId,
      );

      if (sessionEntries.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No entries found for session "${targetSessionId}".`,
            },
          ],
        };
      }

      // Step 3: Sort by timestamp ascending
      sessionEntries.sort(
        (a: MemoryEntry, b: MemoryEntry) =>
          new Date(a.metadata.timestamp).getTime() - new Date(b.metadata.timestamp).getTime(),
      );

      // Step 4: Build summary — first 100 chars of each entry, joined by newlines, capped at 2000 chars
      const summaryParts: string[] = [];
      let totalLength = 0;
      const MAX_SUMMARY_LENGTH = 2000;
      const PER_ENTRY_LENGTH = 100;

      for (const entry of sessionEntries) {
        const snippet = entry.content.slice(0, PER_ENTRY_LENGTH).trim();
        if (totalLength + snippet.length + 1 > MAX_SUMMARY_LENGTH) {
          break;
        }
        summaryParts.push(snippet);
        totalLength += snippet.length + 1; // +1 for newline
      }

      const summaryContent = `Session summary (${targetSessionId}):\n${summaryParts.join("\n")}`;

      // Step 5: Save as a high-importance memory
      await manager.save({
        content: summaryContent,
        tags: ["conversation", "decision"],
        namespace: args.namespace,
        source: "explicit",
        priority: "high",
        sessionId: targetSessionId,
      });

      // Step 6: Return summary and count
      return {
        content: [
          {
            type: "text" as const,
            text: `Summarized ${sessionEntries.length} memories from session "${targetSessionId}".\n\n${summaryContent}`,
          },
        ],
      };
    },
  );
}
