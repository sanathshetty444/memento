# Installation Guide

Welcome to Memento! This guide will walk you through installing the persistent semantic memory system for your AI coding agent. Whether you're using Claude Code, Cursor, Windsurf, or OpenCode, we'll get you up and running in minutes.

## What You're About to Install

Memento is an MCP (Model Context Protocol) server that runs locally on your machine. It creates a semantic memory system using local embeddings (all-MiniLM-L6-v2) and stores everything in JSON files at `~/.claude-memory/`. No cloud uploads, no external dependencies, completely private.

## System Requirements

Before you start, make sure you have:

- **Node.js**: Version 20.0.0 or higher (check with `node --version`)
- **npm**: Version 10.0.0 or higher (included with Node.js)
- **Supported Operating Systems**:
  - macOS (Intel and Apple Silicon)
  - Linux (Ubuntu 20.04+, Fedora, Debian)
  - Windows 10+ (native or WSL2)
- **Disk Space**: At least 500 MB available for local embeddings and database files
- **RAM**: At least 2 GB available (more if you plan to store large amounts of memories)

### Checking Your Node.js Version

Open a terminal and run:

```bash
node --version
npm --version
```

You should see output like:
```
v20.11.0
10.2.3
```

If your Node.js version is below 20.0.0, download and install the latest LTS version from [nodejs.org](https://nodejs.org/).

## Installation Methods

### Method 1: NPX (Recommended for Most Users)

The easiest way to get started. This method doesn't require a global install and works immediately.

```bash
npx memento-memory setup
```

That's it! The setup command will:
1. Download the latest version of Memento
2. Create `~/.claude-memory/` directory
3. Initialize a local ChromaDB database
4. Generate a configuration file at `~/.claude-memory/config.json`
5. Configure your IDE (Claude Code, Cursor, Windsurf, or OpenCode)

**Output you should see:**
```
✓ Creating memory directory at ~/.claude-memory
✓ Initializing ChromaDB database
✓ Generating configuration file
✓ Setting up IDE integration
✓ Memento ready! Your memories are stored at ~/.claude-memory/
```

### Method 2: Global NPM Install

If you prefer to have Memento available globally as a command:

```bash
npm install -g memento-memory
memento-memory setup
```

After global installation, you can use `memento` commands from any terminal:

```bash
memento status          # Check installation
memento config show     # View current config
memento teardown        # Uninstall (if needed)
```

### Method 3: Install from Source

For developers who want to contribute or customize Memento:

```bash
git clone git@github.com:sanathshetty444/memento.git
cd memento
npm install
npm run build
npm run setup
```

This approach allows you to modify the source code and test changes locally.

## Multi-IDE Setup

Memento works with multiple AI coding IDEs. Run setup once, and it will auto-detect your IDE. Or specify it manually:

### Claude Code (Default)

```bash
npx memento-memory setup --ide claude-code
```

**What it configures:**
- Registers Memento as an MCP server in Claude Code's configuration
- Adds the memory tools to your Claude Code toolbar
- Location: `~/.claude-code/mcp-servers.json`

### Cursor

```bash
npx memento-memory setup --ide cursor
```

**What it configures:**
- Integrates with Cursor's MCP server settings
- Location: `~/.cursor/mcp-servers.json`

### Windsurf

```bash
npx memento-memory setup --ide windsurf
```

**What it configures:**
- Configures Windsurf's extended capabilities
- Location: `~/.windsurf/mcp-servers.json`

### OpenCode

```bash
npx memento-memory setup --ide opencode
```

**What it configures:**
- Sets up OpenCode's MCP extensions
- Location: `~/.opencode/mcp-servers.json`

### Multi-IDE Setup

Want to use Memento across multiple IDEs?

```bash
npx memento-memory setup --ide claude-code
npx memento-memory setup --ide cursor
npx memento-memory setup --ide windsurf
```

All IDEs will share the same memory store at `~/.claude-memory/`, so memories persist across all your tools.

## Configuration File Locations

After setup, here's where Memento stores its configuration:

| Component | Location | Purpose |
|-----------|----------|---------|
| Memory Store | `~/.claude-memory/` | JSON files with embeddings and metadata |
| Config File | `~/.claude-memory/config.json` | Storage backend, embedding model settings |
| IDE Config | See below | MCP server registration |
| WAL (Write-Ahead Log) | `~/.claude-memory/wal/` | Crash recovery |

### IDE Configuration Files

| IDE | Config Path |
|-----|-------------|
| Claude Code | `~/.claude-code/mcp-servers.json` |
| Cursor | `~/.cursor/mcp-servers.json` |
| Windsurf | `~/.windsurf/mcp-servers.json` |
| OpenCode | `~/.opencode/mcp-servers.json` |

The IDE config file looks like:
```json
{
  "mcpServers": {
    "memento": {
      "command": "node",
      "args": ["/path/to/memento/dist/index.js"]
    }
  }
}
```

## Verifying Installation

After setup, verify everything is working:

```bash
npx memento-memory status
```

**Successful output:**
```
✓ Memento v1.0.0 installed
✓ Memory store: ~/.claude-memory/ (85 MB)
✓ Database: ChromaDB (local)
✓ Embeddings: all-MiniLM-L6-v2 (384 dims)
✓ IDE: Claude Code
✓ Config: ~/.claude-memory/config.json
✓ 42 memories stored across 5 projects
```

If you see any errors, jump to the Troubleshooting section below.

## Viewing Your Configuration

To see your current Memento configuration:

```bash
npx memento-memory config show
```

**Output:**
```
Storage Backend:        ChromaDB (local)
Embedding Model:        all-MiniLM-L6-v2 (384-dim)
Memory Directory:       ~/.claude-memory/
Config File:            ~/.claude-memory/config.json
Namespace:              auto-detected
Circuit Breaker:        enabled (failure threshold: 5)
WAL (Write-Ahead Log):  enabled
LRU Cache:              1000 entries
```

## Customizing Configuration

Most users won't need to customize anything, but Memento supports advanced configuration via:

1. **Environment Variables** (highest priority):
   ```bash
   MEMENTO_STORAGE=neo4j MEMENTO_EMBEDDINGS=gemini npx memento-memory setup
   ```

2. **Config File** (`~/.claude-memory/config.json`):
   ```json
   {
     "storage": "chromadb",
     "embeddings": "local",
     "dataDir": "/home/user/.claude-memory",
     "circuitBreaker": {
       "failureThreshold": 5,
       "resetTimeout": 60000
     }
   }
   ```

3. **Defaults** (applied if nothing else is set)

The setup wizard will walk you through these options.

## Troubleshooting Installation

### Issue: "Node.js version is too old"

**Solution:** Update Node.js to version 20 or higher:
```bash
# Using Homebrew (macOS)
brew install node@20

# Using nvm (macOS/Linux)
nvm install 20
nvm use 20

# Windows: Download from nodejs.org
```

### Issue: "Permission denied" when creating ~/.claude-memory/

**Solution:** Create the directory with proper permissions:
```bash
mkdir -p ~/.claude-memory
chmod 700 ~/.claude-memory
```

Then re-run setup.

### Issue: "IDE configuration file not found"

**Solution:** Make sure your IDE is installed and has been launched at least once. The config directory is created when you first start the IDE.

```bash
# For Claude Code, ensure it's installed
npm install -g @anthropic-ai/claude-code

# For other IDEs, launch them manually once
```

### Issue: "Cannot find module '@xenova/transformers'"

**Solution:** The embeddings library is downloaded on first use. This can take 1-2 minutes for the 384-dimensional model (~100 MB). Make sure you have internet connection and patience:

```bash
# First memory operation will download the model
npx memento-memory status  # This triggers the download
```

Watch for this output:
```
Downloading all-MiniLM-L6-v2 embeddings (100 MB)...
████████████████████ 100%
✓ Embeddings ready
```

### Issue: "ChromaDB connection failed"

**Solution:** The local ChromaDB instance might be corrupted. Reset it:

```bash
rm -rf ~/.claude-memory/chromadb
npx memento-memory setup --force
```

This will reinitialize the database while preserving your memories (they're in separate JSON files).

### Issue: "Can't find IDE configuration after setup"

**Solution:** The setup detected your IDE incorrectly. Run setup again with explicit IDE flag:

```bash
# Uninstall first
npx memento-memory teardown

# Then reinstall with explicit IDE
npx memento-memory setup --ide claude-code --force
```

## Uninstalling Memento

If you need to remove Memento completely:

```bash
npx memento-memory teardown
```

**What this removes:**
- IDE configuration entries
- Memento MCP server registration
- Local memory store at `~/.claude-memory/` (ask for confirmation first)

**What it keeps:**
- Any exported memories you've saved elsewhere
- Backups (if you created them)

To keep your memories as a backup, export them first:

```bash
npx memento-memory export --format json
```

This creates a `memento-backup-[timestamp].json` file you can import later.

## Next Steps

Now that Memento is installed, you're ready to:

1. **Quick Start** (5 minutes): See how to save and recall memories in [Quickstart Guide](./quickstart.md)
2. **Understand the System** (15 minutes): Learn how Memento works under the hood in [How It Works](./how-it-works.md)
3. **Explore Features**: Check out the [Tools Reference](../reference/tools.md) for all 17 available tools

Welcome to persistent memory for AI coding!
