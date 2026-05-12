#!/usr/bin/env bash
# AI编程智驾 — 本地安装/更新脚本 (Linux/macOS)
#
# 生成 settings.local.json 模板，引导填写 API 密钥，安装全局依赖。
# 安全：生成的 settings.local.json 已加入 .gitignore，不会提交密钥。

set -euo pipefail

CLAUDE_DIR="${CLAUDE_DIR:-$PWD}"
LOCAL_CONFIG="$CLAUDE_DIR/settings.local.json"
GITIGNORE="$PWD/.gitignore"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

echo -e "${CYAN}=== AI编程智驾 — 本地安装 ===${NC}"

# ─── Step 1: 确保 .gitignore 包含 settings.local.json ────────────────
if [ -f "$GITIGNORE" ]; then
    if ! grep -q 'settings\.local\.json' "$GITIGNORE" 2>/dev/null; then
        printf '\n# 本地覆盖配置（含 API 密钥，不提交）\nsettings.local.json\n' >> "$GITIGNORE"
        echo -e "${GREEN}[✓] .gitignore 已追加 settings.local.json${NC}"
    fi
else
    printf '# 本地覆盖配置（含 API 密钥，不提交）\nsettings.local.json\n' > "$GITIGNORE"
    echo -e "${GREEN}[✓] 已创建 .gitignore${NC}"
fi

# ─── Step 2: 生成 settings.local.json 模板 ─────────────────────────────
if [ -f "$LOCAL_CONFIG" ]; then
    echo -e "${YELLOW}[i] settings.local.json 已存在，跳过生成。${NC}"
    echo -e "${YELLOW}    如需重置，请先删除该文件再运行此脚本。${NC}"
else
    echo -e "\n${CYAN}=== 首次安装：配置 API 密钥 ===${NC}"
    echo -e "${GRAY}以下密钥仅保存在本地 settings.local.json，不会提交到 Git。\n${NC}"

    read -rp "请输入 ANTHROPIC_AUTH_TOKEN (DeepSeek API Key): " auth_token
    read -rp "请输入 DEEPSEEK_API_KEY (回车则与 ANTHROPIC_AUTH_TOKEN 相同): " deepseek_key
    deepseek_key="${deepseek_key:-$auth_token}"

    read -rp "请输入 MINIMAX_API_KEY (回车则跳过 MiniMax): " minimax_key
    read -rp "请输入 KIMI_API_KEY (回车则跳过 Kimi): " kimi_key

    cat > "$LOCAL_CONFIG" <<LOCALJSONEOF
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "$auth_token",
    "ANTHROPIC_BASE_URL": "https://api.deepseek.com/anthropic",
    "DEEPSEEK_API_KEY": "$deepseek_key",
    "MINIMAX_API_KEY": "$minimax_key",
    "KIMI_API_KEY": "$kimi_key",
    "CLAUDE_CODE_ALWAYS_THINKING": "0",
    "CLAUDE_CODE_ENABLE_THINKING": "0",
    "CLAUDE_CODE_NO_FLICKER": "1",
    "CLAUDE_CODE_PROGRESS_BARS": "1",
    "CLAUDE_CODE_STREAM_DELAY": "0",
    "CLAUDE_CODE_STREAM_OUTPUT": "1",
    "CLAUDE_CODE_VERBOSE": "1",
    "FORCE_COLOR": "3"
  },
  "model": "deepseek-v4-pro",
  "outputStyle": "stream",
  "viewMode": "verbose",
  "theme": "dark",
  "verbose": true
}
LOCALJSONEOF
    echo -e "${GREEN}[✓] settings.local.json 已生成${NC}"
fi

# ─── Step 3: 验证关键密钥是否存在 ─────────────────────────────────────
echo -e "\n${CYAN}=== 密钥检查 ===${NC}"

check_key() {
    local var="$1"
    local desc="$2"
    local val="${!var:-}"
    if [ -n "$val" ]; then
        echo -e "  ${GREEN}[✓] $var — 已设置（环境变量）${NC}"
    elif [ -f "$LOCAL_CONFIG" ]; then
        # simple grep-based check
        if grep -q "\"$var\".*\"[^\"]" "$LOCAL_CONFIG" 2>/dev/null; then
            echo -e "  ${GREEN}[✓] $var — 已在 settings.local.json 中设置${NC}"
        else
            echo -e "  ${RED}[ ] $var — $desc — 未设置${NC}"
        fi
    else
        echo -e "  ${RED}[ ] $var — $desc — 未设置${NC}"
    fi
}

check_key "ANTHROPIC_AUTH_TOKEN" "Claude Code 后端 (DeepSeek) — 必填"
check_key "DEEPSEEK_API_KEY"     "DeepSeek 模型路由 — 必填"
check_key "MINIMAX_API_KEY"      "MiniMax 模型路由 — 可选"
check_key "KIMI_API_KEY"         "Kimi K2.5 模型路由 — 可选"

# ─── Step 4: 全局依赖检查 ─────────────────────────────────────────────
echo -e "\n${CYAN}=== 全局依赖检查 ===${NC}"

check_dep() {
    local name="$1"
    local check="$2"
    local install="$3"
    if eval "$check" 2>/dev/null; then
        echo -e "  ${GREEN}[✓] $name — 已安装${NC}"
    else
        echo -e "  ${YELLOW}[ ] $name — 未安装，尝试安装...${NC}"
        if eval "$install" 2>/dev/null; then
            echo -e "  ${GREEN}[✓] $name — 安装成功${NC}"
        else
            echo -e "  ${RED}[✗] $name — 安装失败${NC}"
        fi
    fi
}

check_dep "lean-ctx"      "lean-ctx --version"      "npm install -g lean-ctx"
check_dep "ruflo"         "ruflo --version"         "npm install -g ruflo"
check_dep "opencli"       "opencli --version"        "npm install -g @jackwener/opencli"
check_dep "context-mode"  "context-mode --version"  "npm install -g context-mode"

# ─── 完成 ──────────────────────────────────────────────────────────────
echo -e "\n${CYAN}=== 安装完成 ===${NC}"
echo -e "启动 Claude Code 前，请确保 settings.local.json 中的密钥已填写完整。"
echo -e "运行: claude\n"
