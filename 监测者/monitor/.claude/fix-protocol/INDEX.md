# Fix Protocol — 活修复协议

> 对标 OpenGame Debug Skill: 维护一个持续更新的已验证修复协议。
> 每次 Stage 3/3.5 发现的 bug 和修复方案都被记录，下次编码时自动检索避免重复踩坑。

## 索引结构

| 错误类型 | 条目数 | 最近记录 |
|---------|-------|---------|
| 运行时异常 | 1 | 2026-05-10 |
| 编译错误 | 1 | 2026-05-08 |

## 用途

- **Stage 3 集成测试**发现 bug 时 → `node .claude/helpers/hammer-bridge.cjs fix-record` 记录
- **Stage 3.5 运行时验证**发现运行时错误时 → 自动记录
- **下次 Stage 2 编码**时 → 自动检索匹配的修复协议 → 注入编码 prompt
- **查询** → `node .claude/helpers/hammer-bridge.cjs fix-search --type <类型>`

## 最近记录

- [2026-05-10] **运行时异常** (P0): ---
 — `2026-05-10-api-500-error-on-login-a455cfe9.md`
- [2026-05-08] **编译错误** (P1): ---
 — `2026-05-08-编译错误-mowzth70.md`
