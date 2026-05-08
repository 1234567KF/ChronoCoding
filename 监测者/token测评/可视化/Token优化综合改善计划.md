# Token优化 — 综合改善计划

> 生成：2026/05/08 | 基于三队代码审计 + savings-calculator实测

---

## 一、已修复的 Bug（6项）

### 1.1 核心公式错误 — calcCost 缓存计算（影响5个文件）

| 文件 | 严重度 | 问题 | 修复 |
|------|--------|------|------|
| `monitor/src/pricing.js` | 🔴 严重 | `cachedIn = Math.min(cacheHit, tokensIn)` — 把缓存当输入子集 | `cachedIn = cacheHit \|\| 0` (相加关系) |
| `monitor/src/collector/index.js` | 🔴 严重 | `totalInput += msg.input_tokens` — 漏算缓存token | `totalInput += (msg.input_tokens \|\| 0) + (msg.cache_hit \|\| 0)` |
| `monitor/src/watcher.js` | 🔴 严重 | 同上，且 `resolveModel` 回退到 `'unknown'` 字符串 | 同公式修复 + 模型名回退到 `'deepseek-v4-pro'` |
| `.claude/hooks/token-accum.cjs` | 🔴 严重 | 同上公式错误 + delta计算不包含缓存 | 同公式修复 + `totalInputAll` 含缓存 |
| `.claude/helpers/hooks/token-tracker.cjs` | 🟡 中等 | cache rate 分母错误(3处) + report中"有效输入"用减法 | 分母改为 `totalIn + totalCache`，有效输入=totalIn |

**影响范围**：所有监控数据、dashboard显示、token成本估算、savings报告  
**根因**：误将Anthropic/DeepSeek format的 `input_tokens` 和 `cache_read_input_tokens` 理解为包含关系，实际为相加关系

### 1.2 savings-calculator 缓存计为优化节省

| 文件 | 严重度 | 问题 | 修复 |
|------|--------|------|------|
| `benchmark/savings-calculator.cjs` | 🟡 中等 | 基线按全价无缓存 → 97.5%"节省"实际是服务器缓存 | 基线也享受缓存价，仅模型路由/CLI/CCP/Lambda算优化 |

---

## 二、剩余待修复项（3项）

### 2.1 🔴 子Agent技能调用无记录

**问题**：`sessions_spawn` 创建的子agent不继承hooks → 子agent的技能调用不写入 `skill-traces.jsonl` → watcher无法导入 → dashboard看不到子agent的技能使用

**影响**：`/夯` 中红蓝绿队的技能调用数据完全缺失，监控盲区

**修复方向**：
- 方案A：子agent启动时手动注入hook配置（需修改CCP调度逻辑）
- 方案B：从 transcript 中解析子agent的工具调用（后处理，不实时）
- 方案C：接受现状，文档化此限制

**推荐**：方案A（长期）+ 方案B（短期补充）

### 2.2 🟡 技能trace无实时token数据

**问题**：`preToolHook` 在API调用前触发 → 写入 `skill-traces.jsonl` 时 token 全为0 → watcher导入的skill_calls表中 `input_tokens/output_tokens` 均为0

**影响**：dashboard中"技能维度"的token统计为空，无法做技能粒度的成本分析

**修复方向**：
- 方案A：PostToolUse hook中回填token数据（token-accum.cjs已有transcript路径，可以补充）
- 方案B：watcher从transcript中关联补充（事后关联，延迟5-30秒）

**推荐**：方案B（改动最小，watcher已有transcript读取能力）

### 2.3 🟢 测评体系测试用例未全部自动化

**问题**：04-测评体系定义了5个用例，仅用例1(CLI压缩)自动化了，用例2-5仍为手动

| 用例 | 状态 | 自动化难度 |
|------|------|-----------|
| 用例1: CLI压缩 | ✅ 已自动化 (`cli-benchmark.cjs`) | — |
| 用例2: 模型路由 | ❌ 手动 | 中（需对比不同模型输出） |
| 用例3: 智能调度 | ❌ 手动 | 高（需控制spawn条件） |
| 用例4: Lambda通信 | ❌ 手动 | 中（需两agent通信场景） |
| 用例5: 代码审查 | ❌ 手动 | 高（需大项目+质量评判） |

---

## 三、新增优化机会（4项）

### 3.1 ⭐ 多Agent缓存共享

**发现**：同API Key + 同会话 + 相似prompt前缀 → 缓存命中 → 多Agent不线性增加token成本

**量化**：5 agent ≈ 1x(首次全价) + 4×0.02x(缓存) ≈ 1.08x 输入成本（而非 5x）

**行动**：
- [x] 文档已输出：`可视化/多Agent缓存共享优化专题.md`
- [ ] 更新 `省token原理汇总表.md` 增加"缓存共享"维度
- [ ] 在 `/夯` prompt模板中统一公共前缀以最大化命中率

### 3.2 ⭐ Prompt模板标准化

**发现**：当前各agent的prompt由各自SKILL.md定义，前缀结构不完全一致 → 缓存命中率未达理论最大值

**行动**：
- [ ] 抽取公共前缀模板（system + codebase map + tool defs）
- [ ] 各agent prompt = 公共前缀 + 角色差异化指令
- [ ] 预期：缓存命中率从当前98.8%提升到99%+

### 3.3 🟡 Token预估模型

**发现**：目前只有事后统计，缺少事前预估

**行动**：
- [ ] 基于历史数据训练简单预估模型（输入规模×模型系数→预估token）
- [ ] 在 `/夯` 启动前显示预估token消耗
- [ ] 对比实际消耗，持续校准

### 3.4 🟢 Git提交Token优化（RTK）

**发现**：`git status/log/diff` 等日常命令输出经过RTK/lean-ctx压缩可省60-90%

**当前状态**：RTK已安装但hook可能不稳定(Windows)

**行动**：
- [ ] 验证RTK hook在Windows上的稳定性
- [ ] `cli-benchmark.cjs` 增加RTK vs 原生对比

---

## 四、专题任务进度总览

对照 `省token专题任务.md` 的5个步骤+提示1：

| 步骤 | 内容 | 状态 | 产出 |
|------|------|------|------|
| 1 | 自查本项目省token技能 | ✅ 完成 | CLAUDE.md技能表 + 省token原理汇总表(11维度) |
| 2 | 搜索体系(GitHub/B站/YT) | 🟡 框架有 | kf-web-search + kf-opencli，需定期运行 |
| 3 | 按搜索体系下载 | 🟡 框架有 | kf-add-skill 安装管家 |
| 4 | 测评体系 | ✅ v2.0 | cli-benchmark + aggregate-report + visualize + savings-calculator |
| 5 | 测评报告+建议 | 🟡 部分 | savings报告已有，用例2-5未跑 |
| 提示1 | 省token维度总结 | ✅ 完成 | 省token原理汇总表(11维度) + 多Agent缓存共享专题 |

---

## 五、执行优先级

### P0 — 立即修复
- [x] calcCost公式错误（5文件）— DONE
- [x] savings-calculator缓存分离 — DONE
- [x] token-tracker.cjs残留公式(3处) — DONE

### P1 — 本次完成
- [x] 多Agent缓存共享专题文档 — DONE
- [ ] `省token原理汇总表.md` 更新（增加缓存共享维度）
- [ ] Git提交所有修改

### P2 — 下次优先
- [ ] 子Agent技能无记录修复
- [ ] 技能trace无token数据修复
- [ ] 用例2-5自动化

### P3 — 持续优化
- [ ] Prompt模板标准化
- [ ] Token预估模型
- [ ] RTK稳定性验证
