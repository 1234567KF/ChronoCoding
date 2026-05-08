#!/usr/bin/env node
/**
 * Token 效率评测 — 可视化生成器
 *
 * 读取 comprehensive-report.json 生成独立 HTML 可视化页面。
 *
 * 用法:
 *   node visualize.cjs                                    # 默认生成到 可视化/index.html
 *   node visualize.cjs --data custom.json                 # 自定义数据源
 *   node visualize.cjs --output 可视化/savings.html       # 自定义输出
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '..', '数据');
const VIZ_DIR = path.resolve(__dirname, '..', '可视化');

const args = process.argv.slice(2);
const DATA_PATH = args[args.indexOf('--data') + 1] || path.join(DATA_DIR, 'comprehensive-report.json');
const OUTPUT = args[args.indexOf('--output') + 1] || path.join(VIZ_DIR, 'index.html');

// ── 加载数据 ──────────────────────────────────────────

let report;
try {
  report = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
} catch (e) {
  console.error('❌ 无法加载数据文件:', DATA_PATH);
  console.error('   请先运行: node benchmark/aggregate-report.cjs --format json');
  process.exit(1);
}

// ── HTML 生成 ─────────────────────────────────────────

function generateHTML(data) {
  const title = 'Token 效率评测 — 可视化仪表盘';
  const lean = data.leanCtx || {};
  const costs = data.tokenCosts || {};
  const skills = data.skillCoverage || {};
  const score = data.comprehensiveScore || {};

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; padding: 24px; }
h1 { font-size: 1.5rem; margin-bottom: 8px; }
h2 { font-size: 1.1rem; margin: 24px 0 12px; color: #94a3b8; }
.meta { color: #64748b; font-size: 0.85rem; margin-bottom: 24px; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px; margin-bottom: 24px; }
.card { background: #1e293b; border-radius: 12px; padding: 20px; border: 1px solid #334155; }
.card h2 { margin: 0 0 16px; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.05em; }
.chart-wrap { position: relative; width: 100%; }
.chart-wrap canvas { width: 100% !important; }
.score-badge { display: inline-block; padding: 8px 20px; border-radius: 20px; font-weight: bold; font-size: 1.4rem; margin-right: 16px; }
.score-A\\+ { background: #065f46; color: #6ee7b7; }
.score-A { background: #14532d; color: #86efac; }
.score-B\\+ { background: #713f12; color: #fde68a; }
.score-B { background: #7c2d12; color: #fed7aa; }
.score-C { background: #7f1d1d; color: #fca5a5; }
.score-D { background: #450a0a; color: #f87171; }
.metric-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #1e293b; }
.metric-row:last-child { border-bottom: none; }
.metric-label { color: #94a3b8; }
.metric-value { font-weight: 600; font-variant-numeric: tabular-nums; }
.good { color: #4ade80; }
.warn { color: #fbbf24; }
.bad { color: #f87171; }
table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
th { text-align: left; padding: 8px; border-bottom: 2px solid #334155; color: #94a3b8; font-weight: 600; }
td { padding: 8px; border-bottom: 1px solid #1e293b; }
.status-ok { color: #4ade80; }
.status-warn { color: #fbbf24; }
.status-no-data { color: #f87171; }
</style>
</head>
<body>

<h1>📊 Token 效率评测仪表盘</h1>
<div class="meta">生成时间: ${data.meta?.generatedAt || '—'} | 数据源: cli-benchmark(${data.meta?.dataSources?.cliBenchmark || 0}) | traces(${data.meta?.dataSources?.tokenTraces || 0}) | monitor(${data.meta?.dataSources?.monitorDb ? 'yes' : 'no'})</div>

<!-- 综合评分 -->
<div class="card" style="margin-bottom:24px">
  <h2>综合评分</h2>
  <div style="display:flex;align-items:center;gap:32px;flex-wrap:wrap">
    <span class="score-badge score-${score.grade || 'D'}">${score.grade || '—'} ${score.total || '—'}/100</span>
    <div style="flex:1;min-width:200px">
      <div class="metric-row"><span class="metric-label">Token 节省率 (40%)</span><span class="metric-value">${(score.breakdown?.savings || 0)}</span></div>
      <div class="metric-row"><span class="metric-label">质量等价性 (30%)</span><span class="metric-value">${(score.breakdown?.quality || 0)}</span></div>
      <div class="metric-row"><span class="metric-label">稳定性 (20%)</span><span class="metric-value">${(score.breakdown?.stability || 0)}</span></div>
      <div class="metric-row"><span class="metric-label">易用性 (10%)</span><span class="metric-value">${(score.breakdown?.usability || 0)}</span></div>
    </div>
  </div>
</div>

<!-- Chart row 1 -->
<div class="grid">
  <div class="card">
    <h2>评分维度分布</h2>
    <div class="chart-wrap"><canvas id="scoreRadar"></canvas></div>
  </div>
  <div class="card">
    <h2>CLI 压缩节省率</h2>
    <div class="chart-wrap"><canvas id="savingsBar"></canvas></div>
  </div>
</div>

<!-- Chart row 2 -->
<div class="grid">
  <div class="card">
    <h2>Token 输入 vs 输出</h2>
    <div class="chart-wrap"><canvas id="tokenIO"></canvas></div>
  </div>
  <div class="card">
    <h2>按类别压缩率</h2>
    <div class="chart-wrap"><canvas id="categoryChart"></canvas></div>
  </div>
</div>

<!-- 技能覆盖表 -->
<div class="card" style="margin-top:20px">
  <h2>技能 Token 消耗 (Top 10)</h2>
  ${skills.status === 'ok' ? `
  <table>
    <tr><th>技能</th><th>调用次数</th><th>输入 Token</th><th>输出 Token</th></tr>
    ${(skills.topSkills || []).slice(0, 10).map(s => `
    <tr>
      <td>${s.name}</td>
      <td>${s.count}</td>
      <td>${(s.tokensIn || 0).toLocaleString()}</td>
      <td>${(s.tokensOut || 0).toLocaleString()}</td>
    </tr>`).join('')}
  </table>` : '<p class="status-no-data">无技能追踪数据 — 请运行 kf-token-tracker</p>'}
</div>

<!-- Token 成本 -->
<div class="card" style="margin-top:20px">
  <h2>Token 成本统计</h2>
  ${costs.status === 'ok' ? `
  <div class="grid" style="grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:16px">
    <div class="card" style="text-align:center"><div style="font-size:1.8rem;font-weight:bold">¥${(costs.totalCostCny || 0).toFixed(4)}</div><div style="color:#94a3b8;font-size:0.8rem">总成本</div></div>
    <div class="card" style="text-align:center"><div style="font-size:1.8rem;font-weight:bold">${(costs.totalInputTokens || 0).toLocaleString()}</div><div style="color:#94a3b8;font-size:0.8rem">总输入 Token</div></div>
    <div class="card" style="text-align:center"><div style="font-size:1.8rem;font-weight:bold">${(costs.totalOutputTokens || 0).toLocaleString()}</div><div style="color:#94a3b8;font-size:0.8rem">总输出 Token</div></div>
    <div class="card" style="text-align:center"><div style="font-size:1.8rem;font-weight:bold">${(costs.cacheHitRate || 0).toFixed(1)}%</div><div style="color:#94a3b8;font-size:0.8rem">缓存命中率</div></div>
  </div>` : '<p class="status-no-data">无 monitor 数据 — 启动 monitor 后自动采集</p>'}
</div>

<script>
// ── Chart.js 全局配置 ──
Chart.defaults.color = '#94a3b8';
Chart.defaults.borderColor = '#334155';

const colors = ['#4ade80','#60a5fa','#fbbf24','#f87171','#a78bfa','#fb923c','#2dd4bf','#f472b6'];

// ── 评分雷达图 ──
new Chart(document.getElementById('scoreRadar'), {
  type: 'radar',
  data: {
    labels: ['Token节省率','质量等价性','稳定性','易用性'],
    datasets: [{
      label: '得分',
      data: [${score.breakdown?.savings || 0}, ${score.breakdown?.quality || 0}, ${score.breakdown?.stability || 0}, ${score.breakdown?.usability || 0}],
      backgroundColor: 'rgba(74,222,128,0.15)',
      borderColor: '#4ade80',
      borderWidth: 2,
      pointBackgroundColor: '#4ade80',
    }]
  },
  options: {
    scales: { r: { beginAtZero: true, max: 45, ticks: { stepSize: 10, backdropColor: 'transparent' }, grid: { color: '#334155' }, pointLabels: { color: '#94a3b8', font: { size: 12 } } } },
    plugins: { legend: { display: false } }
  }
});

// ── CLI 压缩节省率柱状图 ──
new Chart(document.getElementById('savingsBar'), {
  type: 'bar',
  data: {
    labels: ['平均','中位数','最佳','最差'],
    datasets: [{
      label: '节省率 %',
      data: [${lean.meanSavingsRate || 0}, ${lean.medianSavingsRate || 0}, ${lean.bestSavingsRate || 0}, ${lean.worstSavingsRate || 0}],
      backgroundColor: ['#4ade80','#60a5fa','#a78bfa','#f87171'],
      borderRadius: 6,
    }]
  },
  options: {
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' } } }
  }
});

// ── Token 输入/输出对比 ──
new Chart(document.getElementById('tokenIO'), {
  type: 'doughnut',
  data: {
    labels: ['输入 Token', '输出 Token'],
    datasets: [{
      data: [${costs.totalInputTokens || 0}, ${costs.totalOutputTokens || 0}],
      backgroundColor: ['#60a5fa','#fbbf24'],
      borderColor: '#1e293b',
      borderWidth: 3,
    }]
  },
  options: {
    plugins: { legend: { position: 'bottom' } }
  }
});

// ── 按类别压缩率 ──
const catLabels = ${JSON.stringify(Object.keys(lean.byCategory || {}))};
const catData = ${JSON.stringify(Object.values(lean.byCategory || {}))};
new Chart(document.getElementById('categoryChart'), {
  type: 'polarArea',
  data: {
    labels: catLabels,
    datasets: [{
      data: catData,
      backgroundColor: colors,
      borderColor: '#1e293b',
    }]
  },
  options: {
    plugins: { legend: { position: 'bottom' } },
    scales: { r: { grid: { color: '#334155' }, ticks: { backdropColor: 'transparent', callback: v => v + '%' } } }
  }
});
</script>

</body>
</html>`;
}

// ── 输出 ──────────────────────────────────────────────

const html = generateHTML(report);
fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, html, 'utf-8');
console.log(`✅ 可视化仪表盘: ${OUTPUT}`);
console.log(`   在浏览器中打开: file:///${OUTPUT.replace(/\\/g, '/')}`);
