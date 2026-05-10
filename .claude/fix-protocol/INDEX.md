# Fix Protocol — 活修复协议

> 对标 OpenGame Debug Skill: 维护一个持续更新的已验证修复协议。
> 每次 Stage 3/3.5 发现的 bug 和修复方案都被记录，下次编码时自动检索避免重复踩坑。

## 索引结构

| 错误类型 | 条目数 | 最近记录 |
|---------|-------|---------|
| 编译错误 | 1 | 2026-05-08 |
| 运行时异常 | 1 | 2026-05-08 |
| 逻辑错误 | 0 | — |
| UI 问题 | 0 | — |
| 性能问题 | 0 | — |
| API/数据 | 0 | — |

## 用途

- **Stage 3 集成测试**发现 bug 时 → `node .claude/helpers/hammer-bridge.cjs fix-record` 记录
- **Stage 3.5 运行时验证**发现运行时错误时 → 自动记录
- **下次 Stage 2 编码**时 → 自动检索匹配的修复协议 → 注入编码 prompt
- **查询** → `node .claude/helpers/hammer-bridge.cjs fix-search --type 运行时异常`

## 记录格式

每个修复记录是一个独立的 `.md` 文件:

```markdown
---
type: 运行时异常
severity: P0
source: 红队/fullstack
task: "用户登录功能"
date: 2026-05-08
---

# 修复记录: {错误摘要}

## 错误描述
{具体的错误信息、堆栈、截图}

## 根因分析
{导致错误的根本原因}

## 修复方案
{具体的代码改动}

## 预防措施
{如何避免同类问题再次发生}
```
