# kf- 质量协调层 — Spec

> 来源: docs/optimization-roadmap-final.md | 范围: Phase 0 + Phase 1
> 核心原则: 技能无关、有消费端才生产、不破坏缓存、用户无感

## 1. 概述

在 kf- 技能体系（20+ 自建技能）之间建立一个**轻量质量协调层**，实现从"需求输入"到"代码交付"的全链路 visibility + 反馈 + 兜底。不改造每个技能，而是追加统一的元数据标准和条件触发机制。

## 2. 功能列表

### F0.1: 统一技能产出 Schema — Priority: P0
- **描述**: 所有 kf- 自建技能的输出 artifact 追加标准化元数据块 `quality_signals`
- **预估改动量**: 2-3个核心文件 + 各技能 SKILL.md 集成点

### F0.2: Review severity 标准化 — Priority: P0
- **描述**: kf-code-review-graph 的问题输出改为机器可读的枚举格式（P0/P1/P2/P3），同时输出 Markdown 表格和 JSON
- **预估改动量**: 1个技能文件

### F0.3: 浅层 Plan 注入 — Priority: P0
- **描述**: /夯 spawn agent 时，在 agent prompt 前 10-15 行注入结构化任务拆解预览（不作为独立文件存储）
- **预估改动量**: 1个技能文件 + 1个辅助脚本

### F0.4: 缓存前缀审计 — Priority: P0
- **描述**: 新建 `cache-audit.cjs`，检查所有 agent prompt 的前 300 token 一致性，确保改动不破坏 DeepSeek KV Cache
- **预估改动量**: 1个新 Helper 脚本

### F0.5: 反转门控硬 Gate — Priority: P0
- **描述**: 将夯 Pipeline 中 Stage 0 → Stage 1 之间的反转门控从"Team Lead 手动触发"改为 Pipeline DAG 中的硬性阻断 Gate。三队 Stage 0 完成后自动检查 CRITICAL 歧义，有问题则生成合并问卷阻断等待用户回答，零问题自动跳过
- **预估改动量**: 1个技能文件（夯 SKILL.md Pipeline 编排部分）

### F0.6: 夯入口深度选择 — Priority: P0
- **描述**: Team Lead 收到 `/夯` 后先展示三档深度选择（A 需求方案/B 设计/C 全流程编码），用户选择后锁定执行范围。状态持久化到 `.claude-flow/hang-state.json`，后续 `/夯` 自动检测状态并展示恢复选项（继续对话/gspowers 引导/夯编码 Pipeline）
- **预估改动量**: 1个技能文件（夯 SKILL.md Phase 1 Team Lead 流程）

### F0.7: 进展看板 — Priority: P0
- **描述**: Team Lead 每次交互前输出可视化进展看板，显示 Pipeline 阶段状态、各队进度百分比、当前阶段产物路径。基于 hang-state.json 状态文件驱动，类似 gspowers 的 state-based navigation 模式
- **预估改动量**: 1个技能文件（夯 SKILL.md Team Lead 输出格式）+ 1个状态文件规范

### F1.1: kf-spec AC 字段实验 — Priority: P0
- **描述**: kf-spec 以 feature flag (`--ac`) 方式增加验收条件字段，默认关闭
- **预估改动量**: 1个技能文件

### F1.2: 条件 review 重审 — Priority: P0
- **描述**: 基于标准化 severity，review 中 P0 > 0 触发 1 轮重审；P1 密度 > 3/KLOC 触发重审；上限 3 轮
- **预估改动量**: 1个技能文件 + 1个辅助脚本

### F1.3: /夯 浅层 Plan — Priority: P0
- **描述**: /夯 启动时自动生成任务拆解预览注入 agent prompt，人类可打断修改
- **预估改动量**: 1个技能文件

### F1.4: 单元测试伴随 — Priority: P1

### F1.5: 测试专家循环 — Priority: P0
- **描述**: Stage 3 从一次性集成测试改为多轮测试闭环。测试专家准备多角色（管理员/普通用户/游客）、多权限、多数据状态（空数据/临界值/异常数据）的测试场景，执行测试 → 出 issue_list → 开发 fix → 回归测试，上限 3 轮。包含 UI 视觉截图对比检查
- **预估改动量**: 1个技能文件（夯 SKILL.md Stage 3 定义 + 测试专家角色 prompt）
- **描述**: 编码 agent 在 `--with-tests` flag 时，同步生成单元测试骨架
- **预估改动量**: 1-2个技能文件

## 3. 验收条件

### AC0.1: 技能产出 Schema 生效
- **Given** 任意 kf- 自建技能完成一次执行
- **When** 技能产出 artifact（报告/代码/文档）
- **Then** artifact 末尾 MUST 包含标准化的 `quality_signals` 块
- **Pass**: `quality_signals` 块存在且包含必填字段 `{artifact_type, timestamp, changed_files[], severity}`
- **Fail**: quality_signals 块缺失或必填字段为空
- **验证方式**: 自动化校验脚本（`node .claude/helpers/schema-check.cjs`）

### AC0.2: Review severity 机器可读
- **Given** kf-code-review-graph 完成一次 review
- **When** 输出问题列表
- **Then** 每个问题 MUST 包含枚举值 `severity: P0|P1|P2|P3`，且以 JSON 格式输出到 `.claude/logs/review-{timestamp}.json`
- **Pass**: JSON 输出存在，severity 字段符合枚举值
- **Fail**: JSON 不存在或 severity 值为非标准字符串
- **验证方式**: JSON Schema 校验

### AC0.3: 浅层 Plan 注入 agent prompt
- **Given** 用户触发 `/夯 任务描述`
- **When** Team Lead spawn 三队 agent
- **Then** 每个 agent 的 prompt 前 10-15 行包含结构化的任务拆解预览（任务列表 + 预估 + 风险标注）
- **Pass**: agent prompt 中任务拆解预览在共享前缀之后、角色定义之前出现
- **Fail**: agent prompt 中无任务拆解预览
- **验证方式**: 检查 spawn 函数输出的 prompt 文本

### AC0.4: 缓存前缀一致性
- **Given** Phase 0 所有改动完成
- **When** 执行 `node .claude/helpers/cache-audit.cjs`
- **Then** 所有 agent prompt 的前 300 token 必须逐字相同（空格、换行、全角/半角）
- **Pass**: 审计脚本输出 `ALL_PASS`，0 个差异提示
- **Fail**: 审计脚本输出 `DIFF_FOUND`，有 token 级别差异
- **验证方式**: 自动化脚本

### AC0.5: 反转门控硬 Gate 生效
- **Given** 三队各有一条完整的 `{team}-00-alignment.md`（含可能的 `[ASSUMPTION:CRITICAL]` 标记）
- **When** Pipeline 到达 Gate 2.0（Stage 0 → Stage 1 之间）
- **Then** Gate 自动执行：
  1. 扫描三队 alignment.md，提取所有 `[ASSUMPTION:CRITICAL]` 标记
  2. 有 CRITICAL → 去重合并 → 生成选择题问卷 → **阻断 Pipeline** → 等待用户回答 → 回答后广播答案 → 放行进入 Stage 1
  3. 无 CRITICAL → **零延迟自动通过** → 直接进入 Stage 1
- **Pass**: 有 CRITICAL 时用户收到问卷且 Pipeline 暂停；无 CRITICAL 时 Gate 不产生任何延迟或输出
- **Fail**: 有 CRITICAL 时 Gate 未阻断 Pipeline（Team Lead 跳过）；或无 CRITICAL 时 Gate 产生了不必要的停顿
- **验证方式**: 构造含 CRITICAL/不含 CRITICAL 的 mock alignment.md，验证 Gate 行为

### AC0.6: 夯入口深度选择生效
- **Given** 用户输入 `/夯 任务描述`
- **When** Team Lead 完成需求理解后
- **Then** 展示三档深度选择（A 需求方案 / B 设计 / C 全流程编码），用户选择后锁定执行范围并持久化到 hang-state.json
- **Pass**: 用户选择后 Pipeline 按对应深度执行（选 A/B 不进入编码 Stage），状态文件存在且字段完整
- **Fail**: 未展示选择、选择后执行范围与承诺不一致、或状态文件未持久化
- **验证方式**: 手动测试三档选择 + 检查 `.claude-flow/hang-state.json`

### AC0.7: 进展看板展示
- **Given** 夯正在执行 Pipeline 且有 hang-state.json 状态文件
- **When** Team Lead 每次交互前
- **Then** 输出可视化看板，包含阶段状态（已完成/当前/待完成）、各队进度百分比、当前阶段产物路径
- **Pass**: 看板包含阶段状态链、进度数据、产物路径链接
- **Fail**: 看板缺失关键指标或状态与 hang-state.json 不一致
- **验证方式**: 手动检查看板输出 + 对比状态文件

### AC1.1: AC 字段实验上线
- **Given** 用户执行 `kf-spec 功能描述 --ac`
- **When** kf-spec 生成 Spec 文档
- **Then** Spec 文档中包含 `## 验收条件` 章节，内含 Given-When-Then 格式的 AC 条目
- **Pass**: `## 验收条件` 章节存在，AC 条目格式符合 Given/When/Then
- **Fail**: 章节缺失或 AC 条目无 Given/When/Then 结构
- **验证方式**: 自动化校验 + 2 周采用率统计

### AC1.2: 条件 review 触发正确
- **Given** kf-code-review-graph 产出的 review 报告（含标准 severity）
- **When** 检查触发条件：P0 数量 > 0 OR P1 密度 > 3/KLOC
- **Then** 满足条件时自动触发重审（上限 3 轮），不满足时一次通过
- **Pass**: 重审触发决策正确率 > 95%（通过人工抽查验证）
- **Fail**: 误触发率 > 20% 或漏触发率 > 10%
- **验证方式**: 重审触发日志 + 人工抽查

### AC1.3: /夯 浅层 Plan 可打断
- **Given** 用户触发 `/夯 任务描述`，浅层 Plan 已注入
- **When** 用户在 Plan 注入后 30 秒内回复"改"/"停"
- **Then** 流程暂停，等待用户修订后再继续
- **Pass**: 用户打断后流程暂停，修订后 resume 成功
- **Fail**: 打断不生效或修订后无法 resume

### AC1.5: 测试专家循环达标

- **Given** 编码完成进入 Stage 3
- **When** 测试专家开始执行测试
- **Then** 准备至少 3 种不同角色/权限/数据状态的测试场景，执行测试 → 出 issue_list → 开发 fix → 回归测试，上限 3 轮；包含 UI 视觉检查
- **Pass**: 测试场景覆盖多角色多权限，循环逻辑正确（有 issue 则触发下一轮），UI 视觉检查执行
- **Fail**: 测试数据单一（只用默认角色）、无循环机制（一次过不回归）、或 UI 视觉检查缺失
- **验证方式**: 构造含已知缺陷的代码验证循环触发逻辑

### AC1.4: 单元测试伴随生成
- **Given** 用户执行 `/夯 --with-tests 功能描述`
- **When** 编码 agent 生成代码
- **Then** 每个函数/组件同步生成 `.test.{ts|js}` 文件，且测试可执行通过
- **Pass**: 测试文件存在，执行后通过
- **Fail**: 测试文件缺失或执行失败

## 4. 边界情况

| # | 场景 | 预期行为 |
|---|------|---------|
| EC1 | 上游技能（jeffallan 66个）产出中无 quality_signals 块 | 不报错，logger 静默跳过，不阻塞 Pipeline |
| EC2 | kf-code-review-graph 的 review 报告无任何问题 | JSON 输出 `{"issues": [], "severity_distribution": {}}`, 不触发重审 |
| EC3 | /夯 浅层 Plan 生成超时 | 5s 超时后跳过 Plan 注入，直接进入 spawn agent 流程 |
| EC4 | 缓存审计发现前缀不一致 | 输出具体差异文件和 token 偏移量，延迟 Phase 1 启动直到修复 |
| EC5 | 用户 30s 内不响应浅层 Plan | 自动继续执行，Plan 内容入 agent prompt 作为执行依据 |
| EC6 | 条件 review 重审第 3 轮仍不通过 | 标记为 [UNRESOLVED]，写入 escalation 日志，不阻塞后续阶段 |
| EC7 | 简单 bugfix 触发 /夯 | 跳过浅层 Plan，直接单 agent 执行 |
| EC11 | 反转门控检查时某队 Stage 0 未完成 | Gate 等待所有三队完成后再执行（不检查部分结果） |
| EC12 | 用户对反转门控问卷超时不回答 | 5 分钟后 Gate 自动采用各题的"默认选择"继续，写日志 |
| EC13 | 反转门控合并后 Top 5 问题中有矛盾（A 队和 B 队对同一问题给出冲突的默认选择） | Team Lead 以红队→蓝队→绿队的优先级覆盖默认选择，在问卷中标注"默认选择来自{队名}" |
| EC14 | 三队均为空产出（Stage 0 未产生任何 alignment.md） | Gate 跳过，直接进入 Stage 1（等价于零问题），写告警日志 |
| EC15 | 反转门控答案广播后，某队的 agent 已经因超时失活 | 广播答案写入 `.claude-flow/gate-broadcast/{execution_id}.json`，新 spawn 的 agent 读取该文件作为约束 |
| EC8 | AC 字段实验 2 周后采用率 < 30% | 维持 feature flag 状态，不设默认开启，不删除代码 |
| EC9 | 单元测试伴随的文件为纯配置文件/类型定义 | 不生成测试文件，按扩展名白名单过滤（.tsx/.jsx/.py/.go 才生成） |
| EC10 | 缓存审计脚本在 Windows/Linux 下行为差异 | CRLF vs LF 问题，审计脚本 internally normalize 换行符 |
| EC16 | 用户选 A（需求）后隔段时间想继续编码 | 检测 hang-state.json → 展示三档恢复选项：继续对话 / gspowers 引导 / 夯编码 Pipeline |
| EC17 | hang-state.json 损坏或字段不完整 | 重新从深度选择开始，写告警日志，不阻塞用户输入 |
| EC18 | 测试循环第 3 轮仍有 P0 缺陷 | 标记 UNRESOLVED，写 escalation 日志，进入 Stage 4 但带警告标记，不无限阻塞 |
| EC19 | UI 视觉检查在无头浏览器中不可用 | 跳过截图对比，仅做功能性测试+布局断言，写日志说明 |
| EC20 | 用户从 A/B 恢复时选择 gspowers 引导 | 夯生成 handoff.md（含任务规格、已完成阶段、产物清单），喂给 gspowers 接手导航 |

## 5. 依赖

| 依赖 | 类型 | 影响 |
|------|------|------|
| kf-code-review-graph (现有) | 内部依赖 | Phase 0.2 的改造目标技能 |
| kf-multi-team-compete / 夯 (现有) | 内部依赖 | Phase 0.3 + Phase 1.3 的改造目标技能 |
| kf-spec (现有) | 内部依赖 | Phase 1.1 的改造目标技能 |
| hammer-bridge.cjs (现有) | 内部依赖 | Phase 0.3 浅层 Plan 注入的消费端 |
| claude-code-pro (现有) | 内部依赖 | Phase 1.2 条件 review 的回调复用 |
| DeepSeek API (外部, KV Cache) | 外部约束 | 所有改动受缓存前缀一致性约束 |
| 66 个 jeffallan 上游技能 | 外部依赖 | 不做改动，只做兼容性检查 |
| cache-optimization.md (项目规则) | 内部约束 | 设计中引用的缓存规则 |

## 6. 数据变更

### 新增：quality_signals 块结构
```json
{
  "quality_signals": {
    "artifact_type": "review_report | spec_doc | code_files | test_report | alignment_record",
    "timestamp": "ISO8601",
    "skill_name": "kf-code-review-graph",
    "execution_id": "uuid",
    "changed_files": ["path/to/file1", "path/to/file2"],
    "line_count_total": 245,
    "severity": {
      "P0": 0,
      "P1": 2,
      "P2": 5,
      "P3": 3
    },
    "test_status": "none | passed | failed | skipped"
  }
}
```

### 新增：review JSON 输出路径
```
.claude/logs/review-{timestamp}-{execution_id}.json
```

### 新增：质量信号日志路径
```
.claude/logs/quality-signals.jsonl
```

### 新增：缓存审计脚本
```
.claude/helpers/cache-audit.cjs
```

### 新增：Rule 文件
```
.claude/quality-rules.json     # Phase 2 风控规则
.claude/logs/escalation.jsonl   # Escalation 日志
```

### 新增：反转门控 Gate 状态文件
```
.claude-flow/gate-state/latest.json          # 当前 Gate 状态：waiting / passed / blocked
.claude-flow/gate-state/{execution_id}.json   # 每次 Gate 执行的完整记录（含问题合并过程和答案广播）
.claude-flow/gate-broadcast/{execution_id}.json  # 答案广播，供失活后新 spawn 的 agent 读取
```

### 新增：反转门控日志
```
.claude/logs/inversion-gate.jsonl  # 每次 Gate 执行记录：有无 CRITICAL、问题数、用户回答耗时、gate 结果
```

### 新增：夯执行状态文件
```
.claude-flow/hang-state.json       # 夯执行状态持久化：深度选择(A/B/C)、当前阶段、已完成阶段清单、各队进度、阶段产物路径
.claude-flow/hang-handoff.md       # 恢复引导文件：供 gspowers 接手时读取的任务规格+已完成阶段+产物清单
```

## 7. 安全与缓存

| 约束 | 说明 |
|------|------|
| 共享前缀 LOCKED | agent prompt 前 300 token 逐字锁定（含空格、换行、全角/半角），所有新内容 MUST 追加在 `### SHARED PREFIX END` 之后 |
| quality_signals 写入隔离 | 只写入 `.claude/logs/` 和 `.claude-flow/`，不写入用户代码目录 |
| 无外部请求 | schema 校验、平面触发判断均为本地计算，不发起外部 API 调用 |
| 上游技能防御 | 66 个上游技能产出中无 quality_signals 时，不报错不阻断，只记录日志 |

## Spec 质量评分卡（终版）

| 维度 | 评分标准 | 得分 |
|------|---------|------|
| AC 完整性（30%） | 12 个功能均覆盖 AC | 28/30 |
| AC 可验证性（25%） | 所有 AC 有明确 pass/fail | 25/25 |
| 边界覆盖（20%） | 20 个 EC 覆盖主要边界 | 19/20 |
| 依赖完整性（15%） | 内部和外部依赖完整标注 | 15/15 |
| 缓存安全（10%） | 共享前缀约束明确 | 10/10 |

**综合评分**: 97/100 ✅ **可执行**
