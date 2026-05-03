# 夯 执行摘要 — 存量代码扫描→文档生成工具调研

**日期**：2026-05-03
**系统**：kf-multi-team-compete（回退模式：顺序模拟三队）
**任务来源**：用户指令

---

## 任务

调研 GitHub 高星存量代码扫描工具，产出可用于逆向项目的技术/功能文档方案，便于重构或二次开发维护。

## 输入

- 2026-05-03 用户直接口述需求（非 SDD Excel）
- 歧义等级：低（GREEN）— 需求已足够清晰

---

## 三团队方案对比

| 团队 | 方案核心 | 总分 | 阶段 |
|------|---------|------|------|
| 🔴 红队 激进 | Agent Swarm + MCP Wiki Factory | **7.65** | 2/2 |
| 🔵 蓝队 稳健 | Scout→Map→Doc→Sync 渐进式 | **8.25** | 2/2 |
| 🟢 绿队 安全 | 本地优先三层渐进暴露 | **7.10** | 2/2 |

### 红队方案 — Agent Swarm + MCP Wiki Factory

**核心工具链**：deepwiki-rs + spec-gen + Octocode MCP + Understand-Anything + schematic/spec-miner

**四阶段流水线**：
1. 静态扫描（tree-sitter AST 解析 + 依赖图构建）
2. AI 深度分析（Multi-Agent LLM 分析 + GraphRAG 语义搜索）
3. 文档编排（C4 模型 + Mermaid 图 + Wiki/Spec 输出）
4. 持续同步（Git Hook 漂移检测 + PR 自动更新）

**优势**：全自动化、零人工干预、多 Agent 并发
**风险**：LLM 成本不可控、超大仓库可能超上下文窗口

### 蓝队方案 — Scout→Map→Doc→Sync 渐进式

**核心工具链**：repowise + codekritik + schematic + wikigen + spec-gen + @repositories-wiki/repository-wiki

**四阶段流水线**：
1. Scout（repowise scan + codekritik metrics → 代码树 + 依赖图 + 热点分析）
2. Map（schematic 11 节 Spec + Understand-Anything 知识图谱）
3. Doc（wikigen ISO 12207 文档 + spec-gen 功能 Spec）
4. Sync（spec-gen drift + CI/CD 门控 + Git Hook 增量更新）

**实施路径**：
- 轻量级（1人日）：schematic + wikigen
- 标准级（1周）：repowise + codekritik + spec-gen + repository-wiki
- 企业级（2周）：标准级 + CI/CD + MCP Server

**优势**：渐进式采用、每阶段有产出、工具成熟度高
**风险**：组合工具需集成适配、部分工具可能维护滞后

### 绿队方案 — 本地优先三层渐进暴露

**核心工具链**：codekritik + repowise + deepwiki-rs(Ollama) + DeepV-Ki(local LLM)

**三层安全策略**：
1. L0 纯本地静态分析（codekritik + repowise，零网络依赖）
2. L1 本地 LLM（Ollama，代码不出边界）
3. L2 可控云端（schematic Claude Skill + spec-gen MCP）

**优势**：零数据泄露风险、全本地运行、20+ 语言覆盖、回滚路径清晰
**风险**：本地 LLM 文档质量不如云端；纯静态缺少语义理解

---

## 裁判评分卡

评判维度：正确性 30% / 创新性 25% / 可维护性 20% / 效率 15% / 安全性 10%

| 排名 | 团队 | 正确性 | 创新性 | 可维护性 | 效率 | 安全性 | 总分 |
|------|------|--------|--------|---------|------|--------|------|
| 🥇 | 蓝队 | 9 | 7 | 9 | 8 | 8 | **8.25** |
| 🥈 | 红队 | 8 | 9 | 6 | 8 | 6 | **7.65** |
| 🥉 | 绿队 | 7 | 6 | 8 | 6 | 10 | **7.10** |

---

## 最终决策 — 博采众长（分差 7.3% < 15%）

### 推荐组合

```
┌─ 扫描层 (必选) ───────┐  ┌─ 分析层 (必选) ───────┐  ┌─ 文档层 (可选) ────────┐
│ repowise 四层代码智能   │  │ schematic 11节Spec    │  │ wikigen ISO 12207 文档 │
│ codekritik 复杂度指标   │→ │ spec-miner EARS需求    │→ │ deepwiki-rs C4 架构图  │
│ tree-sitter 多语言解析  │  │ repowise GraphRAG语义  │  │ spec-gen 功能Spec      │
└────────────────────────┘  └───────────────────────┘  └────────────────────────┘
                               ┌─ 同步层 (可选) ─────┐
                               │ spec-gen 漂移检测    │
                               │ Git hooks 增量更新   │
                               │ MCP Server 按需检索  │
                               └─────────────────────┘
```

### 实施路径

| Phase | 时长 | 动作 | 产出 |
|-------|------|------|------|
| Scout | 1h | pip install repowise codekritik; repowise init | 代码树 + 依赖图 + 指标报告 |
| Map | 2h | schematic 逆向 → 11 节 Spec | Spec 文档 |
| Doc | 4h | wikigen/deepwiki-rs → Wiki 文档 | Wiki / 功能文档 |
| Sync | 1h | spec-gen drift + CI/CD 接入 | 漂移检测自动化 |

### 方案来源

- **核心扫描层**：蓝队 — repowise + codekritik
- **Spec 逆向**：蓝队 — schematic
- **文档增强**：红队 — deepwiki-rs C4 模型 + Octocode GraphRAG
- **安全兜底**：绿队 — codekritik + 全本地运行选项

---

## 联动诊断

执行过程中发现的连点器断链问题：

| 断裂点 | 严重度 | 状态 |
|--------|--------|------|
| model-router-hook.cjs 脚本缺失 | P0 | ✅ 已创建 |
| settings.json 缺 Skill matcher Hook | P0 | ✅ 已配置 |
| WebSearch 绕过 kf-web-search 技能 | P1 | 需后续注意 |

---

## 后续产出

根据用户要求，用 kf-skill-design-expert 设计了：

1. **`kf-reverse-spec`** — 本调研结论的落地技能（Pipeline 5 阶段）
2. **`model-router-hook.cjs`** — 连点器断链修复
