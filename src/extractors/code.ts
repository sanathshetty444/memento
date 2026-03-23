import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import type { Extractor, ExtractorResult } from "./interface.js";

const SUPPORTED_EXTENSIONS = new Set([
  ".ts",
  ".js",
  ".py",
  ".go",
  ".rs",
  ".java",
  ".rb",
  ".c",
  ".cpp",
  ".h",
]);

/** Regex patterns to extract function/class definitions per language family */
const PATTERNS: Record<string, RegExp[]> = {
  ts: [
    /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/gm,
    /^(?:export\s+)?class\s+(\w+)/gm,
    /^(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s+)?\(/gm,
    /^(?:export\s+)?interface\s+(\w+)/gm,
    /^(?:export\s+)?type\s+(\w+)\s*=/gm,
  ],
  py: [/^def\s+(\w+)\s*\(/gm, /^class\s+(\w+)/gm, /^async\s+def\s+(\w+)\s*\(/gm],
  go: [/^func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)\s*\(/gm, /^type\s+(\w+)\s+struct/gm],
  rs: [
    /^(?:pub\s+)?fn\s+(\w+)/gm,
    /^(?:pub\s+)?struct\s+(\w+)/gm,
    /^(?:pub\s+)?enum\s+(\w+)/gm,
    /^(?:pub\s+)?trait\s+(\w+)/gm,
    /^impl(?:<[^>]*>)?\s+(\w+)/gm,
  ],
  java: [
    /(?:public|private|protected)?\s*(?:static\s+)?(?:[\w<>\[\]]+)\s+(\w+)\s*\(/gm,
    /(?:public|private|protected)?\s*(?:abstract\s+)?class\s+(\w+)/gm,
    /(?:public|private|protected)?\s*interface\s+(\w+)/gm,
  ],
  rb: [/^def\s+(\w+)/gm, /^class\s+(\w+)/gm, /^module\s+(\w+)/gm],
  c: [
    /^(?:[\w*]+\s+)+(\w+)\s*\([^)]*\)\s*\{/gm,
    /^typedef\s+struct\s+(\w+)/gm,
    /^struct\s+(\w+)\s*\{/gm,
  ],
};

// Map file extensions to pattern keys
const EXT_TO_LANG: Record<string, string> = {
  ".ts": "ts",
  ".js": "ts",
  ".py": "py",
  ".go": "go",
  ".rs": "rs",
  ".java": "java",
  ".rb": "rb",
  ".c": "c",
  ".cpp": "c",
  ".h": "c",
};

function extractDefinitions(content: string, lang: string): string[] {
  const patterns = PATTERNS[lang];
  if (!patterns) return [];

  const definitions: string[] = [];
  for (const pattern of patterns) {
    // Reset lastIndex for reusable regex
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      const name = match[1];
      if (name && !definitions.includes(name)) {
        definitions.push(name);
      }
    }
  }
  return definitions;
}

export class CodeExtractor implements Extractor {
  name = "code";

  supports(input: string): boolean {
    const ext = extname(input).toLowerCase();
    return SUPPORTED_EXTENSIONS.has(ext);
  }

  async extract(input: string): Promise<ExtractorResult> {
    const content = await readFile(input, "utf-8");
    const ext = extname(input).toLowerCase();
    const lang = EXT_TO_LANG[ext] ?? "ts";
    const filename = basename(input);

    const definitions = extractDefinitions(content, lang);
    const lineCount = content.split("\n").length;

    // Build structured output
    const parts: string[] = [];
    parts.push(`File: ${filename} (${lineCount} lines, ${ext.slice(1).toUpperCase()})`);

    if (definitions.length > 0) {
      parts.push(`Definitions: ${definitions.join(", ")}`);
    }

    parts.push("");
    parts.push(content);

    return {
      text: parts.join("\n"),
      metadata: {
        title: filename,
        format: ext.slice(1),
      },
    };
  }
}
