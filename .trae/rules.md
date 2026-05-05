# AI编程智驾 — Trae Builder 适配层

> 从 `.claude/` 技能体系中提炼的核心约束，供 Trae Builder 加载。
> 共享脚本位于 `.claude/helpers/`（纯 Node.js，Trae 可直接调用）。

---

## 六字真言

所有工作遵循六大原则优先级：

| 原则 | 含义 | 体现 |
|------|------|------|
| **稳** | 稳定可靠，不翻车 | 门控验证、约束检查、禁止跳步 |
| **省** | 省 token、省时间 | 模型路由、按需加载、不铺张 |
| **准** | 信息准确、决策有据 | 搜索验证、浏览器实测、不瞎猜 |
| **测的准** | 可验证、可复现 | 自动化测试、Playwright 回放 |
| **夯** | 夯实方案、多方校验 | 多视角评审、竞争择优 |
| **快** | 快速启动、快速交付 | Spec 驱动、模板化产出 |
| **懂** | 理解意图、对齐认知 | 动前对齐、动后复盘 |

---

## 五根铁律（Harness Engineering）

### 铁律 1：指令清晰

- 每个任务 MUST 有明确的 Step 序列（至少 3 步）
- MUST NOT 使用模糊描述（如"优化一下"、"看着改"）
- 遇到 Gate 门控条件时 MUST 验证通过才能继续，不得跳步
- 产出的文档/代码 MUST 有明确的完成标准

### 铁律 2：约束机械化

- 关键产出 MUST 通过门控验证：
  ```
  node .claude/helpers/harness-gate-check.cjs --required-files <文件> --required-sections <章节> --forbidden-patterns TODO 待定
  ```
- 验证失败 = 阻断流程，MUST 修复后重试
- 任何文件产出后 MUST 检查禁止模式：`TODO`、`待定`、`FIXME`（除非有明确 ticket 号）

### 铁律 3：反馈闭环

强制遵循 **Plan → Build → Verify → Fix** 循环：

| 阶段 | 动作 |
|------|------|
| Plan | 明确要做什么、怎么做、完成标准 |
| Build | 按计划执行，不偏离 |
| Verify | 机械化验证（跑 harness-gate-check、跑测试） |
| Fix | 验证失败 → 修复 → 重新 Verify |

不接受主观"我觉得好了"，只接受机械化验证通过。

### 铁律 4：记忆持久化

- 每次对齐/重大决策后 MUST 写入 `memory/` 目录
- 下次同类任务启动时 MUST 先读 `memory/` 中的历史基线
- 不让 AI 在同一个坑里摔两次

### 铁律 5：编排合理

- 架构设计/需求澄清 → 用 pro 级模型（Opus/Pro）
- 日常编码/执行 → 用 flash 级模型（Sonnet/Flash）
- 简单问答/格式转换 → 用轻量模型（Haiku）
- 复杂任务 → 拆分为多步流水线，不得一步到位

---

## 对齐工作流（"懂"原则）

### 动前对齐（Before Action）

接到任务后，执行前，MUST 先输出：

```
## 我的理解
[用自己的话复述：要做什么、为什么做、约束条件]

## 我的打算
[打算怎么做：分几步、用什么技术方案、关键决策点]

## 边界确认
- 范围：[本期做什么]
- 排除：[本期不做什么]
- 风险：[可能遇到的问题]
```

复杂决策给 2-4 个选项（选择题），附带后果说明，禁止开放提问。

### 动后复盘（After Action）

完成任务后，MUST 输出：

```
## 实际做了什么
## 与计划差异
| 计划 | 实际 | 原因 |
## 关键决策
## 遗留问题
```

---

## 模型智能路由

| 场景 | 模型 | 原因 |
|------|------|------|
| 架构设计 / 需求澄清 | **Pro/Opus** | 需要深度推理、权衡取舍 |
| 复杂 Bug 排查 | **Pro/Opus** | 需要完整上下文推理链 |
| 日常编码 / 执行 | **Flash/Sonnet** | 效率优先，性价比高 |
| 代码审查 | **Flash/Sonnet** | 模式匹配为主 |
| 文档生成 | **Flash/Sonnet** | 结构化输出 |
| 简单问答 / 格式转换 | **Haiku** | 快速响应 |

配比建议：Pro 20% + Flash 70% + Haiku 10%

---

## 编码规范

### 通用规则

- MUST NOT 生成无注释就难以理解的代码——优先用清晰的命名替代注释
- MUST NOT 为"不会发生"的场景写错误处理
- MUST NOT 引入抽象和分层超出当前需求范围
- MUST NOT 使用 emoji（除非用户明确要求）
- MUST NOT 创建 README/markdown 文档（除非用户明确要求）
- MUST 优先编辑现有文件，而非创建新文件
- MUST 对安全敏感操作（删除、push --force、数据库操作）先确认

### 安全红线

- MUST NOT 生成或猜测 URL（除非是开发辅助目的）
- MUST NOT 引入 XSS、SQL 注入、命令注入等 OWASP 漏洞
- MUST NOT 在代码中硬编码凭据、API Key、Token
- MUST NOT 跳过 Git hooks（--no-verify、--no-gpg-sign）

### Spec 驱动开发

1. 需求 → Spec 规格文档（明确输入/输出/边界条件）
2. Spec → 分步实施计划（每步可独立验证）
3. 每步实施后 → 验证通过 → 下一步
4. 全部完成后 → 对照 Spec 做动后对齐

---

## 共享工具链

以下脚本为纯 Node.js，Trae Builder 可直接通过终端调用：

### 门控验证
```bash
# 检查必需文件是否存在
node .claude/helpers/harness-gate-check.cjs --required-files "PRD.md" "Spec.md"

# 检查 Markdown 是否包含必需章节
node .claude/helpers/harness-gate-check.cjs --required-sections "## 需求概述" "## 技术方案"

# 检查禁止模式（不允许 TODO、待定 等占位符残留）
node .claude/helpers/harness-gate-check.cjs --forbidden-patterns "TODO" "待定" "FIXME"

# 组合使用
node .claude/helpers/harness-gate-check.cjs \
  --required-files "Spec.md" \
  --required-sections "## 需求" "## 方案" "## 约束" \
  --forbidden-patterns "TODO" "待定"
```

### 全量审计
```bash
# 扫描所有技能，生成五根铁律评分报告
node .claude/helpers/harness-audit.cjs --all --verbose
```

### 记忆管理
- 读取历史：检查 `memory/` 目录下的相关 `.md` 文件
- 写入记忆：追加到对应的 `memory/*.md` 文件

---

## 与 Claude Code 完整版的能力差异

| 能力 | Claude Code | Trae Builder |
|------|:---:|:---:|
| 五根铁律约束 | v | v（通过本 rules） |
| 对齐工作流 | v | v（通过本 rules） |
| 模型路由 | v（自动） | v（手动，按上表建议） |
| 门控验证脚本 | v | v（Bash 调用） |
| 审计脚本 | v | v（Bash 调用） |
| `/夯` 多队竞争 | v | -（可手动拆分视角评审） |
| Skill 按需加载 | v | -（全量加载本 rules） |
| Hook 自动触发 | v | -（手动执行验证步骤） |
| Agent Spawn 并行 | v | -（串行执行） |
| MCP 工具（pencil/ruflo） | v | 取决于 Trae MCP 支持 |
| 技能安装管家（kf-add-skill） | v | v（关键词搜索→安装→.claude/.trae 同步） |
| 学术论文搜索（asta-skill） | v | v（MCP 协议，需 ASTA_API_KEY） |
| jeffallan/claude-skills (66) | v | v（第三方技能合集，按需加载） |
