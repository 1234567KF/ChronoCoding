# kf-kb-envoy — Knowledge Base Envoy

基于 Karpathy LLM Wiki 模式（知识库/raw/ → 知识库/wiki/ → CLAUDE.md）的知识库全生命周期管理。

## 四阶段流水线

- Phase 1 — 基建：搭建 知识库/raw/ + 知识库/wiki/ + CLAUDE.md 目录结构
- Phase 2 — 索引：摄入 知识库/raw/ 文件 → 生成 wiki 页面 → 更新 index
- Phase 3 — 交互：知识问答 + 任务执行
- Phase 4 — 绑定：与领域视角 skill 联动

## 目录结构

```
project/
├── 知识库/raw/       ← 原始文件（只读，只增不删）
├── 知识库/wiki/      ← LLM 生成和维护的结构化知识
│   ├── concepts/   概念页（一页一概念）
│   ├── entities/   实体页
│   ├── processes/  流程文档
│   ├── rules/      决策规则
│   ├── sources/    源文档摘要
│   └── meta/       索引 + 日志
└── CLAUDE.md  ← 项目指令 / Schema 规则
```

## 命令

| 命令 | 行为 |
|------|------|
| "摄入文件" / "ingest" | 读 知识库/raw/ → 生成 知识库/wiki/ 页面 → 更新 index |
| "lint" / "检查知识库" | 扫描 知识库/wiki/ 找死链/矛盾页/孤立页 |
| "更新知识库" | 全量扫描 知识库/raw/ → ingest → lint → 报告 |
