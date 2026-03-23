/**
 * Profile MCP tool — view or regenerate a user profile showing coding patterns,
 * preferred languages, frequently modified files, and decision history.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MemoryManager } from "../memory/memory-manager.js";
import { generateProfile, saveProfile } from "../memory/profile.js";
import type { UserProfile } from "../memory/profile.js";

/**
 * Format a UserProfile into a readable markdown string.
 */
function formatProfile(profile: UserProfile): string {
  const lines: string[] = [];

  lines.push(`## User Profile: ${profile.namespace}`);
  lines.push(`_Generated: ${profile.generatedAt}_`);
  lines.push("");

  // Stats
  lines.push("### Stats");
  lines.push(`- **Total memories**: ${profile.stats.totalMemories}`);
  lines.push(`- **Sessions**: ${profile.stats.sessionsCount}`);
  lines.push(`- **Avg entries/session**: ${profile.stats.avgEntriesPerSession}`);
  lines.push(`- **Oldest memory**: ${profile.stats.oldestMemory}`);
  lines.push(`- **Newest memory**: ${profile.stats.newestMemory}`);
  lines.push("");

  // Top Tags
  if (profile.patterns.topTags.length > 0) {
    lines.push("### Top Tags");
    for (const t of profile.patterns.topTags) {
      lines.push(`- ${t.tag}: ${t.count} (${t.percentage}%)`);
    }
    lines.push("");
  }

  // Preferred Languages
  if (profile.patterns.preferredLanguages.length > 0) {
    lines.push("### Preferred Languages");
    lines.push(profile.patterns.preferredLanguages.join(", "));
    lines.push("");
  }

  // Top Files
  if (profile.patterns.topFiles.length > 0) {
    lines.push("### Frequently Referenced Files");
    for (const f of profile.patterns.topFiles) {
      lines.push(`- ${f.path} (${f.count})`);
    }
    lines.push("");
  }

  // Top Functions
  if (profile.patterns.topFunctions.length > 0) {
    lines.push("### Frequently Referenced Functions");
    for (const f of profile.patterns.topFunctions) {
      lines.push(`- ${f.name} (${f.count})`);
    }
    lines.push("");
  }

  // Common Packages
  if (profile.patterns.commonPackages.length > 0) {
    lines.push("### Common Packages");
    lines.push(profile.patterns.commonPackages.join(", "));
    lines.push("");
  }

  // Decision History
  if (profile.decisionSummary.length > 0) {
    lines.push("### Recent Decisions");
    for (const d of profile.decisionSummary) {
      lines.push(`- ${d}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function registerProfileTool(server: McpServer, manager: MemoryManager) {
  server.tool(
    "memory_profile",
    "View or regenerate your user profile — shows coding patterns, preferred languages, frequently modified files, and decision history",
    {
      namespace: z.string().optional().describe("Project namespace (auto-detected if omitted)"),
      regenerate: z
        .boolean()
        .optional()
        .default(false)
        .describe("If true, regenerate profile from scratch instead of using cached version"),
    },
    async (args) => {
      // Try to load existing profile first (unless regenerate requested)
      if (!args.regenerate) {
        try {
          const results = await manager.recall({
            query: "__profile__",
            namespace: args.namespace,
            limit: 1,
          });

          if (results.length > 0) {
            const entry = results[0].entry;
            if (entry.content.startsWith("__profile__")) {
              const jsonStr = entry.content.slice("__profile__\n".length);
              const cached = JSON.parse(jsonStr) as UserProfile;
              return {
                content: [
                  {
                    type: "text" as const,
                    text:
                      formatProfile(cached) +
                      "\n_Cached profile. Use `regenerate: true` to refresh._",
                  },
                ],
              };
            }
          }
        } catch {
          // Fall through to regenerate
        }
      }

      // Generate fresh profile
      const profile = await generateProfile(manager, args.namespace);

      if (profile.stats.totalMemories === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No memory entries found — cannot generate a profile yet.",
            },
          ],
        };
      }

      // Save for future use
      await saveProfile(manager, profile);

      return {
        content: [
          {
            type: "text" as const,
            text: formatProfile(profile),
          },
        ],
      };
    },
  );
}
