# Context Mode 详细评测文档

> 来源: github.com/mksglu/context-mode
> 版本: v1.0.0

---

## 一、项目概述

Context Mode 是一个开源的 MCP Server，专门解决 AI 编程 Agent 的上下文窗口问题。通过沙箱隔离技术，将原始工具输出压缩高达 98%。

---

## 二、核心功能

### 2.1 四大能力

| 能力 | 说明 |
|------|------|
| Context Saving | 沙箱工具将原始数据排除在上下文外，315KB → 5.4KB，98%压缩 |
| Session Continuity | SQLite跟踪所有编辑、git操作、任务、错误和用户决策 |
| FTS5 Full-Text Search | 对整个项目历史进行全文搜索 |
| Smart Indexing | 智能索引压缩上下文 |

### 2.2 技术架构

```
Context Mode 架构:
├── MCP Server Layer
│   └── 81+ 工具集成
├── Sandbox Engine
│   └── 工具输出隔离处理
├── SQLite Storage
│   ├── 上下文历史
│   ├── 编辑记录
│   └── 搜索索引
└── Compression Layer
    └── 自适应压缩算法
```

---

## 三、平台支持

| 平台 | 支持类型 | 输出节省 | Agent节省 |
|------|---------|---------|----------|
| Claude Code | MCP Server | ~98% | ~65% |
| Cursor | Plugin (.mdc) | ~98% | ~60% |
| OpenCode | Plugin (AGENTS.md) | ~98% | ~60% |
| Continue | MCP Server | ~98% | ~60% |
| LlamaStack | MCP Server | ~98% | ~60% |

总计支持 **14+ 平台**

---

## 四、Benchmark 数据

### 4.1 30分钟会话测试

| 指标 | 无Context Mode | 有Context Mode | 差异 |
|------|----------------|----------------|------|
| 上下文窗口保持 | 60% | 99% | +39% |
| 有效交互时间 | 分钟级 | 小时级 | 质变 |
| 工具调用次数 | 受限 | 无限制 | - |

### 4.2 工具输出压缩示例

| 工具 | 原始大小 | 压缩后 | 压缩率 |
|------|---------|--------|--------|
| 文件读取 | 45KB | 155B | 99.7% |
| 日志输出 | 500KB | 2KB | 99.6% |
| API响应 | 100KB | 500B | 99.5% |

---

## 五、评测方法

### 5.1 测试场景

1. **长对话测试**: 30分钟连续交互
2. **复杂任务测试**: 多工具调用场景
3. **工具输出测试**: 大文件读取、API调用等

### 5.2 评测命令

```bash
/context-mode:stats    # 查看当前会话节省统计
/context-mode:doctor   # 诊断检查
```

---

## 六、安装配置

### Claude Code 配置
1. 安装 MCP Server
2. 配置 hooks
3. 启用沙箱模式

### Cursor 配置
1. 创建 .cursor/mcp/settings.json
2. 添加 context-mode.mdc 配置
3. 启用插件

---

## 七、相关资源

- GitHub: https://github.com/mksglu/context-mode
- 官网: https://context-mode.mksg.lu
- 文档: https://mksg.lu/blog/context-mode

---

*数据来源: GitHub README 及官方文档*