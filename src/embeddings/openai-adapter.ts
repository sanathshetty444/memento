import type { EmbeddingProvider } from "./interface.js";

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions = 1536;
  readonly modelName = "text-embedding-3-small";
  private apiKey: string;
  private client: any = null;

  constructor(config: { apiKey: string }) {
    this.apiKey = config.apiKey;
  }

  async embed(text: string): Promise<number[]> {
    const client = await this.getClient();
    const response = await client.embeddings.create({
      model: this.modelName,
      input: text,
    });
    return response.data[0].embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const client = await this.getClient();
    const response = await client.embeddings.create({
      model: this.modelName,
      input: texts,
    });
    return response.data
      .sort((a: any, b: any) => a.index - b.index)
      .map((item: any) => item.embedding);
  }

  private async getClient(): Promise<any> {
    if (this.client) return this.client;

    try {
      const { default: OpenAI } = await import("openai");
      this.client = new OpenAI({ apiKey: this.apiKey });
      return this.client;
    } catch {
      throw new Error(
        "openai is not installed. Install it with: npm install openai",
      );
    }
  }
}
