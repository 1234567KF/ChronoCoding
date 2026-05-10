# 补充工具速查

以下工具不在 gspowers 主流程中，但在特定场景下有高价值。

---

## /plan-ceo-review — CEO 视角审查

**何时用：** 全新产品方向、大范围重构、面临多个战略选择。

**时机：** office-hours 之后、plan-eng-review 之前。已整合为 gspowers 主流程中的可选步骤。

**命令：**
```
/plan-ceo-review
```

进入 plan mode 交互式审查，从 scope expansion / product vision / user value 等维度挑战你的计划。

---

## /retro — 工程回顾

**何时用：** 每周回顾、大版本发布后、SOP 优化验证。

**时机：** 周期性执行，不在单次开发流中。

**命令：**
```
/retro
```

分析 git 历史、工作模式、代码质量指标，输出回顾报告。支持 trend tracking。

---

## /investigate — 深度调试

**何时用：** 跨模块复杂 bug、生产事故复盘。

**方法：** 4 阶段根因分析——调查 → 分析 → 假设 → 实施。不允许没找到根因就修复。

**命令：**
```
/investigate "问题描述"
```

---

## /design-consultation — 设计系统咨询

**何时用：** 新项目确定视觉风格、UI 大改版前的设计方向探索。

**命令：**
```
/design-consultation
```

---

## /cso — 安全审计

**何时用：** 发布前安全检查、处理敏感数据的功能开发后。

**命令：**
```
/cso
```

覆盖：secrets 考古、依赖供应链、CI/CD 安全、OWASP Top 10 等。

---

## /ce:compound — 经验沉淀

**何时用：** 每次 /ship 后，有值得记录的经验时。

**时机：** ship 之后、document-release 之前。已整合为 gspowers 主流程中的可选步骤。

**命令：**
```
/ce:compound
```

将本次开发中的问题解决方案结构化记录到 `docs/solutions/`，带 YAML frontmatter 便于未来搜索。gspowers 在后续项目的 brainstorming 前会自动搜索这些经验。

---

## /ce:compound-refresh — 经验刷新

**何时用：** 重构、迁移、依赖升级后，检查历史经验是否过时。

**时机：** 周期性执行，不在单次开发流中。

**命令：**
```
/ce:compound-refresh
```

审查 `docs/solutions/` 中的文档，更新、合并或标记过时的经验记录。
