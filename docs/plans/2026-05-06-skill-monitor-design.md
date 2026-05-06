# 技能调用监控 Web 仪表盘 — 设计文档

## 概述

基于 Express + EJS + SQLite 的轻量级监控仪表盘，集成到 AICoding 项目内。通过 Claude Code 的 pre-task/post-task hooks 自动采集技能调用和 Token 消耗数据，服务在线时推送，离线时零开销。

## 数据采集

- **pre-task hook**：记录技能名称、类型、开始时间
- **post-task hook**：记录 Token 消耗（输入/输出）、缓存命中、执行状态、对话内容
- **采集判断**：`GET /api/health` 探活，在线则 POST 数据，离线直接跳过

## 数据模型

4 张表：conversations, messages, skill_calls, token_daily_stats

## API

| 端点 | 说明 |
|------|------|
| `GET /api/health` | 探活 |
| `POST /api/records` | 数据推送 |
| `GET /api/conversations` | 对话列表（分页）|
| `GET /api/conversations/:id` | 对话详情 |
| `GET /api/stats/tokens` | Token 统计 |
| `GET /api/stats/skills` | 技能排行 |

## 前端页面

1. **对话列表** `/` — 表格 + 搜索 + 日期筛选
2. **对话详情** `/conversations/:id` — 完整对话流 + Token 标签
3. **统计仪表盘** `/stats` — 总览卡片 + 趋势图 + 技能排行 + 缓存命中率
4. **明细日志** `/logs` — 时间线视图 + 多维筛选

## 计费规则

- 输入 Token：缓存命中时显示"（缓存）"，无缓存数据时显示"-"
- 输出 Token：按模型价格表计算并显示
- 模型价格表可配置

## 技术栈

- 后端：Express + better-sqlite3
- 前端：EJS 服务端渲染 + Chart.js
- 配置：模型价格 JSON
- 端口：3456
- 启动：`npm run monitor`
