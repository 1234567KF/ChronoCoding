# execute.md 修改补丁

## 修改位置

文件路径：`~/.claude/skills/gspowers/references/execute.md`

## 修改说明

在 `subagent-dev` 步骤中添加 Pipeline 模式检测和路由逻辑。

---

## 原始 subagent-dev 内容（第 97-116 行）

```
## subagent-dev

提示用户执行：

```
/superpowers:subagent-driven-development

请读取 .gspowers/artifacts/implementation-plan.md
```

用户完成后：
1. 将 `"subagent-dev"` 加入 `completed_steps`（如果已存在则跳过，不重复）
2. 设 `current_phase` 为 `"finish"`
3. 设 `current_step` 为 `"review"`
4. 如果 `status` 为 `"failed"`，将其重置为 `"in_progress"` 并清除 `failure_reason`（回退修复后恢复正常状态）
5. 更新 state.json + 重写 handoff.md
5. 显示：

```
⚠️ 下一步进入收尾期（gstack），需要清理上下文。
请执行 /clear，然后输入 /gspowers
```
```

---

## 修改后的 subagent-dev 内容

```
## subagent-dev

### 检测 Pipeline 模式

在提示用户之前，先检测是否需要进入 Pipeline 模式：

1. 检查 state.json 中是否已有 `pipeline.enabled = true`（断点恢复）
2. 检查 implementation-plan.md 是否包含 `pipeline:` 或 `modules:` 配置
3. 检查用户输入是否包含触发词：
   - `/pipeline-dev`
   - `多模块开发`
   - `流水线开发`

满足任一条件 → 进入 pipeline-dev 流程（见下方）

不满足 → 执行原有单模块 subagent-dev 流程

---

### 单模块 subagent-dev（原有逻辑）

提示用户执行：

```
/superpowers:subagent-driven-development

请读取 .gspowers/artifacts/implementation-plan.md
```

用户完成后：
1. 将 `"subagent-dev"` 加入 `completed_steps`
2. 设 `current_phase` 为 `"finish"`
3. 设 `current_step` 为 `"review"`
4. 如果 `status` 为 `"failed"`，将其重置为 `"in_progress"` 并清除 `failure_reason`
5. 更新 state.json + 重写 handoff.md
6. 显示：

```
⚠️ 下一步进入收尾期（gstack），需要清理上下文。
请执行 /clear，然后输入 /gspowers
```

---

### pipeline-dev（新增流程）

#### pipeline-init（初始化）

当检测到需要进入 Pipeline 模式时：

1. **提取模块配置**
   - 尝试从 implementation-plan.md 解析 `pipeline.modules` 配置
   - 如无配置，询问用户：
     > "未检测到模块配置。请描述你的项目包含哪些模块以及它们之间的依赖关系。
     > 格式示例：
     > - 模块A（无依赖）
     > - 模块B（依赖A）
     > - 模块C（依赖A、B）"

2. **验证依赖**
   - 构建 DAG（有向无环图）
   - 检测循环依赖
   - 如有循环，报错：
     ```
     ❌ 检测到循环依赖：
       order-service → payment-service → order-service
     请修正依赖关系后重试。
     ```

3. **计算批次**
   - 拓扑排序
   - 划分执行批次

4. **更新 state.json**
   ```json
   {
     "pipeline": {
       "enabled": true,
       "modules": {
         "user-service": {
           "name": "user-service",
           "display_name": "用户服务",
           "path": "services/user",
           "depends_on": [],
           "status": "pending",
           "batch": 1
         }
       },
       "batches": [["user-service"], ["product-service"], ...],
       "current_batch": 1
     }
   }
   ```

5. **显示流水线概览**
   ```
   ═══════════════════════════════════════════════════════
   📦 多模块流水线 - 初始化完成
   ═══════════════════════════════════════════════════════
   
   模块数量: 4
   批次数量: 4
   
   批次规划:
   ├─ 批次1: user-service
   ├─ 批次2: product-service
   ├─ 批次3: order-service
   └─ 批次4: payment-service
   
   依赖拓扑:
   user-service
   └─ product-service
      └─ order-service
         └─ payment-service
   
   下一步: 输入 /gspowers 继续，开始批次1
   ```

6. **设 `current_step` 为 `"pipeline-dev"`**
   更新 state.json + 重写 handoff.md

---

#### pipeline-execute（批次执行）

继续 `/gspowers` 时执行此步骤：

1. **读取当前批次**
   从 state.json `pipeline.batches[pipeline.current_batch - 1]` 获取当前批次模块

2. **显示批次信息**
   ```
   ═══════════════════════════════════════════════════════
   🔄 批次 {n}/{total} 开始执行
   ═══════════════════════════════════════════════════════
   
   本批次模块:
   └─ {module-name} ({path})
       描述: {description}
   
   等待所有模块通过后进入下一批次...
   ```

3. **更新模块状态**
   - 将本批次模块状态设为 `running`

4. **提示执行命令**
   ```
   请执行: /superpowers:subagent-driven-development
   
   针对模块: {module-name}
   请读取: .gspowers/artifacts/implementation-plan.md
   注意：只需开发本模块，不要跨模块修改
   ```

5. **用户完成后**
   - 询问："模块执行结果如何？通过 / 失败 / 需要修改"
   - 更新模块状态（`passed` 或 `failed`）
   - 执行门控检查

---

#### pipeline-gate-check（门控检查）

批次执行完成后进行门控检查：

**全部 passed**：
```
批次{n} 完成

├─ {module-name}: passed ✓
│
⚠️ 门控检查通过，准备进入批次{n+1}
```
- `current_batch` + 1
- 更新 state.json
- 继续 pipeline-execute

**有任何 failed**：
```
批次{n} 执行结果

├─ {passed-module}: passed ✓
└─ {failed-module}: failed ✗
   失败原因: {reason}

❌ 门控检查未通过

原因: {failed-module} 测试失败

当前状态:
├─ 批次1: user-service ✓
└─ 批次{n}: {failed-module} ✗ (blocked)

建议:
1. 修复 {failed-module} 的问题
2. 重新运行 /gspowers 继续
```
- 终止流水线
- 等待用户修复

---

#### pipeline-complete（流水线完成）

所有批次都通过后：

```
═══════════════════════════════════════════════════════
✅ 多模块流水线 - 全部完成
═══════════════════════════════════════════════════════

执行摘要:
├─ 总模块数: {total-modules}
├─ 总批次数: {total-batches}
├─ 成功: {total-modules}
└─ 失败: 0

详细结果:
├─ 批次1: {module} ✓
├─ 批次2: {module} ✓
├─ 批次3: {module} ✓
└─ 批次4: {module} ✓

产出物:
├─ {module1-path}/* (代码 + 测试)
├─ {module2-path}/* (代码 + 测试)
...
├─ {moduleN-path}/* (代码 + 测试)

下一步: /gspowers 继续，进入 review 阶段
```

- 将 `"subagent-dev"` 加入 `completed_steps`
- 设 `current_phase` 为 `"finish"`
- 设 `current_step` 为 `"review"`
- 更新 state.json + 重写 handoff.md
- 显示 `/clear` 提示

---

## 需要在 state.json schema 新增的字段

```json
{
  "pipeline": {
    "enabled": "boolean - 是否启用 Pipeline 模式",
    "modules": {
      "[module-name]": {
        "name": "string - 模块唯一标识",
        "display_name": "string - 显示名称",
        "path": "string - 代码路径",
        "description": "string - 模块描述",
        "depends_on": "array - 依赖模块列表",
        "status": "enum - pending/running/passed/failed/skipped",
        "batch": "number - 所属批次",
        "test_results": "object|null - 测试结果",
        "artifacts": "array - 产出物路径"
      }
    },
    "batches": "array - 批次顺序，每个元素是该批次模块名数组",
    "current_batch": "number - 当前执行批次（1-based）",
    "started_at": "string - ISO 8601 开始时间",
    "batch_results": "array - 每批次执行结果"
  }
}
```

---

## 完整修改代码块

将 `subagent-dev` 整个章节替换为以下内容：

```markdown
## subagent-dev

### 检测 Pipeline 模式

在提示用户之前，先检测是否需要进入 Pipeline 模式：

1. 检查 state.json 中是否已有 `pipeline.enabled = true`（断点恢复）
2. 检查 implementation-plan.md 是否包含 `pipeline:` 或 `modules:` 配置
3. 检查用户输入是否包含触发词：
   - `/pipeline-dev`
   - `多模块开发`
   - `流水线开发`

满足任一条件 → 进入 pipeline-dev 流程（见下方）

不满足 → 执行原有单模块 subagent-dev 流程

---

### 单模块 subagent-dev（原有逻辑）

提示用户执行：

```
/superpowers:subagent-driven-development

请读取 .gspowers/artifacts/implementation-plan.md
```

用户完成后：
1. 将 `"subagent-dev"` 加入 `completed_steps`
2. 设 `current_phase` 为 `"finish"`
3. 设 `current_step` 为 `"review"`
4. 如果 `status` 为 `"failed"`，将其重置为 `"in_progress"` 并清除 `failure_reason`
5. 更新 state.json + 重写 handoff.md
6. 显示：

```
⚠️ 下一步进入收尾期（gstack），需要清理上下文。
请执行 /clear，然后输入 /gspowers
```

---

### pipeline-dev（新增流程）

#### pipeline-init（初始化）

当检测到需要进入 Pipeline 模式时：

1. **提取模块配置**
   - 尝试从 implementation-plan.md 解析 `pipeline.modules` 配置
   - 如无配置，询问用户：
     > "未检测到模块配置。请描述你的项目包含哪些模块以及它们之间的依赖关系。"

2. **验证依赖**
   - 构建 DAG
   - 检测循环依赖
   - 如有循环，报错并停止

3. **计算批次**
   - 拓扑排序
   - 划分执行批次

4. **更新 state.json**
   添加 `pipeline` 节点

5. **显示流水线概览**
   ```
   ═══════════════════════════════════════════════════════
   📦 多模块流水线 - 初始化完成
   ═══════════════════════════════════════════════════════
   
   模块数量: {n}
   批次数量: {m}
   
   批次规划:
   ├─ 批次1: {module}
   ...
   
   下一步: 输入 /gspowers 继续，开始批次1
   ```

6. **设 `current_step` 为 `"pipeline-dev"`**
   更新 state.json + 重写 handoff.md

---

#### pipeline-execute（批次执行）

继续 `/gspowers` 时：

1. 读取当前批次
2. 显示批次信息
3. 更新模块状态为 `running`
4. 提示执行命令
5. 用户完成后更新状态 + 门控检查

#### pipeline-gate-check（门控检查）

- 全部 passed → 进入下一批次
- 有 failed → 终止流水线，提示修复

#### pipeline-complete（流水线完成）

- 显示完成摘要
- 清理 pipeline 状态
- 进入 finish 阶段
```
