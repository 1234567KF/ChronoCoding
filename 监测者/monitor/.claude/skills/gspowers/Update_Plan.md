# 更新计划

## 问题现状

gspowers v1 的 10 步流程（gstack + superpowers）运行稳定，但存在两个结构性缺陷：

1. **无知识复利**：每次开发从零开始，过去踩过的坑、总结的经验无法自动注入新项目的设计阶段。brainstorming 只读架构文档，不读历史经验。
2. **无经验沉淀机制**：ship 后直接进入 document-release，没有结构化捕获"本次开发学到了什么"的环节。经验散落在聊天记录中，随 /clear 消失。
3. **已有项目 init 流程笨拙**：要求用户手动创建 Update_Plan.md（复制模板、填写 4 个字段），增加启动摩擦。

同时，项目已安装 Compound Engineering (CE) 和 oh-my-claudecode (OMC) 两个插件，但 gspowers 流程未利用它们的能力。

## 期望结果

### v1.1 目标：知识复利闭环

1. **新增 `compound` 步骤**（ship → compound → document-release）：
   - 调用 `/ce:compound` 将本次开发经验结构化记录到 `docs/solutions/`
   - 可选步骤——用户判断无经验值得记录时可跳过

2. **brainstorming 前置知识搜索**：
   - 在提示 brainstorming 之前，自动 grep `docs/solutions/` 中的相关历史经验
   - 有结果则写入 `.gspowers/artifacts/prior-learnings.md`，作为 brainstorming 参考输入

3. **已有项目 init 流程简化**：
   - 用户用自然语言描述更新意图 → gspowers 自动生成 Update_Plan.md → 确认后进入 plan-eng-review

4. **文档更新**：sop.md 和 tools-guide.md 反映新增的 CE/OMC 层

### 形成的闭环

```
compound (沉淀经验) → docs/solutions/ → 知识搜索 (注入设计) → brainstorming
```

## 约束条件

- **不替换 superpowers 核心链**：brainstorming / writing-plans / subagent-dev 保持不变，它们的 TDD 特化能力是 CE 无法替代的
- **不替换 gstack /review**：ce:review 虽有 17+ 人格，但与现有 review 步骤重叠，不新增步骤
- **不增加 /clear 边界**：compound 步骤在 finish 阶段内，与 ship/document-release 共享上下文
- **向后兼容**：v1.0 state.json 的项目能自然过渡到新流程（状态机映射是 source of truth）
- **导航员模式不变**：gspowers 只提示命令，不自动执行子 skill

## 影响范围

| 文件 | 路径 | 变更 |
|------|------|------|
| finish.md | `~/.claude/skills/gspowers/references/finish.md` | 新增 compound 段落，修改 ship 转换目标 |
| SKILL.md | `~/.claude/skills/gspowers/SKILL.md` | 更新步骤映射 + 流程地图 |
| execute.md | `~/.claude/skills/gspowers/references/execute.md` | brainstorming 前插入知识搜索 |
| init.md | `~/.claude/skills/gspowers/references/init.md` | 已有项目 init 流程改造 |
| sop.md | `~/.claude/skills/gspowers/references/sop.md` | 流程表新增 compound，新增执行层说明 |
| tools-guide.md | `~/.claude/skills/gspowers/references/tools-guide.md` | 新增 ce:compound 和 OMC 条目 |
