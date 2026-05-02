#!/bin/bash
# AutoCoding 项目本地完整安装脚本
# 跨平台支持：Linux、macOS、Windows (Git Bash/WSL)
# 用法: ./install-local.sh [--dry-run] [--skip-gspowers] [--skip-gstack] [--skip-pipeline]

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 默认参数
DRY_RUN=false
SKIP_GSPOWERS=false
SKIP_GSTACK=false
SKIP_PIPELINE=false

# 解析参数
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --skip-gspowers)
            SKIP_GSPOWERS=true
            shift
            ;;
        --skip-gstack)
            SKIP_GSTACK=true
            shift
            ;;
        --skip-pipeline)
            SKIP_PIPELINE=true
            shift
            ;;
        *)
            echo "未知参数: $1"
            exit 1
            ;;
    esac
done

# 获取脚本目录和项目根目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Windows 路径转换
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    PROJECT_ROOT="$(cygpath -w "$PROJECT_ROOT" 2>/dev/null || echo "$PROJECT_ROOT")"
fi

echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  AutoCoding 项目本地安装 (跨平台)                       ║${NC}"
echo -e "${CYAN}║  - 12 个 kf- 系列技能（稳省准测的准夯快懂）              ║${NC}"
echo -e "${CYAN}║  - gspowers SOP 导航（上游）                             ║${NC}"
echo -e "${CYAN}║  - gstack 产品流程框架（上游）                           ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "项目目录: ${PROJECT_ROOT}"
echo ""

# ═══════════════════════════════════════════════════════════════
# 创建目录结构
# ═══════════════════════════════════════════════════════════════
echo -e "${YELLOW}[1/5] 创建目录结构...${NC}"

dirs=(
    "$SCRIPT_DIR/skills/gspowers/references"
    "$SCRIPT_DIR/skills/gspowers/references/backups"
    "$SCRIPT_DIR/skills/gstack"
    "$SCRIPT_DIR/settings.d"
)

for dir in "${dirs[@]}"; do
    if [ ! -d "$dir" ]; then
        mkdir -p "$dir"
        echo -e "  ✓ 创建 $dir"
    fi
done
echo -e "  ✓ 目录结构已就绪"

# 获取全局 .claude 路径
CLAUDE_HOME="${CLAUDE_HOME:-$HOME/.claude}"

# ═══════════════════════════════════════════════════════════════
# 安装 gspowers
# ═══════════════════════════════════════════════════════════════
if [ "$SKIP_GSPOWERS" = false ]; then
    echo ""
    echo -e "${YELLOW}[2/5] 安装 gspowers...${NC}"

    SOURCE_GSPOWERS="$CLAUDE_HOME/skills/gspowers"
    TARGET_GSPOWERS="$SCRIPT_DIR/skills/gspowers"

    if [ -d "$SOURCE_GSPOWERS" ]; then
        if [ "$DRY_RUN" = true ]; then
            echo -e "  [DryRun] 复制 $SOURCE_GSPOWERS -> $TARGET_GSPOWERS"
        else
            cp -r "$SOURCE_GSPOWERS" "$TARGET_GSPOWERS"
            echo -e "  ✓ gspowers 已安装（从全局复制）"
        fi
    else
        echo -e "  ⚠ 全局 gspowers 不存在，跳过"
        echo -e "    如需安装，请先运行全局安装或手动克隆"
    fi
fi

# ═══════════════════════════════════════════════════════════════
# 安装 gstack
# ═══════════════════════════════════════════════════════════════
if [ "$SKIP_GSTACK" = false ]; then
    echo ""
    echo -e "${YELLOW}[3/5] 安装 gstack...${NC}"

    SOURCE_GSTACK="$CLAUDE_HOME/skills/gstack"
    TARGET_GSTACK="$SCRIPT_DIR/skills/gstack"

    if [ -d "$SOURCE_GSTACK" ]; then
        if [ "$DRY_RUN" = true ]; then
            echo -e "  [DryRun] 复制 $SOURCE_GSTACK -> $TARGET_GSTACK"
        else
            cp -r "$SOURCE_GSTACK" "$TARGET_GSTACK"
            echo -e "  ✓ gstack 已安装（从全局复制）"
        fi
    else
        echo -e "  ⚠ 全局 gstack 不存在，跳过"
        echo -e "    如需安装，请先运行全局安装或手动克隆"
    fi
fi

# ═══════════════════════════════════════════════════════════════
# 安装 Pipeline 扩展
# ═══════════════════════════════════════════════════════════════
if [ "$SKIP_PIPELINE" = false ]; then
    echo ""
    echo -e "${YELLOW}[4/5] 安装 Pipeline 扩展...${NC}"

    PIPELINE_SOURCE="$PROJECT_ROOT/gspowers-pipeline-patch"
    PIPELINE_TARGET="$SCRIPT_DIR/skills/gspowers/references"

    if [ -d "$PIPELINE_SOURCE" ]; then
        # 复制 pipeline.md
        if [ -f "$PIPELINE_SOURCE/pipeline.md" ]; then
            if [ "$DRY_RUN" = true ]; then
                echo -e "  [DryRun] 复制 pipeline.md -> $PIPELINE_TARGET"
            else
                cp "$PIPELINE_SOURCE/pipeline.md" "$PIPELINE_TARGET/"
                echo -e "  ✓ pipeline.md 已安装"
            fi
        fi

        # 复制 execute-patch.md
        if [ -f "$PIPELINE_SOURCE/execute-patch.md" ]; then
            if [ "$DRY_RUN" = true ]; then
                echo -e "  [DryRun] 复制 execute-patch.md -> $PIPELINE_TARGET"
            else
                cp "$PIPELINE_SOURCE/execute-patch.md" "$PIPELINE_TARGET/"
                echo -e "  ✓ execute-patch.md 已安装"
            fi
        fi

        # 复制安装脚本
        if [ -f "$PIPELINE_SOURCE/install-pipeline.ps1" ] && [ "$DRY_RUN" = false ]; then
            cp "$PIPELINE_SOURCE/install-pipeline.ps1" "$SCRIPT_DIR/"
            echo -e "  ✓ install-pipeline.ps1 已复制"
        fi
    else
        echo -e "  ⚠ Pipeline 源目录不存在，跳过"
        echo -e "    请确保 AutoCoding 目录完整"
    fi
fi

# ═══════════════════════════════════════════════════════════════
# 创建配置文件
# ═══════════════════════════════════════════════════════════════
echo ""
echo -e "${YELLOW}[5/5] 创建配置文件...${NC}"

# settings.json
AUTOCODING_TEMPLATES="$PROJECT_ROOT/templates"
TARGET_SETTINGS="$SCRIPT_DIR/settings.json"

if [ -f "$AUTOCODING_TEMPLATES/settings.json.template" ] && [ ! -f "$TARGET_SETTINGS" ]; then
    if [ "$DRY_RUN" = true ]; then
        echo -e "  [DryRun] 创建 settings.json"
    else
        cp "$AUTOCODING_TEMPLATES/settings.json.template" "$TARGET_SETTINGS"
        echo -e "  ✓ settings.json 已创建（请编辑填入 Token）"
    fi
elif [ -f "$TARGET_SETTINGS" ]; then
    echo -e "  ○ settings.json 已存在，跳过"
fi

# .claude-flow config
CLAUDE_FLOW_DIR="$PROJECT_ROOT/.claude-flow"
if [ ! -f "$CLAUDE_FLOW_DIR/config.yaml" ]; then
    if [ "$DRY_RUN" = true ]; then
        echo -e "  [DryRun] 创建 .claude-flow/config.yaml"
    else
        mkdir -p "$CLAUDE_FLOW_DIR"
        cat > "$CLAUDE_FLOW_DIR/config.yaml" << 'EOF'
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
EOF
        echo -e "  ✓ .claude-flow/config.yaml 已创建"
    fi
else
    echo -e "  ○ .claude-flow/config.yaml 已存在，跳过"
fi

# ═══════════════════════════════════════════════════════════════
# 完成
# ═══════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}══════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ 安装完成！${NC}"
echo -e "${CYAN}══════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}安装摘要：${NC}"
echo -e "  项目目录: ${PROJECT_ROOT}"
echo -e "  技能目录: ${SCRIPT_DIR}/skills/"
echo -e "  配置目录: ${SCRIPT_DIR}/"
echo -e "  记忆目录: ${PROJECT_ROOT}/.claude-flow/"
echo ""
echo -e "${YELLOW}后续步骤：${NC}"
if [ ! -f "$TARGET_SETTINGS" ]; then
    echo -e "  1. 编辑 ${TARGET_SETTINGS}，填入 API Token"
fi
echo -e "  2. 重启 Claude Code（或在项目目录启动）"
echo -e "  3. 测试: /gspowers"
echo -e "  4. 测试: /夯 [任务]"
echo -e "  5. 测试: spec coding"
echo -e "  6. 测试: /review-graph"
echo -e "  7. 测试: /对齐"
echo ""
echo -e "${YELLOW}手动安装（需要网络）：${NC}"
echo -e "  superpowers: 在 Claude Code 中执行 /plugin install superpowers@claude-plugins-official"
echo ""
echo -e "${YELLOW}已知限制：${NC}"
echo -e "  - ruflo、RTK 仍需全局安装（npm install -g）"
echo -e "  - superpowers 需在 Claude Code 中手动安装 plugin"
echo ""
