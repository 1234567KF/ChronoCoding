#!/usr/bin/env pwsh
<#
.SYNOPSIS
    AI编程智驾 — 本地安装/更新脚本 (Windows)
.DESCRIPTION
    生成 settings.local.json 模板，引导填写 API 密钥，安装全局依赖。
    安全：生成的 settings.local.json 已加入 .gitignore，不会提交密钥。
#>

$ErrorActionPreference = "Stop"
$ClaudeDir = Join-Path $PSScriptRoot ".claude"
if (!(Test-Path $ClaudeDir)) { $ClaudeDir = $PSScriptRoot }

$LocalConfig = Join-Path $ClaudeDir "settings.local.json"
$Gitignore = Join-Path $PSScriptRoot ".gitignore"

# ─── Step 1: 确保 .gitignore 包含 settings.local.json ────────────────
if (Test-Path $Gitignore) {
    $content = Get-Content $Gitignore -Raw -ErrorAction SilentlyContinue
    if ($content -notmatch "settings\.local\.json") {
        "`n# 本地覆盖配置（含 API 密钥，不提交）`nsettings.local.json" | Add-Content $Gitignore
        Write-Host "[✓] .gitignore 已追加 settings.local.json" -ForegroundColor Green
    }
} else {
    "# 本地覆盖配置（含 API 密钥，不提交）`nsettings.local.json" | Set-Content $Gitignore
    Write-Host "[✓] 已创建 .gitignore" -ForegroundColor Green
}

# ─── Step 2: 生成 settings.local.json 模板 ─────────────────────────────
if (Test-Path $LocalConfig) {
    Write-Host "[i] settings.local.json 已存在，跳过生成。" -ForegroundColor Yellow
    Write-Host "    如需重置，请先删除该文件再运行此脚本。" -ForegroundColor Yellow
} else {
    Write-Host "`n=== 首次安装：配置 API 密钥 ===" -ForegroundColor Cyan
    Write-Host "以下密钥仅保存在本地 settings.local.json，不会提交到 Git。`n" -ForegroundColor Gray

    $authToken = Read-Host "请输入 ANTHROPIC_AUTH_TOKEN (DeepSeek API Key)"
    $deepseekKey = Read-Host "请输入 DEEPSEEK_API_KEY (留空则与 ANTHROPIC_AUTH_TOKEN 相同)"
    if ([string]::IsNullOrWhiteSpace($deepseekKey)) { $deepseekKey = $authToken }

    $minimaxKey = Read-Host "请输入 MINIMAX_API_KEY (留空则跳过 MiniMax)"
    $kimiKey = Read-Host "请输入 KIMI_API_KEY (留空则跳过 Kimi)"

    $config = @{
        env = @{
            ANTHROPIC_AUTH_TOKEN       = $authToken
            ANTHROPIC_BASE_URL         = "https://api.deepseek.com/anthropic"
            DEEPSEEK_API_KEY           = $deepseekKey
            MINIMAX_API_KEY            = $minimaxKey
            KIMI_API_KEY               = $kimiKey
            CLAUDE_CODE_ALWAYS_THINKING = "0"
            CLAUDE_CODE_ENABLE_THINKING = "0"
            CLAUDE_CODE_NO_FLICKER     = "1"
            CLAUDE_CODE_PROGRESS_BARS  = "1"
            CLAUDE_CODE_STREAM_DELAY   = "0"
            CLAUDE_CODE_STREAM_OUTPUT  = "1"
            CLAUDE_CODE_VERBOSE        = "1"
            FORCE_COLOR                = "3"
        }
        model        = "deepseek-v4-pro"
        outputStyle  = "stream"
        viewMode     = "verbose"
        theme        = "dark"
        verbose      = $true
    }

    $json = $config | ConvertTo-Json -Depth 3
    Set-Content -Path $LocalConfig -Value $json -Encoding UTF8
    Write-Host "[✓] settings.local.json 已生成" -ForegroundColor Green
}

# ─── Step 3: 验证关键密钥是否存在 ─────────────────────────────────────
Write-Host "`n=== 密钥检查 ===" -ForegroundColor Cyan
$keys = @{
    ANTHROPIC_AUTH_TOKEN = "Claude Code 后端 (DeepSeek) — 必填"
    DEEPSEEK_API_KEY     = "DeepSeek 模型路由 — 必填"
    MINIMAX_API_KEY      = "MiniMax 模型路由 — 可选"
    KIMI_API_KEY         = "Kimi K2.5 模型路由 — 可选"
}

foreach ($k in $keys.Keys) {
    $val = [System.Environment]::GetEnvironmentVariable($k)
    if ([string]::IsNullOrWhiteSpace($val)) {
        Write-Host "  [!] $k — 未设置环境变量，检查 settings.local.json..." -ForegroundColor Yellow
        if (Test-Path $LocalConfig) {
            $cfg = Get-Content $LocalConfig -Raw | ConvertFrom-Json
            if ($cfg.env.$k) {
                Write-Host "  [✓] $k — 已在 settings.local.json 中设置" -ForegroundColor Green
            } else {
                Write-Host "  [ ] $k — $($keys[$k]) — 未设置" -ForegroundColor Red
            }
        }
    } else {
        Write-Host "  [✓] $k — 已设置（环境变量）" -ForegroundColor Green
    }
}

# ─── Step 4: 全局依赖检查 ─────────────────────────────────────────────
Write-Host "`n=== 全局依赖检查 ===" -ForegroundColor Cyan
$deps = @(
    @{ Name = "lean-ctx";   Check = "lean-ctx --version";      Install = "npm install -g lean-ctx" }
    @{ Name = "ruflo";      Check = "ruflo --version";         Install = "npm install -g ruflo" }
    @{ Name = "opencli";    Check = "opencli --version";        Install = "npm install -g @jackwener/opencli" }
    @{ Name = "context-mode"; Check = "context-mode --version"; Install = "npm install -g context-mode" }
)

foreach ($dep in $deps) {
    $ok = $null -ne (Get-Command ($dep.Check.Split()[0]) -ErrorAction SilentlyContinue)
    if ($ok) {
        Write-Host "  [✓] $($dep.Name) — 已安装" -ForegroundColor Green
    } else {
        Write-Host "  [ ] $($dep.Name) — 未安装，尝试安装..." -ForegroundColor Yellow
        try {
            Invoke-Expression $dep.Install
            Write-Host "  [✓] $($dep.Name) — 安装成功" -ForegroundColor Green
        } catch {
            Write-Host "  [✗] $($dep.Name) — 安装失败: $_" -ForegroundColor Red
        }
    }
}

# ─── 完成 ──────────────────────────────────────────────────────────────
Write-Host "`n=== 安装完成 ===" -ForegroundColor Cyan
Write-Host "启动 Claude Code 前，请确保 settings.local.json 中的密钥已填写完整。"
Write-Host "运行: claude`n"
