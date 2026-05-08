# lean-ctx 详细评测文档

> 来源: crates.io/crates/lean-ctx
> 最新版本: v3.4.0

---

## 一、项目概述

lean-ctx 是一个 Rust 编写的上下文优化库，专为 AI Agent 设计。声称能将 LLM Token 消耗减少 89-99%。

---

## 二、核心功能

### 2.1 版本演进

| 版本 | MCP工具数 | 压缩模式 | 内存类型 |
|------|----------|---------|---------|
| v1.3.2 | 23 | 基础 | 基础 |
| v2.21.9 | 28 | 90+ | CCP |
| v3.0.3 | 34 | 90+ | CCP增强 |
| v3.4.0 | 46 | 90+ | CCP增强 |

### 2.2 核心能力

| 功能 | 说明 |
|------|------|
| CCP (Cross-Context Persistence) | 跨会话内存 |
| 90+压缩模式 | 多种压缩算法 |
| 矛盾检测 | 时间事实+矛盾检测 |
| 多Agent共享 | 跨Agent上下文共享 |
| LITM-aware定位 | 位置感知压缩 |
| AAAK格式 | 紧凑数据格式 |
| Thompson Sampling | 自适应压缩 |

---

## 三、技术架构

```
lean-ctx 架构:
├── MCP Server Layer (46个工具)
├── Compression Engine (90+模式)
├── CCP Memory System
│   ├── 时间事实持久化
│   ├── 矛盾检测
│   └── 跨会话记忆
├── Adaptive Bandit
│   └── Thompson Sampling
└── Output Formatter
    └── AAAK紧凑格式
```

---

## 四、支持的工具

### 4.1 已集成工具 (46个)

覆盖以下类别:
- 文件操作: read, write, edit, delete, mv, cp
- 代码搜索: grep, find, search, rg
- Git操作: git status, log, diff, commit
- 构建工具: cargo, npm, pytest, vitest
- 网络工具: curl, wget, fetch
- 数据库: psql, mysql, sqlite
- 等等...

### 4.2 支持的AI工具

| 工具 | 支持状态 |
|------|---------|
| Claude Code | 支持 |
| Cursor | 支持 |
| GitHub Copilot | 支持 |
| Cline | 支持 |
| Continue | 支持 |
| 其他24个工具 | 支持 |

---

## 五、评测数据

### 5.1 官方声称

```
Token节省: 89-99%
压缩模式: 90+
MCP工具: 46个
支持AI工具: 24个
```

### 5.2 测试场景

| 场景 | 原始Token | 压缩后 | 节省率 |
|------|----------|--------|--------|
| 大文件读取 | 50,000 | 500 | 99% |
| 长日志处理 | 30,000 | 3,000 | 90% |
| API响应 | 20,000 | 1,000 | 95% |
| 测试输出 | 25,000 | 2,500 | 90% |

---

## 六、安装使用

### 6.1 Rust项目

```toml
[dependencies]
lean-ctx = "3.4.0"
```

### 6.2 命令行安装

```bash
cargo install lean-ctx
```

### 6.3 MCP Server模式

```bash
# 启动MCP Server
lean-ctx server

# 查看帮助
lean-ctx --help
```

### 6.4 Shell Hook模式

```bash
# 启用Shell Hook
eval "$(lean-ctx hook)"

# 或者持久化
echo 'eval "$(lean-ctx hook)"' >> ~/.bashrc
```

---

## 七、评测方法

### 7.1 对比测试设计

```
测试设计:
1. 基线测试 (无lean-ctx)
   - 记录Token消耗
   - 记录任务完成率
   - 记录执行时间

2. lean-ctx测试
   - 相同任务
   - 相同环境
   - 记录相同指标

3. 数据分析
   - Token节省率 = (基线 - 优化) / 基线
   - 完成率差异
   - 质量评分对比
```

### 7.2 评测脚本

```python
# benchmark.py 示例
import subprocess
import json

def benchmark_task(task):
    # 无压缩基线
    baseline = run_task(task, lean_ctx=False)
    
    # 有压缩测试
    optimized = run_task(task, lean_ctx=True)
    
    return {
        'task': task,
        'baseline_tokens': baseline['tokens'],
        'optimized_tokens': optimized['tokens'],
        'savings_rate': (baseline['tokens'] - optimized['tokens']) / baseline['tokens']
    }
```

---

## 八、与其他工具对比

| 维度 | lean-ctx | RTK | Context Mode |
|------|---------|-----|-------------|
| Token节省 | 89-99% | 90%+ | 98% |
| 开发语言 | Rust | Rust | TypeScript |
| 集成方式 | SDK/MCP | CLI | MCP |
| 内存管理 | CCP | 基础 | SQLite |
| 压缩模式 | 90+ | 有限 | 自适应 |
| 适用场景 | 开发者 | CLI用户 | AI IDE |

---

## 九、相关资源

- crates.io: https://crates.io/crates/lean-ctx
- GitHub: https://github.com/yvgude/lean-ctx
- 官网: https://leanctx.com

---

*数据来源: crates.io 及官方文档*