# 监测者 — 待办事项

> 更新: 2026-05-10

---

## 一、数据质量 (P0)

### 1.1 ✅ 清理 ad08b099 脏数据
- **问题**: 三路数据采集（hook POST + watcher trace + watcher transcript）并发写入导致大量重复
  - `agent subagent 开始` x25 条
  - `agent subagent 结束` x21 条
  - 多段 assistant 回复重复 2-3 倍
  - 花费从真实 ¥1.05 虚高到 ¥19.93
- **状态**: 已清理，从 transcript 单一来源重建，87 条干净消息
- **根因修复**: watcher.js `importTraces()` 已加过滤跳过 `agent subagent 开始/结束`

### 1.2 🔧 全量 transcript 导入
- **问题**: 42 个 transcript 文件，只有 2 个被导入 DB（其他 40 个从未进口）
- **原因**: `importTranscriptMessages()` 只看 `session-state.json` 里的当前 session，历史 session 无人导入
- **方案**: 修改 watcher 或新建脚本，扫描所有 transcript 文件按 mtime 逐个导入
- **注意**: 导入时必须 dedup（按 content fingerprint），避免多路重复

### 1.3 🔧 数据库去重脚本完善
- `scripts/dedup-messages.js` 目前只处理 content 完全相同的行
- 需要更智能的去重：同一 session 中相同 role + 相同前 200 字符 → 保留一条
- 去重后自动重建 conversations 汇总和 token_daily_stats

---

## 二、采集可靠性 (P0)

### 2.1 ✅ session-state.json 在 SessionStart:compact 后不更新
- **现象**: compact restore 后 session-state.json 仍是旧 session ID
- **修复**: `importTranscriptMessages()` 不再依赖 session-state.json，改为扫描 transcript 目录下所有 .jsonl 文件
  - 用 mtime 过滤未变更文件（高效跳过）
  - 对每个有新增行的 session 独立导入
  - cursor 格式升级为 `{ offset, mtimeMs }`，向后兼容旧数字格式
- **状态**: 已修复，watcher 重启后生效

### 2.2 🔧 三路数据采集竞态问题
- **现状**: hook POST → collector, watcher trace → importTraces, watcher transcript → importTranscriptMessages
  三路独立写 messages 表，各自更新 conversations 汇总
- **问题**: 同一条消息可能被 2-3 路分别写入（虽然有 dedup 但不完美）
- **建议**: 选定 transcript import 为单一真相来源（最全最可靠），其他两路仅做实时展示用
- **或者**: 改进 dedup key 从 `role:前100字符` 升级为更强指纹

### 2.3 ✅ DeepSeek token 格式解析一致性
- 从实际 transcript 数据抽样确认：当前为**新版格式**
  - `input_tokens` = 仅未缓存 tokens（如 420, 41020）
  - `cache_read_input_tokens` = 缓存命中 tokens（如 46336, 5376）
  - 两者是相加关系，不是包含关系
- `watcher.js buildTranscriptMessages()` 处理正确（直接取值，不减法）
- `import-all-transcripts.cjs` / `clean-reimport.cjs` 已修复（原来错误地做了 `input_tokens - cache_hit`）
- **注意**: 历史 DB 数据可能因旧脚本有轻微低估，需重新运行 clean-reimport 彻底修复

---

## 三、成本计算 (P1)

### 3.1 技能节省模型 — 从硬编码改为数据驱动
- **用户反馈**: 省token原理汇总表.md 里的百分比是估算，直接硬编码成代码是假数据
- **正确做法**:
  1. 逐个读省 token 技能的源码，理解机制（lean-ctx, lambda-lang, claude-code-pro, kf-code-review-graph, kf-langextract, kf-doc-consistency, claude-mem, context-mode, kf-browser-ops）
  2. 设计测量方案：对比同一任务有无技能时的 token 差异
  3. 从 transcript 数据中提取真实节省因子
  4. 无法测量的技能标注为"代码分析估算" vs "实测"
- **注意**: `kf-model-router` 的模型切换不算节省（用户明确说过）
- **pricing.js 现状**: `SKILL_SAVING_CONFIG` + `calcSkillBaseline()` 已写但未铺到 DB/API/前端

### 3.2 DeepSeek 优化计划落地后复查
- 另一团队在并行实施 `deepseek-api-optimization-plan.md`
- 三角色架构（节流者/协作者/监测者）+ KV Cache 优化会改变 token 消耗模式
- **需要复查**: pricing 计算、缓存命中率统计、节省因子是否仍然准确
- **文件**: `d:\AICoding\deepseek-api-optimization-plan.md`

### 3.3 ✅ 官方定价抓取健壮性
- **改进**:
  - 重试机制：成功每 24h 重取，失败每 1h 重试（原来只取一次不重试）
  - API 暴露 `pricing.usingDefaults` + `lastFetchError` 字段（`/api/stats/tokens`）
  - 前端可据此显示警告横幅
- **当前状态**: 抓取解析失败（HTML 结构变更），使用默认价格，每小时自动重试

---

## 四、前端展示 (P1)

### 4.1 ✅ 会话列表标题为空
- 已修复：import-all-transcripts 重建后，所有 44 个会话标题均来自第一条用户消息
- 标题规则：首条用户消息前 60 字符，无用户消息时用 "会话 {id前16位}"

### 4.2 ✅ 统计页面 daily_stats 为空
- 已修复：import-all-transcripts 自动重建，6 天数据（5/5-5/10）

### 4.3 节省列拆分展示 (等 3.1 完成后做)
- 会话列表: "技能节省" + "路由节省" 两列
- 会话详情: per-message 技能节省金额
- 统计页: 摘要卡拆分

---

## 五、基础设施 (P2)

### 5.1 ✅ 无 API 鉴权
- `/api/clear` 现在要求 `{ confirm: true }` body 参数
- 前端已有 `confirm()` 弹窗，现在发送正确的 JSON body
- 清除后自动重置所有 transcript cursors 为 0，触发 watcher 全量重建
- 清除后立即调用 `importTranscriptMessages()` 全量恢复数据
- **注意**: 不是完整鉴权方案（无登录），但防止了意外调用

### 5.2 无数据过期/归档
- SQLite DB 会无限增长
- messages 表需要按月归档或 TTL

### 5.3 前端团队颜色硬编码
- `{ red: 红队, blue: 蓝队, green: 绿队 }` 硬编码在 EJS 中
- 未来新团队名需要动态处理

---

## 六、测试

### 6.1 ✅ 现有测试
- `pricing.test.js` 16/16 通过
- `integration.test.js` 24/24 通过（使用受控测试数据）
- `run-all-tests.js` 统一入口

### 6.2 🔧 待补测试
- `calcSkillBaseline` 单元测试（等 3.1 重新设计后）
- 多路并发去重集成测试
- transcript 导入 end-to-end 测试

---

## 已完成

- [x] cache_cost 全局修复（12 文件，2026-05-10）
- [x] cleanup-duplicates.js 改用真实 pricing 模块
- [x] backfill-messages.cjs 改用真实 pricing 模块
- [x] watcher importTraces 加 daily_stats 更新
- [x] 40/40 自动化测试全部通过
- [x] 删除 test-conv-001/002 测试数据
- [x] ad08b099 脏数据清理 + 从 transcript 重建
- [x] watcher 过滤 `agent subagent 开始/结束` 事件
