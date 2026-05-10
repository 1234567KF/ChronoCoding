---
name: claude-code-pro
description: Token 高效调度器 — 知道何时不 spawn Agent（<3 文件跳过，省 10K-15K token），回调替代轮询（省 80-97%）。被 `/夯`、`/triple` 自动调用。
license: MIT
metadata:
  author: team
  version: "1.0"
  domain: infrastructure
  triggers: ccp, 智能调度, 回调, claude-code-pro
  role: infrastructure
  scope: multi-agent
  output-format: config
  related-skills: lambda-lang, kf-multi-team-compete
---

# claude-code-pro — Token 高效调度器

多 Agent 场景下智能决定何时 spawn，以及用回调替代轮询。

## 核心逻辑

```
shouldSkipSpawn = fileCount < 3 && !hasComplexDependencies
useCallback = agentSupportsCallback && estimatedPollCost > callbackOverhead
```

## 节省效果

| 场景 | 无 CCP | 有 CCP | 节省 |
|------|--------|--------|------|
| <3 文件任务 | 15K token (spawn) | 0 (跳过) | ~15K token |
| 多 Agent 轮询 | 50K token | 0 (回调) | ~97% |

## 实现

桥接文件: `.claude/helpers/ccp-smart-dispatch.cjs`
在 spawn agent 前注入调度逻辑 + Lambda 协议。
