---
name: kf-monitor
description: |
  监测者 Agent — 全链路可观测性。缓存命中率仪表盘、成本实时统计、异常模式标记。
  触发词："监测"、"监控"、"面板"、"状态"、"成本面板"、"缓存面板"。
triggers:
  - 监测
  - 监控
  - 面板
  - 状态
  - 成本面板
  - 缓存面板
  - 缓存
recommended_model: flash
metadata:
  principle: 准
  category: monitoring
  version: "1.0.0"
  integrated-skills:
    - kf-token-tracker
    - kf-saver
  monitors:
    - cache-hit-rate
    - cost-by-model
    - cost-by-skill
    - anomaly-detection
  dashboard-endpoints:
    - GET /api/v1/state
    - GET /api/v1/cache
    - GET /api/stats/tokens
    - GET /api/stats/by-message-type

---

# kf-monitor 监测者 Agent

> 全链路可观测性。缓存命中率仪表盘、成本实时统计、异常模式标记。
> 原则：**准** — 数据驱动决策，异常早发现早处理。

## 核心功能

### 1. 实时缓存命中率面板

从 token-tracker 读取缓存数据，按模型分组展示：

```bash
# 通过桥接脚本获取缓存状态
node .claude/helpers/kf-monitor-bridge.cjs cache
```

输出示例：
```json
{
  "cacheHitRate": 55.0,
  "cacheHitTokens": 220000,
  "totalInputTokens": 400000,
  "status": "good"
}
```

面板表格格式：

| 模型 | 命中率 | 命中Token | 未命中Token | 预估节省 |
|------|--------|----------|------------|---------|
| pro | 65% | 130K | 70K | ¥3.90 |
| flash | 45% | 90K | 110K | ¥0.18 |
| **总计** | **55%** | **220K** | **180K** | **¥4.08** |

### 2. 成本统计

按技能/按模型/按 Agent 分组，基于 DeepSeek 定价实时估算。

```bash
# 成本汇总
node .claude/helpers/kf-monitor-bridge.cjs cost

# 状态概览
node .claude/helpers/kf-monitor-bridge.cjs status
```

| 技能 | 模型 | Token输入 | Token输出 | 成本 |
|------|------|----------|----------|------|
| kf-spec | pro | 50K | 10K | ¥0.18 |
| kf-web-search | flash | 30K | 5K | ¥0.04 |

### 3. 异常检测

自动检测并标记以下异常模式：

| 异常类型 | 检测条件 | 严重程度 |
|---------|---------|---------|
| 缓存命中率骤降 | 命中率 < 20% | critical |
| 缓存命中率偏低 | 命中率 < 50% | warning |
| Token消耗突增 | 环比增长 > 200% | warning |
| 模型使用偏离 | pro/flash 比例偏离预期 > 50% | info |

### 4. Monitor API 集成

与端口 3456 的 monitor 面板集成，提供 Symphony API：

| 端点 | 说明 |
|------|------|
| `GET /api/v1/state` | 运行时快照：活跃技能、Agent 状态、内存使用 |
| `GET /api/v1/cache` | 缓存命中率数据：按模型分组的命中/未命中统计 |
| `GET /api/stats/tokens` | Token 趋势：按日期的输入/输出/成本 |
| `GET /api/stats/by-message-type` | 消息类型统计：用户 vs A2A 的缓存和费用分解 |

### 5. 桥接脚本

`kf-monitor-bridge.cjs` 连接 token-tracker 数据与 monitor 面板：

```bash
# 缓存命中率
node .claude/helpers/kf-monitor-bridge.cjs cache

# 成本汇总
node .claude/helpers/kf-monitor-bridge.cjs cost

# 运行时状态
node .claude/helpers/kf-monitor-bridge.cjs status
```

## 可视化展示

### 缓存命中率面板

```
## 缓存命中率面板

| 模型 | 命中率 | 命中Token | 未命中Token | 预估节省 |
|------|--------|----------|------------|---------|
| pro  | 65%    | 130K     | 70K        | ¥3.90   |
| flash| 45%    | 90K      | 110K       | ¥0.18   |
| **总计** | **55%** | **220K** | **180K** | **¥4.08** |
```

### 成本面板

```
## 成本面板

| 技能 | 模型 | Token输入 | Token输出 | 成本 |
|------|------|----------|----------|------|
| kf-spec | pro | 50K | 10K | ¥0.18 |
| kf-web-search | flash | 30K | 5K | ¥0.04 |
```

## 与现有系统的关系

| 系统 | 关系 |
|------|------|
| kf-token-tracker | 数据源：读取 Token 消耗和缓存命中数据 |
| kf-saver | 协同：监测者发现缓存命中率低，通知节流者优化 |
| monitor 面板 (port:3456) | 可视化：提供 API 数据给 Web 面板 |
| kf-model-router | 监测：跟踪模型选择及其成本影响 |

## 定价模型参考（每MTok，CNY）

| 模型 | 输入 | 输出 | 缓存读取 |
|------|------|------|---------|
| pro | ¥3 | ¥6 | ¥0.025 |
| flash | ¥1 | ¥2 | ¥0.02 |

## 文件清单

| 文件 | 位置 | 用途 |
|------|------|------|
| SKILL.md | .claude/skills/kf-monitor/ | 本文件 |
| kf-monitor-bridge.cjs | .claude/helpers/ | 桥接脚本：连接 token-tracker 与 monitor |
| stats.js (扩展) | 监测者/monitor/src/api/ | 新增 /api/v1/cache 端点 |
| stats.ejs (扩展) | 监测者/monitor/client/ | 新增缓存命中率展示区 |
