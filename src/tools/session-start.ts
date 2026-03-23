/**
 * SessionStart MCP tool — auto context injection at session start.
 * Recalls top-N relevant memories + processes pending queue entries from last session.
 * Returns formatted context bundle (project summary + recent decisions + relevant memories).
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MemoryManager } from "../memory/memory-manager.js";
import { processQueue } from "../hooks/queue-worker.js";
import { indexProject } from "../memory/indexer.js";
import type { UserProfile } from "../memory/profile.js";

export function registerSessionStartTool(server: McpServer, manager: MemoryManager) {
  server.tool(
    "memory_session_start",
    "Initialize a session by recalling recent context and processing pending memories from the last session. Call this at the start of every conversation.",
    {
      query: z.string().optional().describe("Optional query to focus recall on specific topics"),
      namespace: z.string().optional().describe("Project namespace (auto-detected if omitted)"),
      limit: z
        .number()
        .optional()
        .default(15)
        .describe("Maximum number of memories to recall (default 15)"),
    },
    async (args) => {
      const sections: string[] = [];

      // Phase 0: Auto-index project if not already indexed
      try {
        const indexResult = await indexProject(manager, { namespace: args.namespace });
        if (!indexResult.alreadyIndexed) {
          sections.push(
            `**Project Indexed**: ${indexResult.indexed.length} files scanned (${indexResult.indexed.join(", ")}).`,
          );
        }
      } catch {
        // Non-fatal — continue with session start even if indexing fails
      }

      // Phase 1: Process any pending queue entries from last session
      let queueProcessed = 0;
      try {
        queueProcessed = await processQueue();
      } catch {
        // Non-fatal — continue with recall even if queue processing fails
      }

      if (queueProcessed > 0) {
        sections.push(`**Queue**: Processed ${queueProcessed} pending entries from last session.`);
      }

      // Phase 1.5: Load existing profile for brief summary
      try {
        const profileResults = await manager.recall({
          query: "__profile__",
          namespace: args.namespace,
          limit: 1,
        });
        if (profileResults.length > 0) {
          const entry = profileResults[0].entry;
          if (entry.content.startsWith("__profile__")) {
            const jsonStr = entry.content.slice("__profile__\n".length);
            const profile = JSON.parse(jsonStr) as UserProfile;
            const tags = profile.patterns.topTags
              .slice(0, 5)
              .map((t) => t.tag)
              .join(", ");
            const langs = profile.patterns.preferredLanguages.slice(0, 5).join(", ");
            const profileLines: string[] = [];
            if (tags) profileLines.push(`Top tags: ${tags}`);
            if (langs) profileLines.push(`Languages: ${langs}`);
            if (profileLines.length > 0) {
              sections.push(`**Profile**: ${profileLines.join(" | ")}`);
            }
          }
        }
      } catch {
        // Non-fatal — continue without profile summary
      }

      // Phase 2: Recall recent decisions and architecture memories
      const decisionQuery = args.query ?? "recent decisions, architecture, important context";
      const results = await manager.recall({
        query: decisionQuery,
        namespace: args.namespace,
        limit: args.limit ?? 15,
      });

      if (results.length === 0) {
        sections.push("No memories found for this project yet.");
        return {
          content: [
            {
              type: "text" as const,
              text: sections.join("\n\n"),
            },
          ],
        };
      }

      // Phase 3: Group memories by category for structured output
      const decisions: string[] = [];
      const architecture: string[] = [];
      const errors: string[] = [];
      const recent: string[] = [];

      for (const r of results) {
        const entry = r.entry;
        const preview =
          entry.content.length > 300 ? entry.content.slice(0, 300) + "..." : entry.content;
        const line = `- [${entry.metadata.tags.join(", ") || "untagged"}] ${preview}`;

        if (entry.metadata.tags.includes("decision")) {
          decisions.push(line);
        } else if (entry.metadata.tags.includes("architecture")) {
          architecture.push(line);
        } else if (entry.metadata.tags.includes("error")) {
          errors.push(line);
        } else {
          recent.push(line);
        }
      }

      // Build formatted output
      if (decisions.length > 0) {
        sections.push(`**Decisions**:\n${decisions.join("\n")}`);
      }
      if (architecture.length > 0) {
        sections.push(`**Architecture**:\n${architecture.join("\n")}`);
      }
      if (errors.length > 0) {
        sections.push(`**Recent Errors**:\n${errors.join("\n")}`);
      }
      if (recent.length > 0) {
        sections.push(`**Other Context**:\n${recent.join("\n")}`);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `## Session Context (${results.length} memories)\n\n${sections.join("\n\n")}`,
          },
        ],
      };
    },
  );
}
