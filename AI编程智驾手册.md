# AI编程智驾手册

## AI Programming Autopilot

## **版本**：v1.3（完整版）

> 本文档供 AI 阅读并完整执行。目标：在全新环境（可能只有任一 AI 编程工具）上，从零搭建完整的 AI 编程工作台。
> 支持 Windows 和 Linux，自动检测平台并使用对应命令。
> 你（AI）按顺序执行每个步骤即可，无需用户手动操作（除 Token 配置需要用户介入）。
>
> **v1.3 新增**：RTK Token 节省工具、gspowers TDD 扩展、gspowers Pipeline 多模块流水线开发

---

## 零、AI编程智驾框架特性

> **一句话定位**：让 AI 自动驾驶编程全流程，从环境搭建到代码交付，零手动干预。

### 核心特性

| # | 特性                          | 说明                                               |
| - | ----------------------------- | -------------------------------------------------- |
| 1 | **Claude 自动驾驶**     | Claude Code + Yolo 模式，AI 自主决策，无需频繁确认 |
| 2 | **gspowers SOP 导航**   | 行业共识的技能规则框架，标准化开发流程             |
| 3 | **ruflo 多 Agent 并行** | 打通会话记忆，多 Agent 并行/接力执行               |
| 4 | **RTK Token 节省**      | 节省 60-90% Token 消耗，成本大幅降低               |
| 5 | **markitdown 万物可读** | Markdown/HTML/文档互转，任何格式都能处理           |
| 6 | **TDD 测试先行**        | 强制测试先行模式，质量有保障                       |
| 7 | **通用三方协作**        | 货比三家，多角度评审，决策更全面                   |
| 8 | **Pipeline 流水线**     | 复杂任务分模块分步骤，依赖自动编排，批量验证       |

### 详细说明

#### 1. Claude 自动驾驶

```
传统模式：用户 → 确认 → 执行 → 确认 → ...
自动驾驶：用户 → AI 自主完成 → 汇报结果
```

Claude Code 开启 Yolo 模式后，AI 可以自动执行文件操作、终端命令，自动处理弹窗、异常，遇到问题自行解决。

#### 2. gspowers SOP 导航

```
/gspowers → /office-hours → /plan-eng-review → /brainstorm → /subagent-dev → /review → /ship
```

每个步骤都有明确的产出物和验收标准。

#### 3. ruflo 多 Agent 并行

- **并行**：同一任务，多 Agent 从不同角度同时执行
- **接力**：上一 Agent 输出作为下一 Agent 输入
- **记忆**：跨会话记忆，知识不丢失

#### 4. RTK Token 节省

| 操作              | 普通消耗 | RTK 消耗 | 节省 |
| ----------------- | -------- | -------- | ---- |
| `ls` / `tree` | 2,000    | 400      | -80% |
| `npm test`      | 25,000   | 2,500    | -90% |

#### 5. markitdown 万物可读

Markdown/HTML/文档互转，任何格式都能转成 AI 易读的格式。

#### 6. TDD 测试先行

```
RED → GREEN → REFACTOR
先写测试 → 写实现让测试通过 → 重构优化
```

#### 7. 通用三方协作

```
triple 安全审计
├── Agent-A: 代码安全扫描
├── Agent-B: 依赖漏洞检查
└── Agent-C: 配置风险评估
```

#### 8. Pipeline 流水线

```
场景：电商系统
├── 用户服务（无依赖）
├── 商品服务（依赖用户服务）
├── 订单服务（依赖用户服务 + 商品服务）
└── 支付服务（依赖订单服务）

流水线自动批次执行 + 门控验证
```

### 快速触发词

| 触发词                   | 功能              |
| ------------------------ | ----------------- |
| `/gspowers`            | 启动 SOP 流程导航 |
| `/pipeline-dev`        | 多模块流水线开发  |
| `安全审计`             | 多 Agent 安全扫描 |
| `triple [任务]`        | 通用三方协作      |
| `TDD`                  | 启用测试先行模式  |
| `允许 AI 自动扩充技能` | 授权 AI 扩展功能  |

---

### 任务索引表

| 章节   | 主题                      | 说明                                           |
| ------ | ------------------------- | ---------------------------------------------- |
| 一     | 环境检测与安装策略        | 平台检测、熔断机制、工具检测清单               |
| 二     | 平台适配命令参考          | Windows/Linux 命令差异、网络自适应             |
| 三     | 自动安装流程              | 步骤 0-8，完整安装流程（含 MiniMax、RTK 配置） |
| 四     | 新项目使用流程            | ruflo 初始化、快速启动                         |
| 五     | 功能触发速查              | 触发词速查表                                   |
| 六     | 记忆共享说明              | 全局/项目级记忆、Agent 共享                    |
| 七     | 故障排除                  | 常见问题解决                                   |
| 八     | AI 执行清单               | 完整安装流程汇总                               |
| 九     | 目录结构                  | ~/.claude 目录规划                             |
| 十     | AI IDE 的角色             | Trae + Claude Code 协作                        |
| 十一   | 快速参考                  | 常用命令速查                                   |
| 十二   | 版本兼容性说明            | 工具版本要求                                   |
| 十三   | 上下文压缩与 Wiki 生成    | 长对话压缩、项目知识沉淀                       |
| 十四   | gspowers TDD 扩展         | 测试先行开发模式                               |
| 十五   | AI 自动化技能扩充         | 技能自动扩展（需授权）                         |
| 十六   | 一键完整安装脚本          | AI 自动执行安装                                |
| 十七   | 用户授权声明              | 授权范围说明                                   |
| 十八   | MasterGo 原型解析         | Browser Harness 原型转 PRD/Spec                |
| 十九   | 完整触发词速查            | 所有触发词汇总                                 |
| 二十   | 最终说明                  | 文档使用说明                                   |
| 二十一 | gspowers 多模块流水线扩展 | Pipeline 开发模式（改造点B）                   |

### 核心原则：自愈式控制（Self-Healing）

AI 执行任务时，遇到缺工具、页面变化、异常情况，**不要中断**，而是：

```
1. 缺工具 → AI 直接编写/编辑工具脚本继续运行
2. 页面变 → AI 重新 snapshot -i 识别新元素
3. 弹窗/异常 → AI 自动 dialog-accept/handle
4. 失败不中断 → 分析原因，修复后继续执行
```

**传统自动化** vs **自愈式控制**：

| 传统自动化   | 自愈式控制            |
| ------------ | --------------------- |
| 页面一变就崩 | AI 动态适配，继续运行 |
| 维护成本高   | AI 自主修复，无需人工 |
| 人工干预多   | Agent 自主决策        |

**关键转变**：从「命令驱动」到「目标驱动」。AI 记住目标，遇到障碍自行解决，不等待人工。

---

## 一、环境检测与安装策略

> **跨平台兼容性**：如果你不是 Claude Code，请使用当前环境支持的 Terminal/Bash 权限执行后续脚本。Cursor、Cline 等工具均可通用。

### 1.1 执行原则

```
1. 先检测环境中已有什么（自动检测 Windows/Linux/macOS）
2. 缺少什么就安装什么（使用平台对应的命令）
3. Token 配置需要用户确认，其他全部自动执行
4. 根据平台选择正确的命令（PowerShell/bash）
5. 遇到缺工具/异常 → 自愈式控制，AI 自己修复继续运行
6. 优先使用本地 Ollama 模型进行环境检测、文件读写等低逻辑任务，只有在复杂架构设计或审计时才调用 Claude Code
7. 如果网络请求失败，自动切换至中国区镜像源（npmmirror/阿里云）
```

### 1.2 平台检测

```powershell
# 检测操作系统
if ($IsWindows -or $env:OS -eq "Windows_NT") {
    $PLATFORM = "windows"
    $SHELL = "powershell"
} elseif ($IsLinux -or (Test-Path "/proc/version")) {
    $PLATFORM = "linux"
    $SHELL = "bash"
} elseif ($IsMacOS) {
    $PLATFORM = "macos"
    $SHELL = "bash"
    $PACKAGE_MANAGER = "brew"
} else {
    $PLATFORM = "unknown"
}

# 检测 macOS
if ($IsMacOS) { $PLATFORM = "macos"; $SHELL = "bash"; $PACKAGE_MANAGER = "brew" }

Write-Host "检测到平台: $PLATFORM ($SHELL)"
```

### 1.3 熔断机制

```powershell
# 熔断机制：当操作失败 MAX_RETRY 次时自动切换策略
$MAX_RETRY = 3
$retryCount = 0
$currentSource = "primary"

function Invoke-WithCircuitBreaker {
    param(
        [string]$operation,
        [scriptblock]$primaryAction,
        [scriptblock]$fallbackAction
    )

    $retryCount = 0
    $currentSource = "primary"

    while ($retryCount -lt $MAX_RETRY) {
        try {
            return & $primaryAction
        } catch {
            $retryCount++
            if ($retryCount -ge $MAX_RETRY) {
                Write-Host "[熔断] 主源失败，切换至镜像源..."
                $currentSource = "mirror"
                return & $fallbackAction
            }
        }
    }
}

# 使用示例：网络请求失败自动切换镜像源
$npmSource = Invoke-WithCircuitBreaker -operation "npm install" `
    -primaryAction { npm install $package } `
    -fallbackAction { npm install $package --registry=https://registry.npmmirror.com }
```

### 1.4 检测清单

| 工具        | Windows 检测                       | Linux 检测                         | 用途             |
| ----------- | ---------------------------------- | ---------------------------------- | ---------------- |
| Claude Code | `claude --version`               | `claude --version`               | 主要 AI 编程界面 |
| Git         | `git --version`                  | `git --version`                  | 克隆仓库         |
| Node.js     | `node --version`                 | `node --version`                 | 运行 ruflo       |
| npm         | `npm --version`                  | `npm --version`                  | 安装全局包       |
| ruflo       | `claude-flow --version`          | `claude-flow --version`          | 多 Agent + 记忆  |
| gspowers    | 检查 `~/.claude/skills/gspowers` | 检查 `~/.claude/skills/gspowers` | SOP 流程         |

---

## 二、平台适配命令参考

### 2.1 Windows (PowerShell)

```powershell
# 安装工具
npm install -g ruflo

# 中国区网络自适应：检测 npm 是否慢，自动切换镜像
npm config get registry  # 检查当前源
# 如果检测到网络慢，执行：
# npm config set registry https://registry.npmmirror.com

winget install -e --id Git.Git

# 路径格式
$home = $env:USERPROFILE
$projectDir = "D:\projects\my-app"

# 环境变量
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine")
```

### 2.2 Linux (bash)

```bash
# 安装工具
npm install -g ruflo
sudo apt-get install git   # 或 yum/dnf

# 路径格式
home=~
project_dir="~/projects/my-app"

# 环境变量
export PATH="$PATH:/usr/local/bin"
```

---

## 三、自动安装流程

### 网络自适应检测

> 在中国区网络环境下，npm 和 git 可能访问缓慢，自动检测并切换镜像源

```powershell
# ═══════════════════════════════════════════════════════════
# 网络自适应检测脚本
# ═══════════════════════════════════════════════════════════

# npm 镜像检测与切换
function Test-NpmMirror {
    $currentRegistry = npm config get registry
    Write-Host "当前 npm 源: $currentRegistry"

    # 测试 npm 官方源速度
    $testResult = Measure-Command {
        try {
            npm view npm version --registry=https://registry.npmjs.org 2>$null
        } catch { }
    }

    if ($testResult.TotalMilliseconds -gt 3000) {
        Write-Host "[警告] npm 官方源响应缓慢（$($testResult.TotalMilliseconds)ms），建议切换镜像"
        Write-Host "执行切换: npm config set registry https://registry.npmmirror.com"
        npm config set registry https://registry.npmmirror.com
        Write-Host "[已切换] npm 镜像源: $(npm config get registry)"
    } else {
        Write-Host "[正常] npm 官方源响应良好（$($testResult.TotalMilliseconds)ms）"
    }
}

# git 镜像检测与切换（适用于中国区）
function Test-GitMirror {
    # 测试 GitHub 连接速度
    $testUrl = "https://github.com"
    $testResult = Measure-Command {
        try {
            Invoke-WebRequest -Uri $testUrl -TimeoutSec 5 -UseBasicParsing 2>$null
        } catch { }
    }

    if ($testResult.TotalMilliseconds -gt 5000 -or $null -eq $testResult) {
        Write-Host "[警告] GitHub 访问缓慢，建议配置镜像"
        # 配置 GitHub 镜像（gitee 同步）
        git config --global url."https://gitee.com/".insteadOf "https://github.com/"
        Write-Host "[已配置] GitHub 镜像: gitee.com"
    } else {
        Write-Host "[正常] GitHub 连接良好（$($testResult.TotalMilliseconds)ms）"
    }
}

# 执行检测
Write-Host "═" * 60
Write-Host "网络自适应检测"
Write-Host "═" * 60
Test-NpmMirror
Test-GitMirror
Write-Host "═" * 60
```

**镜像源参考：**

| 服务    | 官方源                     | 中国区镜像                          |
| ------- | -------------------------- | ----------------------------------- |
| npm     | https://registry.npmjs.org | https://registry.npmmirror.com      |
| GitHub  | https://github.com         | https://gitee.com (镜像同步)        |
| Node.js | https://nodejs.org         | https://npm.taobao.org/mirrors/node |

### 步骤 0：环境检测

执行以下检测，记录缺少什么：

```powershell
# ═══════════════════════════════════════════════════════════
# 环境检测脚本（Windows PowerShell / Linux bash 通用）
# ═══════════════════════════════════════════════════════════

$results = @{}

# 检测 Claude Code
if (Get-Command claude -ErrorAction SilentlyContinue) {
    $results["Claude Code"] = "found"
} else {
    $results["Claude Code"] = "missing"
}

# 检测 Git
if (Get-Command git -ErrorAction SilentlyContinue) {
    $results["Git"] = "found"
} else {
    $results["Git"] = "missing"
}

# 检测 Node.js
if (Get-Command node -ErrorAction SilentlyContinue) {
    $results["Node.js"] = "found"
} else {
    $results["Node.js"] = "missing"
}

# 检测 npm
if (Get-Command npm -ErrorAction SilentlyContinue) {
    $results["npm"] = "found"
} else {
    $results["npm"] = "missing"
}

# 检测 ruflo
if (Get-Command claude-flow -ErrorAction SilentlyContinue) {
    $results["ruflo"] = "found"
} else {
    $results["ruflo"] = "missing"
}

# 输出检测结果
Write-Host "检测结果:" -ForegroundColor Cyan
foreach ($key in $results.Keys) {
    $status = if ($results[$key] -eq "found") { "✓" } else { "✗" }
    Write-Host "  $status $key"
}
```

Linux (bash) 版本：

```bash
#!/bin/bash
# 检测脚本

check_command() {
    if command -v $1 &> /dev/null; then
        echo "✓ $1"
    else
        echo "✗ $1"
    fi
}

echo "检测结果:"
check_command claude
check_command git
check_command node
check_command npm
check_command claude-flow
```

---

### 步骤 1：安装缺失基础工具

#### 1.1 安装 Git（如缺失）

```powershell
# 检查是否有 winget
if (Get-Command winget -ErrorAction SilentlyContinue) {
    winget install -e --id Git.Git --silent --accept-package-agreements --accept-source-agreements
} elseif (Get-Command choco -ErrorAction SilentlyContinue) {
    choco install git -y
} else {
    # 手动下载安装
    Write-Host "[需要用户介入] 请手动下载并安装 Git: https://git-scm.com/download/win"
}

# 刷新环境变量
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
```

#### 1.2 安装 Node.js（如缺失）

```powershell
if (Get-Command winget -ErrorAction SilentlyContinue) {
    winget install -e --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
} else {
    Write-Host "[需要用户介入] 请手动安装 Node.js: https://nodejs.org/"
}
```

#### 1.3 安装 Bun（如缺失，可选但推荐）

```powershell
if (Get-Command bun -ErrorAction SilentlyContinue) {
    Write-Host "Bun 已安装"
} else {
    irm bun.sh/install.ps1 | iex
}
```

---

### 步骤 2：安装 Claude Code（如缺失）

> Claude Code 是主要界面。如果用户有其他 AI 编程工具（如 Trae、Doubao），也可以直接使用，但本文档以 Claude Code 为例。

```powershell
if (Get-Command claude -ErrorAction SilentlyContinue) {
    Write-Host "Claude Code 已安装"
} else {
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        # Claude Code 可能不在 winget 仓库，手动安装
        Write-Host "正在安装 Claude Code..."
        irm https://claude.ai/install.ps1 | iex
    } else {
        Write-Host "[需要用户介入] 请手动安装 Claude Code: https://claude.ai/code"
    }
}
```

---

### 步骤 3：配置 Claude Code API Token

> **唯一需要用户介入的步骤**

```powershell
# 检查是否有 ANTHROPIC_API_KEY 或 CLAUDE_CODE_API_KEY
if ($env:ANTHROPIC_API_KEY -or $env:CLAUDE_CODE_API_KEY) {
    Write-Host "API Token 已配置"
} else {
    Write-Host "[需要用户介入] 请在 Claude Code 中运行: /config set api-key"
    Write-Host "或者设置环境变量: $env:ANTHROPIC_API_KEY='your-key'"
}
```

### 步骤 3.1：MiniMax 成功配置案例（已验证）

> **以下配置经过实际验证**，适用于 MiniMax API。如果使用其他 API 请调整对应字段。

#### 配置文件路径

| 平台        | 路径                                          |
| ----------- | --------------------------------------------- |
| Windows     | `C:\Users\你的用户名\.claude\settings.json` |
| Linux/macOS | `~/.claude/settings.json`                   |

#### 成功配置模板

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.minimaxi.com/anthropic",
    "ANTHROPIC_AUTH_TOKEN": "用户提供的Token",
    "ANTHROPIC_MODEL": "MiniMax-M2.7",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1",
    "API_TIMEOUT_MS": "3000000"
  },
  "permissions": {
    "defaultMode": "bypassPermissions"
  },
  "theme": "light",
  "hasCompletedOnboarding": true,
  "skipDangerousModePermissionPrompt": true
}
```

#### 字段说明

| 字段                                         | 说明                     | 注意事项                                    |
| -------------------------------------------- | ------------------------ | ------------------------------------------- |
| `ANTHROPIC_BASE_URL`                       | MiniMax API 端点         | **必须填**，不能用官方 Anthropic 地址 |
| `ANTHROPIC_AUTH_TOKEN`                     | 用户自己的 MiniMax Token | 向 MiniMax 服务商获取                       |
| `ANTHROPIC_MODEL`                          | 模型名称                 | 使用 `MiniMax-M2.7`                       |
| `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` | 减少非必要流量           | 设为 `"1"`                                |
| `API_TIMEOUT_MS`                           | API 超时（毫秒）         | `3000000` = 5 分钟                        |
| `permissions.defaultMode`                  | 权限模式                 | `bypassPermissions` = 跳过所有确认        |
| `skipDangerousModePermissionPrompt`        | 跳过危险模式提示         | `true`                                    |

#### Windows 创建配置

```powershell
# 创建目录
$claudeDir = "$env:USERPROFILE\.claude"
if (!(Test-Path $claudeDir)) { New-Item -ItemType Directory -Force -Path $claudeDir }

# 写入配置（请替换 YOUR_TOKEN_HERE 为你的真实 Token）
$config = @{
    env = @{
        ANTHROPIC_BASE_URL = "https://api.minimaxi.com/anthropic"
        ANTHROPIC_AUTH_TOKEN = "YOUR_TOKEN_HERE"
        ANTHROPIC_MODEL = "MiniMax-M2.7"
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = "1"
        API_TIMEOUT_MS = "3000000"
    }
    permissions = @{ defaultMode = "bypassPermissions" }
    theme = "light"
    hasCompletedOnboarding = $true
    skipDangerousModePermissionPrompt = $true
}

$config | ConvertTo-Json -Depth 10 | Out-File -FilePath "$claudeDir\settings.json" -Encoding UTF8

Write-Host "✅ MiniMax 配置已创建: $claudeDir\settings.json"
```

#### 验证配置

```powershell
# 验证配置是否正确
$settings = Get-Content "$env:USERPROFILE\.claude\settings.json" | ConvertFrom-Json
Write-Host "当前模型: $($settings.env.ANTHROPIC_MODEL)"
Write-Host "API 端点: $($settings.env.ANTHROPIC_BASE_URL)"
```

#### 常见错误

| 错误现象             | 原因                | 解决方法                                                   |
| -------------------- | ------------------- | ---------------------------------------------------------- |
| `401 Unauthorized` | Token 无效或过期    | 检查 `ANTHROPIC_AUTH_TOKEN` 是否正确                     |
| `403 Forbidden`    | Base URL 错误       | 确认使用 `https://api.minimaxi.com/anthropic`            |
| 连接超时             | 网络问题或 URL 错误 | 检查 Base URL 拼写，确认为 `minimaxi` 不是 `anthropic` |
| 模型不支持           | 模型名错误          | 使用 `MiniMax-M2.7`（不要用 `claude-` 前缀）           |

---

### 步骤 3.2：安装 markitdown（MCP 文档转换工具）

> markitdown 可以将 Markdown 转换为 HTML/其他格式，用于文档处理

```powershell
# 安装 markitdown MCP
npx -y @digipair/skill-markitdown

# 添加到 Claude Code
claude mcp add markitdown -- npx -y @digipair/skill-markitdown

# 验证
claude mcp list
```

**markitdown 功能说明**：

| 功能             | 说明                |
| ---------------- | ------------------- |
| Markdown 转 HTML | 将 MD 文件转为 HTML |
| GitHub 风格表格  | 支持 GFM 表格       |
| 代码高亮         | 自动识别代码块语言  |

---

### 步骤 3.3：安装 RTK（Token 节省工具）

> RTK（Rust Token Killer）是一个高性能 CLI 代理，通过过滤和压缩命令输出，可节省 60-90% 的 token 消耗

#### 安装方式（Windows）

```powershell
# 下载最新版本
curl -sL "https://github.com/rtk-ai/rtk/releases/download/v0.37.2/rtk-x86_64-pc-windows-msvc.zip" -o $env:TEMP\rtk.zip
Expand-Archive -Path $env:TEMP\rtk.zip -DestinationPath $env:TEMP\rtk -Force
# 安装到用户目录
$binDir = "$env:USERPROFILE\.local\bin"
if (!(Test-Path $binDir)) { New-Item -ItemType Directory -Force -Path $binDir }
Move-Item "$env:TEMP\rtk\rtk.exe" "$binDir\rtk.exe"
# 验证
& "$binDir\rtk.exe" --version
```

#### 初始化（全局 Hook）

```powershell
# 初始化并自动修补 settings.json
& "$env:USERPROFILE\.local\bin\rtk.exe" init -g --auto-patch

# 验证安装
& "$env:USERPROFILE\.local\bin\rtk.exe" gain
```

#### Token 节省效果

| 操作                          | 频率 | 普通消耗           | RTK 消耗          | 节省           |
| ----------------------------- | ---- | ------------------ | ----------------- | -------------- |
| `ls` / `tree`             | 10x  | 2,000              | 400               | -80%           |
| `git status`                | 10x  | 3,000              | 600               | -80%           |
| `git diff`                  | 5x   | 10,000             | 2,500             | -75%           |
| `cargo test` / `npm test` | 5x   | 25,000             | 2,500             | -90%           |
| `grep` / `rg`             | 8x   | 16,000             | 3,200             | -80%           |
| **总计**                |      | **~118,000** | **~23,900** | **-80%** |

#### 工作原理

```
Claude Code          settings.json        rtk-rewrite.sh        RTK binary
     │                    │                     │                    │
     │  "git status"      │                     │                    │
     │ ──────────────────►│                     │                    │
     │                    │  PreToolUse trigger  │                    │
     │                    │ ───────────────────►│                    │
     │                    │                     │  rewrite command   │
     │                    │                     │  → rtk git status  │
     │                    │◄────────────────────│                    │
     │                    │  updated command     │                    │
     │  execute: rtk git status                                      │
     │ ─────────────────────────────────────────────────────────────►│
     │                                                               │  filter
     │  "3 modified, 1 untracked ✓"                                  │
     │◄──────────────────────────────────────────────────────────────│
```

#### 命令速查

| 命令                   | 说明                                |
| ---------------------- | ----------------------------------- |
| `rtk gain`           | 显示 token 节省统计                 |
| `rtk gain --history` | 显示命令使用历史                    |
| `rtk discover`       | 分析 Claude Code 历史，发现节省机会 |
| `rtk proxy <cmd>`    | 直接执行命令（不过滤，用于调试）    |

#### ⚠️ AI 必读：npm 上的 rtk-cli 是同名错误包

```
AI 执行此处时必须严格遵循以下安装方式，禁止使用 npm install -g rtk
```

**npm 上有一个叫 `rtk-cli` 的包，它是 Static Site Generator (ssg)，跟 token 节省毫无关系！**

**正确的 RTK (Rust Token Killer) 必须从 GitHub 下载二进制：**

- GitHub: https://github.com/rtk-ai/rtk
- 下载地址: https://github.com/rtk-ai/rtk/releases/latest
- 包名格式: `rtk-x86_64-pc-windows-msvc.zip` (Windows)

**禁止**：

```powershell
npm install -g rtk        # 错误！这是 ssg，不是 token 节省工具
npm install -g rtk-cli     # 同样是错误的 ssg 工具
```

**正确安装方式**：

```powershell
# 从 GitHub 下载（见上方安装方式）
```

**验证方法**：

```powershell
rtk gain        # 显示 "RTK Token Savings" 即为正确
rtk --version   # 显示 rtk 0.37.2 即为正确（不是 rtk-cli/0.0.1）
```

#### 注意事项

- **名称冲突**：npm 上的 `rtk-cli` (ssg) 与 `rtk-ai/rtk` 重名但功能完全不同
- **Windows**：使用 Windows Terminal 或 PowerShell 运行，不要直接双击 .exe
- **重启 Claude Code**：初始化后需要重启才能加载 hook

---

### 步骤 3.5：配置 Claude Code 权限模式（Yolo 模式）

> 开启后，AI 执行命令不再逐个询问权限，全部自动同意

```powershell
# 方法 1：通过 Claude Code 命令配置
claude config set allowPermissions true

# 方法 2：直接编辑配置文件
# Windows
$settingsPath = "$env:APPDATA\Claude\settings.json"
# Linux
# settingsPath="$HOME/.config/Claude/settings.json"

# 添加或修改
@{
    "allowPermissions": true
} | ConvertTo-Json -Depth 10

# 方法 3：PowerShell 一键配置（推荐）
claude config set allowPermissions true
```

**效果**：AI 执行任务时，所有 Bash/MCP 操作默认同意，不再弹出权限询问。

**安全分级**：

| 等级                   | 适用场景             | 风险等级 | 说明                                  |
| ---------------------- | -------------------- | -------- | ------------------------------------- |
| **L1 观察模式**  | 新项目/陌生代码      | 低       | allowPermissions=false，逐项确认      |
| **L2 开发模式**  | 日常开发/调试        | 中       | allowPermissions=true，敏感操作需确认 |
| **L3 Yolo 模式** | 快速原型/实验性项目  | 高       | allowPermissions=true，全部自动同意   |
| **L4 受控 Yolo** | 信任的代码库 + CI/CD | 中       | allowPermissions=true + 审计日志      |

---

### 步骤 4：安装 ruflo（多 Agent + 记忆管理）

```powershell
# 安装 ruflo 全局
npm install -g ruflo

# 验证
claude-flow --version

# 添加 ruflo MCP 到 Claude Code（全局生效，所有项目共享）
claude mcp add ruflo -- npx -y ruflo@latest mcp start

# 验证 MCP
claude mcp list
```

---

### 步骤 5：创建全局 ruflo 配置

```powershell
# 创建全局配置目录（Windows）
$globalDir = "$env:USERPROFILE\.claude-flow"
if (!(Test-Path $globalDir)) { New-Item -ItemType Directory -Force -Path $globalDir }

# Linux 版本
# globalDir="$HOME/.claude-flow"
# mkdir -p "$globalDir"

# 创建全局配置
# 说明：全局配置让 ruflo 命令从任意目录都可执行
# 记忆按项目隔离（defaultScope: project），避免全局记忆过于庞大
$configContent = @"
version: "3.0.0"

memory:
  backend: hybrid
  enableHNSW: true
  persistPath: `~/.claude-flow/data
  cacheSize: 500
  learningBridge:
    enabled: true
    sonaMode: balanced
  memoryGraph:
    enabled: true
    similarityThreshold: 0.75

swarm:
  topology: hierarchical-mesh
  maxAgents: 5
  autoScale: true
  coordinationStrategy: consensus

hooks:
  enabled: true
  autoExecute: true

mcp:
  autoStart: true
  port: 3000

agentScopes:
  enabled: true
  defaultScope: project   # 记忆按项目隔离（推荐）

EOF
"@

# Windows 写入
$configContent | Out-File -FilePath "$globalDir\config.yaml" -Encoding UTF8

# Linux 写入
# cat > "$globalDir/config.yaml" << 'EOF'
# ... 内容同上 ...
# EOF

# 创建记忆存储目录
if (!(Test-Path "$globalDir\data")) { New-Item -ItemType Directory -Force -Path "$globalDir\data" }

Write-Host "全局 ruflo 配置完成"
Write-Host "  配置目录: $globalDir"
Write-Host "  记忆目录: $globalDir\data"
Write-Host ""
Write-Host "注意：ruflo 命令从任意目录都可执行（全局安装）"
Write-Host "      每个新项目需要运行: ruflo init --minimal --skip-claude"
Write-Host "      （创建项目级 .claude-flow/ 目录，记忆隔离）"
```

### 步骤 5b：Linux 版本的全局配置

```bash
# Linux/macOS 全局配置
globalDir="$HOME/.claude-flow"
mkdir -p "$globalDir/data"

cat > "$globalDir/config.yaml" << 'EOF'
version: "3.0.0"

memory:
  backend: hybrid
  enableHNSW: true
  persistPath: ~/.claude-flow/data
  cacheSize: 500
  learningBridge:
    enabled: true
    sonaMode: balanced

swarm:
  topology: hierarchical-mesh
  maxAgents: 5
  autoScale: true

hooks:
  enabled: true
  autoExecute: true

mcp:
  autoStart: true
  port: 3000

agentScopes:
  enabled: true
  defaultScope: project   # 记忆按项目隔离
EOF

echo "全局 ruflo 配置完成: $globalDir"
```

---

### 步骤 7：安装 gspowers（依赖 gstack + superpowers）

#### 6.1 安装 gstack

```powershell
# 创建 skills 目录
$skillsDir = "$env:USERPROFILE\.claude\skills"
if (!(Test-Path $skillsDir)) { New-Item -ItemType Directory -Force -Path $skillsDir }

# 克隆 gstack（如果不存在）
$gstackDir = "$skillsDir\gstack"
if (!(Test-Path $gstackDir)) {
    # 中国区镜像: git clone https://ghproxy.com/https://github.com/garrytan/gstack.git $gstackDir
    git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git $gstackDir
    # 执行 gstack setup
    if (Test-Path "$gstackDir\setup") {
        & "$gstackDir\setup"
    }
}

Write-Host "gstack 安装完成"
```

#### 6.2 安装 superpowers

```powershell
# superpowers 是 Claude Code 的 plugin，通过命令安装
# 需要用户在 Claude Code 中执行：
Write-Host "[需要用户介入] 请在 Claude Code 中执行以下命令安装 superpowers:"
Write-Host "  /plugin install superpowers@claude-plugins-official"
Write-Host ""
Write-Host "如果 AI 正在 Claude Code 环境中，可以直接调用该命令"
```

#### 6.3 安装 gspowers

```powershell
# 克隆 gspowers
$gspowersDir = "$env:USERPROFILE\.claude\skills\gspowers"
if (!(Test-Path $gspowersDir)) {
    # 中国区镜像: git clone https://ghproxy.com/https://github.com/fshaan/gspowers.git $gspowersDir
    git clone https://github.com/fshaan/gspowers.git $gspowersDir
}

Write-Host "gspowers 安装完成"
Write-Host "  安装目录: $gspowersDir"
```

---

### 步骤 8：安装验证

```powershell
# 验证所有组件
Write-Host ""
Write-Host "═" * 60
Write-Host "安装验证"
Write-Host "═" * 60

$components = @(
    @{Name="Git"; Cmd="git --version"},
    @{Name="Node.js"; Cmd="node --version"},
    @{Name="ruflo"; Cmd="claude-flow --version"},
    @{Name="gstack"; Path="$env:USERPROFILE\.claude\skills\gstack"},
    @{Name="gspowers"; Path="$env:USERPROFILE\.claude\skills\gspowers"}
)

foreach ($comp in $components) {
    if ($comp.Cmd) {
        try {
            $result = Invoke-Expression $comp.Cmd 2>$null
            Write-Host "  ✓ $($comp.Name): $result"
        } catch {
            Write-Host "  ✗ $($comp.Name): 未找到"
        }
    } elseif ($comp.Path) {
        if (Test-Path $comp.Path) {
            Write-Host "  ✓ $($comp.Name): 已安装"
        } else {
            Write-Host "  ✗ $($comp.Name): 未找到"
        }
    }
}

# 检查 MCP
try {
    $mcpList = claude mcp list 2>$null
    if ($mcpList -match "ruflo") {
        Write-Host "  ✓ ruflo MCP: 已注册"
    } else {
        Write-Host "  ✗ ruflo MCP: 未注册"
    }
} catch {
    Write-Host "  ✗ ruflo MCP: 检查失败"
}

Write-Host ""
Write-Host "═" * 60
Write-Host "✅ 安装完成！"
Write-Host "═" * 60
Write-Host ""
Write-Host "下一步："
Write-Host "  1. 在项目目录运行: ruflo init --minimal --skip-claude"
Write-Host "  2. 打开 Claude Code 开始编程"
Write-Host "  3. 说 '安全审计' 或 '/gspowers' 启动工作流"
```

---

## 四、新项目使用流程

> 每个新项目只需执行一次初始化

### 在新项目目录执行

```powershell
cd D:\your-new-project

# 初始化 ruflo（每个新项目做一次）
ruflo init --minimal --skip-claude

# 打开 Claude Code
claude
```

### 验证记忆共享

在 Claude Code 中测试：

```
> 安全审计
> 架构评审
> /gspowers
> triple [任意任务]
```

---

## 五、功能触发速查

| 你说的话                    | 触发的工作                       | 来源     |
| --------------------------- | -------------------------------- | -------- |
| `安全审计`                | 多 Agent 安全漏洞扫描 + 三方对抗 | ruflo    |
| `架构评审`                | 多 Agent 系统架构评估 + 三方对抗 | ruflo    |
| `QA团队` / `测试评审`   | 多 Agent 测试质量评审 + 三方对抗 | ruflo    |
| `三方调研` / `research` | 多 Agent 通用研究任务            | ruflo    |
| `triple [任务]`           | 通用三方协作（任意任务）         | ruflo    |
| `/gspowers`               | 启动 SOP 流程导航                | gspowers |
| `/office-hours`           | YC 式产品拷问                    | gspowers |
| `/brainstorm`             | 苏格拉底式设计细化               | gspowers |
| `/subagent-dev`           | 子代理 TDD 开发                  | gspowers |
| `/review`                 | 代码审查                         | gspowers |
| `/qa`                     | 浏览器 QA                        | gspowers |
| `/ship`                   | 发布 PR                          | gspowers |

---

## 六、记忆共享说明

### 5.1 记忆层级

```
全局记忆 (~/.claude-flow/data/)
    ↓
项目级记忆 (.claude-flow/data/)
    ↓
Agent 共享（在同一个项目内的 agents 共享记忆）
```

### 5.2 同项目内 Agent 共享记忆

当 `agentScopes.defaultScope: project` 时，同一项目启动的所有 Agent 共享该项目内的记忆上下文。不同项目间记忆隔离，避免全局记忆过于庞大。

```yaml
# ~/.claude-flow/config.yaml
agentScopes:
  enabled: true
  defaultScope: project  # 记忆按项目隔离（推荐）
```

### 5.3 手动记忆操作

```bash
# 存储记忆
claude-flow mcp exec --tool memory_store --args '{"key":"key-name","value":"内容","tags":["标签"]}'

# 搜索记忆
claude-flow mcp exec --tool memory_search --args '{"query":"关键词","limit":3}'

# 列出所有记忆
claude-flow mcp exec --tool memory_list
```

---

## 七、故障排除

### 问题：某个工具检测不到

```powershell
# 刷新环境变量
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# 手动刷新
refreshenv 2>$null || Write-Host "请重新打开终端"
```

### 问题：ruflo MCP 不工作

```powershell
# 重启 MCP
claude mcp remove ruflo
claude mcp add ruflo -- npx -y ruflo@latest mcp start

# 检查状态
claude mcp list
```

### 问题：gspowers 找不到

```powershell
# 检查目录
Get-ChildItem "$env:USERPROFILE\.claude\skills" -Directory
```

---

## 八、AI 执行清单

> 以下是 AI 完整执行顺序，确保每步成功后再执行下一步
>
> **版本**：v1.3（完整版，包含 RTK、TDD、Pipeline 扩展）

```powershell
# ═══════════════════════════════════════════════════════════════
# Claude × gspowers × ruflo 金手指 - 完整安装流程
# AI 按顺序执行，无需用户介入（除 Token 配置和 superpowers 安装）
# ═══════════════════════════════════════════════════════════════

# ═══════════════════════════════════════════════════════════════
# 阶段一：环境准备
# ═══════════════════════════════════════════════════════════════

# [步骤 0] 检测环境
# 执行第一章的检测脚本，检测：
# - Claude Code、Git、Node.js、npm、ruflo 是否存在
# - 网络速度，自动切换镜像源（npm/GitHub）

# [步骤 1] 安装缺失工具
if (Git 不存在):
    winget install Git.Git
if (Node.js 不存在):
    winget install OpenJS.NodeJS.LTS
# 可选：Bun（推荐）
if (Bun 不存在):
    irm bun.sh/install.ps1 | iex

# ═══════════════════════════════════════════════════════════════
# 阶段二：核心安装
# ═══════════════════════════════════════════════════════════════

# [步骤 2] 安装 Claude Code（如缺失）
if (claude 命令不存在):
    irm https://claude.ai/install.ps1 | iex

# [步骤 3] 配置 API Token
# [需要用户介入] 提示用户在 Claude Code 中配置 Token
# 或使用模板创建 settings.json：
# 模板文件: templates/settings.json.template
# 目标位置: $env:USERPROFILE\.claude\settings.json
# 注意: 将 YOUR_TOKEN_HERE 替换为你的实际 Token

# [步骤 3.1] 安装 markitdown（MCP 文档转换工具）
npm install -g @digipair/skill-markitdown
claude mcp add markitdown -- npx -y @digipair/skill-markitdown

# [步骤 3.2] 安装 RTK（Token 节省工具，节省 60-90% token）
# 下载 RTK
curl -sL "https://github.com/rtk-ai/rtk/releases/download/v0.37.2/rtk-x86_64-pc-windows-msvc.zip" -o $env:TEMP\rtk.zip
Expand-Archive -Path $env:TEMP\rtk.zip -DestinationPath $env:TEMP\rtk -Force
# 安装到用户目录
$binDir = "$env:USERPROFILE\.local\bin"
New-Item -ItemType Directory -Force -Path $binDir
Move-Item "$env:TEMP\rtk\rtk.exe" "$binDir\rtk.exe"
# 初始化并自动修补 settings.json
& "$binDir\rtk.exe" init -g --auto-patch
# 验证
& "$binDir\rtk.exe" gain

# [步骤 3.3] 配置 Claude Code 权限模式（Yolo 模式）
# 在 settings.json 中添加：
# "permissions": { "defaultMode": "bypassPermissions" }
# "skipDangerousModePermissionPrompt": true

# ═══════════════════════════════════════════════════════════════
# 阶段三：ruflo 安装
# ═══════════════════════════════════════════════════════════════

# [步骤 4] 安装 ruflo（多 Agent + 记忆管理）
npm install -g ruflo
claude mcp add ruflo -- npx -y ruflo@latest mcp start

# [步骤 5] 创建全局配置
# 模板文件: templates/config.yaml.template
# 目标位置: $env:USERPROFILE\.claude-flow\config.yaml
# 配置：
# - memory.path: 全局记忆存储路径
# - agents: Agent 配置
# - defaults: 默认行为

# ═══════════════════════════════════════════════════════════════
# 阶段四：gspowers 生态安装
# ═══════════════════════════════════════════════════════════════

# [步骤 6] 安装 gstack（产品流程框架）
$skillsDir = "$env:USERPROFILE\.claude\skills"
if (!(Test-Path "$skillsDir\gstack")):
    git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git "$skillsDir\gstack"
    if (Test-Path "$skillsDir\gstack\setup"):
        & "$skillsDir\gstack\setup"

# [步骤 6.1] 安装 superpowers
# [需要用户介入] 在 Claude Code 中执行：
# /plugin install superpowers@claude-plugins-official

# [步骤 6.2] 安装 gspowers（SOP 导航）
if (!(Test-Path "$skillsDir\gspowers")):
    git clone https://github.com/fshaan/gspowers.git "$skillsDir\gspowers"

# ═══════════════════════════════════════════════════════════════
# 阶段五：gspowers 功能扩展（可选，需用户授权）
# ═══════════════════════════════════════════════════════════════

# [步骤 7] 技能扩充（用户说"允许 AI 自动扩充技能"后执行）

# 7.1 扩展 gspowers TDD 功能
# 模板文件: templates/tdd-config.yaml.template
# 目标位置: $env:USERPROFILE\.claude-flow\tdd-config.yaml
# 功能：强制测试先行模式（RED → GREEN → REFACTOR）

# 7.2 扩展 gspowers Wiki 生成功能
# 创建 $skillsDir\gspowers\wiki-helper.ps1
# 功能：上下文压缩，生成项目 Wiki

# 7.3 扩展 gspowers Pipeline 功能（多模块流水线）
# [重要] 复制 pipeline.md 到 $skillsDir\gspowers\references\pipeline.md
# 修改 $skillsDir\gspowers\references\execute.md
# 添加 pipeline-dev 流程（依赖解析、批次编排、门控验证）
# 详见第二十一章

# 7.4 创建全局 Git hooks
# 模板文件: templates/pre-commit.template
# 目标位置: $env:USERPROFILE\.claude-flow\hooks\pre-commit
# 功能：自动格式化、lint、测试

# ═══════════════════════════════════════════════════════════════
# 阶段六：验证
# ═══════════════════════════════════════════════════════════════

# [步骤 8] 验证安装
# 检查所有组件版本：
claude-flow --version      # ruflo
claude --version           # Claude Code
git --version              # Git
node --version             # Node.js
& "$env:USERPROFILE\.local\bin\rtk.exe" --version  # RTK
# 检查 MCP
claude mcp list            # 应包含 ruflo, markitdown
# 检查 skills
Get-ChildItem "$env:USERPROFILE\.claude\skills" -Directory

# ═══════════════════════════════════════════════════════════════
# 完成！
# ═══════════════════════════════════════════════════════════════

Write-Host ""
Write-Host "✅ 安装完成！" -ForegroundColor Green
Write-Host ""
Write-Host "下一步："
Write-Host "  1. 进入项目: cd D:\project"
Write-Host "  2. 初始化: ruflo init --minimal --skip-claude"
Write-Host "  3. 打开 Claude Code: claude"
Write-Host ""
Write-Host "可选功能（用户授权后可用）："
Write-Host "  - 说 'TDD' 启用测试先行模式"
Write-Host "  - 说 '生成 Wiki' 压缩上下文"
Write-Host "  - 说 '/pipeline-dev' 启动多模块流水线开发"
Write-Host "  - 说 '安全审计' 启动三方协作评审"
```

---

### 步骤速查表

| 步骤 | 操作                          | 必需 | 用户介入     |
| ---- | ----------------------------- | ---- | ------------ |
| 0    | 环境检测                      | ✓   |              |
| 1    | 安装 Git/Node.js              | ✓   |              |
| 2    | 安装 Claude Code              | ✓   |              |
| 3    | 配置 API Token                | ✓   | **是** |
| 3.1  | 安装 markitdown               |      |              |
| 3.2  | 安装 RTK                      |      |              |
| 3.3  | 配置权限模式                  |      |              |
| 4    | 安装 ruflo                    | ✓   |              |
| 5    | 创建全局配置                  | ✓   |              |
| 6    | 安装 gspowers 生态            | ✓   |              |
| 6.1  | 安装 superpowers              |      | **是** |
| 7    | 技能扩充（TDD/Wiki/Pipeline） |      | **是** |
| 8    | 验证安装                      | ✓   |              |

---

### 扩展功能清单

| 扩展名称       | 位置                            | 功能说明          |
| -------------- | ------------------------------- | ----------------- |
| TDD 流程       | gspowers/tdd-helper.ps1         | 强制测试先行模式  |
| Wiki 生成      | gspowers/wiki-helper.ps1        | 上下文压缩        |
| Pipeline 开发  | gspowers/references/pipeline.md | 多模块流水线      |
| RTK Token 节省 | .local/bin/rtk.exe              | 节省 60-90% token |
| markitdown     | MCP                             | Markdown 转换     |

```

---

## 九、目录结构

```

~$USERPROFILE/
├── .claude/
│   ├── skills/
│   │   ├── gstack/              # GStack（产品流程框架）
│   │   └── gspowers/           # gspowers（SOP 导航）
│   └── settings.json
├── .claude-flow/                 # ruflo 全局配置
│   ├── config.yaml             # 全局配置（记忆路径、agent 配置）
│   └── data/                    # 全局记忆存储（跨项目共享）
└── .claude/
    └── skills/                  # Claude Code skills（superpowers 等）

```

---

## 十、AI IDE 的角色：预览、测试、Git 处理

### 9.1 架构定位

```

┌─────────────────────────────────────────────────────────────┐
│                      Trae（AI IDE）                         │
│                     （你的编辑界面）                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐   │
│   │   预览      │    │   测试      │    │    Git      │   │
│   │  (Web UI)   │    │ (终端/浏览器) │    │  (提交/推送) │   │
│   └─────────────┘    └─────────────┘    └─────────────┘   │
│          ↑                ↑                ↑               │
│          │                │                │               │
│   Trae 自动刷新     Claude Code 执行    Claude Code 执行  │
│   文件变化           测试命令           Git 操作         │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                 Claude Code（AI 编程引擎）                   │
│                     （AI 的执行后台）                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   文件编辑 → 预览（Trae 自动刷新）                           │
│   执行测试 → 测试结果 → 反馈给 AI                            │
│   Git 操作 → 用户授权 → 自动提交/推送                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘

```

### 9.2 Trae 的三大职责

| 职责           | 说明                                                    | 你的操作                                      |
| -------------- | ------------------------------------------------------- | --------------------------------------------- |
| **预览** | 你编写代码后，Trae 自动刷新浏览器预览效果               | 打开 `localhost:端口` 查看                  |
| **测试** | AI 执行测试命令，结果在终端显示，你授权后可以修改       | AI 说 "测试失败" → 你查看 → 授权修复        |
| **Git**  | AI 生成代码后，提示你授权提交，授权后自动 commit + push | AI 说 "需要提交吗？" → 你说 "是" → 自动完成 |

### 9.3 Git 自动提交机制

#### 授权级别

| 级别               | 说明                                                     | 使用场景     |
| ------------------ | -------------------------------------------------------- | ------------ |
| **手动授权** | AI 生成代码 → 提示你 → 你说 "是" 才提交                | 重要生产代码 |
| **自动提交** | AI 生成代码 → 自动 commit + push（带 `--amend` 追溯） | 开发过程代码 |
| **自动推送** | commit 后自动 push（如果远程存在）                       | 多人协作     |

#### AI 执行 Git 的流程

```

1. AI 生成/修改文件
   ↓
2. 自动执行: git add .
   ↓
3. 提示: "准备提交，文件如下：[文件列表]，是否继续？"
   ↓
4. 你说 "是" 或 "no"（跳过）
   ↓
5. 如果授权:
   - AI 生成 commit message（基于本次更改内容）
   - 执行: git commit -m "message"
   - 如果远程存在: git push

```

#### 自动 commit 生成规则

```bash
# AI 根据更改内容自动生成 commit message
# 格式: [类型] 简短描述

# 类型映射:
文件新增 → "[ADD] 新增 xxx 功能"
bug修复 → "[FIX] 修复 xxx 问题"
重构   → "[REFACTOR] 重构 xxx 模块"
文档   → "[DOCS] 更新 xxx 文档"
测试   → "[TEST] 添加/修复 xxx 测试"
```

### 9.4 Trae 中的 Git 操作示例

#### 场景 1：完成一个功能

```
你: "实现商品列表页面"
    ↓
AI (Claude Code):
  1. 创建 src/pages/ProductList.tsx
  2. 创建 src/pages/ProductList.test.tsx
  3. 执行测试: npm test
  4. 测试通过后:
     git status
     git add .
  5. 提示你:
     "✅ 测试通过
      准备提交：
      [ADD] 实现商品列表页面
      文件：ProductList.tsx, ProductList.test.tsx
      是否提交？"
    ↓
你: "是"
    ↓
AI:
  git commit -m "[ADD] 实现商品列表页面"
  git push origin main  # 如果远程存在
    ↓
Trae: 显示提交成功，代码已同步
```

#### 场景 2：修复 bug

```
你: "登录页面在手机端显示错乱，帮我修一下"
    ↓
AI:
  1. 检查 Login.tsx 的响应式 CSS
  2. 修复 media query 断点
  3. 测试: 在手机模拟器预览
  4. 确认修复
  5. 自动 git add .
  6. 提示你:
    "准备提交：
      [FIX] 修复登录页面移动端响应式问题
      是否提交？"
    ↓
你: "是"
    ↓
AI:
  git commit -m "[FIX] 修复登录页面移动端响应式问题"
  git push
```

#### 场景 3：查看提交历史

```
你: "查看最近的提交"
    ↓
AI 执行:
git log --oneline -10

# Output:
# a1b2c3d [ADD] 实现商品列表页面
# e4f5g6h [FIX] 修复登录页面响应式问题
# i7j8k9l [ADD] 实现用户登录功能
```

### 9.5 冲突处理

当你的本地修改和远程冲突时：

```powershell
# AI 检测到冲突
git fetch origin
git merge origin/main
# Output: CONFLICT in src/pages/Login.tsx

# AI 会提示你
# "检测到冲突在 Login.tsx，需要你解决：
#   - HEAD (你的版本): xxx
#   - origin/main (远程): xxx
#   请在 Trae 中打开文件，手动解决冲突，
#   然后说 '已解决' 继续"

# 你解决后
# AI 执行
git add .
git commit -m "[CONFLICT] 解决 Login.tsx 合并冲突"
git push
```

---

## 十一、快速参考

```powershell
# 安装后验证
claude-flow --version          # ruflo 版本
claude mcp list                  # MCP 工具列表（应包含 ruflo）
git --version                   # Git 版本
node --version                  # Node.js 版本

# 新项目初始化
cd D:\project
ruflo init --minimal --skip-claude

# 启动 Claude Code
claude

# 常用触发词
安全审计                          # ruflo 三方协作
架构评审                          # ruflo 三方协作
/gspowers                        # gspowers SOP
/triple [任务]                   # 通用三方协作
```

---

## 十二、版本兼容性说明

| 工具        | 推荐版本 | 兼容性说明      |
| ----------- | -------- | --------------- |
| Claude Code | 最新版   | 主要界面        |
| ruflo       | v3.x     | 多 Agent + 记忆 |
| gstack      | 最新版   | 产品流程        |
| gspowers    | 最新版   | SOP 导航        |
| superpowers | 最新版   | 开发执行        |

> 本文档设计为长期可用。核心机制是 Claude Code + ruflo 的协作，无论工具版本如何更新，协作逻辑保持不变。

---

## 十三、上下文压缩与项目 Wiki 生成

### 13.1 功能说明

当对话上下文过长时，AI 应主动触发**上下文压缩**，生成项目 Wiki 文档，实现长期记忆和知识沉淀。

### 13.2 触发条件

```
触发条件（满足任一）：
- 对话轮次超过 10 轮
- 上下文 token 超过 80% 限制
- 用户说 "生成 Wiki" 或 "压缩上下文"
- 完成重要里程碑（功能开发、bug修复、设计决策）
```

### 13.3 压缩流程

```
1. AI 检测到需要压缩
       ↓
2. 分析当前项目结构
       ↓
3. 提取关键信息：
   - 已完成的功能清单
   - 技术决策记录
   - 遇到的问题和解决方案
   - 项目架构说明
   - 待办事项
       ↓
4. 生成 Wiki 文档
       ↓
5. 保存到 .claude-flow/wiki/ 目录
       ↓
6. 清理上下文，保留 Wiki 引用
```

### 13.4 Wiki 文档模板

```markdown
# [项目名] Wiki

> 自动生成时间: $DATE
> 最后更新: $DATE

## 项目概述

[项目简介、一句话描述]

## 技术栈

| 类别 | 技术 |
|------|------|
| 前端 | React, Next.js |
| 后端 | Node.js, Express |
| 数据库 | PostgreSQL |
| 部署 | Docker, K8s |

## 项目结构

```

src/
├── components/    # 组件
├── pages/        # 页面
├── api/          # API
└── utils/        # 工具函数

```

## 已完成功能

| 功能 | 完成日期 | 状态 |
|------|----------|------|
| 用户登录 | 2026-01-01 | 已上线 |
| 商品列表 | 2026-01-15 | 已上线 |

## 技术决策记录

### 决策 1: 选择 PostgreSQL 作为主数据库
- 日期: 2026-01-01
- 原因: 需要事务支持、JSON 字段、成熟生态
- 备选: MongoDB, MySQL

### 决策 2: 使用 Zustand 做状态管理
- 日期: 2026-01-05
- 原因: 轻量、TypeScript 支持好、够用就好
- 备选: Redux, MobX

## 遇到的问题和解决方案

### 问题 1: 登录会话过期
- 日期: 2026-01-10
- 现象: 用户频繁掉线
- 原因: Token 过期时间太短
- 解决: 延长 Token 有效期，增加 Refresh Token

## 待办事项

- [ ] 支付功能开发
- [ ] 邮件通知系统
- [ ] 管理后台

## 重要链接

- [Figma 设计稿](链接)
- [API 文档](链接)
- [监控面板](链接)
```

### 13.5 AI 自动执行命令

```powershell
# AI 执行压缩时
mkdir -p .claude-flow/wiki

# 生成 Wiki
cat > .claude-flow/wiki/project-wiki.md << 'EOF'
# 项目 Wiki 内容
EOF

# 清理上下文，保留引用
# AI 在后续对话中引用: "根据 project-wiki.md，我们之前决定..."
```

---

## 十四、gspowers TDD 扩展方案

### 14.1 问题

gspowers 的 `/subagent-dev` 默认没有强制 TDD（测试先行）流程。如果用户要求遵循 TDD，需要扩展 gspowers 的行为。

### 14.2 解决方案

当用户说"遵循 TDD"或"测试先行"时，AI 自动在 `/subagent-dev` 流程前插入 TDD 阶段。

### 14.3 TDD 扩展命令

当用户要求 TDD 时，AI 执行以下扩展流程：

```
┌─────────────────────────────────────────────────────────────┐
│  TDD 扩展流程（插入 /subagent-dev 之前）                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Phase 1: 写失败测试                                        │
│     - 先写测试（RED）                                       │
│     - 明确功能预期                                           │
│                                                             │
│  Phase 2: 最小实现                                          │
│     - 让测试通过（GREEN）                                   │
│     - 不追求完美，只求通过                                    │
│                                                             │
│  Phase 3: 重构                                             │
│     - 优化代码（REFACTOR）                                  │
│     - 确保测试仍然通过                                       │
│                                                             │
│  Phase 4: 提交                                             │
│     - commit 时附带测试覆盖率                                │
└─────────────────────────────────────────────────────────────┘
```

### 14.4 AI 自动 TDD 触发

用户只需说一句话，AI 自动执行完整 TDD：

```
你: "实现用户注册功能，遵循 TDD"
    ↓
AI:
  1. 先写测试: UserRegister.test.ts
  2. 运行测试 → 失败（RED）
  3. 写实现: UserRegister.ts
  4. 运行测试 → 通过（GREEN）
  5. 重构优化
  6. 提示你:
     "✅ TDD 完成
      测试: UserRegister.test.ts
      实现: UserRegister.ts
      覆盖率: 95%
      是否提交？"
    ↓
你: "是"
    ↓
git commit -m "[TDD] 实现用户注册功能"
```

### 14.5 TDD 配置文件

AI 会在项目目录创建 `.claude-flow/tdd-config.yaml`：

```yaml
# TDD 配置
tdd:
  enabled: true
  testFramework: "jest"  # jest / vitest / pytest / ...
  testDir: "src/__tests__"
  coverageThreshold: 80  # 覆盖率门槛
  phases:
    - write-test       # 先写测试
    - run-test-red     # 运行测试，确认失败
    - write-code        # 写实现代码
    - run-test-green   # 运行测试，确认通过
    - refactor          # 重构
    - commit            # 提交
```

### 14.6 TDD 执行命令参考

```powershell
# TDD 模式下的测试命令
npm test -- --coverage        # 运行测试并生成覆盖率
npm test -- --watch           # 监听模式，文件变化自动测试

# 覆盖率检查
npm test -- --coverage --coverageThreshold=80

# 如果覆盖率不达标，AI 会提示你
# "覆盖率仅 65%，未达到 80% 门槛，请增加测试或优化代码"
```

### 14.7 gspowers TDD 模式触发词

| 你说的话     | AI 行为                             |
| ------------ | ----------------------------------- |
| `TDD`      | 启用 TDD 模式，所有开发遵循测试先行 |
| `遵循 TDD` | 同上                                |
| `测试先行` | 同上                                |
| `关闭 TDD` | 恢复普通开发模式                    |

---

## 十五、AI 自动化技能扩充（无需用户手动）

### 15.1 说明

当用户授权"允许 AI 自动扩充技能"后，AI 可以自动为 gspowers 和其他工具添加新功能，无需用户提供额外文件或地址。

### 15.2 触发条件

```
用户说 "允许 AI 自动扩充技能" 或类似表述
    ↓
AI 开始检测和扩充
```

### 15.3 扩充范围

AI 会自动检测并扩充以下技能（如果存在）：

| 技能目录    | 扩充内容          | 说明                      |
| ----------- | ----------------- | ------------------------- |
| gspowers    | TDD 流程          | 强制测试先行模式          |
| gspowers    | Wiki 生成         | 上下文压缩触发            |
| gspowers    | 代码审查增强      | 多 Agent 协作评审         |
| gstack      | 架构决策记录      | 自动记录设计决策          |
| superpowers | 子 Agent 记忆共享 | 同一项目 Agent 共享上下文 |
| 全局        | Git hook          | 自动格式化、lint、测试    |

### 15.4 自动扩充命令

```powershell
# ═══════════════════════════════════════════════════════════════
# AI 自动技能扩充脚本
# 当用户授权后，AI 执行此脚本
# ═══════════════════════════════════════════════════════════════

# 1. 检测现有技能
$skillsDir = "$env:USERPROFILE\.claude\skills"

# 2. 为 gspowers 添加 TDD 扩展
if (Test-Path "$skillsDir\gspowers") {
    Write-Host "扩展 gspowers TDD 功能..."

    # 创建 TDD 辅助脚本
    $tddHelper = @"
# gspowers TDD 扩展
# 自动插入测试先行流程

function Invoke-TDD-Cycle {
    param([string]`$task)

    Write-Host "[TDD] Phase 1: 写失败测试"
    # AI 先写测试

    Write-Host "[TDD] Phase 2: 运行测试 (RED)"
    # AI 运行测试，确认失败

    Write-Host "[TDD] Phase 3: 写实现 (GREEN)"
    # AI 写最小实现

    Write-Host "[TDD] Phase 4: 重构 (REFACTOR)"
    # AI 重构优化

    Write-Host "[TDD] Phase 5: 提交"
    # AI 提交代码
}
"@

    $tddHelper | Out-File -FilePath "$skillsDir\gspowers\tdd-helper.ps1" -Encoding UTF8
    Write-Host "  ✓ gspowers TDD 扩展已添加"
}

# 3. 为 gspowers 添加 Wiki 生成功能
if (Test-Path "$skillsDir\gspowers") {
    Write-Host "扩展 gspowers Wiki 生成功能..."

    $wikiHelper = @"
# gspowers Wiki 生成扩展
# 上下文压缩触发

function New-ProjectWiki {
    param([string]`$projectPath)

    $wikiDir = Join-Path `$projectPath ".claude-flow\wiki"
    if (!(Test-Path `$wikiDir)) {
        New-Item -ItemType Directory -Force -Path `$wikiDir | Out-Null
    }

    # 生成 Wiki
    `$content = @"
# `$(Split-Path `$projectPath -Leaf) Wiki
# 生成时间: `$(Get-Date -Format 'yyyy-MM-dd HH:mm')

## 项目概述
[请 AI 补充]

## 技术栈
[请 AI 补充]

## 项目结构
[请 AI 补充]

## 已完成功能
[请 AI 补充]

## 技术决策记录
[请 AI 补充]

## 待办事项
[请 AI 补充]
"@

    `$content | Out-File -FilePath "`$wikiDir\project-wiki.md" -Encoding UTF8
    Write-Host "  ✓ Wiki 已生成: `$(`$wikiDir\project-wiki.md)"
}
"@

    $wikiHelper | Out-File -FilePath "$skillsDir\gspowers\wiki-helper.ps1" -Encoding UTF8
    Write-Host "  ✓ gspowers Wiki 扩展已添加"
}

# 4. 创建全局 Git hooks（自动格式化/测试）
$hooksDir = "$env:USERPROFILE\.claude-flow\hooks"
New-Item -ItemType Directory -Force -Path `$hooksDir

$preCommitHook = @"
#!/bin/bash
# 自动 pre-commit hook
# 格式化代码、运行测试

echo "Running pre-commit checks..."

# 格式化
npm run format 2>/dev/null || true

# lint
npm run lint 2>/dev/null || true

# 测试
npm test -- --coverage 2>/dev/null || true

echo "Pre-commit complete"
"@

$preCommitHook | Out-File -FilePath "$hooksDir\pre-commit" -Encoding ASCII
Write-Host "  ✓ Git hooks 已配置"

# 5. 输出扩充结果
Write-Host ""
Write-Host "═" * 60
Write-Host "✅ 技能扩充完成"
Write-Host "═" * 60
Write-Host ""
Write-Host "已扩展:"
Write-Host "  ✓ gspowers TDD 流程"
Write-Host "  ✓ gspowers Wiki 生成"
Write-Host "  ✓ Git hooks (format/lint/test)"
Write-Host ""
Write-Host "使用方式:"
Write-Host "  说 'TDD' 启用测试先行模式"
Write-Host "  说 '生成 Wiki' 压缩上下文"
```

### 15.5 扩充后的功能触发

| 用户授权后说          | AI 自动执行                   |
| --------------------- | ----------------------------- |
| `TDD`               | 启用 TDD 开发模式（测试先行） |
| `生成 Wiki`         | 压缩上下文，生成项目 Wiki     |
| `遵循 TDD + 功能名` | TDD 模式实现功能              |
| `关闭 TDD`          | 恢复普通开发模式              |

---

## 十六、一键完整安装脚本

> 以下脚本由 AI 读取后自动执行，完成所有配置
>
> **版本**：v1.3（完整版）

```powershell
# ═══════════════════════════════════════════════════════════════
# Claude × gspowers × ruflo 金手指 - 一键安装脚本
# AI 执行，无需用户介入（除 Token 配置和 superpowers 安装）
# 版本：v1.3（包含 RTK、TDD、Pipeline 扩展）
# ═══════════════════════════════════════════════════════════════

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════╗"
Write-Host "║  Claude × gspowers × ruflo 金手指 - 一键安装                ║"
Write-Host "║  版本: v1.3（完整版）                                      ║"
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ═══════════════════════════════════════════════════════════════
# 阶段一：环境准备
# ═══════════════════════════════════════════════════════════════

Write-Host "[1/9] 检测环境..." -ForegroundColor Yellow
# 检测操作系统、已安装工具、网络速度
# （参见第一章）

Write-Host "[2/9] 安装缺失工具..." -ForegroundColor Yellow
# 如果 Git 缺失 → winget install Git.Git
# 如果 Node.js 缺失 → winget install OpenJS.NodeJS.LTS
# （参见第三章步骤1）

# ═══════════════════════════════════════════════════════════════
# 阶段二：核心安装
# ═══════════════════════════════════════════════════════════════

Write-Host "[3/9] 安装 Claude Code..." -ForegroundColor Yellow
# 如果 claude 命令不存在
irm https://claude.ai/install.ps1 | iex
# （参见第三章步骤2）

Write-Host "[3.1/9] 配置 API Token..." -ForegroundColor Yellow
# [需要用户介入]
# 提示用户在 Claude Code 中配置 Token
# 或创建 $env:USERPROFILE\.claude\settings.json
# （参见第三章步骤3）

Write-Host "[3.2/9] 安装 markitdown..." -ForegroundColor Yellow
npm install -g @digipair/skill-markitdown
claude mcp add markitdown -- npx -y @digipair/skill-markitdown

Write-Host "[3.3/9] 安装 RTK（Token 节省 60-90%）..." -ForegroundColor Yellow
# 下载 RTK
$rtkUrl = "https://github.com/rtk-ai/rtk/releases/download/v0.37.2/rtk-x86_64-pc-windows-msvc.zip"
curl -sL $rtkUrl -o $env:TEMP\rtk.zip
Expand-Archive -Path $env:TEMP\rtk.zip -DestinationPath $env:TEMP\rtk -Force
# 安装到用户目录
$binDir = "$env:USERPROFILE\.local\bin"
New-Item -ItemType Directory -Force -Path $binDir
Move-Item "$env:TEMP\rtk\rtk.exe" "$binDir\rtk.exe"
# 初始化并自动修补 settings.json
& "$binDir\rtk.exe" init -g --auto-patch
& "$binDir\rtk.exe" gain

Write-Host "[3.4/9] 配置权限模式（Yolo）..." -ForegroundColor Yellow
# 在 settings.json 中添加 bypassPermissions 配置
# （参见第三章步骤3.3）

# ═══════════════════════════════════════════════════════════════
# 阶段三：ruflo 安装
# ═══════════════════════════════════════════════════════════════

Write-Host "[4/9] 安装 ruflo..." -ForegroundColor Yellow
npm install -g ruflo
claude mcp add ruflo -- npx -y ruflo@latest mcp start

Write-Host "[5/9] 创建全局配置..." -ForegroundColor Yellow
# 创建 $env:USERPROFILE\.claude-flow\config.yaml
# （参见第三章步骤5）

# ═══════════════════════════════════════════════════════════════
# 阶段四：gspowers 生态安装
# ═══════════════════════════════════════════════════════════════

Write-Host "[6/9] 安装 gstack..." -ForegroundColor Yellow
$skillsDir = "$env:USERPROFILE\.claude\skills"
if (!(Test-Path "$skillsDir\gstack")):
    git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git "$skillsDir\gstack"
    if (Test-Path "$skillsDir\gstack\setup"):
        & "$skillsDir\gstack\setup"

Write-Host "[6.1/9] 安装 superpowers..." -ForegroundColor Yellow
# [需要用户介入]
Write-Host "请在 Claude Code 中执行: /plugin install superpowers@claude-plugins-official" -ForegroundColor Cyan

Write-Host "[6.2/9] 安装 gspowers..." -ForegroundColor Yellow
if (!(Test-Path "$skillsDir\gspowers")):
    git clone https://github.com/fshaan/gspowers.git "$skillsDir\gspowers"

# ═══════════════════════════════════════════════════════════════
# 阶段五：gspowers 功能扩展（可选，需用户授权）
# ═══════════════════════════════════════════════════════════════

Write-Host "[7/9] 技能扩充（等待用户授权）..." -ForegroundColor Yellow
# 等待用户说 "允许 AI 自动扩充技能"
# 如果已授权，执行以下扩展：

# 7.1 扩展 gspowers TDD 功能
Write-Host "  ✓ 扩展 gspowers TDD 功能..."
# 创建 $skillsDir\gspowers\tdd-helper.ps1

# 7.2 扩展 gspowers Wiki 生成功能
Write-Host "  ✓ 扩展 gspowers Wiki 生成功能..."
# 创建 $skillsDir\gspowers\wiki-helper.ps1

# 7.3 扩展 gspowers Pipeline 功能（多模块流水线）
Write-Host "  ✓ 扩展 gspowers Pipeline 功能..."
# 复制 pipeline.md 到 $skillsDir\gspowers\references\pipeline.md
# 修改 execute.md 添加 pipeline-dev 流程
# 参见第二十一章

# 7.4 创建全局 Git hooks
Write-Host "  ✓ 创建全局 Git hooks..."
# 创建 $env:USERPROFILE\.claude-flow\hooks\pre-commit

# ═══════════════════════════════════════════════════════════════
# 阶段六：验证
# ═══════════════════════════════════════════════════════════════

Write-Host "[8/9] 验证安装..." -ForegroundColor Yellow
claude-flow --version
claude --version
git --version
node --version
& "$binDir\rtk.exe" --version
claude mcp list

Write-Host "[9/9] 清理..." -ForegroundColor Yellow
Remove-Item $env:TEMP\rtk.zip -Force -ErrorAction SilentlyContinue

# ═══════════════════════════════════════════════════════════════
# 完成！
# ═══════════════════════════════════════════════════════════════

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "✅ 安装完成！版本: v1.3" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "下一步："
Write-Host "  1. 进入项目: cd D:\project" -ForegroundColor White
Write-Host "  2. 初始化: ruflo init --minimal --skip-claude" -ForegroundColor White
Write-Host "  3. 打开 Claude Code: claude" -ForegroundColor White
Write-Host ""
Write-Host "可选功能（用户授权后可用）：" -ForegroundColor Yellow
Write-Host "  - 说 'TDD' 启用测试先行模式" -ForegroundColor Gray
Write-Host "  - 说 '生成 Wiki' 压缩上下文" -ForegroundColor Gray
Write-Host "  - 说 '/pipeline-dev' 启动多模块流水线开发" -ForegroundColor Gray
Write-Host "  - 说 '安全审计' 启动三方协作评审" -ForegroundColor Gray
```

---

## 十七、用户授权声明

> 以下内容在用户说"允许 AI 自动扩充技能"时触发

```
用户授权后，AI 可以：
✓ 扩展 gspowers 功能（TDD、Wiki 生成、Pipeline 多模块流水线）
✓ 创建/修改项目配置文件
✓ 安装额外工具（如果需要）
✓ 生成项目 Wiki 和文档

用户随时可以说"停止技能扩充"取消授权
```

### 17.1 授权后可用的扩展功能

| 扩展名称      | 触发词                 | 功能说明                    |
| ------------- | ---------------------- | --------------------------- |
| TDD 流程      | `TDD` / `遵循 TDD` | 强制测试先行模式            |
| Wiki 生成     | `生成 Wiki`          | 上下文压缩                  |
| Pipeline 开发 | `/pipeline-dev`      | 多模块依赖流水线开发        |
| Git hooks     | 自动                   | pre-commit 格式化/lint/测试 |

### 17.2 扩展安装位置

| 扩展          | 目标路径                                             |
| ------------- | ---------------------------------------------------- |
| TDD 流程      | `~/.claude/skills/gspowers/tdd-helper.ps1`         |
| Wiki 生成     | `~/.claude/skills/gspowers/wiki-helper.ps1`        |
| Pipeline 开发 | `~/.claude/skills/gspowers/references/pipeline.md` |
| Git hooks     | `~/.claude-flow/hooks/pre-commit`                  |

---

## 十八、AI读原型实战：MasterGo/Figma/Axure蓝湖 原型解析技能

### 18.1 技能简介

通过 gstack Browser Harness（headless Chromium）自动登录 MasterGo /Figma/Axure原型，生成 PRD（需求文档）和 Spec（技术规格）。

```
技能路径：~/.claude/skills/mastergo-prd-spec/
触发词：mastergo、原型解析、生成 PRD、生成 Spec
```

### 18.2 Browser Harness 是什么

Browser Harness 是 gstack 内置的 headless Chromium 浏览器，AI 可以直接控制：

| 命令                         | 说明                      |
| ---------------------------- | ------------------------- |
| `$B goto <url>`            | 打开任意 URL              |
| `$B screenshot`            | 截图、标注截图            |
| `$B snapshot -i`           | 抓取 DOM 结构（交互元素） |
| `$B cookie-import-browser` | 从 Chrome 导入 Cookie     |
| `$B click @e3`             | 模拟用户点击              |
| `$B is visible`            | 页面元素断言              |

**优势**：gstack 已全局安装，无需额外安装 Playwright/Puppeteer

### 18.3 核心能力

| 能力            | 说明                                            |
| --------------- | ----------------------------------------------- |
| Browser Harness | gstack 内置 headless Chromium，AI 直接控制      |
| Cookie 自动导入 | `$B cookie-import-browser` 直接从 Chrome 导入 |
| 全量解析        | 解析整个原型，生成完整 PRD + Spec               |
| 单功能解析      | 聚焦单个页面/模块，快速生成专项文档             |
| gspowers 集成   | 产出物可直接导入 /office-hours 评审             |

### 18.4 工作流程

```
1. 用户提供：MasterGo 原型链接
         ↓
2. AI 使用 $B cookie-import-browser 导入 Cookie（自动打开 Chrome 选择器）
         ↓
3. AI 访问 MasterGo 原型
         ↓
4. AI 分析页面结构（snapshot -i + screenshot）
         ↓
5. 生成 PRD + Spec 文档
         ↓
6. 可选：导入 gspowers /office-hours 评审
```

### 18.5 常用命令

```bash
# 检查 Browser Harness 状态
$B status

# 从 Chrome 导入 Cookie（推荐，自动打开选择器）
$B cookie-import-browser

# 访问页面
$B goto https://mastergo.com/goto/S6XROeDp
$B wait --networkidle

# 页面分析
$B snapshot -i          # 获取交互元素（按钮、表单等）
$B snapshot -a -o /tmp/annotated.png  # 带标注的截图
$B text                 # 获取页面文本
$B links                # 获取所有链接
$B forms                # 获取表单字段

# 交互操作
$B click @e3            # 点击元素（通过引用）
$B fill @e4 "value"    # 填写表单字段
```

### 18.6 完整解析示例

```bash
# 1. 检查 Browser Harness
$B status

# 2. 导入 Cookie
$B cookie-import-browser

# 3. 访问原型
$B goto https://mastergo.com/goto/S6XROeDp
$B wait --networkidle

# 4. 获取页面概览
$B snapshot -i -a -o /tmp/prototype-annotated.png
$B text > /tmp/page-text.txt

# 5. 遍历各页面（通过导航）
$B click @e3  # 点击某个页面元素
$B snapshot -i
$B screenshot /tmp/page-detail.png

# 6. AI 分析所有截图和结构，生成 PRD/Spec
```

### 18.7 使用方式

#### 全量解析（默认）

```
触发词："全量解析原型" / "解析整个原型"
读取所有页面，生成完整 PRD + Spec
```

#### 单功能解析

```
触发词："单功能解析 [页面名称]"
聚焦单个功能模块，生成专项文档
```

### 18.8 PRD × Spec 双轨模板

基于 SDD 需求采集模板，你的 Excel 中：

| PRD（需求侧）       | Spec（技术侧）       |
| ------------------- | -------------------- |
| Sheet2 项目基础信息 | Sheet4 数据流        |
| Sheet3 业务流       | Sheet5 数据关系      |
| Sheet6 功能页面表   | Sheet11 接口契约     |
| Sheet7 功能权限表   | Sheet12 原型控件     |
| Sheet8 状态流转     | Sheet13 非功能需求   |
| Sheet9 业务规则     | Sheet17 部署配置方案 |
| Sheet16 待确认问题  | —                   |

### 18.9 与 gspowers 的关系

| 阶段     | gspowers 原生      | 本技能增强                   |
| -------- | ------------------ | ---------------------------- |
| 需求采集 | /office-hours 对拷 | 原型直接解析，无需手动填写   |
| 需求评审 | /plan-ceo-review   | 输出即 PRD 格式，可直接评审  |
| 架构评审 | /plan-eng-review   | 输出即 Spec 格式，可直接评审 |
| 执行     | /subagent-dev      | 数据模型/接口可直接复用      |

### 18.10 完整流程MasterGo 原型

### 18.11 注意事项

1. **Cookie 导入**：推荐使用 `$B cookie-import-browser` 直接从 Chrome 导入，无需手动复制
2. **页面数量**：全量解析时按导航顺序逐页分析，避免一次性抓取过多
3. **复杂交互**：对于复杂交互（弹窗、抽屉、状态联动），优先截图再分析
4. **待确认项**：解析后识别出的疑问点，自动汇总到 Sheet16 格式的待确认清单
5. **Cookie 导入失败处理**：如果 `$B cookie-import-browser` 失败，AI 应引导用户在浏览器中手动获取 `mg_session` 字段，然后在 MasterGo 导入命令中指定该字段。

---

## 十九、完整触发词速查表

| 触发词                      | 功能                       | 来源              |
| --------------------------- | -------------------------- | ----------------- |
| `/gspowers`               | 启动 SOP 流程导航          | gspowers          |
| `/office-hours`           | YC 式产品拷问              | gspowers          |
| `/brainstorm`             | 苏格拉底式设计细化         | gspowers          |
| `/subagent-dev`           | 子代理 TDD 开发            | gspowers          |
| `/review`                 | 代码审查                   | gspowers          |
| `/qa`                     | 浏览器 QA                  | gspowers          |
| `/ship`                   | 发布 PR                    | gspowers          |
| `安全审计`                | 多 Agent 安全漏洞扫描      | ruflo             |
| `架构评审`                | 多 Agent 系统架构评估      | ruflo             |
| `QA团队`                  | 多 Agent 测试质量评审      | ruflo             |
| `三方调研`                | 多 Agent 通用研究任务      | ruflo             |
| `triple [任务]`           | 通用三方协作               | ruflo             |
| `mastergo` / `原型解析` | MasterGo 原型生成 PRD/Spec | mastergo-prd-spec |
| `全量解析原型`            | 解析整个原型生成完整文档   | mastergo-prd-spec |
| `单功能解析 [页面]`       | 解析单个页面/模块          | mastergo-prd-spec |
| `TDD`                     | 启用测试先行模式           | 扩展              |
| `关闭 TDD`                | 恢复普通开发模式           | 扩展              |
| `生成 Wiki`               | 压缩上下文，生成项目 Wiki  | 扩展              |
| `允许 AI 自动扩充技能`    | 授权 AI 扩展工具功能       | 用户              |
| `停止技能扩充`            | 取消授权                   | 用户              |
| `/pipeline-dev`           | 多模块流水线开发           | gspowers-pipeline |
| `多模块开发`              | 同上                       | gspowers-pipeline |
| `流水线开发`              | 同上                       | gspowers-pipeline |

---

## 二十一、gspowers 多模块流水线扩展

> **目标**：在 gspowers 的 `/subagent-dev` 基础上，增加多模块依赖感知流水线开发能力
>
> **改造点**：B（增强 gspowers 的 `/subagent-dev`）
>
> **补丁位置**：`d:\projects\AI编程智驾\gspowers-pipeline-patch\`

### 21.1 扩展背景

gspowers 原生的 `/subagent-dev` 是针对**单模块**的 TDD 开发流程。但实际项目中经常遇到**多模块有依赖**的场景：

```
典型场景：
├── 用户服务（user-service）      - 无依赖
├── 商品服务（product-service）  - 依赖用户服务
├── 订单服务（order-service）    - 依赖用户服务 + 商品服务
└── 支付服务（payment-service）  - 依赖订单服务
```

原有的单模块开发无法处理模块间的**执行顺序**和**依赖验证**。

### 21.2 扩展方案

#### 改造文件清单

| 文件                       | 操作           | 说明                                     |
| -------------------------- | -------------- | ---------------------------------------- |
| `references/pipeline.md` | **新增** | 多模块流水线开发完整规范                 |
| `references/execute.md`  | **修改** | 在 subagent-dev 步骤中添加 Pipeline 路由 |

#### 补丁文件位置

```
d:\projects\AI编程智驾\gspowers-pipeline-patch\
├── pipeline.md           # 新增文件内容
├── execute-patch.md       # 修改 execute.md 的详细说明
└── install-pipeline.ps1   # 自动安装脚本
```

### 21.3 安装步骤

#### 方式一：手动安装

1. 复制 `pipeline.md` 到 `~/.claude/skills/gspowers/references/pipeline.md`
2. 按照 `execute-patch.md` 的说明修改 `execute.md`

#### 方式二：自动安装

```powershell
# 运行安装脚本
d:\projects\AI编程智驾\gspowers-pipeline-patch\install-pipeline.ps1

# 该脚本会：
# 1. 备份原始 execute.md
# 2. 复制 pipeline.md
# 3. 提示手动应用 execute.md 补丁
```

#### 方式三：让 AI 自动应用

```
请根据 d:\projects\AI编程智驾\gspowers-pipeline-patch\execute-patch.md 的说明
修改 ~/.claude/skills/gspowers/references/execute.md
```

### 21.4 核心概念

#### 21.4.1 依赖解析

自动分析模块间的依赖关系，构建 DAG（有向无环图）：

```
用户输入：
  - 模块A（无依赖）
  - 模块B（依赖A）
  - 模块C（依赖A、B）
  - 模块D（依赖B、C）

解析结果：
  graph = {
    A: [],
    B: [A],
    C: [A, B],
    D: [B, C]
  }
```

#### 21.4.2 批次划分

根据 DAG 拓扑排序，自动划分执行批次：

```
批次1: [A]           - 无依赖的模块先执行
批次2: [B]           - 依赖 A 的模块
批次3: [C]           - 依赖 A、B 的模块
批次4: [D]           - 依赖 B、C 的模块
```

#### 21.4.3 门控验证

每个批次执行完成后进行门控检查：

| 结果            | 后续动作                 |
| --------------- | ------------------------ |
| 全部 `passed` | 进入下一批次             |
| 有 `failed`   | 终止流水线，提示用户修复 |

#### 21.4.4 模块状态

| 状态        | 说明                 |
| ----------- | -------------------- |
| `pending` | 等待执行             |
| `running` | 执行中               |
| `passed`  | 测试全部通过         |
| `failed`  | 测试未通过或执行错误 |
| `skipped` | 依赖失败，跳过       |

### 21.5 触发方式

#### 方式一：显式触发

```
/pipeline-dev
多模块开发
流水线开发
```

#### 方式二：配置触发

在 `implementation-plan.md` 中添加 `pipeline.modules` 配置：

```yaml
pipeline:
  enabled: true
  modules:
    - name: user-service
      path: services/user
      depends_on: []
    - name: product-service
      path: services/product
      depends_on: [user-service]
    - name: order-service
      path: services/order
      depends_on: [user-service, product-service]
```

#### 方式三：对话触发

用户描述模块配置，AI 自动解析：

```
你：项目有四个模块，用户、商品、订单、支付，订单依赖前两个，支付依赖订单
AI：已识别模块依赖关系，自动进入 Pipeline 模式
```

### 21.6 state.json 扩展

Pipeline 模式需要在 `state.json` 中新增 `pipeline` 节点：

```json
{
  "version": "1.2",
  "pipeline": {
    "enabled": true,
    "modules": {
      "user-service": {
        "name": "user-service",
        "display_name": "用户服务",
        "path": "services/user",
        "depends_on": [],
        "status": "pending",
        "batch": 1
      },
      "product-service": {
        "name": "product-service",
        "path": "services/product",
        "depends_on": ["user-service"],
        "status": "pending",
        "batch": 2
      }
    },
    "batches": [
      ["user-service"],
      ["product-service"]
    ],
    "current_batch": 1
  }
}
```

### 21.7 执行流程

```
用户: /gspowers
    ↓
检测到需要 Pipeline 模式
    ↓
pipeline-init（初始化）
    - 解析模块配置
    - 构建 DAG
    - 检测循环依赖
    - 划分批次
    - 显示流水线概览
    ↓
用户: /gspowers（继续）
    ↓
pipeline-execute（批次执行）
    ↓
pipeline-gate-check（门控检查）
    ↓
通过 → 进入下一批次
失败 → 终止，等待修复
    ↓
所有批次完成
    ↓
pipeline-complete（流水线完成）
    ↓
进入 finish 阶段（/review）
```

### 21.8 断点恢复

如果流水线中途失败/中断，恢复时：

```
检测到未完成的流水线

当前状态:
├─ 批次1: user-service ✓ passed
├─ 批次2: product-service ✓ passed
├─ 批次3: order-service ✗ failed (测试失败)
└─ 批次4: payment-service ○ pending

是否从批次3继续？（是 / 重新开始）
```

### 21.9 与原有 subagent-dev 的关系

| 方面     | subagent-dev（单模块） | pipeline-dev（多模块）       |
| -------- | ---------------------- | ---------------------------- |
| 适用场景 | 单个功能/模块开发      | 多模块有依赖的系统           |
| 执行方式 | 串行                   | 批次并行 + 批次串行          |
| 依赖处理 | 无                     | DAG 解析 + 门控验证          |
| 状态粒度 | 整体 pass/fail         | 模块级状态追踪               |
| 恢复能力 | 无                     | 支持断点恢复                 |
| 后向兼容 | -                      | 单模块时自动退化为单模块模式 |

### 21.10 典型使用场景

#### 场景一：微服务开发

```
模块：api-gateway, user-service, auth-service, product-service, order-service, payment-service
依赖：
  - api-gateway: 无
  - user-service: 无
  - auth-service → user-service
  - product-service: 无
  - order-service → user-service, product-service
  - payment-service → order-service
```

#### 场景二：前后端分离

```
前端模块：shared-components, user-pages, admin-pages, dashboard
后端模块：core, api
依赖：
  - core: 无
  - api → core
  - shared-components: 无
  - user-pages → shared-components
  - admin-pages → shared-components
  - dashboard → shared-components, user-pages
```

#### 场景三：前后端分离项目（并行开发）

```
Backend: core → api
Frontend: shared → pages

可以：
  批次1: backend-core + frontend-shared（并行）
  批次2: backend-api + frontend-pages（并行）
  批次3: integration-test
```

### 21.11 已知限制

1. **循环依赖检测**：如果存在循环依赖，流水线会报错并停止
2. **跨批次接口变更**：当模块接口变更时，需要手动同步到依赖模块
3. **测试隔离**：确保模块测试是隔离的，不会相互影响

---

## 二十、最终说明

```
本文档是 AI 可完整执行的安装和操作指南。

用户只需：
1. 把本文档给 AI 阅读
2. AI 自动完成所有安装和配置
3. 用户授权（可选）AI 自动扩充技能

之后用户可以：
- 在任意项目目录打开 Claude Code
- 说触发词执行各种功能
- 授权 AI 自动管理代码和 Git

全程无需手动安装工具、配置环境，AI 全部自动完成。
```
