# 标准注释模板 — 6 类业务注释填充模板

> 本模板定义每个页面 MUST 包含的 6 类注释的标准填充格式。
> 生成原型时，将本模板中的标记按 PRD 内容替换为实际值。
> 本模板按 L0-L6 层组织，与 annotation-spec.md 对应。

---

## L0 页面概述 — 业务描述模板

```html
<div class="anno-tab-content active" id="anno-tab-l0">
<h3>📋 页面概述</h3>

<table>
<tr><td>页面名称</td><td>{{页面名称}}</td></tr>
<tr><td>路由</td><td>{{路由路径}}</td></tr>
<tr><td>访问角色</td><td>{{角色列表}}</td></tr>
<tr><td>入口来源</td><td>{{从菜单/按钮进入}}</td></tr>
</table>

<h4>CRUD 操作矩阵</h4>
<table>
<tr><th>操作</th><th>支持</th><th>角色权限</th><th>触发入口</th></tr>
<tr><td>新增</td><td>{{✅/❌}}</td><td>{{角色}}</td><td>{{按钮位置}}</td></tr>
<tr><td>查询</td><td>{{✅/❌}}</td><td>{{角色}}</td><td>页面默认</td></tr>
<tr><td>查看详情</td><td>{{✅/❌}}</td><td>{{角色}}</td><td>{{操作列}}</td></tr>
<tr><td>编辑</td><td>{{✅/❌}}</td><td>{{角色}}</td><td>{{操作列}}</td></tr>
<tr><td>删除</td><td>{{✅/❌}}</td><td>{{角色}}</td><td>{{操作列}}</td></tr>
<tr><td>{{其他操作}}</td><td>{{✅/❌}}</td><td>{{角色}}</td><td>{{位置}}</td></tr>
</table>

<h4>数据权限</h4>
<table>
<tr><th>角色</th><th>可见数据范围</th><th>可操作范围</th></tr>
<tr><td>{{角色1}}</td><td>{{范围}}</td><td>{{操作}}</td></tr>
<tr><td>{{角色2}}</td><td>{{范围}}</td><td>{{操作}}</td></tr>
</table>

<h4>业务关联</h4>
<table>
<tr><th>关联实体</th><th>关联类型</th><th>关联字段</th><th>联动规则</th></tr>
<tr><td>{{实体}}</td><td>{{1:1/1:N/N:M}}</td><td>{{字段}}</td><td>{{规则}}</td></tr>
</table>
</div>
```

---

## L1-a 查询字段模板

```html
<div class="anno-tab-content" id="anno-tab-l1">

<!-- ===== L1-a 查询字段 ===== -->
<h3>🔍 查询字段</h3>
<table>
<tr><th>字段名</th><th>字段类型</th><th>前端表现形式</th><th>数据校验规则</th></tr>
<tr><td>{{名称}} (`{{key}}`)</td><td>{{string/number/date/enum}}</td><td>{{输入框/下拉框/日期选择器}}</td><td>{{必填项/格式/边界值}}</td></tr>
<tr><td>{{名称}} (`{{key}}`)</td><td>{{类型}}</td><td>{{控件}}</td><td>{{规则}}</td></tr>
</table>
```

---

## L1-b 列表字段模板

```html
<!-- ===== L1-b 列表字段 ===== -->
<h3>📊 列表字段</h3>
<table>
<tr><th>字段名</th><th>字段类型</th><th>字段说明</th><th>前端表现形式</th></tr>
<tr><td>{{名称}} (`{{key}}`)</td><td>{{string/enum/number}}</td><td>{{面向用户的说明}}</td><td>{{文本/标签/徽章/链接}}</td></tr>
<tr><td>{{名称}} (`{{key}}`)</td><td>{{类型}}</td><td>{{说明}}</td><td>{{形式}}</td></tr>
</table>
```

---

## L1-c 新增表单字段模板

```html
<!-- ===== L1-c 新增表单字段 ===== -->
<h3>➕ 新增表单字段</h3>
<table>
<tr><th>字段名</th><th>字段类型</th><th>字段说明</th><th>前端表现形式</th><th>数据校验规则</th></tr>
<tr><td>{{名称}} (`{{key}}`)</td><td>{{string/number/enum/date/file}}</td><td>{{说明}}</td><td>{{输入框/下拉框/开关/上传}}</td><td>{{必填, maxLength: N, min: N, max: N}}</td></tr>
<tr><td>{{名称}} (`{{key}}`)</td><td>{{类型}}</td><td>{{说明}}</td><td>{{控件}}</td><td>{{校验规则含边界值}}</td></tr>
</table>
```

---

## L1-d 修改表单字段模板

```html
<!-- ===== L1-d 修改表单字段 ===== -->
<h3>✏️ 修改表单字段</h3>
<table>
<tr><th>字段名</th><th>字段类型</th><th>字段说明</th><th>前端表现形式</th><th>数据校验规则</th><th>与新增差异</th></tr>
<tr><td>{{名称}} (`{{key}}`)</td><td>{{类型}}</td><td>{{说明}}</td><td>{{输入框/只读/下拉框}}</td><td>{{校验规则}}</td><td>{{同新增 / 修改时只读 / 修改时选填}}</td></tr>
<tr><td>{{名称}} (`{{key}}`)</td><td>{{类型}}</td><td>{{说明}}</td><td>{{控件}}</td><td>{{规则}}</td><td>{{差异}}</td></tr>
</table>
</div>
```

---

## L2-L5 模板（保持原 L0-L6 结构）

### L2 业务规则

```html
<div class="anno-tab-content" id="anno-tab-l2">
<h3>📐 业务规则</h3>

<h4>BR-1 {{规则名称}}</h4>
<table>
<tr><td>类型</td><td>{{校验/计算/联动/权限/流程/幂等/超时}}</td></tr>
<tr><td>触发条件</td><td>{{条件}}</td></tr>
<tr><td>规则描述</td><td>{{描述}}</td></tr>
<tr><td>违反时行为</td><td>{{行为}}</td></tr>
<tr><td>错误提示</td><td>{{消息}}</td></tr>
<tr><td>测试用例</td><td>TC-N: {{场景}}</td></tr>
</table>
</div>
```

### L3 状态机

```html
<div class="anno-tab-content" id="anno-tab-l3">
<h3>🔄 状态机 — {{实体名称}}</h3>

<h4>状态列表</h4>
<table>
<tr><th>状态码</th><th>显示文案</th><th>标签颜色</th><th>说明</th></tr>
<tr><td>{{code}}</td><td>{{label}}</td><td>{{color}}</td><td>{{desc}}</td></tr>
</table>

<h4>状态流转</h4>
<table>
<tr><th>当前状态</th><th>目标状态</th><th>触发操作</th><th>前置条件</th><th>后置动作</th><th>触发角色</th></tr>
<tr><td>{{from}}</td><td>{{to}}</td><td>{{action}}</td><td>{{condition}}</td><td>{{post}}</td><td>{{role}}</td></tr>
</table>
</div>
```

### L4 UI 元素行为

```html
<div class="anno-tab-content" id="anno-tab-l4">
<h3>🖱️ UI 元素行为</h3>

<h4>按钮矩阵</h4>
<table>
<tr><th>按钮标识</th><th>显示文案</th><th>所在位置</th><th>显示条件</th><th>禁用条件</th><th>点击行为</th></tr>
<tr><td>{{id}}</td><td>{{text}}</td><td>{{位置}}</td><td>{{条件}}</td><td>{{条件}}</td><td>{{行为}}</td></tr>
</table>
</div>
```

### L5 设计决策

```html
<div class="anno-tab-content" id="anno-tab-l5">
<h3>💡 设计决策</h3>

<table>
<tr><td>背景</td><td>{{context}}</td></tr>
<tr><td>方案选择</td><td>{{chosen}}</td></tr>
<tr><td>替代方案</td><td>{{alternatives}}</td></tr>
<tr><td>取舍原因</td><td>{{reason}}</td></tr>
<tr><td>已知限制</td><td>{{limitations}}</td></tr>
</table>
</div>
```

---

## L6 测试场景 — 含异常处理与边界值模板

```html
<div class="anno-tab-content" id="anno-tab-l6">
<h3>🧪 测试场景</h3>

<h4>标准测试场景</h4>
<table>
<tr><th>ID</th><th>场景</th><th>类型</th><th>前置条件</th><th>期望结果</th><th>优先级</th></tr>
<tr><td>TC-1</td><td>{{场景}}</td><td>{{正常/异常/边界}}</td><td>{{条件}}</td><td>{{结果}}</td><td>{{P0/P1/P2}}</td></tr>
</table>

<!-- ===== 异常处理表 ===== -->
<h4>⚠️ 异常处理</h4>
<table>
<tr><th>异常场景</th><th>触发条件</th><th>错误提示</th><th>系统响应</th><th>恢复操作</th></tr>
<tr><td>{{场景}}</td><td>{{条件}}</td><td>{{消息}}</td><td>{{行为}}</td><td>{{恢复}}</td></tr>
<tr><td>必填为空</td><td>{{条件}}</td><td>{{消息}}</td><td>{{行为}}</td><td>{{恢复}}</td></tr>
<tr><td>格式错误</td><td>{{条件}}</td><td>{{消息}}</td><td>{{行为}}</td><td>{{恢复}}</td></tr>
<tr><td>数据冲突</td><td>{{条件}}</td><td>{{消息}}</td><td>{{行为}}</td><td>{{恢复}}</td></tr>
<tr><td>网络超时</td><td>{{条件}}</td><td>{{消息}}</td><td>{{行为}}</td><td>{{恢复}}</td></tr>
</table>

<!-- ===== 边界值定义表 ===== -->
<h4>📏 边界值定义</h4>
<table>
<tr><th>字段</th><th>类型</th><th>最小值</th><th>最大值</th><th>精度</th><th>空值策略</th><th>越界行为</th></tr>
<tr><td>{{字段}}</td><td>{{类型}}</td><td>{{min}}</td><td>{{max}}</td><td>{{precision}}</td><td>{{策略}}</td><td>{{行为}}</td></tr>
<tr><td>{{字段}}</td><td>{{类型}}</td><td>{{min}}</td><td>{{max}}</td><td>{{precision}}</td><td>{{策略}}</td><td>{{行为}}</td></tr>
</table>
</div>
```

---

## 暗门嵌入指南

将上述模板填充后，按以下方式嵌入 HTML 原型：

1. L0-L6 各层内容填入对应的 `anno-tab-content` 容器
2. 角标附加到页面元素：`<span class="annotation-badge" data-anno-ref="1">1</span>`
3. 父元素加 `class="has-annotation"`（确保角标定位正确）
4. 不涉及的层保留空容器 + 占位文案（防止 JS 报错）

### 角标-注释映射规则

| 角标编号 | 对应 Tab 层 | 对应内容 |
|---------|------------|---------|
| 1-N | L0 | 页面概述/CRUD/权限 |
| N+1-M | L1 | 字段定义 |
| M+1-P | L2 | 业务规则 |
| 以此类推 | L3-L6 | 各层对应 |

### 嵌入式标注示例

```html
<div class="has-annotation">
  <span class="annotation-badge" data-anno-ref="1">1</span>
  <!-- PRD: 4.1.2 企业列表页 — CRUD 操作矩阵 -->
  <table class="ui-table">
    ...
  </table>
</div>
```
