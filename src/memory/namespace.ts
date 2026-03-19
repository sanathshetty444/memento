/**
 * Namespace resolution for memory entries.
 * Determines the project namespace by walking up to the nearest git root.
 */

import path from "node:path";
import fs from "node:fs";

export { GLOBAL_NAMESPACE } from "./types.js";

/**
 * Resolve the project namespace from the given working directory.
 *
 * Walks upward from `cwd` looking for a `.git` directory.
 * - If found: returns the git root directory name.
 * - If not found: returns the `cwd` directory name.
 */
export function resolveNamespace(cwd?: string): string {
  const startDir = cwd ?? process.cwd();
  let current = path.resolve(startDir);

  while (true) {
    const gitDir = path.join(current, ".git");
    if (fs.existsSync(gitDir)) {
      return path.basename(current);
    }

    const parent = path.dirname(current);
    if (parent === current) {
      // Reached filesystem root without finding .git
      break;
    }
    current = parent;
  }

  // Fallback: use the starting directory name
  return path.basename(path.resolve(startDir));
}
