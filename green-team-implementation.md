# 绿队实施步骤：.claude/ 目录保守安全重构

**版本**：v1.0  
**立场**：保守 | 绿队  
**预计总时间**：约 5 分钟  

---

## 步骤 0：前置检查（可选，推荐）

```powershell
# 检查 helpers/hook-handler.cjs 是否存在
Test-Path .claude/helpers/hook-handler.cjs

# 检查 settings.json 当前行数
(Get-Content .claude/settings.json).Count
```

> 风险等级：**无风险** — 仅检查，不修改

---

## 步骤 1：建立版本快照（安全锚点）

```powershell
# 在 .claude/ 目录下执行
Copy-Item .claude/settings.json ".claude/settings.json.bak.$(Get-Date -Format 'yyyyMMdd-HHmmss')"
```

**说明**：复制当前 `settings.json` 为带时间戳的备份文件（例：`settings.json.bak.20260506-081500`）  
**验证**：`Get-ChildItem .claude/settings.json.bak.*`

| 项目 | 描述 |
|------|------|
| 风险等级 | **低** — 纯复制操作，无删除 |
| 影响范围 | 仅创建新文件 |
| 回滚方式 | 直接删除快照文件 |

---

## 步骤 2：注入安全哨兵到 settings.json

在 `env` 字段新增 3 行（插入位置：在现有 env 字段末尾）：

```jsonc
{
  "env": {
    // ... 现有 env 内容 ...
    "_green_safety_guard": "1",
    "_green_max_hook_timeout": "8000",
    "_green_deny_destructive": "1"
  }
}
```

**PowerShell 精确插入命令**：

```powershell
$json = Get-Content .claude/settings.json -Raw | ConvertFrom-Json
$json.env | Add-Member -NotePropertyName "_green_safety_guard" -NotePropertyValue "1" -Force
$json.env | Add-Member -NotePropertyName "_green_max_hook_timeout" -NotePropertyValue "8000" -Force
$json.env | Add-Member -NotePropertyName "_green_deny_destructive" -NotePropertyValue "1" -Force
$json | ConvertTo-Json -Depth 10 | Set-Content .claude/settings.json -Encoding UTF8
```

**验证**：

```powershell
$json = Get-Content .claude/settings.json -Raw | ConvertFrom-Json
$json.env._green_safety_guard    # 应输出 1
$json.env._green_max_hook_timeout # 应输出 8000
$json.env._green_deny_destructive # 应输出 1
```

| 项目 | 描述 |
|------|------|
| 风险等级 | **低** — 仅新增键值，不删除不修改现有内容 |
| 影响范围 | 仅影响 env 字段，hooks 逻辑不变 |
| 回滚方式 | 删除上述 3 行即可完全还原 |

---

## 步骤 3：修改 helpers/hook-handler.cjs 自我约束

在 `hook-handler.cjs` 顶部添加哨兵读取逻辑（约 5 行）：

```js
// ===== 绿队安全哨兵（头部注入，不改主逻辑）=====
const guard = process.env._green_safety_guard;
const maxTimeout = parseInt(process.env._green_max_hook_timeout || '8000');
if (guard === '1') {
  console.log('[Green Guard] Safety mode active, max hook timeout:', maxTimeout);
}
// =============================================
```

在 `exec` 或子进程调用处添加超时约束：

```js
// 在 exec 调用处（约 line 80-100，找到 child_process.spawn/exec 处添加）：
const originalSpawn = child_process.spawn;
// 替换为带超时约束的版本（条件分支，仅在 _green_safety_guard=1 时激活）
```

**回滚**：还原步骤 1 的快照即可。

| 项目 | 描述 |
|------|------|
| 风险等级 | **中低** — 修改代码文件，但有快照兜底 |
| 影响范围 | 仅 hook-handler.cjs |
| 回滚方式 | 从快照还原，或删除添加的 5-10 行 |

---

## 风险总览

| 步骤 | 操作 | 风险等级 | 回滚成本 |
|------|------|---------|---------|
| 步骤 0 | 前置检查 | **无** | — |
| 步骤 1 | 快照复制 | **低** | < 1 分钟 |
| 步骤 2 | 注入哨兵 | **低** | < 1 分钟 |
| 步骤 3 | 修改 hook-handler.cjs | **中低** | < 1 分钟（从快照还原）|

**最坏情况回滚**：覆盖还原 settings.json + 还原 hook-handler.cjs，合计 < 2 分钟。

---

## 成功标准

- [ ] `settings.json` 包含 3 行 `_green_` 开头的新 env 字段
- [ ] `.claude/settings.json.bak.*` 时间戳快照存在
- [ ] `hook-handler.cjs` 包含哨兵读取逻辑
- [ ] Claude Code 可正常启动（hook 链无断裂）
- [ ] 回滚验证：`Remove-Item settings.json` 后用快照还原，Claude Code 正常
