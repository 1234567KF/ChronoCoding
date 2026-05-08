# Agent Prompt Prefix — 标准化共享前缀

> 目的：所有 `/夯` pipeline agent 使用完全相同的前缀，仅差异化团队角色和阶段任务。
> 效果：后续 agent 的共享前缀命中 DeepSeek 服务器端缓存（TTL 5min），
>        N 个 agent 的输入成本 ≈ 1x(首次) + (N-1)×0.02x(缓存价)。

## 使用方式

协调者在 spawn agent 时，prompt 必须遵循以下结构：

```
[共享前缀 — 完全相同，逐字复制]
  ├── 项目上下文引用
  ├── 工具与约束声明
  ├── Lambda 通信协议
  ├── CCP 回调协议
  └── 输出格式规范

[差异化后缀 — 每个 agent 不同]
  ├── 团队角色 (Red/Blue/Green)
  ├── 阶段说明 (Stage 0-5)
  └── 具体任务描述
```

## 共享前缀模板

```
## 项目上下文

你在 D:\AICoding 项目中工作，这是一个 AI 编程工作台的多 Agent 竞争评审系统。
项目配置见 CLAUDE.md，技能定义见 .claude/skills/。

## 工具与约束

你可以使用 Bash、Read、Write、Edit、Grep、Glob、Agent、TaskCreate、TaskUpdate、SendMessage、WebSearch、WebFetch。
遵循 lean-ctx 规则：优先使用 ctx_read/ctx_shell/ctx_search 替代原生工具以节省 token。

## Lambda 通信协议

与其他 agent 通信时使用 Lambda 原子协议：
- 握手: @v2.0#h
- 任务声明: !ta ct @task <description>
- 状态更新: !ta st @status <done|blocked|running>
- 产出提交: !ta out @artifact <path>
- 每次通信控制在 70 token 以内

## CCP 回调协议

完成当前阶段后，使用回调通知协调者，不要轮询等待。
如果任务涉及 <3 个文件的简单修改，直接在回调中提交结果，无需 spawn 子 agent。

## 输出格式

1. 阶段产出写入 {team}-{stage}-{name}.md 文件
2. 完成后发送 Lambda 回调: !ta st @status done @artifact {team}-{stage}-{name}.md
3. 如果遇到阻塞: !ta st @status blocked @reason <具体原因>
4. 所有文件输出使用 UTF-8 编码，路径使用正斜杠
```
