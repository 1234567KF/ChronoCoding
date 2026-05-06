# 蓝队实施步骤：.claude/ 目录稳健均衡重构

**对应架构方案**：blue-team-architecture.md  
**总预估时间**：2-3 小时  
**前置条件**：已完成 git commit（确保有恢复点）

---

## 步骤一：settings.json 拆分（预估 30 分钟）

### 1.1 创建备份

```powershell
cd D:\AICoding
Copy-Item .claude\settings.json .claude\settings.json.backup-blue-$(Get-Date -Format 'yyyyMMdd-HHmmss')
```

### 1.2 提取 hooks

从 `settings.json` 中将整个 `hooks` 对象剪切到新文件 `.claude/hooks.json`：
- hooks.json 格式与原 hooks 结构完全一致（顶层 `{"hooks": {...}}`）
- settings.json 中替换为：`"hooks": { "$include": "./hooks.json" }`

> ⚠️ **注意**：需先验证 Claude Code 版本是否支持 `$include` 语法。若不支持，此步骤降级为"仅格式化 settings.json，不拆分"。

### 1.3 验证

```powershell
# 检查 JSON 格式
node -e "JSON.parse(require('fs').readFileSync('.claude/hooks.json','utf8')); console.log('hooks.json OK')"
node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8')); console.log('settings.json OK')"

# 启动 Claude Code 测试 hook 是否正常
claude --version
```

---

## 步骤二：helpers/ 分类归档（预估 1 小时）

### 2.1 创建子目录

```powershell
cd D:\AICoding
New-Item -ItemType Directory -Force -Path .claude\helpers\hooks
New-Item -ItemType Directory -Force -Path .claude\helpers\session
New-Item -ItemType Directory -Force -Path .claude\helpers\ops
```

### 2.2 移动文件

```powershell
# Hook 处理器 → helpers/hooks/
$hookFiles = @(
    'hook-handler.cjs', 'alignment-hook.cjs', 'harness-gate-check.cjs',
    'harness-audit.cjs', 'model-router-hook.cjs', 'skill-monitor.cjs',
    'auto-memory-hook.mjs', 'guidance-hook.sh', 'guidance-hooks.sh',
    'hammer-bridge.cjs', 'github-safe.js'
)
foreach ($f in $hookFiles) {
    if (Test-Path ".claude\helpers\$f") {
        Move-Item ".claude\helpers\$f" ".claude\helpers\hooks\$f"
    }
}

# 会话管理 → helpers/session/
$sessionFiles = @(
    'statusline.cjs', 'statusline.js', 'statusline-hook.sh',
    'cost-tracker.cjs', 'session.js', 'memory.js', 'intelligence.cjs',
    'metrics-db.mjs', 'learning-service.mjs'
)
foreach ($f in $sessionFiles) {
    if (Test-Path ".claude\helpers\$f") {
        Move-Item ".claude\helpers\$f" ".claude\helpers\session\$f"
    }
}

# 运维工具 → helpers/ops/
# 剩余所有 .sh 文件和非核心 .cjs 文件
$opsFiles = @(
    'daemon-manager.sh', 'health-monitor.sh', 'security-scanner.sh',
    'swarm-comms.sh', 'swarm-hooks.sh', 'swarm-monitor.sh',
    'learning-hooks.sh', 'learning-optimizer.sh', 'pattern-consolidator.sh',
    'perf-worker.sh', 'worker-manager.sh', 'auto-commit.sh',
    'checkpoint-manager.sh', 'quick-start.sh', 'setup-mcp.sh',
    'github-setup.sh', 'v3.sh', 'sync-v3-metrics.sh',
    'update-v3-progress.sh', 'v3-quick-status.sh', 'validate-v3-config.sh',
    'standard-checkpoint-hooks.sh', 'adr-compliance.sh', 'ddd-tracker.sh',
    'router.js'
)
foreach ($f in $opsFiles) {
    if (Test-Path ".claude\helpers\$f") {
        Move-Item ".claude\helpers\$f" ".claude\helpers\ops\$f"
    }
}
```

### 2.3 创建代理文件（关键！）

为 settings.json 直接引用的文件创建代理：

```powershell
# hook-handler.cjs 是最关键的（被 PreToolUse/PostToolUse/SessionStart 等多处引用）
# 创建代理
$proxy = @'
// Auto-generated proxy - Blue Team refactor
// Real file: ./hooks/hook-handler.cjs
module.exports = require('./hooks/hook-handler');
'@
Set-Content -Path ".claude\helpers\hook-handler.cjs" -Value $proxy -Encoding UTF8

# statusline.cjs（被 statusLine 配置引用）
$proxy2 = @'
// Auto-generated proxy - Blue Team refactor
// Real file: ./session/statusline.cjs
module.exports = require('./session/statusline');
'@
Set-Content -Path ".claude\helpers\statusline.cjs" -Value $proxy2 -Encoding UTF8

# model-router-hook.cjs（被 Skill hook 引用）
$proxy3 = @'
// Auto-generated proxy - Blue Team refactor
// Real file: ./hooks/model-router-hook.cjs
module.exports = require('./hooks/model-router-hook');
'@
Set-Content -Path ".claude\helpers\model-router-hook.cjs" -Value $proxy3 -Encoding UTF8
```

### 2.4 验证

```powershell
# 测试代理文件能正确加载
node -e "require('./.claude/helpers/hook-handler'); console.log('hook-handler proxy OK')"
node -e "require('./.claude/helpers/statusline'); console.log('statusline proxy OK')"

# 在 Claude Code 中测试一次 hook 触发
claude -p "echo test"
```

---

## 步骤三：技能索引（预估 20 分钟，可选）

### 3.1 创建索引文件

```powershell
cd D:\AICoding
```

手动创建 `.claude/skills/_index.json`（内容见 architecture.md 2.3 节），仅索引 22 个 kf- 自建技能。

### 3.2 验证

```powershell
node -e "const idx = require('./.claude/skills/_index.json'); console.log(`Indexed ${idx.kf.length} kf-skills`)"
```

---

## 回滚方案

### 完整回滚（一键还原）

```powershell
cd D:\AICoding

# 还原 helpers/
# 删除子目录（代理文件被 git 还原）
git checkout -- .claude/helpers/

# 删除新增文件
Remove-Item .claude\hooks.json -ErrorAction SilentlyContinue
Remove-Item .claude\skills\_index.json -ErrorAction SilentlyContinue

# 还原 settings.json
git checkout -- .claude/settings.json

# 验证
git status
```

### 分阶段回滚

| 回滚目标 | 命令 |
|---------|------|
| 仅回滚阶段二 | `git checkout -- .claude/helpers/` |
| 仅回滚阶段一 | `git checkout -- .claude/settings.json; Remove-Item .claude\hooks.json` |
| 仅回滚阶段三 | `Remove-Item .claude\skills\_index.json` |

### 回滚验证

回滚后执行：
```powershell
claude -p "列出所有技能"
```
确认正常工作即回滚成功。
