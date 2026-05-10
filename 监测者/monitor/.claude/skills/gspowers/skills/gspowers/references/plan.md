# 规划期指令

当前阶段：`current_phase = "plan"`。根据 state.json 中的 `current_step` 执行对应指令。

> existing 项目跳过 office-hours 和 plan-ceo-review，直接从 plan-eng-review 开始。
> plan-ceo-review 仅在新项目完成 office-hours 后询问（CEO 审查需要 product-requirements 作为输入）。

---

## office-hours

提示用户执行：

```
/office-hours
```

用户完成后：
1. 询问："office-hours 完成了吗？请提供产出文件路径（通常在 `~/.gstack/projects/{slug}/` 下）"
2. 用 Bash 复制：`cp <用户提供的路径> .gspowers/artifacts/product-requirements.md`
3. 更新 state.json：
   - 将 `"office-hours"` 加入 `completed_steps`
   - 设 `current_step` 为 `"plan-ceo-review"`
   - 更新 `last_updated`
   - 在 `artifacts` 中记录 `"product-requirements": ".gspowers/artifacts/product-requirements.md"`
4. 同步重写 handoff.md
5. 询问："下一步是 plan-ceo-review（可选）——从 CEO/创始人视角审查产品方向。需要吗？"
   - **是** → 继续到下方 plan-ceo-review
   - **否** → 将 `"plan-ceo-review"` 加入 `skipped_steps`，设 `current_step` 为 `"plan-eng-review"`，重写 handoff.md

---

## plan-ceo-review

提示用户执行：

```
/plan-ceo-review
```

用户完成后：
1. 收集产出文件路径
2. 用 Bash 复制：`cp <路径> .gspowers/artifacts/ceo-review.md`
3. 更新 state.json：
   - 将 `"plan-ceo-review"` 加入 `completed_steps`
   - 设 `current_step` 为 `"plan-eng-review"`
   - 更新 `last_updated` 和 `artifacts`
4. 同步重写 handoff.md

---

## plan-eng-review

根据 state.json 中的 `project_type` 和 `mode` 提示不同输入：

**新项目（完整模式）：**
```
/plan-eng-review

请读取 .gspowers/artifacts/product-requirements.md 作为输入。
```

**新项目（快速模式）：** office-hours 被跳过，没有 product-requirements.md。
先询问用户："快速模式跳过了 office-hours，请简要描述你要做什么（一段话即可），我来作为 plan-eng-review 的输入。"
将用户的描述写入 `.gspowers/artifacts/product-requirements.md`，然后：
```
/plan-eng-review

请读取 .gspowers/artifacts/product-requirements.md 作为输入。
```

**已有项目：**
```
/plan-eng-review

请读取项目根目录的 Update_Plan.md 作为输入。
```

用户完成后：
1. 收集产出文件路径
2. 用 Bash 复制：`cp <路径> .gspowers/artifacts/architecture.md`
3. 更新 state.json：
   - 将 `"plan-eng-review"` 加入 `completed_steps`
   - 设 `current_phase` 为 `"execute"`
   - 设 `current_step` 为 `"brainstorming"`
   - 更新 `last_updated` 和 `artifacts`
4. 同步重写 handoff.md
5. 显示：

```
⚠️ 下一步进入执行期（superpowers），需要清理上下文。
请执行 /clear，然后输入 /gspowers
```
