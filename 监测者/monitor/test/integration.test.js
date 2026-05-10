/**
 * integration.test.js — 监测者全链路集成测试
 *
 * 验证：所有 API 端点的 Token/Cost 数据一致性
 * 运行: node test/integration.test.js
 *
 * 前置条件: monitor 服务运行在 localhost:3456
 */
const http = require('http');
const { calcCost, calcBaselineCost } = require('../src/pricing');

const BASE = 'http://localhost:3456';

let passed = 0, failed = 0, tests = 0;
let suitePromise = Promise.resolve();

function test(name, fn) {
  tests++;
  suitePromise = suitePromise.then(async () => {
    try {
      await fn();
      passed++;
    } catch (e) {
      failed++;
      console.log(`  FAIL #${tests} ${name}: ${e.message}`);
    }
  });
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function assertNear(actual, expected, tolerance, msg) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${msg || 'value mismatch'}: expected ${expected}, got ${actual}`);
  }
}

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(BASE + path, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse error for ${path}: ${e.message}`)); }
      });
    }).on('error', reject);
  });
}

// ── Test Data Builder ──
// We insert pre-computed costs using calcCost() so the values are deterministic

const TEST_DATA = {
  conversations: [
    {
      id: 'test-conv-001',
      title: '测试会话1 — Flash 简单对话',
      model: 'deepseek-v4-flash',
      started_at: '2026-05-10T08:00:00.000Z',
    },
    {
      id: 'test-conv-002',
      title: '测试会话2 — Pro 多Agent含缓存',
      model: 'deepseek-v4-pro',
      started_at: '2026-05-10T09:00:00.000Z',
    },
  ],
  messages: [
    // Conv 1: Simple user + assistant (no cache, Flash pricing)
    {
      conversation_id: 'test-conv-001',
      role: 'user', content: '你好，帮我写个函数',
      input_tokens: 0, output_tokens: 0, cache_hit: 0,
      model: 'deepseek-v4-flash',
      cost: calcCost('deepseek-v4-flash', 0, 0, 0),
      created_at: '2026-05-10T08:00:01.000Z',
    },
    {
      conversation_id: 'test-conv-001',
      role: 'assistant', content: '当然，这是你要的函数...',
      input_tokens: 500000, output_tokens: 100000, cache_hit: 0,
      model: 'deepseek-v4-flash',
      cost: calcCost('deepseek-v4-flash', 500000, 100000, 0),
      created_at: '2026-05-10T08:00:05.000Z',
      skillCalls: [{ skill_name: 'coder', agent_name: null, agent_team: null, input_tokens: 200000, output_tokens: 50000 }],
    },

    // Conv 2: Multi-message with cache hits, Pro pricing, sub-agent skills
    {
      conversation_id: 'test-conv-002',
      role: 'user', content: '帮我设计一个REST API',
      input_tokens: 0, output_tokens: 0, cache_hit: 0,
      model: 'deepseek-v4-pro',
      cost: calcCost('deepseek-v4-pro', 0, 0, 0),
      created_at: '2026-05-10T09:00:01.000Z',
    },
    {
      conversation_id: 'test-conv-002',
      role: 'assistant', content: '我来帮你设计API...',
      input_tokens: 1000000, output_tokens: 200000, cache_hit: 300000,  // cache: 300k
      model: 'deepseek-v4-pro',
      cost: calcCost('deepseek-v4-pro', 1000000, 200000, 300000),
      created_at: '2026-05-10T09:00:05.000Z',
      skillCalls: [
        { skill_name: 'kf-spec', agent_name: '红队-lead', agent_team: 'red', input_tokens: 400000, output_tokens: 80000 },
        { skill_name: 'kf-code-review-graph', agent_name: '蓝队-reviewer', agent_team: 'blue', input_tokens: 300000, output_tokens: 60000 },
      ],
    },
    {
      conversation_id: 'test-conv-002',
      role: 'user', content: '请添加错误处理',
      input_tokens: 0, output_tokens: 0, cache_hit: 0,
      model: 'deepseek-v4-pro',
      cost: calcCost('deepseek-v4-pro', 0, 0, 0),
      created_at: '2026-05-10T09:05:01.000Z',
    },
    {
      conversation_id: 'test-conv-002',
      role: 'assistant', content: '好的，添加以下错误处理...',
      input_tokens: 800000, output_tokens: 150000, cache_hit: 500000,  // cache: 500k
      model: 'deepseek-v4-pro',
      cost: calcCost('deepseek-v4-pro', 800000, 150000, 500000),
      created_at: '2026-05-10T09:05:05.000Z',
      skillCalls: [
        { skill_name: 'kf-spec', agent_name: '红队-lead', agent_team: 'red', input_tokens: 300000, output_tokens: 60000 },
        { skill_name: 'kf-alignment', agent_name: '绿队-planner', agent_team: 'green', input_tokens: 200000, output_tokens: 40000 },
      ],
    },
  ],
};

// Compute conversation totals from messages
function computeConvTotals(convId) {
  const msgs = TEST_DATA.messages.filter(m => m.conversation_id === convId);
  return {
    total_input_tokens: msgs.reduce((s, m) => s + (m.input_tokens || 0) + (m.cache_hit || 0), 0),
    total_output_tokens: msgs.reduce((s, m) => s + (m.output_tokens || 0), 0),
    total_cost: msgs.reduce((s, m) => s + (m.cost?.total_cost || 0), 0),
    total_baseline_cost: msgs.reduce((s, m) => {
      const b = calcBaselineCost(m.input_tokens || 0, m.output_tokens || 0, m.cache_hit || 0);
      return s + (b?.total_cost || 0);
    }, 0),
  };
}

// Compute token_daily_stats totals from messages
function computeDailyStats() {
  const msgs = TEST_DATA.messages;
  return {
    total_input: msgs.reduce((s, m) => s + (m.input_tokens || 0) + (m.cache_hit || 0), 0),
    total_output: msgs.reduce((s, m) => s + (m.output_tokens || 0), 0),
    cache_hit_input: msgs.reduce((s, m) => s + (m.cache_hit || 0), 0),
    total_cost: msgs.reduce((s, m) => s + (m.cost?.total_cost || 0), 0),
    total_baseline_cost: msgs.reduce((s, m) => {
      const b = calcBaselineCost(m.input_tokens || 0, m.output_tokens || 0, m.cache_hit || 0);
      return s + (b?.total_cost || 0);
    }, 0),
  };
}

// ── Actual Test Suite ──
async function run() {
  console.log('\n=== 监测者 Integration Tests ===\n');

  // 1. Insert test data via direct DB (better-sqlite3)
  console.log('Step 1: Inserting controlled test data...\n');
  const Database = require('better-sqlite3');
  const db = new Database('D:/AICoding/监测者/monitor/data/monitor.db');

  // Clear existing data
  db.prepare('DELETE FROM skill_calls').run();
  db.prepare('DELETE FROM messages').run();
  db.prepare('DELETE FROM token_daily_stats').run();
  db.prepare('DELETE FROM conversations').run();

  // Insert conversations
  const insertConv = db.prepare(
    `INSERT INTO conversations (id, session_id, title, model, total_input_tokens, total_output_tokens, total_cost, total_baseline_cost, started_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const conv of TEST_DATA.conversations) {
    const totals = computeConvTotals(conv.id);
    insertConv.run(
      conv.id, conv.id, conv.title, conv.model,
      totals.total_input_tokens, totals.total_output_tokens,
      totals.total_cost, totals.total_baseline_cost,
      conv.started_at
    );
  }

  // Insert messages + skill calls
  const insertMsg = db.prepare(
    `INSERT INTO messages (conversation_id, role, content, input_tokens, output_tokens, cache_hit, input_cost, output_cost, cache_cost, baseline_cost, model, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertSkill = db.prepare(
    `INSERT INTO skill_calls (message_id, skill_name, input_tokens, output_tokens, agent_name, agent_team)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  for (const msg of TEST_DATA.messages) {
    const c = msg.cost;
    const baseline = calcBaselineCost(msg.input_tokens || 0, msg.output_tokens || 0, msg.cache_hit || 0);
    const result = insertMsg.run(
      msg.conversation_id, msg.role, msg.content,
      msg.input_tokens, msg.output_tokens, msg.cache_hit,
      c?.input_cost ?? null, c?.output_cost ?? null, c?.cache_cost ?? null,
      baseline?.total_cost ?? null,
      msg.model, msg.created_at
    );
    // Insert skill calls
    if (msg.skillCalls) {
      for (const sc of msg.skillCalls) {
        insertSkill.run(result.lastInsertRowid, sc.skill_name, sc.input_tokens, sc.output_tokens, sc.agent_name, sc.agent_team);
      }
    }
  }

  // Insert token_daily_stats
  const ds = computeDailyStats();
  db.prepare(
    `INSERT INTO token_daily_stats (date, total_input, total_output, cache_hit_input, total_cost, total_baseline_cost)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run('2026-05-10', ds.total_input, ds.total_output, ds.cache_hit_input, ds.total_cost, ds.total_baseline_cost);

  console.log(`  Inserted: ${TEST_DATA.conversations.length} conversations, ${TEST_DATA.messages.length} messages, ${TEST_DATA.messages.reduce((s,m) => s + (m.skillCalls?.length || 0), 0)} skill_calls\n`);

  // ── TESTS ──

  // T1-T3: Health check & pricing
  test('GET /api/health returns ok', async () => {
    const r = await get('/api/health');
    assert(r.status === 'ok', 'health should be ok');
  });

  test('GET /api/pricing returns price data', async () => {
    const r = await get('/api/pricing');
    assert(r.prices && r.prices['deepseek-v4-flash'], 'should have flash pricing');
    assert(r.prices['deepseek-v4-pro'], 'should have pro pricing');
  });

  // T4-T6: Conversation list
  test('GET /api/conversations — returns list with pagination', async () => {
    const r = await get('/api/conversations');
    assert(r.total === 2, `expected 2 conversations, got ${r.total}`);
    assert(r.data.length === 2, 'data array should have 2 items');
  });

  test('GET /api/conversations?page=1&limit=1 — pagination works', async () => {
    const r = await get('/api/conversations?page=1&limit=1');
    assert(r.data.length === 1, 'should return 1 item per page');
    assert(r.total === 2, 'total should still be 2');
  });

  test('GET /api/conversations?search=Flash — search works', async () => {
    const r = await get('/api/conversations?search=Flash');
    assert(r.data.length >= 1, 'should find Flash conversation');
  });

  // T7-T10: Conversation detail
  test('GET /api/conversations/test-conv-001 — returns correct totals', async () => {
    const r = await get('/api/conversations/test-conv-001');
    const expected = computeConvTotals('test-conv-001');
    assertNear(r.total_cost, expected.total_cost, 0.001, 'total_cost mismatch');
    assertNear(r.total_input_tokens, expected.total_input_tokens, 1, 'total_input_tokens mismatch');
    assertNear(r.total_output_tokens, expected.total_output_tokens, 1, 'total_output_tokens mismatch');
  });

  test('GET /api/conversations/test-conv-001 — has correct message count', async () => {
    const r = await get('/api/conversations/test-conv-001');
    assert(r.messages.length === 2, `expected 2 messages, got ${r.messages.length}`);
  });

  test('GET /api/conversations/test-conv-002 — includes sub-agent skills', async () => {
    const r = await get('/api/conversations/test-conv-002');
    // Verify agent breakdown
    assert(r.agentBreakdown && r.agentBreakdown.length > 0, 'should have agent breakdown');
    const agents = r.agentBreakdown.map(a => a.agent_name);
    assert(agents.includes('红队-lead'), 'should include 红队-lead');
    assert(agents.includes('蓝队-reviewer'), 'should include 蓝队-reviewer');
    assert(agents.includes('绿队-planner'), 'should include 绿队-planner');
  });

  test('GET /api/conversations/test-conv-002 — agent teams color-coded', async () => {
    const r = await get('/api/conversations/test-conv-002');
    const redAgent = r.agentBreakdown.find(a => a.agent_name === '红队-lead');
    assert(redAgent.agent_team === 'red', 'red agent should have team=red');
    const blueAgent = r.agentBreakdown.find(a => a.agent_name === '蓝队-reviewer');
    assert(blueAgent.agent_team === 'blue', 'blue agent should have team=blue');
  });

  // T11-T13: Cost consistency — messages SUM must match conversation totals
  test('Conv-001: per-message cost SUM = conversation total_cost', async () => {
    const r = await get('/api/conversations/test-conv-001');
    const msgSum = r.messages.reduce((s, m) => {
      return s + (m.input_cost || 0) + (m.output_cost || 0) + (m.cache_cost || 0);
    }, 0);
    assertNear(msgSum, r.total_cost, 0.001,
      `message cost sum (${msgSum.toFixed(4)}) should equal conversation total_cost (${r.total_cost.toFixed(4)})`);
  });

  test('Conv-002: per-message cost SUM = conversation total_cost', async () => {
    const r = await get('/api/conversations/test-conv-002');
    const msgSum = r.messages.reduce((s, m) => {
      return s + (m.input_cost || 0) + (m.output_cost || 0) + (m.cache_cost || 0);
    }, 0);
    assertNear(msgSum, r.total_cost, 0.001,
      `message cost sum (${msgSum.toFixed(4)}) should equal conversation total_cost (${r.total_cost.toFixed(4)})`);
  });

  test('Conv-002: cache_cost is NOT included in input_cost', async () => {
    const r = await get('/api/conversations/test-conv-002');
    const msg = r.messages.find(m => m.cache_hit > 0);
    assert(msg, 'should have a message with cache_hit > 0');
    // input_cost should equal (input_tokens / 1e6) * pro.input price = (tokensIn/1e6)*3
    const expectedInputCost = (msg.uncached_input / 1_000_000) * 3;
    assertNear(msg.input_cost, expectedInputCost, 0.001,
      `input_cost should be calculated from uncached_input only: expected ${expectedInputCost}, got ${msg.input_cost}`);
    // cache_cost should be separate
    assert(msg.cache_cost > 0, 'cache_cost should be > 0 for cached messages');
  });

  // T14-T16: Statistics endpoints
  test('GET /api/stats/tokens — daily totals match inserted data', async () => {
    const r = await get('/api/stats/tokens');
    const expected = computeDailyStats();
    assertNear(r.summary.total_cost, expected.total_cost, 0.001, 'daily stats total_cost mismatch');
    assertNear(r.summary.total_input, expected.total_input, 1, 'daily stats total_input mismatch');
    assertNear(r.summary.total_output, expected.total_output, 1, 'daily stats total_output mismatch');
  });

  test('GET /api/stats/by-message-type — total cost matches daily stats', async () => {
    const r = await get('/api/stats/by-message-type');
    const expected = computeDailyStats();
    assertNear(r.total.total_cost, expected.total_cost, 0.001,
      `by-message-type total_cost (${r.total.total_cost.toFixed(4)}) should match expected (${expected.total_cost.toFixed(4)})`);
  });

  test('GET /api/stats/by-message-type — total cost = input + output + cache', async () => {
    const r = await get('/api/stats/by-message-type');
    const sum = r.total.input_cost + r.total.output_cost + r.total.cache_cost;
    assertNear(r.total.total_cost, sum, 0.001,
      `total_cost (${r.total.total_cost}) should = input+output+cache (${sum})`);
  });

  test('GET /api/stats/by-message-type — user + a2a costs = total', async () => {
    const r = await get('/api/stats/by-message-type');
    const userPlusA2a = r.user.total_cost + r.a2a.total_cost;
    assertNear(r.total.total_cost, userPlusA2a, 0.001,
      `user (${r.user.total_cost}) + a2a (${r.a2a.total_cost}) should = total (${r.total.total_cost})`);
  });

  // T17-T18: Skills and agents
  test('GET /api/stats/skills — returns skill breakdown', async () => {
    const r = await get('/api/stats/skills');
    assert(r.data.length > 0, 'should have skill data');
    const specSkill = r.data.find(s => s.skill_name === 'kf-spec');
    assert(specSkill, 'should include kf-spec');
    assert(specSkill.call_count === 2, `kf-spec should have 2 calls, got ${specSkill.call_count}`);
  });

  test('GET /api/stats/agents — returns per-agent stats with team colors', async () => {
    const r = await get('/api/stats/agents');
    assert(r.data.length >= 3, `should have at least 3 agents, got ${r.data.length}`);
    const red = r.data.find(a => a.agent_name === '红队-lead');
    assert(red && red.agent_team === 'red', '红队-lead should have team=red');
    const blue = r.data.find(a => a.agent_name === '蓝队-reviewer');
    assert(blue && blue.agent_team === 'blue', '蓝队-reviewer should have team=blue');
  });

  // T19-T21: User messages endpoint
  test('GET /api/user-messages — returns user messages list', async () => {
    const r = await get('/api/user-messages');
    assert(r.total >= 3, `should have at least 3 user messages, got ${r.total}`);
    const first = r.data[0];
    assert('total_input_tokens' in first, 'should have total_input_tokens');
    assert('total_cost' in first, 'should have total_cost');
  });

  test('GET /api/user-messages/:id — returns A2A chain', async () => {
    const list = await get('/api/user-messages');
    const userMsg = list.data.find(d => d.user_content === '帮我设计一个REST API');
    assert(userMsg, `should find user message about API design, searched by user_content`);
    const r = await get(`/api/user-messages/${userMsg.msg_id}`);
    assert(r.chain_count >= 1, 'should have at least 1 A2A reply');
  });

  test('GET /api/user-messages/:id — chain total_cost includes cache', async () => {
    const list = await get('/api/user-messages');
    const userMsg = list.data.find(d => d.user_content === '请添加错误处理');
    assert(userMsg, 'should find error handling message');
    const r = await get(`/api/user-messages/${userMsg.msg_id}`);
    const chainCostSum = (r.chain || []).reduce((s, m) => {
      return s + (m.input_cost || 0) + (m.output_cost || 0) + (m.cache_cost || 0);
    }, 0);
    assertNear(r.total_cost, chainCostSum, 0.001,
      `chain total_cost (${r.total_cost?.toFixed(4)}) should = sum of msg costs (${chainCostSum.toFixed(4)})`);
  });

  // T22-T24: Cross-endpoint consistency
  test('token_daily_stats.total_cost ≈ messages SUM(cost)', async () => {
    const tokens = await get('/api/stats/tokens');
    const byType = await get('/api/stats/by-message-type');
    // These should match exactly for controlled test data (no live session drift)
    assertNear(tokens.summary.total_cost, byType.total.total_cost, 0.001,
      `stats/tokens (${tokens.summary.total_cost}) should = stats/by-message-type (${byType.total.total_cost})`);
  });

  test('conversation totals match stats for those conversations', async () => {
    const conv1 = await get('/api/conversations/test-conv-001');
    const conv2 = await get('/api/conversations/test-conv-002');
    const combinedCost = (conv1.total_cost || 0) + (conv2.total_cost || 0);
    const byType = await get('/api/stats/by-message-type');
    assertNear(combinedCost, byType.total.total_cost, 0.001,
      `sum of conv costs (${combinedCost.toFixed(4)}) should match by-message-type total (${byType.total.total_cost.toFixed(4)})`);
  });

  test('savings calculation: Flash vs Pro baseline shows savings', async () => {
    // Conv-002 uses Pro model → Pro baseline = Pro actual → saving ≈ 0
    const r2 = await get('/api/conversations/test-conv-002');
    const saving2 = (r2.total_baseline_cost || 0) - (r2.total_cost || 0);
    assertNear(saving2, 0, 0.001, `Pro conversation (both actual and baseline Pro) should have ~0 savings, got ${saving2}`);

    // Conv-001 uses Flash model → baseline is Pro → savings > 0 (Flash is cheaper)
    const r1 = await get('/api/conversations/test-conv-001');
    const saving1 = (r1.total_baseline_cost || 0) - (r1.total_cost || 0);
    assert(saving1 > 0.001, `Flash conversation should show savings vs Pro baseline, got ${saving1}`);
  });

  // ── Wait for all async tests to complete ──
  await suitePromise;

  // ── SUMMARY ──
  console.log(`\n${passed}/${tests} passed, ${failed} failed`);
  db.close();
  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
