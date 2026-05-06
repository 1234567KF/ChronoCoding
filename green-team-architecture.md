# 绿队架构设计方案：.claude/ 目录保守安全重构

**版本**：v1.0  
**立场**：保守（Conservative）| 绿队  
**目标**：安全优先、零破坏、向后兼容  

---

## 1. 设计目标

### 1.1 安全优先级矩阵

| 优先级 | 目标 | 约束 |
|--------|------|------|
| P0 | 不破坏现有工作流 | 所有 hook 调用路径不变 |
| P0 | 不丢失用户配置 | settings.json 原子覆盖 |
| P1 | 透明可观测 | 变更通过 env 标签注入，不改主逻辑 |
| P2 | 可快速回滚 | 一键还原，< 1 分钟 |

### 1.2 问题域（已识别）

```
.claude/
├── settings.json          ← 大量硬编码路径，Windows 专用
├── helpers/             ← 30+ hook 处理器，调用链复杂
├── settings.local.json   ← 用户本地覆盖
├── install-local.ps1    ← 复制安装，无版本锁定
└── skills/              ← 20+ 技能，SKILL.md 分散
```

**主要风险点**：
- 硬编码绝对路径（如 `C:/Users/Administrator/AppData/Roaming/...`）→ 不可迁移
- hook 链过长（PreToolUse / PostToolUse / SessionStart / SessionEnd / PreCompact / SubagentStart / SubagentStop / Notification = 8 类，20+ 条）→ 任意一条失败影响全局
- settings.json 混排了配置项与 env 注入 → 清理困难
- 无版本快照 → 重构无锚点

---

## 2. 重构方案

### 2.1 分层策略：Env 注入层（最保守）

**原则**：不动主配置，只在 `env` 字段注入安全哨兵变量，主逻辑通过读取 env 自我约束。

```
现状：
settings.json → helpers/* → 直接执行

重构后：
settings.json → env 注入安全哨兵 → helpers/* 读取 env 自我约束
```

**具体改动**：

#### 改动 A：注入安全哨兵（新增行）

在 `settings.json` 的 `env` 中新增 3 行哨兵：

```jsonc
"_green_safety_guard": "1",           // 绿队安全模式总开关
"_green_max_hook_timeout": "8000",    // 单 hook 超时上限 8s（原 15s）
"_green_deny_destructive": "1"         // 禁止破坏性操作哨兵（helpers 读取此变量自我约束）
```

**风险**：极低。纯注入，无删除，env 值不影响主逻辑。

#### 改动 B：helpers 自我约束（轻量）

修改 `hook-handler.cjs`，在执行前后增加哨兵读取逻辑：

```js
// 读取哨兵
const guard = process.env._green_safety_guard;
const maxTimeout = parseInt(process.env._green_max_hook_timeout || '8000');

// 超时强制中断
const originalExec = exec;
exec = (cmd, opts = {}) => {
  opts.timeout = Math.min(opts.timeout || 15000, maxTimeout);
  return originalExec(cmd, opts);
};
```

**风险**：低。只影响本文件，条件分支，不改变默认行为。

#### 改动 C：建立版本快照（安全锚点）

在 `.claude/settings.json.bak` 建立时间戳快照：

```bash
# PowerShell 一行命令
Copy-Item .claude/settings.json ".claude/settings.json.bak.$(Get-Date -Format 'yyyyMMdd-HHmmss')"
```

#### 改动 D：settings.local.json 显式化（用户覆盖隔离）

将用户本地配置隔离到 `settings.local.json`，与主配置解耦：

```jsonc
// settings.local.json（新建）
{
  "model": "用户偏好模型",
  "verbose": true
}
```

### 2.2 重构后的目录结构

```
.claude/
├── settings.json              ← 原始（已快照）
├── settings.json.bak.*         ← 时间戳快照（自动）
├── settings.local.json         ← 新建：用户覆盖层
├── settings.safe.json          ← 新建：绿队安全配置（可一键加载）
├── helpers/
│   ├── hook-handler.cjs        ← 改动B：自我约束版
│   └── ...                     ← 其余不变
└── ...
```

---

## 3. 回滚方案

### 3.1 一键回滚（最坏情况）

```powershell
# 方法 1：还原 settings.json（从最新快照）
Copy-Item .claude/settings.json.bak.*[-1] .claude/settings.json

# 方法 2：删除哨兵行（直接编辑）
# 删除 settings.json 中 _green_ 开头的 3 行 env 字段

# 方法 3：加载安全配置
Copy-Item .claude/settings.safe.json .claude/settings.json
```

### 3.2 分步回滚

| 步骤 | 操作 | 目标 |
|------|------|------|
| R1 | 删除 `settings.json` 中的 3 行 `_green_` env | 移除安全哨兵 |
| R2 | 还原 `hook-handler.cjs` | 移除超时约束 |
| R3 | 删除 `settings.local.json` | 移除覆盖层 |

### 3.3 回滚验证

```bash
node .claude/helpers/harness-gate-check.cjs
```

---

## 4. 不触碰清单（硬约束）

以下内容**本次重构不变动**：

- `helpers/` 下除 `hook-handler.cjs` 外的所有文件
- `skills/` 目录及 SKILL.md
- `install-local.ps1` 和 `install-local.sh`
- `commands/` 和 `agents/` 目录
- `settings.json` 的 `hooks` 主逻辑（只注入，不删除）

---

## 5. 评估摘要

| 维度 | 评估 |
|------|------|
| 改动范围 | 仅 settings.json（+3行）+ hook-handler.cjs（条件分支） |
| 破坏性 | **零破坏**，所有改动可独立撤销 |
| 向后兼容 | 完全兼容，env 哨兵不影响无读取意识的 helpers |
| 回滚成本 | < 1 分钟，单行删除即可完全还原 |
| 风险等级 | **低** |
