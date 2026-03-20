import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface StoreConfig {
  type: "local" | "chromadb" | "neo4j";
  localPath: string;
  chromaPath: string;
  neo4jUrl?: string;
  neo4jUser?: string;
  neo4jPassword?: string;
}

export interface EmbeddingsConfig {
  provider: "local" | "openai" | "gemini";
  model: string;
  dimensions: number;
  openaiApiKey?: string;
  geminiApiKey?: string;
}

export interface CaptureConfig {
  autoCapture: boolean;
  hooks: ("post_tool_use" | "stop")[];
  redactSecrets: boolean;
  maxContentLength: number;
  queueFlushIntervalMs: number;
}

export interface MemoryConfig {
  defaultNamespace: string;
  defaultLimit: number;
  maxLimit: number;
  deduplicationThreshold: number;
  chunkSize: number;
  chunkOverlap: number;
}

export interface MementoConfig {
  store: StoreConfig;
  embeddings: EmbeddingsConfig;
  capture: CaptureConfig;
  memory: MemoryConfig;
  dataDir: string;
}

const DEFAULTS: MementoConfig = {
  store: {
    type: "local",
    localPath: join(getDataDir(), "store"),
    chromaPath: join(getDataDir(), "chromadb"),
  },
  embeddings: {
    provider: "local",
    model: "Xenova/all-MiniLM-L6-v2",
    dimensions: 384,
  },
  capture: {
    autoCapture: true,
    hooks: ["post_tool_use", "stop"],
    redactSecrets: true,
    maxContentLength: 4096,
    queueFlushIntervalMs: 5000,
  },
  memory: {
    defaultNamespace: "project",
    defaultLimit: 10,
    maxLimit: 100,
    deduplicationThreshold: 0.92,
    chunkSize: 500,
    chunkOverlap: 100,
  },
  dataDir: getDataDir(),
};

export function getDataDir(): string {
  const home = homedir();
  return join(home, ".claude-memory");
}

function deepMerge<T extends object>(base: T, override: Partial<T>): T {
  const result = { ...base };
  for (const key of Object.keys(override) as (keyof T)[]) {
    const val = override[key];
    if (
      val !== undefined &&
      val !== null &&
      typeof val === "object" &&
      !Array.isArray(val) &&
      typeof result[key] === "object" &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(
        result[key] as Record<string, unknown>,
        val as Record<string, unknown>,
      ) as T[keyof T];
    } else if (val !== undefined) {
      result[key] = val as T[keyof T];
    }
  }
  return result;
}

function loadConfigFile(): Partial<MementoConfig> {
  const configPath = join(getDataDir(), "config.json");
  try {
    const raw = readFileSync(configPath, "utf-8");
    return JSON.parse(raw) as Partial<MementoConfig>;
  } catch {
    return {};
  }
}

function loadEnvOverrides(): Partial<MementoConfig> {
  const overrides: Partial<MementoConfig> = {};

  const storeType = process.env.MEMENTO_STORE_TYPE;
  const localPath = process.env.MEMENTO_LOCAL_PATH;
  const chromaPath = process.env.MEMENTO_CHROMA_PATH;
  const neo4jUrl = process.env.MEMENTO_NEO4J_URL;
  const neo4jUser = process.env.MEMENTO_NEO4J_USER;
  const neo4jPassword = process.env.MEMENTO_NEO4J_PASSWORD;

  if (storeType || localPath || chromaPath || neo4jUrl) {
    overrides.store = {} as StoreConfig;
    if (storeType) overrides.store.type = storeType as StoreConfig["type"];
    if (localPath) overrides.store.localPath = localPath;
    if (chromaPath) overrides.store.chromaPath = chromaPath;
    if (neo4jUrl) overrides.store.neo4jUrl = neo4jUrl;
    if (neo4jUser) overrides.store.neo4jUser = neo4jUser;
    if (neo4jPassword) overrides.store.neo4jPassword = neo4jPassword;
  }

  const embProvider = process.env.MEMENTO_EMBEDDING_PROVIDER;
  const embModel = process.env.MEMENTO_EMBEDDING_MODEL;
  const embDimensions = process.env.MEMENTO_EMBEDDING_DIMENSIONS;
  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (embProvider || embModel || embDimensions || openaiKey || geminiKey) {
    overrides.embeddings = {} as EmbeddingsConfig;
    if (embProvider) overrides.embeddings.provider = embProvider as EmbeddingsConfig["provider"];
    if (embModel) overrides.embeddings.model = embModel;
    if (embDimensions) overrides.embeddings.dimensions = parseInt(embDimensions, 10);
    if (openaiKey) overrides.embeddings.openaiApiKey = openaiKey;
    if (geminiKey) overrides.embeddings.geminiApiKey = geminiKey;
  }

  const autoCapture = process.env.MEMENTO_AUTO_CAPTURE;
  if (autoCapture !== undefined) {
    overrides.capture = { autoCapture: autoCapture === "true" } as CaptureConfig;
  }

  const dataDir = process.env.MEMENTO_DATA_DIR;
  if (dataDir) {
    overrides.dataDir = dataDir;
  }

  return overrides;
}

export function loadConfig(): MementoConfig {
  const fileConfig = loadConfigFile();
  const envConfig = loadEnvOverrides();

  // Priority: env vars > config file > defaults
  const merged = deepMerge(DEFAULTS, fileConfig);
  return deepMerge(merged, envConfig);
}
