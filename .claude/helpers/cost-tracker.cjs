#!/usr/bin/env node
/**
 * Session Cost Tracker for Claude Code + Third-party Models
 *
 * Tracks per-session cost by parsing the Claude Code session transcript
 * JSONL file for actual API token counts. No more lean-ctx MCP spend
 * (that tracks tool calls, not LLM inference).
 *
 * Data source: ~/.claude/projects/<project>/<sessionId>.jsonl
 *   → input_tokens, output_tokens, cache_read_input_tokens (deduplicated by message.id)
 *
 * Pricing (2026-05, $/MTok):
 *   DeepSeek-V4-Flash: input=$0.14 output=$0.28 cache_read=$0.0028 (¥0.02/MTok)
 *   DeepSeek-V3:       input=$0.27 output=$1.10
 *   DeepSeek-R1:       input=$0.55 output=$2.19
 *   Claude Sonnet:     input=$3.00 output=$15.00 (fallback)
 *
 * Usage:
 *   node cost-tracker.cjs              # display current cost
 *   node cost-tracker.cjs --update     # parse transcript & compute
 *   node cost-tracker.cjs --reset      # clear cached cost data
 *   node cost-tracker.cjs --json       # JSON output
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const { execSync } = require('child_process');

const CWD = process.cwd();
const COST_FILE = path.join(CWD, '.claude', 'session-cost.json');
const HOME = os.homedir();

// Model pricing: $/MTok
const PRICING = {
  'deepseek-v4':  { label: 'DS-V4',  input: 0.14, output: 0.28, cache_read: 0.0028 },
  'deepseek-v3':  { label: 'DS-V3',  input: 0.27, output: 1.10 },
  'deepseek-r1':  { label: 'DS-R1',  input: 0.55, output: 2.19 },
  'deepseek':     { label: 'DS-V4',  input: 0.14, output: 0.28, cache_read: 0.0028 },
  'claude':       { label: 'Claude', input: 3.00, output: 15.00 },
};

function getModelName() {
  try {
    const settingsPath = path.join(CWD, '.claude', 'settings.local.json');
    if (fs.existsSync(settingsPath)) {
      const s = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      if (s.model) return s.model;
    }
    const settingsPath2 = path.join(CWD, '.claude', 'settings.json');
    if (fs.existsSync(settingsPath2)) {
      const s = JSON.parse(fs.readFileSync(settingsPath2, 'utf-8'));
      if (s.model) return s.model;
    }
  } catch {}
  return '';
}

function detectPricing(modelName) {
  const m = modelName.toLowerCase();
  if (m.includes('deepseek')) return PRICING.deepseek;
  if (m.includes('sonnet')) return PRICING.claude;
  if (m.includes('opus')) return { label: 'Opus', input: 15.00, output: 75.00, cache_read: 1.50 };
  if (m.includes('haiku')) return { label: 'Haiku', input: 0.80, output: 4.00, cache_read: 0.08 };
  if (m.includes('gpt-4')) return { label: 'GPT-4o', input: 2.50, output: 10.00 };
  return PRICING.claude;
}

function readCostFile() {
  try {
    return JSON.parse(fs.readFileSync(COST_FILE, 'utf-8'));
  } catch {
    return { version: 3, cost_usd: 0, cost_rmb: 0 };
  }
}

function writeCostFile(data) {
  fs.mkdirSync(path.dirname(COST_FILE), { recursive: true });
  fs.writeFileSync(COST_FILE, JSON.stringify(data, null, 2));
}

function cmdReset() {
  writeCostFile({
    version: 3,
    cost_usd: 0,
    cost_rmb: 0,
    input_tokens: 0, output_tokens: 0,
    cache_read_tokens: 0, cache_create_tokens: 0,
    api_calls: 0,
    updated_at: new Date().toISOString(),
  });
  return readCostFile();
}

// ─── Transcript parsing ─────────────────────────────────────────

function encodeDirName(raw) {
  return raw.replace(/[^a-zA-Z0-9\-._~]/g, '-');
}

function findTranscript() {
  const projName = encodeDirName(CWD);
  const projDir = path.join(HOME, '.claude', 'projects', projName);
  if (!fs.existsSync(projDir)) {
    // Fallback: scan all dirs
    const base = path.join(HOME, '.claude', 'projects');
    if (!fs.existsSync(base)) return null;
    const dirs = fs.readdirSync(base).filter(d => {
      try { return fs.statSync(path.join(base, d)).isDirectory(); } catch { return false; }
    });
    for (const d of dirs) {
      if (CWD.replace(/[:/\\]/g, '-').includes(d.replace(/-/g, '').toLowerCase())) {
        return findLatestJsonl(path.join(base, d));
      }
    }
    return null;
  }
  return findLatestJsonl(projDir);
}

function findLatestJsonl(dir) {
  try {
    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.jsonl'))
      .map(f => ({ name: f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    return files.length > 0 ? path.join(dir, files[0].name) : null;
  } catch {
    return null;
  }
}

// One API response → multiple assistant entries (one per content block).
// Only the LAST entry carries final output_tokens. Dedupe by message.id,
// taking max per field.
function parseTranscript(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.split('\n').filter(Boolean);
  const calls = new Map();

  for (const l of lines) {
    try {
      const j = JSON.parse(l);
      if (j.type !== 'assistant' || !j.message || !j.message.usage) continue;
      const id = j.message.id;
      const u = j.message.usage;
      const existing = calls.get(id);
      if (!existing) {
        calls.set(id,
          { input: u.input_tokens||0, output: u.output_tokens||0,
            cacheCreate: u.cache_creation_input_tokens||0,
            cacheRead: u.cache_read_input_tokens||0 });
      } else {
        if ((u.input_tokens||0) > existing.input) existing.input = u.input_tokens;
        if ((u.output_tokens||0) > existing.output) existing.output = u.output_tokens;
        if ((u.cache_creation_input_tokens||0) > existing.cacheCreate) existing.cacheCreate = u.cache_creation_input_tokens;
        if ((u.cache_read_input_tokens||0) > existing.cacheRead) existing.cacheRead = u.cache_read_input_tokens;
      }
    } catch {}
  }

  let tIn=0, tOut=0, tCacheCreate=0, tCacheRead=0;
  for (const u of calls.values()) {
    tIn += u.input; tOut += u.output;
    tCacheCreate += u.cacheCreate; tCacheRead += u.cacheRead;
  }
  return { input: tIn, output: tOut, cacheCreate: tCacheCreate, cacheRead: tCacheRead, apiCalls: calls.size };
}

// ─── Cost computation ───────────────────────────────────────────

function computeCost(usage, pricing) {
  const costIn = usage.input * pricing.input / 1_000_000;
  const costOut = usage.output * pricing.output / 1_000_000;
  const costCache = pricing.cache_read
    ? usage.cacheRead * pricing.cache_read / 1_000_000
    : 0;
  return {
    cost_usd: parseFloat((costIn + costOut + costCache).toFixed(8)),
    cost_rmb: parseFloat(((costIn + costOut + costCache) * 7.2).toFixed(6)),
    cost_in: costIn, cost_out: costOut, cost_cache: costCache,
  };
}

// ─── Lean-ctx savings ───────────────────────────────────────────

// Returns estimated RMB saved by lean-ctx token compression,
// using DS-V4 weighted pricing based on actual I/O ratio.
function getLCSavings(usage, pricing) {
  try {
    const raw = execSync('lean-ctx.exe gain --json', {
      encoding: 'utf-8', timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'],
    });
    const g = JSON.parse(raw);
    const s = g.summary || {};
    const saved = s.tokens_saved || 0;
    if (saved === 0) return { tokens_saved: 0, savings_usd: 0, savings_rmb: 0 };

    // Weighted DS-V4 price from actual I/O ratio
    const total = usage.input + usage.output;
    const inRatio = total > 0 ? usage.input / total : 0.7;
    const outRatio = 1 - inRatio;
    const weightedPrice = inRatio * pricing.input + outRatio * pricing.output;

    const savingsUsd = saved * weightedPrice / 1_000_000;
    return {
      tokens_saved: saved,
      savings_usd: parseFloat(savingsUsd.toFixed(8)),
      savings_rmb: parseFloat((savingsUsd * 7.2).toFixed(6)),
    };
  } catch {
    return { tokens_saved: 0, savings_usd: 0, savings_rmb: 0 };
  }
}

function update() {
  const transcriptPath = findTranscript();
  if (!transcriptPath) {
    console.error('Cannot find session transcript');
    process.exit(1);
  }

  const usage = parseTranscript(transcriptPath);
  const modelName = getModelName();
  const pricing = detectPricing(modelName);
  const cost = computeCost(usage, pricing);
  const lcSavings = getLCSavings(usage, pricing);

  const data = readCostFile();
  data.version = 3;
  data.model = modelName;
  data.pricing = pricing;
  data.input_tokens = usage.input;
  data.output_tokens = usage.output;
  data.cache_read_tokens = usage.cacheRead;
  data.cache_create_tokens = usage.cacheCreate;
  data.api_calls = usage.apiCalls;
  data.cost_in = cost.cost_in;
  data.cost_out = cost.cost_out;
  data.cost_cache = cost.cost_cache;
  data.cost_usd = cost.cost_usd;
  data.cost_rmb = cost.cost_rmb;
  data.savings = lcSavings;
  data.updated_at = new Date().toISOString();
  writeCostFile(data);
  return data;
}

// ─── Display ────────────────────────────────────────────────────

function display(format) {
  const data = readCostFile();
  if (format === 'json') {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  const p = data.pricing || { label: '?', input: 0, output: 0 };
  const s = data.savings || {};
  console.log(`Model:   ${data.model || 'unknown'}`);
  console.log(`Pricing: ${p.label}  in=$${p.input}/M  out=$${p.output}/M  cache=$${p.cache_read||0}/M`);
  console.log(`Tokens:  ${(data.input_tokens||0).toLocaleString()} in  ${(data.output_tokens||0).toLocaleString()} out  ${(data.cache_read_tokens||0).toLocaleString()} cache`);
  console.log(`Calls:   ${data.api_calls||0} API calls`);
  console.log(`Cost:    ¥${(data.cost_rmb||0).toFixed(4)}  ($${(data.cost_usd||0).toFixed(6)})`);
  if (s.savings_rmb > 0) console.log(`Saved:   ¥${s.savings_rmb.toFixed(4)}  (${(s.tokens_saved||0).toLocaleString()} tokens via lean-ctx)`);
}

// ─── CLI ────────────────────────────────────────────────────────

const args = process.argv.slice(2);
if (args.includes('--reset')) {
  cmdReset();
  console.log('Cost data cleared.');
} else if (args.includes('--update')) {
  update();
  display(args.includes('--json') ? 'json' : 'text');
} else if (args.includes('--json')) {
  display('json');
} else {
  display('text');
}
