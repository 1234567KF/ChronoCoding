# kf- 质量协调层 — Plan

> Spec: docs/optimization-spec.md | Roadmap: docs/optimization-roadmap-final.md
> 执行范围: Phase 0 (基建) + Phase 1 (质量闭环)
> 人员: 1 人 + AI Agent | 总工期: ~11 天

---

## 执行策略

| 原则 | 落地方式 |
|------|---------|
| 技能无关 | 不改造每个技能，通过统一的 `quality_signals` 注入层和 `/夯` prompt 组装层实现 |
| 消费端拉动 | 每个改动先定义"谁读这个数据"，再实现数据生产 |
| 实验先行 | AC 字段和单元测试伴随使用 feature flag，默认关闭 |
| 缓存优先 | 每个改动后跑 cache-audit，失败则阻塞 merge |

---

## 任务分解

### Phase 0 — 基础设施（6 天）

| ID | 任务 | 依赖 | 产出 | 验证方法 | 工期 |
|----|------|------|------|---------|------|
| **P0.1** | 建立 quality_signals 注入层 | 无 | `helpers/quality-signals.cjs` — 标准化信号生成函数，各技能在 artifact 输出前调用 | `node .claude/helpers/schema-check.cjs` 校验 | 1.5 天 |
| **P0.2** | Review severity 标准化 | P0.1 | 修改 `kf-code-review-graph/SKILL.md`：问题列表增加枚举 severity 字段 + 同步输出 JSON 到 `.claude/logs/review-*.json` | JSON Schema 校验 | 1 天 |
| **P0.3** | 浅层 Plan 注入 (/夯) | P0.1 | 修改 `kf-multi-team-compete/SKILL.md` Phase 2 spawn 逻辑：在 agent prompt 共享前缀后插入 10-15 行任务拆解预览 | 检查 spawn prompt 文本 | 1 天 |
| **P0.4** | 缓存前缀审计脚本 | 无 | 新建 `helpers/cache-audit.cjs`：提取所有技能 agent prompt 前 300 token，逐字对比 | `node .claude/helpers/cache-audit.cjs` 输出 ALL_PASS | 0.5 天 |
| **P0.5** | 反转门控硬 Gate | P0.1 | 将夯的 Phase 2.0 从 Team Lead 手动触发改为 Pipeline DAG 硬 Gate：Stage 0 完成后自动扫描 CRITICAL、去重合并、阻断等待或零延迟通过 | 见下方 AC0.5 验证逻辑 | 1 天 |
| **P0.6** | 夯入口深度选择 | 无 | 修改夯 Phase 1 Team Lead 流程：展示三档深度选择（A 需求方案/B 设计/C 全流程编码），状态持久化到 `.claude-flow/hang-state.json`，后续自动恢复 | 手动测试三档选择 + 状态恢复 | 1 天 |
| **P0.7** | gspowers 式进展看板 | P0.6 | 修改夯 Team Lead 交互流程：每次交互前基于 hang-state.json 输出可视化看板（阶段状态、各队进度、产物路径） | 检查看板输出完整性 | 1 天 |

### Phase 1 — 质量闭环（5 天）

| ID | 任务 | 依赖 | 产出 | 验证方法 | 工期 |
|----|------|------|------|---------|------|
| **P1.1** | kf-spec AC 字段实验 | P0.1 | 修改 `kf-spec/SKILL.md`：增加 `--ac` flag 触发 AC 章节生成（Given-When-Then 格式），默认不生成 | `/spec --ac 测试功能` 产出含 AC | 1 天 |
| **P1.2** | 条件 review 重审 | P0.2 | 修改 `kf-code-review-graph/SKILL.md`：解析自身 JSON 输出 → 判断 P0 > 0 或 P1 密度 > 3/KLOC → 条件触发重审，上限 3 轮 | 构造 review 数据验证触发逻辑 | 1.5 天 |
| **P1.3** | /夯 完成聚合 Plan | P0.3 | 修改 `kf-multi-team-compete/SKILL.md` Phase 2 入口：抽象出 `plan_preview` 函数，读 quality_signals 聚合三队 Plan 预览。人类可 30s 内打断 | 手动测试 + 打断测试 | 0.5 天 |
| **P1.4** | 单元测试伴随（feature flag） | P0.1 | 修改编码 agent prompt：收到 `--with-tests` flag 时，每函数/组件同步生成 `.test.*` 骨架，执行后提交 | `/夯 --with-tests` 验证 | 1 天 |
| **P1.5** | 测试专家循环 | P0.1 + P0.6 | 改造夯 Stage 3：从一次性集成测试改为多轮测试闭环。测试专家准备多角色/多权限/多数据状态场景，执行测试 → issue_list → fix → 回归（上限 3 轮），含 UI 视觉检查 | 构造含缺陷代码验证循环触发 | 2 天 |

---

## 关键依赖链

```
P0.1 quality_signals ──→ P0.2 severity 标准 ──→ P1.2 条件 review
    │
    ├──→ P0.3 浅层 Plan ──→ P1.3 /夯 聚合 Plan
    │
    ├──→ P0.5 反转门控硬 Gate（Stage 0→Stage 1 阻断）
    │
    ├──→ P1.1 AC 字段实验
    │    P1.4 单元测试伴随
    │    P1.5 测试专家循环（依赖 P0.6 深度选择）
    │
    └──→ P0.6 深度选择 ──→ P0.7 进展看板

P0.4 缓存审计（独立，与其他并行）

Pipeline 阶段依赖（反转门控位置）:
  Stage 0(三队并行) → [Gate 2.0: P0.5 反转门控] → Stage 1(三队并行)

恢复路径:
  hang-state.json ──→ [A 继续对话 | B gspowers 引导 | C 夯编码 Pipeline]
```

---

## 详细实现步骤

### P0.1: quality_signals 注入层

**文件**: 新建 `.claude/helpers/quality-signals.cjs`

```javascript
// 核心职责：生成标准化质量信号块，供各技能在 artifact 输出末尾调用
// 输入: { skillName, artifactType, changedFiles, issuesBySeverity, testStatus }
// 输出: quality_signals JSON 块
//
// 消费端：
//   - P0.3 浅层 Plan 注入（读 changedFiles 预估影响范围）
//   - P1.2 条件 review 触发（读 severity.P0/P1）
//   - Phase 2 质量信号聚合（追加到 quality-signals.jsonl）

function emit(signals) {
  // 1. 校验必填字段
  // 2. 生成标准化块
  // 3. 追加到 artifact 末尾
  // 4. 写入 .claude-flow/quality-signals/{execution_id}.json
}
```

**技能集成点**（不改造技能内部逻辑，只在产出处追加一行）：

| 技能 | 调用位置 | artifact_type |
|------|---------|---------------|
| kf-code-review-graph | Stage 4 输出报告后 | `review_report` |
| kf-spec | Step 6 Spec 输出后 | `spec_doc` |
| kf-alignment | Stage 0 对齐记录输出后 | `alignment_record` |
| kf-browser-ops | Stage 3 测试报告后 | `test_report` |
| kf-langextract | 提取报告输出后 | `extraction_report` |
| /夯 各队 agent | 每阶段产物输出后 | `{stage}_artifact` |

### P0.2: Review severity 标准化

**文件**: 修改 `.claude/skills/kf-code-review-graph/SKILL.md`

改动点：
1. 输出格式章节：增加 JSON 输出要求
2. 每个 issue 增加 severity 字段（enum: P0/P1/P2/P3）
3. 报告末尾输出 `quality_signals` 块（调用 P0.1 的 emit）

**严重性判定规则**（写死在 SKILL.md 中）：

| 判定条件 | Severity |
|----------|----------|
| 安全漏洞、数据损坏、逻辑错误、崩溃 | P0 |
| 功能偏离、性能降级、边界缺失 | P1 |
| 风格问题、命名、未使用 import | P2 |
| 优化建议、备选方案 | P3 |

### P0.3: 浅层 Plan 注入

**文件**: 修改 `.claude/skills/kf-multi-team-compete/SKILL.md`

改动点：
1. Phase 2 spawn agent 前，新增 `plan_preview()` 调用
2. `plan_preview` 逻辑：
   - 从 kf-spec / alignment 的 quality_signals 读 changed_files
   - 生成 10-15 行结构化任务拆解预览
   - 注入到 agent prompt 的共享前缀之后、角色定义之前
3. 人类打断窗口：30s 内回复"改" → 等待修订 → 更新预览 → resume

**浅层 Plan 格式**:

```markdown
## 任务拆解预览

| # | 模块 | 动作 | 预估文件 | 风险 |
|---|------|------|---------|------|
| 1 | auth | 新增 JWT 验证 | +3 | 低 |
| 2 | api | 新增接口 /user/login | +1 | 低 |
| 3 | db | 修改 User 表 | ~1 | 中(P0: auth) |

**预估总影响**: 8 文件，~200 行代码
**预估执行时间**: ~3 分钟
**质量模式**: balanced（仅 P0 review 闭环）

如有修改意见请回复，30s 后自动继续执行...
```

### P0.5: 反转门控硬 Gate

**文件**: 修改 `.claude/skills/kf-multi-team-compete/SKILL.md` Pipeline 编排部分

**核心改动**：把 Phase 2.0 从"Team Lead 记得就做"变成 Pipeline DAG 中的硬性阻断节点。

#### 改动点

1. **Pipeline DAG 改造**：
   ```
   当前: Stage 0 → (Team Lead 手动决定是否执行反转门控) → Stage 1
   改造后: Stage 0 → [Gate 2.0: 反转门控] → Stage 1
   ```
   - Gate 2.0 是 Pipeline DAG 的正式节点，不是选项
   - spawn Stage 1 的入口函数 MUST 检查 Gate 2.0 状态，Gate 未通过 → 拒绝 spawn

2. **Gate 状态机**：

   ```
   IDLE → SCANNING → [有 CRITICAL? → WAITING_ANSWER → BROADCAST → PASSED]
                     [无 CRITICAL? → PASSED (零延迟)]
   ```

   - **IDLE**: 初始状态，等待 Stage 0 完成
   - **SCANNING**: 读取三队 alignment.md，提取 CRITICAL，去重合并
   - **WAITING_ANSWER**（可选）: 展示问卷，等待用户回答（5 分钟超时 → 用默认选择）
   - **BROADCAST**: 写入 `.claude-flow/gate-broadcast/` + 注入下一批 agent prompt
   - **PASSED**: Gate 放行，允许 spawn Stage 1

3. **阻断机制**（硬 Gate 的关键）：

   ```javascript
   function spawnStage1() {
     const gateStatus = readGateStatus();
     if (gateStatus !== 'PASSED') {
       throw new Error(`Gate 2.0 not passed. Current status: ${gateStatus}`);
       // 不允许 spawn Stage 1 agent
     }
     // 正常 spawn
   }
   ```

4. **问卷展示与答案回传**：
   - 合并后问卷 → `AskUserQuestion` 工具（选择题模式）
   - 用户回答 → 写 `.claude-flow/gate-broadcast/{exec_id}.json`
   - 5 分钟超时 → 自动采用默认选择 → 写日志
   - 答案注入 → spawn Stage 1 agent 时，在 prompt 的约束段追加

5. **零问题情况**：
   - 扫描结果为空 → Gate 状态直接从 SCANNING → PASSED
   - 不写问卷文件，不产生 token 开销，零延迟

6. **失活保护**：
   - Gate 状态持久化到 `.claude-flow/gate-state/latest.json`
   - 即使 Team Lead 的会话重置，Gate 状态不丢失
   - 新 spawn 的 agent 从 `.claude-flow/gate-broadcast/` 读取广播答案

#### 门控规则

| 规则 | 说明 |
|------|------|
| spawnStage1() 前置检查 | MUST 检查 Gate 2.0 状态 === 'PASSED'，否则 throw |
| 扫描超时 | 三队全部完成后 10s 内 MUST 完成扫描+合并（纯文本操作） |
| 用户超时 | 5 分钟用户无响应 → 自动用默认选择继续 |
| 零问题通过 | 零延迟，不产生任何 I/O 开销 |
| 日志强制 | 每次 Gate 执行 MUST 写入 `.claude/logs/inversion-gate.jsonl` |

### P0.4: 缓存前缀审计

**文件**: 新建 `.claude/helpers/cache-audit.cjs`

核心逻辑：
1. 扫描 `.claude/skills/kf-*/SKILL.md` 中所有 agent prompt 模板
2. 提取每个 prompt 前 300 token
3. 逐 token 对比，输出差异位置和内容
4. 兼容 CRLF/LF 差异（内部 normalize）

```bash
# 用法
node .claude/helpers/cache-audit.cjs            # 审计全部技能
node .claude/helpers/cache-audit.cjs --skill kf-spec  # 单技能审计
```

**门控规则**：
- ALL MATCH → 通过，输出 `ALL_PASS`
- 差异仅在于 CRLF/LF → 通过，输出 `PASS_WITH_LINE_ENDING_DIFF`
- 差异在 token 内容 → **阻断**，输出具体差异，要求修复

### P1.1: kf-spec AC 字段实验

**文件**: 修改 `.claude/skills/kf-spec/SKILL.md`

改动点：
1. 新增 `--ac` flag 检测
2. 当 flag 存在时，Spec Step 2 增加 `## 验收条件` 章节生成
3. AC 格式：Given-When-Then
4. 在 Spec 品控 Gate 中增加 AC 完整性检查（仅 `--ac` 模式）

**Feature flag 生命周期**：
```
Week 1: 上线，默认关闭
Week 2: 统计采用率（从 quality_signals 读 artifact_type=spec_doc 的 AC 存在率）
Week 3: 采用率 > 30% → 会议讨论是否默认开启
        采用率 < 30% → 维持 feature flag，调查原因
```

### P1.2: 条件 review 重审

**文件**: 修改 `.claude/skills/kf-code-review-graph/SKILL.md`

改动点：
1. 解析 review JSON 输出中的 severity 分布
2. 计算 P1 密度 = P1_count / total_lines_in_changed_files
3. 触发判断：

```
if P0_count > 0:
    trigger_rerun("P0 缺陷存在，必须重审")
elif P1_density > 3:  # 每 KLOC 超过 3 个 P1
    trigger_rerun("P1 密度过高，建议重审")
else:
    done("质量达标，一次通过")
```

4. 重审流程（复用现有 agent session，不额外 spawn）：
   - 上一轮 issue_list.md → Agent 修复 → 本轮的 changed_files 只含修复文件
   - 增量 review（只审修复部分 + 回归检查已通过部分）
   - 上限 3 轮，第 3 轮仍不通过 → 标记 UNRESOLVED + 写 escalation 日志

### P1.3: /夯 完成聚合 Plan

**文件**: 修改 `.claude/skills/kf-multi-team-compete/SKILL.md`

改动点（在 P0.3 之上增量）：
1. 从 P0.3 的任务拆解预览中，聚合三队 stage 产物的 quality_signals
2. 插入等待窗口（30s 人类打断）
3. 人类修订后 → 更新 agent prompt → 三队 resume

### P1.4: 单元测试伴随

**文件**: 修改 `.claude/skills/kf-multi-team-compete/SKILL.md` 编码阶段 prompt

改动点：
1. 检测 `--with-tests` flag
2. 编码 agent prompt 中追加指令：
   ```
   每完成一个函数/组件，同步生成对应的测试骨架文件（.test.ts/.test.jsx）
   测试 MUST:
   - 覆盖 happy path + null/undefined 边界 + 异常输入
   - 命名格式: {函数名}_should_{行为}
   - 执行 `npm test -- --related` 通过后才提交该函数
   ```
3. 不覆盖纯配置文件/类型定义/样式文件（白名单：`.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.go`）

### P0.6: 夯入口深度选择

**文件**: 修改 `.claude/skills/kf-multi-team-compete/SKILL.md` Phase 1 Team Lead 流程

改动点：
1. Team Lead 完成需求理解后，在执行计划之前插入深度选择：

   ```
   ┌─ 夯 执行深度选择 ──────────────────────────┐
   │                                              │
   │  你想做到哪一步？                             │
   │                                              │
   │    A. 需求分析 + 方案评审                     │
   │       产出: PRD + 方案对比报告                │
   │       后续: 可随时恢复继续                    │
   │                                              │
   │    B. 需求 + 设计                             │
   │       产出: PRD + 架构方案 + 数据模型         │
   │       后续: 可随时恢复继续                    │
   │                                              │
   │    C. 全流程编码交付（默认）                   │
   │       产出: 代码 + 测试报告 + 审查报告        │
   │                                              │
   │  请回复 A/B/C（默认 C）                      │
   └──────────────────────────────────────────────┘
   ```

2. 状态持久化到 `.claude-flow/hang-state.json`：

   ```json
   {
     "depth": "A|B|C",
     "task_name": "任务名",
     "current_phase": "plan|design|coding|testing|review|done",
     "current_stage": "stage_0|stage_1|...",
     "completed_phases": ["alignment", "architecture"],
     "team_progress": {
       "red": { "stage": "stage_2", "percent": 70 },
       "blue": { "stage": "stage_2", "percent": 45 },
       "green": { "stage": "stage_2", "percent": 60 }
     },
     "artifacts": {
       "alignment": "docs/红队-00-alignment.md",
       "architecture": "docs/红队-01-architecture.md"
     },
     "last_updated": "ISO8601"
   }
   ```

3. 恢复检测：Team Lead 启动时检测 `.claude-flow/hang-state.json`，若存在则展示恢复选项：

   ```
   检测到上次任务「xxx」停在「需求分析」阶段，你想：
     A. 继续对话（不调用技能）
     B. 用 gspowers 引导我继续
     C. 用夯编码 Pipeline 继续
   ```

   - 选 B → 生成 `.claude-flow/hang-handoff.md`（任务规格+已完成阶段+产物清单），提示用户执行 `/gspowers`
   - 选 C → 从当前阶段恢复 Pipeline

### P0.7: gspowers 式进展看板

**文件**: 修改 `.claude/skills/kf-multi-team-compete/SKILL.md` Team Lead 交互格式

改动点：
1. Team Lead 每次交互前读取 hang-state.json，输出可视化看板：

   ```
   ┌─ 夯 执行看板 ────────────────────────────────────────────┐
   │                                                           │
   │  任务: 登录模块                                          │
   │  深度: C (全流程编码)    状态: 执行中                     │
   │                                                           │
   │  [需求 ✅] → [设计 ✅] → [编码 🔄] → [测试 ⏳] → [审查 ⏳]  │
   │                                                           │
   │  各队进度:                                                │
   │    红队 ████████████░░░ Stage 2 编码 70%              │
   │    蓝队 █████████░░░░░░ Stage 2 编码 45%              │
   │    绿队 ████████████░░░ Stage 2 编码 60%              │
   │                                                           │
   │  阶段产物:                                                │
   │    • docs/红队-00-alignment.md (通过)                     │
   │    • docs/蓝队-01-architecture.md (审查中)                │
   │                                                           │
   │  输入 fast 跳过看板 │ status 刷新 │ stop 暂停           │
   └───────────────────────────────────────────────────────────┘
   ```

2. 看板只在终端宽度 > 60 字符时显示，窄终端降级为单行文本
3. 用户可输入 `fast` 在当前会话中隐藏看板

### P1.5: 测试专家循环

**文件**: 修改 `.claude/skills/kf-multi-team-compete/SKILL.md` Stage 3 定义 + 测试专家 prompt

改动点：
1. Stage 3 从一次性集成测试改为多轮测试闭环流程：

   ```
   Stage 3 入口
     │
     ├─ 3.1 测试数据准备
     │   ├─ 角色数据: 管理员、普通用户、游客（至少 3 类）
     │   ├─ 权限场景: 有权限/无权限/边界权限
     │   ├─ 数据状态: 空数据、临界值、异常数据、大数据量
     │   └─ 测试账号: 实际构造或 mock（标注构造方式）
     │
     ├─ 3.2 测试执行与 UI 视觉检查
     │   ├─ 功能测试: Happy Path + 边界 + 异常
     │   ├─ 权限测试: 每类角色执行关键操作
     │   ├─ UI 检查: 截屏 + 布局断言（宽屏/窄屏）
     │   └─ 输出: {team}-03-issues.md
     │
     └─ 3.3 循环门控
          ├─ issue_count == 0 → 通过，进入 Stage 4
          ├─ round < 3 → 开发 fix → 回归测试（仅测 issue 涉及模块）
          ├─ round >= 3 且递减 → 通过，附加 known_issues.md
          └─ round >= 3 且持平/上升 → UNRESOLVED + escalation 日志
   ```

2. 测试专家 prompt 追加（保持共享前缀不变，追加在 `### SHARED PREFIX END` 之后）：

   ```
   ## 测试专家职责
   - 你 MUST 准备至少 3 种不同角色/权限/数据状态的测试场景
   - UI 检查包括: 元素布局、间距、字体、颜色、响应式（截图对比）
   - 每轮测试 MUST 输出 {team}-03-issues.md（含缺陷等级 P0/P1/P2）
   - 回归测试: 只测上一轮 issue 涉及的模块 + 回归检查已通过路径
   - 上限 3 轮，第 3 轮仍有 P0 → 标记 UNRESOLVED
   ```

3. 测试数据工厂（可选辅助脚本，非必须）：

   ```
   .claude/helpers/test-data-factory.cjs  # 生成多角色 mock 数据
   ```

---

## 里程碑

| 里程碑 | 日期 | 条件 |
|--------|------|------|
| **M0: 基建完成** | Day 6 | P0.1-P0.7 全部完成，cache-audit ALL_PASS，深度选择+看板就绪 |
| **M1: 闭环上线** | Day 11 | P1.1-P1.5 完成，条件 review 触发逻辑 + 测试专家循环通过验证 |
| **M2: AC 评估** | Day 24 | P1.1 运行 2 周，统计采用率 |
| **M3: Phase 2 决策** | Day 25 | 基于 M2 数据决定 AC 字段全量/维持/移除，并决定 Phase 2 启动时机 |

---

## 风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| quality_signals 在 20+ 技能中集成遗漏 | 中 | P1 条件 review 数据不准 | P0.1 完成后逐技能 checklist 验证 |
| cache-audit 发现前缀不一致，需要大量修正 | 中 | 延迟 P1 启动 | 独立 audit 脚本先跑一遍，在 P0 就修复 |
| 浅层 Plan 的 30s 打断窗口在某些模式下不生效 | 低 | 用户无法打断 | 在 P0.3 中增加 fallback：`/夯 --pause` flag 手动暂停 |
| AC 字段实验采用率过低 | 中 | Phase 1 的价值被质疑 | 调查原因：是 format 太重还是需求不匹配？如果是前者，简化为 checklist 格式 |
| 条件 review 的 P1 密度阈值（3/KLOC）不合理 | 中 | 误触发或漏触发 | Phase 1.2 上线后观察 2 周，用实际数据校准 |
| 修改 20+ 技能引入 side effect | 低 | 某技能产出格式变更导致下游解析错误 | 所有改动只追加不修改现有格式，兼容旧消费者 |

---

## 不做什么

| 排除项 | 理由 |
|--------|------|
| 不建评分模型 | Phase 2 的事，数据不够时不建模 |
| 不建质量仪表盘 | Phase 3 的事 |
| 不改造上游 66 技能 | 不可控，只做兼容 |
| 不改 CLI 对话模式 | 范围外，保持最小侵入 |
| 不生成独立 Plan 文件 | 对抗者已指出：无消费端 |
| 不改 agent prompt 共享前缀 | 缓存经济性底线 |
| 不建通用测试框架 | 测试专家循环只改造夯 Stage 3，不建独立测试技能 |
| 不做全自动 UI 截图对比 | 视觉检查只在有浏览器环境时执行，无 headless 则跳过 |

---

## 执行命令速查

```bash
# 开发中随时检查缓存一致性
node .claude/helpers/cache-audit.cjs

# 检查某技能的 quality_signals 是否正常
node .claude/helpers/schema-check.cjs --skill kf-code-review-graph

# 查看所有条件 review 触发记录
cat .claude/logs/review-triggers.jsonl

# 查看 AC 字段实验采用率（2 周后）
node .claude/helpers/ac-adoption.cjs --since "14 days ago"

# 查看质量信号聚合
cat .claude/logs/quality-signals.jsonl | wc -l
```
