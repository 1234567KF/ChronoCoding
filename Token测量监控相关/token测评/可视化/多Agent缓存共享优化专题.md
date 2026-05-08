# 多Agent缓存共享 — Token优化专题

> 核心发现：同API Key下，多Agent相似prompt共享服务器端缓存，竞争模式不会线性增加token成本。

## 1. 缓存机制回顾

### 1.1 DeepSeek Prompt Cache 工作原理

```
请求1: [System Prompt 50K] + [Codebase Context 200K] + [Task 5K]
  → 服务器计算 prompt prefix hash
  → 首次：全部 token 按全价计费（¥3/MTok）
  → 缓存 50K+200K 前缀，TTL=5分钟

请求2: [System Prompt 50K] + [Codebase Context 200K] + [Different Task 3K]
  → 前缀 hash 命中！250K token 按缓存价（¥0.025/MTok）
  → 仅 3K 新任务 token 按全价
  → 成本：¥0.00625 + ¥0.009 = ¥0.015（vs 全价 ¥0.759）
```

### 1.2 缓存隔离边界

| 维度              | 是否共享  | 影响                                   |
| ----------------- | --------- | -------------------------------------- |
| API Key           | ❌ 不共享 | 不同用户的相同prompt不会命中对方的缓存 |
| 同一Key的不同会话 | ❌ 不共享 | 新session=新缓存起点                   |
| 同一会话内        | ✅ 共享   | **这是我们的优化空间**           |
| 缓存TTL           | 5分钟     | 超过5分钟无请求则缓存失效              |

## 2. 多Agent场景的缓存行为

### 2.1 场景：三队竞争评审 (`/夯`)

```
时刻 T0: Agent-Red   发起请求 → [System 50K] + [Code 200K] + [Red Task 3K]
          缓存建立：250K token 前缀

时刻 T1: Agent-Blue  发起请求 → [System 50K] + [Code 200K] + [Blue Task 3K]
          命中！250K 缓存 + 3K 新token = ¥0.015（vs 全价 ¥0.759，省98%）

时刻 T2: Agent-Green 发起请求 → [System 50K] + [Code 200K] + [Green Task 3K]
          命中！同Agent-Blue，省98%

时刻 T3: Judge Agent 发起请求 → [System 50K] + [Code 200K] + [Judge Task 2K]
          命中！（如果T0到T3 < 5分钟）

总成本（有缓存）：¥0.759 + ¥0.015×3 + ¥0.012 = ¥0.816
总成本（无缓存）：¥0.759 × 5 = ¥3.795
节省：78.5%
```

### 2.2 关键洞察

**相同部分（自动命中缓存）**：

- 系统指令（CLAUDE.md、技能描述、规则文件）→ 约 50K-100K token
- 项目代码上下文（codebase map、相关文件）→ 约 100K-300K token
- 工具定义（tool schema）→ 约 10K-30K token

**不同部分（按全价）**：

- 各Agent的角色定位指令（红/蓝/绿队不同侧重）→ 约 2K-5K token
- 具体任务描述 → 约 1K-3K token
- Agent的输出 → 按输出token计费

### 2.3 线性 vs 次线性

```
传统认知：5 agents = 5x token 成本
实际情况：5 agents ≈ 1x(首次) + 4×0.02x(缓存命中) ≈ 1.08x token 成本

不是"多agent浪费token"，而是"多agent几乎不增加输入token成本"。
```

## 3. SOP流水线的缓存红利

### 3.1 标准流水线模式

```
Stage 1: kf-alignment   → [Base Context 250K] + [Alignment Task]
Stage 2: kf-spec        → [Base Context 250K] + [Spec Task]      ← 缓存命中！
Stage 3: kf-code-review → [Base Context 250K] + [Review Task]    ← 缓存命中！
Stage 4: kf-browser-ops → [Base Context 250K] + [Browser Task]   ← 缓存命中！
```

只要流水线在 5 分钟内连续执行，每个 Stage 的基础上下文都命中缓存。

### 3.2 实测数据（来自 savings-calculator）

```
Session: c4f982cf (506次API调用)
  总输入: 55.1M token
  缓存命中: 54.5M token (98.8%)
  未缓存:   0.64M token (1.2%)

结论：98.8% 的输入token享受了缓存折扣（¥0.025/MTok vs ¥3/MTok）
```

## 4. 竞争模式为什么更优

### 4.1 token效率对比

| 模式                | Agent数 | 首次输入 | 后续输入(×N) | 总输入成本 | 效率 |
| ------------------- | ------- | -------- | ------------- | ---------- | ---- |
| 单Agent串行         | 1       | 100%     | 0             | 1.0x       | 基准 |
| 多Agent串行(无缓存) | 5       | 100%×5  | 0             | 5.0x       | ❌   |
| 多Agent并发(有缓存) | 5       | 100%×1  | ~2%×4        | ~1.08x     | ✅   |
| 三队竞争(有缓存)    | 3+1     | 100%×1  | ~2%×3        | ~1.06x     | ✅✅ |

### 4.2 竞争模式的额外优势

1. **质量提升**：多视角评审 → 发现更多问题 → 减少返工轮次 → 省token
2. **并行执行**：3队同时工作 → 总时间≈单队时间 → 不增加延迟
3. **缓存共享**：同会话内所有agent共享基础上下文缓存
4. **角色差异化的token开销极小**：红蓝绿队的角色描述差异仅 2K-5K token

## 5. 可进一步优化的方向

### 5.1 缓存预热策略

```
方案：在流水线开始前，发送一个"缓存预热"请求
  → 包含所有公共上下文（system + codebase + tools）
  → 后续所有agent请求自动命中缓存
  → 成本：预热请求的全价输入 + 后续请求的缓存价

当前状态：自然预热（第一个agent承担全价）
优化潜力：无明显收益（第一个agent本身就是预热）
```

### 5.2 会话连续性

```
方案：使用 context-mode 保持会话不中断
  → 超过5分钟无请求 → 缓存失效 → 下次需重新建立
  → context-mode 定期心跳 → 保持缓存活跃
  → 成本：心跳请求的token消耗 vs 缓存重建的token消耗

当前状态：已有 context-mode 全局依赖，但未明确用于缓存保持
优化潜力：中等（取决于会话间隔）
```

**⚠️ 2026-05-08 实测分析：不建议启用 context-mode 做缓存保持**

对比依据（RTK_vs_lean-ctx 实测 + 机制分析）：

| 维度 | lean-ctx | context-mode | 结论 |
|------|----------|-------------|------|
| 综合 token 节省 | **72%**（实测） | ~65%（官方声称） | lean-ctx 胜 |
| git log 压缩 | **72%** | 无专项 | lean-ctx 碾压 |
| 大文件读取 | **~100%**（map 模式） | 99.7%（沙箱） | 接近 |
| 缓存保持机制 | CCP 跨会话记忆 | SQLite 心跳 | 均非 prompt cache 保持 |
| 心跳成本 | 无额外开销 | ~¥0.075/h（每5min发送250K token前缀） | lean-ctx 零成本 |

**关键发现**：
1. DeepSeek  prompt cache 是服务器端行为，TTL=5分钟。客户端心跳**无法保证**缓存在服务器端不被驱逐
2. 98.8% 的输入 token 已享受缓存折扣 — 心跳的边际收益接近零
3. context-mode 的 "Session Continuity" 实际是 SQLite 状态追踪（编辑/git/任务），不是 prompt cache 保持
4. lean-ctx 的 CCP 提供跨会话记忆，零额外 token 开销

**结论：不启用 context-mode 做缓存保持。保持 lean-ctx 为主力，无需额外心跳机制。**

### 5.3 Prompt模板标准化

```
方案：为SOP流水线定义标准prompt前缀模板
  → 所有agent使用相同的前缀结构
  → 最大化缓存命中率
  → 仅差异化角色指令和具体任务

当前状态：各agent prompt由各自的SKILL.md定义，结构不完全一致
优化潜力：高（可系统性地提高缓存命中率）
```

**✅ 2026-05-08 已实施**

创建了 `agent-prompt-prefix.md` 作为标准化共享前缀模板，包含：
1. 项目上下文引用（固定文本）
2. 工具与约束声明（固定文本）
3. Lambda 通信协议（固定文本）
4. CCP 回调协议（固定文本）
5. 输出格式规范（固定文本）

协调者在 spawn agent 时，共享前缀逐字复制（不变），仅差异化：
- 团队角色（Red/Blue/Green）→ ~2K-5K token
- 阶段说明（Stage 0-5）→ ~1K-2K token
- 具体任务描述 → ~1K-3K token

预期效果：
- 第二个 agent 起，共享前缀命中缓存（¥0.025/MTok vs ¥3/MTok）
- N 个 agent 的输入成本 ≈ 1x(首次全价) + (N-1)×0.02x(缓存价)
- 配合 98.8% 的现有缓存命中率，进一步降低差异化部分的 token 开销

## 6. 结论

1. **多Agent竞争不线性增加token**：得益于同会话缓存共享，N个agent的成本 ≈ 1 + (N-1)×0.02 倍
2. **SOP流水线享受缓存红利**：标准化流程→相似的prompt前缀→高缓存命中率
3. **竞争模式推荐理由增强**：不仅质量更好（多视角），而且token效率接近单agent
4. **进一步优化方向**：统一prompt前缀模板 → ✅ 已实施 (agent-prompt-prefix.md)
5. **context-mode 缓存保持** → ❌ 不建议启用（心跳成本 > 收益，lean-ctx 已覆盖）
