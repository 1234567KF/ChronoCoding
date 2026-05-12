# 绿队架构设计：kf-model-router — 全自动多模型智能调度系统

> **视角**：安全保守者 — 零漏洞、边界完备、合规降级、容错优先

---

## 1. 密钥隔离架构

### 原则
每个供应商**独立环境变量**、**独立 HTTP 客户端**、**独立令牌桶**，无全局共享密钥变量，杜绝覆写/抢占。

### 环境变量命名

| 供应商 | API Key 变量 | Base URL 变量 | 可选变量 |
|--------|-------------|--------------|---------|
| DeepSeek | `DEEPSEEK_API_KEY` | `DEEPSEEK_BASE_URL`（默认 `https://api.deepseek.com`） | `DEEPSEEK_TIMEOUT` |
| MiniMax | `MINIMAX_API_KEY` | `MINIMAX_BASE_URL`（默认 `https://api.minimax.chat`） | `MINIMAX_TIMEOUT` |
| OpenAI Codex | `OPENAI_API_KEY` | `OPENAI_BASE_URL`（默认 `https://api.openai.com`） | `OPENAI_TIMEOUT` |

### 密钥读取策略
- 从环境变量读取（process.env）
- 不从配置文件读取（避免泄露）
- 缺失密钥 → 标记该供应商不可用 → 降级到其他供应商
- 运行时检测，非启动时检测（支持动态注入）

### 隔离实现
```javascript
// 每个供应商独立实例
const clients = {
  deepseek: new AxiosInstance({ baseURL, headers: { Authorization: `Bearer ${key}` }, timeout }),
  minimax: new AxiosInstance({ baseURL, headers: { Authorization: `Bearer ${key}` }, timeout }),
  codex: new AxiosInstance({ baseURL, headers: { Authorization: `Bearer ${key}` }, timeout }),
};
```
- 无 `default` 实例
- 请求必须显式指定供应商
- 客户端配置固化在创建时，运行时不受外部影响

---

## 2. 断路器模式

### 状态机

```
                   连续失败 >= threshold
     ┌───────────────────┐
     │                   │
     ▼                   │
  ┌──────┐          ┌───────┐
  │ CLOSED│─────────▶│  OPEN  │
  │ 正常  │  failure │ 断开   │
  └──────┘          └───────┘
     ▲                   │
     │                   │ timeout 到期
     │                   ▼
     │              ┌──────────┐
     └──────────────│ HALF_OPEN │
      试探成功      │  半开试探  │
                    └──────────┘
```

### 每个模型独立断路器

| 参数 | 默认值 | 说明 |
|------|--------|------|
| failureThreshold | 3 | 连续失败次数 → OPEN |
| successThreshold | 2 | 半开状态连续成功次数 → CLOSED |
| timeout | 30000 | OPEN → HALF_OPEN 等待时间（ms） |
| halfOpenMaxRequests | 1 | 半开状态允许最大试探请求数 |

### 事件日志
每次状态变更记录：
```json
{
  "model": "deepseek-v4-pro",
  "from": "CLOSED",
  "to": "OPEN",
  "reason": "连续3次超时",
  "timestamp": "2026-05-10T10:00:00Z"
}
```

---

## 3. 降级链

### 默认降级链

```
# DeepSeek Pro 不可用时
deepseek-v4-pro → deepseek-v4-flash → minimax-m1 → codex → 抛 SafeRouterError

# MiniMax M1 不可用时
minimax-m1 → deepseek-v4-flash → codex → 抛 SafeRouterError

# Codex 不可用时
codex → deepseek-v4-flash → 抛 SafeRouterError
```

### 降级策略
- **立即降级**：断路器 OPEN 时跳过该模型
- **超时降级**：请求等待超过 timeout 时尝试下一个
- **密钥缺失降级**：供应商无 API Key 时标记不可用
- **限流降级**：令牌桶不足时尝试降级

### 降级回传
降级发生时，在响应中附加 `x-safe-router-fallback: true` 头，并记录：
```json
{
  "original_model": "deepseek-v4-pro",
  "fallback_model": "deepseek-v4-flash",
  "reason": "断路器 OPEN",
  "latency_ms": 150
}
```

---

## 4. 限流方案

### 令牌桶算法（每供应商独立桶）

| 供应商 | 容量 | 填充速率 | 安全余量 |
|--------|------|---------|---------|
| DeepSeek Pro | 20 rpm | 0.33 rps | 80% = 0.26 rps |
| DeepSeek Flash | 60 rpm | 1 rps | 80% = 0.8 rps |
| MiniMax M1 | 30 rpm | 0.5 rps | 80% = 0.4 rps |
| Codex | 20 rpm | 0.33 rps | 80% = 0.26 rps |

### 排队策略
- 令牌不足时：等待（最多 `maxQueueTime` = 5000ms）
- 超过等待时间 → 触发降级
- 无需显式排队 API，用 `setTimeout` + Promise 实现等待

### 多 Agent 共享
- 所有 Agent 共享同一供应商桶（令牌桶是单例）
- 自然限流：桶空 → 后续请求等待或降级

---

## 5. 健康探测

### 主动探测
- 每 60s 对每个可用供应商发轻量请求
- 探测方式：最短 completion（"ok"）
- 探测失败 → 标记该模型状态为 unhealthy

### 被动探测
- 从实际调用失败中学习
- 失败计数累加到断路器中

### 状态广播
- 健康状态存储在全局状态对象中
- 所有模块读取同一状态源

---

## 6. 向后兼容

### 路由映射

| 旧模型名 | 新模型名 | 供应商 |
|---------|---------|--------|
| `deepseek-v4-pro` | `deepseek-v4-pro` | DeepSeek |
| `deepseek-v4-flash` | `deepseek-v4-flash` | DeepSeek |
| — | `minimax-m1` | MiniMax |
| — | `codex` | OpenAI Codex |

### 兼容层
- 现有 `pro`/`flash` 映射保持不变
- 新功能通过 `SAFE_ROUTER_ENABLED=true` 环境变量启用
- 未启用时，行为与现有 `kf-model-router` 完全一致

---

## 7. KV Cache 保持

- DeepSeek 专用路径保持原缓存策略
- 非 DeepSeek 供应商不使用 KV Cache（无此特性）
- 路由决策时：DeepSeek 模型优先走缓存路径
- 预热策略仅对 DeepSeek 生效

---

## 8. 监控告警

### 路由日志记录字段

| 字段 | 说明 |
|------|------|
| model | 请求模型 |
| task | 任务类型 |
| decision | route/downgrade/block |
| latency_ms | 响应时间 |
| fallback | 是否降级 |
| fallback_chain | 降级链 |
| circuit_state | 断路器状态 |
| rate_limit_hit | 是否触发限流 |
| token_usage | Token 消耗 |
| timestamp | 时间戳 |

### 告警阈值

| 指标 | 阈值 | 动作 |
|------|------|------|
| 降级率 | > 10% | 输出 WARNING |
| 断路器 OPEN | 任意 | 输出 CRITICAL |
| 限流触发 | > 5/min | 输出 WARNING |
| 密钥缺失 | 任意 | 输出 INFO |

---

## 9. 文件清单

```
.claude/skills/kf-model-router/SKILL.md         # 技能定义
.claude/helpers/key-isolator.cjs               # 密钥隔离 + 客户端工厂
.claude/helpers/circuit-breaker.cjs            # 断路器
.claude/helpers/rate-limiter.cjs               # 令牌桶限流
.claude/helpers/degradation-chain.cjs          # 降级链编排
.claude/helpers/health-probe.cjs               # 健康探测
.claude/helpers/safe-router.cjs                # 主入口（整合以上模块）
```

---

## 10. 数据流

```
[请求] → safe-router.route(model, task)
           │
           ├─ key-isolator.getClient(vendor)     → 获取 HTTP 客户端
           ├─ circuit-breaker.query(vendor)      → 检查断路器状态
           │    └─ OPEN → degradation-chain 降级
           ├─ rate-limiter.consume(vendor)       → 获取令牌
           │    └─ 失败 → degradation-chain 降级
           ├─ health-probe.isHealthy(vendor)     → 检查健康状态
           │    └─ unhealthy → degradation-chain 降级
           ├─ vendor API 调用
           │    └─ 失败 → circuit-breaker.record(failure)
           │         └─ degradation-chain 降级
           ├─ circuit-breaker.record(success)
           └─ [响应]
```
