---
name: model-routing-stats
description: 模型路由决策历史记录 — 用于 kf-model-router 记忆基线加载
type: reference
---

# 模型路由决策记录

## 当前路由规则

| 阶段 | 模型 | 原因 |
|------|------|------|
| 计划/设计/评审 | pro (deepseek-v4-pro) | 深度推理、架构决策、权衡取舍 |
| 执行/编码 | flash (deepseek-v4-flash) | 效率优先，常规编码任务不需要极致推理 |
| 代码审查 | flash (deepseek-v4-flash) | 模式匹配为主，性价比高 |
| Bug 排查 | pro (deepseek-v4-pro) | 需要深度上下文理解和推理链 |

## 历史决策

| 日期 | 技能 | 推荐模型 | 实际使用 | 结果 |
|------|------|---------|---------|------|
| 2026-05-08 | kf-multi-team-compete | pro | flash+pro | OK — 协调者用 pro，流水线 agent 用 flash |
| 2026-05-08 | kf-spec | pro | pro | OK — Spec 设计需深度推理 |
| 2026-05-08 | kf-token-tracker | flash | flash | OK — 监控查询，无需 Pro |

## 误切换记录

（无）
