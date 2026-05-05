#!/usr/bin/env node
/**
 * Session Cost Tracker for Claude Code + Third-party Models
 *
 * Tracks per-session cost using lean-ctx as data source with a
 * baseline subtraction: cost = current_lean_ctx - baseline_at_reset.
 * This avoids cumulative pollution from prior sessions.
 *
 * Pricing (2026-05, $/MTok):
 *   DeepSeek-V4-Flash: input=$0.14 output=$0.28
 *   DeepSeek-V3:       input=$0.27 output=$1.10
 *   DeepSeek-R1:       input=$0.55 output=$2.19
 *   Claude Sonnet:     input=$3.00 output=$15.00 (fallback)
 *
 * Usage:
 *   node cost-tracker.cjs              # display current cost
 *   node cost-tracker.cjs --update     # recalculate from lean-ctx
 *   node cost-tracker.cjs --reset      # reset baseline to current lean-ctx
 *   node cost-tracker.cjs --json       # JSON output
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CWD = process.cwd();
const COST_FILE = path.join(CWD, '.claude', 'session-cost.json');

// Model pricing: $/MTok
const PRICING = {
  'deepseek-v4':  { label: 'DS-V4',  input: 0.14, output: 0.28 },
  'deepseek-v3':  { label: 'DS-V3',  input: 0.27, output: 1.10 },
  'deepseek-r1':  { label: 'DS-R1',  input: 0.55, output: 2.19 },
  'deepseek':     { label: 'DS-V4',  input: 0.14, output: 0.28 },  // default DS → V4
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
  if (m.includes('opus')) return { label: 'Opus', input: 15.00, output: 75.00 };
  if (m.includes('haiku')) return { label: 'Haiku', input: 0.80, output: 4.00 };
  if (m.includes('gpt-4')) return { label: 'GPT-4o', input: 2.50, output: 10.00 };
  return PRICING.claude; // fallback
}

// Read session cost file (includes baseline + computed deltas)
function readCostFile() {
  try {
    return JSON.parse(fs.readFileSync(COST_FILE, 'utf-8'));
  } catch {
    return { version: 2, baseline: null, cost_usd: 0, token_est: 0 };
  }
}

function writeCostFile(data) {
  fs.mkdirSync(path.dirname(COST_FILE), { recursive: true });
  fs.writeFileSync(COST_FILE, JSON.stringify(data, null, 2));
}

// Get raw counters from lean-ctx gain --json
const leanCtxBin = process.platform === 'win32' ? 'lean-ctx.exe' : 'lean-ctx';
function getRawCounts() {
  try {
    const raw = execSync(leanCtxBin + ' gain --json', {
      encoding: 'utf-8', timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (!raw) return null;
    const data = JSON.parse(raw);
    return {
      input: data.summary?.input_tokens || 0,
      output: data.summary?.output_tokens || 0,
      raw_spend: data.summary?.tool_spend_usd || 0,
    };
  } catch {
    return null;
  }
}

// Reset baseline — save current lean-ctx counters so future costs
// are computed as delta-from-this-point.
function cmdReset() {
  const cur = getRawCounts();
  if (!cur) { console.error('lean-ctx not available'); process.exit(1); }
  const costData = readCostFile();
  costData.version = 2;
  costData.baseline = { input: cur.input, output: cur.output, raw_spend: cur.raw_spend };
  costData.cost_usd = 0;
  costData.token_est = 0;
  costData.tool_tokens = { input: 0, output: 0 };
  costData.updated_at = new Date().toISOString();
  writeCostFile(costData);
  return costData;
}

// Update: compute delta = current - baseline, apply DS-V4 pricing
function update() {
  const cur = getRawCounts();
  if (!cur) { console.error('lean-ctx not available'); process.exit(1); }

  const modelName = getModelName();
  const pricing = detectPricing(modelName);
  const costData = readCostFile();

  // If no baseline set yet, snapshot now (= start tracking)
  const bl = costData.baseline || { input: cur.input, output: cur.output, raw_spend: cur.raw_spend };

  // Delta since baseline
  const dIn = cur.input - bl.input;
  const dOut = cur.output - bl.output;
  const dSpend = cur.raw_spend - bl.raw_spend;

  // Token-based DS-V4 estimate for whatever lean-ctx compressed
  const tokenEst = ((dIn * pricing.input) + (dOut * pricing.output)) / 1_000_000;

  costData.version = 2;
  costData.baseline = bl;
  costData.model = modelName;
  costData.pricing = pricing;
  costData.tool_tokens = { input: dIn, output: dOut };
  costData.token_est = parseFloat(tokenEst.toFixed(8));
  costData.cost_usd = dSpend > 0 ? parseFloat(dSpend.toFixed(8)) : costData.token_est;
  costData.updated_at = new Date().toISOString();
  writeCostFile(costData);
  return costData;
}

// Display
function display(format) {
  const data = readCostFile();
  if (format === 'json') {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  const p = data.pricing || { label: '?', input: 0, output: 0 };
  const ti = data.tool_tokens?.input || 0;
  const to = data.tool_tokens?.output || 0;

  console.log(`Model:   ${data.model || 'unknown'}`);
  console.log(`Pricing: ${p.label}  input=$${p.input}/MTok  output=$${p.output}/MTok`);
  console.log(`Tokens:  ${ti.toLocaleString()} in  ${to.toLocaleString()} out`);
  console.log(`Cost:    $${data.cost_usd?.toFixed(6) || '0'} (real API spend)`);
  if (data.token_est) {
    console.log(`Token:   ~$${data.token_est?.toFixed(6)} (DS-V4 token-based est.)`);
  }
}

// CLI
const args = process.argv.slice(2);
if (args.includes('--reset')) {
  const data = cmdReset();
  if (args.includes('--json')) console.log(JSON.stringify(data, null, 2));
  else console.log('Baseline reset. Next update will show delta since this point.');
} else if (args.includes('--update')) {
  const data = update();
  if (args.includes('--json')) console.log(JSON.stringify(data, null, 2));
  else display(args.includes('--json'));
} else if (args.includes('--json')) {
  display('json');
} else {
  display('text');
}
