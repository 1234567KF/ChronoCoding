# 蓝队 Stage 5 — 最终汇总：多模型智能调度系统

> 蓝队视角：**最小改动、渐进升级、向后兼容** — 在现有 kf-model-router 基础上扩展为多供应商动态路由引擎。

---

## 1. 改动总览

### 新增文件（4 个）

| 文件 | 职责 |
|------|------|
| `D:\AICoding\.claude\helpers\model-provider-registry.cjs` | 模型注册表加载器：JSON 驱动的模型查询、能力匹配、成本排序 |
| `D:\AICoding\.claude\helpers\smart-dispatcher.cjs` | 智能调度器：关键词规则引擎分类任务 + 成本感知模型分配 |
| `D:\AICoding\.claude\helpers\model-health.cjs` | 健康探测 + 断路器：去程非阻塞探活、N 次失败后熔断 |
| `D:\AICoding\.claude\skills\kf-model-router\model-registry.json` | 模型配置数据：3 供应商、6 模型、成本/能力/兼容映射 |

### 修改文件（2 个）

| 文件 | 改动内容 |
|------|---------|
| `D:\AICoding\.claude\helpers\hooks\model-router-hook.cjs` | 扩展为多供应商路由入口：保留原有 pro/flash 逻辑，新增增强路由路径 |
| `D:\AICoding\.claude\skills\kf-model-router\SKILL.md` | 扩展路由表：从 2 行 → 多维矩阵，新增多供应商文档 |

### 零修改文件

| 文件 | 原因 |
|------|------|
| `D:\AICoding\.claude\helpers\model-router-hook.cjs`（代理层） | 代理文件不变，仍指向 hooks/ |
| `D:\AICoding\.claude\settings.json` | 不需要修改，Hook 入口已存在 |
| `D:\AICoding\.claude\CLAUDE.md` | 不需要修改，kf-model-router 条目不变 |
| 其他所有 kf- 技能 | **零修改**，完全向后兼容 |

---

## 2. 架构

```
Skill Hook [PreToolUse]
    │
    ▼
helpers/model-router-hook.cjs (代理) ──→ hooks/model-router-hook.cjs
                                                │
                                    ┌───────────┴───────────┐
                                    ▼                       ▼
                              增强路由                  原有路由
                          (model-registry.json      (pro/flash 兼容)
                           存在且多供应商配置)
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
           model-provider-    smart-dispatcher   model-health
           registry.cjs       .cjs               .cjs
           (加载配置)          (分类+分配)         (探活+熔断)
```

---

## 3. 支持模型池

| 供应商 | 模型 | 输入成本 | 适用任务 | 缓存 |
|--------|------|---------|---------|------|
| DeepSeek | deepseek-v4-pro | ¥3/K | 架构、Bug、规划 | KV Cache |
| DeepSeek | deepseek-v4-flash | ¥1/K | 编码、审查、测试 | KV Cache |
| MiniMax | minimax-m1-thinking | ¥2/K | 深度推理备选 | 无 |
| MiniMax | minimax-m1-fast | ¥0.5/K | 文档、UI 原型 | 无 |
| OpenAI | openai-o3 | ¥10/K | 高精度推理（可选） | 无 |
| OpenAI | openai-4o-mini | ¥0.15/K | 简单问答、格式 | 无 |

**兼容映射**：`pro` → deepseek-v4-pro, `flash` / `sonnet` → deepseek-v4-flash, `opus` → deepseek-v4-pro

---

## 4. 测试结果

**47/47 测试全部通过**，覆盖：

| 类别 | 用例数 | 覆盖内容 |
|------|--------|---------|
| 注册表加载 | 3 | JSON 解析、供应商计数、模型计数 |
| 模型查询 | 8 | 按 ID/能力/供应商查找、未知处理 |
| 兼容映射 | 4 | pro/flash/sonnet/opus 映射 |
| 任务分类 | 12 | 9 种任务类型 + 空/null 边界 |
| 模型分配 | 10 | 成本感知、降级链、排除模型 |
| 健康模块 | 8 | 加载、阈值、状态管理 |
| 格式化 | 1 | 路由指令可读性 |
| 回退配置 | 2 | 默认降级、兼容映射完整性 |

---

## 5. 向后兼容性

| 场景 | 行为 | 验证 |
|------|------|------|
| 只有 DeepSeek API Key | 纯 compat 路由（pro/flash） | ✓ |
| 多供应商 API Key 配置 | 增强路由（成本感知分配） | ✓ |
| 无 model-registry.json 文件 | 纯原有逻辑，零影响 | ✓ |
| 技能声明 `recommended_model: pro` | 映射到 deepseek-v4-pro | ✓ |
| Agent spawn `model: "sonnet"` | 映射到 deepseek-v4-flash | ✓ |
| 断路器触发 | 120s 熔断后自动恢复 | ✓ |
| 健康探针失败 | 降级到 DeepSeek fallback | ✓ |

---

## 6. 使用方式

### 零配置启用

只需设置环境变量即可启用多供应商路由：

```bash
# 已有的（必须）
DEEPSEEK_API_KEY=sk-xxx

# 可选（启用多供应商）
MINIMAX_API_KEY=mm-xxx
OPENAI_API_KEY=sk-xxx
```

### 配置驱动注册新模型

编辑 `model-registry.json` 添加新供应商，无需改代码：

```json
{
  "id": "new-provider",
  "name": "新供应商",
  "envKey": "NEW_API_KEY",
  "models": [{ "id": "new-model", "capabilities": [...], "costPer1KInput": 0.3 }]
}
```

---

## 7. ROI 预期

| 场景 | 原成本（仅 DeepSeek） | 扩展后（多供应商） | 节省 |
|------|---------------------|-------------------|------|
| 简单问答 | ¥1/K (flash) | ¥0.15/K (4o-mini) | **85%** |
| 文档生成 | ¥1/K (flash) | ¥0.5/K (M1-fast) | **50%** |
| UI 原型 | ¥1/K (flash) | ¥0.5/K (M1-fast) | **50%** |
| 深度推理 | ¥3/K (pro) | ¥2/K (M1-thinking) | **33%** |
| 综合配比 | ¥1.4/K (70:30) | ¥0.6/K (优化分配) | **~57%** |

---

## 8. 限制与后续

- **关键词分类精度**：当前轻量规则引擎无法 100% 准确，复杂混合任务可能误分类（可通过扩展关键词列表优化）
- **健康探针轻量**：仅检查 API 端点可达性，不验证模型推理质量
- **断路器简单**：固定阈值（3 次/120s），不支持自适应熔断
- **无记忆持久化**：断路器状态仅存于进程内存，重启后重置
