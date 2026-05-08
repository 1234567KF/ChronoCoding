# kf-kdd — Knowledge-Driven Documentation

基于 Karpathy LLM Wiki 模式的知识库模板框架。

```
project/
├── 知识库相关/raw/       ← 原始文件（只读，只增不删）
├── 知识库相关/wiki/      ← LLM 生成和维护的结构化知识
│   ├── concepts/
│   ├── entities/
│   ├── processes/
│   ├── rules/
│   ├── sources/
│   └── meta/
├── .claude/
└── CLAUDE.md
```

## 使用方法

1. 将你的原始文档放入 `知识库相关/raw/` 对应分类目录
2. 说 **"摄入"** — LLM 自动读 知识库相关/raw/ → 生成 wiki 页面 → 创建 index
3. 提问时自动路由到 知识库相关/wiki/ 查询
4. 定期说 **"做 lint 检查"** 维护一致性

## 技术来源

- [Karpathy LLM Wiki 模式](https://www.digitaltoday.co.kr/cn/view/45525/karpathy-reveals-personal-ai-knowledge-base-built-with-three-folders)

## 许可证

MIT
