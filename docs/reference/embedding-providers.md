# Embedding Providers Reference

Complete reference for all embedding providers supported by Memento for vector generation.

---

## Overview

Memento supports 4 embedding providers:

| Provider | Dimensions | Cost | Environment | Status | Model |
|----------|-----------|------|-------------|--------|-------|
| **Local (MiniLM)** | 384 | Free | Node.js | ✓ Default | Xenova/all-MiniLM-L6-v2 |
| **OpenAI** | 1536 | $0.02/M tokens | Cloud | Optional | text-embedding-3-small |
| **Gemini SDK** | 768 | $2/M tokens | Cloud | Optional | embedding-001 |
| **Gemini Fetch** | 768 | $2/M tokens | Cloud, Browser | Optional | embedding-001 |

---

## 1. Local / MiniLM (Default)

### Overview

On-device embedding using Xenova's all-MiniLM-L6-v2 model. No API keys, no network calls, completely offline.

### Configuration

**Type:** `local`

**Config file:** `~/.claude-memory/config.json`

```json
{
  "embeddings": {
    "provider": "local",
    "model": "Xenova/all-MiniLM-L6-v2",
    "dimensions": 384
  }
}
```

### Model Details

- **Model name**: all-MiniLM-L6-v2 (Hugging Face)
- **Dimensions**: 384
- **Architecture**: 6-layer transformer, 384 hidden size
- **Training data**: SNLI, MultiNLI, AllNLI datasets (1.3B sentence pairs)
- **Speed**: ~100-500 tokens/sec on CPU
- **Memory**: ~100MB model + runtime

### Dependencies

```bash
npm install @xenova/transformers
```

(Already included in memento-memory)

### Implementation

Uses `@xenova/transformers` (ONNX.js):
- Runs in JavaScript/Node.js via WASM
- Supports both server (Node.js) and browser (Web Workers)
- Model downloaded on first use (~100MB)
- Cached in `~/.cache/transformers.js/` (Node.js) or IndexedDB (browser)

### Trade-offs

| Pros | Cons |
|------|------|
| Completely free | Slower than cloud (~100ms/embedding) |
| No API keys required | Lower quality than larger models |
| Works offline | 384 dims vs 1536 (OpenAI) or 768 (Gemini) |
| Privacy-first (no data sent) | Uses more CPU |
| Works in browser | Model file required (~100MB) |
| No rate limits | Re-training not available |

### Performance

| Metric | Value |
|--------|-------|
| Time per embedding | ~100-200ms (CPU) |
| Batch speed | ~50-100 tokens/sec |
| Recall quality @ 384-dim | ~0.92 |
| Model size | ~100MB |
| Memory footprint | ~200MB (model + runtime) |

### Setup Instructions

Local is default. No setup required. Verify:

```bash
cat ~/.claude-memory/config.json | jq '.embeddings'
# Output:
# {
#   "provider": "local",
#   "model": "Xenova/all-MiniLM-L6-v2",
#   "dimensions": 384
# }
```

### Environment Variables

```bash
# Default uses local (no env vars needed)
MEMENTO_EMBEDDING_PROVIDER=local \
  MEMENTO_EMBEDDING_MODEL="Xenova/all-MiniLM-L6-v2" \
  MEMENTO_EMBEDDING_DIMENSIONS=384 \
  memento serve
```

### When to Use

✓ **Good for:**
- Development and testing
- Privacy-critical applications
- Offline-first workflows
- Single-machine deployments
- Budget-conscious teams
- Quick prototyping

✗ **Not ideal for:**
- High-precision semantic search
- Large-scale production (slow)
- Real-time APIs requiring <50ms latency

### Limitations

- **Speed**: Slower than cloud providers (~100ms per text vs 10-20ms)
- **Quality**: Lower semantic understanding vs GPT-3 embedding
- **Scalability**: CPU-bound, not suitable for >1000 embeddings/sec
- **Model updates**: Can't upgrade to newer models easily

---

## 2. OpenAI

### Overview

High-quality embeddings via OpenAI's API. Best for production deployments requiring highest semantic quality.

### Configuration

**Type:** `openai`

**Config file:** `~/.claude-memory/config.json`

```json
{
  "embeddings": {
    "provider": "openai",
    "model": "text-embedding-3-small",
    "dimensions": 1536,
    "openaiApiKey": "sk-..."
  }
}
```

### Model Options

#### text-embedding-3-small (Recommended)

- **Dimensions**: 1536 (can reduce to 256, 512, or 1024 with truncation)
- **Cost**: $0.02 per 1M input tokens
- **Speed**: ~10-20ms per embedding (network latency)
- **Quality**: Very high (better than text-embedding-ada-002)
- **Update frequency**: Quarterly

#### text-embedding-3-large

- **Dimensions**: 3072
- **Cost**: $0.13 per 1M input tokens
- **Speed**: ~15-30ms per embedding
- **Quality**: Highest available
- **Use case**: When maximum accuracy needed

### Installation

```bash
npm install openai
```

### Configuration

**Set API key in config:**

```bash
cat > ~/.claude-memory/config.json << 'EOF'
{
  "embeddings": {
    "provider": "openai",
    "model": "text-embedding-3-small",
    "dimensions": 1536,
    "openaiApiKey": "sk-..."
  }
}
EOF
```

**Or via environment:**

```bash
export OPENAI_API_KEY=sk-...
# Config loader automatically picks up OPENAI_API_KEY env var
```

### Environment Variables

```bash
MEMENTO_EMBEDDING_PROVIDER=openai \
  MEMENTO_EMBEDDING_MODEL=text-embedding-3-small \
  MEMENTO_EMBEDDING_DIMENSIONS=1536 \
  OPENAI_API_KEY=sk-... \
  memento serve
```

### Performance

| Metric | Value |
|--------|-------|
| Time per embedding (network) | 15-30ms |
| Batch speed | ~1000 tokens/sec |
| Recall quality @ 1536-dim | ~0.97 |
| API rate limit | 500K tokens/min (free tier: 3 requests/min) |
| Cost per 10K embeddings | $0.20 |

### Pricing

Based on input tokens (output tokens free):

- 1,000 memories @ 50 tokens each = 50K tokens
- Cost: $0.02 × 50 = $0.001 per initial embedding
- Monthly at 1K new memories: ~$0.001/month

### Trade-offs

| Pros | Cons |
|------|------|
| Highest quality (text-embedding-3-small) | Requires API key + account |
| Fast (cloud) | Sends data to OpenAI (privacy) |
| Well-documented API | Cost accumulates with usage |
| Reliable uptime (99.9%) | Rate limits on free tier |
| Regular model updates | Network dependency |
| Support via OpenAI | Token estimation needed |

### Setup Instructions

1. **Get API key:**
   - Go to https://platform.openai.com/api-keys
   - Create new secret key
   - Copy key (starts with `sk-`)

2. **Store key safely:**

```bash
# Option 1: Config file (less secure)
cat > ~/.claude-memory/config.json << 'EOF'
{
  "embeddings": {
    "provider": "openai",
    "model": "text-embedding-3-small",
    "dimensions": 1536,
    "openaiApiKey": "sk-..."
  }
}
EOF

# Option 2: Environment variable (recommended)
export OPENAI_API_KEY=sk-...
# Add to ~/.bashrc or ~/.zshrc for persistence
```

3. **Verify:**

```bash
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/embeddings \
  -d '{"model":"text-embedding-3-small", "input":"test"}'
# Should return embedding vector
```

4. **Migrate existing memories:**

```bash
# Switch to OpenAI in config
# Then run memory_migrate to re-embed all entries
memory_migrate(namespace: "myproject", dryRun: false)
```

### Limitations

- **Privacy**: Sends all text to OpenAI's servers
- **Cost**: Accumulates with usage (small, but non-zero)
- **Dependency**: Requires API key, internet connection
- **Rate limits**: Free tier limited to 3 requests/min
- **Latency**: Network-dependent (typically 15-30ms, sometimes slower)

### When to Use

✓ **Good for:**
- Production deployments needing highest quality
- When privacy not a concern
- Well-funded teams
- Mission-critical semantic search
- Teams already using OpenAI

✗ **Not ideal for:**
- Privacy-first applications
- Offline-only deployments
- Budget-constrained projects
- High-throughput scenarios (>1000 embeddings/sec)

---

## 3. Gemini SDK

### Overview

Google's embedding API via official Node.js SDK. Good middle ground: high quality, moderate cost, requires SDK.

### Configuration

**Type:** `gemini`

**Config file:** `~/.claude-memory/config.json`

```json
{
  "embeddings": {
    "provider": "gemini",
    "model": "embedding-001",
    "dimensions": 768,
    "geminiApiKey": "AIzaSy..."
  }
}
```

### Model Details

- **Model name**: embedding-001
- **Dimensions**: 768
- **Cost**: $2 per 1M tokens
- **Speed**: ~20-40ms per embedding (network latency)
- **Quality**: High (between MiniLM and GPT-3)
- **Batch support**: Yes (up to 100 texts)

### Installation

```bash
npm install @google/generative-ai
```

### Configuration

**Set API key in config:**

```bash
cat > ~/.claude-memory/config.json << 'EOF'
{
  "embeddings": {
    "provider": "gemini",
    "model": "embedding-001",
    "dimensions": 768,
    "geminiApiKey": "AIzaSy..."
  }
}
EOF
```

**Or via environment:**

```bash
export GEMINI_API_KEY=AIzaSy...
# Config loader automatically picks up GEMINI_API_KEY env var
```

### Environment Variables

```bash
MEMENTO_EMBEDDING_PROVIDER=gemini \
  MEMENTO_EMBEDDING_MODEL=embedding-001 \
  MEMENTO_EMBEDDING_DIMENSIONS=768 \
  GEMINI_API_KEY=AIzaSy... \
  memento serve
```

### Performance

| Metric | Value |
|--------|-------|
| Time per embedding (network) | 20-40ms |
| Batch speed (up to 100 texts) | ~2000 tokens/sec |
| Recall quality @ 768-dim | ~0.95 |
| API rate limit | 1500 requests/min |
| Cost per 10K embeddings | $0.20 |

### Pricing

Same as OpenAI: $2 per 1M input tokens (output free)

### Trade-offs

| Pros | Cons |
|------|------|
| Moderate cost ($2/M tokens) | Requires API key |
| Good quality (768-dim) | Sends data to Google |
| Batch API for efficiency | Learning curve with Gemini SDK |
| Reliable (Google infrastructure) | Less documentation than OpenAI |
| Batch embedding support | Network dependency |

### Setup Instructions

1. **Get API key:**
   - Go to https://aistudio.google.com/app/apikey
   - Create new API key (free tier available)
   - Copy key (starts with `AIzaSy`)

2. **Store key:**

```bash
export GEMINI_API_KEY=AIzaSy...
```

3. **Configure Memento:**

```bash
cat > ~/.claude-memory/config.json << 'EOF'
{
  "embeddings": {
    "provider": "gemini",
    "model": "embedding-001",
    "dimensions": 768,
    "geminiApiKey": "AIzaSy..."
  }
}
EOF
```

4. **Migrate existing memories:**

```bash
memory_migrate(namespace: "myproject", dryRun: false)
```

### Limitations

- **Rate limits**: 1500 requests/min (higher than OpenAI)
- **Batch latency**: Still network-bound
- **Data privacy**: Sent to Google servers
- **SDK maturity**: Newer than OpenAI SDK

### When to Use

✓ **Good for:**
- Google Cloud users
- Batch embedding scenarios
- Teams preferring Google
- Moderate quality + cost balance

✗ **Not ideal for:**
- Privacy-first deployments
- Offline workflows

---

## 4. Gemini Fetch (Browser)

### Overview

Gemini embedding API accessed via fetch in browser. Enables embeddings in browser extensions without Node.js.

### Configuration

**Type:** `gemini-fetch`

**Browser package:** `memento-memory/browser`

```javascript
import { createEmbeddingProvider } from "memento-memory/browser";

const provider = await createEmbeddingProvider({
  type: "gemini-fetch",
  apiKey: "AIzaSy..."
});

const embedding = await provider.embed("Hello world");
```

### Model Details

Same as Gemini SDK:
- **Model**: embedding-001
- **Dimensions**: 768
- **Cost**: $2 per 1M tokens
- **Speed**: 20-40ms (network)

### Installation

```bash
npm install memento-memory
```

Import from browser export:

```javascript
import { createEmbeddingProvider } from "memento-memory/browser";
```

### Configuration

Pass API key at runtime:

```javascript
const provider = await createEmbeddingProvider({
  type: "gemini-fetch",
  apiKey: "AIzaSy..." // Get from environment or secure storage
});
```

### Usage in Extension

```javascript
// Chrome extension content script
const { createEmbeddingProvider } = await import("memento-memory/browser");

// Get API key from extension storage
const storage = await chrome.storage.local.get("gemini_api_key");
const apiKey = storage.gemini_api_key;

const provider = await createEmbeddingProvider({
  type: "gemini-fetch",
  apiKey: apiKey
});

// Use like normal
const embedding = await provider.embed("User's message");
```

### Trade-offs

| Pros | Cons |
|------|------|
| Works in browser | API key exposed in frontend |
| No Node.js required | Requires secure key storage |
| Same quality as SDK | CORS restrictions |
| Direct API calls | Key management complexity |

### Security Considerations

**WARNING**: Exposing API keys in client-side code is risky. Mitigations:

1. **Use restricted API keys**: In Google Cloud Console, restrict key to Gemini API only
2. **Use browser storage**: Store in browser (chrome.storage), not hardcoded
3. **Implement proxy**: Call server endpoint that proxies to Gemini API
4. **User-provided keys**: Let user enter their own key in extension UI

### Setup Instructions

1. **Create restricted API key:**
   - Go to https://aistudio.google.com/app/apikey
   - Create API key
   - In Google Cloud Console, restrict to Gemini API
   - Optionally, restrict to Chrome extension ID

2. **Store securely in extension:**

```javascript
// Manifest v3
// background.js
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ gemini_api_key: "" }); // User enters in options page
});

// options.html
<input id="apiKeyInput" placeholder="Enter Gemini API key">
<button onclick="saveApiKey()">Save</button>

<script>
async function saveApiKey() {
  const key = document.getElementById("apiKeyInput").value;
  await chrome.storage.local.set({ gemini_api_key: key });
  console.log("API key saved");
}
</script>
```

3. **Use in content script:**

```javascript
const storage = await chrome.storage.local.get("gemini_api_key");
const { createEmbeddingProvider } = await import("memento-memory/browser");

const provider = await createEmbeddingProvider({
  type: "gemini-fetch",
  apiKey: storage.gemini_api_key
});
```

### Limitations

- **Security risk**: API key in browser code
- **CORS**: Some browsers/extensions may have restrictions
- **No batching**: Fetch API calls individual requests
- **Manual key management**: User responsibility to secure key

### When to Use

✓ **Good for:**
- Browser extensions
- Client-side web apps
- User-provided API keys
- Learning/prototyping

✗ **Not ideal for:**
- Production without proxy
- Sensitive deployments
- Public web apps

---

## Switching Providers

### Step-by-step Migration

1. **Update config:**

```bash
cat > ~/.claude-memory/config.json << 'EOF'
{
  "embeddings": {
    "provider": "openai",
    "model": "text-embedding-3-small",
    "dimensions": 1536,
    "openaiApiKey": "sk-..."
  }
}
EOF
```

2. **Run migration tool:**

```bash
# Via MCP
memory_migrate(namespace: "myproject", dryRun: true)
# Check preview

memory_migrate(namespace: "myproject", dryRun: false)
# Actually migrate
```

3. **Verify:**

```bash
memory_health()
# Shows new embedding provider
```

### Dry Run First

Always test with dryRun before actual migration:

```bash
# Shows how many entries will be re-embedded
memory_migrate(namespace: "myproject", dryRun: true)
# Output: "Dry run: found 247 entries to re-embed. No changes made."

# Now proceed
memory_migrate(namespace: "myproject", dryRun: false)
```

### Gradual Migration (Large Datasets)

For >100K entries, migrate in batches:

```bash
# Get all namespaces
namespaces = memory_stats() # List all

# Migrate one namespace at a time
for namespace in namespaces:
  memory_migrate(namespace: namespace, dryRun: false)
```

---

## Comparison Matrix

| Feature | Local | OpenAI | Gemini SDK | Gemini Fetch |
|---------|-------|--------|------------|--------------|
| **Dimensions** | 384 | 1536 | 768 | 768 |
| **Quality** | Good | Excellent | Very Good | Very Good |
| **Speed** | 100-200ms | 15-30ms | 20-40ms | 20-40ms |
| **Cost** | Free | $0.02/M tokens | $2/M tokens | $2/M tokens |
| **Privacy** | Complete | No | No | No |
| **Setup** | Auto | API key | API key | API key |
| **Offline** | Yes | No | No | No |
| **Browser** | No | No | No | Yes |
| **Batching** | No | Yes | Yes | Single |
| **Rate limits** | None | 500K/min | 1500/min | Browser |

---

## Recommendations

| Use Case | Provider |
|----------|----------|
| **Development** | Local |
| **Production (highest quality)** | OpenAI |
| **Production (balanced)** | Gemini SDK |
| **Budget-first** | Local |
| **Privacy-first** | Local |
| **Browser extension** | Gemini Fetch or Local |
| **High throughput** | OpenAI (batching) |
| **Google Cloud user** | Gemini SDK |
| **Offline-first** | Local |

---

## Cost Comparison

Assuming 1000 new memories per month @ 50 tokens average:

| Provider | Cost/Month | Cost/Year |
|----------|-----------|----------|
| Local | $0 | $0 |
| OpenAI (3-small) | $0.001 | $0.012 |
| Gemini | $0.1 | $1.20 |

(Costs negligible except for very high volume)

---

## Dimension Reduction

For memory-constrained environments, OpenAI supports dimension reduction:

```json
{
  "embeddings": {
    "provider": "openai",
    "model": "text-embedding-3-small",
    "dimensions": 256
  }
}
```

Supported dimensions for text-embedding-3-small: 256, 512, 768, 1024, 1536 (original)

Trade-off: Lower dimensions = worse search quality but smaller storage.

