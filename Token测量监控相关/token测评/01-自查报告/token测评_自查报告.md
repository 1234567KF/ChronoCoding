# Token 省钱自查报告

> 生成时间：2026/05/05
> 数据来源：D:\AICoding\.claude\CLAUDE.md（项目技能总览）
> 方法：基于代码/文档描述的定性+定量估算，待实测校准

---

## 一、"省"相关技能总表

| 技能 | 别名 | 省钱原理 | 预估节省幅度（定性） | 预估节省（定量） | 适用场景 |
|------|------|---------|-------------------|----------------|---------|
| `kf-model-router` | 模型路由 | 计划用 Pro，执行用 Flash（价格差 ~10x） | **高** | 输入：Flash $0.15/MTok vs Pro $3/MTok；同质量任务省 ~95% | 所有技能自动触发；日常开发、搜索、代码生成 |
| `claude-code-pro` | ccp | 智能调度：<3 文件跳过 spawn；回调替代轮询 | **高** | spawn 跳过：省 10K–15K token/次；回调替代轮询：省 80–97% 轮询开销 | `/夯`、`/triple` 等多 Agent 场景 |
| `lambda-lang` | λ | Agent 间通信协议，340+ 原子，7 域，3x 压缩 | **中** | 单次 agent 通信从 ~200 token 降至 ~67 token（3x 压缩） | `/夯`、`/triple` 等多 agent 并发时自动注入 |
| `kf-code-review-graph` | /review-graph | 依赖图谱提取 vs 全量扫描，仅分析引用树 | **中** | 依赖图谱轻量 vs 全量扫描：省 30–70% token（取决于项目规模） | `/夯` Stage 4；代码审查 |
| `kf-doc-consistency` | 一致性 | Pipeline + Reviewer 闭环，避免重复同步 | **低** | 减少重复文档同步：省 ~10–20% 文档类 token | `kf-add-skill` 自动调用；文档维护 |
| `kf-reverse-spec` | 逆向 | 存量代码→Spec 逆向流水线，避免重复需求分析 | **中** | 复用已有代码结构，省去重新理解代码的时间（~200–500 token/次） | 接手旧项目、代码审计 |
## 一、"省"相关技能总表

| 技能 | 别名 | 省钱原理 | 预估节省幅度（定性） | 预估节省（定量） | 适用场景 |
|------|------|---------|-------------------|----------------|---------|
| `lean-ctx` | — | **RTK 替代者**，Shell Hook + Claude Code Hook 双通道，90+ 压缩模式 + CCP | **高** | vitest: 102,199字符→377字符 (-99.6%)；综合节省 80%+ | 所有 CLI 操作（git/npm/cargo 等），Claude Code 集成 |
| `context-mode` | — | MCP Server，压缩存活 + 会话追踪，SQLite 事件记录 | **中** | 工具输出 315KB→5.4KB (-98%)；Agent 输出节省 ~65% | 长会话（>2h）、`/compact` 后恢复、跨会话续传 |
| `claude-mem` | — | 跨会话持久记忆（SQLite + Chroma 向量），自动捕获决策/上下文 | **中** | 避免重复解释背景，省 ~100–300 token/次 | 多会话项目、记忆复用 |
| `kf-model-router` | 模型路由 | 计划用 Pro，执行用 Flash（价格差 ~10x） | **高** | Flash $0.15/MTok vs Pro $3/MTok；同质量任务省 ~95% | 所有技能自动触发；日常开发、搜索、代码生成 |
| `claude-code-pro` | ccp | 智能调度：<3 文件跳过 spawn；回调替代轮询 | **高** | spawn 跳过：省 10K–15K token/次；回调替代轮询：省 80–97% 轮询开销 | `/夯`、`/triple` 等多 Agent 场景 |
| `lambda-lang` | λ | Agent 间通信协议，340+ 原子，7 域，3x 压缩 | **中** | 单次 agent 通信从 ~200 token 降至 ~67 token（3x 压缩） | `/夯`、`/triple` 等多 agent 并发时自动注入 |
| `kf-code-review-graph` | /review-graph | 依赖图谱提取 vs 全量扫描，仅分析引用树 | **中** | 依赖图谱轻量 vs 全量扫描：省 30–70% token（取决于项目规模） | `/夯` Stage 4；代码审查 |
| `kf-doc-consistency` | 一致性 | Pipeline + Reviewer 闭环，避免重复同步 | **低** | 减少重复文档同步：省 ~10–20% 文档类 token | `kf-add-skill` 自动调用；文档维护 |
| `kf-reverse-spec` | 逆向 | 存量代码→Spec 逆向流水线，避免重复需求分析 | **中** | 复用已有代码结构，省去重新理解代码的时间（~200–500 token/次） | 接手旧项目、代码审计 |

---

## 一（补充）：工具演进关系

> ⚠️ **重要澄清**：RTK → lean-ctx 是升级替代关系，非并存

| 老工具 | 状态 | 替代者 | 说明 |
|--------|------|--------|------|
| RTK (Rust Token Killer) | ❌ 已迁移 | **lean-ctx** | INSTALL.md v1.5 已标注"已迁移: RTK→lean-ctx"，lean-ctx 有 90+ 压缩模式 + CCP，RTK 被完全替代 |
| context-mode | ✅ 仍在用 | — | 与 lean-ctx 功能互补：context-mode 管会话存活，lean-ctx 管 CLI token 压缩 |
| claude-mem | ✅ 仍在用 | — | 跨会话持久记忆，与 context-mode 互补 |

> **RTK 已不再维护**，本项目的 token 压缩核心是 lean-ctx。RTK 评测数据（90%+压缩率、138M token节省）可作为历史参考，但**实际部署应使用 lean-ctx**。

---

## 二、省 Token 维度分析

### 维度 1：模型选择（kf-model-router）

| 子维度 | 原理 | 节省效果 |
|--------|------|---------|
| 计划阶段 | 用 Pro 模型（强推理）分析问题 | 高质量规划，避免返工 |
| 执行阶段 | 切换 Flash 模型（快速）执行 | 价格从 $3/MTok → $0.15/MTok，省 95% |
| 触发条件 | 所有技能启动时自动检查并切换 | 用户无感，自动化节省 |

### 维度 2：调度优化（claude-code-pro）

| 子维度 | 原理 | 节省效果 |
|--------|------|---------|
| 智能跳过 | <3 文件不 spawn agent | 避免不必要的 agent 启动，省 10K–15K token/次 |
| 回调替代轮询 | agent 完成后主动回调，不重复请求 | 轮询开销从 ~100次 → 0次，省 80–97% |
| CCP 判断逻辑 | 自动评估任务复杂度，决定是否并发 | 减少无谓的并发开销 |

### 维度 3：通信压缩（lambda-lang）

| 子维度 | 原理 | 节省效果 |
|--------|------|---------|
| 协议原子化 | 340+ 原子指令替代自然语言 | 单次通信 ~200 token → ~67 token |
| 7 域覆盖 | a2a/evo/code/... 分类压缩 | 覆盖 agent 间各类通信场景 |
| 握手协议 | `@v2.0#h` 握手，自动注入 | 多 agent 场景下全量生效 |

### 维度 4：CLI 输出压缩（lean-ctx）

| 子维度 | 原理 | 节省效果 |
|--------|------|---------|
| Shell Hook | 命令输出过滤+压缩（如 `git status` 102K→377 chars） | CLI 命令省 80–99% |
| Claude Code Hook | PreToolUse trigger，自动改写命令为 `ctx_shell` | 全局生效，用户无感 |
| 90+ 压缩模式 | auto/full/map/signatures/diff/aggressive/entropy/task | 按场景自适应最优压缩 |
| CCP (Cross-Context Persistence) | 跨会话持久化，时间事实+矛盾检测 | 跨会话省 ~100–300 token/次 |

### 维度 5：会话管理（context-mode + claude-mem）

| 子维度 | 原理 | 节省效果 |
|--------|------|---------|
| context-mode | `/compact` 后自动恢复工作状态，BM25 检索 | 长会话省 65%+ 输出 token |
| claude-mem | 跨会话持久记忆，自动捕获决策/上下文 | 避免重复解释背景 |

### 维度 6：输入优化

| 子维度 | 原理 | 节省效果 |
|--------|------|---------|
| 依赖图谱（kf-code-review-graph） | 只分析引用树，不扫全部文件 | 中大型项目省 30–70% 输入 token |
| lean-ctx 文件读取 | 90+ 压缩模式（map/signatures/aggressive 等） | 大文件读取省 60–90% |

### 维度 7：输出优化

| 子维度 | 原理 | 节省效果 |
|--------|------|---------|
| 结构化提取（kf-langextract） | 非结构化文本→JSON/CSV/YAML，source grounding | 减少人工解析，降低输出 token 浪费 |
| 精简输出 | 指定格式输出，避免冗余描述 | 省 ~10–20% 输出 token |

---

## 三、综合估算（待实测校准）

> ⚠️ 以下为基于 CLAUDE.md 描述的估算，实际效果需通过测评体系验证

| 场景 | 基础 token | 省 token 技能叠加 | 综合节省率 |
|------|-----------|------------------|-----------|
| 简单单次任务（<3文件） | 20K | kf-model-router（95%）+ lambda-lang（3x压缩） | ~**97%** |
| 复杂多 Agent 任务（/夯） | 200K | ccp智能调度（省spawn）+ lambda（3x）+ model-router（95%） | ~**90%** |
| 代码审查（/review-graph） | 50K | kf-code-review-graph（图谱） + ccp回调 | ~**60%** |

---

## 四、测评需求对齐

根据专题任务要求，以下信息需要实测后才能填入：

| 数据项 | 说明 | 状态 |
|--------|------|------|
| 输入 token 节省 | 记录每次任务的输入 token 消耗 | ❌ 待实测 |
| 输出 token 节省 | 记录每次任务的输出 token 消耗 | ❌ 待实测 |
| 命中缓存次数 | 区分首次/二次/三次调用 | ❌ 待实测 |
| 模型切换节省 | Pro vs Flash 价格差 | ⚠️ 价格已知，待验证质量等价性 |
| 调度节省 | ccp 跳过 spawn 的实际次数 | ❌ 待实测 |
| 压缩率验证 | lambda-lang 3x 压缩实际效果 | ❌ 待实测 |

---

## 五、待补充方向

1. **lean-ctx 实际集成验证**：检查 `lean-ctx.exe init --agent claude` 是否已执行，hooks 是否生效（`lean-ctx ctx_overview` 应显示项目统计）
2. **RTK 评测数据归档**：RTK 历史数据（90%+压缩率，138M token 节省）迁移到 `03-搜索结果/` 作为参考
3. **实测方案**：需要设计标准测试用例（见 `../04-测评体系/`）
4. **外部方案搜索**：GitHub/B站/YouTube 上是否有更先进的省 token 方案（对应专题任务步骤2-3）
5. **综合报告生成**：基于已有数据（RTK 评测、lean-ctx 评测、context-mode 评测）生成步骤5综合报告

---

*报告生成：triple collaboration → 单 agent 自查输出*
*下次迭代：可通过 triple 红蓝评审扩展分析面*