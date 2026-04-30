# Claude Code 项目配置

本项目使用**项目本地安装模式**，所有技能和配置都在 `.claude/` 目录下。

## 目录结构

```
.claude/
├── skills/                  # 技能（项目本地）
│   ├── gspowers/           # SOP 导航
│   │   ├── references/     # SOP 定义文件
│   │   │   ├── execute.md  # 执行流程
│   │   │   └── pipeline.md # Pipeline 多模块扩展
│   │   └── ...
│   └── gstack/            # 产品流程框架
├── settings.json           # Claude Code 配置
├── install-local.ps1       # 本地完整安装脚本
└── CLAUDE.md              # 本文件

.claude-flow/              # 项目级 ruflo 记忆
├── config.yaml            # ruflo 配置
└── data/                 # 记忆存储
```

## 快速开始

```powershell
# 1. 运行本地安装脚本（首次或技能更新时）
.\.claude\install-local.ps1

# 2. 在项目目录启动 Claude Code
cd D:\your-project
claude

# 3. 测试 SOP 导航
/gspowers

# 4. 测试多模块流水线
/pipeline-dev

# 5. 测试三方协作
triple [任意任务]
```

## 手动安装（需要网络）

```powershell
# superpowers - Claude Code plugin
/plugin install superpowers@claude-plugins-official
```

## 全局依赖

以下工具**必须全局安装**，无法项目本地化：

| 工具 | 安装命令 | 说明 |
|------|---------|------|
| Claude Code | `irm https://claude.ai/install.ps1 \| iex` | 主界面 |
| Node.js | `winget install OpenJS.NodeJS.LTS` | 运行环境 |
| ruflo | `npm install -g ruflo` | 多 Agent + 记忆 |
| RTK | 见 INSTALL.md | Token 节省 |

## 项目隔离

- **记忆隔离**：每个项目的 ruflo 记忆存储在 `.claude-flow/`
- **配置隔离**：`settings.json` 只影响本项目
- **技能隔离**：gspowers、gstack 在 `.claude/skills/`

## 安装脚本参数

### Windows (PowerShell)
```powershell
.\.claude\install-local.ps1          # 完整安装
.\.claude\install-local.ps1 -DryRun   # 预览模式
.\.claude\install-local.ps1 -SkipGstack   # 跳过 gstack
.\.claude\install-local.ps1 -SkipPipeline  # 跳过 Pipeline
```

### Linux / macOS (Bash)
```bash
chmod +x ./.claude/install-local.sh
./.claude/install-local.sh            # 完整安装
./.claude/install-local.sh --dry-run # 预览模式
./.claude/install-local.sh --skip-gstack    # 跳过 gstack
./.claude/install-local.sh --skip-pipeline  # 跳过 Pipeline
```

### Git Bash (Windows)
```bash
./.claude/install-local.sh            # 完整安装
```

## 更多信息

详见 [INSTALL.md](../INSTALL.md) 的"四b、项目本地安装流程"章节。
