# Token 效率评测体系

> 版本：v2.0
> 更新时间：2026/05/07
> 对应专题任务步骤：步骤4（测评体系建设）

---

## 一、评测目标

评测 Token 节省效果，分维度量化，抛开价格波动，聚焦各环节节省率。

## 二、核心原则

1. **控制变量**：同一任务对比有/无某技能的结果
2. **多测求均值**：每次用例测 3+ 次，取平均值（`cli-benchmark.cjs --runs N`）
3. **区分输入/输出**：输入和输出价格不同，必须分开记录
4. **区分命中缓存**：第1次、第2次、第3次结果可能因缓存而不同，需标注
5. **可复现**：测试用例需存档，结果可追溯
6. **自动化**：用 `cli-benchmark.cjs` 跑基准，用 `aggregate-report.cjs` 统计，用 `visualize.cjs` 出图

## 三、分项测试用例

### 用例1：CLI 输出压缩（lean-ctx）→ 已自动化

**自动化脚本**：`benchmark/cli-benchmark.cjs`

| 测试项 | 方法 |
|--------|------|
| 目标 | 验证 CLI 命令输出 (git/npm/ls/cat) 的压缩效果 |
| 方法 | 每条命令跑原始 + lean-ctx 压缩版本，对比 char 数 |
| 变量 | 命令类型（git/fs/file-read） |
| 常量 | 执行环境、工作目录 |
| 指标 | 原始 chars、压缩后 chars、压缩率、耗时 |
| 命令 | `node benchmark/cli-benchmark.cjs --runs 5` |

### 用例2：模型路由（kf-model-router）

| 测试项 | 方法 |
|--------|------|
| 目标 | 验证 Pro 计划 + Flash 执行的质量等价性 |
| 方法 | 同一任务分别用 Pro-only vs Pro+Flash 路由，对比输出质量和 token |
| 变量 | 模型选择（Pro vs Flash） |
| 常量 | 任务难度、输入内容、输出格式要求 |
| 指标 | 输出质量评分(1-10)、输入 token、输出 token、总 token、价格 |
| 数据 | `kf-token-tracker report` + 人工质量评判 |

### 用例3：智能调度（claude-code-pro）

| 测试项 | 方法 |
|--------|------|
| 目标 | 验证 <3 文件跳过 spawn 的准确性 + 回调替代轮询的节省 |
| 方法 | 对比有/无 CCP 的 agent 启动次数和轮询开销 |
| 变量 | 文件数量（1/2/3/5/10），有无 CCP |
| 常量 | 任务复杂度、Agent 类型 |
| 指标 | spawn 次数、轮询次数、回调次数、总 token |

### 用例4：通信压缩（lambda-lang）

| 测试项 | 方法 |
|--------|------|
| 目标 | 验证 Agent 间通信的压缩效果 |
| 方法 | 对比纯自然语言 vs Lambda 协议通信的 token 消耗 |
| 变量 | 通信方式（自然语言 vs Lambda 原子协议） |
| 指标 | 单次通信 token、3次通信总 token、压缩率 |

### 用例5：代码审查（kf-code-review-graph）

| 测试项 | 方法 |
|--------|------|
| 目标 | 验证依赖图谱 vs 全量扫描的节省效果 |
| 方法 | 对比有/无图谱的代码审查 token 消耗 |
| 变量 | 项目规模（小/中/大）、有无图谱 |
| 指标 | 输入 token、输出 token、覆盖率、遗漏率 |

## 四、测试记录表

### Token 消耗记录模板

```
| 用例 | 任务描述 | 次数 | 输入Token | 输出Token | 总Token | 缓存命中 | 节省率 | 备注 |
|------|---------|-----|----------|----------|--------|---------|-------|------|
```

### 自动化数据路径

```
数据/
├── aggregate.json              # 跨日期聚合索引
├── comprehensive-report.json   # 综合报告 JSON（给 visualize 用）
├── lean-ctx/
│   └── YYYY-MM-DD.json         # CLI 基准测试结果
├── model-router/
├── ccp/
├── lambda-lang/
└── code-review-graph/
```

## 五、数据可视化

### 工具链

| 工具 | 功能 | 命令 |
|------|------|------|
| `benchmark/cli-benchmark.cjs` | CLI 压缩基准测试 | `node benchmark/cli-benchmark.cjs --runs 5` |
| `benchmark/aggregate-report.cjs` | 聚合统计 + Markdown 报告 | `node benchmark/aggregate-report.cjs` |
| `benchmark/visualize.cjs` | HTML 仪表盘（Chart.js） | `node benchmark/visualize.cjs` |
| kf-token-tracker | Token 消费明细 | `/token-tracker report` |

### 追踪指标

1. **Token 节省率趋势**：各技能的节省率随时间的变化
2. **维度分布**：输入 vs 输出的节省比例
3. **缓存命中率**：第2次/第3次调用的缓存命中情况
4. **综合节省热力图**：按技能 × 场景的节省率矩阵

### 可视化输出

```
可视化/
├── index.html              # 综合仪表盘（由 visualize.cjs 生成）
└── 省token原理汇总表.md     # 11 维度原理大表
```

## 六、综合评分体系

| 维度 | 权重 | 说明 |
|------|------|------|
| Token 节省率 | 40% | 各技能的综合节省率 |
| 质量等价性 | 30% | 节省后输出质量是否达标 |
| 稳定性 | 20% | 测试结果方差，CV 低加分 |
| 易用性 | 10% | 自动化程度，数据覆盖度 |

### 评分等级

| 等级 | 分数 | 说明 |
|------|------|------|
| A+ | 90-100 | 优秀 |
| A | 80-89 | 很好 |
| B+ | 70-79 | 良好 |
| B | 60-69 | 一般 |
| C | 40-59 | 较差 |
| D | <40 | 不推荐 |

## 七、执行计划

| 阶段 | 内容 | 产出 | 状态 |
|------|------|------|------|
| P1 | CLI 压缩基准测试自动化 | `cli-benchmark.cjs` | ✅ 已完成 |
| P2 | 聚合统计 + 报告生成 | `aggregate-report.cjs` | ✅ 已完成 |
| P3 | 可视化仪表盘 | `visualize.cjs` | ✅ 已完成 |
| P4 | 省token原理汇总 | `省token原理汇总表.md` | ✅ 已完成 |
| P5 | model-router 实测 + 质量对比 | 待补充 | ⏳ |
| P6 | ccp 跳过率/回调统计 | 待补充 | ⏳ |
| P7 | lambda-lang 压缩实测 | 待补充 | ⏳ |
| P8 | 综合报告 + 人类评审 | 持续 | 🔄 |

---

*文档位置：token测评/04-测评体系/AI编程Token效率评测体系.md*
