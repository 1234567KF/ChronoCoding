# AI编程智驾 — Trae 项目规则

> 本规则提取自 `.claude/CLAUDE.md` 和 `.claude/skills/` 中的团队约定，适用于 Trae IDE Builder 环境。

## 六大原则

| 原则 | 含义 | 触发场景 |
|------|------|---------|
| **稳** | 安全可靠，Harness 五根铁律审计兜底 | 所有代码变更 |
| **省** | 模型路由，计划用 pro，执行用 flash | 技能启动时 |
| **准** | 多源验证，web-search + scrapling 交叉确认 | 技术调研 |
| **测的准** | 浏览器自动化验证，gstack/Playwright | 有 UI 的变更 |
| **夯** | 多团队竞争评审，红蓝绿三队并发 | 复杂任务 |
| **快** | 工作流导航，kf-go 显示路径 | 启动/恢复开发 |
| **懂** | 默契对齐，动前谈理解，动后谈 diff | 任务开始/结束 |

## 代码风格

1. 生成代码时添加函数级中文注释
2. 遵循现有项目的代码约定（命名、目录结构、导入风格）
3. 禁止引入未在项目中使用的框架/库
4. 安全优先：不暴露密钥和敏感信息
5. 不主动创建 `README.md` 等文档文件，除非用户明确要求

## 可用技能速查

| 触发词 | 技能 | 说明 |
|--------|------|------|
| `/go` / `/导航` | kf-go | 工作流导航，显示开发路径和当前进度 |
| `/夯 [任务]` | kf-multi-team-compete | 红蓝绿三队并发竞争评审 |
| `spec coding` / `写spec文档` | kf-spec | Spec 驱动开发（6 步流水线） |
| `/对齐` / `说下你的理解` | kf-alignment | 动前对齐 + 动后复盘 |
| `/review-graph` | kf-code-review-graph | 代码审查依赖图谱 |
| `/web-search [问题]` | kf-web-search | 多引擎智能搜索 |
| `/browser-ops` | kf-browser-ops | 浏览器自动化测试 |
| `/prd-generator` | kf-prd-generator | 需求 → 结构化 PRD 文档 |
| `生成原型` / `UI原型` | kf-ui-prototype-generator | PRD → HTML 原型 |
| `P图` / `改图` | kf-image-editor | AI 自然语言图片编辑 |
| `爬虫` / `抓取` | kf-scrapling | Web 爬虫 + 反反爬 |
| `triple [任务]` | kf-triple-collaboration | 红蓝裁判三方评审 |
| `设计Skill` / `创建Skill` | kf-skill-design-expert | Skill 设计专家 |
| `转docx` | markdown-to-docx | Markdown → DOCX 转换 |
| `/gspowers` | gspowers | 开发全流程编排器 |

## 自动调用链

```
用户触发 "/夯 [任务]"
  ├─ Pre-Stage：kf-prd-generator → PRD.md（条件触发）
  └─ 三队并发 Pipeline
       ├─ kf-alignment         ← 需求对齐（Stage 0）
       ├─ kf-spec              ← 需求基线（Stage 0）
       ├─ kf-web-search        ← 技术资料搜索（按需）
       ├─ kf-scrapling         ← 深度网页抓取（按需）
       ├─ kf-ui-prototype-generator ← UI 原型（Stage 2/5）
       ├─ kf-image-editor      ← AI P 图（Stage 2/5）
       ├─ kf-browser-ops       ← 自动化测试（Stage 3）
       ├─ kf-code-review-graph ← 代码审查（Stage 4）
```

## 工具依赖

| 工具 | 用途 | 安装检查 |
|------|------|---------|
| Node.js | 运行环境 | `node --version` |
| Python 3.10+ | Scrapling 爬虫 | `python --version` |
| Playwright | 浏览器自动化 | `npx playwright --version` |
| pandoc | Markdown 转 DOCX | `pandoc --version` |
| Scrapling | Web 爬虫 | `pip show scrapling` |

## Lint 和构建命令

```powershell
# 项目构建（根据实际项目类型调整，此处为通用占位）
# npm run build
# npm run lint
# npm run typecheck
```

## 对齐工作流（动前/动后）

**动前**（接到任务后，执行前）：
1. 复述理解：要做什么、为什么做、约束条件
2. 说明打算：分几步、技术方案、关键决策点
3. 确认边界：本期做什么 / 不做什么 / 风险

**动后**（完成任务后）：
1. 实际做了什么
2. 与计划差异对比
3. 关键决策说明
4. 遗留问题

## Harness 五根铁律自检

> **核心原则**：Plan → Build → Verify → Fix 强制循环。每个关键阶段产出后 MUST 执行自检，不通过不推进。

### 自检触发时机

| 技能 | 触发时机 | 自检依据 |
|------|---------|---------|
| kf-alignment | Phase 1 动前对齐产出后 | 检查是否包含"我的理解""我的打算""边界确认"，无 TODO/待定 |
| kf-alignment | Phase 2 动后复盘产出后 | 检查是否包含"实际做了什么""与计划差异""关键决策""遗留问题" |
| kf-prd-generator | Gate 1 通过后 | 检查"目标用户""核心业务目标""技术约束"章节完整性 |
| kf-prd-generator | Gate 1.5 通过后 | 检查组件库版本号、技术约束版本号、无 ⚠️ 状态 |
| kf-prd-generator | Phase 2 产出后 | 检查"需求背景""业务规则""数据字段定义""验收标准" |
| kf-spec | Step 2 设计产出后 | 检查"数据模型""API 契约""组件树" |
| kf-multi-team-compete | 每队每个 Stage 产出后 | 检查对应阶段产物 *-0N-*.md 是否存在 |
| kf-code-review-graph | 图谱生成后 | 检查 *-dependency-graph.md 是否存在 |
| kf-code-review-graph | 审查报告生成后 | 检查"变更影响范围""审查优先级"章节 |
| kf-triple-collaboration | 三方方案产出后 | 检查"方案 A""方案 B""方案 C" |
| kf-triple-collaboration | 裁判评分后 | 检查"评分卡""排名" |
| kf-triple-collaboration | 最终融合后 | 检查"最终方案""优势汇总" |
| kf-ui-prototype-generator | Gate 1 通过后 | 检查参数完整性 |
| kf-web-search | 搜索执行后 | 检查搜索结果不为空 |
| kf-browser-ops | 测试执行后 | 检查 test-results.json 无 FAIL |

### 自检执行方式

```
在每个 Gate/Stage 产出后，自动：
1. 读取刚产出的文档/产物
2. 对照上述 checklist 逐项验证
3. 输出验证结果（✅ 通过 / ❌ 失败）
4. ❌ 时：修复问题或补充缺失后重新验证，不跳过
```

### 完整审计

输入 `Harness 评审` 或 `五根铁律审计` 时，将自动调用 [kf-harness-audit](.trae/skills/kf-harness-audit/SKILL.md) 执行全量检查。

## /夯（kf-multi-team-compete）串行执行约定

> 因 Trae IDE 不支持多 Agent 并发，`/夯` 在 Trae 中采用串行降级方案。

三队执行顺序：**红队 → 蓝队 → 绿队**（依次串行）

| 团队 | 顺序 | 视角 | 优先考虑 |
|------|------|------|---------|
| 红队 | 第 1 个 | 激进创新者 | 性能极致、新技术采用、架构突破 |
| 蓝队 | 第 2 个 | 稳健工程师 | 可维护性、工期可控、团队能力匹配 |
| 绿队 | 第 3 个 | 安全保守者 | 零漏洞、边界完备、合规/降级/回滚 |

每个团队的内部 Pipeline 不变（仍按 Stage 0→5 顺序执行），只是三队之间不再并行。
裁判评分和汇总融合在全部三队完成后统一执行。

## 记忆管理

- 跨会话学习记录存储在 `memory/` 目录
- 每次启动相关 Skill 时，先读取 `memory/` 中最近记录作为基线
- 避免对已确认事项重复提问
