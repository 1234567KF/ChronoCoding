# AICoding 项目本地完整安装脚本
# 将所有技能和配置安装到项目本地的 .claude/ 目录
# 支持离线安装：从 AICoding 项目复制，无需网络下载

param(
    [switch]$DryRun,           # 预览模式
    [switch]$SkipGspowers,     # 跳过 gspowers
    [switch]$SkipGstack,       # 跳过 gstack
    [switch]$SkipPipeline      # 跳过 Pipeline 扩展
)

$ErrorActionPreference = "Stop"
$SCRIPT_DIR = $PSScriptRoot
$PROJECT_ROOT = Split-Path $SCRIPT_DIR -Parent
$AUTOCODING_ROOT = Split-Path $PROJECT_ROOT -Parent

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  AICoding 项目本地安装                                 ║" -ForegroundColor Cyan
Write-Host "║  - 12 个 kf- 系列技能（稳省准测的准夯快懂）              ║" -ForegroundColor Cyan
Write-Host "║  - gspowers SOP 导航（上游）                             ║" -ForegroundColor Cyan
Write-Host "║  - gstack 产品流程框架（上游）                           ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "项目目录: $PROJECT_ROOT" -ForegroundColor White
Write-Host ""

# ═══════════════════════════════════════════════════════════════
# 创建目录结构
# ═══════════════════════════════════════════════════════════════
Write-Host "[1/5] 创建目录结构..." -ForegroundColor Yellow

$dirs = @(
    "$SCRIPT_DIR\skills\gspowers\references",
    "$SCRIPT_DIR\skills\gspowers\references\backups",
    "$SCRIPT_DIR\skills\gstack",
    "$SCRIPT_DIR\settings.d",
    "$PROJECT_ROOT\.claude-flow"
)

foreach ($dir in $dirs) {
    if (!(Test-Path $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
        Write-Host "  ✓ 创建 $dir" -ForegroundColor Gray
    }
}
Write-Host "  ✓ 目录结构已就绪" -ForegroundColor Green

# ═══════════════════════════════════════════════════════════════
# 安装 gspowers（如果存在）
# ═══════════════════════════════════════════════════════════════
if (-not $SkipGspowers) {
    Write-Host ""
    Write-Host "[2/5] 安装 gspowers..." -ForegroundColor Yellow

    $sourceGspowers = "$env:USERPROFILE\.claude\skills\gspowers"
    $targetGspowers = "$SCRIPT_DIR\skills\gspowers"

    if (Test-Path $sourceGspowers) {
        if ($DryRun) {
            Write-Host "  [DryRun] 复制 $sourceGspowers -> $targetGspowers" -ForegroundColor Cyan
        } else {
            Copy-Item -Path $sourceGspowers -Destination $targetGspowers -Recurse -Force
            Write-Host "  ✓ gspowers 已安装（从全局复制）" -ForegroundColor Green
        }
    } else {
        Write-Host "  ⚠ 全局 gspowers 不存在，跳过" -ForegroundColor Yellow
        Write-Host "    如需安装，请先运行全局安装或手动克隆" -ForegroundColor Gray
    }
}

# ═══════════════════════════════════════════════════════════════
# 安装 gstack（如果存在）
# ═══════════════════════════════════════════════════════════════
if (-not $SkipGstack) {
    Write-Host ""
    Write-Host "[3/5] 安装 gstack..." -ForegroundColor Yellow

    $sourceGstack = "$env:USERPROFILE\.claude\skills\gstack"
    $targetGstack = "$SCRIPT_DIR\skills\gstack"

    if (Test-Path $sourceGstack) {
        if ($DryRun) {
            Write-Host "  [DryRun] 复制 $sourceGstack -> $targetGstack" -ForegroundColor Cyan
        } else {
            Copy-Item -Path $sourceGstack -Destination $targetGstack -Recurse -Force
            Write-Host "  ✓ gstack 已安装（从全局复制）" -ForegroundColor Green
        }
    } else {
        Write-Host "  ⚠ 全局 gstack 不存在，跳过" -ForegroundColor Yellow
        Write-Host "    如需安装，请先运行全局安装或手动克隆" -ForegroundColor Gray
    }
}

# ═══════════════════════════════════════════════════════════════
# 安装 Pipeline 扩展
# ═══════════════════════════════════════════════════════════════
if (-not $SkipPipeline) {
    Write-Host ""
    Write-Host "[4/5] 安装 Pipeline 扩展..." -ForegroundColor Yellow

    $pipelineSource = "$PROJECT_ROOT\gspowers-pipeline-patch"
    $pipelineTargetGspowers = "$SCRIPT_DIR\skills\gspowers\references"

    if (Test-Path $pipelineSource) {
        # 复制 pipeline.md
        $sourcePipeline = Join-Path $pipelineSource "pipeline.md"
        if (Test-Path $sourcePipeline) {
            if ($DryRun) {
                Write-Host "  [DryRun] 复制 pipeline.md -> $pipelineTargetGspowers" -ForegroundColor Cyan
            } else {
                Copy-Item $sourcePipeline $pipelineTargetGspowers -Force
                Write-Host "  ✓ pipeline.md 已安装" -ForegroundColor Green
            }
        }

        # 复制 execute-patch.md
        $sourceExecutePatch = Join-Path $pipelineSource "execute-patch.md"
        if (Test-Path $sourceExecutePatch) {
            if ($DryRun) {
                Write-Host "  [DryRun] 复制 execute-patch.md -> $pipelineTargetGspowers" -ForegroundColor Cyan
            } else {
                Copy-Item $sourceExecutePatch $pipelineTargetGspowers -Force
                Write-Host "  ✓ execute-patch.md 已安装" -ForegroundColor Green
            }
        }

        # 复制安装脚本
        $sourceInstall = Join-Path $pipelineSource "install-pipeline.ps1"
        if (Test-Path $sourceInstall -and -not $DryRun) {
            Copy-Item $sourceInstall $SCRIPT_DIR -Force
            Write-Host "  ✓ install-pipeline.ps1 已复制" -ForegroundColor Green
        }
    } else {
        Write-Host "  ⚠ Pipeline 源目录不存在，跳过" -ForegroundColor Yellow
        Write-Host "    请确保 AICoding 目录完整" -ForegroundColor Gray
    }
}

# ═══════════════════════════════════════════════════════════════
# 创建配置
# ═══════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "[5/5] 创建配置文件..." -ForegroundColor Yellow

# settings.json
$sourceSettings = "$PROJECT_ROOT\templates\settings.json.template"
$targetSettings = "$SCRIPT_DIR\settings.json"

if ((Test-Path $sourceSettings) -and -not (Test-Path $targetSettings)) {
    if ($DryRun) {
        Write-Host "  [DryRun] 创建 settings.json" -ForegroundColor Cyan
    } else {
        Copy-Item $sourceSettings $targetSettings
        Write-Host "  ✓ settings.json 已创建（请编辑填入 Token）" -ForegroundColor Green
    }
} elseif (Test-Path $targetSettings) {
    Write-Host "  ○ settings.json 已存在，跳过" -ForegroundColor Gray
}

# .claude-flow config
$claudeFlowDir = "$PROJECT_ROOT\.claude-flow"
if (!(Test-Path "$claudeFlowDir\config.yaml")) {
    if ($DryRun) {
        Write-Host "  [DryRun] 创建 .claude-flow/config.yaml" -ForegroundColor Cyan
    } else {
        $configContent = @"
version: "3.0.0"

memory:
  backend: hybrid
  enableHNSW: true
  persistPath: .claude-flow/data
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
  defaultScope: project
"@
        New-Item -ItemType Directory -Force -Path $claudeFlowDir | Out-Null
        $configContent | Out-File -FilePath "$claudeFlowDir\config.yaml" -Encoding UTF8
        Write-Host "  ✓ .claude-flow/config.yaml 已创建" -ForegroundColor Green
    }
} else {
    Write-Host "  ○ .claude-flow/config.yaml 已存在，跳过" -ForegroundColor Gray
}

# ═══════════════════════════════════════════════════════════════
# 完成
# ═══════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "══════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "✓ 安装完成！" -ForegroundColor Green
Write-Host "══════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "安装摘要：" -ForegroundColor Yellow
Write-Host "  项目目录: $PROJECT_ROOT" -ForegroundColor White
Write-Host "  技能目录: $SCRIPT_DIR\skills\" -ForegroundColor White
Write-Host "  配置目录: $SCRIPT_DIR\" -ForegroundColor White
Write-Host "  记忆目录: $PROJECT_ROOT\.claude-flow\" -ForegroundColor White
Write-Host ""
Write-Host "后续步骤：" -ForegroundColor Yellow
if (-not (Test-Path $targetSettings)) {
    Write-Host "  1. 编辑 $targetSettings，填入 API Token" -ForegroundColor White
}
Write-Host "  2. 重启 Claude Code（或在项目目录启动）" -ForegroundColor White
Write-Host "  3. 测试: /gspowers" -ForegroundColor White
Write-Host "  4. 测试: /夯 [任务]" -ForegroundColor White
Write-Host "  5. 测试: spec coding" -ForegroundColor White
Write-Host "  6. 测试: /review-graph" -ForegroundColor White
Write-Host "  7. 测试: /对齐" -ForegroundColor White
Write-Host ""
Write-Host "手动安装（需要网络）：" -ForegroundColor Yellow
Write-Host "  superpowers: 在 Claude Code 中执行 /plugin install superpowers@claude-plugins-official" -ForegroundColor Gray
Write-Host ""
Write-Host "已知限制：" -ForegroundColor Yellow
Write-Host "  - ruflo、RTK 仍需全局安装（npm install -g）" -ForegroundColor Gray
Write-Host "  - superpowers 需在 Claude Code 中手动安装 plugin" -ForegroundColor Gray
Write-Host ""
