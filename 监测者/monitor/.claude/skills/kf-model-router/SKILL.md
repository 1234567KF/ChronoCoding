---
name: kf-model-router
description: 模型智能路由 — "省"原则。自动切换模型：计划阶段用 pro（深度思考），执行阶段用 flash（高效落地）。技能启动时自动触发，用户无感。触发词："模型路由"、"切换模型"、"省模式"。
metadata:
  principle: 省
  source: AICoding原则.docx
integrated-skills:
  - kf-spec            # Step 0 自动切换到 pro
  - kf-multi-team-compete  # 裁判用 pro，各队 agent 用 flash
  - kf-alignment        # 深度对齐自动切换到 pro
  - kf-prd-generator    # 产出 PRD 后切换回 flash
graph:
  dependencies:
    - target: kf-spec
      type: dependency
    - target: kf-prd-generator
      type: dependency
    - target: kf-reverse-spec
      type: dependency
    - target: kf-grant-research
      type: dependency
    - target: kf-add-skill
      type: dependency
    - target: kf-doc-consistency
      type: dependency
    - target: kf-autoresearch
      type: dependency
    - target: kf-token-tracker
      type: dependency
    - target: kf-langextract
      type: dependency
    - target: kf-multi-team-compete
      type: dependency

---

# kf-model-router — 省原则：模型智能路由

> **核心原则**：最好的模型和最性价比的模型搭配，结合工具方法稳固 ROI。
> **管理原则**：想的美，做的实。计划用 pro（深度推理），执行用 flash（高效落地）。
> **扩展**：支持多供应商模型池（DeepSeek + MiniMax-M1 + OpenAI），自动最优路由。
> **切换方式**：自动切换，用户无感。

---

## 记忆基线加载（铁律 4）

每次启动时 MUST 先读取 `memory/model-routing-stats.md` 中最近 5 条路由决策记录，了解历史切换模式和误切换案例，避免重复错误的路由决策。

---

## 模型路由规则（自动应用）

### 基础路由（向后兼容）

| 阶段 | 自动切换模型 | 原因 |
|------|------------|------|
| **计划/设计** | pro（deepseek-v4-pro） | 需要深度推理、架构决策、权衡取舍 |
| **执行/编码** | flash（deepseek-v4-flash） | 效率优先，常规编码任务不需要极致推理 |
| **代码审查** | flash（deepseek-v4-flash） | 模式匹配为主，性价比高 |
| **文档生成** | flash（deepseek-v4-flash） | 结构化输出，低成本 |
| **Bug 排查** | pro（deepseek-v4-pro） | 需要深度上下文理解和推理链 |
| **简单问答** | 轻量模型（Haiku 级） | 极低成本，快速响应 |

### 扩展路由（多供应商）★

启用条件：`model-registry.json` 存在 + 至少一个非 DeepSeek 供应商的 API Key 已配置。

| 任务类型 | 复杂度 | DeepSeek | MiniMax-M1 | OpenAI | 默认首选 |
|---------|--------|----------|------------|--------|---------|
| 架构/设计 | 高 | **pro** | M1-thinking | o3 | pro |
| 编码/实现 | 中 | **flash** | M1-fast | 4o-mini | flash |
| 代码审查 | 低 | **flash** | M1-fast | 4o-mini | flash |
| Bug 排查 | 高 | **pro** | M1-thinking | o3 | pro |
| 文档生成 | 低 | flash | **M1-fast** | 4o-mini | M1-fast |
| 简单问答 | 低 | flash | M1-fast | **4o-mini** | 4o-mini |
| 测试编写 | 中 | **flash** | M1-fast | 4o-mini | flash |
| UI 原型 | 中 | flash | **M1-fast** | 4o-mini | M1-fast |
| 计划/需求 | 高 | **pro** | M1-thinking | o3 | pro |

**降级链**：首选模型 → 同供应商备选 → 另一供应商同能力模型 → DeepSeek pro/flash。

---

## 扩展文件架构

```
.claude/
├── helpers/
│   ├── model-router-hook.cjs                  ← 入口 Hook（扩展）
│   ├── hooks/model-router-hook.cjs            ← 实际实现（扩展：多供应商路由）
│   ├── model-provider-registry.cjs            ← 新增：模型供应商注册表
│   ├── smart-dispatcher.cjs                   ← 新增：智能调度器（任务分类+模型分配）
│   └── model-health.cjs                       ← 新增：健康探测+断路器
└── skills/
    └── kf-model-router/
        ├── SKILL.md                           ← 本文件
        └── model-registry.json                ← 新增：模型配置数据
```

### 配置驱动注册新模型

编辑 `model-registry.json` 即可添加新供应商/模型，无需改代码：

```json
{
  "providers": [{
    "id": "new-provider",
    "name": "新供应商",
    "baseUrl": "https://api.example.com/v1",
    "envKey": "NEW_PROVIDER_API_KEY",
    "models": [{
      "id": "new-model-fast",
      "family": "fast",
      "capabilities": ["code", "chat", "docs"],
      "costPer1KInput": 0.3,
      "priority": 10,
      "defaultFor": ["simple-qa"]
    }]
  }]
}
```

---

## 自动触发机制

### 方式 1：技能 Frontmatter 声明（推荐）

其他技能在 SKILL.md frontmatter 中通过 `integrated-skills` 声明依赖 kf-model-router 后，
该技能启动时自动检查当前模型是否匹配推荐模型，不匹配则自动切换。

### 方式 2：Hook 自动检测

通过 `settings.json` 的 `PreToolUse` Hook 监听技能调用事件，
当匹配到声明了 `recommended_model` 的技能时，自动注入模型切换：

```json
{
  "matcher": "Skill",
  "hooks": [{
    "type": "command",
    "command": "node .claude/helpers/model-router-hook.cjs auto-route"
  }]
}
```

Hook 脚本逻辑（扩展后）：
1. 读取被调用技能的 SKILL.md frontmatter
2. 提取 `recommended_model` 字段或任务类型
3. 加载模型注册表（`model-registry.json`）
4. 探活可用模型（健康检测+断路器）
5. 分类任务 + 分配最佳模型（成本/能力/健康矩阵）
6. 任务完成后自动切回默认模型（flash）

### 方式 3：手动触发（调试/覆盖）

```
/set-model pro              # 手动切换到 pro（深度推理）
/set-model flash            # 手动切换到 flash（高效执行）
/set-model minimax-m1-fast  # 手动切换到 MiniMax M1 Fast
/set-model openai-4o-mini   # 手动切换到 OpenAI 4o-mini
模型路由                     # AI 分析当前任务并推荐模型
省模式                       # 自动进入执行模式（flash）
```

### 方式 4：Agent 级模型路由（/夯 内部）

当 `/夯`（kf-multi-team-compete）通过 `Agent` 工具 spawn 子 Agent 时，
每个 Agent 独立指定模型，互不干扰：

```javascript
Agent({
  description: "红队全栈开发",
  model: "sonnet",           // ← 映射到 deepseek-v4-flash（兼容）
  subagent_type: "...",
  run_in_background: true
})
```

**路由规则**：

| 角色 | Agent 类型 | model 参数 | 实际模型 | 原因 |
|------|-----------|-----------|---------|------|
| 协调者 | 本 Skill 自身 | 不设置（继承父级） | `deepseek-v4-pro` | 深度推理：任务拆解、裁判评分、方案融合 |
| 全栈开发 | agent_spawn | `"sonnet"` | `deepseek-v4-flash` | 高效执行：需求对齐、架构设计、编码实现 |
| 集成测试 | agent_spawn | `"sonnet"` | `deepseek-v4-flash` | 高效执行：测试编写、代码审查 |
| 前端设计师 | agent_spawn | `"sonnet"` | `deepseek-v4-flash` | 高效执行：UI 原型、方案汇总 |

---

## 各技能模型需求一览

| 技能 | 推荐模型 | 触发时机 |
|------|---------|---------|
| `kf-spec` | pro（Step 0-1），flash（Step 2-6） | Step 0 自动切 pro |
| `kf-multi-team-compete` `/夯` | pro（协调者+裁判+汇总），flash（各队 agent） | 协调者启动时用 pro；spawn agent 时传入 `model: "sonnet"` |
| `kf-alignment` | pro | 启动时自动切 pro |
| `kf-prd-generator` | flash | 启动时自动切 flash |
| `kf-code-review-graph` | flash | 启动时自动切 flash |
| `kf-web-search` | flash | 启动时自动切 flash |
| `kf-browser-ops` | flash | 启动时自动切 flash |
| `kf-triple-collaboration` | pro（协调）+ flash（各方） | 启动时自动分配 |
| `kf-skill-design-expert` | pro | 启动时自动切 pro |
| `kf-go` | flash | 启动时自动切 flash |
| `kf-ui-prototype-generator` | flash | 启动时自动切 flash |

---

## 模型供应商配置

| 供应商 | 环境变量 | 探活端点 | 缓存支持 |
|--------|---------|---------|---------|
| DeepSeek | `DEEPSEEK_API_KEY` | `/models` | KV Cache |
| MiniMax | `MINIMAX_API_KEY` | `/models` | 不支持 |
| OpenAI | `OPENAI_API_KEY` | `/models` | 不支持 |

配置方式：仅设置环境变量即可，无需修改 settings.json。

---

## 健康探测 + 断路器

| 功能 | 值 |
|------|-----|
| 探活超时 | 3s |
| 探活间隔 | 60s（缓存） |
| 连续失败阈值 | 3 次 |
| 熔断时长 | 120s |
| 恢复策略 | 熔断到期后单次探测 |

---

## ROI 参考

| 模型 | 相对成本 | 适用场景 |
|------|---------|---------|
| deepseek-v4-pro | 100% (¥3/K) | 架构设计、复杂 Bug、需求澄清 |
| deepseek-v4-flash | ~33% (¥1/K) | 日常编码、代码审查、文档 |
| minimax-m1-fast | ~17% (¥0.5/K) | 文档生成、UI 原型 |
| openai-4o-mini | ~5% (¥0.15/K) | 简单问答、格式转换 |
| minimax-m1-thinking | ~67% (¥2/K) | 深度推理备选 |
| openai-o3 | ~333% (¥10/K) | 高精度推理（成本敏感） |

**建议配比**：pro 15% + flash 60% + 4o-mini 15% + M1-fast 10%，综合成本 ~40%。
自动切换由 kf-model-router Hook 实现，默认开启。

---

## 集成

本 Skill 被以下 Skill **自动调用**：
- `kf-spec`：Step 0 技术选型 → 自动切 pro
- `kf-multi-team-compete`：裁判/汇总用 pro，agent 用 flash
- `kf-alignment`：深度对齐 → 自动切 pro
- `kf-prd-generator`：产出 PRD 后自动切回 flash
- 其他所有声明 `recommended_model` 的技能

## Harness 反馈闭环（铁律 3）

每次模型切换后 MUST 执行验证：

| 触发点 | 验证动作 | 失败处理 |
|--------|---------|---------|
| 模型切换 | `node .claude/helpers/harness-gate-check.cjs --skill kf-model-router --stage routing --required-sections "触发技能" "切换方向" "切换原因" --forbidden-patterns "未确认" "待定"` | 补充路由决策记录 |
| 周汇总 | `node .claude/helpers/harness-gate-check.cjs --skill kf-model-router --stage weekly --required-files "memory/model-routing-stats.md" --min-lines "memory/model-routing-stats.md" 20` | 补充缺失统计 |

路由原则：**计划用 pro（15%），执行用 flash（60%），低成本模型（25%）**。

## Harness 反馈统计（铁律 3）

每次模型切换后 MUST 记录路由决策到 `memory/model-routing-stats.md`：

```markdown
### {timestamp}
- **触发技能**：{skill name}
- **切换方向**：{from_model} → {to_model}
- **任务类型**：{task type}
- **分配供应商**：{provider name}
- **切换原因**：{recommended_model 声明 / 任务分类结果 / 多供应商路由}
- **Token 预估节省**：{如 pro→flash，约省 40-60%；如 pro→4o-mini，约省 95%}
```

每周汇总统计：
- 各供应商模型使用占比
- 各任务类型分布
- Token 成本节省估算
- 断路器触发记录
- 误切换案例（如果用户事后反馈"应该用 pro"）

路由原则：**计划用 pro（15%），执行用 flash（60%），低成本模型（25%）**。
