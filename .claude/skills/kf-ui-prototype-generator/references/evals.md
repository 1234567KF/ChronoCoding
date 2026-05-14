# Evals for kf-ui-prototype-generator

## Positive (Skill SHOULD load)

| # | User Query | Expected | Notes |
|---|-----------|----------|-------|
| 1 | "帮我生成一个营销码管理列表页原型" | YES | Core trigger: 原型 + 列表页 |
| 2 | "根据这个 PRD 生成用户管理页面的 HTML 原型" | YES | PRD → prototype flow |
| 3 | "UI原型：订单详情页" | YES | 中文 trigger "UI原型" |
| 4 | "prototype a dashboard for sales metrics" | YES | English trigger "prototype" |
| 5 | "生成页面原型，包含表单和表格" | YES | 页面原型 trigger |
| 6 | "用暗门注释生成这个页面的原型" | YES | 暗门注释 trigger |
| 7 | "把这个 PRD 转成可交互的 HTML 原型" | YES | PRD→HTML flow |

## Negative (Skill should NOT load)

| # | User Query | Expected | Notes |
|---|-----------|----------|-------|
| 8 | "帮我写一个 Vue 组件" | NO | Vue component, not HTML prototype |
| 9 | "用 Tailwind 重构这个页面" | NO | CSS refactoring, not prototype generation |
| 10 | "这个 Figma 设计转成代码" | NO | Design→code, different domain |
| 11 | "修复页面上的 bug" | NO | Bug fix, not generation |
| 12 | "写一个 React hooks" | NO | React development, not HTML prototype |
| 13 | "优化网站的 SEO" | NO | SEO optimization, unrelated |
| 14 | "部署这个前端项目" | NO | Deployment, not generation |

## Annotation Quality Evals (新增 — 注释质量验证)

> 以下用例验证注释体系的完整性和可用性。

### Positive (注释体系应覆盖)

| # | 验证场景 | Expected | 检查项 |
|---|---------|----------|--------|
| A1 | 原型生成后是否包含业务描述注释（CRUD/状态流转/权限） | YES | L0 页面概述必须包含 CRUD 操作矩阵和数据权限表 |
| A2 | 查询字段是否每个都标注了字段名/类型/前端形式/校验规则 | YES | 查询字段区每个字段必含 4 属性 |
| A3 | 列表字段是否每个都标注了字段名/类型/说明/前端形式 | YES | 列表列每个字段必含 4 属性 |
| A4 | 新增表单字段是否每个都标注了字段名/类型/说明/形式/校验 | YES | 新增表单字段必含 5 属性，含边界值约束 |
| A5 | 修改表单字段是否标注了与新增的差异 | YES | 修改表单字段必须额外标注"与新增差异" |
| A6 | 是否包含异常处理与边界值表 | YES | 至少含异常场景描述 + 边界值定义（含 min/max） |
| A7 | 注释模板填充后是否无缺失字段 | YES | 自动化检查每页注释的 6 类覆盖完整性 |

### Negative (注释体系不应缺失)

| # | 验证场景 | Expected | 检查项 |
|---|---------|----------|--------|
| A8 | 查询字段缺少校验规则 | NO | 查询字段的校验规则不可缺失（即使为"无"也需显式标注） |
| A9 | 列表字段缺少前端表现形式 | NO | 列表字段必须标注前端形式（文本/标签/链接等） |
| A10 | 表单字段缺少边界值定义 | NO | 输入字段必须含 maxLength/min/max 等边界值 |
| A11 | 修改表单未标注与新增的差异 | NO | 修改表单必须显式标注与新增不同之处 |
| A12 | 业务描述中遗漏数据权限 | NO | 每个页面必须标注角色可见/可操作范围 |
| A13 | 缺少异常场景描述 | NO | 至少覆盖 3 类异常：空数据/格式错误/越权操作 |

## Eval Execution

To verify the Skill loads correctly:
1. Run each positive query — Skill should activate
2. Run each negative query — Skill should NOT activate
3. Check that false positives don't degrade other skills' routing

To verify annotation quality:
1. Generate a prototype with the skill
2. Check the annotation drawer for all 6 required annotation types
3. Validate each type against the field-level completeness checklist
4. Run `node .claude/helpers/harness-gate-check.cjs --skill kf-ui-prototype-generator --stage annotate --check-anno-completeness` if available
