# HTTP API Guide

The Memento HTTP API turns your memory store into a REST service accessible from any language, framework, or device. This guide explains how to start the server, authenticate, use each endpoint, and build integrations on top of the API.

## Starting the Server

### Basic Server

```bash
memento serve
```

Output:

```
Starting Memento HTTP Server
═══════════════════════════════════════════════════════════════
Listening on: http://localhost:7007
API documentation: http://localhost:7007/docs
Graph UI: http://localhost:7007/
MCP Server: Ready on stdio

CORS enabled for: http://localhost:3000, http://localhost:8080
Memory store: ~/.claude-memory/store
Embeddings: @xenova/transformers (local)

Press Ctrl+C to stop
```

The server is now running and ready to accept requests.

### Custom Port

```bash
memento serve --port 8008
```

Listens on `http://localhost:8008`

### Configuration: CORS, Auth, and More

Configure in `~/.claude-memory/config.json`:

```json
{
  "server": {
    "port": 7007,
    "host": "127.0.0.1",
    "cors": {
      "enabled": true,
      "origins": ["http://localhost:3000", "http://localhost:8080", "https://myapp.com"],
      "credentials": true
    },
    "auth": {
      "enabled": true,
      "apiKeys": ["sk-abc123def456"]
    },
    "rateLimit": {
      "enabled": true,
      "requestsPerMinute": 100
    }
  }
}
```

#### CORS Configuration

**Allow all origins (development only):**
```json
{
  "cors": {
    "origins": ["*"]
  }
}
```

**Specific origins (production):**
```json
{
  "cors": {
    "origins": ["https://app.example.com", "https://dashboard.example.com"],
    "credentials": true,
    "methods": ["GET", "POST", "PUT", "DELETE"],
    "headers": ["Content-Type", "Authorization"]
  }
}
```

#### Rate Limiting

Protect your API from abuse:

```json
{
  "rateLimit": {
    "enabled": true,
    "requestsPerMinute": 100,
    "burstSize": 50
  }
}
```

## API Key Authentication

### Generate an API Key

```bash
memento auth generate-key
```

Output:

```
Generated API key:
sk-abc123def456789

Store this securely. You'll need it to authenticate API requests.
```

### Use API Key in Requests

Add to the `Authorization` header:

```bash
curl -H "Authorization: Bearer sk-abc123def456789" \
  http://localhost:7007/api/health
```

### In Code

**JavaScript:**
```javascript
const apiKey = 'sk-abc123def456789';
const response = await fetch('http://localhost:7007/api/search', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ query: 'authentication' })
});
```

**Python:**
```python
import requests

api_key = 'sk-abc123def456789'
headers = {
    'Authorization': f'Bearer {api_key}',
    'Content-Type': 'application/json'
}
response = requests.post(
    'http://localhost:7007/api/search',
    json={'query': 'authentication'},
    headers=headers
)
```

**cURL:**
```bash
curl -X POST http://localhost:7007/api/search \
  -H "Authorization: Bearer sk-abc123def456789" \
  -H "Content-Type: application/json" \
  -d '{"query": "authentication"}'
```

## REST Endpoints

### POST /api/save

Save a new memory.

**Request:**
```bash
curl -X POST http://localhost:7007/api/save \
  -H "Authorization: Bearer sk-abc123def456789" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "JWT tokens should be short-lived",
    "tags": ["security", "jwt"],
    "priority": "high",
    "namespace": "default"
  }'
```

**Response:**
```json
{
  "id": "mem_abc123",
  "content": "JWT tokens should be short-lived",
  "tags": ["security", "jwt"],
  "importance": 0.89,
  "priority": "high",
  "createdAt": "2026-03-23T14:30:00Z",
  "status": "saved"
}
```

**Parameters:**
- `content` (string, required): Memory content
- `tags` (array, optional): Array of tag strings
- `priority` (string, optional): "high", "medium", or "low"
- `namespace` (string, optional): Namespace to organize memories

### POST /api/recall

Retrieve relevant memories for a query.

**Request:**
```bash
curl -X POST http://localhost:7007/api/recall \
  -H "Authorization: Bearer sk-abc123def456789" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "JWT security best practices",
    "searchMode": "hybrid",
    "limit": 10
  }'
```

**Response:**
```json
{
  "query": "JWT security best practices",
  "mode": "hybrid",
  "results": [
    {
      "id": "mem_abc123",
      "content": "JWT tokens should be short-lived",
      "similarity": 0.89,
      "importance": 0.87,
      "tags": ["security", "jwt"],
      "createdAt": "2026-03-15T10:30:00Z"
    },
    {
      "id": "mem_xyz789",
      "content": "Use RS256 algorithm for signing JWTs",
      "similarity": 0.76,
      "importance": 0.84,
      "tags": ["security", "jwt", "cryptography"],
      "createdAt": "2026-03-10T14:45:00Z"
    }
  ],
  "count": 2
}
```

**Parameters:**
- `query` (string, required): Search query
- `searchMode` (string, optional): "vector", "keyword", or "hybrid" (default: "hybrid")
- `limit` (number, optional): Max results (default: 10)
- `namespace` (string, optional): Limit to specific namespace

### POST /api/search

Advanced search with filtering.

**Request:**
```bash
curl -X POST http://localhost:7007/api/search \
  -H "Authorization: Bearer sk-abc123def456789" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "database optimization",
    "searchMode": "vector",
    "limit": 20,
    "filter": {
      "tags": ["performance"],
      "importance": { "min": 0.7 },
      "createdAfter": "2026-03-01T00:00:00Z"
    }
  }'
```

**Response:**
```json
{
  "query": "database optimization",
  "mode": "vector",
  "filters": {
    "tags": ["performance"],
    "importance": { "min": 0.7 },
    "createdAfter": "2026-03-01T00:00:00Z"
  },
  "results": [
    {
      "id": "mem_opt001",
      "content": "Added database indexes on user_id, reduced query time from 500ms to 50ms",
      "similarity": 0.92,
      "importance": 0.88,
      "createdAt": "2026-03-20T09:15:00Z"
    }
  ],
  "count": 1
}
```

**Parameters:**
- `query` (string, required): Search term
- `searchMode` (string, optional): "vector", "keyword", or "hybrid"
- `limit` (number, optional): Max results
- `filter` (object, optional):
  - `tags` (array): Filter by tags (AND logic)
  - `importance` (object): Min/max importance range
  - `createdAfter` (ISO string): Only memories created after this date
  - `createdBefore` (ISO string): Only memories created before this date

### GET /api/list

List memories with optional filtering.

**Request:**
```bash
curl -X GET "http://localhost:7007/api/list?limit=10&tags=security,jwt&sort=-importance" \
  -H "Authorization: Bearer sk-abc123def456789"
```

**Response:**
```json
{
  "memories": [
    {
      "id": "mem_sec001",
      "content": "Use RS256 algorithm for signing JWTs",
      "tags": ["security", "jwt", "cryptography"],
      "importance": 0.92,
      "createdAt": "2026-03-10T14:45:00Z"
    },
    {
      "id": "mem_sec002",
      "content": "Store JWT refresh tokens in httpOnly cookies",
      "tags": ["security", "jwt"],
      "importance": 0.89,
      "createdAt": "2026-03-12T11:20:00Z"
    }
  ],
  "total": 2,
  "limit": 10,
  "offset": 0
}
```

**Query Parameters:**
- `limit` (number, default: 10): Max results
- `offset` (number, default: 0): Skip first N results
- `tags` (comma-separated string): Filter by tags
- `sort` (string): Sort order (default: "-createdAt")
  - `createdAt` (oldest first)
  - `-createdAt` (newest first)
  - `importance` (low to high)
  - `-importance` (high to low)

### DELETE /api/:id

Delete a specific memory.

**Request:**
```bash
curl -X DELETE http://localhost:7007/api/mem_abc123 \
  -H "Authorization: Bearer sk-abc123def456789"
```

**Response:**
```json
{
  "id": "mem_abc123",
  "status": "deleted"
}
```

### GET /api/health

Check server health and statistics.

**Request:**
```bash
curl -X GET http://localhost:7007/api/health \
  -H "Authorization: Bearer sk-abc123def456789"
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-03-23T14:30:00Z",
  "uptime": "2h 15m",
  "memory": {
    "total": 347,
    "averageImportance": 0.71,
    "storeSize": "3.2 MB"
  },
  "embeddings": {
    "provider": "local",
    "model": "all-MiniLM-L6-v2"
  },
  "storage": {
    "type": "json",
    "path": "~/.claude-memory/store"
  },
  "requests": {
    "total": 1247,
    "lastHour": 42,
    "averageLatency": "45ms"
  }
}
```

## Graph UI: Visualize Your Memories

Open your browser to `http://localhost:7007/`:

This interactive interface shows:
- **Network graph** of memory relationships
- **Search bar** to find memories
- **Memory details** panel
- **Relationship visualization** (contradicts, elaborates, etc.)
- **Import/export** controls

Click a memory node to see its content. Hover over edges to see relationship types.

## Example Curl Commands

### Save Multiple Memories

```bash
#!/bin/bash
API_KEY="sk-abc123def456789"

memories=(
  "JWT tokens should be short-lived"
  "Use RS256 algorithm for signing"
  "Store refresh tokens in httpOnly cookies"
  "Implement token rotation"
)

for memory in "${memories[@]}"; do
  curl -X POST http://localhost:7007/api/save \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"content\": \"$memory\",
      \"tags\": [\"security\", \"jwt\"]
    }"
done
```

### Search and Extract IDs

```bash
curl -X POST http://localhost:7007/api/search \
  -H "Authorization: Bearer sk-abc123def456789" \
  -H "Content-Type: application/json" \
  -d '{"query": "jwt", "limit": 5}' | \
  jq '.results[].id'

# Output:
# "mem_abc123"
# "mem_xyz789"
# ...
```

### Delete Low-Importance Memories

```bash
# Get memories with low importance
curl -X GET "http://localhost:7007/api/list?limit=100" \
  -H "Authorization: Bearer sk-abc123def456789" | \
  jq '.memories[] | select(.importance < 0.3) | .id' | \
  while read id; do
    curl -X DELETE "http://localhost:7007/api/$id" \
      -H "Authorization: Bearer sk-abc123def456789"
  done
```

## Building Integrations

### Example 1: Slack Bot Integration

```python
import os
from slack_bolt import App
import requests

app = App(token=os.environ.get("SLACK_BOT_TOKEN"))
MEMENTO_API_KEY = os.environ.get("MEMENTO_API_KEY")
MEMENTO_URL = "http://localhost:7007"

@app.command("/remember")
def handle_remember(ack, command, client):
    ack()
    content = command["text"]

    # Save to Memento
    response = requests.post(
        f"{MEMENTO_URL}/api/save",
        headers={
            "Authorization": f"Bearer {MEMENTO_API_KEY}",
            "Content-Type": "application/json"
        },
        json={
            "content": content,
            "tags": ["slack", command["channel_id"]],
            "priority": "high"
        }
    )

    memory = response.json()
    client.chat_postMessage(
        channel=command["channel_id"],
        text=f"✓ Saved to Memento: {content[:50]}..."
    )

@app.command("/recall")
def handle_recall(ack, command, client):
    ack()
    query = command["text"]

    # Search Memento
    response = requests.post(
        f"{MEMENTO_URL}/api/recall",
        headers={
            "Authorization": f"Bearer {MEMENTO_API_KEY}",
            "Content-Type": "application/json"
        },
        json={"query": query, "limit": 5}
    )

    results = response.json()["results"]
    text = f"Found {len(results)} memories matching '{query}':\n\n"
    for r in results:
        text += f"• {r['content'][:50]}... (importance: {r['importance']:.0%})\n"

    client.chat_postMessage(
        channel=command["channel_id"],
        text=text
    )

if __name__ == "__main__":
    app.start(port=int(os.environ.get("PORT", 3000)))
```

Deploy to your Slack workspace and use:
- `/remember This is important context` — Save to Memento
- `/recall JWT authentication` — Search and display results

### Example 2: Dashboard Integration (React)

```javascript
import React, { useState } from 'react';

const MementoSearch = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const search = async (q) => {
    if (!q) {
      setResults([]);
      return;
    }

    setLoading(true);
    const response = await fetch('http://localhost:7007/api/recall', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.REACT_APP_MEMENTO_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: q, limit: 10 })
    });

    const data = await response.json();
    setResults(data.results);
    setLoading(false);
  };

  return (
    <div className="search">
      <input
        type="text"
        placeholder="Search your memories..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          search(e.target.value);
        }}
      />

      {loading && <p>Searching...</p>}

      <div className="results">
        {results.map((r) => (
          <div key={r.id} className="result">
            <h4>{r.content.substring(0, 60)}...</h4>
            <p>{r.content}</p>
            <small>Importance: {(r.importance * 100).toFixed(0)}%</small>
            <small>Tags: {r.tags.join(', ')}</small>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MementoSearch;
```

## Performance and Monitoring

### Latency Characteristics

| Operation | Latency | Notes |
|-----------|---------|-------|
| Save | 10-50ms | Includes embedding generation |
| Recall (vector) | 20-100ms | HNSW search |
| Recall (keyword) | 10-50ms | Inverted index |
| List | 5-20ms | Simple pagination |
| Delete | 5-10ms | Immediate |
| Health | < 5ms | Just stats |

### Monitoring Requests

Use `/api/health` endpoint in your monitoring system:

```bash
# Check every 30 seconds
* * * * * /usr/bin/curl http://localhost:7007/api/health && echo "OK" || alert_pagerduty
```

### Caching for Performance

Cache recall results client-side:

```javascript
const cache = new Map();
const CACHE_TTL = 60000; // 1 minute

async function recall(query) {
  const cacheKey = `recall:${query}`;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return cached.data;
  }

  const response = await fetch('http://localhost:7007/api/recall', ...);
  const data = await response.json();

  cache.set(cacheKey, { data, time: Date.now() });
  return data;
}
```

---

The HTTP API transforms Memento from a personal memory tool into a service you can integrate across your entire development stack. Whether you're building Slack bots, web dashboards, or integrating with other services, the REST API provides full access to your memory store.
