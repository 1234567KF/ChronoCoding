# 监控系统代码审查报告

> 审查时间: 2026-05-07 | 审查范围: monitor/ + .claude/hooks/

## 审查结论: ✅ 通过

### 发现并修复的问题

| # | 严重度 | 问题 | 修复 |
|---|--------|------|------|
| 1 | 🔴 | 明细日志页无消息记录 — PATCH 仅更新 totals 不记录消息 | token-accum.cjs 每次推送时同时 POST 活动消息(0-token) |
| 2 | 🔴 | skill-monitor 使用错误的 session ID — getActiveTraceId() 生成 date-based ID 而非 UUID | 从 CLAUDE_SESSION_ID env / session-state.json 读取正确 ID |
| 3 | 🟡 | monitor-session end 不再 POST 最终消息 — 会话结束时缺少收尾记录 | 改用 PATCH 更新 totals，同时 POST 会话总结消息 |
| 4 | 🟡 | 字段名 total_cost_output 有歧义 — 实际包含 input+cache+output | 重命名为 total_cost（含 DB 迁移） |

### 验证结果

| 检查项 | 状态 |
|--------|------|
| Monitor 服务运行 | ✅ |
| DB schema 迁移（total_cost_output → total_cost） | ✅ |
| API 列表返回 total_cost | ✅ |
| API 详情包含消息 | ✅ (3条) |
| API PATCH 端点 | ✅ |
| Hook 语法检查 | ✅ (4/4) |
| 定价一致性 (monitor ↔ hook) | ✅ |
| EJS 模板字段名更新 | ✅ (2/2) |
| 会话 token 数据 | ✅ (591K in / 131K out) |
| 会话花费 | ✅ (¥0.27) |

### 架构总结

```
hook 触发 → monitor-session.cjs (SessionStart/End)
         → token-accum.cjs (PostToolUse: 读 transcript → PATCH totals + POST 消息)
         → skill-monitor.cjs (PreToolUse Skill: POST 技能调用 + 正确 sessionId)
         → watcher.cjs (轮询 JSONL 兜底)
              ↓
         Express API → SQLite → EJS 模板 → http://localhost:3456
```
