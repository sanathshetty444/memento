/**
 * Heuristic auto-classification for memory entries.
 * Assigns semantic tags based on content pattern matching — no LLM required.
 */

import type { MemoryTag } from "./types.js";

interface TagRule {
  tag: MemoryTag;
  patterns: RegExp[];
}

const TAG_RULES: TagRule[] = [
  {
    tag: "code",
    patterns: [
      /```/,                                        // code fences
      /\.\b(ts|js|py|rs|go|java|rb|cpp|c|h|tsx|jsx|vue|svelte|css|html|sql|sh|yaml|yml|toml|json)\b/, // file extensions
      /\b(function|const|let|var|def|class|import|export|return|async|await)\s/,  // keywords / signatures
    ],
  },
  {
    tag: "error",
    patterns: [
      /\berror\b/i,
      /\bexception\b/i,
      /stack\s*trace/i,
      /Error:/,
      /TypeError/,
      /\bfailed\b/i,
    ],
  },
  {
    tag: "decision",
    patterns: [
      /\bdecided\b/i,
      /\bchose\b/i,
      /\bbecause\b/i,
      /\btrade-off\b/i,
      /\binstead\s+of\b/i,
      /we['']ll\s+go\s+with/i,
      /\bapproach\b/i,
    ],
  },
  {
    tag: "architecture",
    patterns: [
      /\bcomponent\b/i,
      /\bmodule\b/i,
      /\bservice\b/i,
      /\blayer\b/i,
      /\binterface\b/i,
      /\bpattern\b/i,
      /\barchitecture\b/i,
      /\bsystem\s+design\b/i,
    ],
  },
  {
    tag: "config",
    patterns: [
      /\$[A-Z_]+/,                  // env vars like $HOME
      /process\.env\b/,             // Node env access
      /\.(json|yaml|yml|env)\b.*config/i,  // config file refs
      /config\b.*\.(json|yaml|yml|env)/i,  // config file refs (reversed)
      /\bsetting\b/i,
    ],
  },
  {
    tag: "dependency",
    patterns: [
      /@[\w-]+\/[\w-]+/,            // scoped packages @scope/pkg
      /\^\d+\.\d+\.\d+/,           // version numbers ^1.2.3
      /\binstall\b/i,
      /\bupgrade\b/i,
      /\bnpm\b/,
      /\byarn\b/,
    ],
  },
  {
    tag: "todo",
    patterns: [
      /\bTODO\b/,
      /\bFIXME\b/,
      /\bHACK\b/,
      /\bneed\s+to\b/i,
      /\bshould\b/i,
      /\bmust\b/i,
    ],
  },
];

/**
 * Automatically assign semantic tags to content based on heuristic pattern matching.
 * Returns at least one tag — falls back to "conversation" if nothing else matches.
 */
export function autoTag(content: string): MemoryTag[] {
  const matched: MemoryTag[] = [];

  for (const rule of TAG_RULES) {
    const hits = rule.patterns.some((p) => p.test(content));
    if (hits) {
      matched.push(rule.tag);
    }
  }

  if (matched.length === 0) {
    matched.push("conversation");
  }

  return matched;
}
