# 绿队最终汇总：kf-model-router 全自动多模型智能调度系统

> **视角**：安全保守者 — 零漏洞、边界完备、合规降级、容错优先

---

## 交付物清单

| 文件 | 职责 | 行数 |
|------|------|------|
| `D:\AICoding\.claude\skills\kf-model-router\SKILL.md` | 技能定义 + 用户文档 | ~180 |
| `D:\AICoding\.claude\helpers\key-isolator.cjs` | 密钥隔离 + HTTP 客户端工厂 | ~200 |
| `D:\AICoding\.claude\helpers\circuit-breaker.cjs` | 断路器模式（CLOSED/OPEN/HALF_OPEN） | ~230 |
| `D:\AICoding\.claude\helpers\rate-limiter.cjs` | 令牌桶限流（每供应商独立桶） | ~210 |
| `D:\AICoding\.claude\helpers\degradation-chain.cjs` | 降级链编排（动态过滤不可用模型） | ~180 |
| `D:\AICoding\.claude\helpers\health-probe.cjs` | 健康探测（主动 + 被动） | ~240 |
| `D:\AICoding\.claude\helpers\safe-router.cjs` | 主入口（整合所有模块） | ~260 |
| `D:\AICoding\green-team-01-architecture.md` | 架构设计文档 | ~200 |
| `D:\AICoding\green-team-05-final.md` | 本文件 — 最终汇总 | — |

---

## 需求覆盖矩阵

| 需求 | 状态 | 实现模块 | 说明 |
|------|------|---------|------|
| 多供应商模型池 | ✅ 已实现 | `key-isolator.cjs` | DeepSeek + MiniMax + OpenAI Codex |
| 密钥隔离 | ✅ 已实现 | `key-isolator.cjs` | 独立 env var、独立 Axios 实例、独立令牌桶 |
| 断路器 + 降级链 | ✅ 已实现 | `circuit-breaker.cjs` + `degradation-chain.cjs` | 3 次失败→OPEN，30s→HALF_OPEN，试探成功→CLOSED |
| 限流 | ✅ 已实现 | `rate-limiter.cjs` | 令牌桶，80% 安全余量，多 Agent 共享桶 |
| 向后兼容 | ✅ 已实现 | `safe-router.cjs` | 默认关闭（SAFE_ROUTER_ENABLED），直通 DeepSeek |
| 零配置 | ✅ 已实现 | 未修改 `settings.json` | 全部通过环境变量控制 |
| KV Cache 保持 | ✅ 已实现 | DeepSeek 内建 | 非 DeepSeek 不使用 KV Cache |
| 健康探测 | ✅ 已实现 | `health-probe.cjs` | 60s 周期探测 + 被动失败学习 |

---

## 安全特性

### 1. 密钥隔离（最高优先级）

```javascript
// 每个供应商独立 Axios 实例
const clients = {
  deepseek: axios.create({ baseURL, headers: { Authorization: `Bearer ${key}` } }),
  minimax:  axios.create({ baseURL, headers: { Authorization: `Bearer ${key}` } }),
  codex:    axios.create({ baseURL, headers: { Authorization: `Bearer ${key}` } }),
};
// 无默认实例，无全局共享密钥变量
```

- 每个供应商独立 `DEEPSEEK_API_KEY` / `MINIMAX_API_KEY` / `OPENAI_API_KEY`
- 独立 Axios 实例（不同 baseURL、timeout、headers）
- 独立令牌桶（同供应商共享，跨供应商完全隔离）
- 密钥缺失 → 供应商自动标记不可用 → 降级到其他供应商

### 2. 断路器

- 连续 3 次失败 → OPEN（拒绝所有请求）
- 30 秒后 → HALF_OPEN（放行 1 个试探请求）
- 试探成功 2 次 → CLOSED（恢复正常）
- 试探失败 1 次 → OPEN（重新计时）

### 3. 降级链

```
deepseek-v4-pro → deepseek-v4-flash → minimax-m1 → codex → 抛 SafeRouterError
deepseek-v4-flash → deepseek-v4-pro → minimax-m1 → codex → 抛 SafeRouterError
minimax-m1 → deepseek-v4-flash → codex → 抛 SafeRouterError
codex → deepseek-v4-flash → 抛 SafeRouterError
```

### 4. 限流（80% 安全余量）

| 供应商 | 容量 | 填充速率 | 等待超时 |
|--------|------|---------|---------|
| DeepSeek | 16 tokens | 0.26/s | 5000ms |
| MiniMax | 24 tokens | 0.4/s | 5000ms |
| Codex | 16 tokens | 0.26/s | 5000ms |

---

## 向后兼容

- **零配置**：不修改 `settings.json`，不添加新 hook
- **默认关闭**：通过 `SAFE_ROUTER_ENABLED=true` 环境变量启用
- **别名映射**：`pro` → `deepseek-v4-pro`，`flash` → `deepseek-v4-flash`，`sonnet` → `deepseek-v4-flash`
- **未启用时**：行为与旧 `kf-model-router` 完全一致（仅 DeepSeek 直通）
- **现有技能零修改**：所有 `integrated-skills` 声明无需改动

---

## 代码质量

### 语法检查
✅ 全部 6 个 .cjs 文件通过 `node -c` 语法校验

### 模块加载
✅ 全部模块加载成功，无循环依赖

### 单元测试
✅ 断路器：CLOSED → OPEN → 手动重置 → CLOSED 状态机测试通过
✅ 断路器：3 次失败触发 OPEN，查询拒绝通过
✅ 限流器：令牌消耗统计正确
✅ 健康探测：无密钥时正确返回 unhealthy

### Checklist 自检（A-J 类型）

| 类型 | 权重 | 状态 | 说明 |
|------|------|------|------|
| A: Ref 取值 | P0 | N/A | 非 Vue 项目 |
| B: 跨文件一致性 | P0 | ✅ 全部通过 | 所有 import/export 已验证匹配 |
| C: 导航方法 | P1 | N/A | 非 VUE/SPA |
| D: 模板作用域 | P0 | N/A | 无 Vue 模板 |
| E: SPA 路由 | P1 | N/A | 非 SPA |
| F: API 路径 | P1 | ✅ 检查通过 | 统一 /chat/completions 端点 |
| G: 响应结构 | P1 | ✅ 检查通过 | 使用 optional chaining 容错 |
| H: URL 解析 | P1 | ✅ 检查通过 | 使用 Axios baseURL |
| I: 环境一致性 | P1 | ✅ 检查通过 | 单运行时环境 |
| J: 导入遗漏 | P0 | ✅ 全部通过 | 所有 require 已验证 |

---

## 使用方式

```bash
# 1. 启用 safe-router
export SAFE_ROUTER_ENABLED=true

# 2. 设置至少一个供应商密钥
export DEEPSEEK_API_KEY=sk-xxx
# 可选：
export MINIMAX_API_KEY=mm-xxx
export OPENAI_API_KEY=sk-xxx

# 3. 查询状态
node .claude/helpers/safe-router.cjs status

# 4. 测试路由
node .claude/helpers/safe-router.cjs route --model deepseek-v4-pro --prompt "hello"

# 5. 查看路由日志
node .claude/helpers/safe-router.cjs log 20
```

---

## 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    safe-router.cjs (主入口)                    │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ key-isolator │  │circuit-breaker│  │ rate-limiter │       │
│  │  密钥隔离    │◀─┤  断路器     │◀─┤  令牌桶限流  │       │
│  │  客户端工厂  │  │  CLOSED/OPEN │  │  独立桶/供应商│       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                 │                 │                │
│         ▼                 ▼                 ▼                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │               degradation-chain (降级链)              │    │
│  │  pro → flash → minimax → codex → 异常                │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │               health-probe (60s 周期探测)             │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
         │              │              │
         ▼              ▼              ▼
  ┌──────────┐   ┌──────────┐   ┌──────────┐
  │ DeepSeek │   │ MiniMax  │   │  Codex   │
  │ API      │   │ API      │   │  API     │
  └──────────┘   └──────────┘   └──────────┘
```

---

## 风险记录

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| MiniMax/Codex API 不兼容 | 请求失败 | 统一使用 `/chat/completions` 端点，降级链兜底 |
| 新供应商密钥泄露 | 密钥泄露 | 独立环境变量，不写配置文件，非 DeepSeek 无 KV Cache |
| 向后兼容破坏 | 现有技能异常 | 默认关闭，直通 DeepSeek，零配置 |
| 多 Agent 同时限流 | 请求延迟 | 异步等待 + 超时降级 |
