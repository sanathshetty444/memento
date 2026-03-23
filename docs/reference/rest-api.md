# REST API Reference

OpenAPI-style reference for Memento's local HTTP server. All endpoints available at `localhost:7007` by default.

---

## Overview

The Memento REST API mirrors the MCP tools over HTTP, enabling integration with web clients, browser extensions, and third-party applications.

**Base URL:** `http://localhost:7007`

**Default Port:** 7007 (configurable via `MEMENTO_PORT` env var or `--port` CLI flag)

**Version:** 0.9.0+

---

## Authentication

### Optional API Key

Set optional authentication via `x-api-key` header:

```bash
# Start server with API key
MEMENTO_API_KEY=secret-key-12345 memento serve --port 7007

# Request with key
curl -H "x-api-key: secret-key-12345" \
  http://localhost:7007/api/health
```

If API key is set on server, include in all requests:

```bash
-H "x-api-key: `<key>`"
```

### CORS Headers

All responses include:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

---

## Endpoints

### POST /api/save

Save a memory entry.

#### Request

```json
POST /api/save HTTP/1.1
Host: localhost:7007
Content-Type: application/json

{
  "content": "string",
  "tags": ["string"],
  "namespace": "string",
  "global": false,
  "container": "string",
  "priority": "normal"
}
```

#### Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `content` | string | Yes | Memory content to save. |
| `tags` | string[] | No | Semantic tags. |
| `namespace` | string | No | Project namespace (auto-detected if omitted). |
| `global` | boolean | No | Save to global namespace (default: false). |
| `container` | string | No | Container for scoping (default: namespace). |
| `priority` | string | No | Priority level: "low", "normal", "high" (default: "normal"). |

#### Response

**Status:** 200 OK

```json
{
  "success": true,
  "count": 1,
  "ids": ["uuid-1234"],
  "message": "Saved 1 memory entry"
}
```

**Status:** 400 Bad Request

```json
{
  "error": "content is required"
}
```

#### Example

```bash
curl -X POST http://localhost:7007/api/save \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Use PostgreSQL for production",
    "tags": ["decision", "architecture"],
    "namespace": "myproject",
    "priority": "high"
  }'

# Response:
# {"success": true, "count": 1, "ids": ["550e8400-e29b-41d4-a716-446655440000"], "message": "Saved 1 memory entry"}
```

---

### POST /api/recall

Recall relevant memories from a namespace.

#### Request

```json
POST /api/recall HTTP/1.1
Host: localhost:7007
Content-Type: application/json

{
  "query": "string",
  "namespace": "string",
  "tags": ["string"],
  "limit": 10,
  "searchMode": "vector"
}
```

#### Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | Yes | Search query (natural language or keywords). |
| `namespace` | string | No | Project namespace (auto-detected if omitted). |
| `tags` | string[] | No | Filter by tags (AND logic). |
| `limit` | number | No | Max results, 1-100 (default: 10). |
| `container` | string | No | Filter by container. |
| `searchMode` | string | No | "vector", "keyword", or "hybrid" (default: "vector"). |

#### Response

**Status:** 200 OK

```json
{
  "success": true,
  "count": 3,
  "results": [
    {
      "entry": {
        "id": "uuid-1",
        "content": "...",
        "metadata": {
          "namespace": "myproject",
          "tags": ["decision"],
          "timestamp": "2026-03-20T10:30:00Z",
          "summary": "PostgreSQL decision"
        }
      },
      "score": 0.9234
    }
  ]
}
```

**Status:** 400 Bad Request

```json
{
  "error": "query is required"
}
```

#### Example

```bash
curl -X POST http://localhost:7007/api/recall \
  -H "Content-Type: application/json" \
  -d '{
    "query": "database architecture decisions",
    "namespace": "myproject",
    "limit": 5,
    "searchMode": "hybrid"
  }'
```

---

### POST /api/search

Search memories across all projects.

#### Request

```json
POST /api/search HTTP/1.1
Host: localhost:7007
Content-Type: application/json

{
  "query": "string",
  "tags": ["string"],
  "limit": 10,
  "searchMode": "vector"
}
```

#### Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | Yes | Search query across all namespaces. |
| `tags` | string[] | No | Filter by tags. |
| `limit` | number | No | Max results, 1-100 (default: 10). |
| `searchMode` | string | No | Search strategy: "vector", "keyword", or "hybrid" (default: "vector"). |

#### Response

**Status:** 200 OK

```json
{
  "success": true,
  "count": 2,
  "results": [
    {
      "entry": {
        "id": "uuid-proj1-001",
        "content": "...",
        "metadata": {
          "namespace": "frontend",
          "tags": ["decision"],
          "timestamp": "2026-03-20T11:00:00Z"
        }
      },
      "score": 0.92
    },
    {
      "entry": {
        "id": "uuid-proj2-001",
        "content": "...",
        "metadata": {
          "namespace": "backend",
          "tags": ["architecture"],
          "timestamp": "2026-03-19T16:30:00Z"
        }
      },
      "score": 0.87
    }
  ]
}
```

#### Example

```bash
curl -X POST http://localhost:7007/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "authentication OAuth",
    "limit": 10
  }'
```

---

### GET /api/list

List memories with pagination and filters.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `namespace` | string | No | Project namespace (auto-detected if omitted). |
| `tags` | string (comma-separated) | No | Filter by tags. Example: `tags=decision,architecture` |
| `limit` | number | No | Max results (default: 10, max: 100). |
| `offset` | number | No | Pagination offset (default: 0). |
| `container` | string | No | Filter by container. |

#### Response

**Status:** 200 OK

```json
{
  "success": true,
  "count": 2,
  "total": 42,
  "offset": 0,
  "entries": [
    {
      "id": "uuid-1",
      "content": "...",
      "metadata": {
        "namespace": "myproject",
        "tags": ["decision"],
        "timestamp": "2026-03-20T10:30:00Z",
        "summary": "PostgreSQL decision"
      }
    }
  ]
}
```

#### Example

```bash
# List first 20 decision entries
curl "http://localhost:7007/api/list?namespace=myproject&tags=decision&limit=20&offset=0"

# Paginate through results
curl "http://localhost:7007/api/list?namespace=myproject&limit=20&offset=20"
```

---

### GET /api/health

Health check and system status.

#### Response

**Status:** 200 OK

```json
{
  "success": true,
  "status": "healthy",
  "version": "0.9.0",
  "config": {
    "storageType": "chromadb",
    "embeddingProvider": "openai",
    "embeddingModel": "text-embedding-3-small",
    "namespace": "myproject"
  },
  "stats": {
    "entriesInNamespace": 247,
    "globalEntries": 1032,
    "autoCapture": true
  }
}
```

#### Example

```bash
curl http://localhost:7007/api/health
```

---

### DELETE /api/:id

Delete a memory by ID.

#### URL Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Memory entry ID (UUID). |

#### Response

**Status:** 200 OK

```json
{
  "success": true,
  "message": "Memory entry uuid-1234 deleted successfully"
}
```

**Status:** 404 Not Found

```json
{
  "success": false,
  "error": "Memory entry uuid-1234 not found"
}
```

#### Example

```bash
curl -X DELETE "http://localhost:7007/api/550e8400-e29b-41d4-a716-446655440000"
```

---

### GET /

Web UI

#### Response

Serves HTML/JavaScript interactive memory UI.

#### Access

Open browser: `http://localhost:7007/`

Features:
- Search memories
- View memory details
- Save new memories
- View statistics

---

## Error Responses

### Standard Error Format

All errors follow this format:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### Common Error Codes

| Code | Status | Meaning | Example |
|------|--------|---------|---------|
| `INVALID_REQUEST` | 400 | Missing or invalid parameters | Missing required `query` field |
| `NOT_FOUND` | 404 | Resource not found | Memory ID doesn't exist |
| `INTERNAL_ERROR` | 500 | Server error | Unexpected exception |
| `UNAUTHORIZED` | 401 | Missing/invalid API key | Invalid `x-api-key` header |

### Example Error

```json
{
  "success": false,
  "error": "query is required",
  "code": "INVALID_REQUEST"
}
```

---

## Content-Type Handling

All endpoints expect and return JSON:

```
Content-Type: application/json
```

Request body must be valid JSON. POST requests require this header.

---

## Rate Limiting

No built-in rate limiting. Implement at reverse proxy level if needed:

```nginx
# Example nginx rate limiting
limit_req_zone $binary_remote_addr zone=memento:10m rate=100r/s;
location /api/ {
  limit_req zone=memento burst=200;
  proxy_pass http://127.0.0.1:7007;
}
```

---

## Batch Operations

No dedicated batch endpoints. Use multiple sequential requests or implement batching at client level.

### Example: Batch Save

```javascript
async function batchSave(memories) {
  const results = [];
  for (const memory of memories) {
    const res = await fetch('http://localhost:7007/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(memory)
    });
    results.push(await res.json());
  }
  return results;
}
```

---

## CORS

All responses include CORS headers for cross-origin requests:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, x-api-key
```

Browser clients can make requests from any origin.

---

## Timeout

No explicit timeout configuration. Client timeout: 30 seconds (configurable in client).

---

## Examples

### JavaScript / Fetch API

```javascript
// Save memory
const saveResponse = await fetch('http://localhost:7007/api/save', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'your-api-key'
  },
  body: JSON.stringify({
    content: 'Important decision',
    tags: ['decision', 'architecture'],
    namespace: 'myproject'
  })
});

const saved = await saveResponse.json();
console.log(saved.ids); // ["uuid-1234"]

// Recall memories
const recallResponse = await fetch('http://localhost:7007/api/recall', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'database architecture',
    limit: 10
  })
});

const results = await recallResponse.json();
results.results.forEach(r => {
  console.log(r.score, r.entry.content);
});
```

### cURL

```bash
# Save
curl -X POST http://localhost:7007/api/save \
  -H "Content-Type: application/json" \
  -H "x-api-key: secret-key" \
  -d '{"content": "Test memory", "tags": ["test"]}'

# Recall
curl -X POST http://localhost:7007/api/recall \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "limit": 5}'

# List
curl "http://localhost:7007/api/list?limit=10&offset=0"

# Health
curl http://localhost:7007/api/health

# Delete
curl -X DELETE http://localhost:7007/api/uuid-1234

# With API key
curl -H "x-api-key: secret-key" \
  http://localhost:7007/api/health
```

### Python

```python
import requests
import json

BASE_URL = "http://localhost:7007"
HEADERS = {
    "Content-Type": "application/json",
    "x-api-key": "secret-key"
}

# Save
response = requests.post(
    f"{BASE_URL}/api/save",
    headers=HEADERS,
    json={
        "content": "Decision: Use TypeScript",
        "tags": ["decision", "language"],
        "namespace": "myproject"
    }
)
print(response.json())  # {"success": true, "count": 1, "ids": [...]}

# Recall
response = requests.post(
    f"{BASE_URL}/api/recall",
    headers=HEADERS,
    json={
        "query": "language decisions",
        "limit": 10
    }
)
results = response.json()
for result in results["results"]:
    print(f"Score: {result['score']}, Content: {result['entry']['content']}")

# List
response = requests.get(
    f"{BASE_URL}/api/list",
    headers=HEADERS,
    params={"namespace": "myproject", "limit": 20}
)
print(response.json())

# Health
response = requests.get(f"{BASE_URL}/api/health", headers=HEADERS)
print(response.json())

# Delete
response = requests.delete(
    f"{BASE_URL}/api/uuid-1234",
    headers=HEADERS
)
print(response.json())
```

### TypeScript

```typescript
interface SaveRequest {
  content: string;
  tags?: string[];
  namespace?: string;
  priority?: "low" | "normal" | "high";
}

interface SaveResponse {
  success: boolean;
  count: number;
  ids: string[];
  message: string;
}

async function saveMemory(memory: SaveRequest): Promise<SaveResponse> {
  const response = await fetch("http://localhost:7007/api/save", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.MEMENTO_API_KEY || ""
    },
    body: JSON.stringify(memory)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

const saved = await saveMemory({
  content: "TypeScript decision",
  tags: ["decision", "language"],
  namespace: "myproject",
  priority: "high"
});

console.log(`Saved: ${saved.ids[0]}`);
```

---

## API Limitations

- **Max request body:** 10MB (configurable)
- **Max results per request:** 100
- **Max query length:** 4KB
- **Response timeout:** 30 seconds (client-side)
- **Concurrent connections:** Limited by Node.js (default: ~10K)

---

## Performance

Typical response times:

| Endpoint | Time | Notes |
|----------|------|-------|
| POST /api/save | 50-200ms | Includes embedding + storage |
| POST /api/recall | 30-100ms | Depends on vector search speed |
| GET /api/list | 20-50ms | Pagination, no search |
| GET /api/health | <10ms | No I/O |
| DELETE /api/:id | 10-50ms | Depends on storage type |

---

## Reverse Proxy Setup

### nginx

```nginx
upstream memento {
  server 127.0.0.1:7007;
}

server {
  listen 8080;
  server_name localhost;

  location / {
    proxy_pass http://memento;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_read_timeout 30s;
  }
}
```

### Apache

```apache
ProxyPreserveHost On
ProxyPass / http://127.0.0.1:7007/
ProxyPassReverse / http://127.0.0.1:7007/
```

---

## Security Considerations

1. **API Key**: Optional but recommended for production. Use environment variable.
2. **HTTPS**: Run behind reverse proxy (nginx, Apache) with HTTPS for public deployments.
3. **CORS**: Unrestricted by default. Tighten at reverse proxy level if needed.
4. **Network**: Bind to 127.0.0.1 only for local use. Use reverse proxy for remote access.

### Example: Local only

```bash
memento serve --port 7007
# Listens on 127.0.0.1:7007 (localhost only)
```

### Example: With reverse proxy + HTTPS

```bash
# Start server on localhost
MEMENTO_API_KEY=secret memento serve --port 7007

# nginx reverse proxy (external requests → local server)
# Handles HTTPS, rate limiting, auth
```

