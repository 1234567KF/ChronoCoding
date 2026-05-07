# Changelog

所有重要版本变更将记录在此。

## [v1.5] - 2026-05-05

### 重大变更

- **RTK 退役 → lean-ctx 接替**：RTK (Rust Token Killer) 被 lean-ctx 3.4.7 替代
  - lean-ctx 提供 90+ 上下文压缩模式（RTK 仅 ~20 种）
  - Shell Hook + Claude Code Hook 双通道压缩
  - CCP (Context Continuity Protocol) 跨会话持久化

### 新增

- **lean-ctx 集成**：Shell Hook + MCP 双通道上下文压缩
- **CCP 会话连续性**：跨会话状态持久化

### 更新

- settings.json：新增 lean-ctx PreToolUse hooks（rewrite + redirect）
- 所有文档：RTK 引用替换为 lean-ctx
- README.md / CREDITS.md / FEATURES.md / INSTALL.md / AICoding.md：同步更新

---

### 新增

- **frontend-slides 技能**: HTML 演示文稿生成器，基于 zarazhangrui/frontend-slides
- **CREDITS.md**: 第三方开源项目致谢文档

### 更新

- README.md 添加第三方集成说明
- 更新触发词速查表

---

## [v1.3] - 2026-04-27

### 新增

- **RTK Token 节省工具**：节省 60-90% Token 消耗
- **gspowers TDD 扩展**：强制测试先行模式
- **gspowers Pipeline 多模块流水线开发**：多模块依赖自动编排

### 功能

- Claude Code + Yolo 模式自动驾驶
- ruflo 多 Agent 并行/接力执行
- markitdown 文档格式互转
- 三方协作评审机制

---

## [v1.2] - 日期

### 更新

- 完善触发词速查表
- 优化安装流程

---

## [v1.1] - 日期

### 新增

- 初始版本
- 基础框架搭建
