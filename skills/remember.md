---
name: remember
description: Save important context, decisions, or knowledge to persistent memory
---

Use the `memory_save` MCP tool to persist information.

When the user says "/remember" followed by content:
1. Call `memory_save` with the content
2. Auto-detect appropriate tags based on content
3. Confirm what was saved with the memory ID
4. If the content seems like a cross-project preference, suggest using the `global` flag
