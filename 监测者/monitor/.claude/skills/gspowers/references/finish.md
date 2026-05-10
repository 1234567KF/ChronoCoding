# 收尾期指令

当前阶段：`current_phase = "finish"`。根据 state.json 中的 `current_step` 执行对应指令。

> 收尾期所有步骤都是 gstack skill，同一上下文内可连续执行，无需 /clear。

---

## review

提示用户执行：

```
/review
```

用户完成后：
1. 收集审查报告文件路径
2. 复制：`cp <路径> .gspowers/artifacts/review-report.md`
3. 询问："review 结果如何？有严重问题需要返回修复，还是通过了？"

**有严重问题：**
- 更新 state.json：
  - `current_phase` → `"execute"`
  - `current_step` → `"subagent-dev"`
  - `status` → `"failed"`
  - `failure_reason` → 用户描述的问题
  - 更新 `last_updated`
- 同步重写 handoff.md（包含失败原因）
- 显示：
```
⚠️ /review 发现严重问题，需要返回执行期修复。
请执行 /clear，然后输入 /gspowers
```

**通过：**
- 将 `"review"` 加入 `completed_steps`
- 检查 state.json 中的 `has_ui`：
  - `true` → 设 `current_step` 为 `"qa"`
  - `false` → 将 `"qa"` 加入 `skipped_steps`，设 `current_step` 为 `"ship"`
- 更新 state.json + 重写 handoff.md

---

## qa

> 仅当 `has_ui = true` 时执行此步骤。

询问用户："请提供你的开发服务器端口号"

提示用户执行：

```
/qa http://localhost:<用户提供的端口>
```

> 提醒：如果应用有登录墙，先执行 `/setup-browser-cookies` 导入浏览器 cookie。

用户完成后：
1. 将 `"qa"` 加入 `completed_steps`
2. 设 `current_step` 为 `"ship"`
3. 更新 state.json + 重写 handoff.md

---

## ship

提示用户执行：

```
/ship
```

用户完成后：
1. 询问 PR 链接
2. 将 `"ship"` 加入 `completed_steps`
3. 在 state.json 的 `artifacts` 中记录 `"pr_link": "<用户提供的链接>"`
4. 设 `current_step` 为 `"compound"`
5. 更新 state.json + 重写 handoff.md

---

## compound

> 可选步骤。将本次开发经验沉淀到 `docs/solutions/`，形成知识复利。

1. **可用性检查**：检查当前会话的可用 skills 列表中是否包含 `compound-engineering:ce-compound`（即 `/ce:compound`）
   - 不可用 → 显示："ce:compound 不可用，跳过经验沉淀"
   - 将 `"compound"` 加入 `skipped_steps`
   - 设 `current_step` 为 `"document-release"`
   - 更新 state.json + 重写 handoff.md
   - 跳到 document-release

2. **引导式提问**（帮助用户判断是否有经验值得记录）：

   > "在回答之前回顾一下本次开发过程：
   > - 遇到了意外的坑或 debug 难题吗？
   > - 发现了什么新的最佳实践或更好的做法？
   > - 有什么下次想避免或改进的？
   > （输入"跳过"可直接进入 document-release）"

3. **根据回答**：
   - "跳过"或全部"否" → 将 `"compound"` 加入 `skipped_steps`，设 `current_step` 为 `"document-release"`，更新 state.json + 重写 handoff.md，跳到 document-release
   - 任一"是" → 提示用户执行：

   ```
   /ce:compound
   ```

4. **用户完成后**：
   1. 将 `"compound"` 加入 `completed_steps`
   2. 设 `current_step` 为 `"document-release"`
   3. 更新 state.json + 重写 handoff.md

---

## document-release

提示用户执行：

```
/document-release
```

用户完成后：
1. 将 `"document-release"` 加入 `completed_steps`
2. 设 `current_phase` 为 `"done"`
3. 设 `status` 为 `"completed"`
4. 更新 `last_updated`
5. 更新 state.json + 重写 handoff.md
6. 显示完成统计摘要：

```
gspowers 流程完成！

  项目类型：{project_type} | {mode}模式
  总步骤：{completed_steps 数量} 完成 / {skipped_steps 数量} 跳过
  产出物：{artifacts 数量} 份（.gspowers/artifacts/）
  耗时：{started_at} → {last_updated}
  PR：{pr_link}
```
