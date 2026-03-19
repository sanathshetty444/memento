import type { EmbeddingProvider } from "./interface.js";

export class GeminiEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions = 768;
  readonly modelName = "text-embedding-004";
  private apiKey: string;
  private client: any = null;

  constructor(config: { apiKey: string }) {
    this.apiKey = config.apiKey;
  }

  async embed(text: string): Promise<number[]> {
    const client = await this.getClient();
    const model = client.getGenerativeModel({ model: this.modelName });
    const result = await model.embedContent(text);
    return result.embedding.values;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const client = await this.getClient();
    const model = client.getGenerativeModel({ model: this.modelName });
    const result = await model.batchEmbedContents({
      requests: texts.map((text) => ({
        content: { parts: [{ text }], role: "user" },
      })),
    });
    return result.embeddings.map((e: any) => e.values);
  }

  private async getClient(): Promise<any> {
    if (this.client) return this.client;

    try {
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      this.client = new GoogleGenerativeAI(this.apiKey);
      return this.client;
    } catch {
      throw new Error(
        "@google/generative-ai is not installed. Install it with: npm install @google/generative-ai",
      );
    }
  }
}
