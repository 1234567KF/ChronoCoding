---
name: kf-evolution
description: |
  进化机制 — 个体+团队记忆沉淀系统。记录专家经验、团队编队历史，
  实现"越用越好"的持续进化。
  触发词："进化"、"记忆沉淀"、"专家记忆"、"团队记忆"、"经验积累"。
triggers:
  - 进化
  - 记忆沉淀
  - 专家记忆
  - 团队记忆
  - 经验积累
recommended_model: flash
metadata:
  principle: 省
  category: memory
  integrated-skills:
    - kf-multi-team-compete
    - kf-saver
---

# kf-evolution — 进化机制

## 核心职责

- 记录每位专家的任务经验和技术栈偏好
- 记录每次团队编队的阵容和评分
- 下次相似任务时推荐历史最优阵容
- 持续优化专家 prompt 中的个性化内容

## 个体进化流程

```
任务完成
  │
  ├── 1. 提取专家经验
  │     - 本次任务中该专家做了什么
  │     - 遇到什么困难、如何解决
  │     - 发现了什么技术栈偏好
  │
  ├── 2. 更新记忆文件
  │     - 追加经验教训
  │     - 更新技术栈偏好
  │     - 增加经验值
  │
  └── 3. 下次 spawn 该专家时
        - 读取专家记忆
        - 注入个性化 prompt
        - 偏好技术栈提示
```

## 团队进化流程

```
任务完成
  │
  ├── 1. 记录编队阵容和评分
  │
  ├── 2. 更新阵容模板（同类型任务）
  │     - 如果评分高 → 标记为推荐阵容
  │     - 如果评分低 → 标记为不推荐
  │
  └── 3. 下次同类型任务
        - 先查 team-composition.md
        - 用历史最高评分阵容
```

## 与 kf-multi-team-compete 的集成

- **Phase 6 完成后**：自动调用本技能，为所有专家追加任务经验，更新技术栈偏好
- **Phase 2 spawn agent 时**：读取专家记忆，将偏好和经验注入 agent prompt
- **裁判评分后**：记录该次编队的阵容和评分到 team-composition.md，更新阵容模板

## 记忆文件结构

```
.claude/memory/
├── expert-memory/        # 个体专家记忆
│   ├── INDEX.md          # 专家列表索引
│   ├── _template.md      # 专家记忆模板
│   ├── frontend.md       # 前端专家记忆
│   ├── backend.md        # 后端专家记忆
│   ├── qa.md             # QA 专家记忆
│   ├── code-review.md    # Code Review 专家记忆
│   └── researcher.md     # 调研专家记忆
└── team-composition.md   # 团队编队记忆
```

## 使用方式

### 手动触发
用户说"进化"、"记忆沉淀"、"专家记忆"、"团队记忆"、"经验积累"时，检查最新完成的任务并更新记忆。

### 自动集成
通过 kf-multi-team-compete（/夯）在任务完成时自动调用。
