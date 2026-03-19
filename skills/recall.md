---
name: recall
description: Recall memories related to the current context or a specific query
---

Use the `memory_recall` MCP tool to search for relevant memories.

When the user says "/recall" followed by a query:
1. Call `memory_recall` with the query text
2. Present results clearly with relevance scores
3. If no query provided, recall recent memories for the current project using `memory_list`
