# 注释填充示例 — 企业信息管理

> **场景**：企业信息管理模块（纯增删查改，无复杂状态流转）。
> **用途**：演示 6 类注释模板的完整填充效果。
> **约束**：所有数据为虚构，标注 `(示例)`。

---

## 场景描述

| 项目 | 值 |
|------|-----|
| 页面名称 | 企业信息管理 |
| 页面类型 | 列表页（含新增/编辑弹出表单） |
| 访问角色 | 管理员（全部权限）、运营人员（只读）、客服（仅查看本辖区） |
| 功能 | 企业列表查询、新增企业、编辑企业、删除企业、导出 Excel |

---

## L0 页面概述 — 业务描述填充

```html
<div class="anno-tab-content active" id="anno-tab-l0">
<h3>📋 页面概述</h3>

<table>
<tr><td>页面名称</td><td>企业信息管理</td></tr>
<tr><td>路由</td><td>/enterprise/list</td></tr>
<tr><td>访问角色</td><td>管理员、运营人员、客服</td></tr>
<tr><td>入口来源</td><td>左侧导航「企业管理→企业信息」</td></tr>
<tr><td>默认排序</td><td>创建时间降序</td></tr>
<tr><td>默认分页</td><td>20 条/页</td></tr>
<tr><td>关联页面</td><td>企业详情页（点击企业名称跳转）、企业认证审核页</td></tr>
</table>

<h4>CRUD 操作矩阵</h4>
<table>
<tr><th>操作</th><th>支持</th><th>角色权限</th><th>触发入口</th><th>前置条件</th></tr>
<tr><td>新增</td><td>✅</td><td>管理员</td><td>页面左上角「新增企业」按钮</td><td>—</td></tr>
<tr><td>查询</td><td>✅</td><td>管理员、运营、客服</td><td>页面默认加载</td><td>—</td></tr>
<tr><td>查看详情</td><td>✅</td><td>管理员、运营、客服</td><td>点击企业名称链接</td><td>—</td></tr>
<tr><td>编辑</td><td>✅</td><td>管理员</td><td>操作列「编辑」按钮</td><td>企业状态不能为「已注销」</td></tr>
<tr><td>删除</td><td>✅</td><td>管理员</td><td>操作列「删除」按钮</td><td>企业无有效合同且状态为「未激活」</td></tr>
<tr><td>导出</td><td>✅</td><td>管理员、运营</td><td>页面右上角「导出」按钮</td><td>查询结果 ≤ 10000 条</td></tr>
</table>

<h4>数据权限</h4>
<table>
<tr><th>角色</th><th>可见数据范围</th><th>可操作范围</th></tr>
<tr><td>管理员</td><td>全部企业数据</td><td>新增、编辑、删除、导出、查询</td></tr>
<tr><td>运营人员</td><td>全部企业数据</td><td>查询、导出（只读）</td></tr>
<tr><td>客服</td><td>仅本辖区企业</td><td>查询（只读）</td></tr>
</table>

<h4>业务关联</h4>
<table>
<tr><th>关联实体</th><th>关联类型</th><th>关联字段</th><th>联动规则</th></tr>
<tr><td>企业认证</td><td>1:1</td><td>企业ID</td><td>企业创建后自动生成一条待认证记录</td></tr>
<tr><td>合同</td><td>1:N</td><td>企业ID</td><td>企业删除前检查是否有有效合同</td></tr>
<tr><td>用户</td><td>1:N</td><td>企业ID</td><td>企业删除前检查是否有归属用户</td></tr>
</table>
</div>
```

---

## L1-a 查询字段填充

```html
<div class="anno-tab-content" id="anno-tab-l1">

<!-- ===== L1-a 查询字段 ===== -->
<h3>🔍 查询字段</h3>
<table>
<tr><th>字段名</th><th>字段类型</th><th>前端表现形式</th><th>数据校验规则</th></tr>
<tr><td>企业名称 (`enterpriseName`)</td><td>string</td><td>输入框</td><td>最大 100 字符，可模糊搜索</td></tr>
<tr><td>统一社会信用代码 (`creditCode`)</td><td>string</td><td>输入框</td><td>精确 18 位，精确匹配</td></tr>
<tr><td>企业状态 (`status`)</td><td>enum</td><td>下拉框</td><td>未激活/正常/已注销/已吊销，多选</td></tr>
<tr><td>企业类型 (`enterpriseType`)</td><td>enum</td><td>下拉框</td><td>有限责任公司/股份有限公司/合伙企业，单选</td></tr>
<tr><td>注册时间 (`regDate`)</td><td>daterange</td><td>日期范围选择器</td><td>可选最近 7/30/90 天或自定义范围</td></tr>
</table>
```

---

## L1-b 列表字段填充

```html
<!-- ===== L1-b 列表字段 ===== -->
<h3>📊 列表字段</h3>
<table>
<tr><th>字段名</th><th>字段类型</th><th>字段说明</th><th>前端表现形式</th></tr>
<tr><td>企业名称 (`enterpriseName`)</td><td>string</td><td>工商注册全称</td><td>链接（点击跳转详情页）</td></tr>
<tr><td>统一社会信用代码 (`creditCode`)</td><td>string</td><td>18 位统一代码</td><td>文本</td></tr>
<tr><td>企业类型 (`enterpriseType`)</td><td>enum</td><td>有限责任公司/股份有限公司等</td><td>文本</td></tr>
<tr><td>企业状态 (`status`)</td><td>enum</td><td>当前经营状态</td><td>标签（不同状态不同颜色）</td></tr>
<tr><td>注册资本 (`regCapital`)</td><td>number</td><td>万元为单位</td><td>文本（格式: "1,000.00 万元"）</td></tr>
<tr><td>注册日期 (`regDate`)</td><td>date</td><td>营业执照注册日期</td><td>文本（格式: YYYY-MM-DD）</td></tr>
<tr><td>联系人 (`contactName`)</td><td>string</td><td>企业对接人姓名</td><td>文本</td></tr>
<tr><td>联系电话 (`contactPhone`)</td><td>string</td><td>对接人手机号</td><td>文本（中间 4 位脱敏: 138****1234）</td></tr>
<tr><td>操作 (`action`)</td><td>—</td><td>行操作按钮组</td><td>按钮组（查看/编辑/删除）</td></tr>
</table>
```

---

## L1-c 新增表单字段填充

```html
<!-- ===== L1-c 新增表单字段 ===== -->
<h3>➕ 新增企业表单字段</h3>
<table>
<tr><th>字段名</th><th>字段类型</th><th>字段说明</th><th>前端表现形式</th><th>数据校验规则</th></tr>
<tr><td>企业名称 (`enterpriseName`)</td><td>string</td><td>工商注册全称</td><td>输入框</td><td>必填, maxLength: 100, 不可重复</td></tr>
<tr><td>统一社会信用代码 (`creditCode`)</td><td>string</td><td>18 位统一代码</td><td>输入框</td><td>必填, 正则: /^[0-9A-HJ-NPQRTUWXY]{18}$/, 唯一</td></tr>
<tr><td>企业类型 (`enterpriseType`)</td><td>enum</td><td>选择企业类型</td><td>下拉框</td><td>必填; 选项: 有限责任公司, 股份有限公司, 合伙企业, 个人独资企业</td></tr>
<tr><td>注册资本（万元）(`regCapital`)</td><td>number</td><td>以万元为单位</td><td>输入框</td><td>必填, min: 0.01, max: 99999999.99, precision: 2</td></tr>
<tr><td>注册日期 (`regDate`)</td><td>date</td><td>营业执照上的日期</td><td>日期选择器</td><td>必填, min: 1900-01-01, max: 当日</td></tr>
<tr><td>营业期限 (`validPeriod`)</td><td>daterange</td><td>营业执照有效期</td><td>日期范围</td><td>必填, min: 注册日期, max: 2099-12-31, "长期"为空</td></tr>
<tr><td>注册地址 (`regAddress`)</td><td>string</td><td>工商注册地址</td><td>输入框</td><td>必填, maxLength: 200</td></tr>
<tr><td>经营范围 (`businessScope`)</td><td>string</td><td>工商登记经营范围</td><td>多行文本框</td><td>必填, maxLength: 1000</td></tr>
<tr><td>法定代表人 (`legalPerson`)</td><td>string</td><td>法人姓名</td><td>输入框</td><td>必填, maxLength: 50</td></tr>
<tr><td>法人手机号 (`legalPhone`)</td><td>string</td><td>法人实名手机号</td><td>输入框</td><td>必填, 正则: /^1[3-9]\d{9}$/</td></tr>
<tr><td>联系人 (`contactName`)</td><td>string</td><td>日常对接人</td><td>输入框</td><td>必填, maxLength: 50</td></tr>
<tr><td>联系电话 (`contactPhone`)</td><td>string</td><td>对接人手机号</td><td>输入框</td><td>必填, 正则: /^1[3-9]\d{9}$/</td></tr>
<tr><td>营业执照 (`businessLicense`)</td><td>file</td><td>营业执照扫描件</td><td>上传组件</td><td>必填, maxSize: 10MB, format: jpg/png/pdf, 最多 1 个文件</td></tr>
<tr><td>备注 (`remark`)</td><td>string</td><td>内部备注</td><td>多行文本框</td><td>选填, maxLength: 500</td></tr>
</table>
```

---

## L1-d 修改表单字段填充

```html
<!-- ===== L1-d 修改表单字段 ===== -->
<h3>✏️ 修改企业表单字段</h3>
<table>
<tr><th>字段名</th><th>字段类型</th><th>字段说明</th><th>前端表现形式</th><th>数据校验规则</th><th>与新增差异</th></tr>
<tr><td>企业名称</td><td>string</td><td>工商注册全称</td><td>输入框</td><td>必填, maxLength: 100</td><td>同新增</td></tr>
<tr><td>统一社会信用代码</td><td>string</td><td>18 位统一代码</td><td>只读文本</td><td>不可修改</td><td>修改时只读，新增时必填</td></tr>
<tr><td>企业类型</td><td>enum</td><td>选择企业类型</td><td>下拉框</td><td>必填</td><td>同新增</td></tr>
<tr><td>注册资本</td><td>number</td><td>以万元为单位</td><td>输入框</td><td>必填, min: 0.01, max: 99999999.99</td><td>同新增</td></tr>
<tr><td>注册日期</td><td>date</td><td>营业执照日期</td><td>日期选择器</td><td>必填, min: 1900-01-01, max: 当日</td><td>同新增</td></tr>
<tr><td>营业期限</td><td>daterange</td><td>有效期</td><td>日期范围</td><td>必填</td><td>同新增</td></tr>
<tr><td>注册地址</td><td>string</td><td>工商地址</td><td>输入框</td><td>必填, maxLength: 200</td><td>同新增</td></tr>
<tr><td>经营范围</td><td>string</td><td>经营范围</td><td>多行文本框</td><td>必填, maxLength: 1000</td><td>同新增</td></tr>
<tr><td>法定代表人</td><td>string</td><td>法人姓名</td><td>输入框</td><td>必填, maxLength: 50</td><td>同新增</td></tr>
<tr><td>法人手机号</td><td>string</td><td>法人手机号</td><td>输入框</td><td>必填, /^1[3-9]\d{9}$/</td><td>同新增</td></tr>
<tr><td>企业状态</td><td>enum</td><td>当前经营状态</td><td>下拉框</td><td>必填</td><td>仅修改时显示，新增时默认"未激活"</td></tr>
<tr><td>联系人</td><td>string</td><td>对接人</td><td>输入框</td><td>必填, maxLength: 50</td><td>同新增</td></tr>
<tr><td>联系电话</td><td>string</td><td>对接人手机号</td><td>输入框</td><td>必填, /^1[3-9]\d{9}$/</td><td>同新增</td></tr>
<tr><td>营业执照</td><td>file</td><td>扫描件</td><td>上传组件</td><td>选填, maxSize: 10MB, format: jpg/png/pdf</td><td>修改时选填，新增时必填</td></tr>
<tr><td>备注</td><td>string</td><td>内部备注</td><td>多行文本框</td><td>选填, maxLength: 500</td><td>同新增</td></tr>
</table>
</div>
```

---

## L2-L5 填充

```html
<div class="anno-tab-content" id="anno-tab-l2">
<h3>📐 业务规则</h3>

<h4>BR-1 企业名称唯一性</h4>
<table>
<tr><td>类型</td><td>校验规则</td></tr>
<tr><td>触发条件</td><td>新增或修改企业时提交</td></tr>
<tr><td>规则描述</td><td>企业名称在全系统中必须唯一，不允许重复注册</td></tr>
<tr><td>违反时行为</td><td>阻止提交，提示"该企业名称已存在"</td></tr>
<tr><td>错误提示</td><td>"企业名称「XXX」已被注册，请核实"</td></tr>
<tr><td>测试用例</td><td>TC-3: 使用已存在的企业名称新增 → 提示重复</td></tr>
</table>

<h4>BR-2 统一社会信用代码格式</h4>
<table>
<tr><td>类型</td><td>校验规则</td></tr>
<tr><td>触发条件</td><td>新增企业时填写统一代码</td></tr>
<tr><td>规则描述</td><td>18 位，前 17 位数字+大写字母（不含 I/O/Z/S/V），末位可为数字或字母</td></tr>
<tr><td>违反时行为</td><td>实时校验失焦时提示格式错误</td></tr>
<tr><td>错误提示</td><td>"请输入正确的 18 位统一社会信用代码"</td></tr>
<tr><td>测试用例</td><td>TC-2: 输入 17 位/19 位/含非法字符 → 格式错误</td></tr>
</table>

<h4>BR-3 企业删除前提条件</h4>
<table>
<tr><td>类型</td><td>流程规则</td></tr>
<tr><td>触发条件</td><td>点击删除按钮</td></tr>
<tr><td>规则描述</td><td>仅当企业状态为"未激活"且无有效合同和归属用户时允许删除</td></tr>
<tr><td>违反时行为</td><td>删除按钮置灰不可点击，或点击后提示原因</td></tr>
<tr><td>错误提示</td><td>"该企业尚有 {{N}} 份有效合同，无法删除"</td></tr>
<tr><td>测试用例</td><td>TC-5: 删除有合同企业 → 提示不可删除</td></tr>
</table>

<h4>BR-4 电话号码脱敏</h4>
<table>
<tr><td>类型</td><td>权限规则</td></tr>
<tr><td>触发条件</td><td>列表页渲染联系人电话字段</td></tr>
<tr><td>规则描述</td><td>客服角色查看列表时联系人电话中间 4 位显示为 ****（如 138****1234）</td></tr>
<tr><td>违反时行为</td><td>敏感数据泄露风险</td></tr>
<tr><td>错误提示</td><td>—</td></tr>
<tr><td>测试用例</td><td>TC-6: 客服查看列表 → 电话脱敏显示</td></tr>
</table>

<h4>BR-5 导出数量限制</h4>
<table>
<tr><td>类型</td><td>幂等规则</td></tr>
<tr><td>触发条件</td><td>点击导出按钮</td></tr>
<tr><td>规则描述</td><td>单次导出最多 10000 条，超过则提示筛选后导出</td></tr>
<tr><td>违反时行为</td><td>导出按钮置灰，提示"查询结果超过 10000 条，请缩小筛选范围"</td></tr>
<tr><td>错误提示</td><td>"导出数量超过上限，请添加更多筛选条件"</td></tr>
<tr><td>测试用例</td><td>TC-7: 无条件查询后导出(>10000条) → 提示缩小范围</td></tr>
</table>
</div>

<div class="anno-tab-content" id="anno-tab-l3">
<p style="font-size:var(--font-size-sm);color:var(--text-tertiary);text-align:center;padding:var(--spacing-xl)">
  本页面无状态机相关注释（列表页不涉及实体状态流转）
</p>
</div>

<div class="anno-tab-content" id="anno-tab-l4">
<h3>🖱️ UI 元素行为</h3>

<h4>按钮矩阵</h4>
<table>
<tr><th>按钮标识</th><th>显示文案</th><th>所在位置</th><th>显示条件</th><th>禁用条件</th><th>点击行为</th></tr>
<tr><td>btn-add</td><td>新增企业</td><td>页面左上角</td><td>始终显示</td><td>非管理员时隐藏</td><td>弹出新增企业抽屉表单</td></tr>
<tr><td>btn-export</td><td>导出 Excel</td><td>页面右上角</td><td>始终显示</td><td>客服角色隐藏；查询结果 > 10000 条时置灰</td><td>触发下载当前筛选结果</td></tr>
<tr><td>btn-view</td><td>查看</td><td>行操作列</td><td>始终显示</td><td>—</td><td>跳转企业详情页</td></tr>
<tr><td>btn-edit</td><td>编辑</td><td>行操作列</td><td>始终显示</td><td>企业状态为"已注销"时隐藏</td><td>弹出编辑企业抽屉表单</td></tr>
<tr><td>btn-delete</td><td>删除</td><td>行操作列</td><td>始终显示</td><td>企业状态非"未激活"或有有效合同时隐藏</td><td>弹出确认弹窗 → 确认后删除</td></tr>
<tr><td>btn-reset</td><td>重置</td><td>搜索区</td><td>始终显示</td><td>—</td><td>清空所有搜索条件，重新加载列表</td></tr>
<tr><td>btn-search</td><td>查询</td><td>搜索区</td><td>始终显示</td><td>—</td><td>按当前筛选条件重新查询</td></tr>
</table>

<h4>列表显示规范</h4>
<table>
<tr><th>列</th><th>格式化规则</th><th>排序</th><th>空值显示</th></tr>
<tr><td>企业名称</td><td>蓝色链接</td><td>可排序</td><td>—</td></tr>
<tr><td>企业状态</td><td>未激活=灰色标签; 正常=绿色标签; 已注销=红色标签; 已吊销=橙色标签</td><td>可排序</td><td>—</td></tr>
<tr><td>注册资本</td><td>"1,000.00 万元" 格式</td><td>可排序</td><td>显示"-"</td></tr>
<tr><td>联系电话</td><td>管理员/运营: 完整显示; 客服: 中间4位****</td><td>不可排序</td><td>显示"-"</td></tr>
</table>
</div>

<div class="anno-tab-content" id="anno-tab-l5">
<p style="font-size:var(--font-size-sm);color:var(--text-tertiary);text-align:center;padding:var(--spacing-xl)">
  本页面无设计决策相关注释
</p>
</div>
```

---

## L6 测试场景 + 异常处理与边界值填充

```html
<div class="anno-tab-content" id="anno-tab-l6">
<h3>🧪 测试场景</h3>

<h4>标准测试场景</h4>
<table>
<tr><th>ID</th><th>场景</th><th>类型</th><th>关联规则</th><th>前置条件</th><th>期望结果</th><th>优先级</th></tr>
<tr><td>TC-1</td><td>新增企业 - 完整信息提交</td><td>正常流程</td><td>—</td><td>以管理员登录，打开新增表单</td><td>提交成功，列表出现新企业，状态为"未激活"</td><td>P0</td></tr>
<tr><td>TC-2</td><td>企业名称查重</td><td>异常流程</td><td>BR-1</td><td>已存在"XX科技有限公司"</td><td>再次新增同名企业时提示"已存在"</td><td>P0</td></tr>
<tr><td>TC-3</td><td>统一代码格式校验</td><td>边界值</td><td>BR-2</td><td>打开新增表单</td><td>输入 17 位 → 失焦提示格式错误；输入 18 位合法 → 通过</td><td>P0</td></tr>
<tr><td>TC-4</td><td>注册资本边界值</td><td>边界值</td><td>—</td><td>输入注册资本</td><td>0.01 通过, 0 不通过, 99999999.99 通过, 100000000 不通过</td><td>P1</td></tr>
<tr><td>TC-5</td><td>删除有合同企业</td><td>异常流程</td><td>BR-3</td><td>企业 A 有 2 份有效合同</td><td>删除按钮置灰/隐藏，或点击后提示"尚有有效合同"</td><td>P0</td></tr>
<tr><td>TC-6</td><td>客服查看电话脱敏</td><td>权限</td><td>BR-4</td><td>以客服角色登录查看列表</td><td>联系人电话显示为 138****1234 格式</td><td>P1</td></tr>
<tr><td>TC-7</td><td>导出超过上限</td><td>异常流程</td><td>BR-5</td><td>无条件查询，结果 > 10000 条</td><td>导出按钮置灰，提示"超过 10000 条，请缩小筛选范围"</td><td>P1</td></tr>
<tr><td>TC-8</td><td>无权限用户隐藏按钮</td><td>权限</td><td>—</td><td>以客服角色登录</td><td>新增、编辑、删除按钮不可见，导出按钮可见</td><td>P0</td></tr>
<tr><td>TC-9</td><td>编辑已注销企业</td><td>异常流程</td><td>—</td><td>企业状态为"已注销"</td><td>编辑按钮隐藏，提示"已注销企业不可编辑"</td><td>P1</td></tr>
<tr><td>TC-10</td><td>全部搜索条件组合查询</td><td>正常流程</td><td>—</td><td>填写名称+代码+状态+类型+日期范围</td><td>返回符合全部条件的精确结果</td><td>P1</td></tr>
</table>

<h4>⚠️ 异常处理</h4>
<table>
<tr><th>异常场景</th><th>触发条件</th><th>错误提示</th><th>系统响应行为</th><th>恢复操作</th></tr>
<tr><td>必填字段为空</td><td>提交时企业名称为空</td><td>"企业名称为必填项"</td><td>表单高亮错误字段，不提交</td><td>填写后重新提交</td></tr>
<tr><td>统一代码格式错误</td><td>输入含字母 I/O/Z/S/V</td><td>"请输入正确的 18 位统一社会信用代码"</td><td>失焦时实时校验，显示红色提示文字</td><td>修正后自动消除错误提示</td></tr>
<tr><td>企业名称已存在</td><td>新增时名称与已有记录重复</td><td>"企业名称「XXX」已被注册"</td><td>阻止提交，返回冲突提示</td><td>修改名称后重新提交</td></tr>
<tr><td>上传文件过大</td><td>营业执照超过 10MB</td><td>"文件大小不能超过 10MB"</td><td>阻止上传，显示错误提示</td><td>压缩后重新上传</td></tr>
<tr><td>上传格式不支持</td><td>上传 .exe/.bat 文件</td><td>"仅支持 jpg/png/pdf 格式"</td><td>阻止上传，显示格式提示</td><td>转换格式后重新上传</td></tr>
<tr><td>网络超时</td><td>提交时请求超过 30s</td><td>"请求超时，请检查网络后重试"</td><td>显示 loading 状态后弹出错误提示</td><td>点击"重试"或关闭后重新提交</td></tr>
<tr><td>越权操作</td><td>客服点击新增按钮（应不可见）</td><td>—</td><td>按钮应不可见，不触发</td><td>无</td></tr>
<tr><td>删除确认</td><td>点击删除按钮</td><td>"确认删除企业「XXX」？此操作不可撤销"</td><td>弹出二次确认弹窗</td><td>确认/取消</td></tr>
<tr><td>导出超时</td><td>大数据量导出超过 60s</td><td>"导出超时，请缩小筛选范围后重试"</td><td>导出进度条停滞，显示超时提示</td><td>缩小筛选范围后重新导出</td></tr>
</table>

<h4>📏 边界值定义</h4>
<table>
<tr><th>字段</th><th>类型</th><th>最小值</th><th>最大值</th><th>精度</th><th>其他约束</th><th>空值策略</th><th>越界行为</th></tr>
<tr><td>企业名称</td><td>string</td><td>1</td><td>100</td><td>—</td><td>不可含特殊字符 \ / : * ? " < > |</td><td>必填，不允许为空</td><td>超过 100 字符则输入框限制输入</td></tr>
<tr><td>统一社会信用代码</td><td>string</td><td>18</td><td>18</td><td>—</td><td>正则校验，不含 I/O/Z/S/V</td><td>必填</td><td>非 18 位或格式错误则拒绝</td></tr>
<tr><td>注册资本</td><td>number</td><td>0.01</td><td>99999999.99</td><td>2</td><td>正整数+两位小数</td><td>必填</td><td>超过范围或精度错误则拒绝</td></tr>
<tr><td>法人手机号</td><td>string</td><td>11</td><td>11</td><td>—</td><td>仅数字，1[3-9]开头</td><td>必填</td><td>非 11 位或非手机号段则提示"格式错误"</td></tr>
<tr><td>注册地址</td><td>string</td><td>1</td><td>200</td><td>—</td><td>—</td><td>必填</td><td>超过 200 字符限制输入</td></tr>
<tr><td>经营范围</td><td>string</td><td>1</td><td>1000</td><td>—</td><td>—</td><td>必填</td><td>超过 1000 字符限制输入</td></tr>
<tr><td>备注</td><td>string</td><td>0</td><td>500</td><td>—</td><td>—</td><td>选填，为空显示"-"</td><td>超过 500 字符限制输入</td></tr>
<tr><td>营业执照</td><td>file</td><td>—</td><td>10MB</td><td>—</td><td>格式 jpg/png/pdf</td><td>新增必填，修改选填</td><td>超过 10MB 或格式不支持则拒绝上传</td></tr>
<tr><td>注册日期</td><td>date</td><td>1900-01-01</td><td>当日</td><td>—</td><td>—</td><td>必填</td><td>超过范围则日期选择器限制选择</td></tr>
</table>
</div>
```

---

## 完整 HTML 嵌入效果

上述内容按以下结构嵌入原型：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>企业信息管理 — 原型</title>
  <style>
    /* CSS Variables + Skeleton + Annotation Drawer */
  </style>
</head>
<body>
  <!-- 页面主体内容 -->
  <div class="ui-page">
    <!-- 搜索区（带 L1-a 角标） -->
    <!-- 列表区（带 L1-b 角标） -->
    <!-- 新增/编辑弹窗（带 L1-c/L1-d 角标） -->
  </div>

  <!-- 暗门注释抽屉 -->
  <div class="anno-drawer" id="annoDrawer">
    <div class="anno-drawer-header">
      <span>📋 暗门注释</span>
      <button id="annoClose">✕</button>
    </div>
    <div class="anno-tabs" id="annoTabs">
      <button class="anno-tab active" data-tab="anno-tab-l0">L0 概述</button>
      <button class="anno-tab" data-tab="anno-tab-l1">L1 字段</button>
      <button class="anno-tab" data-tab="anno-tab-l2">L2 规则</button>
      <button class="anno-tab" data-tab="anno-tab-l3">L3 状态</button>
      <button class="anno-tab" data-tab="anno-tab-l4">L4 交互</button>
      <button class="anno-tab" data-tab="anno-tab-l5">L5 设计</button>
      <button class="anno-tab" data-tab="anno-tab-l6">L6 测试</button>
    </div>
    <div class="anno-drawer-body">
      <!-- 此处插入上述 L0-L6 填充内容 -->
    </div>
  </div>

  <script>
    // Annotation drawer JS (Ctrl+B toggle, tab switching, resize)
  </script>
</body>
</html>
```

---

## 注释完整性检查清单

| 检查项 | 状态 | 说明 |
|--------|------|------|
| ① 业务描述完整 | ✅ | CRUD 矩阵 6 行 + 数据权限 3 角色 + 业务关联 3 实体 |
| ② 查询字段完整 | ✅ | 5 个搜索字段全覆盖，含校验规则 |
| ③ 列表字段完整 | ✅ | 9 列全覆盖，含前端表现形式 |
| ④ 新增表单完整 | ✅ | 14 个字段全覆盖，含边界值 |
| ⑤ 修改表单完整 | ✅ | 15 个字段（含状态），差异标注明确 |
| ⑥ 异常处理 ≥ 5 场景 | ✅ | 9 个异常场景 |
| ⑦ 边界值定义全覆盖 | ✅ | 10 个字段边界值表 |
| ⑧ 无技术栈选型 | ✅ | 仅业务语义，无 React/Vue 等技术词 |
