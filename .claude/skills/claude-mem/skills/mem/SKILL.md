---
name: mem
description: >
  Claude-Mem style persistent memory. Captures and compresses session operations
  for cross-session context retention. Uses 5 lifecycle hooks: SessionStart, UserPromptSubmit,
  PostToolUse, Stop, SessionEnd. Provides semantic search and incremental disclosure.
  Trigger: "remember", "memory", "mem", "/mem search <query>".
---

# Claude-Mem Skill (Simplified Implementation)

This is a simplified version of claude-mem for token efficiency tracking.

## Core Functions

### 1. Memory Capture
Automatically capture key operations during session:
- File edits and creations
- Command executions
- Important decisions

### 2. Cross-Session Memory
Store compressed summaries to `memory/` directory for retrieval in future sessions.

### 3. Semantic Search
Query past sessions: `/mem search <keyword>`

## Usage

| Command | Action |
|---------|--------|
| `/mem on` | Enable memory capture |
| `/mem off` | Disable memory capture |
| `/mem search <query>` | Search past memories |
| `/mem list` | List recent memories |
| `/mem clear` | Clear all memories |

## Memory Format

Each memory entry:
```
### [timestamp] - [operation_type]
**Files**: file1, file2
**Summary**: What was done
**Key Insight**: Important finding
```

## Hook Compatibility

This skill uses PostToolUse hook pattern. If conflicts with existing hooks:
- lean-ctx: Uses PreToolUse (ctx_shell/ctx_read) - **No conflict**
- skill-monitor: Uses PreToolUse - **Potential conflict**
- This skill: Uses PostToolUse + custom commands - **Low conflict risk**

If conflicts occur, priority order:
1. lean-ctx (CLI compression - critical)
2. skill-monitor (monitoring - optional)
3. mem (memory - can disable)

## Storage Location

- Memory DB: `.claude/memories.jsonl`
- Index: `.claude/mem-index.json`
