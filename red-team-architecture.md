# 红队架构方案 — D:\AICoding\.claude\ 激进重构

> **视角**: 激进重构（推倒重来）
> **原则**: 稳省准测的准夯快懂 — 每个模块可独立验证

---

## 一、现状诊断

### 1.1 结构问题

```
agents/      — 23个扁平目录，无分层，职责混乱
skills/      — 88个扁平目录，kf-前缀散落，无分组元数据
helpers/     — 42个脚本，职责不清（hook/mcp/monitor混杂）
commands/    — 7个子目录，与skills概念重叠
```

### 1.2 核心问题

| 问题 | 表现 | 影响 |
|------|------|------|
| **Agent扁平化** | 23个顶层目录无分类 | 查找困难，职责不清 |
| **Skill无分组** | 88个skill无元数据标记 | 无法批量管理，依赖关系不可见 |
| **Hook分散** | Hook逻辑散落在多个helper | 生命周期不可见，难以调试 |
| **配置冗余** | settings.json + settings.local.json + .env | 配置冲突，难以维护 |
| **缺乏注册表** | 无统一模块注册机制 | 模块发现依赖文件扫描 |

---

## 二、目标架构

### 2.1 分层设计（自顶向下）

```
.claude/
├── registry/                    # 【新增】模块注册表
│   ├── agents.json             # Agent索引 + 元数据
│   ├── skills.json             # Skill索引 + 分组元数据
│   ├── hooks.json              # Hook生命周期注册
│   └── dependencies.graph.json # 依赖关系图（可选）
│
├── core/                        # 【新增】核心运行时
│   ├── hooks/                  # Hook生命周期引擎
│   │   ├── engine.js          # Hook调度器
│   │   ├── lifecycle.js       # PreToolUse/PostToolUse/SessionStart等
│   │   └── middleware/        # Hook中间件（可插拔）
│   │       ├── safety.js      # 安全检查
│   │       ├── lean-ctx.js    # 上下文压缩
│   │       ├── model-router.js# 模型路由
│   │       └── alignment.js   # 对齐检查
│   │
│   ├── events/                 # 事件驱动总线
│   │   ├── bus.js             # EventEmitter封装
│   │   ├── channels.js        # 预定义频道
│   │   └── subscribers/       # 事件订阅者
│   │
│   └── config/                 # 配置合并引擎
│       ├── loader.js          # JSON/YAML/.env加载器
│       ├── merger.js          # 优先级合并
│       └── schema.js          # JSON Schema验证
│
├── agents/                     # 【重构】按职责分层
│   ├── _base/                 # 基类定义
│   │   └── BaseAgent.md       # 所有agent继承的模板
│   │
│   ├── core/                  # 核心开发角色（5个）
│   │   ├── coder.md
│   │   ├── planner.md
│   │   ├── researcher.md
│   │   ├── reviewer.md
│   │   └── tester.md
│   │
│   ├── specialized/           # 专业领域角色（按域分组）
│   │   ├── frontend/
│   │   │   ├── react-expert.md
│   │   │   ├── vue-expert.md
│   │   │   └── nextjs-developer.md
│   │   ├── backend/
│   │   │   ├── django-expert.md
│   │   │   ├── fastapi-expert.md
│   │   │   └── nestjs-expert.md
│   │   ├── data/
│   │   │   ├── ml-pipeline.md
│   │   │   └── database-optimizer.md
│   │   └── devops/
│   │       ├── kubernetes-specialist.md
│   │       └── terraform-engineer.md
│   │
│   ├── orchestration/         # 协调类agent（SWARM）
│   │   ├── coordinator.md      # 通用协调器
│   │   ├── swarm-mesh.md       # 网状拓扑
│   │   └── consensus-raft.md  # 共识协议
│   │
│   └── workflows/             # 工作流专用agent
│       ├── sparc/             # SPARC方法论
│       ├── goal-planner/      # 目标规划
│       └── github-swarm/      # GitHub协同
│
├── skills/                     # 【重构】分组 + kf-前缀保留
│   ├── _meta/                 # 分组元数据
│   │   ├── groups.json        # 分组定义（infra/kf/upstream/third-party）
│   │   └── dependencies.json  # 依赖关系
│   │
│   ├── infra/                 # 基础设施（自动触发）
│   │   ├── kf-model-router/
│   │   ├── lean-ctx/
│   │   ├── lambda-lang/       # kf-前缀保留，归属infra组
│   │   └── claude-code-pro/
│   │
│   ├── kf/                    # 团队自建（kf-系列）
│   │   ├── kf-go/
│   │   ├── kf-spec/
│   │   ├── kf-multi-team-compete/
│   │   ├── kf-alignment/
│   │   ├── kf-web-search/
│   │   ├── kf-scrapling/
│   │   ├── kf-opencli/
│   │   ├── kf-browser-ops/
│   │   ├── kf-code-review-graph/
│   │   ├── kf-prd-generator/
│   │   ├── kf-ui-prototype-generator/
│   │   ├── kf-image-editor/
│   │   ├── kf-autoresearch/
│   │   ├── kf-reverse-spec/
│   │   ├── kf-grant-research/
│   │   ├── kf-langextract/
│   │   ├── kf-triple-collaboration/
│   │   ├── kf-skill-design-expert/
│   │   ├── kf-add-skill/
│   │   ├── kf-doc-consistency/
│   │   └── kf-markdown-to-docx-skill/
│   │
│   ├── upstream/              # 上游集成
│   │   ├── gspowers/
│   │   ├── gstack/
│   │   ├── asta-skill/
│   │   └── atlassian-mcp/
│   │
│   └── third-party/           # 第三方（jeffallan）
│       ├── languages/
│       ├── frameworks/
│       ├── devops/
│       └── specialized/
│
├── commands/                   # 【保留】命令快捷方式
│   └── (保持原结构，映射到skills/)
│
├── helpers/                    # 【精简】仅保留桥接脚本
│   ├── hook-bridge.cjs        # 核心Hook桥接（精简版）
│   ├── mcp-bridge.cjs        # MCP服务器桥接
│   └── legacy/                # 废弃脚本归档（逐步移除）
│
└── config/                     # 【合并】统一配置
    ├── settings.yaml          # 单一配置源
    ├── .env                   # 环境变量（敏感信息）
    └── schema.json            # JSON Schema验证
```

---

## 三、模块化设计详解

### 3.1 注册表（registry/）

**目的**: 避免全目录扫描，O(1)模块发现

```json
// registry/agents.json
{
  "version": "1.0",
  "agents": {
    "coder": {
      "path": "agents/core/coder.md",
      "type": "core",
      "layer": "core",
      "capabilities": ["code_generation", "refactoring"],
      "priority": "high",
      "hooks": ["pre:learning", "post:validation"]
    },
    "react-expert": {
      "path": "agents/specialized/frontend/react-expert.md",
      "type": "specialized",
      "layer": "frontend",
      "extends": "coder",
      "capabilities": ["react", "typescript", "testing"]
    }
  }
}
```

```json
// registry/skills.json
{
  "version": "1.0",
  "groups": {
    "infra": {
      "description": "自动触发，用户无感",
      "auto_trigger": true,
      "skills": ["kf-model-router", "lean-ctx", "lambda-lang"]
    },
    "kf": {
      "description": "团队自建技能",
      "auto_trigger": false,
      "skills": ["kf-go", "kf-spec", "kf-multi-team-compete"]
    }
  },
  "dependencies": {
    "kf-multi-team-compete": {
      "requires": ["kf-model-router", "lambda-lang", "claude-code-pro"],
      "optional": ["kf-web-search", "kf-scrapling"]
    }
  }
}
```

### 3.2 Hook生命周期引擎（core/hooks/）

**原则**: Hook不再是散落的脚本，而是可插拔的中间件

```javascript
// core/hooks/engine.js
const EventEmitter = require('events');

class HookEngine extends EventEmitter {
  constructor() {
    super();
    this.middlewares = {
      PreToolUse: [],
      PostToolUse: [],
      SessionStart: [],
      SessionEnd: []
    };
  }

  // 注册中间件（按优先级）
  register(lifecycle, middleware, priority = 50) {
    this.middlewares[lifecycle].push({ middleware, priority });
    this.middlewares[lifecycle].sort((a, b) => a.priority - b.priority);
  }

  // 执行链
  async execute(lifecycle, context) {
    const chain = this.middlewares[lifecycle];
    let ctx = { ...context };
    
    for (const { middleware } of chain) {
      ctx = await middleware(ctx);
      if (ctx.halt) break; // 中断链
    }
    
    return ctx;
  }
}
```

**中间件示例**:

```javascript
// core/hooks/middleware/model-router.js
module.exports = async (ctx) => {
  if (ctx.tool === 'Skill') {
    const model = await selectModel(ctx.task);
    ctx.env.MODEL = model;
  }
  return ctx;
};

// core/hooks/middleware/lean-ctx.js
module.exports = async (ctx) => {
  if (ctx.tool === 'Read' || ctx.tool === 'Grep') {
    ctx.path = await redirectPath(ctx.path); // 压缩重定向
  }
  return ctx;
};
```

### 3.3 事件驱动架构（core/events/）

**目的**: 解耦模块间通信

```javascript
// core/events/bus.js
const EventEmitter = require('events');

class EventBus extends EventEmitter {
  constructor() {
    super();
    this.channels = {
      'agent:lifecycle': { description: 'Agent启停事件' },
      'skill:call': { description: '技能调用事件' },
      'tool:use': { description: '工具使用事件' },
      'memory:sync': { description: '记忆同步事件' }
    };
  }

  subscribe(channel, listener) {
    this.on(channel, listener);
  }

  publish(channel, event) {
    this.emit(channel, { timestamp: Date.now(), ...event });
  }
}

module.exports = new EventBus();
```

**订阅者示例**:

```javascript
// core/events/subscribers/memory-sync.js
const bus = require('../bus');

bus.subscribe('tool:use', (event) => {
  if (event.tool === 'Edit' || event.tool === 'Write') {
    // 异步同步记忆
    setTimeout(() => syncToMemory(event), 0);
  }
});
```

### 3.4 配置合并引擎（core/config/）

**原则**: 单一配置源，优先级合并

```javascript
// core/config/merger.js
const priority = [
  'config/settings.yaml',      // 基础配置
  'config/settings.local.yaml', // 本地覆盖
  '.env'                       // 环境变量（最高优先级）
];

function merge() {
  let config = {};
  for (const file of priority) {
    if (exists(file)) {
      const layer = load(file);
      config = deepMerge(config, layer);
    }
  }
  return config;
}
```

---

## 四、迁移策略

### 4.1 分阶段迁移

| 阶段 | 内容 | 验证方式 |
|------|------|---------|
| **Phase 1** | 创建registry/，生成注册表 | `node scripts/verify-registry.js` |
| **Phase 2** | 重构agents/按层分类 | `node scripts/verify-agents.js` |
| **Phase 3** | 重构skills/分组 | `node scripts/verify-skills.js` |
| **Phase 4** | 提取core/hooks/引擎 | `node scripts/verify-hooks.js` |
| **Phase 5** | 合并配置 | `node scripts/verify-config.js` |
| **Phase 6** | 清理helpers/legacy | `node scripts/verify-legacy.js` |

### 4.2 兼容层

```javascript
// helpers/legacy/hook-handler-compat.cjs
// 兼容旧Hook调用路径
const { HookEngine } = require('../../core/hooks/engine');

// 旧脚本重定向到新引擎
module.exports = function oldHookHandler(command, ...args) {
  console.warn('[DEPRECATED] Use core/hooks/engine.js instead');
  const engine = new HookEngine();
  // 映射旧命令到新生命周期
  return engine.execute(mapCommand(command), { args });
};
```

---

## 五、验证清单

每个阶段完成后，运行对应验证脚本：

```bash
# Phase 1: 注册表完整性
node scripts/verify-registry.js
# ✅ agents.json包含所有agent
# ✅ skills.json包含所有skill
# ✅ 无孤立文件

# Phase 2: Agent分层正确性
node scripts/verify-agents.js
# ✅ 所有agent有layer字段
# ✅ extends关系可解析
# ✅ 无循环继承

# Phase 3: Skill分组正确性
node scripts/verify-skills.js
# ✅ kf-前缀全部在kf/组
# ✅ 依赖关系无环
# ✅ triggers无冲突

# Phase 4: Hook引擎验证
node scripts/verify-hooks.js
# ✅ 所有中间件可加载
# ✅ 链式执行无错误
# ✅ 超时保护生效

# Phase 5: 配置合并验证
node scripts/verify-config.js
# ✅ 无配置冲突
# ✅ 必需字段存在
# ✅ JSON Schema验证通过

# Phase 6: 兼容性验证
node scripts/verify-legacy.js
# ✅ 旧路径重定向正常
# ✅ 无运行时警告
```

---

## 六、预期收益

| 指标 | 当前 | 重构后 | 改进 |
|------|------|--------|------|
| **模块发现时间** | O(N)扫描 | O(1)查表 | 100x+ |
| **Hook调试难度** | 分散在多个文件 | 统一中间件链 | 大幅降低 |
| **配置冲突率** | 经常发生 | 单一配置源 | 消除 |
| **新增Agent成本** | 手动放置 + 修改多处 | 注册表添加1条 | 5x+ |
| **Skill依赖可见性** | 不可见 | 图谱可视化 | 完全透明 |

---

## 七、风险与回滚

### 7.1 风险点

- **Hook重构**: 可能影响现有自动化流程
- **配置合并**: 优先级错误导致功能异常
- **路径变更**: 外部脚本依赖旧路径

### 7.2 回滚策略

```bash
# 每阶段备份
git tag phase-1-registry
git tag phase-2-agents
git tag phase-3-skills
git tag phase-4-hooks
git tag phase-5-config
git tag phase-6-legacy

# 回滚命令
git checkout phase-N-xxx
```

---

## 八、下一步行动

1. **Phase 1脚本**: 生成registry/下的三个JSON文件
2. **验证脚本**: 编写verify-registry.js
3. **测试运行**: 验证注册表不遗漏任何模块

---

> **红队宣言**: 不破不立。激进重构才能根治技术债。
