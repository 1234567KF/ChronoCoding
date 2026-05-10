# 执行期指令

当前阶段：`current_phase = "execute"`。根据 state.json 中的 `current_step` 执行对应指令。

---

## brainstorming

### 前置知识搜索

在提示 brainstorming 之前，自动搜索历史经验（导航员模式的唯一例外：只读预处理）。

0. **清理上一轮残留**：用 Bash 执行 `rm -f .gspowers/artifacts/prior-learnings.md`，并从 state.json 的 `artifacts` 中移除 `"prior-learnings"` 键（如果存在）。确保每次 brainstorming 获取新鲜结果。

1. 用 Bash 检查：`test -d docs/solutions/ && echo exists || echo missing`
   - **missing** → 显示："📚 未找到历史经验库（docs/solutions/），从零开始 brainstorming"，跳到步骤 3

2. **exists** → 用 Agent 工具派发 `learnings-researcher` agent（`subagent_type` 设为 `compound-engineering:research:learnings-researcher`）：
   - 先用 Read 工具读取项目输入文件（existing 项目读 `Update_Plan.md`，new 项目读 `.gspowers/artifacts/product-requirements.md`），提取项目主题摘要
   - agent prompt：`"搜索 docs/solutions/ 中与以下主题相关的历史经验：{项目主题摘要}。优先匹配 YAML frontmatter 中的 tags 和 problem 字段，其次全文。返回最相关的 ≤3 条结果，每条包含文件路径和关键要点摘要。"`
   - **有结果** → 按以下格式写入 `.gspowers/artifacts/prior-learnings.md`：
     ```markdown
     ## 相关历史经验 (From docs/solutions/)

     - **[文件名]**: [核心要点摘要]
       - **关联风险**: [曾经踩过的坑]
       - **建议做法**: [本次可复用的实践]
     ```
     在 state.json `artifacts` 中记录 `"prior-learnings": ".gspowers/artifacts/prior-learnings.md"`
     显示："📚 找到 {N} 条相关历史经验，已写入 prior-learnings.md"
   - **无结果** → 显示："📚 未找到相关历史经验，从零开始 brainstorming"，不生成 prior-learnings.md
   - **agent 派发失败** → 显示："⚠️ 知识搜索未能执行（agent 派发失败），从零开始 brainstorming"，在 state.json `artifacts` 中记录 `"prior-learnings-status": "agent-failed"`，不生成 prior-learnings.md

3. 提示用户执行：

   有 `prior-learnings.md` 时：
   ```
   /brainstorm

   请读取以下文件作为输入：
   - .gspowers/artifacts/architecture.md（架构）
   - .gspowers/artifacts/prior-learnings.md（历史经验）
   ```

   无 `prior-learnings.md` 时：
   ```
   /brainstorm

   请读取 .gspowers/artifacts/architecture.md 作为架构输入。
   ```

> brainstorming 完成后会自动衔接 writing-plans，无需返回调度器。
> writing-plans 完成后可直接选择子代理执行。
> 所以用户可能一次走完 brainstorming + writing-plans + subagent-dev。

当用户返回 `/gspowers` 时，逐步确认完成情况：

1. 询问："brainstorming 和 writing-plans 都完成了吗？还是只完成了 brainstorming？"

2. **只完成 brainstorming**（有 design-spec，无 implementation-plan）：
   - 收集 design-spec 文件路径，复制：`cp <路径> .gspowers/artifacts/design-spec.md`
   - 将 `"brainstorming"` 加入 `completed_steps`
   - 设 `current_step` 为 `"writing-plans"`
   - 更新 state.json + 重写 handoff.md
   - 继续到下方 writing-plans 指令

3. **brainstorming + writing-plans 都完成**（两个 artifact 都有）：
   - 收集两个文件路径，分别复制到：
     - `.gspowers/artifacts/design-spec.md`
     - `.gspowers/artifacts/implementation-plan.md`
   - 将 `"brainstorming"` 和 `"writing-plans"` 加入 `completed_steps`
   - 设 `current_step` 为 `"subagent-dev"`
   - 更新 state.json + 重写 handoff.md
   - 继续到下方 subagent-dev 指令

4. **全部完成**（包括 subagent-dev）：
   - 收集所有 artifact
   - 将 `"brainstorming"`、`"writing-plans"`、`"subagent-dev"` 加入 `completed_steps`
   - 设 `current_phase` 为 `"finish"`，`current_step` 为 `"review"`
   - 更新 state.json + 重写 handoff.md
   - 显示 /clear 提示（见下方 subagent-dev 完成后的提示）

---

## writing-plans

> 这个步骤仅在 brainstorming 完成后中断恢复时出现。

显示："上次 brainstorming 已完成但 writing-plans 未开始。"

提示用户执行：

```
/superpowers:writing-plans

请读取 .gspowers/artifacts/design-spec.md
```

用户完成后：
1. 收集 implementation-plan 文件路径
2. 复制：`cp <路径> .gspowers/artifacts/implementation-plan.md`
3. 将 `"writing-plans"` 加入 `completed_steps`
4. 设 `current_step` 为 `"subagent-dev"`
5. 更新 state.json + 重写 handoff.md

---

## subagent-dev

提示用户执行：

```
/superpowers:subagent-driven-development

请读取 .gspowers/artifacts/implementation-plan.md
```

用户完成后：
1. 将 `"subagent-dev"` 加入 `completed_steps`（如果已存在则跳过，不重复）
2. 设 `current_phase` 为 `"finish"`
3. 设 `current_step` 为 `"review"`
4. 如果 `status` 为 `"failed"`，将其重置为 `"in_progress"` 并清除 `failure_reason`（回退修复后恢复正常状态）
5. 更新 state.json + 重写 handoff.md
5. 显示：

```
⚠️ 下一步进入收尾期（gstack），需要清理上下文。
请执行 /clear，然后输入 /gspowers
```
