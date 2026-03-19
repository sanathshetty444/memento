import type { EmbeddingProvider } from "./interface.js";

export interface EmbeddingConfig {
  type: string;
  local?: { modelPath?: string };
  gemini?: { apiKey: string };
  openai?: { apiKey: string };
}

export async function createEmbeddingProvider(
  config: EmbeddingConfig,
): Promise<EmbeddingProvider> {
  if (config.type === "local") {
    const { LocalEmbeddingProvider } = await import("./local-adapter.js");
    return new LocalEmbeddingProvider(config.local);
  }

  if (config.type === "gemini") {
    const { GeminiEmbeddingProvider } = await import("./gemini-adapter.js");
    return new GeminiEmbeddingProvider(
      config.gemini ?? { apiKey: process.env.GEMINI_API_KEY ?? "" },
    );
  }

  if (config.type === "openai") {
    const { OpenAIEmbeddingProvider } = await import("./openai-adapter.js");
    return new OpenAIEmbeddingProvider(
      config.openai ?? { apiKey: process.env.OPENAI_API_KEY ?? "" },
    );
  }

  throw new Error(`Unknown embedding type: ${config.type}`);
}

export type { EmbeddingProvider } from "./interface.js";
