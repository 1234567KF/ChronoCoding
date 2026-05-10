# gspowers 标准操作流程（SOP）

## 什么是 gspowers

gspowers 是一个 Claude Code skill，作为"导航员"编排 gstack（产品/架构）和 superpowers（工程/测试）的开发流程。输入 `/gspowers` 即可看到当前进度和下一步操作。

## 前置条件

- gstack 已安装（`~/.claude/skills/gstack/`）
- superpowers 已安装（Claude Code plugin）
- 项目已 git 初始化

## 快速开始

在任何 git 项目目录中：

```
/gspowers
```

首次运行会引导你完成项目设置（3 个问题），然后显示流程地图。

## 完整流程（新项目 + 完整模式）

| # | 步骤 | 工具 | 命令 | 产出物 | /clear |
|---|------|------|------|--------|--------|
| 1 | office-hours | gstack | `/office-hours` | product-requirements.md | 否 |
| 2 | plan-ceo-review | gstack | `/plan-ceo-review` | ceo-review.md | 否 |
| 3 | plan-eng-review | gstack | `/plan-eng-review` | architecture.md | **是** |
| 4 | brainstorming | superpowers | `/brainstorm` | design-spec.md | 否 |
| 5 | writing-plans | superpowers | 自动衔接 | implementation-plan.md | 否 |
| 6 | subagent-dev | superpowers | 子代理执行 | 代码 + commits | **是** |
| 7 | /review | gstack | `/review` | review-report.md | 否 |
| 8 | /qa | gstack | `/qa http://localhost:PORT` | QA 修复 | 否 |
| 9 | /ship | gstack | `/ship` | PR 链接 | 否 |
| 10 | /ce:compound (可选) | CE | `/ce:compound` | docs/solutions/*.md | 否 |
| 11 | /document-release | gstack | `/document-release` | 更新文档 | 否 |

## 精简流程（已有项目）

跳过 office-hours 和 plan-ceo-review，从 plan-eng-review 开始。gspowers 会自动引导生成 `Update_Plan.md`（也支持使用已有的）。

## 快速模式

新项目可选择快速模式，跳过 office-hours 和 plan-ceo-review，直接从 plan-eng-review 开始。适合需求已清晰的场景。

## 知识复利

gspowers v1.1 引入知识复利闭环：

1. **compound 步骤**（ship 后）：调用 `/ce:compound` 将本次开发经验结构化记录到 `docs/solutions/`
2. **知识搜索**（brainstorming 前）：gspowers 自动搜索 `docs/solutions/` 中的相关历史经验，写入 `prior-learnings.md` 作为 brainstorming 参考

闭环：`compound → docs/solutions/ → 知识搜索 → brainstorming`

## /clear 边界规则

| 从 | 到 | /clear | 原因 |
|----|----|----|------|
| plan-eng-review | brainstorming | **是** | gstack → superpowers 切换 |
| subagent-dev | /review | **是** | superpowers → gstack 切换 |
| /review（失败） | subagent-dev | **是** | gstack → superpowers 回退 |

同一工具链内的步骤不需要 /clear。

## state.json 字段说明

| 字段 | 说明 |
|------|------|
| version | Schema 版本（"1.0"） |
| project_type | "new" 或 "existing" |
| mode | "full" 或 "quick" |
| has_ui | 是否有前端 UI |
| current_phase | 当前大阶段：plan/execute/finish/done |
| current_step | 当前具体步骤 |
| status | in_progress/completed/failed |
| failure_reason | 失败原因（仅 status=failed 时） |
| completed_steps | 已完成步骤数组 |
| skipped_steps | 已跳过步骤数组 |
| artifacts | 产出物路径映射 |
| started_at | 开始时间 |
| last_updated | 最后更新时间 |

## 异常处理

### state.json 损坏
调度器会检查必填字段（version、current_phase、current_step）。格式异常时，扫描 `.gspowers/artifacts/` 推断进度并重建。

### /review 回退
/review 发现严重问题时，phase 重置回 execute、step 重置到 subagent-dev。需要 /clear 后回到执行期修复。

### 中途 /clear
如果意外 /clear，输入 `/gspowers` 即可恢复——调度器从 state.json 读取状态，handoff.md 提供可读摘要。

## Update_Plan.md 模板

```markdown
# 更新计划

## 问题现状
<!-- 当前遇到的具体问题 -->

## 期望结果
<!-- 修复/优化后的状态 -->

## 约束条件
<!-- 不能动的部分 -->

## 影响范围
<!-- 涉及的模块/文件/功能 -->
```
