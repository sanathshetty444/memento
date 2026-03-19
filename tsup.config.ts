import { defineConfig } from "tsup";

export default defineConfig({
  entry: { browser: "src/browser.ts" },
  format: ["esm"],
  dts: true,
  outDir: "dist",
  target: "es2022",
  platform: "browser",
  external: [
    "node:crypto",
    "node:fs",
    "node:path",
    "node:os",
    "chromadb",
    "chromadb-default-embed",
    "@xenova/transformers",
    "@google/generative-ai",
    "openai",
    "neo4j-driver",
    "@modelcontextprotocol/sdk",
  ],
  noExternal: ["idb"],
  clean: false,
  treeshake: true,
});
