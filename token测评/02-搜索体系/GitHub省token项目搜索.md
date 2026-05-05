# GitHub 省 Token 项目搜索结果

> 生成时间：2026/05/05
> 数据来源：WebSearch GitHub 搜索

---

## Top 10 GitHub Token 节省项目

| Rank | Repo | Stars | 主要技术 | 相关度 |
|------|------|-------|---------|-------|
| 1 | **[open-compress/claw-compactor](https://github.com/open-compress/claw-compactor)** | 2,354 | 14级融合管道，AST感知代码分析，可逆压缩，零推理开销 | ⭐⭐⭐⭐⭐ |
| 2 | **[houtini-ai/houtini-lm](https://github.com/houtini-ai/houtini-lm)** | 81 | MCP server，任务委托给本地/便宜 LLM（LM Studio/Ollama/vLLM/DeepSeek） | ⭐⭐⭐⭐ |
| 3 | **[sliday/tamp](https://github.com/sliday/tamp)** | 79 | Claude Code Token 压缩代理，声称 50% 更少 token，零行为变化 | ⭐⭐⭐⭐ |
| 4 | **[edgee-ai/edgee](https://github.com/edgee-ai/edgee)** | 64 | Rust AI 网关，支持 Claude Code/Codex 等，Token 压缩 | ⭐⭐⭐⭐ |
| 5 | **[jserv/cjk-token-reducer](https://github.com/jserv/cjk-token-reducer)** | 45 | CJK（中日韩）文本 Token 优化，降低 35–50% | ⭐⭐⭐ |
| 6 | **[wcz234/skills-token-optimizer](https://github.com/wcz234/skills-token-optimizer)** | 5 | CLI 输出过滤，RTK 启发，节省 60–90% | ⭐⭐⭐ |
| 7 | **[jkf87/rtk-setup-skill](https://github.com/jkf87/rtk-setup-skill)** | 5 | RTK 设置技能，通过 AGENTS.md 强制 Token 节省命令 | ⭐⭐⭐ |
| 8 | **[ousamabenyounes/rtk-mcp](https://github.com/ousamabenyounes/rtk-mcp)** | 4 | RTK MCP bridge，支持 Claude Desktop/Cursor/Windsurf | ⭐⭐⭐ |
| 9 | **[voska/pi-rtk](https://github.com/voska/pi-rtk)** | 1 | RTK 集成 Pi coding agent，节省 60–90% | ⭐⭐ |
| 10 | **[GrayCodeAI/tok](https://github.com/GrayCodeAI/tok)** | 1 | 统一 Token 优化 CLI，人工输入压缩 + shell 输出过滤 | ⭐⭐ |

---

## 关键技术分析

### 1. claw-compactor（⭐⭐⭐⭐⭐）
- **原理**：14级 AST 感知融合管道，可逆压缩，零 LLM 推理成本
- **亮点**：代码结构感知压缩，非通用文本过滤
- **可融合性**：高，但实现复杂度也高

### 2. houtini-lm（⭐⭐⭐⭐）
- **原理**：MCP 任务委托到本地/便宜 LLM
- **亮点**：绕过云端 API，直接用 Ollama/LM Studio
- **可融合性**：中，本项目已有类似思路（model-router 切 flash）

### 3. RTK 生态（sliday/tamp、rtk-mcp 等）（⭐⭐⭐）
- **原理**：CLI 输出过滤代理
- **亮点**：透明，用户无感
- **本项目已有**：lean-ctx（90+压缩模式 > RTK 的 ~20）

### 4. cjk-token-reducer（⭐⭐⭐）
- **原理**：针对中文的 Token 优化
- **亮点**：35–50% 节省，专为 CJK 场景
- **可融合性**：中，如果工作流中有大量中文注释/文档

---

## 搜索渠道验证结果

| 渠道 | 状态 | 原因 |
|------|------|------|
| GitHub | ✅ 成功 | — |
| Bilibili | ❌ 受限 | 网络限制，bilibili.com 无法访问 |
| YouTube | ❌ 受限 | 网络限制，youtube.com 无法访问 |

**建议**：手动在 Bilibili/YouTube 搜索 "RTK token杀手" / "Claude Code 教程" 获取视频资源

---

*Agent: general-purpose (GitHub search)*