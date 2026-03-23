export interface ExtractorResult {
  text: string;
  metadata?: {
    title?: string;
    author?: string;
    sourceUrl?: string;
    format: string;
  };
}

export interface Extractor {
  name: string;
  supports(input: string): boolean;
  extract(input: string): Promise<ExtractorResult>;
}
