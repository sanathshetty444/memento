import type { EmbeddingProvider } from "./interface.js";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

export interface GeminiFetchOptions {
  apiKey: string;
  model?: string;
}

export class GeminiFetchEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions = 768;
  readonly modelName: string;
  private readonly apiKey: string;

  constructor(options: GeminiFetchOptions) {
    this.apiKey = options.apiKey;
    this.modelName = options.model ?? "text-embedding-004";
  }

  async embed(text: string): Promise<number[]> {
    const url = `${BASE_URL}/${this.modelName}:embedContent?key=${this.apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${this.modelName}`,
        content: { parts: [{ text }] },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Gemini embedding failed (${response.status} ${response.statusText}): ${body}`
      );
    }

    const data = await response.json();
    return data.embedding.values;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const url = `${BASE_URL}/${this.modelName}:batchEmbedContents?key=${this.apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: texts.map((text) => ({
          model: `models/${this.modelName}`,
          content: { parts: [{ text }] },
        })),
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Gemini batch embedding failed (${response.status} ${response.statusText}): ${body}`
      );
    }

    const data = await response.json();
    return data.embeddings.map((e: { values: number[] }) => e.values);
  }
}
