# TODOS

## v2: Hook 自动同步 state.json

**What:** 设置 PostToolUse hook，当 gstack/superpowers skill 完成时自动更新 `.gspowers/state.json`。

**Why:** v1 的"导航员模式"下，用户如果跳过调度器直接手动执行 `/office-hours` 等命令，state.json 不会被更新。下次运行 `/gspowers` 时会显示过时的状态。Hook 可以在 skill 完成时自动记录进度，消除这个盲区。

**Pros:** 即使用户不走调度器也能保持状态同步；为 Approach C（全自动化）铺路。

**Cons:** Hook 调试困难；需要处理 hook 执行失败的情况；增加 settings.json 配置复杂度。

**Context:** 这是设计文档中 Approach B → C 的进化路径。当前 v1 接受手动跳过导致状态不同步的限制。v2 通过 Claude Code 的 hook 系统（settings.json 中的 PostToolUse）自动拦截 gstack/superpowers 的 skill 执行，解析产出文件路径，更新 state.json。

**Depends on:** v1 完成并稳定运行后。

## v2: 自定义步骤跳过配置

**What:** 允许用户在 state.json 或全局配置中标记某些步骤为 always_skip（如"永远不需要 /qa"）。

**Why:** 快捷模式提供了"完整/快速"两档选择，但有些用户可能需要更精细的控制——比如保留 office-hours 但跳过 plan-eng-review。

**Pros:** 更精细的流程定制；适合不同使用习惯。

**Cons:** 与快捷模式功能重叠；增加配置复杂度；可能导致用户跳过关键步骤。

**Context:** CEO review 中提出，延迟到快捷模式验证后再评估。如果快捷模式已经满足需求，此项可能不需要。

**Effort:** S (CC: ~5min) | **Priority:** P3

**Depends on:** v1 快捷模式验证后。

## v2: compound 步骤智能提示

**What:** compound 步骤不再问用户"有没有经验值得记录"，而是自动分析 git diff + review findings，判断是否有值得记录的经验，然后建议具体记录什么。

**Why:** 外部审查指出 compound 步骤会因用户决策疲劳收敛到"没有"。智能提示能主动发现值得记录的模式（如异常的调试路径、反复修改的文件、review 中发现的架构问题），降低用户认知负担，提升采纳率。

**Pros:** 提升 compound 采纳率；减少低质量文档（有具体建议 vs 空白开始）；形成更强的知识复利闭环。

**Cons:** 需要分析 git diff 和 review artifacts 的逻辑；可能过度建议（噪音）；增加 finish.md 复杂度。

**Context:** v1.1 eng review 外部意见 #5 提出。当前 v1.1 用引导问题缓解，但长期需要更主动的方案。需先验证 v1.1 compound 步骤的实际采纳率数据。

**Effort:** M (CC: ~15min) | **Priority:** P2

**Depends on:** v1.1 compound 步骤稳定运行 + 收集用户反馈。
