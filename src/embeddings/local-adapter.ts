import type { EmbeddingProvider } from "./interface.js";

export interface LocalEmbeddingOptions {
  modelPath?: string;
}

export class LocalEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions = 384;
  readonly modelName = "all-MiniLM-L6-v2";

  private pipeline: any = null;
  private pipelinePromise: Promise<any> | null = null;
  private readonly modelPath?: string;

  constructor(options?: LocalEmbeddingOptions) {
    this.modelPath = options?.modelPath;
  }

  private async getPipeline(): Promise<any> {
    if (this.pipeline) return this.pipeline;
    if (this.pipelinePromise) return this.pipelinePromise;

    this.pipelinePromise = (async () => {
      const { pipeline, env } = await import("@xenova/transformers");

      if (this.modelPath) {
        env.cacheDir = this.modelPath;
      }

      const extractor = await pipeline(
        "feature-extraction",
        "Xenova/all-MiniLM-L6-v2",
      );
      this.pipeline = extractor;
      return extractor;
    })();

    return this.pipelinePromise;
  }

  async embed(text: string): Promise<number[]> {
    const extractor = await this.getPipeline();
    const output = await extractor(text, { pooling: "mean", normalize: true });
    return Array.from(output.data as Float32Array);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    for (const text of texts) {
      results.push(await this.embed(text));
    }
    return results;
  }
}
