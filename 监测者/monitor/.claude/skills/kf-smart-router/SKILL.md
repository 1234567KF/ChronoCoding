---
name: kf-smart-router
description: |
  全自动多模型智能调度系统。分析任务语义，动态分配最优模型（DeepSeek Pro/Flash + MiniMax 2.7 + OpenAI Codex/4o-mini）。
  多供应商路由 + 断路器 + 降级链 + 密钥隔离。零配置，运行时内存调度。
  触发语："智能路由"、"模型调度"、"多模型路由"、"smart router"。
triggers:
  - 智能路由
  - 模型调度
  - 多模型路由
  - smart router
  - 路由调度
  - 多模型
metadata:
  principle: 省 + 准
  status: alpha
  version: 1.0.0
  source: 红队激进创新方案 — 全自动多模型智能调度系统
  integrated-skills:
    - kf-model-router
    - kf-multi-team-compete
    - kf-spec
    - kf-alignment
    - kf-prd-generator
  capabilities:
    - multi-vendor-routing: "多供应商动态路由（DeepSeek/MiniMax/OpenAI）"
    - semantic-classification: "语义任务分类（8 种类型 + 4 级复杂度）"
    - weighted-scoring: "加权评分选优（4 种策略）"
    - circuit-breaker: "断路器 + 健康探测 + 自动恢复"
    - fallback-chain: "降级链（最多 4 级，含 SAFE_MODE）"
    - key-isolation: "密钥隔离（各供应商独立环境变量）"
    - cache-compatible: "DeepSeek KV Cache 保留"
    - zero-config: "零手动配置，运行时内存调度"
graph:
  dependencies:
    - target: kf-model-router
      type: enhancement  # 增强层，不替代
    - target: kf-multi-team-compete
      type: dependency  # agent 分派时调用
    - target: kf-spec
      type: dependency  # spec 写作自动路由
    - target: kf-alignment
      type: dependency  # 对齐自动路由
    - target: kf-prd-generator
      type: dependency  # PRD 自动路由
    - target: kf-code-review-graph
      type: dependency  # 审查自动路由
    - target: kf-web-search
      type: dependency  # 搜索自动路由
    - target: kf-triple-collaboration
      type: dependency  # 协作自动路由

---

# kf-smart-router — 全自动多模型智能调度系统

> **红队激进创新方案**：将 kf-model-router 从"双模型硬编码"升级为"多供应商动态路由引擎"。
> 原则：省（最大性价比）+ 准（语义分析精准分配）

---

## 架构总览

```
任务描述
  │
  ├─ Task Classifier ──→ 语义分析 → 类型 + 复杂度
  │
  ├─ Model Registry ───→ 查询可用模型池
  │
  ├─ Routing Engine ───→ 加权评分 → 选择最优
  │     │
  │     ├─ 快速路径（查表，置信度 > 0.85）
  │     └─ 加权路径（4 种策略）
  │
  ├─ Health Checker ───→ 断路器检查 + 降级
  │     │
  │     └─ 异常 → 走降级链 (最多 4 级)
  │
  └─ Dispatcher ──────→ 密钥注入 + 返回 model 参数
```

## 支持的模型池

| 模型 | 供应商 | 类型 | 适用场景 | 相对成本 | 环境变量 |
|------|--------|------|---------|---------|---------|
| deepseek-v4-flash | DeepSeek | chat | 日常编码/审查/文档 | 低 | DEEPSEEK_API_KEY |
| deepseek-v4-pro | DeepSeek | reasoning | 架构/深度 debug/计划 | 中 | DEEPSEEK_API_KEY |
| minimax-2.7 | MiniMax | reasoning | 长上下文/强推理 | 低 | MINIMAX_API_KEY |
| openai-codex | OpenAI | code | 代码生成 | 低 | OPENAI_API_KEY |
| openai-4o-mini | OpenAI | chat | 简单 QA/格式化 | 极低 | OPENAI_API_KEY |

## 路由策略

| 策略 | 说明 | 命令 |
|------|------|------|
| balanced | 平衡性价比和性能（默认） | `node index.cjs route "任务"` |
| cost_optimized | 性价比优先 | `node index.cjs route "任务" -s cost_optimized` |
| performance_optimized | 性能优先 | `node index.cjs route "任务" -s performance_optimized` |
| fallback_only | 仅降级模型 | `node index.cjs route "任务" -s fallback_only` |

## 断路器机制

```
CLOSED (正常) ──连续失败≥5──→ OPEN (熔断)
   ↑                            │
   │                            ↓
   恢复 ←──超时30s──→ HALF-OPEN (尝试恢复)
```

## 降级链示例

```
deepseek-v4-pro → minimax-2.7 → openai-codex → deepseek-v4-flash → SAFE_MODE
deepseek-v4-flash → openai-4o-mini → openai-codex → deepseek-v4-pro → SAFE_MODE
```

## 文件结构

```
.claude/skills/kf-smart-router/
├── SKILL.md                   # 本文件 — 技能定义
├── index.cjs                  # 主入口 — 统一 API
├── model-registry.cjs         # 模型注册中心
├── task-classifier.cjs        # 语义任务分类器
├── routing-engine.cjs         # 动态路由引擎
├── dispatcher.cjs             # 并发调度器
├── health-checker.cjs         # 健康探测 + 断路器 + 降级
├── smart-router-hook.cjs      # PreToolUse Hook
├── providers/
│   ├── base-adapter.cjs       # 适配器基类
│   ├── deepseek.cjs           # DeepSeek 适配器
│   ├── minimax.cjs            # MiniMax 适配器
│   └── openai.cjs             # OpenAI 适配器
└── test/
    └── smart-router.test.cjs  # 集成测试
```

## 使用方法

### CLI 模式

```bash
# 路由决策
node .claude/skills/kf-smart-router/index.cjs route "写一个用户登录模块"

# 调度决策（含 agent model 映射）
node .claude/skills/kf-smart-router/index.cjs dispatch "重构订单系统架构"

# 查看统计
node .claude/skills/kf-smart-router/index.cjs stats

# 健康检查
node .claude/skills/kf-smart-router/index.cjs health-check

# 初始化
node .claude/skills/kf-smart-router/index.cjs init
```

### 编程接口

```javascript
const router = require('./index.cjs');

// 路由决策
const decision = await router.route({
  description: "实现一个分布式缓存层",
});

console.log(decision.model.id);        // "deepseek-v4-pro"
console.log(decision.fallbackChain);   // ["deepseek-v4-pro", "minimax-2.7", ...]
console.log(decision.confidence);      // 0.95

// 直接获取 agent model 参数
const agentConfig = await router.dispatch({
  description: "修复登录页面的样式 bug",
});

console.log(agentConfig.model);        // "sonnet"
console.log(agentConfig.modelId);      // "deepseek-v4-flash"
```

### Hook 集成

注册到 settings.json PreToolUse:

```json
{
  "matcher": "Skill",
  "hooks": [
    {
      "type": "command",
      "command": "node .claude/helpers/model-router-hook.cjs",
      "timeout": 5000
    },
    {
      "type": "command",
      "command": "node .claude/skills/kf-smart-router/smart-router-hook.cjs",
      "timeout": 5000
    }
  ]
}
```

## 模型路由映射

kf-smart-router model ID → Claude Code Agent model string:

| kf-smart-router ID | Agent model | 等级 |
|-------------------|-------------|------|
| deepseek-v4-pro | opus | pro 级推理 |
| minimax-2.7 | opus | pro 级推理 |
| deepseek-v4-flash | sonnet | flash 级执行 |
| openai-codex | sonnet | 代码专用 |
| openai-4o-mini | haiku | 轻量级 |

## KV Cache 兼容

DeepSeek 模型的 KV Cache 优化策略完全保留：
- 共享前缀机制不变（前 300-500 token 逐字相同）
- 预热策略：spawn 第一个 agent 前预热
- 多轮保持：messages 连续追加
- 监控：从 API 响应读取 cache hit/miss token

不支持缓存的模型（如 MiniMax）跳过预热步骤。

## Harness 集成

```bash
# 验证路由决策
node .claude/helpers/harness-gate-check.cjs \
  --skill kf-smart-router \
  --stage routing \
  --required-sections "任务类型" "推荐模型" "置信度"

# 验证健康状态
node .claude/helpers/harness-gate-check.cjs \
  --skill kf-smart-router \
  --stage health \
  --required-fields "status" "circuit_breaker"
```

## 与 kf-model-router 的关系

- **kf-model-router**：保留不动（向后兼容），处理 DeepSeek Pro/Flash 双模型切换
- **kf-smart-router**：增强层，优先级更高，处理多供应商动态路由
- 当 kf-smart-router 不可用时，自动回退到 kf-model-router
- 两者可同时注册到 PreToolUse，互不冲突
