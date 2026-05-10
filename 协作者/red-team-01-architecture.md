# kf-smart-router — 全自动多模型智能调度系统架构

> 红队视角：激进创新、架构突破、性能极致

---

## 1. 架构总览

### 1.1 设计目标

将当前 kf-model-router（仅 DeepSeek Pro/Flash 硬编码双模型）升级为**多供应商动态路由引擎**，支持：

| 能力 | 当前系统 | 目标系统 |
|------|---------|---------|
| 模型池 | DeepSeek Pro + Flash | DeepSeek Pro/Flash + MiniMax-M1 + OpenAI Codex/4o-mini |
| 路由依据 | 阶段硬编码（计划=pro，执行=flash） | AI 语义分析任务自动判定 |
| 并发模型 | 所有 agent 同一模型 | 不同 agent 可用不同模型并行 |
| 配置方式 | settings.json 硬编码 | 运行时内存调度，零配置 |
| KV 缓存 | 有独立规则 | 保留并增强 |
| 故障处理 | 无 | 断路器 + 自动降级 |

### 1.2 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                      kf-smart-router 核心系统                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │ Model Registry│    │    Task      │    │   Routing    │       │
│  │  模型注册中心  │    │  Classifier  │    │    Engine    │       │
│  │              │    │  语义分类器   │    │  路由引擎    │       │
│  │  · 注册/注销  │    │              │    │              │       │
│  │  · 能力模型   │    │  · 复杂度判定│    │  · 加权评分  │       │
│  │  · 成本模型   │    │  · 类型识别  │    │  · 策略选择  │       │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘       │
│         │                   │                   │                │
│         └───────────────────┼───────────────────┘                │
│                             │                                    │
│                    ┌────────▼────────┐                           │
│                    │   Dispatcher    │                           │
│                    │   并发调度器     │                           │
│                    │                 │                           │
│                    │  · Agent 分派   │                           │
│                    │  · 密钥注入     │                           │
│                    │  · 生命周期     │                           │
│                    └────────┬────────┘                           │
│                             │                                    │
│                    ┌────────▼────────┐                           │
│                    │  Health Checker │                           │
│                    │   健康探测器     │                           │
│                    │                 │                           │
│                    │  · 探活         │                           │
│                    │  · 断路器       │                           │
│                    │  · 降级链       │                           │
│                    └─────────────────┘                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 模型注册中心 (Model Registry)

### 2.1 注册表结构

```javascript
{
  // 模型唯一标识
  id: "deepseek-v4-pro",
  // 供应商
  provider: "deepseek",
  // 显示名称
  name: "DeepSeek V4 Pro",
  // 类型: chat / code / reasoning
  type: "reasoning",

  // 能力模型 (0-1 评分)
  capabilities: {
    reasoning: 0.95,    // 深度推理能力
    coding: 0.88,       // 编码能力
    creativity: 0.75,   // 创造力
    speed: 0.60,        // 响应速度
    context: 0.90,      // 上下文长度支持
    instruction: 0.92,  // 指令跟随
    cost_efficiency: 0.33 // 性价比
  },

  // 成本模型 (每百万 token)
  cost: {
    input: 3.0,         // 输入 ¥/M tokens
    output: 12.0,       // 输出 ¥/M tokens
    cache_hit_input: 0.025, // 缓存命中输入价格
    currency: "CNY"
  },

  // 适用任务类型
  suitable_for: [
    "architecture",     // 架构设计
    "complex_bug",      // 复杂 bug 排查
    "requirement_analysis", // 需求分析
    "code_review",      // 代码审查(深度)
    "planning"          // 任务规划
  ],

  // API 配置模板
  api: {
    base_url: "https://api.deepseek.com/v1",
    model_name: "deepseek-chat",
    api_key_env: "DEEPSEEK_API_KEY",
    supports_cache: true,
    supports_streaming: true
  },

  // 限流配置
  rate_limit: {
    rpm: 100,
    tpm: 100000,
    concurrency: 10
  },

  // 健康状态 (运行时)
  health: {
    status: "unknown",  // unknown / healthy / degraded / down
    last_check: null,
    failure_count: 0,
    circuit_breaker: "closed"  // closed / half-open / open
  }
}
```

### 2.2 支持的模型

| 模型 ID | 供应商 | 类型 | 优势 | 成本(输入) | 密钥环境变量 |
|---------|--------|------|------|-----------|-------------|
| deepseek-v4-pro | DeepSeek | reasoning | 深度推理 | ¥3/M | DEEPSEEK_API_KEY |
| deepseek-v4-flash | DeepSeek | chat | 高性价比 | ¥1/M | DEEPSEEK_API_KEY |
| minimax-m1 | MiniMax | reasoning | 长上下文,强推理 | ¥2/M | MINIMAX_API_KEY |
| openai-codex | OpenAI | code | 代码生成 | $0.15/M | OPENAI_API_KEY |
| openai-4o-mini | OpenAI | chat | 快速轻量 | $0.15/M | OPENAI_API_KEY |

### 2.3 API 差异抽象层

不同供应商 API 格式不同，需要统一适配：

```javascript
// 统一请求格式
{
  model: "deepseek-v4-pro",    // 注册中心 ID
  messages: [...],
  temperature: 0.7,
  max_tokens: 4096,
  stream: false
}

// 适配器负责转换为各供应商格式
adapters: {
  "deepseek":   { /* 兼容 OpenAI 格式 */ },
  "minimax":    { /* MiniMax 专用格式转换 */ },
  "openai":     { /* OpenAI 标准格式 */ }
}
```

---

## 3. 语义任务分类器 (Task Classifier)

### 3.1 分类维度

| 维度 | 值域 | 说明 |
|------|------|------|
| 复杂度 | simple / medium / complex / very_complex | 基于任务描述的长度、技术术语密度、依赖关系 |
| 任务类型 | coding / architecture / review / debug / doc / question / planning | 任务类别 |
| 推理需求 | low / medium / high / critical | 需要深度推理的程度 |
| 上下文需求 | low / medium / high | 需要处理的上下文量 |
| 创造性需求 | low / medium / high | 需要创新/创造的程度 |

### 3.2 分类算法

使用轻量级关键词+规则+LLM 辅助：

```
Step 1: 关键词匹配（快速预分类）
  - 包含"架构/设计/权衡/选型" → 复杂度+1, 类型倾向 architecture
  - 包含"bug/排查/修复/调试" → 复杂度+1, 类型倾向 debug
  - 包含"测试/验证/审查/评审" → 复杂度 normal, 类型倾向 review

Step 2: 长度+术语密度分析
  - 任务描述 > 200 字 → 复杂度+1
  - 技术术语密度 > 30% → 复杂度+1
  - 文件引用 > 3 → 上下文需求 high

Step 3: LLM 辅助分类（仅当规则不确定时）
  - 当置信度 < 0.7 时，调用轻量模型做语义理解
  - 输出结构化分类结果

Step 4: 加权综合评分
  - 各维度得分 * 权重 → 最终分类
```

### 3.3 复杂度判定标准

| 等级 | 判定条件 | 典型场景 |
|------|---------|---------|
| simple | 单文件、明确需求、无外部依赖 | 修改变量名、格式转换 |
| medium | 2-3 文件、单一模块、少量依赖 | 新增 API 端点、修复已知 bug |
| complex | 多文件、跨模块、需架构决策 | 新功能模块、中等重构 |
| very_complex | 全系统、多团队协作、架构选型 | 系统重写、技术栈迁移 |

---

## 4. 动态路由引擎 (Routing Engine)

### 4.1 路由策略

| 策略 | 说明 | 适用场景 |
|------|------|---------|
| cost_optimized | 性价比优先 | 每日开发任务 |
| performance_optimized | 性能优先 | 关键路径、复杂任务 |
| balanced | 平衡性价比和性能 | 默认策略 |
| fallback_only | 仅使用降级模型 | 高负载、预算有限 |
| manual_override | 用户指定模型 | 调试、特殊需求 |

### 4.2 加权评分算法

```javascript
function scoreModel(model, taskProfile, strategy) {
  const weights = strategies[strategy]; // 不同策略的不同权重

  let score = 0;
  score += model.capabilities.reasoning * weights.reasoning * taskProfile.reasoning_need;
  score += model.capabilities.coding * weights.coding * (taskProfile.type === 'coding' ? 1.5 : 0.5);
  score += model.capabilities.speed * weights.speed;
  score += model.capabilities.cost_efficiency * weights.cost * (1 / model.cost.input);

  // 缓存命中加成
  if (model.supportsCache) {
    score += 0.1 * weights.cost;
  }

  // 健康状态扣分
  if (model.health.status === 'degraded') score *= 0.7;
  if (model.health.status === 'down') score = 0;

  return score;
}
```

### 4.3 路由决策流程

```
任务描述
  │
  ├──→ Task Classifier 分析 → taskProfile
  │
  ├──→ 获取可用模型列表（排除 down 状态）
  │     │
  │     ├──→ 对每个可用模型计算加权评分
  │     │
  │     └──→ 按评分排序 → 选择 Top-1
  │
  ├──→ 检查候选模型的降级链
  │     │
  │     └──→ 健康检查通过 → 选择该模型
  │              ↓
  │         健康检查失败 → 走降级链
  │
  └──→ 返回路由决策 { model, fallbackChain }
```

### 4.4 默认路由映射（快速路径）

当 Task Classifier 置信度 > 0.85 时，直接查表：

| 任务类型 | 默认模型 | 降级链 |
|---------|---------|--------|
| simple + coding | deepseek-v4-flash | openai-4o-mini → deepseek-v4-pro |
| medium + coding | deepseek-v4-flash | deepseek-v4-pro → openai-codex |
| complex + coding | deepseek-v4-pro | openai-codex → deepseek-v4-flash |
| very_complex + coding | deepseek-v4-pro | minimax-m1 → openai-codex |
| architecture/planning | deepseek-v4-pro | minimax-m1 → deepseek-v4-flash |
| review | deepseek-v4-flash | openai-4o-mini → deepseek-v4-pro |
| debug | deepseek-v4-pro | openai-codex → deepseek-v4-flash |
| simple + question | openai-4o-mini | deepseek-v4-flash |

---

## 5. 并发调度器 (Dispatcher)

### 5.1 调度架构

```
Agent Spawn Request
  │
  ├── 1. 路由引擎返回推荐模型 + 降级链
  │
  ├── 2. Dispatcher 检查该模型当前负载
  │     │
  │     ├── 未超限流 → 继续
  │     └── 超限流 → 走降级链
  │
  ├── 3. 密钥隔离注入
  │     │
  │     └── 从环境变量读取对应密钥，注入 agent 上下文
  │
  └── 4. 记录调度决策 → 返回 model 参数
```

### 5.2 Agent Model 参数映射

不同 Agent 工具使用不同的模型参数：

```javascript
// Claude Code Agent tool
Agent({ description: "...", model: "sonnet", ... })

// 映射表 kf-smart-router model id → Agent model string
modelMap: {
  "deepseek-v4-pro":    "opus",        // pro 级推理
  "deepseek-v4-flash":  "sonnet",      // flash 级执行
  "minimax-m1":         "opus",        // pro 级推理
  "openai-codex":       "sonnet",      // 代码专用
  "openai-4o-mini":     "haiku"        // 轻量级
}
```

### 5.3 密钥隔离架构

```
┌──────────────┐
│  环境变量     │
│              │
│ DEEPSEEK_API_KEY=sk-xxx         │
│ MINIMAX_API_KEY=mm-xxx          │
│ OPENAI_API_KEY=sk-xxx           │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  密钥管理器   │
│              │
│ getApiKey(provider, model)      │
│   → 返回对应密钥               │
│   → 如果密钥不存在: 标记模型不可用 │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Agent 注入   │
│              │
│ spawn Agent 时注入:             │
│   · model: "sonnet"             │
│   · env: { DEEPSEEK_API_KEY }   │
│   (通过 settings.json env 传递)  │
└─────────────────┘
```

---

## 6. 健康探测 + 断路器 + 降级 (Health Checker)

### 6.1 健康探测

```javascript
// 每个模型定期探测
async function healthCheck(modelId) {
  const model = registry.get(modelId);
  const start = Date.now();

  try {
    // 调用轻量 API
    const response = await callModel(model, {
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 10
    });

    const latency = Date.now() - start;

    model.health = {
      status: latency < 5000 ? "healthy" : "degraded",
      last_check: Date.now(),
      latency,
      failure_count: 0
    };

    if (model.health.circuit_breaker === "half-open") {
      model.health.circuit_breaker = "closed"; // 恢复
    }
  } catch (error) {
    model.health.failure_count++;
    model.health.last_check = Date.now();

    // 断路器逻辑
    if (model.health.failure_count >= 5) {
      model.health.circuit_breaker = "open";
      model.health.status = "down";
    }
  }
}
```

### 6.2 断路器状态机

```
  ┌──────────┐   连续失败 >= 5     ┌──────────┐
  │  CLOSED  │ ──────────────────→  │   OPEN   │
  │ (正常)    │                      │ (熔断)    │
  └────┬─────┘                      └────┬─────┘
       │                                 │
       │ 连续成功 >= 3                    │ 超时等待 30s
       │ ←──────────────────              │ ←──────────────
  ┌──────────┐                      ┌───────────┐
  │ HALF-OPEN│                      │  TIMEOUT  │
  │ (半开)    │                      │ (等待恢复) │
  └──────────┘                      └───────────┘
```

### 6.3 降级链

每个模型有完整降级链，逐级尝试：

```
primary model → fallback 1 → fallback 2 → fallback 3 → SAFE_MODE

SAFE_MODE = 使用本地规则做最基础处理（无 LLM 调用）
```

例：
```
deepseek-v4-pro → minimax-m1 → openai-codex → SAFE_MODE
deepseek-v4-flash → openai-4o-mini → openai-codex → SAFE_MODE
openai-codex → deepseek-v4-pro → deepseek-v4-flash → SAFE_MODE
```

---

## 7. KV 缓存保持策略

DeepSeek 的 KV Cache 优化策略是当前系统的重要特性，必须保留：

| 缓存策略 | 在 kf-smart-router 中的实现 |
|---------|--------------------------|
| 共享前缀 | 所有 agent prompt 前 300-500 token 逐字相同 |
| 预热策略 | spawn 第一个 agent 前先预热 |
| 多轮保持 | messages 连续追加，不中途清历史 |
| 监控 | 从 API 响应读取 cache hit/miss |

**多模型场景下**：
- DeepSeek 模型 → 保留完整缓存优化
- MiniMax/OpenAI 模型 → 如果支持缓存则沿用相同策略
- 不支持缓存的模型 → 跳过预热步骤

---

## 8. 与现有系统集成

### 8.1 与 kf-model-router 的关系

- **kf-model-router** 保留不动（向后兼容）
- **kf-smart-router** 作为增强层，优先级高于 kf-model-router
- 当 kf-smart-router 可用时，自动覆盖 kf-model-router 的路由决策
- 当 kf-smart-router 不可用时，回退到 kf-model-router

### 8.2 与 /夯 (kf-multi-team-compete) 的集成

```
当前:   协调者指定 model: "sonnet" → deepseek-v4-flash
增强后: 协调者调用 kf-smart-router → 动态决定 model 参数
        → Dispatcher 根据 taskProfile + 模型健康状态
        → 返回 model: "sonnet" 或 "opus" 或 "haiku"
```

### 8.3 Hook 集成

在 settings.json 的 PreToolUse Skill matcher 中追加 kf-smart-router hook：

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

---

## 9. 数据流全景

```
用户 / Agent 发起任务
  │
  ▼
┌──────────────────────┐
│ 1. Task Classifier   │
│   语义分析任务描述    │
│   → taskProfile      │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ 2. Model Registry    │
│   查询可用模型       │
│   → modelList        │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ 3. Health Checker    │
│   过滤异常模型       │
│   → healthyModelList │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ 4. Routing Engine    │
│   加权评分 + 选优    │
│   → decision         │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ 5. Dispatcher        │
│   密钥注入 + 分派    │
│   → spawn model      │
└──────────┬───────────┘
           │
           ▼
    Agent 执行任务
           │
           ▼
┌──────────────────────┐
│ 6. 执行完成回写       │
│   更新模型统计       │
│   (成功/失败/延迟)    │
└──────────────────────┘
```

---

## 10. 文件结构

```
.claude/skills/kf-smart-router/
├── SKILL.md                 # 技能定义文档
├── index.cjs                # 主入口，暴露统一 API
├── model-registry.cjs       # 模型注册中心
├── task-classifier.cjs      # 语义任务分类器
├── routing-engine.cjs       # 动态路由引擎
├── dispatcher.cjs           # 并发调度器
├── health-checker.cjs       # 健康探测 + 断路器 + 降级
├── providers/
│   ├── base-adapter.cjs     # 供应商适配器基类
│   ├── deepseek.cjs         # DeepSeek 适配器
│   ├── minimax.cjs          # MiniMax 适配器
│   └── openai.cjs           # OpenAI 适配器
├── smart-router-hook.cjs    # PreToolUse Hook（注入路由决策）
└── test/
    └── smart-router.test.cjs # 集成测试
```

---

## 11. 非功能需求

| 需求 | 指标 | 实现方式 |
|------|------|---------|
| 路由延迟 | < 100ms | 快速路径查表 + 缓存分类结果 |
| 断路器恢复 | 30s 后自动半开 | 定时器 + 探活 |
| 密钥安全 | 不落盘、不打印 | 仅内存读取 env，禁止 log |
| 向后兼容 | 100% | kf-model-router 保留不动 |
| 可扩展性 | 插件式注册 | 新增模型只需加配置 |
