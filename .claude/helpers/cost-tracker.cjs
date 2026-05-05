#!/usr/bin/env node
/**
 * Session Cost Tracker for Claude Code + Third-party Models
 *
 * Reads token counts from lean-ctx gain data (tool-level) and stdin (API-level),
 * calculates cumulative cost with model-specific pricing.
 *
 * Pricing (2026-05, $/MTok):
 *   DeepSeek-V3:  input=$0.27  output=$1.10
 *   DeepSeek-R1:  input=$0.55  output=$2.19
 *   Claude Sonnet: input=$3.00 output=$15.00 (fallback)
 *
 * Usage: node cost-tracker.cjs              # display current cost
 *        node cost-tracker.cjs --update     # recalculate from lean-ctx
 *        node cost-tracker.cjs --json       # JSON output
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

// Read cumulative cost file
function readCostFile() {
  try {
    return JSON.parse(fs.readFileSync(COST_FILE, 'utf-8'));
  } catch {
    return { sessions: [], total_cost: 0, total_input: 0, total_output: 0 };
  }
}

function writeCostFile(data) {
  fs.mkdirSync(path.dirname(COST_FILE), { recursive: true });
  fs.writeFileSync(COST_FILE, JSON.stringify(data, null, 2));
}

// Get token counts from lean-ctx gain --json
const leanCtxBin = process.platform === 'win32' ? 'lean-ctx.exe' : 'lean-ctx';
function getToolTokenCounts() {
  try {
    const raw = execSync(leanCtxBin + ' gain --json', {
      encoding: 'utf-8', timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (!raw) return null;
    const data = JSON.parse(raw);
    return {
      input: data.summary?.input_tokens || 0,
      output: data.summary?.output_tokens || 0,
      raw_cost: data.summary?.tool_spend_usd || 0,
    };
  } catch {
    return null;
  }
}

// Main: update cost from lean-ctx data
function update() {
  const tokens = getToolTokenCounts();
  if (!tokens) {
    console.error('lean-ctx not available — run lean-ctx init first');
    process.exit(1);
  }

  const modelName = getModelName();
  const pricing = detectPricing(modelName);
  const inputCost = (tokens.input * pricing.input) / 1_000_000;
  const outputCost = (tokens.output * pricing.output) / 1_000_000;
  const total = inputCost + outputCost;

  const costData = readCostFile();
  costData.model = modelName;
  costData.pricing = pricing;
  costData.tool_tokens = { input: tokens.input, output: tokens.output };
  costData.cost_usd = parseFloat(total.toFixed(8));
  costData.api_cost_est = tokens.raw_cost; // from lean-ctx tracking
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
  console.log(`Cost:    $${data.cost_usd?.toFixed(6) || '0'} (tool-activity est.)`);
  if (data.api_cost_est) {
    console.log(`API est: $${data.api_cost_est?.toFixed(4)} (lean-ctx tool_spend)`);
  }
}

// CLI
const args = process.argv.slice(2);
if (args.includes('--update')) {
  const data = update();
  if (args.includes('--json')) console.log(JSON.stringify(data, null, 2));
  else display(args.includes('--json'));
} else if (args.includes('--json')) {
  display('json');
} else {
  display('text');
}
