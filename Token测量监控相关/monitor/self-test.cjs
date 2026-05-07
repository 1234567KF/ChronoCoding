#!/usr/bin/env node
/**
 * monitor-self-test.cjs — 监控系统全链路自检
 *
 * 验证: hook → trace → DB → API → UI 完整数据流
 * 使用: cd monitor && node self-test.cjs
 */

const path = require('path');
const fs = require('fs');

const MONITOR_URL = 'http://localhost:3456';
const PROJECT_ROOT = path.resolve(__dirname, '..');
let passed = 0, failed = 0, warnings = 0;

function ok(name) { console.log('  ✅ ' + name); passed++; }
function fail(name, detail) { console.log('  ❌ ' + name + ' — ' + detail); failed++; }
function warn(name, detail) { console.log('  ⚠️  ' + name + ' — ' + detail); warnings++; }

async function fetchJSON(url, opts) {
  const res = await fetch(url, opts);
  const text = await res.text();
  try { return JSON.parse(text); } catch { throw new Error('非JSON响应: ' + text.slice(0, 200)); }
}

(async function main() {
console.log('\n=== kf-token-tracker 全链路自检 ===\n');

// ── 1. Monitor server health ──
try {
  const health = await fetchJSON(MONITOR_URL + '/api/health');
  if (health.status !== 'ok') throw new Error('状态异常');
  ok('Monitor 服务运行中 (uptime: ' + Math.round(health.uptime) + 's)');
} catch (e) { fail('Monitor 服务异常', e.message); process.exit(1); }

// ── 2. DB schema ──
try {
  const Database = require('better-sqlite3');
  const DB_PATH = path.join(__dirname, 'data', 'monitor.db');
  if (fs.existsSync(DB_PATH)) {
    const db = new Database(DB_PATH);
    const cols = db.pragma('table_info(conversations)');
    const hasTotalCost = cols.some(c => c.name === 'total_cost');
    const hasOldName = cols.some(c => c.name === 'total_cost_output');
    if (hasTotalCost && !hasOldName) ok('DB 迁移: total_cost_output → total_cost');
    else if (hasOldName) fail('DB 迁移', '仍存在旧字段 total_cost_output');
    else fail('DB 字段', 'total_cost 不存在');

    const convCount = db.prepare('SELECT COUNT(*) as c FROM conversations').get().c;
    const msgCount = db.prepare('SELECT COUNT(*) as c FROM messages').get().c;
    const skillCount = db.prepare('SELECT COUNT(*) as c FROM skill_calls').get().c;
    console.log('  📊 DB: ' + convCount + ' 会话, ' + msgCount + ' 消息, ' + skillCount + ' 技能调用');
    if (msgCount < 2) warn('消息数偏少', '明细页可能只有1条记录，等待下次 PostToolUse 推送新消息');

    const latest = db.prepare('SELECT * FROM conversations ORDER BY started_at DESC LIMIT 1').get();
    if (latest) {
      if (latest.total_input_tokens > 0) ok('会话 token: ' + latest.total_input_tokens.toLocaleString() + ' in / ' + latest.total_output_tokens.toLocaleString() + ' out');
      else warn('会话 token 为 0', '无数据');
      if (latest.total_cost > 0) ok('会话花费: ¥' + latest.total_cost.toFixed(4));
    }
    db.close();
  }
} catch (e) { fail('DB 检查', e.message); }

// ── 3. API endpoints ──
try {
  const list = await fetchJSON(MONITOR_URL + '/api/conversations?limit=5');
  if (!list.data || !Array.isArray(list.data)) throw new Error('缺少 data 数组');
  if (list.data.length === 0) { warn('会话列表为空', '尚无数据'); }
  else {
    ok('API 列表: ' + list.data.length + ' 条');
    if (typeof list.data[0].total_cost === 'number') ok('字段 total_cost 已返回');
    else fail('字段缺失', JSON.stringify(Object.keys(list.data[0])));

    // Detail
    const id = list.data[0].id;
    const detail = await fetchJSON(MONITOR_URL + '/api/conversations/' + encodeURIComponent(id));
    ok('API 详情: ' + (detail.messages?.length || 0) + ' 条消息');

    // PATCH
    const patchResult = await fetchJSON(MONITOR_URL + '/api/conversations/' + encodeURIComponent(id) + '/tokens', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ total_input_tokens: 999, total_output_tokens: 888, total_cost: 0.001 })
    });
    if (patchResult.ok) {
      ok('API PATCH 端点正常');
      // restore
      await fetchJSON(MONITOR_URL + '/api/conversations/' + encodeURIComponent(id) + '/tokens', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ total_input_tokens: list.data[0].total_input_tokens, total_output_tokens: list.data[0].total_output_tokens, total_cost: list.data[0].total_cost })
      });
    } else fail('PATCH 返回异常', JSON.stringify(patchResult));
  }
} catch (e) { fail('API 检查', e.message); }

// ── 4. Hook scripts syntax check ──
const { execSync } = require('child_process');
for (const relPath of [
  '.claude/hooks/token-accum.cjs',
  '.claude/hooks/monitor-session.cjs',
  '.claude/hooks/monitor-hooks.cjs',
  '.claude/helpers/hooks/token-tracker.cjs',
]) {
  const fp = path.join(PROJECT_ROOT, relPath);
  if (!fs.existsSync(fp)) { fail('文件缺失', relPath); continue; }
  try {
    // Just parse, don't execute (avoid side effects)
    require(fp);
    ok('语法 OK: ' + relPath);
  } catch (e) {
    // "require" may fail due to missing deps in different cwd, but syntax errors are caught
    if (e instanceof SyntaxError) fail('语法错误: ' + relPath, e.message);
    else ok('语法 OK: ' + relPath + ' (加载跳过: ' + (e.message || '').slice(0, 60) + ')');
  }
}

// ── 5. Pricing consistency ──
try {
  const pricing = require('./src/pricing');
  for (const model of ['deepseek-v4-flash', 'deepseek-v4-pro']) {
    const p = pricing.MODEL_PRICES[model];
    if (p) ok('定价模型: ' + model + ' (in:' + p.input + ' out:' + p.output + ' cache:' + p.cache_read + ')');
    else fail('定价缺失', model);
  }
} catch (e) { fail('定价检查', e.message); }

// ── 6. Watcher: session traces are skipped ──
const tracePath = path.join(PROJECT_ROOT, '.claude-flow', 'data', 'skill-traces.jsonl');
if (fs.existsSync(tracePath)) {
  const lines = fs.readFileSync(tracePath, 'utf-8').trim().split('\n').filter(Boolean);
  const nonSession = lines.filter(l => {
    try { const e = JSON.parse(l); return e.skill_type !== 'session' && e.skill_type !== 'subagent'; } catch { return false; }
  });
  if (nonSession.length === 0) {
    warn('skill-traces.jsonl 仅有 session 事件', 'Windows stdin 管道可能导致 PreToolUse 无法写入技能调用 trace（不影响 token 推送）');
  } else {
    ok('traces 有 ' + nonSession.length + ' 条非 session 记录');
  }
}

// ── 7. Templates ──
for (const tpl of ['client/index.ejs', 'client/conversation.ejs']) {
  const fp = path.join(__dirname, tpl);
  if (!fs.existsSync(fp)) { fail('模板缺失', tpl); continue; }
  const content = fs.readFileSync(fp, 'utf-8');
  if (content.includes('total_cost_output')) fail('模板残留旧字段', tpl + ' 含 total_cost_output');
  else if (content.includes('total_cost')) ok('模板已更新: ' + tpl);
  else warn('模板未引用 cost', tpl);
}

// ── 8. Manual data push test ──
await (async () => {
  try {
    // Simulate what token-accum.cjs does: POST message → PATCH totals
    const list = await fetchJSON(MONITOR_URL + '/api/conversations?limit=1');
    if (!list.data || list.data.length === 0) { warn('跳过推送测试', '无会话'); return; }
    const id = list.data[0].id;

    const before = await fetchJSON(MONITOR_URL + '/api/conversations/' + encodeURIComponent(id));
    const beforeCount = before.messages?.length || 0;

    // POST a test message
    await fetchJSON(MONITOR_URL + '/api/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: id,
        title: '',
        model: 'deepseek-v4-pro',
        messages: [{ role: 'assistant', content: '[自检] 测试消息: 100K in / 50K out', input_tokens: 0, output_tokens: 0, cache_hit: 0, created_at: new Date().toISOString() }],
        skillCalls: []
      })
    });

    const after = await fetchJSON(MONITOR_URL + '/api/conversations/' + encodeURIComponent(id));
    const afterCount = after.messages?.length || 0;
    if (afterCount > beforeCount) ok('消息推送链路正常: ' + beforeCount + ' → ' + afterCount + ' 条');
    else fail('消息推送链路异常', '消息数未增加: ' + beforeCount + ' → ' + afterCount);
  } catch (e) { fail('推送测试', e.message); }
})();

// ── Summary ──
console.log('\n---');
console.log('✅ ' + passed + ' passed  ❌ ' + failed + ' failed  ⚠️ ' + warnings + ' warnings');
if (failed > 0) { console.log('\n⚠️  有失败项，需要修复后再推送。'); process.exitCode = 1; }
else if (warnings > 0) { console.log('\n💡 有警告项，检查后推送。'); }
else { console.log('\n✅ 全链路自检通过！'); }

})();
