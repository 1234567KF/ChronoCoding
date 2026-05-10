# gspowers 首次启动

state.json 不存在，执行首次启动流程。

## 1. 环境检查

用 Bash 逐一检查，缺失则提示安装并**停止**：

1. `test -d ~/.claude/skills/gstack && echo "gstack: OK" || echo "gstack: MISSING"`
   - MISSING → 告诉用户："请先安装 gstack：`npx skills add gstack -g -y`"
2. 确认你的可用 skills 列表中有 `superpowers:brainstorming`（superpowers 作为 Claude Code plugin 安装，不在 ~/.claude/skills/ 下）
   - 不可见 → 告诉用户："请先安装 superpowers plugin"
3. `test -d .git && echo "git: OK" || echo "git: MISSING"`
   - MISSING → 告诉用户："请先执行 `git init`"

全部通过后继续。

## 2. 收集项目信息

逐一询问以下问题（不要一次问完）：

**Q1**: "这是新项目还是已有项目的迭代？（新项目 / 已有项目）"

- 新项目 → `project_type = "new"`
- 已有项目 → `project_type = "existing"`
  - 用 Bash 检查：`test -f Update_Plan.md && echo exists || echo missing`
  - **exists** → 显示 "检测到已有 Update_Plan.md，使用现有文件继续"
  - **missing** → 执行自动生成流程（见下方「Update_Plan.md 自动生成」）
  - 自动设置 `mode = "quick"`，跳过 Q2

**Q2**（仅新项目）: "选择流程模式：完整模式（走全部步骤）还是快速模式（跳过 office-hours 和 plan-ceo-review）？"

- 完整模式 → `mode = "full"`
- 快速模式 → `mode = "quick"`

**Q3**: "这个项目有前端 UI 吗？（有 / 没有）"

- 有 → `has_ui = true`
- 没有 → `has_ui = false`

## 3. 计算起始状态

根据回答计算：

| project_type | mode | current_step | current_phase |
|-------------|------|-------------|---------------|
| new | full | office-hours | plan |
| new | quick | plan-eng-review | plan |
| existing | quick (自动) | plan-eng-review | plan |

计算 skipped_steps：
- mode = "quick" 或 project_type = "existing" → skipped_steps = ["office-hours", "plan-ceo-review"]
- mode = "full" → skipped_steps = []

## 4. 创建文件

执行以下操作：

1. 创建目录：`mkdir -p .gspowers/artifacts`
2. 确保 `.gspowers/` 在 `.gitignore` 中（state.json 包含本地路径和时间戳，不应提交）：
   用 Bash 检查并追加：`grep -q '^\.gspowers/' .gitignore 2>/dev/null || echo '.gspowers/' >> .gitignore`

2. 用 Write 工具写入 `.gspowers/state.json`：

```json
{
  "version": "1.1",
  "project_type": "{计算值}",
  "mode": "{计算值}",
  "has_ui": {计算值},
  "current_phase": "plan",
  "current_step": "{计算值}",
  "status": "in_progress",
  "failure_reason": null,
  "completed_steps": [],
  "skipped_steps": {计算值},
  "artifacts": {},
  "started_at": "{当前 ISO 8601 时间}",
  "last_updated": "{当前 ISO 8601 时间}"
}
```

3. 用 Write 工具写入 `.gspowers/handoff.md`（按 SKILL.md 中的 handoff 模板填写）

4. 显示流程地图（按 SKILL.md 中的模板，用计算出的状态标记填充）

5. 显示第一步的执行命令：
   - office-hours → 提示用户执行 `/office-hours`
   - plan-eng-review → 根据 project_type 提示：
     - new → `/plan-eng-review`（读取产品需求）
     - existing → `/plan-eng-review`（读取 Update_Plan.md）

## Update_Plan.md 自动生成

当 existing 项目没有 Update_Plan.md 时，执行以下流程：

1. 询问用户：
   > "请用自然语言描述你这次要做什么更新。
   > 比如：修复什么问题、添加什么功能、优化什么流程。
   > 尽量说清楚问题现状、期望结果和约束条件。"

2. 根据用户描述，生成 Update_Plan.md 内容，填充 4 个字段（问题现状、期望结果、约束条件、影响范围）。文件头部加 `<!-- generated-by: gspowers-v1.1 -->` 标记。模板结构：

   ```markdown
   <!-- generated-by: gspowers-v1.1 -->
   # 更新计划

   ## 问题现状
   {根据用户描述填充}

   ## 期望结果
   {根据用户描述填充}

   ## 约束条件
   {根据用户描述填充，若未提及则写"用户未指定，请在 plan-eng-review 中确认"}

   ## 影响范围
   {根据用户描述填充}
   ```

3. 展示生成的完整内容给用户确认：
   > "以下是根据你的描述生成的更新计划，请确认或修改：
   > [展示完整内容]
   > 确认无误？（是 / 需要修改）"

4. 用户确认 → 用 Write 工具写入 `Update_Plan.md`
   用户要修改 → 根据反馈调整后重新展示，直到确认

5. 继续 Q3（has_ui 询问）
