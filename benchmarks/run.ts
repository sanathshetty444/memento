/**
 * Memento Benchmark Runner
 *
 * Tests ingestion speed, search latency, and relevance accuracy
 * against a running Memento server.
 *
 * Usage: npx tsx benchmarks/run.ts
 */

import { MementoProvider } from "./memento-provider.js";

// ── Configuration ───────────────────────────────────────────────

const BASE_URL = process.env.MEMENTO_URL ?? "http://127.0.0.1:21476";
const INGESTION_SIZES = [10, 100, 1000];
const SEARCH_SIZES = [10, 100, 1000];

// ── Test Data ───────────────────────────────────────────────────

const TOPICS = [
  "JavaScript closures and lexical scoping",
  "React server components architecture",
  "PostgreSQL query optimization with indexes",
  "Docker multi-stage build patterns",
  "Kubernetes pod autoscaling strategies",
  "TypeScript generic constraints and inference",
  "Redis caching strategies for web apps",
  "GraphQL schema design best practices",
  "CI/CD pipeline with GitHub Actions",
  "WebSocket real-time communication patterns",
  "Node.js event loop and async patterns",
  "CSS Grid layout techniques for dashboards",
  "Python data pipeline with pandas",
  "Rust ownership and borrowing rules",
  "AWS Lambda cold start optimization",
  "MongoDB aggregation pipeline patterns",
  "Vue.js composition API reactive state",
  "Terraform infrastructure as code modules",
  "gRPC service mesh communication",
  "OAuth 2.0 PKCE flow implementation",
];

const ADJECTIVES = [
  "efficient",
  "scalable",
  "modern",
  "robust",
  "lightweight",
  "production-ready",
  "optimized",
  "secure",
  "flexible",
  "maintainable",
];

const ACTIONS = [
  "implemented",
  "configured",
  "debugged",
  "refactored",
  "deployed",
  "tested",
  "documented",
  "reviewed",
  "benchmarked",
  "migrated",
];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateSentence(index: number): string {
  const topic = TOPICS[index % TOPICS.length];
  const adj = randomItem(ADJECTIVES);
  const action = randomItem(ACTIONS);
  return `${action} a ${adj} solution for ${topic} — session note #${index}`;
}

/** Known fact pairs for relevance testing. */
const KNOWN_FACTS = [
  {
    content:
      "The project uses PostgreSQL 15 with pgvector extension for vector similarity search on embeddings.",
    query: "What database is used for vector search?",
    expectedKeyword: "PostgreSQL",
  },
  {
    content:
      "Authentication is handled via JWT tokens with RS256 signing, refresh tokens stored in httpOnly cookies.",
    query: "How does the auth system work?",
    expectedKeyword: "JWT",
  },
  {
    content:
      "The deployment pipeline uses GitHub Actions to build Docker images and deploy to AWS ECS Fargate.",
    query: "How are containers deployed?",
    expectedKeyword: "ECS Fargate",
  },
  {
    content:
      "Rate limiting is configured at 100 requests per minute per IP using a Redis-backed sliding window counter.",
    query: "What is the rate limit configuration?",
    expectedKeyword: "100 requests",
  },
  {
    content:
      "The frontend uses Next.js 14 with app router, server components by default, and Tailwind CSS for styling.",
    query: "What frontend framework is used?",
    expectedKeyword: "Next.js",
  },
];

// ── Benchmark Helpers ───────────────────────────────────────────

interface BenchmarkResult {
  name: string;
  n: number;
  totalMs: number;
  avgMs: number;
  opsPerSec: number;
}

interface RelevanceResult {
  query: string;
  expectedKeyword: string;
  foundInTop3: boolean;
  topResults: string[];
}

function formatTable(results: BenchmarkResult[]): string {
  const header = "| Benchmark | N | Total (ms) | Avg (ms) | Ops/sec |";
  const divider = "|---|---|---|---|---|";
  const rows = results.map(
    (r) =>
      `| ${r.name} | ${r.n} | ${r.totalMs.toFixed(1)} | ${r.avgMs.toFixed(2)} | ${r.opsPerSec.toFixed(1)} |`,
  );
  return [header, divider, ...rows].join("\n");
}

function formatRelevanceTable(results: RelevanceResult[]): string {
  const header = "| Query | Expected | Found in Top 3 |";
  const divider = "|---|---|---|";
  const rows = results.map(
    (r) =>
      `| ${r.query.slice(0, 45)}... | ${r.expectedKeyword} | ${r.foundInTop3 ? "YES" : "NO"} |`,
  );
  return [header, divider, ...rows].join("\n");
}

async function timeAsync(fn: () => Promise<void>): Promise<number> {
  const start = performance.now();
  await fn();
  return performance.now() - start;
}

// ── Benchmarks ──────────────────────────────────────────────────

async function benchmarkIngestion(provider: MementoProvider, n: number): Promise<BenchmarkResult> {
  await provider.reset();

  const totalMs = await timeAsync(async () => {
    for (let i = 0; i < n; i++) {
      await provider.addMemory(generateSentence(i), {
        tags: ["benchmark", `batch-${n}`],
      });
    }
  });

  return {
    name: "Ingestion",
    n,
    totalMs,
    avgMs: totalMs / n,
    opsPerSec: (n / totalMs) * 1000,
  };
}

async function benchmarkSearch(provider: MementoProvider, n: number): Promise<BenchmarkResult> {
  // Ensure memories are populated
  await provider.reset();
  for (let i = 0; i < n; i++) {
    await provider.addMemory(generateSentence(i), {
      tags: ["benchmark", `search-${n}`],
    });
  }

  const queries = [
    "closures and scoping in JavaScript",
    "container deployment pipeline",
    "database query performance",
    "real-time communication",
    "caching strategy",
  ];

  const numQueries = queries.length;
  const totalMs = await timeAsync(async () => {
    for (const query of queries) {
      await provider.searchMemory(query, 5);
    }
  });

  return {
    name: "Search",
    n,
    totalMs,
    avgMs: totalMs / numQueries,
    opsPerSec: (numQueries / totalMs) * 1000,
  };
}

async function benchmarkRelevance(provider: MementoProvider): Promise<RelevanceResult[]> {
  await provider.reset();

  // Seed with known facts plus noise
  for (const fact of KNOWN_FACTS) {
    await provider.addMemory(fact.content, { tags: ["benchmark", "known-fact"] });
  }

  // Add noise memories
  for (let i = 0; i < 50; i++) {
    await provider.addMemory(generateSentence(i), { tags: ["benchmark", "noise"] });
  }

  // Query for each known fact
  const results: RelevanceResult[] = [];
  for (const fact of KNOWN_FACTS) {
    const searchResults = await provider.searchMemory(fact.query, 3);
    const topContents = searchResults.map((r) => r.content);
    const foundInTop3 = topContents.some((c) => c.includes(fact.expectedKeyword));

    results.push({
      query: fact.query,
      expectedKeyword: fact.expectedKeyword,
      foundInTop3,
      topResults: topContents.map((c) => c.slice(0, 80)),
    });
  }

  return results;
}

// ── Main ────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const provider = new MementoProvider(BASE_URL);

  console.log("Memento Benchmark Runner");
  console.log(`Server: ${BASE_URL}`);
  console.log("=".repeat(60));

  // Health check
  try {
    await provider.healthCheck();
    console.log("Health check: OK\n");
  } catch (err) {
    console.error(`Health check FAILED. Is 'memento serve' running at ${BASE_URL}?`);
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }

  // ── Ingestion Benchmark ─────────────────────────────────────
  console.log("--- Ingestion Benchmark ---\n");
  const ingestionResults: BenchmarkResult[] = [];
  for (const n of INGESTION_SIZES) {
    process.stdout.write(`  Ingesting ${n} memories...`);
    const result = await benchmarkIngestion(provider, n);
    ingestionResults.push(result);
    console.log(` ${result.totalMs.toFixed(0)}ms`);
  }
  console.log();
  console.log(formatTable(ingestionResults));
  console.log();

  // ── Search Benchmark ────────────────────────────────────────
  console.log("--- Search Benchmark (5 queries per run) ---\n");
  const searchResults: BenchmarkResult[] = [];
  for (const n of SEARCH_SIZES) {
    process.stdout.write(`  Searching over ${n} memories...`);
    const result = await benchmarkSearch(provider, n);
    searchResults.push(result);
    console.log(` ${result.totalMs.toFixed(0)}ms`);
  }
  console.log();
  console.log(formatTable(searchResults));
  console.log();

  // ── Relevance Benchmark ─────────────────────────────────────
  console.log("--- Relevance Benchmark (5 known facts + 50 noise) ---\n");
  const relevanceResults = await benchmarkRelevance(provider);
  console.log(formatRelevanceTable(relevanceResults));

  const hitRate = relevanceResults.filter((r) => r.foundInTop3).length / relevanceResults.length;
  console.log(`\nRelevance hit rate (top-3): ${(hitRate * 100).toFixed(0)}%`);

  // ── Cleanup ─────────────────────────────────────────────────
  console.log("\nCleaning up benchmark data...");
  await provider.reset();
  console.log("Done.");
}

main().catch((err) => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});
