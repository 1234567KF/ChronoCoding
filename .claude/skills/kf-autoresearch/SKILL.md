---
name: kf-autoresearch
description: |
  Karpathy's autoresearch — autonomous ML experiment agent that runs overnight on a single GPU.
  The AI agent modifies train.py, trains for 5 min, checks if val_bpb improved, keeps or discards, repeats ~100x/night.
  Trigger words: "自动实验", "ai实验", "实验跑一夜", "overnight research", "autoresearch", "ML实验", "让AI自己研究".
metadata:
  pattern: pipeline
  principle: 准
  steps: "5"
  integrated-skills:
    - kf-model-router
  recommended_model: flash
---

# kf-autoresearch — AI 自主科研实验

> 卡帕西(Karpathy)开源项目，让 AI 整夜自主跑 ML 实验。
>
> **你不需要熟悉任何命令。** 说你想做什么，AI 自动完成。

---

## 快速开始

### 你说一句，AI 搞定一切

| 你想做什么 | 说的话 |
|-----------|--------|
| 初始化环境 | "装好 autoresearch 环境" |
| 开启一夜实验 | "跑一夜实验，研究优化学习率" |
| 看最新成果 | "有哪些实验结果" |
| 对比baseline | "对比最新结果和baseline" |
| 换个研究方向 | "看看能不能减少模型深度但保持效果" |

### 本项目结构

```
.claude/skills/kf-autoresearch/     ← 技能文件（本文件）
tools/kf-autoresearch/              ← autoresearch 源码
├── prepare.py        # 数据准备（只读）
├── train.py          # 模型代码（agent 修改）
├── program.md        # 实验指令（AI 读取）
├── pyproject.toml    # 依赖
├── uv.lock           # 锁定依赖
└── README.md         # 原版说明
```

---

## Stage 0 — 环境检查

运行实验需要：

1. **NVIDIA GPU 单卡** — 在 H100 上测试通过
2. **Python 3.10+**
3. **uv 包管理器** — `npm install -g uv` 或 `curl -LsSf https://astral.sh/uv/install.sh | sh`
4. **CUDA 工具包**（PyTorch 2.9.1 + cu128）

### 检查清单

```bash
# Python 版本
python --version     # >= 3.10

# NVIDIA GPU
nvidia-smi           # 应有 GPU

# uv
uv --version         # 已安装

# 项目依赖
cd tools/kf-autoresearch
uv sync              # 安装 pytorch + 依赖
```

Gate: 所有检查通过后进入 Stage 1。

---

## Stage 1 — 数据准备（一次性）

```bash
cd tools/kf-autoresearch
uv run prepare.py
```

- 下载训练数据
- 训练 BPE tokenizer
- 到 `~/.cache/autoresearch/` 下
- 约 2 分钟

Gate: prepare.py 执行成功后进入 Stage 2。

---

## Stage 2 — 基线实验（首次必做）

```bash
cd tools/kf-autoresearch

# 创建实验分支
git checkout -b autoresearch/<日期标签>

# 首次运行建立 baseline
uv run train.py > run.log 2>&1

# 读取结果
grep "^val_bpb:" run.log
```

输出格式：
```
val_bpb:          0.997900    ← 越低越好
training_seconds: 300.1       ← 固定 5 分钟
peak_vram_mb:     45060.2
total_tokens_M:   499.6
num_params_M:     50.3
```

记录到 `results.tsv`：
```
commit	val_bpb	memory_gb	status	description
abc1234	0.997900	44.0	keep	baseline
```

Gate: baseline 记录完成后进入 Stage 3。

---

## Stage 3 — 实验循环（核心）

AI 自动执行循环：

```
LOOP:
  1. 读 program.md 和上次结果
  2. 想一个新的改进方向
  3. 修改 train.py
  4. git commit
  5. uv run train.py > run.log 2>&1（5 分钟）
  6. grep "^val_bpb:" run.log
  7. 如果改进（val_bpb 降低）→ 保留 commit
  8. 如果没改进 → git reset 回退
  9. 记录到 results.tsv
  10. 回到步骤 1
```

### AI 可以改什么

| 类别 | 举例 |
|------|------|
| 超参数 | 学习率、batch size、优化器参数 |
| 架构 | 层数、宽度、注意力模式 |
| 优化器 | Muon/AdamW 配置 |
| 训练循环 | 学习率调度、梯度裁剪 |

### AI 不能改什么

- `prepare.py` — 只读，不修改
- 不新增依赖包
- 不改评估函数 `evaluate_bpb`

### 实验结果记录

```bash
# 查看所有实验
cat results.tsv

# 查看最新结果
tail -5 results.tsv

# 只看最好的
sort -t$'\t' -k2,2n results.tsv | head -5
```

Gate: AI 持续循环直到用户说停。

---

## Stage 4 — 结果分析

```bash
cd tools/kf-autoresearch

# 最佳结果
sort -t$'\t' -k2,2n results.tsv | head -3

# vs baseline
head -2 results.tsv
```

### 汇报格式

```
## 实验结果报告

### 执行概况
- 实验数：12
- 有效改进：3
- 总耗时：~1小时

### 最佳改进
| 实验 | val_bpb | 内存 | 描述 |
|------|---------|------|------|
| baseline | 0.9979 | 44GB | 原始 |
| #5 | 0.9932 | 44.2GB | 提高 LR 到 0.04 |

### 发现的模式
- 学习率 0.04 明显优于默认 0.02
- SwiGLU 激活没有带来提升
```

---

## Stage 5 — 清理/恢复

```bash
# 切回主分支
git checkout master

# 查看所有实验分支
git branch | grep autoresearch

# 删除旧分支
git branch -D autoresearch/mar5
```

---

## 注意事项

1. **本技能是 on-demand 型**：你说"跑实验"才启动，不会自动运行
2. **环境依赖**：需要 **NVIDIA GPU + CUDA**（PyTorch 2.9.1 + cu128），AMD GPU 不支持
3. **显卡不足？** 调整 `prepare.py` 中的 `MAX_SEQ_LEN`、`DEPTH`、`TOTAL_BATCH_SIZE` 可适配小显存
4. **Windows 支持**：推荐用 [jsegov/autoresearch-win-rtx](https://github.com/jsegov/autoresearch-win-rtx) fork
5. **Mac 用户**：推荐 [miolini/autoresearch-macos](https://github.com/miolini/autoresearch-macos) 或 [trevin-creator/autoresearch-mlx](https://github.com/trevin-creator/autoresearch-mlx)

## 本机状态

- **GPU**：NVIDIA GeForce RTX 3060 Laptop GPU, 6GB → **不满足**（需 CUDA）
- **实际 GPU**：AMD 显卡（非 NVIDIA），CUDA 不可用
- **结论**：本机无法运行 autorsearch 实验。技能保留，等有 NVIDIA GPU 的机器时可用。
- **快速启用**：在有 NVIDIA GPU 的机器上 `cd tools/kf-autoresearch && uv sync && uv run prepare.py` 即可就绪。
