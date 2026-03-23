# Browser Usage Guide: IndexedDB, Gemini Embeddings, and Chrome Extension

Memento isn't just for Node.js servers—it runs in the browser too. This guide explains how to use Memento in web applications, how to save memories from web pages, and how to build browser-based integrations.

## Browser Bundle Overview

Memento provides a browser-compatible build with:
- **IndexedDB storage** (persistent local storage, no server needed)
- **GeminiFetchEmbeddingProvider** (uses Gemini API via fetch, works in browser)
- **MemoryManager API** (same tools as Node.js, but browser-native)
- **Chrome extension** (one-click memory capture from any page)

### Installation

Install the npm package:

```bash
npm install memento-memory
```

Then in your browser code, import from the browser bundle:

```javascript
import {
  MemoryManager,
  IndexedDBAdapter,
  GeminiFetchEmbeddingProvider
} from 'memento-memory/browser';
```

## IndexedDB Storage Adapter

IndexedDB is a browser API for storing structured data locally on the user's machine.

**Advantages:**
- Persistent across browser sessions (survives page reload)
- Synchronous-like API (actually async promises)
- No server required
- ~50MB quota per site (configurable by browser)
- Works offline

**Limitations:**
- Per-origin storage (memories in one domain don't sync to another)
- Browser can clear it (if user clears cache)
- Slower than in-memory storage
- Limited querying capabilities

### Setup

```javascript
import { IndexedDBAdapter, MemoryManager } from 'memento-memory/browser';

// Create the storage adapter
const storage = new IndexedDBAdapter({
  dbName: 'memento-app',
  storeName: 'memories',
  version: 1
});

// Create a memory manager with IndexedDB
const manager = new MemoryManager({
  storage: storage,
  embeddings: embeddingProvider // see next section
});

// Initialize
await manager.initialize();
```

### Usage in React

```javascript
import React, { useEffect, useState } from 'react';
import { MemoryManager, IndexedDBAdapter } from 'memento-memory/browser';

function App() {
  const [manager, setManager] = useState(null);
  const [memories, setMemories] = useState([]);

  useEffect(() => {
    // Initialize on component mount
    const setupMemento = async () => {
      const storage = new IndexedDBAdapter({
        dbName: 'my-app-memories',
        storeName: 'memories'
      });

      const mgr = new MemoryManager({ storage });
      await mgr.initialize();
      setManager(mgr);

      // Load existing memories
      const allMemories = await mgr.list();
      setMemories(allMemories);
    };

    setupMemento();
  }, []);

  const saveMemory = async (content, tags) => {
    const memory = await manager.save(content, {
      tags: tags.split(','),
      priority: 'high'
    });
    setMemories([memory, ...memories]);
  };

  return (
    <div>
      <h1>My Memories ({memories.length})</h1>
      <MemorySaver onSave={saveMemory} />
      <MemoryList memories={memories} />
    </div>
  );
}
```

### Usage in Vue

```javascript
import { defineComponent } from 'vue';
import { MemoryManager, IndexedDBAdapter } from 'memento-memory/browser';

export default defineComponent({
  name: 'MemoriesApp',
  data() {
    return {
      manager: null,
      memories: [],
      newContent: '',
      newTags: ''
    };
  },
  async mounted() {
    // Initialize Memento
    const storage = new IndexedDBAdapter({
      dbName: 'vue-app-memories',
      storeName: 'memories'
    });

    this.manager = new MemoryManager({ storage });
    await this.manager.initialize();

    // Load memories
    this.memories = await this.manager.list({ limit: 20 });
  },
  methods: {
    async addMemory() {
      if (!this.newContent) return;

      const memory = await this.manager.save(this.newContent, {
        tags: this.newTags.split(',').map(t => t.trim()),
        priority: 'high'
      });

      this.memories.unshift(memory);
      this.newContent = '';
      this.newTags = '';
    },
    async searchMemories(query) {
      this.memories = await this.manager.search(query, {
        searchMode: 'hybrid',
        limit: 10
      });
    }
  }
});
```

### Storage Quota and Monitoring

Check IndexedDB quota:

```javascript
if (navigator.storage && navigator.storage.estimate) {
  const estimate = await navigator.storage.estimate();
  const usedQuota = estimate.usage;
  const totalQuota = estimate.quota;
  const percentUsed = (usedQuota / totalQuota) * 100;

  console.log(`Using ${usedQuota} bytes of ${totalQuota} bytes (${percentUsed.toFixed(1)}%)`);

  // If > 80%, trigger memory cleanup
  if (percentUsed > 80) {
    await manager.compact({
      ttlDays: 90,
      maxEntries: 1000
    });
  }
}
```

## GeminiFetchEmbeddingProvider: Embeddings in the Browser

Instead of running embeddings locally (which requires large models), use Google's Gemini API:

### Get a Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikeys)
2. Create a new API key
3. Copy the key

**IMPORTANT:** Never commit the API key to version control. Use environment variables:

```bash
# .env.local (never commit this)
VITE_GEMINI_API_KEY=your-key-here

# .env.example (commit this)
VITE_GEMINI_API_KEY=your-key-here
```

### Setup

```javascript
import { GeminiFetchEmbeddingProvider, MemoryManager, IndexedDBAdapter } from 'memento-memory/browser';

const embeddings = new GeminiFetchEmbeddingProvider({
  apiKey: import.meta.env.VITE_GEMINI_API_KEY,
  model: 'embedding-001'
});

const storage = new IndexedDBAdapter({
  dbName: 'memories',
  storeName: 'memories'
});

const manager = new MemoryManager({
  storage,
  embeddings
});

await manager.initialize();
```

### How It Works

When you save a memory:

```javascript
const memory = await manager.save(
  'Learned about React hooks today',
  { tags: ['learning', 'react'] }
);
```

Memento:
1. Sends your content to Google's Gemini API: `"Learned about React hooks today"`
2. Receives back a 768-dimensional vector: `[0.123, -0.456, 0.789, ...]`
3. Stores both the text and vector in IndexedDB
4. Uses the vector for semantic search later

### API Costs

Gemini embedding API is very cheap:
- 0.025 USD per 1 million tokens
- Typical memory: ~20 tokens
- ~$0.50 per 1 million memories

At this rate, embedding 10,000 memories costs ~$0.005 (half a cent).

### Rate Limiting

The Gemini API rate-limits at 1,500 requests per minute. Memento handles this with:

```javascript
// Memento batches requests automatically
// This saves 10 memories but makes only 1 API call
const memories = await Promise.all([
  manager.save('Memory 1'),
  manager.save('Memory 2'),
  manager.save('Memory 3'),
  // ... 10 total
]);
```

### Offline Fallback

If the API is unavailable, Memento falls back to simple keyword search:

```javascript
const manager = new MemoryManager({
  storage,
  embeddings,
  fallbackSearch: 'keyword' // use BM25 if embeddings fail
});
```

## MemoryManager API: Full Browser Reference

### Core Methods

#### save(content, options)

Save a new memory:

```javascript
const memory = await manager.save(
  'Discovered that React hooks are better than class components',
  {
    tags: ['react', 'learning'],
    priority: 'high',
    namespace: 'default'
  }
);

console.log(memory);
// {
//   id: 'mem_abc123',
//   content: 'Discovered that React hooks...',
//   tags: ['react', 'learning'],
//   importance: 0.85,
//   createdAt: '2026-03-23T14:30:00Z',
//   ...
// }
```

#### recall(query, options)

Find relevant memories:

```javascript
const memories = await manager.recall(
  'React hooks vs classes',
  {
    searchMode: 'vector', // 'vector', 'keyword', or 'hybrid'
    limit: 10,
    namespace: 'default'
  }
);
```

#### search(query, options)

Advanced search with filtering:

```javascript
const memories = await manager.search(
  'performance optimization',
  {
    searchMode: 'hybrid',
    limit: 20,
    filter: {
      tags: ['performance'],
      importance: { min: 0.6 }
    }
  }
);
```

#### list(options)

Get all or recent memories:

```javascript
// Get 20 most recent
const recent = await manager.list({ limit: 20 });

// Filter by tag
const learning = await manager.list({
  tags: ['learning'],
  limit: 50
});

// Filter by importance
const important = await manager.list({
  filter: { importance: { min: 0.7 } }
});
```

#### forget(id)

Delete a memory:

```javascript
await manager.forget('mem_abc123');
```

#### getMemory(id)

Get a specific memory by ID:

```javascript
const memory = await manager.getMemory('mem_abc123');
```

#### related(id, options)

Find related memories via the knowledge graph:

```javascript
const related = await manager.related('mem_abc123', {
  depth: 2, // follow relationships 2 hops out
  relationshipType: 'elaborates' // only follow certain types
});
```

### Example: Building a Memory Search UI

```javascript
class MemoriesUI {
  constructor(manager) {
    this.manager = manager;
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Search input
    const searchInput = document.getElementById('search');
    searchInput.addEventListener('input', (e) => {
      this.search(e.target.value);
    });

    // Save button
    const saveBtn = document.getElementById('save-btn');
    saveBtn.addEventListener('click', () => {
      this.saveMemory();
    });
  }

  async search(query) {
    if (!query) {
      this.renderMemories([]);
      return;
    }

    const memories = await this.manager.recall(query, { limit: 20 });
    this.renderMemories(memories);
  }

  async saveMemory() {
    const content = document.getElementById('content').value;
    const tags = document.getElementById('tags').value.split(',');

    if (!content) return;

    const memory = await this.manager.save(content, {
      tags: tags.map(t => t.trim())
    });

    // Clear form
    document.getElementById('content').value = '';
    document.getElementById('tags').value = '';

    // Refresh display
    this.search(''); // Show recent
  }

  renderMemories(memories) {
    const list = document.getElementById('memories');
    list.innerHTML = memories.map(m => `
      <div class="memory">
        <h3>${m.content.substring(0, 50)}...</h3>
        <p>${m.content}</p>
        <small>Importance: ${(m.importance * 100).toFixed(0)}%</small>
        <small>Tags: ${m.tags.join(', ')}</small>
        <button onclick="deleteMemory('${m.id}')">Delete</button>
      </div>
    `).join('');
  }
}

// Initialize
const manager = new MemoryManager({ storage, embeddings });
const ui = new MemoriesUI(manager);
```

## Chrome Extension

The Memento Chrome extension lets you save entire web pages, selections, or page metadata to your memory store with one click.

### Installation

#### From Source (For Development)

```bash
# Clone the Memento repo
git clone https://github.com/sanathshetty444/memento.git
cd memento/extension

# Install dependencies
npm install

# Build the extension
npm run build

# The dist/ directory now contains the extension
```

#### Load into Chrome

1. Open Chrome
2. Go to `chrome://extensions/`
3. Enable "Developer mode" (toggle top-right)
4. Click "Load unpacked"
5. Select the `extension/dist` directory
6. The Memento icon appears in your toolbar

### How to Use

#### Save Full Page

1. Click the Memento icon in your toolbar
2. Click "Save full page"
3. Choose tags
4. Click "Save"

The page's title, content, and URL are saved to your memory store.

#### Save Selection

1. Highlight text on any page
2. Right-click and choose "Save to Memento"
3. Tags are suggested based on page context
4. Click "Save"

Your selection is saved with the page URL and context.

#### Save Page Metadata

1. Click the Memento icon
2. Click "Save metadata only"
3. Saves page title, URL, and meta description

This is faster than saving full content when you just want a reference.

### Example Workflow

**Scenario:** You're researching React performance optimization

1. **Find an article:** "10 React Performance Tips"
2. **Read it**, find key section: "Use React.memo for expensive components"
3. **Highlight the section**
4. **Right-click → "Save to Memento"**
5. **Tags auto-populated:** `["react", "performance", "optimization"]`
6. **Click "Save"**

Later, when you call `memory_recall "React memoization"`, the article section appears in results because:
- Your text is saved with the context
- URL is indexed
- Tags are searchable

### Building Your Own Extension Integration

If you want to extend the extension, edit `extension/src/contentScript.ts`:

```typescript
// Example: Custom context menu for technical documentation
chrome.contextMenus.create({
  id: 'save-as-code',
  title: 'Save as Code Snippet',
  contexts: ['selection']
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId === 'save-as-code') {
    const text = info.selectionText;

    // Send to Memento with code tag
    await manager.save(text, {
      tags: ['code', 'snippet', document.title],
      priority: 'high'
    });

    // Show confirmation
    chrome.notifications.create('saved', {
      type: 'basic',
      title: 'Saved to Memento',
      message: 'Code snippet saved successfully'
    });
  }
});
```

## Real-World Scenario: Learning React

**Your workflow:**

1. **Day 1: Discover a concept**
   - Read article: "React Hooks Explained"
   - Highlight key section
   - Save to Memento via extension

2. **Day 3: Implement the concept**
   - Write React component in IDE
   - Auto-capture saves your code changes
   - Memory_save your architecture decision

3. **Day 5: Face a bug**
   - Search: "React hooks debugging"
   - Results include:
     - The article you saved Day 1
     - Your code changes from Day 3
     - Automatically related memories

4. **Day 10: Help a teammate**
   - Export memories about React: `export --format markdown`
   - Share the markdown file with your team
   - They import it into their Memento

5. **Month 2: Retrospective**
   - `memory_stats` shows your learning progression
   - Most memories tagged "react", "learning"
   - Search "React hooks" returns 15+ related items
   - You're a React expert, documented by Memento

## Browser Storage Limits

Different browsers have different quota:

| Browser | Quota | Notes |
|---------|-------|-------|
| Chrome | 50MB | Persistent storage request recommended |
| Firefox | 50MB | `dom.storage.default_quota` configurable |
| Safari | 50MB | Per-domain quota |
| Edge | 50MB | Same as Chrome |

To request persistent storage (won't be cleared):

```javascript
if (navigator.storage && navigator.storage.persist) {
  const persistent = await navigator.storage.persist();
  if (persistent) {
    console.log('✓ Memento data is persistent');
  } else {
    console.log('⚠ User must grant storage permission');
  }
}
```

## Syncing Between Browser and Server (Advanced)

If you also use Memento on Node.js servers, you can sync:

```javascript
// Browser: Export and send to server
const memories = await manager.export({ format: 'json' });
await fetch('/api/memories/import', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(memories)
});

// Server: Import via the HTTP API
// POST /api/memories/import with the JSON payload
```

This keeps your browser memories and server memories in sync across devices.

---

Browser-based Memento turns your web applications and research into persistent, searchable knowledge. Whether you're learning new frameworks, documenting web services, or saving research articles, Memento in the browser turns your browsing into a knowledge base.
