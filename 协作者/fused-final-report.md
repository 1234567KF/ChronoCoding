# kf-model-router 方案融合报告

> 日期：2026-05-10
> 融合策略：择优采纳 + 博采众长（蓝队基线 + 红队/绿队亮点吸收）

---

## 一、融合策略说明

### 基线选择
以**蓝队方案为基线**，保持其核心架构不变：
- 配置驱动：`model-registry.json` 为唯一数据源
- 轻量规则引擎：`smart-dispatcher.cjs` 无 LLM 依赖
- 非阻塞健康探测：首次调用假设所有模型健康，后台异步探活
- 降级链：首选 → 同供应商备选 → 另一供应商 → DeepSeek 默认

### 吸收策略
| 来源 | 亮点 | 融合方式 |
|------|------|---------|
| 红队 | Adapter 插件模式 | 扩展 registry 数据结构支持 adapter 引用 + dispatcher 可选加载 |
| 红队 | CJK-aware 分类 | 增强 dispatcher 复杂度估算和成本感知 |
| 绿队 | 独立 Axios 实例 + 密钥隔离 | 新增 registry 驱动的 key-isolator（简化版） |
| 绿队 | 令牌桶限流 | 新增 registry 驱动的 rate-limiter（简化版） |
| 绿队 | CLOSED/OPEN/HALF_OPEN 断路器 | 增强 model-health 状态机 |

---

## 二、各来源贡献清单

### 蓝队贡献（基线）
- `model-provider-registry.cjs` — 模型注册表加载器
- `smart-dispatcher.cjs` — 任务分类 + 模型分配引擎
- `model-health.cjs` — 健康探测 + 断路器（基础版）
- `hooks/model-router-hook.cjs` — Hook 入口
- `model-router-hook.cjs` — 代理文件（不变）
- `model-registry.json` — 模型配置数据
- `SKILL.md` — 技能文档

### 红队贡献
- `base-adapter.cjs` — 适配器基类（DeepSeek/MiniMax/OpenAI 适配器继承此类）
- `deepseek.cjs` / `minimax.cjs` / `openai.cjs` — 各供应商适配器
- `task-classifier.cjs` — CJK 字符数估算逻辑（`cjkChars = desc.match(CJK_REGEX).length`，有效词数 = ASCII 词数 + CJK 字符数/2）

### 绿队贡献
- `key-isolator.cjs` — 独立 Axios 客户端工厂（全功能版）
- `rate-limiter.cjs` — 令牌桶限流（全功能版）
- `circuit-breaker.cjs` — CLOSED/OPEN/HALF_OPEN 状态机

---

## 三、最终文件清单和职责

### 新增文件

| 文件 | 职责 | 来源 |
|------|------|------|
| `D:\AICoding\.claude\helpers\key-isolator.cjs` | 密钥隔离 + HTTP 客户端工厂（简化版，registry 驱动） | 绿队 → 融合 |
| `D:\AICoding\.claude\helpers\rate-limiter.cjs` | 令牌桶限流（简化版，registry 驱动） | 绿队 → 融合 |

### 修改文件

| 文件 | 改动内容 | 来源 |
|------|---------|------|
| `D:\AICoding\.claude\helpers\model-registry.json` | schema 升级至 1.1；为所有 provider 添加 `adapter` 和 `rateLimit` 字段 | 红队 + 绿队 |
| `D:\AICoding\.claude\helpers\model-provider-registry.cjs` | 新增 `getProvider()`、`getProviderAdapter()`、`getProviderRateLimit()` | 红队 + 绿队 |
| `D:\AICoding\.claude\helpers\smart-dispatcher.cjs` | CJK-aware 复杂度估算 (`estimateTextComplexity`)；adapter 可选加载 (`loadAdapter`)；成本感知增强（CJK 文本自动提级） | 红队 |
| `D:\AICoding\.claude\helpers\model-health.cjs` | 断路器增强为 CLOSED/OPEN/HALF_OPEN 三态状态机；新增 `getModelCircuitStatus()`、`getEventLog()` | 绿队 |
| `D:\AICoding\.claude\helpers\hooks\model-router-hook.cjs` | 集成 key-isolator（路由前打印可用供应商）和 rate-limiter（路由前检查令牌） | 绿队 |

### 未修改文件

| 文件 | 说明 |
|------|------|
| `D:\AICoding\.claude\helpers\model-router-hook.cjs` | 代理文件，保持 `require('./hooks/model-router-hook.cjs')` 不变 |
| `D:\AICoding\.claude\skills\kf-smart-router\providers\*.cjs` | 红队 adapter 文件保持独立，通过 registry 引用 |

---

## 四、架构数据流

```
用户触发技能
  │
  ├─ model-router-hook.cjs (入口)
  │   ├─→ model-provider-registry.cjs (加载 registry)
  │   ├─→ key-isolator.cjs (检查可用供应商)
  │   ├─→ rate-limiter.cjs (检查令牌配额)         ← NEW
  │   ├─→ model-health.cjs (健康探测 + 断路器)     ← 增强
  │   ├─→ smart-dispatcher.cjs (分类 + 分配模型)    ← 增强
  │   │    ├─→ 可选: kf-smart-router/providers/*.cjs (adapter 加载)
  │   │    └─→ CJK-aware 复杂度估算
  │   └─→ 输出路由指令
```

---

## 五、与现有技能的兼容性说明

### 向后兼容
- **原有 DeepSeek-only 场景**不受影响：`smart-dispatcher` 的 `classifyTask()` 返回格式扩展到 `{type, complexity}`，但 `type` 字段与旧版 `string` 结果兼容（调用方使用 `result.type` 或 `result.taskType` 均可）
- **model-health.cjs** 导出 API 不变（新增了 `getModelCircuitStatus()`、`getEventLog()` 等函数，原有函数签名不变）
- **model-provider-registry.cjs** 新增函数不修改现有函数签名
- **model-router-hook.cjs** 的 `enhancedRoute()` 和 `originalRoute()` 接口不变

### kf-smart-router 独立性
红队的 `kf-smart-router` 技能完全独立运行，不受本融合影响。蓝队通过 registry 的 `adapter` 字段选择性引用其 adapter 文件（路径 `skills/kf-smart-router/providers/`），引用失败时静默降级，无硬依赖。

### 配置方式
新功能完全配置驱动，无需修改代码：
1. 在 `model-registry.json` 中为各 provider 添加 `adapter` 和 `rateLimit` 字段
2. 环境变量设置方式不变（各供应商独立 `*_API_KEY`）
3. 新增文件（key-isolator、rate-limiter）按需加载，不存在时静默跳过

---

## 六、融合收益

| 维度 | 融合前 | 融合后 | 提升 |
|------|--------|--------|------|
| 供应商适配 | 硬编码 API 调用 | 插件化 adapter 模式 | 新供应商配 registry + adapter 即可 |
| 中文文本处理 | 无感知 | CJK 字符数估算 + 复杂度提级 | 长中文任务自动选 pro |
| 密钥安全 | 单 env key 检查 | 独立 Axios 实例 + 供应商隔离 | 杜绝密钥串扰 |
| 限流保护 | 无 | 令牌桶 + 等待/拒绝模式 | 避免 API 限流惩罚 |
| 断路器 | CLOSED/OPEN（2 态） | CLOSED/OPEN/HALF_OPEN（3 态） | 更细粒度恢复控制 |
