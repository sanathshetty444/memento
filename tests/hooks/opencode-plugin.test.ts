import { describe, it, expect } from "vitest";
import { generatePluginSource } from "../../src/hooks/opencode-plugin.js";

describe("generatePluginSource", () => {
  it("returns valid JS string with worker path substituted", () => {
    const source = generatePluginSource("/path/to/queue-worker.js");
    expect(source).toContain("/path/to/queue-worker.js");
    expect(source).not.toContain("__WORKER_PATH__");
    expect(source).toContain("export default function MementoCapture");
  });

  it("includes tool.execute.after hook", () => {
    const source = generatePluginSource("/worker.js");
    expect(source).toContain("tool.execute.after");
  });

  it("includes session.idle hook with flush guard", () => {
    const source = generatePluginSource("/worker.js");
    expect(source).toContain("session.idle");
    expect(source).toContain("flushing");
  });

  it("includes denylist filtering", () => {
    const source = generatePluginSource("/worker.js");
    expect(source).toContain("DENYLIST");
    expect(source).toContain("memory_");
  });

  it("targets ~/.claude-memory/ data directory", () => {
    const source = generatePluginSource("/worker.js");
    expect(source).toContain(".claude-memory");
    expect(source).toContain("capture-queue.jsonl");
  });
});
