# gspowers

AI 开发全流程编排器——一个 Claude Code skill，协调 [gstack](https://github.com/garry/gstack)（产品/架构）和 [superpowers](https://github.com/supercorp-ai/superpower-claude-code)（工程/测试）的开发流程。

## 快速开始

```bash
# 安装
git clone https://github.com/fshaan/gspowers.git
cd gspowers
./install.sh

# 使用：在任何 git 项目中
/gspowers
```

首次运行会引导完成项目设置（3 个问题），然后显示流程地图和下一步命令。

## 工作原理

gspowers 是一个"导航员"——不自动执行命令，而是告诉你当前在哪、下一步该做什么。

```
★ 规划期 ──────────────────────────
├─ office-hours          (gstack)
├─ plan-ceo-review (可选) (gstack)
├─ plan-eng-review       (gstack)
★ 执行期 ──────────── /clear ────
├─ brainstorming         (superpowers)
├─ writing-plans         (superpowers)
├─ subagent-dev          (superpowers)
★ 收尾期 ──────────── /clear ────
├─ /review               (gstack)
├─ /qa (仅 UI 项目)      (gstack)
├─ /ship                 (gstack)
├─ /ce:compound (可选)   (CE plugin)
└─ /document-release     (gstack)
```

每次执行 `/gspowers`：读取 `.gspowers/state.json` → 显示流程地图 → 提示下一步命令。

## 前置条件

- [gstack](https://github.com/garry/gstack) 已安装
- [superpowers](https://github.com/supercorp-ai/superpower-claude-code) 已安装（Claude Code plugin）
- 项目已 `git init`

## 文件结构

```
skills/gspowers/
├── SKILL.md              # 调度器路由
└── references/
    ├── init.md           # 首次启动
    ├── plan.md           # 规划期指令
    ├── execute.md        # 执行期指令
    ├── finish.md         # 收尾期指令
    ├── sop.md            # 完整操作手册
    └── tools-guide.md    # 补充工具速查
```

## 文档

- [完整 SOP](skills/gspowers/references/sop.md) — 操作手册、state.json 字段、异常处理
- [补充工具](skills/gspowers/references/tools-guide.md) — /retro, /investigate, /cso 等
- [技术设计 v1.0](docs/superpowers/specs/2026-03-25-gspowers-skill-design.md) — 架构决策和设计细节
- [技术设计 v1.1](docs/superpowers/specs/2026-04-01-gspowers-v1.1-design.md) — 知识复利闭环
- [实现计划 v1.0](docs/superpowers/plans/2026-03-25-gspowers-skill.md) — 开发任务分解
- [实现计划 v1.1](docs/superpowers/plans/2026-04-02-gspowers-v1.1-knowledge-compounding.md) — 知识复利实现

## License

MIT
