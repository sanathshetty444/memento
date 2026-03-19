// Type declarations for optional dependencies that may not be installed.
// These are dynamically imported at runtime with proper error handling.
declare module "neo4j-driver" {
  const neo4j: any;
  export default neo4j;
  export const auth: any;
}

declare module "@google/generative-ai" {
  export class GoogleGenerativeAI {
    constructor(apiKey: string);
    getGenerativeModel(config: { model: string }): any;
  }
}

declare module "openai" {
  export default class OpenAI {
    constructor(config: { apiKey: string });
    embeddings: {
      create(params: any): Promise<any>;
    };
  }
}
