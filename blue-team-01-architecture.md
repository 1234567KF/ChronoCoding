# 蓝队 Stage 1 — 架构设计：多模型智能调度系统

> 在现有 kf-model-router 基础上**渐进扩展**，保留全部向后兼容性。

---

## 1. 设计原则

| 原则 | 说明 |
|------|------|
| **最小改动** | 不改现有代码结构，通过加新文件实现新功能 |
| **渐进式** | 先做配置驱动，再做智能调度 |
| **兼容性第一** | 现有 pro/flash 映射保留为默认降级 |
| **KV Cache 保持** | DeepSeek 缓存优化策略不变 |

---

## 2. 新增文件

```
.claude/
├── helpers/
│   ├── model-router-hook.cjs          ← 修改：扩展路由逻辑，新增多供应商调度
│   ├── model-provider-registry.cjs    ← 新增：模型供应商注册表
│   ├── smart-dispatcher.cjs           ← 新增：智能调度器（任务分类+模型分配）
│   └── model-health.cjs               ← 新增：健康探测+断路器
└── skills/
    └── kf-model-router/
        ├── SKILL.md                   ← 修改：扩展路由表
        └── model-registry.json        ← 新增：模型配置数据（JSON）
```

---

## 3. 核心架构

```
用户触发技能
    │
    ▼
model-router-hook.cjs（原有入口，向后兼容）
    │
    ├── 读取 SKILL.md frontmatter（原有逻辑）
    ├── 检查 old pro/flash 映射（原有逻辑）
    │
    └── [新] 多供应商路由 →
         │
         ├── model-provider-registry.cjs
         │   └── 加载 model-registry.json → 获取可用模型池
         │
         ├── smart-dispatcher.cjs
         │   ├── 轻量规则引擎分类任务
         │   └── 匹配最佳模型（成本+能力+健康状态矩阵）
         │
         └── model-health.cjs
             ├── 探活（ping 各供应商 API）
             ├── 断路器（连续失败 N 次后熔断 T 秒）
             └── 降级链（首选→备选→默认 pro/flash）
```

---

## 4. 模型路由表扩展

### 原有（2 行）

| 阶段 | 模型 |
|------|------|
| 计划/设计 | pro（deepseek-v4-pro） |
| 执行/编码 | flash（deepseek-v4-flash） |

### 扩展后（多维矩阵）

| 任务类型 | 复杂度 | DeepSeek | MiniMax-M1 | OpenAI | 默认降级 |
|---------|--------|----------|------------|--------|---------|
| 架构/设计 | 高 | **pro** | M1-thinking | o3 | pro |
| 编码/实现 | 中 | **flash** | M1-fast | 4o-mini | flash |
| 代码审查 | 低 | **flash** | M1-fast | 4o-mini | flash |
| Bug 排查 | 高 | **pro** | M1-thinking | o3 | pro |
| 文档生成 | 低 | flash | **M1-fast** | 4o-mini | flash |
| 简单问答 | 低 | flash | M1-fast | **4o-mini** | flash |
| 测试编写 | 中 | **flash** | M1-fast | 4o-mini | flash |
| UI 原型 | 中 | flash | **M1-fast** | 4o-mini | flash |

**加粗 = 该场景首选模型。** 所有场景的最终降级 = DeepSeek pro/flash。

---

## 5. 模型供应商注册表（配置驱动）

`model-registry.json` 结构：

```json
{
  "providers": [
    {
      "id": "deepseek",
      "name": "DeepSeek",
      "baseUrl": "https://api.deepseek.com/v1",
      "envKey": "DEEPSEEK_API_KEY",
      "models": [
        {
          "id": "deepseek-v4-pro",
          "family": "pro",
          "capabilities": ["deep-reasoning", "complex-code", "architecture"],
          "costPer1KInput": 3.0,
          "costPer1KOutput": 15.0,
          "cacheHitCostPer1K": 0.025,
          "supportsCache": true,
          "priority": 1,
          "defaultFor": ["architecture", "bug-debug", "planning"]
        },
        {
          "id": "deepseek-v4-flash",
          "family": "flash",
          "capabilities": ["code", "review", "qa", "docs"],
          "costPer1KInput": 1.0,
          "costPer1KOutput": 5.0,
          "cacheHitCostPer1K": 0.02,
          "supportsCache": true,
          "priority": 10,
          "defaultFor": ["coding", "review", "testing", "docs"]
        }
      ]
    },
    {
      "id": "minimax",
      "name": "MiniMax",
      "baseUrl": "https://api.minimax.chat/v1",
      "envKey": "MINIMAX_API_KEY",
      "models": [
        {
          "id": "minimax-m1-thinking",
          "family": "thinking",
          "capabilities": ["deep-reasoning", "planning"],
          "costPer1KInput": 2.0,
          "costPer1KOutput": 10.0,
          "supportsCache": false,
          "priority": 2,
          "defaultFor": []
        },
        {
          "id": "minimax-m1-fast",
          "family": "fast",
          "capabilities": ["code", "chat", "docs"],
          "costPer1KInput": 0.5,
          "costPer1KOutput": 2.0,
          "supportsCache": false,
          "priority": 11,
          "defaultFor": ["docs", "ui-prototype"]
        }
      ]
    },
    {
      "id": "openai",
      "name": "OpenAI",
      "baseUrl": "https://api.openai.com/v1",
      "envKey": "OPENAI_API_KEY",
      "models": [
        {
          "id": "openai-o3",
          "family": "reasoning",
          "capabilities": ["deep-reasoning", "complex-code"],
          "costPer1KInput": 10.0,
          "costPer1KOutput": 40.0,
          "supportsCache": false,
          "priority": 0,
          "defaultFor": []
        },
        {
          "id": "openai-4o-mini",
          "family": "fast",
          "capabilities": ["code", "chat", "docs", "review"],
          "costPer1KInput": 0.15,
          "costPer1KOutput": 0.6,
          "supportsCache": false,
          "priority": 12,
          "defaultFor": ["simple-qa", "formatting"]
        }
      ]
    }
  ],
  "routingFallback": {
    "strategy": "cost-first",
    "defaultProvider": "deepseek",
    "defaultModel": "deepseek-v4-flash"
  }
}
```

---

## 6. 任务分类规则引擎（轻量）

`smart-dispatcher.cjs` 使用**关键词匹配+启发式规则**（非 LLM 语义分析）：

| 分类 | 匹配关键词（任务描述中） | 分配模型 |
|------|------------------------|---------|
| architecture | 架构、设计、规划、权衡、方案选型 | pro / M1-thinking / o3 |
| bug-debug | bug、错误、排查、调试、堆栈、异常 | pro / M1-thinking / o3 |
| planning | 计划、需求、分析、PRD、Spec | pro / M1-thinking / o3 |
| coding | 编码、实现、开发、功能、feature | flash / M1-fast / 4o-mini |
| review | 审查、review、代码审查、CR | flash / M1-fast / 4o-mini |
| testing | 测试、单元测试、集成测试、e2e | flash / M1-fast / 4o-mini |
| docs | 文档、README、注释、文档生成 | flash / M1-fast / 4o-mini |
| ui-prototype | UI、原型、界面、布局、组件 | flash / M1-fast / 4o-mini |
| simple-qa | 问答、查询、解释、是什么 | flash / M1-fast / 4o-mini |

---

## 7. 密钥管理

| 供应商 | 环境变量 | 说明 |
|--------|---------|------|
| DeepSeek | `DEEPSEEK_API_KEY` | 已有 |
| MiniMax | `MINIMAX_API_KEY` | 新增 |
| OpenAI | `OPENAI_API_KEY` | 新增 |

密钥**仅从环境变量读取**，不写入 settings.json 或任何文件。

---

## 8. 健康探测+断路器（model-health.cjs）

| 功能 | 实现 |
|------|------|
| **探活** | 向各供应商 API 发送轻量请求（支持中的 `models` 端点或 chat completion with max_tokens=1），超时 3s |
| **探活间隔** | 每 60s 一次（缓存结果避免频繁请求） |
| **断路器** | 连续 3 次失败 → 熔断该模型 120s |
| **恢复** | 熔断到期后发送一次探测，成功则恢复 |
| **降级顺序** | 首选模型 → 同供应商备选 → 另一供应商同能力模型 → DeepSeek pro/flash |

---

## 9. 向后兼容性保证

| 现有功能 | 兼容措施 |
|---------|---------|
| `settings.json` 中 `modelPreferences` | 完全保留，作为最外层 fallback |
| SKILL.md 中 `recommended_model: pro/flash` | 映射到 DeepSeek pro/flash |
| Agent spawn 时 `model: "sonnet"` | 映射到 `deepseek-v4-flash` |
| `integrated-skills: [kf-model-router]` | 不变，hook 入口不变 |
| KV Cache 优化策略 | 仅 DeepSeek 模型启用 cache，不受影响 |

---

## 10. 调用流程图

```
Skill Hook 触发 [PreToolUse]
    │
    ▼
model-router-hook.cjs (入口)
    │
    ├── [旧] 解析 frontmatter → 检查 recommended_model
    │   └── 匹配到 pro/flash → 沿用旧逻辑输出指令
    │
    ├── [新] 检查是否有增强配置 (model-registry.json 存在)
    │   └── 不存在 → 完全沿用旧逻辑，零影响
    │
    └── [新] 存在增强配置 →
         │
         ├── model-provider-registry.load()  →  加载模型池
         ├── model-health.probe()            →  过滤不可用模型
         ├── smart-dispatcher.classify(task) →  确定任务类型
         └── smart-dispatcher.assign(type, pool) → 输出路由指令
```

---

## 11. ROI 预期

| 场景 | 当前（仅 DeepSeek） | 扩展后（多供应商） | 收益 |
|------|-------------------|-------------------|------|
| 简单问答 | flash ¥1/M | 4o-mini ¥0.15/M | **节省 85%** |
| 文档生成 | flash ¥1/M | M1-fast ¥0.5/M | **节省 50%** |
| 深度推理 | pro ¥3/M | M1-thinking ¥2/M | **节省 33%** |
| 高精度推理 | pro ¥3/M | o3 ¥10/M | 成本上升但质量更高（可选） |
