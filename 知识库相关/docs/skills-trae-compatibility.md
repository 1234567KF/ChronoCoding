# 技能全览 — Trae 兼容性 & 衍生调用表

> 更新时间：2026-05-03 | 总计 **67 个技能**（16 kf- 系列 + 46 gstack + 1 gspowers + 4 OpenClaw）

---

## Trae 兼容性标记说明

| 标记 | 含义 |
|------|------|
| v | **完全兼容** — 纯 Prompt/脚本驱动，无需 Claude Code 特有功能 |
| ~ | **部分兼容** — 核心逻辑可用，但 Agent Spawn / Hook 自动触发 / MCP 等功能不可用 |
| - | **不兼容** — 重度依赖 Claude Code 特有功能（Agent 并行、Hook、Skill 工具等） |

> **参考**：[`.trae/rules/project_rules.md`](.trae/rules/project_rules.md) 已列出 Claude Code 与 Trae Builder 的核心能力差异，
> 以及串行降级、Harness 自检等适配约定。

---

## 一、kf- 系列（自建技能，16 个）

| # | 技能 | 原则 | Trae | 衍生调用 / 被调用关系 |
|---|------|------|:---:|------|
| 1 | **kf-alignment** `/对齐` | 懂 | v | 被 kf-spec、kf-multi-team-compete、kf-prd-generator、kf-code-review-graph、kf-scrapling、kf-ui-prototype-generator 自动调用 |
| 2 | **kf-model-router** `/模型路由` | 省 | - | 自动触发于所有 kf- 技能启动时；Trae 需手动按路由表选模型 |
| 3 | **kf-go** `/go` | 快 | ~ | 列出 10 个子技能路径；Trae 中路由机制不可用，清单仍可参考 |
| 4 | **kf-spec** `/spec` | 快 | ~ | 调用 kf-alignment、kf-model-router；核心 Spec 6 步流水线在 Trae 中可手动执行 |
| 5 | **kf-code-review-graph** `/review-graph` | 省 | ~ | 调用 kf-alignment（产出后对齐）；依赖图谱分析逻辑通用 |
| 6 | **kf-web-search** `/web-search` | 准 | v | 被 kf-multi-team-compete、kf-spec 按需调用；多引擎搜索纯 Prompt 驱动 |
| 7 | **kf-scrapling** | 准 | ~ | 调用 kf-alignment；被 kf-multi-team-compete Stage 1/2/3 调用；Python 脚本通用，反反爬能力在 Trae 中可用 |
| 8 | **kf-browser-ops** `/browser-ops` | 测的准 | ~ | 被 kf-multi-team-compete Stage 3 调用；Playwright 脚本通用，Agent 编排不可用 |
| 9 | **kf-multi-team-compete** `/夯` | 夯 | ~ | **核心调度器**：自动调用 kf-alignment → kf-web-search → kf-scrapling → kf-ui-prototype-generator → kf-image-editor → kf-browser-ops → kf-code-review-graph + gspowers Pipeline 引擎；**Trae 中三队改为串行**（红队→蓝队→绿队），内部 Pipeline Stage 0→5 不变，全部完成后统一裁判汇总。详见 [串行执行约定](.trae/rules/project_rules.md#夯kf-multi-team-compete串行执行约定) |
| 10 | **kf-triple-collaboration** `/triple` | 夯 | - | 内部 spawn Red/Blue/Judge 三 Agent 并发评审；Trae 不可用 |
| 11 | **kf-prd-generator** `/prd-generator` | 快 | v | 调用 kf-alignment（产出后对齐）；被 kf-multi-team-compete Pre-Stage 调用；纯生成工作流 |
| 12 | **kf-ui-prototype-generator** | 快 | v | 调用 kf-alignment；被 kf-multi-team-compete Stage 2/5 调用；纯 HTML 生成 |
| 13 | **kf-image-editor** | 快 | ~ | 被 kf-multi-team-compete Stage 2/5 调用；依赖 Nano Banana (Gemini) MCP，Trae MCP 支持情况决定可用性 |
| 14 | **kf-skill-design-expert** | 稳 | v | 独立运行；Harness 五根铁律全路径审计 + 评分矩阵；纯 Node.js 脚本 + Prompt |
| 15 | **kf-harness-audit** | 稳 | v | **新增 Trae 专属技能**。将 Claude Code 的 `harness-gate-check.cjs` + `harness-audit.cjs` 脚本逻辑转化为 inline checklist，覆盖 10 个技能的 Gate/Stage 自检。位于 `.trae/skills/kf-harness-audit/SKILL.md`；被 `project_rules.md` 引用为强制自检标准 |

> **P1-P4 改造说明**：以上 kf- 系列在 Trae 中均已完成适配迁移：
> - **P1**：gspowers 注册为 Trae Skill（单独列出，见下方 #17）
> - **P2**：`.trae/rules/project_rules.md` 写入六大原则、技能速查、对齐工作流等全部项目约定
> - **P3**：新增 `kf-harness-audit` 技能，将机械化门控转为 inline checklist（#16）
> - **P4**：`/夯` 三队并发→串行降级，约定写入 project_rules.md

---

## 二、gstack 技能（上游，garrytan，46 个）

### 2.1 核心入口

| # | 技能 | Trae | 衍生调用 / 被调用关系 |
|---|------|:---:|------|
| 17 | **gstack** (root) | ~ | 根据用户意图路由到所有 gstack 子技能；Trae 中需手动选择 |
| 18 | **gspowers** | ~ | SOP 流程编排器，协调 gstack + superpowers；**P1 已适配为 Trae Skill**（`.trae/skills/gspowers/SKILL.md`），6 个 references 内联为单文件，支持 `.gspowers/state.json` 驱动的导航流程；Pipeline 引擎被 `/夯` 集成 |

### 2.2 浏览器驱动

| # | 技能 | Trae | 衍生调用 |
|---|------|:---:|------|
| 19 | **browse** | v | gstack 核心浏览器引擎（Playwright/Chromium）；被 design-review、devex-review、qa、qa-only、canary、benchmark、setup-browser-cookies、scrape、open-gstack-browser 等大量技能依赖 |
| 20 | **open-gstack-browser** | v | 独立；启动 AI 控制 Chromium 可见窗口 |
| 21 | **setup-browser-cookies** | v | 调用 browse；从真实 Chromium 导入 Cookie 到 headless 会话 |
| 22 | **hackernews-frontpage** | v | 独立 browser-skill；抓取 HN 首页 |

### 2.3 计划评审（plan-*）

| # | 技能 | Trae | 衍生调用 |
|---|------|:---:|------|
| 23 | **autoplan** | ~ | 自动串行运行 office-hours → plan-ceo-review → plan-design-review → plan-eng-review → plan-devex-review；内部 Agent 调度在 Trae 中不可用 |
| 24 | **office-hours** | v | 被 autoplan 优先加载；YC 办公时间评审（Startup/Builder 模式） |
| 25 | **plan-ceo-review** | v | 依赖 office-hours；CEO 视角四种模式评审 |
| 26 | **plan-design-review** | v | 独立；设计师视角评审 |
| 27 | **plan-eng-review** | v | 依赖 office-hours；工程经理视角评审 |
| 28 | **plan-devex-review** | v | 依赖 office-hours；开发者体验视角评审 |
| 29 | **plan-tune** | v | 独立；自调优问题敏感度 + 开发者心理画像 |

### 2.4 设计工具

| # | 技能 | Trae | 衍生调用 |
|---|------|:---:|------|
| 30 | **design-consultation** | v | 独立；调研 + 设计系统提案 → DESIGN.md |
| 31 | **design-html** | v | 内部 Agent 调用（可选）；生成 Pretext 原生 HTML/CSS |
| 32 | **design-review** | v | 调用 browse；设计师视角 QA |
| 33 | **design-shotgun** | ~ | 内部 Agent 调用；多方案并发生成 → 对比板 |

### 2.5 开发工作流

| # | 技能 | Trae | 衍生调用 |
|---|------|:---:|------|
| 34 | **ship** | ~ | 内部 Agent 调用；合并 → 测试 → 审查 → 版本号 → CHANGELOG → 提交 → 推送 → PR |
| 35 | **land-and-deploy** | ~ | 配合 ship；合并 PR → 等待 CI/deploy → canary 验证 |
| 36 | **review** | ~ | 内部 Agent 分析；PR 前置审查（SQL 安全、LLM 信任边界等） |
| 37 | **qa** | v | 调用 browse + Edit；三级 QA（Quick/Standard/Exhaustive）+ 自动修复 |
| 38 | **qa-only** | v | 调用 browse；纯报告 QA，不修复 |
| 39 | **document-release** | v | 独立；读取全项目文档 → 交叉对照 diff → 更新文档 |
| 40 | **retro** | v | 独立；周回顾：提交历史、工作模式、代码质量 |

### 2.6 调试 & 调查

| # | 技能 | Trae | 衍生调用 |
|---|------|:---:|------|
| 41 | **investigate** | v | 独立；四阶段系统调试（调查→分析→假设→实施），铁律：无根因不修复 |
| 42 | **codex** | v | 独立；Codex CLI 包装器（审查/挑战/咨询三种模式） |
| 43 | **benchmark** | v | 调用 browse；性能回归检测 |
| 44 | **benchmark-models** | v | 独立；跨模型基准测试（Claude vs GPT vs Gemini） |

### 2.7 安全

| # | 技能 | Trae | 衍生调用 |
|---|------|:---:|------|
| 45 | **cso** | ~ | 内部 Agent 调用；基础设施优先安全审计（密钥、供应链、CI/CD、OWASP、STRIDE） |
| 46 | **careful** | ~ | PreToolUse Hook 拦截危险命令；Trae 中可用但无 Hook 自动触发 |
| 47 | **guard** | ~ | 组合 careful + freeze；双重 Hook 保护；Trae 中可手动执行规则 |
| 48 | **freeze** | ~ | PreToolUse Hook 限制编辑范围；Trae 无 Hook 但规则可手动遵守 |
| 49 | **unfreeze** | v | 配套 freeze；清除编辑限制 |

### 2.8 上下文 & 学习

| # | 技能 | Trae | 衍生调用 |
|---|------|:---:|------|
| 50 | **context-save** | v | 独立；保存工作上下文（git 状态、决策、剩余工作） |
| 51 | **context-restore** | v | 配套 context-save；恢复工作上下文 |
| 52 | **learn** | v | 独立；管理跨会话项目经验 |
| 53 | **setup-gbrain** | v | 独立；安装 gbrain CLI + PGLite/Supabase 记忆后端 |

### 2.9 部署 & 爬虫

| # | 技能 | Trae | 衍生调用 |
|---|------|:---:|------|
| 54 | **setup-deploy** | v | 独立；检测平台 → 写入 CLAUDE.md 部署配置 |
| 55 | **canary** | v | 调用 browse；部署后金丝雀监控 |
| 56 | **scrape** | v | 调用 browse；Web 数据抓取（首次原型 ~200ms） |
| 57 | **skillify** | v | 配套 scrape；将刮擦流程固化为 browser-skill |

### 2.10 工具

| # | 技能 | Trae | 衍生调用 |
|---|------|:---:|------|
| 58 | **make-pdf** | v | 调用 browse/Chromium；MD → 出版物级 PDF |
| 59 | **gstack-upgrade** | v | 独立；升级 gstack 到最新版 |
| 60 | **pair-agent** | v | 独立；远程 AI Agent 与浏览器配对 |
| 61 | **health** | v | 独立；代码质量仪表盘（类型检查/格式化/测试 综合评分） |
| 62 | **landing-report** | v | 独立；只读队列仪表盘 |

---

## 三、gstack OpenClaw 技能（4 个）

| # | 技能 | Trae | 说明 |
|---|------|:---:|------|
| 63 | **gstack-openclaw-ceo-review** | v | CEO 计划评审；OpenClaw 特化版 |
| 64 | **gstack-openclaw-investigate** | v | 系统调试；OpenClaw 特化版 |
| 65 | **gstack-openclaw-office-hours** | v | YC 办公时间；OpenClaw 特化版 |
| 66 | **gstack-openclaw-retro** | v | 工程回顾；OpenClaw 特化版 |

---

## 四、全局/内置技能（不在 `.claude/skills/` 目录下，运行时自动注册）

这些技能来自 Claude Code CLI 或插件系统，不依赖本项目的 `.claude/skills/` 文件。

| 命名空间 | 代表技能 | Trae | 说明 |
|---------|------|:---:|------|
| **superpowers:** | brainstorming, executing-plans, writing-plans, systematic-debugging, test-driven-development, using-git-worktrees, verification-before-completion, subagent-driven-development, finishing-a-development-branch, receiving-code-review, requesting-code-review, using-superpowers, dispatching-parallel-agents | ~ | 提示词工作流为主；Agent 并行相关（subagent-driven-development、dispatching-parallel-agents）在 Trae 不可用 |
| **sparc:** | spec-pseudocode, tdd, architect, coder, debugger, reviewer, tester, security-review, swarm-coordinator, orchestrator 等 30+ | ~ | SPARC 方法论全系列；swarm 编排在 Trae 不可用，基础 spec/code/review 工作流可用 |
| **github:** | code-review-swarm, pr-manager, release-swarm, issue-tracker, swarm-pr, swarm-issue, sync-coordinator, repo-architect 等 15+ | ~ | GitHub 集成；Agent swarm 在 Trae 不可用，基础 PR/Issue 操作可通过 gh CLI 手动完成 |
| **hooks:** | overview, setup, pre-edit, post-edit, pre-task, post-task, session-end | - | Hook 系统是 Claude Code 特有功能，Trae 不可用 |
| **monitoring:** | agent-metrics, swarm-monitor, real-time-view, status | - | Agent 监控依赖 Claude Code 运行时 |
| **optimization:** | auto-topology, cache-manage, parallel-execution, topology-optimize | - | 并行/拓扑优化依赖 Claude Code Agent 系统 |
| **analysis:** | bottleneck-detect, performance-report, token-efficiency, token-usage | ~ | 分析报告类可用；瓶颈检测依赖运行时数据 |
| **automation:** | auto-agent, self-healing, session-memory, smart-agents, smart-spawn, workflow-select | - | 全自动化体系依赖 Claude Code Agent + Hook |
| **claude-flow:** | help, memory, swarm | - | Claude Flow 平台专属 |

---

## 五、Trae 改造交付物（P1-P4）

本次改造在 `.trae/` 下新增以下文件：

| 文件 | 对应 | 说明 |
|------|------|------|
| `.trae/skills/gspowers/SKILL.md` | **P1** | gspowers 适配为 Trae Skill，6 个 references 内联为单文件 |
| `.trae/rules/project_rules.md` | **P2** | 项目规则：六大原则、技能速查、自动调用链、对齐工作流、记忆管理 |
| `.trae/skills/kf-harness-audit/SKILL.md` | **P3** | Harness 五根铁律自检：10 个技能的 Gate/Stage checklist |
| `.trae/rules/project_rules.md` (追加) | **P4** | `/夯` 串行执行约定：红队→蓝队→绿队，三队完成后统一裁判 |

### 影响范围

| 受影响技能 | 改造内容 |
|-----------|---------|
| **gspowers** (#18) | 从仅 Claude Code 可用变为 Trae 可用（`~` 部分兼容，依赖 `.gspowers/state.json` 手动推进） |
| **kf-multi-team-compete/han** (#9) | 三队并发→串行降级，`-` → `~`，Trae 中红→蓝→绿依次执行 |
| **kf-harness-audit** (#16) | **新增技能**，将 Claude Code 的 `harness-gate-check.cjs` 机械化门控转化为 Trae 的 inline checklist |
| **全部 kf- 技能** | `project_rules.md` 中定义了每个 Gate 的自检 checklist，确保 Plan→Build→Verify→Fix 循环 |

---

## 六、速查：Trae 中可以完整使用的能力

以下技能在 Trae Builder 中 **零依赖、开箱即用**（共 **37 个**）：

| 类别 | 技能 |
|------|------|
| kf- 系列 | kf-alignment, kf-prd-generator, kf-ui-prototype-generator, kf-skill-design-expert, kf-web-search, **kf-harness-audit** |
| gstack 计划 | office-hours, plan-ceo-review, plan-design-review, plan-eng-review, plan-devex-review, plan-tune |
| gstack 设计 | design-consultation, design-html, design-review |
| gstack 调试 | investigate, codex, benchmark, benchmark-models |
| gstack 浏览器 | browse, open-gstack-browser, setup-browser-cookies, hackernews-frontpage |
| gstack 质量 | qa, qa-only, health, retro |
| gstack 文档 | document-release |
| gstack 工具 | context-save, context-restore, learn, setup-deploy, setup-gbrain, make-pdf, scrape, skillify, landing-report, pair-agent, gstack-upgrade, unfreeze |
| OpenClaw | gstack-openclaw-ceo-review, gstack-openclaw-investigate, gstack-openclaw-office-hours, gstack-openclaw-retro |

### Trae 中部分可用的能力（+2 个新增）

> 相比改造前，以下技能从"不可用"或"仅 Claude"变为"Trae 部分可用"：

| 技能 | 原状态 | 现状态 | 改造说明 |
|------|:------:|:------:|---------|
| **kf-multi-team-compete** `/夯` | - (不兼容) | ~ (部分兼容) | 三队串行降级；红队→蓝队→绿队依次执行，内部 Pipeline 不变 |
| **gspowers** | 仅 Claude Code | ~ (部分兼容) | 已内联为 `.trae/skills/gspowers/SKILL.md`，state.json 驱动导航 |

---

## 七、Trae 与 Claude Code 能力差异速查（改造后）

| 维度 | Claude Code | Trae Builder |
|------|:---:|:---:|
| Agent Spawn 并行 | v | - |
| Hook 自动触发 | v | - |
| Skill 按需加载 | v | - |
| MCP 工具链 | v | 取决于 Trae MCP 支持 |
| Bash 脚本 | v | v |
| Node.js 脚本 | v | v |
| Prompt 工作流 | v | v |
| Playwright 浏览器 | v | v |
| Git 操作 | v | v |
| 门控验证脚本 | v | v |
| Harness 审计脚本 | v | **→ inline checklist** (kf-harness-audit) |
| `/夯` 多队竞争 | v (三队并发) | **→ 三队串行** (红→蓝→绿) |
| 模型自动路由 | v | 手动按路由表选择 |
| gspowers 流程导航 | v (6 references) | **→ 内联单文件** |
| 内置项目规则 | v (CLAUDE.md + settings.json) | **→ `.trae/rules/project_rules.md`** |
| 流式输出体验 | 转圈 5~30s | <1s 首字可见 |
| Thinking 可视化 | 需 ctrl+o ctrl+e | 实时 Thinking 链可见 |
| 结果预览 | 手动切浏览器 | 内置 Webview 实时预览 |
