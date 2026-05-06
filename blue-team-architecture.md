# 蓝队架构设计方案：.claude/ 目录稳健均衡重构

**版本**：v1.0  
**立场**：稳健均衡（Balanced）| 蓝队  
**目标**：渐进改善、适中风险、效率优先  

---

## 1. 设计目标

### 1.1 核心原则

| 原则 | 说明 |
|------|------|
| **渐进式** | 分阶段执行，每阶段独立可验证，不搞大爆炸式重写 |
| **效率优先** | 先解决 token 消耗最大、故障率最高的热点 |
| **适度抽象** | 只在有明确收益时才引入新结构，不为了"优雅"而重构 |
| **向后兼容** | 保留所有现有技能的触发路径，零破坏性变更 |

### 1.2 问题诊断（共识）

与红绿队一致，核心问题：
- **Hook 链过长**：8 类 hook、20+ 条规则，单次操作最多触发 5 个外部进程
- **settings.json 臃肿**：配置 + env + hooks 混排，4KB+ 难维护
- **helpers/ 散乱**：42 个脚本无分类，职责边界模糊
- **硬编码路径**：Windows 绝对路径不可迁移

### 1.3 蓝队差异化判断

| 问题 | 绿队（保守） | 红队（激进） | 蓝队（均衡） |
|------|-------------|-------------|-------------|
| settings.json | 不动，env 标签注入 | 推倒重写为模板 | **拆分 hooks + env**，保留核心配置 |
| helpers/ | 不动，加注释 | 重构成 4 层 | **按功能分 3 个子目录**，原文件不动 |
| skills/ 88个 | 不动 | 全部分类注册表 | **只索引 kf- 自建系列**（22个），第三方不动 |
| commands/ | 不动 | 合并入 skills | **保留不动**，与 skills 职责不同 |
| agents/ | 不动 | 全面分类 | **保留不动**，当前规模（23）尚可管理 |

---

## 2. 重构方案

### 2.1 阶段一：settings.json 拆分（收益最大，风险最低）

**现状**：settings.json（4KB+）混排了 hooks、permissions、env、mcpServers、claudeFlow
**目标**：hooks 配置外置，settings.json 只保留核心配置

```
.claude/
├── settings.json          ← 保留：env, permissions, mcpServers, claudeFlow, model
├── hooks.json             ← 【新增】所有 hook 定义（从 settings.json 迁出）
├── settings.local.json    ← 保留不动
```

**具体改动**：
1. 将 settings.json 中的 `hooks` 整个对象提取到 `hooks.json`
2. settings.json 中添加 `"hooks": "./hooks.json"` 引用
3. hooks.json 格式与原 hooks 结构完全一致，零逻辑变更

**收益**：
- settings.json 缩减 60%+，可读性大幅提升
- hooks 独立版本控制，修改不影响其他配置
- Claude Code 原生支持 hooks.json（`$include` 或同级加载）

### 2.2 阶段二：helpers/ 分类归档（物理移动，不改逻辑）

**现状**：42 个脚本扁平存放
**目标**：按功能分 3 组，物理归类但 import 路径不变

```
helpers/
├── hooks/                 ← 【新增子目录】Hook 处理器
│   ├── hook-handler.cjs   ← 移入（原位置保留软链接/代理）
│   ├── alignment-hook.cjs
│   ├── harness-gate-check.cjs
│   ├── harness-audit.cjs
│   ├── model-router-hook.cjs
│   ├── skill-monitor.cjs
│   ├── auto-memory-hook.mjs
│   └── guidance-hook.sh
├── session/               ← 【新增子目录】会话生命周期
│   ├── statusline.cjs
│   ├── statusline.js
│   ├── cost-tracker.cjs
│   ├── session.js
│   ├── memory.js
│   └── intelligence.cjs
├── ops/                   ← 【新增子目录】运维工具
│   ├── daemon-manager.sh
│   ├── health-monitor.sh
│   ├── security-scanner.sh
│   ├── swarm-*.sh
│   ├── learning-*.sh
│   └── ...
└── README.md              ← 更新：反映新结构
```

**关键策略**：原位置的 hook-handler.cjs 等被 settings.json 直接引用的文件，保留一个 **代理文件**（3 行 re-export），确保现有引用不断。

```javascript
// helpers/hook-handler.cjs（代理，保留原位置）
module.exports = require('./hooks/hook-handler');
```

**收益**：
- helpers/ 从 42 个文件变为 3 个子目录，查找效率 3x+
- 不改 settings.json 中任何引用路径
- 新脚本有明确归属，不再堆积

### 2.3 阶段三：kf- 技能索引文件（可选，低优先级）

**现状**：22 个 kf- 技能 + 66 个第三方技能混放，靠 CLAUDE.md 手动维护表格
**目标**：添加一个轻量索引，不改目录结构

```
.claude/
└── skills/
    └── _index.json         ← 【新增】技能索引（不移动任何文件）
```

```json
{
  "kf": [
    {"name": "kf-go", "alias": "/go", "principle": "快", "auto": false},
    {"name": "kf-spec", "alias": "spec coding", "principle": "快", "auto": ["kf-alignment", "kf-model-router"]},
    {"name": "kf-multi-team-compete", "alias": "/夯", "principle": "夯", "auto": 11}
  ],
  "thirdParty": "see CLAUDE.md table"
}
```

**收益**：
- CLAUDE.md 中的表格可由 _index.json 自动生成
- 脚本可程序化查询技能依赖关系
- 零破坏：不移动文件，不改 SKILL.md

---

## 3. 权衡分析

### 3.1 收益 vs 风险矩阵

| 阶段 | 收益 | 风险 | 风险等级 | 建议 |
|------|------|------|---------|------|
| 阶段一：settings 拆分 | 可读性 +60%，维护效率 +40% | Claude Code 不识别外部 hooks.json | **中低** | 先验证 Claude Code 支持 `$include`/同级加载 |
| 阶段二：helpers 分类 | 查找效率 +3x，新人上手 -50% 时间 | 代理文件引入一层间接 | **低** | 代理文件极简，故障点少 |
| 阶段三：技能索引 | 程序化管理，CLAUDE.md 可自动生成 | 索引与实际不同步 | **极低** | 只索引 kf- 系列，范围可控 |

### 3.2 与红绿队对比

| 维度 | 绿队 | 蓝队 | 红队 |
|------|------|------|------|
| 改动范围 | 最小（env 标签） | 适中（3 阶段） | 最大（推倒重来） |
| 实施时间 | 30 分钟 | 2-3 小时 | 1-2 天 |
| 预期收益 | 可观测性 +20% | 整体效率 +40% | 理论 +80%（但风险高） |
| 回滚复杂度 | 极低 | 低（每阶段独立） | 高（全局耦合） |
| 推荐场景 | 生产环境紧急修复 | **日常维护优化（推荐）** | 新项目从零开始 |

### 3.3 蓝队不做的事

- ❌ 不移动 skills/ 目录下任何文件
- ❌ 不合并 commands/ 和 skills/
- ❌ 不引入新的注册表/元数据系统
- ❌ 不改动 agents/ 目录结构
- ❌ 不重写任何 hook 逻辑
- ❌ 不改动 settings.local.json

**理由**：这些改动的收益不确定，风险较高，且当前规模（88 skills / 23 agents / 42 helpers）还不构成必须重组的痛点。蓝队追求的是"用最小改动获得最大收益"。

---

## 4. 成功标准

| 指标 | 验证方式 |
|------|---------|
| settings.json 可读性 | 文件行数减少 50%+，非 hook 配置一目了然 |
| helpers/ 可导航性 | 开发者能在 5 秒内找到目标脚本 |
| 零破坏 | 所有现有技能触发路径、hook 调用链完整测试通过 |
| 可回滚 | 每阶段有明确回滚命令，< 2 分钟完成 |
