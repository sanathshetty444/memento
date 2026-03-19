/**
 * Sensitive data redaction before storage.
 * Strips secrets, keys, tokens, and other sensitive patterns from content.
 */

interface RedactionPattern {
  name: string;
  pattern: RegExp;
}

const REDACTION_PATTERNS: RedactionPattern[] = [
  {
    name: "AWS_KEY",
    pattern: /AKIA[0-9A-Z]{16}/g,
  },
  {
    name: "API_KEY",
    pattern: /\b(sk-[a-zA-Z0-9]{20,}|key-[a-zA-Z0-9]{20,})\b/g,
  },
  {
    name: "BEARER_TOKEN",
    pattern: /Bearer\s+[a-zA-Z0-9\-._~+/]+=*/g,
  },
  {
    name: "PASSWORD_IN_URL",
    pattern: /:\/\/[^:\s]+:[^@\s]+@/g,
  },
  {
    name: "BASE64_BLOCK",
    pattern: /[A-Za-z0-9+/]{50,}={0,2}/g,
  },
  {
    name: "ENV_SECRET",
    pattern:
      /(?:^|\n)\s*(?:export\s+)?(?:[A-Z_]*(?:SECRET|PASSWORD|TOKEN|KEY|CREDENTIAL|API_KEY|ACCESS_KEY|PRIVATE)[A-Z_]*)\s*=\s*['"]?[^\s'"]+['"]?/gi,
  },
];

const EXCLUDED_FILE_PATTERNS: string[] = [
  ".env",
  ".env.*",
  ".env.local",
  ".env.production",
  ".env.development",
  "credentials",
  "credentials.*",
  "*credentials*",
  "*.pem",
  "*.key",
];

/**
 * Check whether a file path matches any exclusion pattern.
 */
export function shouldExcludeFile(filePath: string): boolean {
  const basename = filePath.split("/").pop() ?? filePath;
  const lower = basename.toLowerCase();

  for (const pattern of EXCLUDED_FILE_PATTERNS) {
    const lowerPattern = pattern.toLowerCase();

    if (lowerPattern.startsWith("*") && lowerPattern.endsWith("*")) {
      // *credentials* — substring match
      const inner = lowerPattern.slice(1, -1);
      if (lower.includes(inner)) return true;
    } else if (lowerPattern.endsWith(".*")) {
      // .env.* — prefix match
      const prefix = lowerPattern.slice(0, -2);
      if (lower === prefix || lower.startsWith(prefix + ".")) return true;
    } else if (lowerPattern.startsWith("*.")) {
      // *.pem — extension match
      const ext = lowerPattern.slice(1);
      if (lower.endsWith(ext)) return true;
    } else {
      // exact match
      if (lower === lowerPattern) return true;
    }
  }

  return false;
}

/**
 * Redact sensitive data from content, replacing matches with [REDACTED:<type>].
 * Optionally accepts additional regex patterns (tagged as "CUSTOM").
 */
export function redact(content: string, extraPatterns?: RegExp[]): string {
  let result = content;

  for (const { name, pattern } of REDACTION_PATTERNS) {
    // Reset lastIndex for global regexes
    pattern.lastIndex = 0;
    result = result.replace(pattern, `[REDACTED:${name}]`);
  }

  if (extraPatterns) {
    for (const extra of extraPatterns) {
      extra.lastIndex = 0;
      result = result.replace(extra, "[REDACTED:CUSTOM]");
    }
  }

  return result;
}
