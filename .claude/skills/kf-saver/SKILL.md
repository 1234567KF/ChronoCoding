---
name: kf-saver
description: |
  节流者 Agent — 缓存监控 + 成本控制 + 模型路由强化。
  自动检测 KV Cache 命中率，低于阈值时优化 system prompt。
  触发词："节省"、"省模式"、"成本优化"、"缓存分析"、"token节省"。
triggers:
  - 节省
  - 省模式
  - 成本优化
  - 缓存分析
  - token节省
  - cache分析
  - /节省
allowed-tools:
  - Bash
  - Read
  - Write
  - Grep
  - Glob
recommended_model: flash
metadata:
  principle: 省
  category: optimization
  integrated-skills:
    - kf-model-router
    - kf-token-tracker
    - lean-ctx
---

# kf-saver：节流者 Agent

## 核心职责

### 1. KV Cache 监控与优化

- 读取 token-tracker 的缓存命中率数据
- 缓存命中率 < 30% 时发出优化告警
- 分析未命中原因：前缀不匹配 / 首次请求 / 公共前缀未落盘
- 给出具体的 system prompt 优化建议（统一前缀、长文档预热、公共上下文合并）

### 2. 成本预算控制

- 按模型统计 token 消耗和成本
- 检测异常高消耗模式
- 建议 pro→flash 降级时机
- 产出成本优化报告

### 3. 模型路由强化

- 审计当前模型使用是否符合 kf-model-router 规则
- 标记不使用 pro 却用了 pro 的场景
- 标记应该用 pro 却用了 flash 的场景（复杂 bug 排查）

### 4. Context 压缩策略

- 集成 lean-ctx 压缩
- 识别未压缩的大文件读取
- 建议压缩模式（auto / aggressive / map）

## 命令

```bash
# 缓存分析
node .claude/helpers/token-tracker.cjs cost | node .claude/helpers/kf-saver-hook.cjs analyze

# 成本审计报告
node .claude/helpers/token-tracker.cjs report
```

## 自动触发机制

通过 PreToolUse Hook 注册自动缓存检测：

```json
{
  "matcher": "Skill",
  "hooks": [{
    "type": "command",
    "command": "node .claude/helpers/kf-saver-hook.cjs auto-detect"
  }]
}
```

## 与 kf-model-router 的关系

| 维度 | kf-model-router | kf-saver |
|------|----------------|----------|
| 职责 | 模型智能切换 | 成本全链路优化 |
| 粒度 | 每技能/每阶段 | 全局聚合分析 |
| 输出 | 模型切换 | 成本优化报告 |
| 调用 | 技能启动自动 | 用户触发 + 定时巡检 |

## 集成

被以下技能自动调用：

- kf-go：导航面板显示成本状态
- kf-token-tracker：提供缓存命中数据
- kf-model-router：提供路由决策数据
