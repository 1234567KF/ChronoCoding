---
name: kf-multi-team-compete
description: |
  多团队竞争评审（中文别称：夯）。swarm 启动真实多 Agent 并发，红蓝绿队各含开发者 agent 按 Pipeline 流水线协作，
  裁判+汇总师评分融合。Pipeline 引擎来自 gspowers，融入本技能作为团队内部流水线编排。
  触发词："夯"、"多团队竞争"、"竞争评审"、"裁判对比"。
triggers:
  - 夯
  - 多团队竞争
  - 竞争评审
  - 裁判对比
  - 多方案对比
  - /夯
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - AskUserQuestion
  - Agent
  - TaskCreate
  - TaskUpdate
  - SendMessage
  - WebSearch
  - WebFetch
metadata:
  pattern: pipeline + inversion + reviewer
  steps: "6"
  interaction: multi-turn
  recommended_model: pro
  pipeline_engine: gspowers
  integrated-skills:
    - kf-alignment
    - kf-code-review-graph
    - kf-spec
    - kf-ui-prototype-generator
    - kf-browser-ops
    - kf-web-search
    - kf-scrapling
    - kf-opencli
    - kf-prd-generator
    - kf-model-router
    - kf-image-editor
    - skill-creator
---

# 夯 — 多团队竞争评审系统

你是「夯」模式的协调者。**夯 = 力大 + 万法 = 碾压**。

核心理念：swarm 多 Agent 并发，红蓝绿三队各按 **Pipeline 流水线** 推进，
不同视角方案碰撞，裁判择优，汇总博采众长，**对抗者从易错角度挑战**，
汇总者回应调整并执行，输出碾压级方案。

---

## 架构总览

```
                    用户输入（任务描述 / SDD Excel / PRD）
                             │
                    检测到 .xlsx？─── 是 ──→ Pre-Stage: kf-prd-generator → PRD.md
                             │                        │
                            否                        ▼
                             │              三队均以 PRD.md 为输入
                             └────────┬───────────────┘
                                      ▼
                                 Swarm Init
                                      │
                       ┌──────────────┼──────────────┐
                       ▼              ▼              ▼
                 红队 Pipeline    蓝队 Pipeline    绿队 Pipeline
                 (激进创新)       (稳健工程)       (安全保守)
                       │              │              │
                       └──────────────┼──────────────┘
                                      ▼
                                 裁判评分
                                      │
                                      ▼
                             汇总融合（初版）
                                      │
                                      ▼
                           ┌────────────────────┐
                           │  对抗者质疑挑战     │  ← NEW
                           │  (魔鬼代言人)       │
                           └─────────┬──────────┘
                                     │
                                     ▼
                           ┌────────────────────┐
                           │  汇总者回应与调整   │  ← NEW
                           │  (接受/驳回+执行)   │
                           └─────────┬──────────┘
                                     │
                                     ▼
                             最终方案（含执行）
```

每队内部不是散兵游勇，而是 **6 阶段流水线**，阶段间有明确门控和产物交接。
汇总融合后新增 **对抗者质疑 → 汇总者回应** 闭环，确保方案经得起现实推敲。

---

## 团队内部流水线（Team Internal Pipeline）

每个团队（红/蓝/绿）的开发者 agent 自动执行以下流水线。
**上游阶段输出自动成为下游阶段输入。禁止跳过。**

```
Pre-Stage     Stage 0        Stage 1        Stage 2        Stage 3        Stage 4        Stage 5
 物料准备  →   需求对齐  →    架构设计   →    编码实现   →    集成测试   →    代码审查   →    方案汇总
 (协调者)      (全栈开发)     (全栈开发)     (全栈开发)     (集成测试)     (集成测试)     (前端设计师)
    │              │              │              │              │              │              │
    ▼              ▼              ▼              ▼              ▼              ▼              ▼
 PRD文档       对齐记录      架构方案       代码产物       测试报告       审查报告       团队方案
```

### Pre-Stage — 需求物料准备（条件触发）

> **触发条件**：用户输入包含 SDD Excel 文件（`.xlsx`）或用户说"写PRD"/"生成PRD"时自动执行；否则跳过。

- **执行者**：协调者（本 Skill 自身，不 spawn agent）
- **动作**：
  1. 检测用户输入中是否包含 `.xlsx` 文件路径，或用户显式要求"写PRD"
  2. 若触发：`Skill({skill: "kf-prd-generator", args: "<文件路径或需求描述>"})`
  3. kf-prd-generator 完成 Phase 1 需求问询 → Phase 1.5 技术栈检测 → Phase 2 生成 PRD.md
  4. PRD.md 生成后，kf-prd-generator 自动调用 kf-alignment 做动后对齐
- **产出**：`PRD.md` — 结构化需求文档（背景、业务流、规则、页面、验收标准）
- **门控**：PRD.md 生成完成且通过 kf-prd-generator 的 Gate 1.5 机械化验证后 → 三队 Stage 0 均以该 PRD 为输入
- **跳过条件**：用户未提供 .xlsx 且未要求写 PRD，且任务描述已足够清晰 → 直接进入 Phase 1

**正确的链路**：`SDD Excel → kf-prd-generator → PRD.md → kf-spec → Spec → 夯 并发执行`

**注意**：即使无 SDD Excel，只要任务描述模糊（如一句话需求），协调者也应主动建议用户先走 kf-prd-generator 做需求结构化，或走 kf-spec 做 Spec 驱动开发，再进入 `/夯` 并发竞争。

### Stage 0 — 需求对齐（recording 模式）

- **执行者**：全栈开发 agent
- **模式**：`kf-alignment` recording 模式（不阻塞，不提问用户）
- **输入**：
  1. PRD.md / Spec（如果有）
  2. 协调者锁定的**假设基线**（Phase 1.3，由 swarm 广播注入 prompt）
  3. 本团队角色定位（红/蓝/绿）
- **动作**：
  1. 读取输入源，对齐需求理解
  2. 检查假设基线是否足够支撑 Stage 1 架构设计
  3. 若发现关键歧义（影响架构选型），记录为 `[ASSUMPTION:CRITICAL]`，不影响继续推进
  4. MUST NOT 向用户提问或阻塞流水线
- **产出**：`{team}-00-alignment.md` — 需求理解、边界确认、技术约束、补充假设清单（如有）
- **门控**：对齐记录产出后自动进入 Stage 1（不等待用户确认）
- **三队约束**：三队共享同一份假设基线，确保方案可比；各自只能补充假设，不能推翻基线

### Stage 1 — 架构设计

- **执行者**：全栈开发 agent
- **输入**：Stage 0 对齐记录
- **动作**：设计数据模型、API 契约、组件树、路由方案；**可调用 `kf-web-search` 搜索技术方案和最佳实践，`kf-scrapling` 深度抓取参考实现，`kf-opencli` 从特定平台（GitHub/知乎/Reddit/arXiv/HackerNews）结构化直取技术资料**
- **产出**：`{team}-01-architecture.md` — 架构图、模块划分、技术选型理由
- **门控**：架构方案无歧义，关键决策点已标注

### Stage 2 — 编码实现

- **执行者**：全栈开发 agent
- **输入**：Stage 1 架构方案
- **动作**：
  1. 按架构方案编码，前端设计师 agent 并行启动处理 UI 部分
  2. **MUST** 编码完成后执行 coding checklist：`ctx_read .claude/rules/mvp-coding-checklist.md`
  3. 逐项自检 A-J 类型（A/B/D/J 为 P0 必须检查），修复发现的问题
- **产出**：代码文件 + `{team}-02-implementation.md`（含 checklist 自检结果）
- **门控**：代码可编译/运行，无语法错误；checklist P0 项全部通过

### Stage 3 — 集成测试

- **执行者**：集成测试 agent
- **输入**：Stage 2 代码产物 + Stage 2 checklist 自检结果
- **动作**：
  1. 编写并运行测试用例，调用 `kf-browser-ops` 做 UI 自动化测试
  2. **MUST** 加载 coding checklist：`ctx_read .claude/rules/mvp-coding-checklist.md`
  3. 按 checklist 逐类构造测试用例（A: ref解包 / B: 跨文件一致性 / C: 导航方法 / D: 模板作用域 / E: SPA路由 / F: API路径 / G: 响应结构 / H: URL构造 / I: 环境一致 / J: 导入遗漏）
- **产出**：`{team}-03-test-report.md` — 测试覆盖、通过/失败、边界验证、checklist 测试矩阵
- **门控**：核心 Happy Path 测试通过；checklist A/B/D/F/G/J 类专项测试通过方可进入 Stage 4

### Stage 4 — 代码审查

- **执行者**：集成测试 agent
- **输入**：Stage 2 代码 + Stage 3 测试报告（含 checklist 测试矩阵）
- **动作**：
  1. 调用 `kf-code-review-graph` 生成依赖图谱、涟漪效应分析、审查优先级
  2. **MUST** 核对 checklist 执行完整性：开发自检是否真实执行？测试是否覆盖了 checklist 类型？
  3. 发现遗漏的 checklist 项 → 标记为 error，回退 Stage 2/3 修复
- **产出**：`{team}-04-review-report.md`（含 checklist 审计结论）
- **门控**：无 error 级别问题；warning 级别已记录并评估；checklist 审计通过（自检+测试+审查三重确认）

### Stage 5 — 方案汇总

- **执行者**：前端设计师 agent
- **输入**：Stage 0-4 所有产物
- **动作**：汇总团队方案，从团队视角补充 UI/UX 评估
- **产出**：`{team}-05-final.md` — 团队的最终方案（含方案概述、核心思路、优势、风险）

### 流水线自动触发

当 swarm 为团队 spawn agent 时，通过 `task_orchestrate` 定义阶段依赖 DAG：

```
Stage0 → Stage1 → Stage2 → Stage3 → Stage4 → Stage5
```

每个 agent 完成当前阶段后自动触发下一阶段。阶段失败则阻塞该团队流水线，
其他团队流水线不受影响。

### 阶段间产物传递（Token 优化）

上游阶段产物传递给下游时，**MUST 使用 lean-ctx 压缩模式读取**，禁止全文读入上下文：

| 上游产物 | 读取方式 | 说明 |
|---------|---------|------|
| `{team}-00-alignment.md` | `ctx_read(path, "reference")` | 对齐记录 — 仅取关键假设和约束 |
| `{team}-01-architecture.md` | `ctx_read(path, "map")` | 架构方案 — 仅取模块划分和接口契约 |
| `{team}-02-implementation.md` | `ctx_read(path, "aggressive")` | 实现报告 — 最大压缩，仅取文件清单和关键片段 |
| `{team}-03-test-report.md` | `ctx_read(path, "reference")` | 测试报告 — 仅取失败用例和覆盖缺口 |
| `{team}-04-review-report.md` | `ctx_read(path, "reference")` | 审查报告 — 仅取 error 级别问题 |
| `{team}-05-final.md` | `ctx_read(path, "map")` | 最终方案 — 仅取方案概述和关键决策 |

**原因**：阶段产物可能包含大量代码片段和详细描述，全文读入会浪费 token。
使用 lean-ctx 的模式化读取，可将阶段间传递的 token 从 5K-20K 压缩至 200-800 tok（~95% 节省）。

---

## 三团队角色定义

| 团队 | 视角 | 优先考虑 |
|------|------|---------|
| **红队** | 激进创新者 | 性能极致、新技术采用、架构突破 |
| **蓝队** | 稳健工程师 | 可维护性、工期可控、团队能力匹配 |
| **绿队** | 安全保守者 | 零漏洞、边界完备、合规/降级/回滚 |

每队 3 个 agent 分工，外加独立角色：

| Agent | 流水线阶段 | 联动 | 模型 |
|-------|-----------|------|------|
| **全栈开发** | Stage 0-2（对齐→架构→编码） | `kf-spec`、`kf-alignment`、`kf-web-search`（按需搜索技术方案）、`kf-scrapling`（按需深度数据采集）、`kf-opencli`（按需平台数据直取） | `sonnet`（flash） |
| **集成测试** | Stage 3-4（测试→审查） | `kf-browser-ops`、`kf-code-review-graph`、`kf-web-search`（按需搜索测试方案）、`kf-opencli`（按需浏览器自动化） | `sonnet`（flash） |
| **前端设计师** | Stage 2 UI 并行 + Stage 5 方案汇总 | `kf-ui-prototype-generator`、`kf-web-search`（按需搜索 UI 参考）、`kf-scrapling`（按需抓取设计参考）、`kf-opencli`（按需平台设计素材） | `sonnet`（flash） |
| **对抗者** | Phase 5 对抗质疑（单一 agent，不拆分） | — | `opus`（pro） |
| **裁判** | Phase 3 评分（单一 agent，不拆分） | `kf-alignment` | `sonnet`（flash） |
| **汇总者** | Phase 4 初版融合 + Phase 6 回应与执行 | 全部 integrated-skills，可按需 spawn 子 agent 执行 | `opus`（pro） |
| **协调者（本 Skill）** | Pre-Stage + Phase 1-6（任务拆解→裁判评分→汇总融合→对抗→执行） | 全部 integrated-skills | `opus`（pro） |

---

## 执行流程

### Step 0 — 环境准备

确认 claude-flow MCP 可用，不可用时自动修复：

```
1. 执行 `claude mcp list` 检查 ruflo 是否在线
2. 若未注册（回退模式：swarm 面板 0/15），自动执行：
   claude mcp add ruflo -- npx -y ruflo@latest mcp start
3. 验证 ruflo MCP 在线后，swarm_init → 创建 hierarchical-mesh 拓扑
4. 为每队创建 Pipeline 任务 DAG（task_orchestrate）
5. 确认 swarm 面板计数 > 0 再进入 Phase 1
```

**回退模式**（MCP 修复失败时）：单会话顺序模拟三团队视角。

### Step 0.1 — 根据任务类型调整规模

| 任务类型 | Agent 配置 | 流水线策略 |
|----------|-----------|-----------|
| **编码开发** | 3 agent/队 × 3 队 + 裁判 + 汇总 + 对抗者 = 12 | 完整 6 阶段流水线 + 对抗质疑 |
| **文档生成** | 2 agent/队 × 3 队 + 裁判 + 汇总 + 对抗者 = 9 | 精简 3 阶段（对齐→撰写→审查）+ 对抗质疑 |
| **方案评审** | 2 agent/队 × 3 队 + 裁判 + 汇总 + 对抗者 = 9 | 3 阶段（数据调研→分析→论证）+ 对抗质疑 |

**方案评审特殊说明**：方案评审的输入源多样（项目代码/文档附件/URL链接/混合），分析论证之前必须先完成数据调研。调研策略见 pipeline.md "方案评审 — 数据调研阶段"。

---

### Phase 1 — 任务理解与拆解

#### Phase 1.1 — 上下文收集

检查是否存在 PRD.md（来自 Pre-Stage）或 Spec 文档，若存在则作为任务理解的输入。

#### Phase 1.2 — 歧义检测与协调者反转门控（Coordinator Inversion Gate）

在输出任务规格前，协调者 MUST 检测任务描述的歧义程度。

**自动判定规则**：

| 输入条件 | 歧义等级 | 动作 |
|---------|---------|------|
| SDD Excel → PRD.md 完整链路 | 低（GREEN） | 跳过反转，直接输出任务规格 |
| Spec 文档已存在 | 低（GREEN） | 跳过反转，直接输出任务规格 |
| 用户口述 ≥3 句，含具体技术栈和范围 | 低（GREEN） | 跳过反转 |
| 用户口述 1-2 句，关键维度缺失 | 中（YELLOW） | 仅对缺失维度做选择题 |
| 一句话需求 / 模糊描述 | 高（RED） | 对 4 个关键维度逐一给选项 |

**GREEN 级也必须输出锁定版任务规格**：
- 即使报告/Spec 已足够详尽，Phase 1.3 的任务规格输出不可跳过
- 原因：任务规格是三队 agent 共享的「假设基线」载体，缺少它则三队方案不可比
- 实践：GREEN 级可简化（直接引用 Spec/报告中的关键约束），但必须显式输出 7 项结构

**YELLOW/RED 级别的反转规则**（遵循 kf-alignment interactive 模式）：

对每个有歧义的维度，给出 2-4 个具体选项，附带后果说明，禁止开放提问：

```
## 任务歧义澄清

以下维度需要你选择确认（选 A/B/C，不开放回答）：

### 1. [维度名，如：目标平台]
A. [方案名] — [一行说明]，后果：[选 A 的后果]
B. [方案名] — [一行说明]，后果：[选 B 的后果]
C. [方案名] — [一行说明]，后果：[选 C 的后果]

### 2. [下一维度]
...

请逐项回复 A/B/C。
```

**关键维度清单**（仅对缺失/模糊的维度提问）：
1. **技术栈**：已明确则跳过，否则给 MVP/标准/现有技术栈三选一
2. **目标平台**：已明确则跳过，否则给 Web/iOS+Android/跨平台三选一
3. **范围边界**：已明确则跳过，否则给 2-3 种范围裁剪方案
4. **性能/安全档位**：已明确则跳过，否则给原型级/生产级/极致优化三选一

**禁止行为**：
- 禁止对已明确的信息重复提问
- 禁止开放问题（如"你觉得哪个更好？"）
- 禁止对同一维度问两次

#### Phase 1.3 — 任务规格输出与锁定

用户确认所有歧义澄清后（或 GREEN 级直接输出），输出锁定版任务规格：

```
1. 任务目标（一句话）
2. 输入来源：[SDD Excel → PRD.md / 用户口述 / Spec 文档 / 其他]
3. 硬约束（不可违反）
4. 软约束（尽量满足）
5. 假设基线（协调者锁定的默认假设 → 注入三队 Stage 0）
6. 评判维度及权重（默认见下方）
7. 任务类型判定：编码开发 / 文档生成 / 方案评审
```

**假设基线机制**：协调者在 Phase 1.3 锁定的假设，在 Phase 2 spawn 三队时，MUST 注入到每个 agent 的 Stage 0 prompt 中。三队 agent 在 recording 模式下基于同一份假设基线工作，确保方案可比。

默认评判维度：

| 维度 | 权重 | 说明 |
|------|------|------|
| 正确性 | 30% | 方案是否解决核心问题 |
| 性能/效率 | 20% | 时间/空间/资源开销 |
| 可维护性 | 20% | 代码清晰度、模块化 |
| 安全性 | 20% | 边界处理、权限控制 |
| 创新性 | 10% | 独到见解或更优思路 |

用户可自定义权重。

### Gate 1 — 任务规格锁定 + 假设基线确认后方可进入 Phase 2。

---

### Phase 2 — Swarm + Pipeline 并发执行

**桥接层**：本 Skill 使用 Claude Code 内置 Agent 工具执行（非 ruflo swarm MCP）。通过 `hammer-bridge.cjs` 追踪 Agent 状态，弥补 ruflo 面板始终显示 0/15 的体验缺口。

**三队流水线并行启动，每个 agent 按需自动分配模型**：

```
0. 若 Pre-Stage 已产出 PRD.md，将 PRD.md 路径注入三队的 Stage 0 prompt 中作为输入
0.5. node .claude/helpers/hammer-bridge.cjs init --task "<任务名>" --total-agents <N>
1. swarm_init → hierarchical-mesh
2. 为每队创建 Pipeline DAG: Stage0→Stage1→Stage2→Stage3→Stage4→Stage5
3. 并行 spawn 三队的 Stage 0 agent（run_in_background: true, model: "sonnet"）
   每个 agent spawn 后 MUST 调用:
     node .claude/helpers/hammer-bridge.cjs agent-spawn --team <红/蓝/绿> --agent <agent名> --task-id <阶段>
   每个 agent 的 prompt 中 MUST 包含：
     - **共享前缀**（MUST 执行 `node .claude/helpers/hooks/hammer-bridge.cjs prefix` 获取，逐字注入 prompt，不修改）→ 确保后续 agent 命中缓存
     - 若 PRD.md 存在：@PRD.md 文件引用
     - 若 Spec 存在：@spec.md 文件引用
     - 任务规格（Phase 1.3 锁定版输出）
     - 协调者假设基线（Phase 1.3 锁定，三队共享）
     - 本团队的角色定位（红/蓝/绿）
     - kf-alignment recording 模式指令（不提问、不阻塞、记录假设）
   ⚠️ 缓存优化：共享前缀必须逐字相同（包括空格和换行）。仅差异化后缀部分（角色+阶段+任务）。
     后续 agent 的共享前缀部分将命中 DeepSeek 服务器端缓存（¥0.025/MTok），
     仅 ~3K token 的角色+任务描述按全价计费。
   模型路由：
     - 全栈开发 agent → model: "sonnet"（flash, 执行层面）
     - 集成测试 agent → model: "sonnet"（flash, 执行层面）
     - 前端设计师 agent → model: "sonnet"（flash, 执行层面）
     - 协调者（本 Skill 自身）→ model: "opus"（pro, 规划+评判层面）
4. Pipeline 自动推进：每阶段完成后自动触发下一阶段
   每阶段完成时调用:
     node .claude/helpers/hammer-bridge.cjs agent-done --team <队名> --agent <agent名> --output <产物文件>
5. 等待三队全部流水线完成
   执行中可随时查看状态:
     node .claude/helpers/hammer-bridge.cjs status
6. 收集各队 Stage 5 最终方案
   生成最终摘要:
     node .claude/helpers/hammer-bridge.cjs summary --task "<任务名>"
```

**每个团队的最终方案必须包含**：
1. 方案概述（200 字内）
2. 核心实现思路
3. 关键代码/架构片段
4. 方案优势（3-5 点）
5. 方案风险（3-5 点）

---

### Phase 3 — 裁判评分

> **角色约束**：裁判是**单一 agent**（不拆分，不 spawn 子 agent），以绝对客观中立视角评分。

裁判以客观中立视角，调用 `kf-alignment` 对齐评分标准后逐一评分：

```
## 裁判评分卡

### {队名}方案
| 维度 | 得分(1-10) | 加权分 | 评语 |
|------|-----------|--------|------|
| 正确性 | x | x*0.3 | ... |
| 性能/效率 | x | x*0.2 | ... |
| 可维护性 | x | x*0.2 | ... |
| 安全性 | x | x*0.2 | ... |
| 创新性 | x | x*0.1 | ... |
| **总分** | | **X.X** | |

### 排名
1. {队名} — X.X 分 — {一词汇总}
2. {队名} — Y.Y 分 — {一词汇总}
3. {队名} — Z.Z 分 — {一词汇总}
```

---

### Phase 4 — 汇总融合（初版）

> **角色约束**：汇总者是**汇总团队负责人**，可按需 spawn 子 agent 来 pipeline 执行（Phase 6）。Phase 4 阶段由汇总者本人完成初版融合。

根据分差选择融合策略：

| 分差 | 策略 | 做法 |
|------|------|------|
| 冠军领先 >15% | **择优采纳** | 直接用第一名，吸收第二名亮点 |
| 冠亚接近 <15% | **博采众长** | 取各方案最强维度杂交融合 |
| 三方都很接近 | **按需融合** | 根据场景偏好选择侧重 |

融合产出初版方案（准备接受对抗者质疑）：

```
## 初版融合方案 — {融合策略}

### 方案来源
- 核心架构：来自{某队}
- 安全加固：来自{某队}
- 性能优化：来自{某队}
- 工程落地：来自{某队}

### 实现步骤
1. ...
2. ...

### 优势汇总
- {各队优势}

### 风险管控
- {各队风险提示 + 缓解措施}

### 待对抗者重点审查的疑点
- {汇总者自审发现的薄弱环节，引导对抗者聚焦}
```

**初版融合要点**：
1. 汇总者 MUST 在方案中标注自己不确定或需要外部挑战的疑点（`待对抗者重点审查的疑点`）
2. 初版方案目标是**博采众长形成基线**，而非追求完美
3. 初版方案产出后，自动进入 Phase 5 对抗质疑，**不直接输出给用户**

---

### Phase 5 — 对抗质疑

> **角色约束**：对抗者是**单一 agent**（不拆分，不 spawn 子 agent），专注从现实、易错角度对初版方案提出质疑。

#### 对抗者角色定位

对抗者 = **魔鬼代言人（Devil's Advocate）**。你的任务不是否定，而是从以下 8 个现实视角挑战初版方案：

| 质疑维度 | 核心问题 | 示例 |
|---------|---------|------|
| **真实部署** | 方案在生产环境能否真正跑起来？ | 依赖冲突、环境差异、配置复杂度 |
| **边界漏洞** | 边界条件、异常路径是否覆盖？ | 空数据、并发写入、网络超时、服务降级 |
| **性能陷阱** | 哪些场景下性能会崩溃？ | N+1 查询、内存泄漏、热点数据、大页面加载 |
| **安全隐患** | 哪些攻击面未闭合？ | 注入、越权、敏感数据泄露、SSRF |
| **可维护性** | 半年后接手的团队能否理解？ | 架构过度设计、缺少监控、耦合过紧 |
| **扩展瓶颈** | 规模扩大后哪里先崩？ | 数据库单点、无缓存策略、单体瓶颈 |
| **成本隐忧** | 隐性成本有哪些？ | 云资源、第三方 API 费用、维护人力 |
| **用户视角** | 真实用户会这样用吗？ | 操作路径过长、学习成本高、无障碍缺失 |

#### 对抗流程

```
1. 读取初版融合方案（Phase 4 产出）
2. 逐维度审查，对每个维度输出：
   - ✅ 认可：无问题，直接通过
   - ⚠️ 关注：有潜在风险，给出具体场景
   - 🔴 质疑：有明确问题，给出反面案例
3. 汇总最关键的 3-5 个必须回应的问题（标记 MUST-FIX）
4. 输出对抗报告
```

#### 对抗报告格式

```
## 对抗者质疑报告

### 总体评估
{一句话结论：方案整体质量评估}

### 逐维度审查

#### 1. 真实部署 — ✅ 认可 / ⚠️ 关注 / 🔴 质疑
{具体分析和案例}

#### 2. 边界漏洞 — ✅ 认可 / ⚠️ 关注 / 🔴 质疑
{具体分析和案例}

#### 3. 性能陷阱 — ✅ 认可 / ⚠️ 关注 / 🔴 质疑
{具体分析和案例}

#### 4. 安全隐患 — ✅ 认可 / ⚠️ 关注 / 🔴 质疑
{具体分析和案例}

#### 5. 可维护性 — ✅ 认可 / ⚠️ 关注 / 🔴 质疑
{具体分析和案例}

#### 6. 扩展瓶颈 — ✅ 认可 / ⚠️ 关注 / 🔴 质疑
{具体分析和案例}

#### 7. 成本隐忧 — ✅ 认可 / ⚠️ 关注 / 🔴 质疑
{具体分析和案例}

#### 8. 用户视角 — ✅ 认可 / ⚠️ 关注 / 🔴 质疑
{具体分析和案例}

### MUST-FIX 清单（汇总者必须回应）
1. **[维度] {问题}** — {为什么这是必须修复的}
2. **[维度] {问题}** — {为什么这是必须修复的}
3. **[维度] {问题}** — {为什么这是必须修复的}
```

**对抗原则**：
1. 质疑必须附**具体场景或反面案例**，禁止空泛怀疑（如可能有性能问题无效）
2. ✅ 认可和 ⚠️ 关注不需要汇总者回应，🔴 质疑和 MUST-FIX 必须逐条回应
3. 对抗者不参与评分，只负责**指出盲区**
4. 对抗者有**一票建议权**（必须被记录和回应），但**无否决权**（最终决定权在汇总者）

---

### Phase 6 — 汇总者回应与最终执行

> **角色约束**：汇总者作为**汇总团队负责人**，需回应对抗者质疑，决策接受/驳回，并根据任务类型决定是否执行。

#### Step 6.1 — 逐条回应

汇总者读取对抗报告，对 MUST-FIX 和 🔴 质疑逐条决策：

| 决策 | 含义 | 做法 |
|------|------|------|
| **采纳** | 对抗者说得对 | 修改方案，明确改动点 |
| **部分采纳** | 有道理但需折中 | 修改方案，说明折中理由 |
| **驳回** | 对抗者的担忧在当下场景不成立 | 给出驳回理由（必须基于任务上下文，不可主观） |

#### Step 6.2 — 产出终版方案

将初版方案更新为终版方案：

```
## 终版方案

### 对抗者质疑处理记录
| MUST-FIX | 决策 | 改动/理由 |
|----------|------|----------|
| 1. {问题} | 采纳/部分采纳/驳回 | {具体改动或驳回理由} |
| 2. {问题} | 采纳/部分采纳/驳回 | {具体改动或驳回理由} |
| 3. {问题} | 采纳/部分采纳/驳回 | {具体改动或驳回理由} |

### 终版方案内容
{更新后的完整方案}

### 碾压指标
| 维度 | 单方案最高分 | 融合方案分 | 对抗后提升 |
|------|------------|-----------|-----------|
| ... | ... | ... | ... |
```

#### Step 6.3 — 执行（仅复杂执行任务）

**判定条件**：如果任务类型为「编码开发」或经协调者判定需实际执行（而非仅调研/分析/计划），则汇总者 MUST 进入执行阶段。

**执行方式**：汇总者作为汇总团队负责人，按以下流程 spawn 子 agent：

```
1. 汇总者将终版方案拆分为可执行的模块/步骤
2. 对每个模块/步骤，按需 spawn 子 agent（Agent tool, run_in_background: true）
   子 agent 类型：
   - 编码 agent：实现具体代码模块
   - 测试 agent：编写并运行测试
   - 文档 agent：更新文档
3. 每个子 agent 仅关注自己的模块，不感知全局（降低 prompt 复杂度）
4. 子 agent 完成后通过回调通知汇总者
5. 汇总者验证各模块集成、运行质量自检
```

**执行质量门控**：
- 每个子 agent 产出 MUST 通过机械化验证（`harness-gate-check.cjs`）
- 所有模块集成后 MUST 整体通过编译/运行
- 汇总者对最终产物负全责

**跳过条件**：任务类型为「方案评审」或「文档生成」时，汇总者仅输出终版方案，不进入执行。

---

## 快速模式（轻量任务）

跳过完整 swarm 和流水线，双视角对比：

```
快速夯 — 双视角对比（顺序模拟）：
  视角A: "最优雅的做法是？"
  视角B: "最快的做法是？"
  → 二选一或融合 → 直接输出最终方案
```

---

## 输出规范

每次执行完成后输出摘要：

```markdown
## 夯 执行摘要

### 任务
{一句话}

### 三团队方案对比
| 团队 | 方案要点 | 评分 | 流水线阶段 |
|------|---------|------|-----------|
| 红队 激进 | {要点} | X.X | 6/6 完成 |
| 蓝队 稳健 | {要点} | X.X | 6/6 完成 |
| 绿队 安全 | {要点} | X.X | 6/6 完成 |

### 代码审查图谱
{集成测试 agent 调用 kf-code-review-graph 生成}

### 对抗者审查
- MUST-FIX 处理：{N} 条采纳，{N} 条驳回
- 对抗后方案提升：{要点}

### 最终决策
- 策略：{择优/博采众长/按需融合}
- 对抗闭环：已通过对抗者质疑
- 方案保存至：`.gspowers/artifacts/hammer-{date}-{topic}.md`

### 碾压指标
- 参与 Agent 数：{N}
- 比单方案提升：{X}%
- 覆盖的风险维度：{列表}
- 对抗者发现的风险：{列表}
```

---

## Gotchas

- 输入为 SDD Excel（`.xlsx`）时，**必须先执行 Pre-Stage** 调用 `kf-prd-generator` 生成 PRD.md，链路：`SDD Excel → PRD.md → kf-spec → Spec → 夯并发`
- **GREEN 级别也不能跳过 Phase 1.3 任务规格输出**——即使报告/Spec 已详尽，锁定版规格（任务目标、约束、假设基线、评判维度）是三队可比的前提，缺失则三队方案不可比
- ruflo swarm 面板始终显示 0/15 是正常的——本 Skill 使用 Claude Code 内置 Agent 工具执行，通过 `hammer-bridge.cjs` 追踪状态。运行 `node .claude/helpers/hammer-bridge.cjs status` 查看实际进度
- 流水线阶段失败只阻塞该团队，不影响其他团队并行推进
- Stage 2 编码阶段前端设计师可与全栈开发并行（UI 实现 + 后端实现独立）
- 裁判评分前必须调用 `kf-alignment` 统一评分尺度，避免三队方案评分标准不一致
- 回退模式（无 MCP）下流水线改为单会话顺序模拟，每阶段输出后等待确认
- 快速模式跳过流水线和 swarm，仅做双视角文本对比，不生成中间产物
- **对抗者只负责质疑，不参与评分和决策**。评分是裁判的职责，决策是汇总者的职责。
- **对抗者的 MUST-FIX 必须逐条回应**，但汇总者有最终决定权（采纳/驳回）。
- **汇总者可按需 spawn 子 agent 执行**，但对抗者始终是单一 agent，不拆分。
- **Phase 5 对抗质疑的输出是文本报告，不包含代码修改**——代码修改由 Phase 6 汇总者执行。
- **对抗者质疑维度固定为 8 个**（部署/边界/性能/安全/维护/扩展/成本/用户），不宜增删。

## Harness 反馈闭环（铁律 3）

每个 Phase 完成后 MUST 执行机械化验证：

| Phase | 验证动作 | 失败处理 |
|-------|---------|---------|
| Pre-Stage（条件触发） | `node .claude/helpers/harness-gate-check.cjs --skill kf-multi-team-compete --stage prestage --required-files "PRD.md" --forbidden-patterns TODO 待定` | PRD.md 缺失则阻断进入 Phase 1 |
| Phase 1 | `node .claude/helpers/harness-gate-check.cjs --skill kf-multi-team-compete --stage phase1 --required-sections "## 任务目标" "## 评判维度及权重" --forbidden-patterns TODO 待定` | 任务规格不完整则回退 |
| Phase 2（每队） | `node .claude/helpers/harness-gate-check.cjs --skill kf-multi-team-compete --stage <N> --team <红/蓝/绿> --required-files "{team}-0<N>-*.md" --forbidden-patterns TODO 待定` | 阶段产物缺失则阻断该团队流水线 |
| Phase 3 | `node .claude/helpers/harness-gate-check.cjs --skill kf-multi-team-compete --stage phase3 --required-sections "## 裁判评分卡" "## 排名" --forbidden-patterns TODO 待定` | 评分卡不完整则回退 |
| Phase 4 | `node .claude/helpers/harness-gate-check.cjs --skill kf-multi-team-compete --stage phase4 --required-sections "## 初版融合方案" "## 待对抗者重点审查的疑点" --forbidden-patterns TODO 待定` | 初版方案不完整则回退 |
| Phase 5 | `node .claude/helpers/harness-gate-check.cjs --skill kf-multi-team-compete --stage phase5 --required-sections "## 对抗者质疑报告" "## MUST-FIX 清单" --forbidden-patterns TODO 待定` | 对抗报告不完整则回退对抗 |
| Phase 6 | `node .claude/helpers/harness-gate-check.cjs --skill kf-multi-team-compete --stage phase6 --required-sections "## 终版方案" "## 对抗者质疑处理记录" --forbidden-patterns TODO 待定` | 终版方案不完整则回退汇总 |

验证原则：**Plan → Build → Verify → Fix** 强制循环，不接受主观"我觉得好了"。

## Harness 记忆持久化（铁律 4）

Phase 6 汇总者回应与执行完成后 MUST 将最终评分卡、对抗报告摘要和终版方案写入 `memory/hammer-results.md`，包含对抗者质疑记录和汇总者回应决策。下次 `/夯` 启动时自动加载历史结果和对抗记录作为参考基线。

---

## 联动关系

| 技能 | 调用时机 | 用途 |
|------|---------|------|
| `kf-model-router` | 启动时 | 自动切换模型：裁判/汇总用 pro，各队 agent 用 flash |
| `kf-prd-generator` | Pre-Stage（条件触发） | 输入为 SDD Excel 时自动调用，生成 PRD.md 作为需求基线 |
| `kf-alignment` | Stage 0 + Phase 3 | 动前对齐 + 裁判评分标准对齐 |
| `kf-spec` | Stage 0 | 读取 Spec/PRD 作为需求基线 |
| `kf-web-search` | Stage 1/2/3（按需） | agent 搜索技术方案、最佳实践、测试方案、UI 参考 |
| `kf-scrapling` | Stage 1/2/3（按需） | agent 深度网页抓取（反反爬），补充 web-search 无法访问的站点 |
| `kf-opencli` | Stage 1/2/3（按需） | agent 平台数据 CLI 直取（100+ 平台：知乎/B站/GitHub/Reddit/HN/arXiv 等），补充 web-search 和 scrapling 的中间地带 |
| `kf-ui-prototype-generator` | Stage 2 + Stage 5 | 前端设计师 UI 原型生成 |
| `kf-browser-ops` | Stage 3 | 集成测试 agent 自动化测试 |
| `kf-code-review-graph` | Stage 4 | 代码审查依赖图谱 |
| `kf-image-editor` | Stage 2 + Stage 5（按需） | 前端设计师 AI 自然语言 P 图、方案配图、截图优化 |
| `skill-creator` | Stage 1 + Stage 2（按需） | agent 按需创建新 Skill 封装重复模式 |
| `gspowers` Pipeline 引擎 | Step 0 + Phase 2 | 团队内部流水线阶段编排 + 产物交接（融入夯） |
| `claude-flow` (swarm_init, agent_spawn, task_orchestrate) | Step 0 + Phase 2 | 多 Agent 并发 + Pipeline DAG 编排 |
