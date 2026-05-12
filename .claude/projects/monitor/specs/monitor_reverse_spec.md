# Reverse-Engineered Specification: 监测者 Token Monitor

> 生成日期: 2026-05-10
> 源码路径: `D:\AICoding\监测者\monitor\`

## Overview

Token 监测系统是 AI 编程工作台的**成本观测层**。它从 Claude Code hooks 和 watcher 文件两路采集 Token 消耗数据，存入 SQLite，通过 Web 面板展示会话级和消息级的费用明细、Agent 用量分解、技能调用排行。

## Architecture Summary

### Technology Stack

| 层 | 技术 | 版本 |
|---|------|------|
| 后端 | Node.js + Express | 4.x |
| 数据库 | SQLite (better-sqlite3) | 3.x |
| 模板 | EJS + express-ejs-layouts | 3.x |
| 图表 | Chart.js (CDN) | 4.x |
| 数据采集 | Claude Code hooks + 文件轮询 | — |

### Module Structure

```
监测者/monitor/
├── client/                    # EJS 模板 (前端)
│   ├── layout.ejs             # 全局布局 + nav + 清除按钮 + 定价显示
│   ├── index.ejs              # 会话列表页 (/)
│   ├── conversation.ejs       # 会话详情页 (/conversations/:id)
│   ├── stats.ejs              # 统计仪表盘页 (/stats)
│   └── userMessage.ejs        # 用户消息详情页 (/user-messages/:id)
├── src/
│   ├── server.js              # 入口：Express 应用 + 路由注册 + DB 初始化
│   ├── pricing.js             # 定价模型：calcCost / calcBaselineCost / 官方价格抓取
│   ├── watcher.js             # 文件轮询采集：skill-traces.jsonl + transcript + pending-sessions
│   ├── collector/
│   │   └── index.js           # Hook 实时推送接收：POST /api/records
│   ├── api/
│   │   ├── conversations.js   # API: 会话列表/详情/PATCH token 汇总
│   │   ├── stats.js           # API: Token 统计/消息类型分解/技能排行/Agent 统计
│   │   ├── userMessages.js    # API: 用户消息 + A2A 回复链
│   │   └── symphony.js        # API: Symphony 兼容状态端点
│   └── db/
│       ├── schema.sql         # 数据库 Schema
│       └── index.js           # DB 初始化 + 迁移逻辑
├── scripts/
│   ├── dedup-messages.js      # 消息去重 + 成本修正
│   └── cleanup-duplicates.js  # 清理汇总消息残留
├── self-test.cjs              # 全链路自检脚本
└── package.json
```

### Data Flow

```
三条独立的数据采集路径，汇聚到同一套 DB：

路径 A：Hook 实时推送 (POST /api/records)
  Claude Code Hook (token-accum.cjs / monitor-hooks.cjs)
    │ POST /api/records (per-message)
    │ PATCH /api/conversations/:id/tokens (session totals)
    ▼
  DB: messages + conversations + token_daily_stats

路径 B：Watcher 文件轮询 (每 15s)
  .claude-flow/data/skill-traces.jsonl
    │ importTraces() → per-skill-trace messages + conversation totals
    ▼
  DB: messages + conversations

路径 C：Watcher transcript 导入
  ~/.claude/projects/D--AICoding/{sessionId}.jsonl
    │ importTranscriptMessages() → 按 DeepSeek 格式解析 → per-message
    ▼
  DB: messages + conversations + token_daily_stats

展示层：
  Express routes → EJS templates → Browser
```

### Database Schema

```sql
-- 核心表
conversations:   会话级汇总 (token/cost totals, model, time range)
messages:        单条消息 (token, cost, model, cache_hit, role)
skill_calls:     技能调用明细 (tokens, agent, team, duration, status)
token_daily_stats:  天级聚合 (token/cost by day)
```

关联关系：
- `conversations 1 ── N messages` (via conversation_id)
- `messages 1 ── N skill_calls` (via message_id)

## Observed Functional Requirements

### FR-API: 数据采集

**OBS-COL-001: Hook 实时接收**
```
When POST /api/records 收到消息数组，
the system shall 将每条消息存入 messages 表，并自动 Upsert 关联的 conversations 行。
```
源码: `src/collector/index.js` L9-L93

**OBS-COL-002: 消息去重**
```
When 同一会话中出现 role + input_tokens + output_tokens + cache_hit + content 完全相同的消息，
the system shall 跳过该消息（不重复插入）。
```
源码: `src/collector/index.js` L47

**OBS-COL-003: 会话 Token 汇总 PATCH**
```
When PATCH /api/conversations/:id/tokens 收到绝对值的 total_input_tokens / total_output_tokens / total_cost，
the system shall 从存储的上一值计算 delta，累加到 token_daily_stats 对应日期行。
```
源码: `src/api/conversations.js` L193-L244

**OBS-COL-004: 系统消息过滤**
```
When 消息 content 为"会话开始""会话结束""会话继续""会话重启"之一，
the system shall 跳过该消息（不存入 messages 表）。
```
源码: `src/collector/index.js` L43-L44, `src/watcher.js` L173

**OBS-COL-005: Watcher skill-trace 轮询**
```
When watcher 开始轮询（间隔 15 秒），
the system shall 从 .claude-flow/data/skill-traces.jsonl 读取新行，
忽略 skill_type='session' 的记录，导入其余记录为 assistant 角色消息。
```
源码: `src/watcher.js` L40-L133

**OBS-COL-006: Watcher transcript 导入**
```
When watcher 检测到 ~/.claude/projects/D--AICoding/{sessionId}.jsonl 存在新行，
the system shall 按 DeepSeek 格式（input_tokens + cache_read_input_tokens）解析，
将 assistant 的 input_tokens 归属到前一条 user 消息。
```
源码: `src/watcher.js` L182-L242, L264-L413

**OBS-COL-007: Pending 会话兜底**
```
When watcher 或 server 启动时发现 .claude-flow/data/pending-sessions/ 有 .json 文件，
the system shall 导入这些会话数据（未结束用 MAX 合并，已结束直接覆盖）。
```
源码: `src/server.js` L50-L96, `src/watcher.js` L418-L471

**OBS-COL-008: 所有数据采集路径的 cache_cost 存储**
```
Where INSERT 语句包含 input_cost / output_cost 列，
the system shall 同时存储 calcCost() 返回的 cache_cost 值到 cache_cost 列。
```
> 注：这是 v2026-05-10 才修复的 bug（之前 cache_cost 被全部丢弃）

### FR-API: 查询接口

**OBS-API-001: 会话列表分页**
```
When GET /api/conversations 收到 page / limit / search / date_from / date_to 参数，
the system shall 返回对应页数据，包含 msg_breakdown (user/a2a 分类)、skills、agents、models_used。
total_cost / total_baseline_cost 从 msg_breakdown 聚合计算（messages 表权威），
不依赖 conversations 表字段（可能为 0）。
```
源码: `src/api/conversations.js` L7-L127

**OBS-API-002: 会话详情**
```
When GET /api/conversations/:id，
the system shall 返回该会话的所有消息（含每条的 skillCalls 和 per-message cost 分解）以及 agentBreakdown 和 typeSummary。
total_cost / total_baseline_cost 从 typeSummary 聚合计算（messages 表权威）。
```
源码: `src/api/conversations.js` L130-L203

**OBS-API-003: Token 统计摘要**
```
When GET /api/stats/tokens?range=7d|30d，
the system shall 返回 token_daily_stats 的每日明细；
总汇总字段优先从 messages 表聚合（输入/输出/缓存 token 和实际/基线费用），
再以 token_daily_stats 补充 token 计数（取两者 MAX），解决 watcher 未更新 daily_stats 的漏记问题。
```
源码: `src/api/stats.js` L8-L31

**OBS-API-004: 消息类型分解**
```
When GET /api/stats/by-message-type?range=7d|30d，
the system shall 按 role 分组返回消息数、输入/输出/缓存 token、input_cost / output_cost / cache_cost / baseline_cost。
```
源码: `src/api/stats.js` L31-L97

**OBS-API-005: 用户消息 + A2A 链**
```
When GET /api/user-messages，
the system shall 返回以 user 消息为主键的数据，每条附带其后的连续 assistant 消息链汇总（token/cost/skills/agents）。
```
源码: `src/api/userMessages.js` L7-L136

**OBS-API-006: 用户消息详情**
```
When GET /api/user-messages/:id，
the system shall 查找该 user 消息之后到下一个 user 消息之前的全部 assistant 消息，并按消息分组带回 skillCalls。
```
源码: `src/api/userMessages.js` L139-L234

### FR-UI: 前端页面

**OBS-UI-001: 会话列表 (/)**
```
The system shall 以表格形式展示所有会话，每行包含：标题、模型、消息数、输入(缓存/总)、输出、花费、节省、Agent、技能、用户消息预览、时间。
```
源码: `client/index.ejs`

**OBS-UI-002: 会话详情 (/conversations/:id)**
```
The system shall 展示会话的完整消息流，每条消息显示 token 明细（未缓存输入/缓存/输出）和费用（实际/基线/节省），
并附带消息类型汇总卡和 Agent 用量分解卡。
```
源码: `client/conversation.ejs`

**OBS-UI-003: 消息类型汇总卡**
```
The system shall 在会话详情顶部展示 role 分组的卡片，包含缓存/未缓存/输出 token 数及总费用。
```
源码: `client/conversation.ejs` L45-L64

**OBS-UI-004: Agent 用量分解卡**
```
Where 会话中有 Agent (skill_calls.agent_name 非空)，
the system shall 按 agent 展示调用次数、输入/输出 token，使用团队颜色编码（红/蓝/绿）。
```
源码: `client/conversation.ejs` L67-L85

**OBS-UI-005: 统计仪表盘 (/stats)**
```
The system shall 展示摘要卡片（总输入/输出 token + 实际花费/基线/节省）、
消息类型分解表（用户 vs A2A，含所有 token 和 cost 字段）、
Token 趋势折线图（Chart.js）、技能调用排行表、Agent 使用统计表。
```
源码: `client/stats.ejs`

**OBS-UI-006: 用户消息详情 (/user-messages/:id)**
```
The system shall 展示用户消息原文及其后续 A2A 回复链的汇总和明细。
```
源码: `client/userMessage.ejs`

**OBS-UI-007: 清除数据**
```
When 用户点击 nav 上的"清除数据"按钮并确认，
the system shall DELETE 所有 DB 表、清空 skill-traces.jsonl、删除 pending-sessions、重置 watcher cursor。
```
源码: `client/layout.ejs` L57-L71, `src/server.js` L129-L161

**OBS-UI-008: 定价显示**
```
The system shall 在 nav 右上角展示当前 Flash 和 Pro 的实时定价（从 DeepSeek 官方页面抓取）。
```
源码: `client/layout.ejs` L72-L87, `src/pricing.js` L23-L76

### FR-PRICING: 成本计算

**OBS-PRICING-001: 实际成本计算 (calcCost)**
```
When calcCost(model, tokensIn, tokensOut, cacheHit) 被调用，
the system shall 分别计算：
  - input_cost = (tokensIn / 1e6) × model.input  （仅未缓存）
  - cache_cost = (cacheHit / 1e6) × model.cache_read
  - output_cost = (tokensOut / 1e6) × model.output
  - total_cost = input_cost + cache_cost + output_cost
```
源码: `src/pricing.js` L91-L111

**OBS-PRICING-002: 基线成本计算 (calcBaselineCost)**
```
When calcBaselineCost(tokensIn, tokensOut, cacheHit) 被调用，
the system shall 统一按 Pro 价格 (input:3, output:6, cache_read:0.025) 计算基线总费用。
```
源码: `src/pricing.js` L116-L130

**OBS-PRICING-003: 官方定价自动抓取**
```
When 服务启动时，
the system shall 从 https://api-docs.deepseek.com/zh-cn/quick_start/pricing 抓取最新价格，
若抓取失败则使用硬编码默认值（Flash: 1/2/0.02, Pro: 3/6/0.025）。
```
源码: `src/pricing.js` L23-L76

### FR-SYMPHONY: 编排器状态

**OBS-SYM-001: 运行时状态快照**
```
When GET /api/v1/state，
the system shall 从 .claude-flow/hammer-state 目录读取状态文件，返回各团队的 Agent 运行状态和 Token 消耗。
```
源码: `src/api/symphony.js` L119-L126

**OBS-SYM-002: 刷新触发**
```
When POST /api/v1/refresh，
the system shall 返回 202 Accepted 状态（watch 模式下通知编排器提前执行 poll tick）。
```
源码: `src/api/symphony.js` L129-L144

**OBS-SYM-003: 夯任务远程初始化**
```
When POST /api/v1/hammer/init 收到 { task, totalAgents, mode }，
the system shall 在 hammer-state 目录中创建初始状态文件。
```
源码: `src/api/symphony.js` L188-L215

## Observed Non-Functional Requirements

### Data Integrity

**OBS-NFR-001: 幂等插入**
```
Where 数据源通过 watcher 和 hook 两路并发插入，
the system shall 使用内容去重和 MAX 合并来避免重复计数。
```
问题：多路并发仍然可能导致 `token_daily_stats` 与 `messages` 汇总的不一致。

**OBS-NFR-002: 游标持久化**
```
When watcher 重启，
the system shall 从 watcher-cursor.json 恢复 trace 和 transcript 的已处理位置。
```
源码: `src/watcher.js` L27-L37, L245-L262

### Error Handling

| Code | Condition | Response |
|------|-----------|----------|
| 404 | 会话/用户消息不存在 | `{ error: "..." }` |
| 500 | 数据采集/查询异常 | `{ error: err.message }` |

### Performance

- Watcher 轮询间隔：15 秒（生产环境 `src/watcher.js` L45）
- API 分页默认：20 条/页
- API 分页最大：100 条/页
- EJS 渲染在服务端

### Security

- 无认证/鉴权机制（内网工具）
- 所有数据存储在本地 SQLite
- 清除数据 API 无需验证（应加保护）

## Design Logic & Key Design Decisions

### 1. 三路数据采集的设计意图

系统设计了三条采集路径，目的是**兜底**而非冗余：

| 路径 | 用途 | 可靠性 | 数据完整性 |
|------|------|--------|-----------|
| Hook 实时推送 | 实时展示当前会话 | Windows stdin 偶发失效 | 高（但可能丢） |
| Watcher trace | 兜底读 skill-traces.jsonl | 文件持久化 | 中（无 daily stats 更新曾是 bug） |
| Watcher transcript | 从 Claude 完整对话记录导入 | 最可靠 | 全（含所有消息） |

**设计风险**：三路各自独立更新 `token_daily_stats`，如果某一路漏了（如 importTraces 原来就漏了 daily stats），汇总数据就永久不一致。修复方法是一致性的全量重建（`dedup-messages.js` Script）。

### 2. cache_cost 被丢弃的 Bug 根因

`calcCost()` 返回 `{ input_cost, cache_cost, output_cost, total_cost }`，但所有 INSERT 语句只取了 `cost.input_cost` 和 `cost.output_cost`，`cache_cost` 从未写入 DB。数据库 schema 也没有 `cache_cost` 列。这是设计层面的字段遗漏，影响所有 cost 汇总查询。

### 3. "实际花费 vs 总费用"对不上的机制

摘要卡片读 `token_daily_stats.total_cost`（含缓存费用，来自 PATCH handler 的 total_cost），消息类型表读 `messages.input_cost + output_cost`（不含缓存费用）。两个值的差正好是 `cache_cost` 的总和。

### 4. DeepSeek 独特计价模型

DeepSeek 将输入 token 分为两种计费价格：未命中的输入 (tokensIn) 按全价，缓存命中的输入 (cacheHit) 按折扣价。这与 OpenAI 统一计费不同，是本系统所有 cost 复杂度 的根源。`input_cost` 仅代表未缓存部分，`cache_cost` 是独立字段。

### 5. Agent 团队颜色编码

前端硬编码了 `{ red: 红队, blue: 蓝队, green: 绿队 }` 的映射，用于会话详情的 Agent 边框和徽章。这是 `/夯` 三队竞争评审的可视化需求。

### 6. User Message 作为首要维度

`/api/user-messages` 端点将用户消息作为主键，聚合其后的 A2A 回复链。这是为了从"用户发问"的视角查看 Token 消耗，而不是传统按时间线平铺。

## Inferred Acceptance Criteria

### AC-001: 数据采集 - 实时推送
Given monitor 服务运行中
When hook 推送一条新消息到 POST /api/records
Then 1) messages 表新增一行 2) input_cost / output_cost / cache_cost 均不为 null

### AC-002: 数据采集 - watcher trace 落盘
Given skill-traces.jsonl 有未读行
When watcher 轮询触发 importTraces()
Then 1) messages 表新增行 2) 该会话 total_cost 增加 3) token_daily_stats 对应日期行累计更新

### AC-003: 花费一致性
Given 同一时间范围内
When 对比 token_daily_stats 的 total_cost SUM 与 messages 表的 SUM(input_cost + output_cost + cache_cost)
Then 两值应相等（允许多路并发带来的微小时间差）

### AC-004: 缓存费用可视化
Given 某条消息的 cache_hit > 0
When 查看会话详情或统计页面
Then 总费用应包含 cache_cost，且用户能看到缓存 token 数量和缓存费用

### AC-005: 会话列表分页
Given 存在多页会话
When GET /api/conversations?page=2&limit=20
Then 返回第 2 页数据，total 字段为总记录数

### AC-006: 清除数据完整
Given DB 中有数据
When 用户点击"清除数据"
Then conversations/messages/skill_calls/token_daily_stats 全清，trace 文件清空，cursor 重置但 transcriptOffsets 保留

## Uncertainties and Questions

- [ ] 三路数据采集的优先级和覆盖关系不明确（同一条消息可能被导入多次，依靠去重逻辑而非"谁先谁后"）
- [ ] PATCH handler 的 delta 计算 `Math.max(0, new - old)` 假设值只增不减，如果某路推了更低的总值会静默丢失
- [ ] `cleanup-duplicates.js` 使用了独立的成本计算逻辑（内联重复），与 `pricing.js` 的 `calcCost` 不一致
- [ ] 没有数据过期/归档机制，SQLite 会无限增长
- [x] ~~`userMessages.js` L101 + L230 漏了 cache_cost~~ → 已修复 (2026-05-10)
- [x] ~~`conversation.ejs` L52 + L130 漏了 cache_cost_sum / msg.cache_cost~~ → 已修复
- [x] ~~`userMessage.ejs` L39 + L87 漏了 cache_cost~~ → 已修复
- [x] ~~`token_daily_stats` 与 `messages` 汇总不一致~~ → 2026-05-10 修复：`/stats/tokens` 端点增加 messages 表兜底，且会话总价统一从消息聚合，不再依赖 daily_stats
- [ ] 无 API 鉴权，`POST /api/clear` 可被任意调用
- [ ] 前端硬编码了团队颜色（红/蓝/绿），其他团队名会显示默认灰色

## Bug Fix History

### 2026-05-10: cache_cost 全局修复

**问题**：`calcCost()` 返回 `{ input_cost, cache_cost, output_cost, total_cost }`，但所有 INSERT 只存了 `input_cost` 和 `output_cost`，`cache_cost` 被丢弃。所有 SUM 查询漏了缓存成本。

**修复文件清单** (12 files):

| 文件 | 修改 |
|------|------|
| `src/db/schema.sql` | +`cache_cost REAL DEFAULT 0` 列 |
| `src/db/index.js` | +迁移: `ALTER TABLE messages ADD COLUMN cache_cost` |
| `src/collector/index.js` | INSERT 增加 cache_cost 参数 |
| `src/watcher.js` L51,98 | importTraces: INSERT → 12 列含 cache_cost |
| `src/watcher.js` L329,352 | importTranscript: INSERT → 12 列含 cache_cost |
| `src/watcher.js` L112-133 | importTraces: +批量累加器, +daily_stats 更新 |
| `src/watcher.js` L389 | transcript totals: +`SUM(cache_cost) as cc` |
| `src/watcher.js` L364 | newCost: `ic + oc + cc` |
| `src/api/stats.js` L48,57-60,74-97 | by-message-type: SQL +cache_cost, JS total +cache_cost |
| `src/api/conversations.js` L49,56-59,139,185 | 三处 cost 汇总 +cache_cost |
| `src/api/userMessages.js` L101,230 | A2A 链 cost 汇总 +cache_cost |
| `client/conversation.ejs` L52,130 | 前端 totalCost +cache_cost |
| `client/userMessage.ejs` L39,87 | 前端 totalCost +cache_cost |
| `scripts/dedup-messages.js` | UPDATE +cache_cost, SUM +cache_cost |
| `src/backfill-messages.cjs` | INSERT +cache_cost, estimateCost 拆分 cache_cost |

**验证方法**:
```bash
node 监测者/monitor/scripts/dedup-messages.js  # 重建全量
# 对比两个 API 的 total_cost 应接近（小差异来自实时会话）
curl http://localhost:3456/api/stats/tokens | jq .summary.total_cost
curl http://localhost:3456/api/stats/by-message-type | jq .total.total_cost
```

### 2026-05-10: conversations 表 cost 字段为 0 修复（watcher 未调 PATCH）

**问题**：watcher 导入的对话数据从未调用 `PATCH /api/conversations/:id/tokens`，
导致 `conversations.total_cost` 和 `token_daily_stats.total_cost` 均为 0，
但 `messages` 表有正确的逐条费用。具体表现：
- 会话列表 `total_cost` 显示 `-`（0 值）
- 统计页摘要卡片显示 `¥0`，但下方缓存仪表盘和消息类型分解正确

**根因**：`importTraces()` 注释写明 "not token totals — transcript import is the authoritative source"，
但 transcript import 已移除，导致 watcher 再无路径更新 conversation-level 和 daily-stats 的费用。

**修复方案**：从 `messages` 表（权威数据源）聚合费用，不再依赖 `conversations` / `token_daily_stats`。
- 会话列表：`msg_breakdown` 增加 `baseline_cost` 字段，`total_cost` 从中聚合
- 会话详情：`typeSummary` 聚合统计，覆盖 conversation-level 的 0 值
- 统计摘要：`/api/stats/tokens` 增加 messages 表兜底查询，取 MAX

**涉及文件** (2 files):
| 文件 | 修改 |
|------|------|
| `src/api/conversations.js` | msg_breakdown +baseline_cost；列表和详情从消息聚合 total_cost/baseline_cost |
| `src/api/stats.js` | `/stats/tokens` 增加 messages 表兜底，优先使用消息级费用 |

**验证**:
```bash
node 监测者/monitor/test/run-all-tests.js  # 40/40 passed
# 对比会话级费用与消息级聚合
curl -s http://localhost:3456/api/conversations?limit=1 | jq '.data[0].total_cost, .data[0].total_baseline_cost'
```

## Recommendations

1. **统一数据采集为主路径 + 辅助路径模式**：选定一个主采集路径（如 transcript import），其他路径仅作补充，避免多路独立写汇总导致的偏差
2. **添加全量重建端点**：提供一个 `/api/rebuild` 端点，能从事务上安全地从 messages 表重建 conversations 和 token_daily_stats
3. **添加 cache_cost 前端展示列**：在统计页面的消息类型表中增加"缓存费用"列，使用户能直观看到 cache 成本
4. **给 userMessages.js 补上 cache_cost**：L101 和 L230 漏了 cache_cost，需要同步修复
5. **添加数据 TTL**：messages 表增加按月份的自动清理（或压缩归档），避免 DB 无限膨胀
6. **定价抓取增加 fallback 通知**：当官方定价页面结构变更导致解析失败时，应在 dashboard 上显示提示而非静默使用默认值
7. **给 POST /api/clear 加简单鉴权**：至少加一个免于误点的确认令牌

## Automated Test Suite

> 最后更新: 2026-05-10 — 40/40 tests 全部通过（24 集成 + 16 定价）

### 运行方式

```bash
# 运行全量测试
node 监测者/monitor/test/run-all-tests.js

# 单独运行
node 监测者/monitor/test/pricing.test.js       # 定价计算单元测试
node 监测者/monitor/test/integration.test.js   # API 全链路集成测试
```

### Test 1: pricing.test.js (16/16)

定价计算单元测试，覆盖：

| 测试 | 覆盖内容 |
|------|---------|
| Flash zero tokens | 零 token → 零成本 |
| Flash 1M input | ¥1.00 计算验证 |
| Flash 1M output | ¥2.00 计算验证 |
| Flash 1M cache | ¥0.02 缓存成本 |
| Flash mixed tokens | 混合 token 总计 = 各部分之和 |
| Pro 1M input | ¥3.00 计算验证 |
| Pro 1M output | ¥6.00 计算验证 |
| Pro 1M cache | ¥0.025 缓存成本 |
| Pro alias "pro" | 模型别名解析 |
| Baseline always Pro | 基线统一按 Pro 全价 |
| Baseline zero tokens | 零 token → 零基线成本 |
| null model returns null | 未知模型安全返回 |
| negative tokens → 0 | 负数 token 防护 |
| very large tokens | 10 亿级 token 不溢出 |
| cache NOT in input_cost | 缓存成本独立不重复 |
| total = input + output + cache | 10 组随机组合一致性 |

### Test 2: integration.test.js (24/24)

API 全链路集成测试，使用受控测试数据（2 会话、6 消息、5 技能调用，含缓存 token 和红/蓝/绿三队 Agent）：

**基础设施 (2 tests):**
- Health check 200 OK
- Pricing API 返回最新定价

**会话列表 (3 tests):**
- 分页 + total 计数
- 搜索过滤
- 页面限制

**会话详情 (4 tests):**
- cost / token 总计与预期一致
- 消息数量验证
- Agent 分解（含团队颜色：red/blue/green）
- 子 Agent 技能正确归属

**成本一致性 (3 tests):**
- 单会话: SUM(per-message cost) == conversation.total_cost
- cache_cost 独立于 input_cost
- 所有 cost 组成部分一致

**统计端点 (4 tests):**
- `/api/stats/tokens` 与预期 daily totals 一致
- `/api/stats/by-message-type` total 与 daily stats 一致
- by-message-type: total_cost == input + output + cache
- by-message-type: user + a2a == total

**技能 + Agent (2 tests):**
- 技能调用计数正确
- Agent 名 + 团队颜色正确返回

**用户消息 (3 tests):**
- 用户消息列表含 cost 字段
- 单条用户消息的 A2A 回复链
- A2A 链 SUM(per-msg cost) == total_cost

**跨端点一致性 (2 tests):**
- `/api/stats/tokens` == `/api/stats/by-message-type` (零偏差)
- SUM(conversations) == by-message-type total

**节省计算 (1 test):**
- Flash 会话 vs Pro 基线 = 有节省
- Pro 会话 vs Pro 基线 = 零节省

### 已知局限

1. **三路采集时间差**：生产环境中 PATCH handler 实时推送 vs watcher 异步导入会导致 `token_daily_stats` 和 `messages` 汇总有微小差异（秒级~分钟级），这不是 bug 是设计取舍。受控测试数据下两者完全一致。
2. **DeepSeek 平台对比**：WAF 拦截服务端请求，无法自动化对比 `platform.deepseek.com/usage` 账单。
3. **前端视觉测试**：EJS 模板渲染依赖服务端，未做端到端浏览器测试。
