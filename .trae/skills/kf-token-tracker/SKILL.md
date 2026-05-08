---
name: kf-token-tracker
description: |
  Token全量追踪 + 技能调用链路追踪。追踪所有模型调用的Token消耗、缓存命中率、成本估算，附带技能调用追踪。
  触发词：/token-tracker、token-tracker、/skill-monitor、skill-monitor、技能监控、token成本、cost
triggers:
  - /token-tracker
  - token-tracker
  - /skill-monitor
  - skill-monitor
  - 技能监控
  - 使用率
  - 调用链路
  - 技能清单
  - token成本
  - cost
recommended_model: flash
metadata:
  integrated-skills: kf-model-router
  category: monitoring
  version: "3.0.0"
  tracks: all-tokens
  new-in-v3: token-cost-tracking, cache-hit-tracking, input-output-separation, cost-summary
---

# kf-token-tracker Token全量追踪 + 技能调用链路追踪

> 追踪所有模型调用的Token消耗、成本，附带 `.claude/skills/` 下**所有技能**的调用追踪
> **v3.0** 新增：Token成本追踪、缓存命中/未命中区分、输入/输出分离计算

## 触发词

`/token-tracker`、`token-tracker`、`/skill-monitor`、`skill-monitor`、`技能监控`、`使用率`、`调用链路`、`技能清单`、`token成本`、`cost`

## 追踪范围

| 分类 | 前缀/标识 | 示例 | 数量 |
|------|----------|------|------|
| **kf-定制** | `kf-` 前缀 | kf-model-router, kf-alignment, kf-scrapling | 22个 |
| **通用技能** | 无kf-前缀 | python-pro, react-expert, lean-ctx, lambda-lang | 73个 |
| **MCP工具** | `mcp__` 前缀 | mcp__claude-flow__*, mcp__lean-ctx__* | 动态 |
| **其他** | 未匹配 | 自定义工具调用 | - |

**总计：95个已安装技能全覆盖**

## 核心能力

### 1. 技能清单扫描

```bash
node .claude/helpers/token-tracker.cjs inventory
```

扫描 `.claude/skills/` 下所有目录，生成分类清单

### 2. 实时日志（JSONL）— 含Token追踪

每次技能调用追加一行到 `.claude-flow/data/skill-traces.jsonl`：

```json
{
  "trace_id": "hammer-20260505-2205",
  "span_id": "a1b2c3d4",
  "timestamp": "2026-05-05T16:35:52.000Z",
  "agent": "red-team-fullstack",
  "team": "red",
  "skill": "kf-model-router",
  "skill_type": "kf-custom",
  "trigger": "hook",
  "result": "success",
  "model_used": "sonnet",
  "tokens_in": 5000,
  "tokens_out": 2000,
  "cache_hit": 3000,
  "note": "auto-captured"
}
```

**v3.0 新增字段**：`cache_hit`（缓存命中token数）

### 3. Token成本汇总 🆕

```bash
node .claude/helpers/token-tracker.cjs cost
```

输出按模型和技能的Token成本：
- 输入/输出/缓存命中分别统计
- 缓存命中率
- 基于模型定价估算成本（CNY）

**定价模型**（每MTok）：

| 模型 | 输入 | 输出 | 缓存读取 |
|------|------|------|---------|
| opus | ¥15 | ¥75 | ¥1.875 |
| sonnet | ¥3 | ¥15 | ¥0.375 |
| haiku | ¥0.25 | ¥1.25 | ¥0.03 |
| pro | ¥3 | ¥6 | ¥0.025 |
| flash | ¥1 | ¥2 | ¥0.025 |

### 4. 调用链路树

```bash
node .claude/helpers/token-tracker.cjs tree
```

```
/夯 (hammer-20260505-2205)
├── 🔴 red-team-fullstack
│   ├── kf-model-router [kf] [sonnet] OK 5000/2000
│   └── lean-ctx [gen] [flash] OK 10000/500
└── 🔵 blue-team-fullstack
    └── python-pro [gen] OK 3000/1000
```

### 5. Markdown报告

```bash
node .claude/helpers/token-tracker.cjs report
```

输出到 `监测者/token测评/token-usage-report.md`，包含：
- **Token Usage**：输入/输出/缓存命中/缓存率/有效输入 🆕
- **Skill Type Breakdown**：按类型分的Token统计 🆕
- **技能覆盖率**：已调用/已安装 比例
- **调用链路树** + 技能频率表 + Agent×Skill矩阵
- **Token Savings**：各节省机制的Token节省量
- **Full Log**：含Input/Output/Cache列 🆕

### 6. Hook自动捕获

已在 `settings.json` PreToolUse.Skill 注册：

```json
{
  "matcher": "Skill",
  "hooks": [
    { "command": "...model-router-hook.cjs" },
    { "command": "...token-tracker.cjs pre-tool" }
  ]
}
```

**v3.0 改进**：`pre-tool` 模式正确读取stdin，非技能调用静默退出（exit 0）

## 文件清单

| 文件 | 位置 | 用途 |
|------|------|------|
| token-tracker.cjs | .claude/helpers/ | 核心监控脚本 v3.0 |
| skill-traces.jsonl | .claude-flow/data/ | 实时调用日志（含token） |
| skill-inventory.json | .claude-flow/data/ | 技能清单（95个） |
| token-usage-summary.json | .claude-flow/data/ | 汇总数据（含token统计） |
| token-usage-report.md | 监测者/token测评/ | 人可读报告 |
| SKILL.md | .claude/skills/kf-token-tracker/ | 本文件 |

## 与省Token专题的关系

| 省Token维度 | 本技能支持 |
|------------|----------|
| 输入Token追踪 | ✅ tokens_in 字段 |
| 输出Token追踪 | ✅ tokens_out 字段 |
| 缓存命中追踪 | ✅ cache_hit 字段 🆕 |
| 缓存率统计 | ✅ cost 命令 🆕 |
| 输入/输出分离计费 | ✅ cost 命令按模型分开算 🆕 |
| 成本估算 | ✅ cost 命令 🆕 |
| 控制变量（首次vs后续） | ✅ cache_hit vs tokens_in 对比 🆕 |

## 与现有系统的关系

| 系统 | 关系 |
|------|------|
| kf-model-router | 监控其调用 + 输出模型选择 |
| lean-ctx / lambda-lang | 归类为 general 技能并追踪 |
| cost-tracker.cjs | token-traces 是 cost-tracker 的Token维度补充 |
| metrics-db.mjs | token-traces 是 metrics 细分维度 |
