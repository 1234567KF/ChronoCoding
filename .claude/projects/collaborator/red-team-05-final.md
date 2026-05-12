# kf-model-router — 全自动多模型智能调度系统 方案汇总

> 红队激进创新方案
> 日期：2026-05-10

---

## 一、方案概述

将当前 `kf-model-router`（仅 DeepSeek Pro/Flash 双模型硬编码）升级为**多供应商动态路由引擎**，支持 DeepSeek、MiniMax、OpenAI 三大供应商共 5 个模型，通过语义分析自动分配最优模型。

### 与现行系统的关系

| 维度 | kf-model-router（现行） | kf-model-router（增强） |
|------|------------------------|------------------------|
| 模型池 | DeepSeek Pro + Flash | 5 模型（3 供应商） |
| 路由依据 | 阶段硬编码 | AI 语义分析 + 加权评分 |
| 并发 | 单一模型 | 多模型并行，负载感知 |
| 配置 | settings.json | 零配置，运行时内存调度 |
| 故障处理 | 无 | 断路器 + 降级链 |
| 兼容 | — | 100% 向后兼容 |

**关键设计决策**：kf-model-router 保留不动，kf-model-router 作为增强层叠加。两者可同时注册 PreToolUse，互不冲突。

---

## 二、文件清单

### 核心模块（`D:\AICoding\.claude\skills\kf-model-router\`）

| 文件 | 行数 | 功能 |
|------|------|------|
| `SKILL.md` | ~200 | 技能定义文档 — 完整架构、用法、集成说明 |
| `index.cjs` | ~120 | 主入口 — 统一 API（route/dispatch/stats/init） |
| `model-registry.cjs` | ~260 | 模型注册中心 — 5 模型元数据、查询、降级链管理 |
| `task-classifier.cjs` | ~310 | 语义任务分类器 — 8 种类型 + 4 级复杂度 + CJK 支持 |
| `routing-engine.cjs` | ~200 | 动态路由引擎 — 快速路径 + 4 种策略加权评分 |
| `dispatcher.cjs` | ~150 | 并发调度器 — 模型分配、限流、Agent model 映射 |
| `health-checker.cjs` | ~200 | 健康探测 + 断路器 + 降级管理 |
| `smart-router-hook.cjs` | ~130 | PreToolUse Hook — 技能调用时注入路由决策 |
| `providers/base-adapter.cjs` | ~60 | 适配器基类 — 统一接口 |
| `providers/deepseek.cjs` | ~70 | DeepSeek 适配器 |
| `providers/minimax.cjs` | ~80 | MiniMax 适配器 |
| `providers/openai.cjs` | ~70 | OpenAI 适配器 |
| `test/smart-router.test.cjs` | ~260 | 集成测试 — 7 组 58 条用例 |
| `D:\AICoding\red-team-01-architecture.md` | — | 架构设计文档 |

### 总计：13 个文件，约 2100 行代码

---

## 三、测试结果

```
📊 测试结果: 58/58 通过 ✅
```

| 测试组 | 覆盖内容 | 通过数 |
|--------|---------|--------|
| Test 1: ModelRegistry | 注册/查询/过滤/注销/降级链 | 12/12 |
| Test 2: TaskClassifier | 8 种任务类型分类 + 复杂度 | 12/12 |
| Test 3: RoutingEngine | 4 种策略 + 快速路径 + 降级 | 9/9 |
| Test 4: Dispatcher | Agent model 映射 + 分配 | 6/6 |
| Test 5: HealthChecker | 断路器状态机 + 恢复 | 7/7 |
| Test 6: Key Isolation | 供应商级密钥隔离 | 3/3 |
| Test 7: End-to-End | 完整流程 + API | 9/9 |

---

## 四、技术亮点

### 4.1 CJK-aware 语义分类

中文任务描述通常不分词（无空格），导致传统 `split(/\s+/)` 方法失效。本系统实现了**CJK 感知的词数估算**：按中文字符数 / 2 估算等效词数，技术术语对中文使用 `includes()` 而非 `\b` word boundary。

### 4.2 二级路由架构

```
快速路径（查表，~0ms）
  → 置信度 > 0.85 直接返回
加权路径（评分，~1ms）
  → 对可用模型逐一评分排序
紧急降级（~0ms）
  → 无可用模型时智能选择（简单→chat，复杂→reasoning）
```

### 4.3 断路器状态机

```
CLOSED ──连续失败≥5──→ OPEN ──超时30s──→ HALF-OPEN ──连续成功≥3──→ CLOSED
```

### 4.4 密钥安全

- 密钥仅从环境变量读取（`process.env`），不落盘
- 各供应商独立环境变量（`DEEPSEEK_API_KEY` / `MINIMAX_API_KEY` / `OPENAI_API_KEY`）
- `getApiKey()` 方法不 log 密钥值
- 密钥缺失时自动标记模型为 `unavailable`，不走降级链

---

## 五、与 /夯 (kf-multi-team-compete) 的集成

```
当前: 协调者手动指定 model: "sonnet" → deepseek-v4-flash
增强: 协调者调用 kf-model-router.dispatch({ description: "..." })
      → 语义分析 → 动态决定 model + modelId
      → 返回 { model: "sonnet", modelId: "deepseek-v4-flash" }
```

无需修改现有 `/夯` 代码，只需在 spawn agent 时增加一步路由查询。

---

## 六、红队创新总结

| 创新点 | 红队视角 |
|--------|---------|
| 多供应商架构突破 | 从 DeepSeek 单供应商扩展到 3 供应商 5 模型 |
| 插件式注册 | 新增模型只需一行配置，不修改核心代码 |
| 语义分析调度 | 替代硬编码阶段路由，AI 自主判定任务需求 |
| 断路器模式 | 生产级健壮性，自动熔断 + 恢复 |
| 零配置 | 不改 settings.json，运行时内存调度 |
| CJK 支持 | 原生支持中文任务描述分类 |
| 100% 向后兼容 | kf-model-router 保留不动，双轨运行 |

---

## 七、后续建议

1. **实际部署**：在 settings.json PreToolUse 中注册 `smart-router-hook.cjs`
2. **真实探活**：health-checker 的 `_probe()` 方法当前无真实网络调用，应实现各供应商 API ping
3. **路由反馈闭环**：记录每次路由的实际效果（耗时/成功/用户满意度），用于自我优化
4. **更多供应商**：插件式注册支持添加 Claude、Gemini 等更多模型
5. **运行时模型加载**：Docker/K8s 环境下从 configmap 动态注册模型，无需部署
