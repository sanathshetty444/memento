/**
 * Pure TypeScript HNSW (Hierarchical Navigable Small World) index.
 * Provides approximate nearest neighbor search with sub-10ms latency at 10K entries.
 * Optimized for 384-dimensional vectors (all-MiniLM-L6-v2).
 *
 * No native dependencies — portable across all platforms.
 */

import { cosineSimilarity } from "../memory/dedup.js";

/* ── Configuration ──────────────────────────────────────────────── */

export interface HNSWConfig {
  /** Max connections per node per layer (default: 16) */
  M: number;
  /** Size of dynamic candidate list during construction (default: 200) */
  efConstruction: number;
  /** Size of dynamic candidate list during search (default: 50) */
  efSearch: number;
  /** Max layers (default: computed from dataset size) */
  maxLevel: number;
}

const DEFAULT_CONFIG: HNSWConfig = {
  M: 16,
  efConstruction: 200,
  efSearch: 50,
  maxLevel: 16,
};

/* ── Node ───────────────────────────────────────────────────────── */

export interface HNSWNode {
  id: string;
  vector: number[];
  level: number;
  connections: Map<number, string[]>; // layer → neighbor IDs
}

/* ── Priority queue (max-heap by score) ─────────────────────────── */

interface Candidate {
  id: string;
  score: number;
}

/** Simple sorted candidate list — sufficient for the ef sizes we use. */
class CandidateList {
  private items: Candidate[] = [];

  get length(): number {
    return this.items.length;
  }

  /** Insert maintaining descending sort by score. */
  insert(c: Candidate): void {
    // Binary search for insertion position
    let lo = 0;
    let hi = this.items.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.items[mid].score > c.score) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    this.items.splice(lo, 0, c);
  }

  /** Best candidate (highest score). */
  best(): Candidate | undefined {
    return this.items[0];
  }

  /** Worst candidate (lowest score). */
  worst(): Candidate | undefined {
    return this.items[this.items.length - 1];
  }

  /** Remove and return the best candidate. */
  popBest(): Candidate | undefined {
    return this.items.shift();
  }

  /** Trim to at most k items (keep highest scores). */
  trimTo(k: number): void {
    if (this.items.length > k) {
      this.items.length = k;
    }
  }

  /** All items, best first. */
  toArray(): Candidate[] {
    return [...this.items];
  }

  has(id: string): boolean {
    return this.items.some((c) => c.id === id);
  }
}

/* ── HNSW Index ─────────────────────────────────────────────────── */

export class HNSWIndex {
  private config: HNSWConfig;
  private nodes: Map<string, HNSWNode> = new Map();
  private entryPointId: string | null = null;
  private maxLevelCurrent = 0;
  private readonly mL: number; // normalization factor for level generation

  constructor(config?: Partial<HNSWConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.mL = 1 / Math.log(this.config.M);
  }

  /* ── Public API ─────────────────────────────────────────────── */

  size(): number {
    return this.nodes.size;
  }

  insert(id: string, vector: number[]): void {
    // If this ID already exists, remove it first (update case)
    if (this.nodes.has(id)) {
      this.remove(id);
    }

    const level = this.randomLevel();
    const node: HNSWNode = {
      id,
      vector,
      level,
      connections: new Map(),
    };

    // Initialize empty connection lists for each layer
    for (let l = 0; l <= level; l++) {
      node.connections.set(l, []);
    }

    this.nodes.set(id, node);

    // First node becomes entry point
    if (this.entryPointId === null) {
      this.entryPointId = id;
      this.maxLevelCurrent = level;
      return;
    }

    const ef = this.config.efConstruction;
    const entryNode = this.nodes.get(this.entryPointId)!;
    let currentBest: Candidate = {
      id: this.entryPointId,
      score: cosineSimilarity(vector, entryNode.vector),
    };

    // Phase 1: greedily descend from top layer to insertion layer + 1
    for (let l = this.maxLevelCurrent; l > level; l--) {
      currentBest = this.greedyClosest(vector, currentBest, l);
    }

    // Phase 2: insert at each layer from min(level, maxLevelCurrent) down to 0
    let entryPoints = new CandidateList();
    entryPoints.insert(currentBest);

    const topInsertLayer = Math.min(level, this.maxLevelCurrent);
    for (let l = topInsertLayer; l >= 0; l--) {
      const maxConnections = l === 0 ? this.config.M * 2 : this.config.M;
      const neighbors = this.searchLayer(vector, entryPoints, ef, l);

      // Select best neighbors
      const selected = neighbors.toArray().slice(0, maxConnections);

      // Set connections for the new node at this layer
      node.connections.set(
        l,
        selected.map((c) => c.id),
      );

      // Add bidirectional connections
      for (const neighbor of selected) {
        const neighborNode = this.nodes.get(neighbor.id);
        if (!neighborNode) continue;

        const neighborConns = neighborNode.connections.get(l) ?? [];
        if (!neighborConns.includes(id)) {
          neighborConns.push(id);
        }

        // Shrink neighbor connections if over limit
        if (neighborConns.length > maxConnections) {
          this.shrinkConnections(neighborNode, l, maxConnections);
        } else {
          neighborNode.connections.set(l, neighborConns);
        }
      }

      // Use neighbors as entry points for the next lower layer
      entryPoints = neighbors;
    }

    // Update entry point if new node has higher level
    if (level > this.maxLevelCurrent) {
      this.entryPointId = id;
      this.maxLevelCurrent = level;
    }
  }

  search(query: number[], k: number): Array<{ id: string; score: number }> {
    if (this.entryPointId === null || this.nodes.size === 0) {
      return [];
    }

    const ef = Math.max(this.config.efSearch, k);
    const entryNode = this.nodes.get(this.entryPointId)!;
    let currentBest: Candidate = {
      id: this.entryPointId,
      score: cosineSimilarity(query, entryNode.vector),
    };

    // Phase 1: greedy descent from top layer to layer 1
    for (let l = this.maxLevelCurrent; l > 0; l--) {
      currentBest = this.greedyClosest(query, currentBest, l);
    }

    // Phase 2: search layer 0 with beam search
    const entryPoints = new CandidateList();
    entryPoints.insert(currentBest);
    const results = this.searchLayer(query, entryPoints, ef, 0);

    return results
      .toArray()
      .slice(0, k)
      .map((c) => ({ id: c.id, score: c.score }));
  }

  remove(id: string): void {
    const node = this.nodes.get(id);
    if (!node) return;

    // Remove this node from all neighbors' connection lists
    for (let l = 0; l <= node.level; l++) {
      const neighbors = node.connections.get(l) ?? [];
      for (const neighborId of neighbors) {
        const neighbor = this.nodes.get(neighborId);
        if (!neighbor) continue;
        const conns = neighbor.connections.get(l);
        if (conns) {
          const idx = conns.indexOf(id);
          if (idx !== -1) {
            conns.splice(idx, 1);
          }
        }
      }

      // Repair: connect orphaned neighbors to each other
      // For each pair of former neighbors, consider adding a connection
      for (let i = 0; i < neighbors.length; i++) {
        const nA = this.nodes.get(neighbors[i]);
        if (!nA) continue;
        const connsA = nA.connections.get(l) ?? [];
        const maxConn = l === 0 ? this.config.M * 2 : this.config.M;

        if (connsA.length < maxConn) {
          for (let j = i + 1; j < neighbors.length; j++) {
            if (connsA.length >= maxConn) break;
            const nB = this.nodes.get(neighbors[j]);
            if (!nB) continue;
            if (!connsA.includes(neighbors[j])) {
              connsA.push(neighbors[j]);
              const connsB = nB.connections.get(l) ?? [];
              if (!connsB.includes(neighbors[i]) && connsB.length < maxConn) {
                connsB.push(neighbors[i]);
                nB.connections.set(l, connsB);
              }
            }
          }
          nA.connections.set(l, connsA);
        }
      }
    }

    this.nodes.delete(id);

    // Update entry point if we removed it
    if (this.entryPointId === id) {
      if (this.nodes.size === 0) {
        this.entryPointId = null;
        this.maxLevelCurrent = 0;
      } else {
        // Find node with highest level
        let bestId: string | null = null;
        let bestLevel = -1;
        for (const [nid, n] of this.nodes) {
          if (n.level > bestLevel) {
            bestLevel = n.level;
            bestId = nid;
          }
        }
        this.entryPointId = bestId;
        this.maxLevelCurrent = bestLevel;
      }
    }
  }

  /* ── Serialization ──────────────────────────────────────────── */

  serialize(): Buffer {
    const data = {
      config: this.config,
      entryPointId: this.entryPointId,
      maxLevelCurrent: this.maxLevelCurrent,
      nodes: [] as Array<{
        id: string;
        vector: number[];
        level: number;
        connections: Array<[number, string[]]>;
      }>,
    };

    for (const [, node] of this.nodes) {
      data.nodes.push({
        id: node.id,
        vector: node.vector,
        level: node.level,
        connections: Array.from(node.connections.entries()),
      });
    }

    return Buffer.from(JSON.stringify(data), "utf-8");
  }

  static deserialize(data: Buffer): HNSWIndex {
    const parsed = JSON.parse(data.toString("utf-8")) as {
      config: HNSWConfig;
      entryPointId: string | null;
      maxLevelCurrent: number;
      nodes: Array<{
        id: string;
        vector: number[];
        level: number;
        connections: Array<[number, string[]]>;
      }>;
    };

    const index = new HNSWIndex(parsed.config);
    index.entryPointId = parsed.entryPointId;
    index.maxLevelCurrent = parsed.maxLevelCurrent;

    for (const nodeData of parsed.nodes) {
      const node: HNSWNode = {
        id: nodeData.id,
        vector: nodeData.vector,
        level: nodeData.level,
        connections: new Map(nodeData.connections),
      };
      index.nodes.set(node.id, node);
    }

    return index;
  }

  static fromEntries(entries: Array<{ id: string; vector: number[] }>): HNSWIndex {
    const index = new HNSWIndex();
    for (const entry of entries) {
      index.insert(entry.id, entry.vector);
    }
    return index;
  }

  /* ── Internal helpers ───────────────────────────────────────── */

  private randomLevel(): number {
    const r = -Math.log(Math.random()) * this.mL;
    return Math.min(Math.floor(r), this.config.maxLevel);
  }

  /**
   * Greedy search at a single layer to find the single closest node.
   * Used during the descent phase.
   */
  private greedyClosest(query: number[], start: Candidate, layer: number): Candidate {
    let best = start;
    let improved = true;

    while (improved) {
      improved = false;
      const node = this.nodes.get(best.id);
      if (!node) break;

      const neighbors = node.connections.get(layer) ?? [];
      for (const neighborId of neighbors) {
        const neighbor = this.nodes.get(neighborId);
        if (!neighbor) continue;

        const score = cosineSimilarity(query, neighbor.vector);
        if (score > best.score) {
          best = { id: neighborId, score };
          improved = true;
        }
      }
    }

    return best;
  }

  /**
   * Beam search at a given layer, returning up to ef candidates.
   * This is the core HNSW search routine.
   */
  private searchLayer(
    query: number[],
    entryPoints: CandidateList,
    ef: number,
    layer: number,
  ): CandidateList {
    const visited = new Set<string>();
    const candidates = new CandidateList(); // working set (best first)
    const results = new CandidateList(); // result set (best first)

    // Initialize from entry points
    for (const ep of entryPoints.toArray()) {
      visited.add(ep.id);
      candidates.insert(ep);
      results.insert(ep);
    }

    while (candidates.length > 0) {
      const current = candidates.popBest()!;
      const worstResult = results.worst();

      // Stop if current candidate is worse than the worst result and we have enough
      if (worstResult && results.length >= ef && current.score < worstResult.score) {
        break;
      }

      const node = this.nodes.get(current.id);
      if (!node) continue;

      const neighbors = node.connections.get(layer) ?? [];
      for (const neighborId of neighbors) {
        if (visited.has(neighborId)) continue;
        visited.add(neighborId);

        const neighbor = this.nodes.get(neighborId);
        if (!neighbor) continue;

        const score = cosineSimilarity(query, neighbor.vector);
        const worstR = results.worst();

        if (results.length < ef || (worstR && score > worstR.score)) {
          candidates.insert({ id: neighborId, score });
          results.insert({ id: neighborId, score });
          results.trimTo(ef);
        }
      }
    }

    return results;
  }

  /**
   * Shrink a node's connections at a given layer to maxConnections,
   * keeping the ones with highest similarity to the node's own vector.
   */
  private shrinkConnections(node: HNSWNode, layer: number, maxConnections: number): void {
    const conns = node.connections.get(layer) ?? [];
    if (conns.length <= maxConnections) return;

    // Score each neighbor by similarity to this node
    const scored: Candidate[] = [];
    for (const neighborId of conns) {
      const neighbor = this.nodes.get(neighborId);
      if (!neighbor) continue;
      scored.push({
        id: neighborId,
        score: cosineSimilarity(node.vector, neighbor.vector),
      });
    }

    // Sort descending by score, keep top maxConnections
    scored.sort((a, b) => b.score - a.score);
    node.connections.set(
      layer,
      scored.slice(0, maxConnections).map((c) => c.id),
    );
  }
}
