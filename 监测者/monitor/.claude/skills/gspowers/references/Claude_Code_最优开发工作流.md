---
type: sop
domain: "[[_MOC_系统运维]]"
status: validated
tags:
  - claude-code
  - superpowers
  - gstack
  - 开发工作流
created: 2026-03-21
updated: 2026-03-21
graduated_from: "[[Claude Code 最优开发工作流]]"
---

# Claude Code 最优开发工作流

> **方案核心**：superpowers 为主干 + gstack 按需补充
>
> **原则**：每个工具只用在它不可替代的场景，不重复、不冗余

---

## 工具分工总览

| 工具 | 定位 | 用什么 | 不用什么 |
| :--- | :--- | :--- | :--- |
| **superpowers** | 开发主干 | `brainstorming`, `writing-plans`, `subagent-driven-development` | — |
| **gstack** | 产品思维 + QA + 发布 | `/office-hours`, `/review`, `/qa`, `/ship` | `/plan-eng-review`, `/plan-ceo-review`（与 superpowers 重叠） |
| **planning-with-files** | 不使用 | — | 全部（superpowers 子代理模式天然解决上下文漂移） |

### 为什么砍掉 planning-with-files

planning-with-files 的核心价值是防止长会话（50+ 工具调用）的上下文漂移。但 superpowers 的子代理模式天然解决了这个问题——每个子代理都是全新上下文，不存在"忘记目标"的问题。planning-with-files 的 hooks 会在每次工具调用时注入额外内容，在子代理模式下纯属浪费 token。

### 为什么砍掉 gstack 的 plan-eng-review / plan-ceo-review

superpowers 的 `brainstorming` 产出设计文档后已经过审查子代理迭代（最多 3 轮），`writing-plans` 同样经过审查。再叠加 gstack 的 plan 审查属于重复劳动。保留 `/review` 是因为它做的是**代码级全局 diff 审查**，这是 superpowers 子代理自审（逐任务粒度）覆盖不到的。

---

## 决策树

```
需求清晰吗？
  ├─ 否 → Step 1: /office-hours
  │         ↓
  │       Step 2: /brainstorm
  └─ 是 → Step 2: /brainstorm（直接开始）
             ↓
           Step 3: 写实现计划
             ↓
           Step 4: 子代理执行
             ↓
           Step 5: /review（全局代码审查）
             ↓
           有 UI 吗？
            ├─ 是 → Step 6: /qa → Step 7: /ship
            └─ 否 → Step 7: /ship
```

**最短路径（需求清晰 + 无 UI）：5 步**
`/brainstorm` → 写计划 → 子代理执行 → `/review` → `/ship`

**最长路径（需求模糊 + 有 UI）：7 步**
`/office-hours` → `/brainstorm` → 写计划 → 子代理执行 → `/review` → `/qa` → `/ship`

---

## 各步骤详解

### Step 1 · 产品发现（可选）

- **何时用**：需求模糊、方向不明确、做新产品时
- **何时跳过**：需求已经清晰、是已有功能的迭代

```
/office-hours
```

gstack 的 `office-hours` 会用 YC 的 6 个强制问题重新审视产品：

1. 你在解决谁的什么问题？
2. 现状方案是什么？为什么不够好？
3. 谁会*绝望地*需要这个？
4. 最窄的楔形切入点是什么？
5. 你看到了什么别人没看到的？
6. 这件事未来为什么会更大？

**产出**：重新定义的产品方向 + 推荐的最窄切入方案

---

### Step 2 · 技术设计

```
[/brainstorm](superpowers:brainstorming)
```

superpowers 的 `brainstorming` 会自动：

1. 探索项目上下文（读代码、文档、git 历史）
2. 逐步问澄清问题（偏好选择题）
3. 提出 2-3 个技术方案并对比 trade-offs
4. 逐节呈现设计，每节需要你确认
5. 写入设计文档 → `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`
6. 交给审查子代理迭代（最多 3 轮）

**硬门禁**：设计未通过不会进入下一步。

**产出**：经过审查的设计文档

---

### Step 3 · 写实现计划

`brainstorming` 结束后会自动询问是否生成计划，确认即可：

```
是的，请生成实现计划
```

自动触发 `superpowers:writing-plans`：

- 按设计文档拆分为 2-5 分钟粒度的任务
- 每个任务采用 TDD 格式：失败测试 → 最小实现 → 通过测试 → 提交
- 包含完整代码片段和执行命令
- 经过审查子代理迭代（最多 3 轮）

计划完成后会让你选执行方式：

```
请选择执行方式：
  A. Subagent-Driven（推荐）— 每个任务派独立子代理
  B. Inline Execution — 当前会话直接执行
```

**选 A。**

**产出**：`docs/superpowers/plans/YYYY-MM-DD-<feature>.md`

---

### Step 4 · 子代理执行

```
请用子代理执行计划
```

触发 `superpowers:subagent-driven-development`，对每个任务：

1. **派实现子代理** — 带完整任务描述和上下文，写代码、跑测试、提交
2. **派规范合规审查子代理** — 检查实现是否符合设计文档
   - 有问题 → 实现子代理修复 → 重新审查
3. **派代码质量审查子代理** — 检查代码质量、边界情况、安全性
   - 有问题 → 实现子代理修复 → 重新审查
4. **标记任务完成** → 进入下一个任务

**关键规则**：
- 不跳过任何一轮审查
- 不并行派多个实现子代理（避免冲突）
- 规范审查通过后才进代码质量审查

**产出**：所有任务完成，代码已提交到分支

---

### Step 5 · 全局代码审查

```
/review
```

gstack 的 `/review` 以"资深工程师"视角审查整个分支的 diff，专找：

- 通过 CI 但会在生产中爆炸的问题
- 竞态条件、SQL 注入、LLM 信任边界违规
- 跨文件的系统性问题（子代理逐任务审查看不到的）
- 条件性副作用、未处理的边界情况
- 明显问题自动修复

> **为什么不能省**：Step 4 的审查是"逐砖检查"，这一步是"退后两步看整面墙"。局部正确不等于全局一致。

**产出**：修复后的代码 + 审查报告

---

### Step 6 · QA 测试（仅 UI 项目）

- **何时用**：项目有前端 UI
- **何时跳过**：纯后端、CLI 工具、库

```
/qa http://localhost:3000
```

gstack 的 QA 会：

1. 用真实 Chromium 浏览器打开应用
2. 按流程点击、输入、交互
3. 截图记录每一步
4. 发现 bug 后直接在源码中修复
5. 自动生成回归测试

如果遇到登录墙：

```
/setup-browser-cookies
```

从你的真实浏览器导入 cookie 到无头会话。

**产出**：修复的 bug + 回归测试

---

### Step 7 · 发布

```
/ship
```

gstack 一键完成：

1. 检测并合并 base 分支（main/master）
2. 运行完整测试套件
3. 审查 diff
4. Bump VERSION
5. 更新 CHANGELOG
6. 提交、推送
7. 创建 PR

如果需要同步更新文档：

```
/document-release
```

读取所有项目文档，对比 diff，更新 README / ARCHITECTURE / CONTRIBUTING / CLAUDE.md。

**产出**：PR 链接

---

## 审查机制对比

本方案包含三层审查，各自覆盖不同维度：

| 审查层 | 来源 | 粒度 | 关注点 |
| :--- | :--- | :--- | :--- |
| 规范合规审查 | superpowers 子代理 | 单任务 | 实现是否符合设计文档 |
| 代码质量审查 | superpowers 子代理 | 单任务 | 代码风格、边界情况、安全性 |
| 全局 diff 审查 | gstack `/review` | 整个分支 | 跨文件交互、系统性问题、生产风险 |

三层不重叠、不可互替。

---

## 快速参考卡

```bash
# 1. 产品发现（可选）
/office-hours

# 2. 技术设计
/brainstorm

# 3. 写计划（brainstorm 结束后确认触发）
是的，请生成实现计划

# 4. 执行（选 Subagent-Driven 后）
请用子代理执行计划

# 5. 全局审查
/review

# 6. QA（仅 UI 项目）
/qa http://localhost:3000

# 7. 发布
/ship
```
