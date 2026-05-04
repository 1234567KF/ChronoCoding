---
name: kf-doc-consistency
description: |
  Checks global document consistency across the project after a new skill is installed, modified, or removed. Verifies every skill reference, trigger word, directory tree listing, and calling chain is consistent across CLAUDE.md, AICoding.md, INSTALL.md, and MANUAL.md.
  Triggers: "一致性", "文档自检", "文档检查", "全局检查", "同步检查", "doc consistency", "check docs", "自检", "全量同步检测".
metadata:
  pattern: pipeline + reviewer
  principle: 稳
  steps: "5"
  integrated-skills:
    - kf-model-router
  recommended_model: flash
---

# kf-doc-consistency — 文档全局一致性自检

> 每次新增/修改/删除技能后，执行此流水线确保所有文档引用一致。

执行前自动触发 kf-model-router 切换 flash 模型（省 token）。

---

## 流程概览

```
Stage 0 ─── Scout ─── 扫描磁盘技能目录，提取 SKILL.md frontmatter 元数据
Stage 1 ─── CLAUDE.md ─── 对比技能表 + 触发词表 + 目录树 + 调用链
Stage 2 ─── AICoding.md ─── 对比详细技能表 + 调用链 + FAQ
Stage 3 ─── INSTALL.md + MANUAL.md ─── 对比触发词映射 + 目录树
Stage 4 ─── Report ─── 输出结构化一致性报告
```

---

## Stage 0 — Scout（侦察）

扫描 `.claude/skills/` 下所有 SKILL.md，提取每个技能的元数据。

### 0a. 扫描技能目录

```bash
find .claude/skills -name "SKILL.md" -maxdepth 3 | sort
```

对每个 SKILL.md，用 Read 读取 frontmatter，提取：
- `name` — 技能名称（kf-xxx）
- `description` — 注意 `Triggers:` 部分中的触发词列表
- `metadata.pattern` — 设计模式

### 0b. 构建 "事实源" 清单

格式：

```
| skill_name | trigger_words               | description_short |
|------------|-----------------------------|-------------------|
| kf-alignment | /对齐, 说下你的理解         | 对齐工作流        |
| kf-spec     | spec coding, 写spec文档     | Spec 驱动开发     |
```

Gate: 扫描完成且清单非空后进入 Stage 1。如 `.claude/skills/` 为空，报告并终止。

---

## Stage 1 — Check CLAUDE.md

读取 `.claude/CLAUDE.md`，对以下各节执行一致性检查。

### 1a. kf- 系列技能表

**定位**：`### kf- 系列（团队自建）` 后的 markdown 表格。

**检查项**：
- [ ] **MISSING**（ERROR）：事实源中的 kf- 技能在表中没有对应行
- [ ] **STALE**（WARNING）：表中的技能在磁盘上不存在
- [ ] **DESCRIPTION_DRIFT**（INFO）：表中"说明"列与 SKILL.md description 明显不一致

每项检查记录：`{severity} | {doc} | {section} | {skill} | {detail}`

### 1b. 上游技能表

**定位**：`### 上游技能（非自建，不加 kf- 前缀）` 后的表格。

**检查项**：
- [ ] 非 kf- 技能（asta-skill, gspowers, gstack, markdown-to-docx-skill）在表中有无行
- [ ] 表中行对应的技能在磁盘上存在

### 1c. 常用触发词表

**定位**：`## 常用触发词` 后的表格。

**检查项**：
- [ ] **MISSING**（ERROR）：事实源中每个技能至少有一个触发词在此表中
- [ ] **STALE**（WARNING）：表中的技能映射在磁盘上不存在
- [ ] **TRIGGER_DRIFT**（INFO）：触发词的文字表述与 SKILL.md description 中的 Triggers 部分不匹配

### 1d. 目录结构树

**定位**：`.claude/` 目录树的 `└── skills/` 子节。

**检查项**：
- [ ] **MISSING**（ERROR）：磁盘上存在的 kf- 技能在目录树中没有列出
- [ ] **STALE**（WARNING）：目录树中列出的技能在磁盘上不存在（刚删除但未更新文档）

### 1e. 自动调用链速览

**定位**：`## 自动调用链速览` 后的 ASCII 图。

**检查项**：
- [ ] ASCII 图中引用的所有技能在磁盘上真实存在
- [ ] 对参与了 `/夯` 调用链的技能，图中是否有对应节点

### 1f. README.md — 触发词表 + 目录树 + 第三方集成

**定位**：`README.md` 中 `## 功能触发词` 和 `## 目录结构` 和 `## 第三方开源集成` 三节。

**检查项**：
- [ ] **MISSING**（ERROR）：事实源中的 kf- 技能在触发词表中没有对应行
- [ ] **MISSING_DIRTREE**（WARNING）：磁盘存在的 kf- 技能在 README 目录树中未列出
- [ ] **MISSING_CREDIT**（INFO）：第三方开源技能在集成表中未列出
- [ ] **STALE**（WARNING）：表中行引用的技能在磁盘上不存在

Gate: 1a~1f 均完成后进入 Stage 2。

---

## Stage 2 — Check AICoding.md

读取 `AICoding.md`，对以下各节执行一致性检查。

### 2a. kf- 系列详细表

**定位**：`### kf- 系列（团队自建）` 后的表格（含 7 列：技能、别名、原则、调用类型、自动调用、被谁调用、模型）。

**检查项**：
- [ ] **MISSING**（ERROR）：事实源中的 kf- 技能在表中没有对应行
- [ ] **STALE**（WARNING）：表中的行对应技能在磁盘上不存在
- [ ] **MODEL_DRIFT**（INFO）：表中"模型"列与 SKILL.md 中 `recommended_model` 不一致
- [ ] **DESCRIPTION_DRIFT**（INFO）：表中别名/描述与 SKILL.md frontmatter 不一致

### 2b. `/夯` 完整调用链

**定位**：`### 主入口 `/夯` 的完整调用链` 后的 ASCII 图。

**检查项**：
- [ ] ASCII 图中 `kf-xxx` 节点全部对应磁盘上真实存在的技能
- [ ] 无 Stale 引用（图中技能已被删除）

### 2c. 关键结论表

**定位**：`### 关键结论` 后的表格。

**检查项**：
- [ ] 表中引用的技能名称全部对应磁盘上真实存在的技能

Gate: 2a~2c 均完成后进入 Stage 3。

---

## Stage 3 — Check INSTALL.md + MANUAL.md

### 3a. INSTALL.md — 触发词映射

读取 `docs/INSTALL.md`，查找所有形如 `| \`<trigger>\` | <description> | kf-xxx |` 的行。

用 Grep 抽取：
```bash
grep -n '| `.*` |.*| kf-' docs/INSTALL.md
```

**检查项**：
- [ ] **MISSING**（ERROR）：事实源中的 kf- 技能没有一个对应的 INSTALL 触发词行
- [ ] **STALE**（WARNING）：INSTALL 中引用的 kf- 技能在磁盘上不存在
- [ ] **TRIGGER_DRIFT**（INFO）：触发词文字与 CLAUDE.md 触发词表不一致

### 3b. MANUAL.md — 功能触发速查表

**定位**：`## 四、功能触发速查` 后的表格（第 3 列为技能来源）。

**检查项**：
- [ ] **MISSING**（ERROR）：事实源中的 kf- 技能没有触发词行
- [ ] **STALE**（WARNING）：表中行引用的技能在磁盘上不存在
- [ ] **TRIGGER_DRIFT**（INFO）：触发词与事实源不一致

### 3c. MANUAL.md — 目录结构树

**定位**：MANUAL.md 中项目本地 skills 目录树（`── skills/` 子节）。

**检查项**：
- [ ] **MISSING**（ERROR）：磁盘存在的 kf- 技能在目录树中未列出
- [ ] **STALE**（WARNING）：目录树中列出的 kf- 技能在磁盘上不存在
- [ ] **ORDER_DRIFT**（INFO）：目录树中技能顺序与磁盘实际字母序不一致

Gate: 3a~3c 均完成后进入 Stage 4。

---

## Stage 4 — Report（报告）

汇总所有 stages 发现的 findings，按严重程度分组输出：

```
╔══════════════════════════════════════════════════╗
║  kf-doc-consistency — 文档一致性检查报告         ║
╚══════════════════════════════════════════════════╝

## 概要
- 扫描技能数：{N}
- 检查文档数：5（CLAUDE.md / AICoding.md / INSTALL.md / MANUAL.md / README.md）
- ERROR：{count} | WARNING：{count} | INFO：{count}

## ERROR（必须修复）
| # | 文档 | 章节 | 技能 | 问题 |
|---|------|------|------|------|
| 1 | CLAUDE.md | 技能表 | kf-xxx | 磁盘存在但表中无行 |

## WARNING（建议修复）
...

## INFO（可优化）
...
```

### 自动修复建议

对每个 ERROR/WARNING，附带修复建议：

```
ER01 | CLAUDE.md 技能表 | kf-new-skill | 缺少行
→ 修复: 在 CLAUDE.md `### kf- 系列` 表末尾添加:
  | `kf-new-skill` | — | 准 | 独立 | 简洁说明 |
```

### 退出规则

- ERROR > 0：提示"存在 N 个必须修复的一致性问题"，列出每个 ERROR 的修复命令
- ERROR = 0 且 WARNING > 0：提示"建议修复 N 个警告"
- 全部干净：输出 ✅ 全绿通过

### ⚠️ PNG 海报需手动重截

文档检查不覆盖 PNG 图片。如果新增/删除了技能，`assets/posters/宣传海报_浅色.html` 已更新但同名 PNG 是静态图片。完成所有文档修复后：

1. 在浏览器打开 `assets/posters/宣传海报_浅色.html`
2. 截图保存覆盖 `assets/posters/宣传海报_浅色.png`
3. 如果架构图变了，同样重截 `assets/posters/架构图.png`

这是 README 首屏展示图，过时了影响观感。

---

## 触发方式

### 方式 1：kf-add-skill 触发（自动）

`kf-add-skill` 在 Step 7（最终验证）中自动调用本技能。

### 方式 2：用户手动触发

用户说"做文档一致性检查"或"自检"等触发词时手动调用。
