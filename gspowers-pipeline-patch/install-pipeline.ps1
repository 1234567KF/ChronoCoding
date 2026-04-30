# gspowers Pipeline 扩展自动安装脚本
# 用于在新环境中快速部署多模块流水线功能
# 支持两种模式：
#   1. 全局安装: 安装到 ~/.claude/skills/gspowers/ (默认)
#   2. 项目本地安装: 安装到本项目 .claude/skills/gspowers/

param(
    [switch]$DryRun,           # 预览模式，不实际执行
    [switch]$ProjectLocal      # 项目本地安装模式
)

$ErrorActionPreference = "Stop"

# 根据模式选择安装路径
if ($ProjectLocal) {
    # 项目本地安装
    $SCRIPT_DIR = $PSScriptRoot
    $PROJECT_ROOT = Split-Path $SCRIPT_DIR -Parent
    $GSFOWERS_DIR = "$PROJECT_ROOT\.claude\skills\gspowers\references"
    $PATCH_DIR = $SCRIPT_DIR
    $INSTALL_MODE = "项目本地"
} else {
    # 全局安装（默认）
    $GSFOWERS_DIR = "$env:USERPROFILE\.claude\skills\gspowers\references"
    $PATCH_DIR = "d:\projects\AI编程智驾\gspowers-pipeline-patch"
    $INSTALL_MODE = "全局"
}

Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "gspowers Pipeline 扩展安装脚本" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "安装模式: $INSTALL_MODE" -ForegroundColor $(if ($INSTALL_MODE -eq "项目本地") { "Green" } else { "Yellow" })
Write-Host ""

# 检查源文件是否存在
Write-Host "[1/3] 检查源文件..." -ForegroundColor Yellow

$sourcePipeline = Join-Path $PATCH_DIR "pipeline.md"
$sourceExecutePatch = Join-Path $PATCH_DIR "execute-patch.md"

if (!(Test-Path $sourcePipeline)) {
    Write-Host "  ✗ 源文件不存在: $sourcePipeline" -ForegroundColor Red
    Write-Host "  请确保补丁文件位于正确位置" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ pipeline.md 源文件存在" -ForegroundColor Green

if (!(Test-Path $sourceExecutePatch)) {
    Write-Host "  ✗ 源文件不存在: $sourceExecutePatch" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ execute-patch.md 源文件存在" -ForegroundColor Green

# 检查目标目录
Write-Host ""
Write-Host "[2/3] 检查目标目录..." -ForegroundColor Yellow

$targetDir = $GSFOWERS_DIR
if ($ProjectLocal) {
    # 项目本地模式：目录可能不存在，需要创建
    if (!(Test-Path $targetDir)) {
        New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
        Write-Host "  ✓ 创建目标目录: $targetDir" -ForegroundColor Green
    } else {
        Write-Host "  ✓ 目标目录存在: $targetDir" -ForegroundColor Green
    }
} else {
    # 全局模式：目录必须已存在
    if (!(Test-Path $targetDir)) {
        Write-Host "  ✗ 目标目录不存在: $targetDir" -ForegroundColor Red
        Write-Host "  请先安装 gspowers" -ForegroundColor Red
        exit 1
    }
    Write-Host "  ✓ 目标目录存在: $targetDir" -ForegroundColor Green
}

# 检查原始 execute.md（全局模式必须存在，本地模式可跳过）
$originalExecute = Join-Path $targetDir "execute.md"
if ($ProjectLocal) {
    if (!(Test-Path $originalExecute)) {
        Write-Host "  ○ 原始 execute.md 不存在，将创建新文件" -ForegroundColor Gray
    } else {
        Write-Host "  ✓ 原始 execute.md 存在" -ForegroundColor Green
    }
} else {
    if (!(Test-Path $originalExecute)) {
        Write-Host "  ✗ 原始文件不存在: $originalExecute" -ForegroundColor Red
        exit 1
    }
    Write-Host "  ✓ 原始 execute.md 存在" -ForegroundColor Green
}

# 备份原始文件
Write-Host ""
Write-Host "[3/3] 备份和安装..." -ForegroundColor Yellow

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path $targetDir "backups\$timestamp"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

Write-Host "  创建备份目录: $backupDir" -ForegroundColor Gray

if ($DryRun) {
    Write-Host "  [DryRun] 备份 execute.md -> $backupDir\execute.md.bak" -ForegroundColor Cyan
    Write-Host "  [DryRun] 复制 pipeline.md -> $targetDir\pipeline.md" -ForegroundColor Cyan
    Write-Host "  [DryRun] 修改 execute.md (需要手动应用补丁)" -ForegroundColor Cyan
} else {
    # 备份
    Copy-Item $originalExecute "$backupDir\execute.md.bak" -Force
    Write-Host "  ✓ 备份 execute.md -> $backupDir\execute.md.bak" -ForegroundColor Green

    # 复制新文件 pipeline.md
    Copy-Item $sourcePipeline "$targetDir\pipeline.md" -Force
    Write-Host "  ✓ 复制 pipeline.md" -ForegroundColor Green

    # 注意：execute.md 的修改需要手动应用
    # 因为需要根据现有文件内容进行智能合并
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "安装完成！($INSTALL_MODE 模式)" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "安装位置: $targetDir" -ForegroundColor White
Write-Host ""
Write-Host "后续步骤：" -ForegroundColor Yellow
Write-Host "  1. 打开: $originalExecute" -ForegroundColor White
Write-Host "  2. 参考: $sourceExecutePatch" -ForegroundColor White
Write-Host "  3. 将 execute-patch.md 中的 subagent-dev 替换为新版本" -ForegroundColor White
Write-Host ""
if ($ProjectLocal) {
    Write-Host "项目本地安装说明：" -ForegroundColor Cyan
    Write-Host "  - gspowers 已安装到 .claude/skills/gspowers/" -ForegroundColor White
    Write-Host "  - 打开 Claude Code 时需在项目目录下运行" -ForegroundColor White
    Write-Host "  - 其他项目需要单独安装" -ForegroundColor Gray
    Write-Host ""
}
Write-Host "或者让 AI 执行以下命令自动应用补丁：" -ForegroundColor Yellow
Write-Host '  1. Read execute.md' -ForegroundColor Gray
Write-Host '  2. 根据 execute-patch.md 描述进行修改' -ForegroundColor Gray
Write-Host '  3. Write 修改后的 execute.md' -ForegroundColor Gray
Write-Host ""

# 显示修改摘要
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "修改摘要" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "新增文件:" -ForegroundColor Yellow
if ($ProjectLocal) {
    Write-Host "  + .claude/skills/gspowers/references/pipeline.md" -ForegroundColor White
} else {
    Write-Host "  + references/pipeline.md" -ForegroundColor White
}
Write-Host "    - 多模块流水线开发完整规范" -ForegroundColor Gray
Write-Host "    - 包含依赖解析、批次编排、门控验证逻辑" -ForegroundColor Gray
Write-Host ""
Write-Host "修改文件:" -ForegroundColor Yellow
if ($ProjectLocal) {
    Write-Host "  ~ .claude/skills/gspowers/references/execute.md" -ForegroundColor White
} else {
    Write-Host "  ~ references/execute.md" -ForegroundColor White
}
Write-Host "    - subagent-dev 步骤新增 Pipeline 模式检测" -ForegroundColor Gray
Write-Host "    - 新增 pipeline-dev 子步骤（init/execute/gate/complete）" -ForegroundColor Gray
Write-Host "    - 新增 state.json pipeline 节点定义" -ForegroundColor Gray
Write-Host ""
Write-Host "state.json schema 变更:" -ForegroundColor Yellow
Write-Host "  + pipeline.enabled: boolean" -ForegroundColor White
Write-Host "  + pipeline.modules: object" -ForegroundColor White
Write-Host "  + pipeline.batches: array" -ForegroundColor White
Write-Host "  + pipeline.current_batch: number" -ForegroundColor White
