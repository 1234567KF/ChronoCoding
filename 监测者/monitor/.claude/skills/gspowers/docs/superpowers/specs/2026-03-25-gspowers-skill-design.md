# gspowers Skill 技术设计

## 概述

gspowers 是一个全局安装的 Claude Code skill（`~/.claude/skills/gspowers/`），作为"智能导航员"编排 gstack + superpowers 的开发流程。调度器不自动执行子 skill，而是读取项目状态、显示流程地图、引导用户执行下一步命令。

### 设计输入

- 设计文档：`~/.gstack/projects/gspowers/f.sh-unknown-design-20260325-113700.md`（APPROVED）
- CEO 计划：`~/.gstack/projects/gspowers/ceo-plans/2026-03-25-gspowers-orchestrator.md`

### 核心决策汇总

| # | 决策点 | 选择 | 理由 |
|---|--------|------|------|
| 1 | 调度器职责 | 智能导航员 | 嵌入环境检查 + 决策收集 + 统计，但不自动执行子 skill |
| 2 | 快捷模式 | 跳过 office-hours + plan-ceo-review | 保留 plan-eng-review 作为最低规划门槛 |
| 3 | 状态写入 | 用户自报 | 调度器是唯一状态写入点，子 skill 无法修改 state.json |
| 4 | Artifact 收集 | 复制到 `.gspowers/artifacts/` | 集中管理，方便追溯 |
| 5 | handoff 生成 | 每次 state.json 更新时同步 | 任何时刻 /clear 后都有最新交接 |
| 6 | 环境检查 | 最小集 | 只检查 gstack + superpowers 安装 + git 初始化 |
| 7 | Prompt 结构 | 路由 + 按需读取 | 信噪比优先：每次只加载当前阶段的 20-30 行指令 |
| 8 | plan-ceo-review | office-hours 完成后实时询问 | 比 init 预设更自然 |
| 9 | existing 项目 | init 阶段提示准备 Update_Plan.md | 用户第一次看到地图时就知道要准备什么 |
| 10 | execute 期中断恢复 | 根据 artifact 存在情况判断 | 只有 design-spec 则推进到 writing-plans |
| 11 | /review 回退 | phase 重置回 execute | /clear + handoff 写明原因 |

---

## 文件结构

### Skill 文件（全局安装）

```
~/.claude/skills/gspowers/
├── SKILL.md              # 调度器路由（~50行）
└── references/
    ├── init.md           # 首次启动：环境检查 + 项目类型 + 快捷模式 + has_ui
    ├── plan.md           # 规划期：office-hours → plan-ceo-review → plan-eng-review
    ├── execute.md        # 执行期：brainstorming → writing-plans → subagent-dev
    ├── finish.md         # 收尾期：/review → /qa → /ship → /document-release
    ├── sop.md            # 人类可读完整 SOP
    └── tools-guide.md    # 补充工具速查（/retro, /investigate 等）
```

### 项目级状态文件

```
<project-root>/
└── .gspowers/
    ├── state.json        # 流程状态
    ├── handoff.md        # 跨 /clear 交接
    └── artifacts/        # 阶段产出物（复制件）
```

---

## SKILL.md — 调度器路由

职责：读取状态 → 确定阶段 → 加载对应指令文件。

### 启动流程

1. 检查 `.gspowers/state.json` 是否存在
   - **不存在** → Read `references/init.md`，执行首次启动流程
   - **存在** → 读取 state.json，进入恢复模式

2. 恢复模式：
   a. 读取 `.gspowers/handoff.md`（如存在），显示上次状态摘要
   b. 询问用户："上一步（{current_step}）完成了吗？"
      - 是 → 收集 artifact 路径，复制到 `.gspowers/artifacts/`，更新 state.json + 重写 handoff.md
      - 否 → 显示继续执行的提示命令
   c. 根据 current_phase 加载对应指令：
      - plan → Read `references/plan.md`
      - execute → Read `references/execute.md`
      - finish → Read `references/finish.md`
      - done → 显示完成统计摘要

3. 显示流程地图（始终显示，带当前位置标记）

### 流程地图模板

```
★ 规划期 ──────────────────────────
├─ [{status}] office-hours
├─ [{status}] plan-ceo-review (可选)
├─ [{status}] plan-eng-review
★ 执行期 ──────────── /clear ────
├─ [{status}] brainstorming
├─ [{status}] writing-plans
├─ [{status}] subagent-dev
★ 收尾期 ──────────── /clear ────
├─ [{status}] /review
├─ [{status}] /qa (条件: has_ui)
├─ [{status}] /ship
└─ [{status}] /document-release
```

- status 值：✅ 已完成 / 🔄 当前 / ⏭️ 跳过 / ⬜ 待执行
- has_ui = false 时，/qa 显示为 `[跳过]`
- /clear 边界用分隔线标注

### state.json 写入规则

每次更新 state.json 后，必须同步重写 `.gspowers/handoff.md`。

---

## init.md — 首次启动

当 state.json 不存在时加载。

### 1. 环境检查

检查三项，缺失则提示安装后停止：

- `~/.claude/skills/gstack/` 目录存在 → gstack 已安装
- superpowers 已安装（确认 `superpowers:brainstorming` 出现在可用 skills 列表中——superpowers 作为 Claude Code plugin 安装，不在 `~/.claude/skills/` 目录下）
- `.git/` 存在 → git 已初始化。不存在则提示 `git init`

### 2. 收集项目信息

**Q1**: "这是新项目还是已有项目的迭代？"
- 新项目 → `project_type = "new"`
- 已有项目 → `project_type = "existing"`，提示准备 Update_Plan.md 并给出模板

**Q2**（仅新项目）: "选择流程模式："
- 完整模式 → `mode = "full"`
- 快速模式 → `mode = "quick"`（跳过 office-hours + plan-ceo-review）
- existing 项目自动设为 `mode = "quick"`（office-hours + plan-ceo-review 本就不适用），跳过此问题

**Q3**: "这个项目有前端 UI 吗？"
- 有 → `has_ui = true`
- 无 → `has_ui = false`

### 3. 计算起始步骤

| project_type | mode | current_step |
|-------------|------|-------------|
| new | full | office-hours |
| new | quick | plan-eng-review |
| existing | quick (自动) | plan-eng-review |

### 4. 创建文件

- 创建 `.gspowers/` 和 `.gspowers/artifacts/` 目录
- 写入 state.json + handoff.md
- 显示流程地图 + 第一步执行命令

### Update_Plan.md 模板（existing 项目用）

```markdown
# 更新计划

## 问题现状
<!-- 当前遇到的具体问题，越具体越好 -->

## 期望结果
<!-- 修复/优化后应该达到的状态 -->

## 约束条件
<!-- 不能动的部分：已有依赖、兼容性要求、技术栈限制等 -->

## 影响范围
<!-- 本次更新涉及的模块/文件/功能 -->
```

---

## plan.md — 规划期

当 `current_phase = "plan"` 时加载。

注：existing 项目跳过 office-hours 和 plan-ceo-review，直接从 plan-eng-review 开始。plan-ceo-review 仅在新项目完成 office-hours 后询问（因为 CEO 审查需要 product-requirements 作为输入）。

### office-hours

提示用户执行 `/office-hours`。

完成后：
- 收集产出路径（通常在 `~/.gstack/projects/{slug}/`）
- 复制到 `.gspowers/artifacts/product-requirements.md`
- 更新 state.json: `current_step → "plan-ceo-review"`
- 询问："下一步是 plan-ceo-review（可选）。需要 CEO 视角审查吗？"
  - 是 → 继续
  - 否 → 跳过，`current_step → "plan-eng-review"`，记入 `skipped_steps`

### plan-ceo-review

提示用户执行 `/plan-ceo-review`。

完成后：
- 复制产出到 `.gspowers/artifacts/ceo-review.md`
- 更新 state.json: `current_step → "plan-eng-review"`

### plan-eng-review

根据 project_type 提示不同输入：
- new → `/plan-eng-review`，读取 `.gspowers/artifacts/product-requirements.md`
- existing → `/plan-eng-review`，读取项目根目录的 `Update_Plan.md`

完成后：
- 复制产出到 `.gspowers/artifacts/architecture.md`
- 更新 state.json: `current_phase → "execute"`, `current_step → "brainstorming"`
- **提示用户执行 /clear**（gstack → superpowers 切换点）

---

## execute.md — 执行期

当 `current_phase = "execute"` 时加载。

### brainstorming

提示用户执行：

```
/brainstorm

请读取 .gspowers/artifacts/architecture.md 作为架构输入。
```

brainstorming 完成后自动衔接 writing-plans（同一上下文，无需 /clear）。

当用户返回 `/gspowers` 时，根据 artifact 存在情况判断推进：
- 只有 design-spec，没有 implementation-plan → `current_step → "writing-plans"`
- 两者都有 → `current_step → "subagent-dev"`

收集产出：
- design spec → `.gspowers/artifacts/design-spec.md`
- implementation plan → `.gspowers/artifacts/implementation-plan.md`
- 调度器列出可能的产出文件路径，让用户确认具体哪个文件

### writing-plans

（仅在 brainstorming 后中断的恢复场景）

提示用户执行：

```
/superpowers:writing-plans

请读取 .gspowers/artifacts/design-spec.md
```

完成后收集 implementation-plan，更新 `current_step → "subagent-dev"`。

### subagent-dev

提示用户执行子代理开发（同一上下文中直接继续或 /clear 后重新触发）：

```
/superpowers:subagent-driven-development

请读取 .gspowers/artifacts/implementation-plan.md
```

完成后：
- 更新 state.json: `current_phase → "finish"`, `current_step → "review"`
- **提示用户执行 /clear**（superpowers → gstack 切换点）

---

## finish.md — 收尾期

当 `current_phase = "finish"` 时加载。所有步骤都是 gstack skill，同一上下文内可连续执行。

### review

提示用户执行 `/review`。

完成后：
- 复制产出到 `.gspowers/artifacts/review-report.md`
- 检查审查结果：
  - **有严重问题** → `current_phase → "execute"`, `current_step → "subagent-dev"`, `status → "failed"`, 记录 `failure_reason`。提示用户 /clear 后回到执行期修复
  - **通过** → 检查 `has_ui`：true → `current_step → "qa"` / false → `current_step → "ship"`

### qa（仅 has_ui = true）

提示用户执行 `/qa http://localhost:<PORT>`。

提醒：如有登录墙，先执行 `/setup-browser-cookies`。

完成后：`current_step → "ship"`

### ship

提示用户执行 `/ship`。

完成后：
- 记录 PR 链接到 `artifacts.pr_link`
- `current_step → "document-release"`

### document-release

提示用户执行 `/document-release`。

完成后：
- `current_phase → "done"`, `status → "completed"`
- 显示完成统计摘要

---

## state.json Schema

```json
{
  "version": "1.0",
  "project_type": "new|existing",
  "mode": "full|quick",
  "has_ui": true|false,
  "current_phase": "init|plan|execute|finish|done",
  "current_step": "office-hours|plan-ceo-review|plan-eng-review|brainstorming|writing-plans|subagent-dev|review|qa|ship|document-release",
  "status": "in_progress|completed|failed",
  "failure_reason": null,
  "completed_steps": [],
  "skipped_steps": [],
  "artifacts": {},
  "started_at": "ISO 8601",
  "last_updated": "ISO 8601"
}
```

### 异常恢复

调度器读取 state.json 后检查 `version` + `current_phase` + `current_step` 三个必填字段。格式异常时扫描 `.gspowers/artifacts/` 中已存在的文件推断进度，重建 state.json。

---

## handoff.md 模板

每次 state.json 更新时同步重写：

```markdown
# gspowers 交接文件

## 当前状态
- **阶段**: {current_phase} → {current_step}
- **已完成**: {completed_steps 用 ✅ 连接}
- **跳过**: {skipped_steps}

## 关键文件
- state.json: .gspowers/state.json
- artifacts: .gspowers/artifacts/
{列出所有已收集的 artifact 路径}

## 下一步操作

请执行：
/gspowers

## 项目概要
{一句话描述}
```

核心原则：用户 /clear 后只需输入 `/gspowers`，调度器从 state.json 恢复全部上下文。handoff.md 是人类可读的快速摘要，不是恢复的数据源。

---

## /clear 边界规则

| 从 | 到 | /clear | 原因 |
|----|----|----|------|
| office-hours | plan-ceo-review | 否 | 同为 gstack，上下文连贯 |
| plan-ceo-review | plan-eng-review | 否 | 同为 gstack |
| plan-eng-review | brainstorming | **是** | gstack → superpowers 切换 |
| brainstorming | writing-plans | 否 | superpowers 自动衔接 |
| writing-plans | subagent-dev | 否 | 同一上下文 |
| subagent-dev | /review | **是** | superpowers → gstack 切换 |
| /review | /qa | 否 | 同为 gstack |
| /qa | /ship | 否 | 同为 gstack |
| /ship | /document-release | 否 | 同为 gstack |
| /review（失败） | subagent-dev | **是** | gstack → superpowers 回退 |

---

## 完成统计摘要

`current_phase = "done"` 时显示：

```
gspowers 流程完成！

  项目类型：{project_type} | {mode}模式
  总步骤：{completed} 完成 / {skipped} 跳过
  产出物：{artifact_count} 份（.gspowers/artifacts/）
  耗时：{started_at} → {last_updated}
  PR：{pr_link}
```

---

## references/sop.md 覆盖范围

人类可读完整 SOP：
- gspowers 是什么、解决什么问题
- 完整路径 vs 精简路径步骤表
- 快捷模式说明
- 每个步骤的输入/输出/执行命令
- /clear 边界规则及原因
- state.json 字段说明
- 异常处理（损坏恢复、/review 回退、中途 /clear）
- Update_Plan.md 模板

## references/tools-guide.md 覆盖范围

补充工具速查（不在主流程中）：
- `/plan-ceo-review`：CEO/创始人视角审查的详细说明
- `/retro`：周期性工程回顾
- `/investigate`：4 阶段根因分析
- `/design-consultation`：视觉风格探索
- `/cso`：安全审计
