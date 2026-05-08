# 第三方开源项目致谢

本项目 **AI编程智驾 (AICoding)** 集成了以下开源项目，感谢他们的贡献：

## 核心集成

| 项目 | 来源 | 许可证 | 用途 |
|------|------|--------|------|
| **gspowers** | https://github.com/fshaan/gspowers | MIT | SOP 流程导航框架 |
| **gstack** | https://github.com/garrytan/gstack | — | 产品流程框架 |
| **Scrapling** | https://github.com/D4Vinci/Scrapling | BSD-3-Clause | Web 爬虫框架，自适应反反爬 + Spider 并发 |
| **frontend-slides** | https://github.com/zarazhangrui/frontend-slides | MIT | HTML 演示文稿生成器 |
| **ruflo** | https://github.com/ruvnet/ruflo | MIT | 多 Agent 编排与记忆系统 |
| **lean-ctx** | https://github.com/garrytan/lean-ctx | MIT | 上下文压缩引擎，90+ 压缩模式 + CCP 会话连续性 |

## 项目结构致谢

```
AICoding/
├── .claude/skills/
│   ├── kf-prd-generator/       # PRD 生成器（自研）
│   ├── kf-scrapling/           # 基于 D4Vinci/Scrapling
│   ├── gspowers/               # 基于 fshaan/gspowers
│   └── gstack/                 # 基于 garrytan/gstack
├── .claude/skills/kf-gspowers-pipeline-patch/  # 基于 fshaan/gspowers 的扩展
└── templates/                  # 配置模板（自研）
```

---

## 各第三方项目 License 说明

### gspowers
- **许可证**: MIT License
- **来源**: https://github.com/fshaan/gspowers
- **描述**: 行业共识的技能规则框架，提供标准化开发流程
- **本项目使用**: Pipeline 多模块流水线的 SOP 导航扩展

### frontend-slides
- **许可证**: MIT License
- **来源**: https://github.com/zarazhangrui/frontend-slides
- **描述**: 零依赖 HTML 演示文稿生成器，支持 PPT 转换
- **本项目使用**: 技能扩展集成

### ruflo
- **许可证**: MIT License
- **来源**: https://github.com/ruvnet/ruflo
- **描述**: AI Agent 编排平台，支持多 Agent 并行/记忆系统
- **本项目使用**: 多 Agent 协同执行框架

### lean-ctx
- **许可证**: MIT License
- **来源**: https://github.com/garrytan/lean-ctx
- **描述**: Rust 单二进制上下文运行时，Shell Hook + Claude Code Hook 双通道压缩
- **本项目使用**: 命令输出压缩、文件读取重定向、CCP 跨会话持久化

### Scrapling
- **许可证**: BSD-3-Clause License
- **来源**: https://github.com/D4Vinci/Scrapling
- **描述**: 自适应 Web 爬虫框架，支持反反爬绕过（Cloudflare Turnstile）、隐身浏览器、Spider 并发框架
- **本项目使用**: kf-scrapling 技能，作为 /夯 调研阶段的深度数据采集工具

---

## 许可证兼容性说明

### LGPL-3.0 兼容的许可证

本项目主许可证为 **LGPL-3.0**。以下第三方项目的许可证与 LGPL-3.0 兼容：

| 项目 | 许可证 | 兼容性 |
|------|--------|--------|
| gspowers | MIT | 兼容 — MIT 代码可纳入 LGPL 项目 |
| gstack | MIT | 兼容 |
| Scrapling | BSD-3-Clause | 兼容 |
| frontend-slides | MIT | 兼容 |
| ruflo | MIT | 兼容 |
| lean-ctx | MIT | 兼容 |
| OpenCLI | MIT | 兼容 |
| autoresearch | MIT | 兼容 |
| jeffallan/claude-skills | MIT | 兼容 |
| caveman | MIT | 兼容 |
| markdown-to-docx-skill | MIT | 兼容 |
| claude-code-pro | MIT | 兼容 |
| lambda-lang | MIT | 兼容 |

### 需注意的许可证

| 项目 | 许可证 | 说明 |
|------|--------|------|
| **claude-mem** | **AGPL-3.0** | ⚠️ 强传染性网络版 copyleft。AGPL-3.0 与 LGPL-3.0 不兼容。claude-mem 作为独立工具通过 npm 全局安装，不作为项目代码库的一部分分发。用户需自行安装并遵守其 AGPL-3.0 条款。 |
| **context-mode** | Elastic-2.0 | ⚠️ 非 OSI 批准的开源许可证。作为独立 npm 包全局安装，不作为项目代码分发。 |

### 使用原则

1. **本项目主许可证**：LGPL-3.0，适用于 AI编程智驾 主项目及其自研部分（kf- 系列技能等）
2. **第三方项目**：保留各自原作者的版权声明和许可证
3. **独立安装工具**：claude-mem（AGPL-3.0）、context-mode（Elastic-2.0）通过 npm/pip 全局独立安装，不作为项目代码库的文件分发。用户自行决定是否安装
4. **集成使用**：各 MIT 和 BSD 开源项目在 LGPL-3.0 项目中保持兼容
5. **商业使用**：需同时遵守各第三方项目的许可证条款。特别注意 AGPL-3.0 的 network interaction 条款

---

## 知识产权说明

1. **本项目的 LGPL-3.0** 适用于 AICoding 主项目及其自研部分（kf- 系列技能等）
2. **第三方项目的 License** 保留各自原作者的版权声明
3. **集成使用**：MIT/BSD 开源项目与 LGPL-3.0 兼容；AGPL-3.0/Elastic-2.0 项目为独立安装工具，不纳入项目代码库分发

---

*最后更新: 2026-05-08*
