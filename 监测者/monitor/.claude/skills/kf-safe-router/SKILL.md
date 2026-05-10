---
name: kf-safe-router
description: 全自动多模型智能调度 — "稳"原则。多供应商模型池（DeepSeek + MiniMax + OpenAI Codex），断路器 + 降级链 + 令牌桶限流 + 密钥隔离。技能启动时自动触发，用户无感。触发词："安全路由"、"safe-router"、"多模型调度"。
metadata:
  principle: 稳
  source: 绿队安全保守设计
integrated-skills:
  - kf-model-router
graph:
  dependencies:
    - target: kf-model-router
      type: extends  # 扩展原模型路由，添加多供应商支持
    - target: kf-multi-team-compete
      type: dependency  # 为多团队竞争提供降级路由
    - target: kf-spec
      type: dependency  # spec 开发多模型支持
    - target: kf-alignment
      type: dependency  # 对齐工作流多模型支持
---

# kf-safe-router — 稳原则：全自动多模型智能调度

> **核心原则**：密钥隔离、容错优先、向后兼容。
> **安全信条**：宁可降级不可泄露，每次调用必须有降级方案。
> **激活方式**：设置环境变量 `SAFE_ROUTER_ENABLED=true`。

---

## 架构总览

```
[请求] → safe-router.route(model, task)
           │
           ├─ key-isolator      → 密钥隔离 + HTTP 客户端
           ├─ circuit-breaker   → 断路器（CLOSED/OPEN/HALF_OPEN）
           ├─ rate-limiter      → 令牌桶限流
           ├─ health-probe      → 健康探测
           ├─ degradation-chain → 降级链编排
           └─ [供应商 API]
```

---

## 支持的供应商和模型

| 供应商 | API Key | 模型 | 默认 Base URL |
|--------|---------|------|---------------|
| DeepSeek | `DEEPSEEK_API_KEY` | `deepseek-v4-pro`, `deepseek-v4-flash` | `https://api.deepseek.com` |
| MiniMax | `MINIMAX_API_KEY` | `minimax-m1` | `https://api.minimax.chat/v1` |
| OpenAI | `OPENAI_API_KEY` | `codex` | `https://api.openai.com/v1` |

---

## 密钥隔离

每个供应商独立环境变量，独立 HTTP 客户端实例，独立令牌桶。

```bash
# 设置密钥（只设需要的即可，缺失的自动降级）
export DEEPSEEK_API_KEY=sk-xxx
export MINIMAX_API_KEY=mm-xxx
export OPENAI_API_KEY=sk-xxx

# 可选：覆盖 Base URL
export DEEPSEEK_BASE_URL=https://api.deepseek.com
export MINIMAX_BASE_URL=https://api.minimax.chat/v1
export OPENAI_BASE_URL=https://api.openai.com/v1
```

---

## 降级链

| 首选模型 | 降级链 |
|---------|--------|
| `deepseek-v4-pro` | → `deepseek-v4-flash` → `minimax-m1` → `codex` → 抛异常 |
| `deepseek-v4-flash` | → `deepseek-v4-pro` → `minimax-m1` → `codex` → 抛异常 |
| `minimax-m1` | → `deepseek-v4-flash` → `codex` → 抛异常 |
| `codex` | → `deepseek-v4-flash` → 抛异常 |

触发降级的条件：
- 断路器 OPEN（连续 3 次失败）
- 密钥缺失
- 限流令牌不足
- 健康探测不通过
- HTTP 超时/5xx 错误

---

## 断路器

| 参数 | 默认值 | 说明 |
|------|--------|------|
| failureThreshold | 3 | 连续失败次数 → OPEN |
| successThreshold | 2 | 半开状态连续成功次数 → CLOSED |
| timeout | 30000 | OPEN → HALF_OPEN 等待时间（ms） |
| halfOpenMaxRequests | 1 | 半开状态允许最大试探请求数 |

---

## 限流

| 供应商 | 容量 | 填充速率 | 安全余量 |
|--------|------|---------|---------|
| DeepSeek | 16 tokens | 0.26/s | 80%（20 rpm → 16） |
| MiniMax | 24 tokens | 0.4/s | 80%（30 rpm → 24） |
| Codex | 16 tokens | 0.26/s | 80%（20 rpm → 16） |

多 Agent 共享同一供应商桶，桶满时请求等待（最多 5000ms）后降级。

---

## 向后兼容

- **零配置**：不修改 `settings.json`
- **默认关闭**：通过 `SAFE_ROUTER_ENABLED=true` 启用
- **别名映射**：`pro` → `deepseek-v4-pro`，`flash` → `deepseek-v4-flash`
- **未启用时**：行为与旧 `kf-model-router` 完全一致（仅 DeepSeek）
- **现有技能零修改**：所有 `integrated-skills` 声明无需改动

---

## KV Cache 保持

- DeepSeek 专用路径保持原缓存策略
- 非 DeepSeek 供应商不使用 KV Cache（无此特性）
- 预热策略仅对 DeepSeek 生效

---

## 文件清单

```
.claude/helpers/safe-router.cjs          # 主入口（整合所有模块）
.claude/helpers/key-isolator.cjs         # 密钥隔离 + 客户端工厂
.claude/helpers/circuit-breaker.cjs      # 断路器模式
.claude/helpers/rate-limiter.cjs         # 令牌桶限流
.claude/helpers/degradation-chain.cjs    # 降级链编排
.claude/helpers/health-probe.cjs         # 健康探测
.claude/skills/kf-safe-router/SKILL.md   # 本文件
```

---

## CLI 用法

```bash
# 查询状态
node .claude/helpers/safe-router.cjs status

# 测试路由
node .claude/helpers/safe-router.cjs route --model deepseek-v4-pro --prompt "hello"

# 查看路由日志
node .claude/helpers/safe-router.cjs log 20

# 刷新供应商状态
node .claude/helpers/safe-router.cjs refresh deepseek
```

---

## 监控字段

每次路由决策记录：

| 字段 | 类型 | 说明 |
|------|------|------|
| model | string | 实际使用的模型 |
| vendor | string | 供应商 |
| original_model | string | 请求的原始模型 |
| decision | string | direct / fallback / error / exhausted |
| fallback | boolean | 是否降级 |
| fallback_count | number | 降级跳数 |
| chain | string[] | 完整降级链 |
| latency | number | 响应延迟（ms） |
| success | boolean | 是否成功 |

---

## 安装

```bash
# 启用 safe-router
export SAFE_ROUTER_ENABLED=true

# 设置至少一个供应商密钥
export DEEPSEEK_API_KEY=sk-xxx
```
