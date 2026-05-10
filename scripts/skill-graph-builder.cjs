#!/usr/bin/env node
/**
 * skill-graph-builder.cjs — GoS 风格技能依赖图构建器
 *
 * Phase 1 of GoS adoption:
 *   1. 扫描所有 kf- 技能 SKILL.md，提取元数据
 *   2. 合并预定义的四种边关系
 *   3. 生成 skill-graph.json（给 Pipeline 引擎用）
 *   4. 可选更新每个 SKILL.md 的 graph.dependencies 字段
 *
 * Usage:
 *   node scripts/skill-graph-builder.cjs              # 只生成 skill-graph.json
 *   node scripts/skill-graph-builder.cjs --apply      # 生成 + 更新 SKILL.md
 *
 * Output:
 *   .claude-flow/data/skill-graph.json
 */
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const SKILLS_DIR = path.resolve(__dirname, '..', '.claude', 'skills');
const GRAPH_OUT = path.resolve(__dirname, '..', '.claude-flow', 'data', 'skill-graph.json');

// ── 四种边权重（GoS 标准） ──
const EDGE_WEIGHTS = {
  dependency: 1.0,
  workflow: 0.5,
  semantic: 0.2,
  substitution: 0.1,
};

// ── 预定义依赖关系 ──
// 来源：CLAUDE.md 调用链 + SKILL.md integrated-skills + 实战分析
const EDGES = {
  // ===== 依赖边 (1.0) — A 是 B 的前置条件 =====
  'kf-web-search': [
    { target: 'kf-grant-research', type: 'dependency', note: '课题申报需要搜索顶刊' },
    { target: 'kf-reverse-spec', type: 'dependency', note: '逆向需要查技术资料' },
    { target: 'kf-spec', type: 'dependency', note: 'Spec 需要资料收集' },
  ],
  'kf-scrapling': [
    { target: 'kf-grant-research', type: 'dependency', note: '课题申报需要深度抓取' },
  ],
  'kf-alignment': [
    { target: 'kf-spec', type: 'dependency', note: 'Spec 驱动需对齐理解' },
    { target: 'kf-prd-generator', type: 'dependency', note: 'PRD 产出需对齐确认' },
    { target: 'kf-code-review-graph', type: 'dependency', note: '审查报告需对齐' },
    { target: 'kf-ui-prototype-generator', type: 'dependency', note: '原型需对齐需求' },
    { target: 'kf-scrapling', type: 'dependency', note: '抓取结果需对齐' },
  ],
  'kf-model-router': [
    { target: 'kf-spec', type: 'dependency', note: 'Spec 第一步自动切 pro' },
    { target: 'kf-prd-generator', type: 'dependency', note: 'PRD 产出后切 flash' },
    { target: 'kf-reverse-spec', type: 'dependency', note: '逆向自动路由' },
    { target: 'kf-grant-research', type: 'dependency', note: '申报自动路由' },
    { target: 'kf-add-skill', type: 'dependency', note: '安装技能自动路由' },
    { target: 'kf-doc-consistency', type: 'dependency', note: '文档自检自动路由' },
    { target: 'kf-autoresearch', type: 'dependency', note: '实验自动路由' },
    { target: 'kf-token-tracker', type: 'dependency', note: '追踪自动路由' },
    { target: 'kf-langextract', type: 'dependency', note: '提取自动路由' },
    { target: 'kf-multi-team-compete', type: 'dependency', note: '竞争评审路由' },
  ],
  'kf-doc-consistency': [
    { target: 'kf-add-skill', type: 'dependency', note: '安装技能后自动一致性检查' },
  ],
  'kf-skill-design-expert': [
    { target: 'kf-add-skill', type: 'dependency', note: '安装技能需设计评审' },
  ],

  // ===== 工作流边 (0.5) — 经常顺序组合 =====
  'kf-spec': [
    { target: 'kf-alignment', type: 'workflow', note: 'Step 1 澄清对齐' },
    { target: 'kf-model-router', type: 'workflow', note: 'Step 0 自动路由' },
  ],
  'kf-prd-generator': [
    { target: 'kf-alignment', type: 'workflow', note: '产出后自动动后对齐' },
    { target: 'kf-model-router', type: 'workflow', note: '自动路由' },
  ],
  'kf-multi-team-compete': [
    { target: 'kf-spec', type: 'workflow', note: 'Pre-Stage 需求基线' },
    { target: 'kf-prd-generator', type: 'workflow', note: 'Pre-Stage PRD' },
    { target: 'kf-alignment', type: 'workflow', note: 'Stage 0 对齐' },
    { target: 'kf-web-search', type: 'workflow', note: 'Stage 1/2 按需调用' },
    { target: 'kf-scrapling', type: 'workflow', note: 'Stage 1/2/3 按需调用' },
    { target: 'kf-opencli', type: 'workflow', note: 'Stage 1/2/3 按需调用' },
    { target: 'kf-exa-code', type: 'workflow', note: 'Stage 1/2/4 按需调用' },
    { target: 'kf-browser-ops', type: 'workflow', note: 'Stage 3 自动化测试' },
    { target: 'kf-code-review-graph', type: 'workflow', note: 'Stage 4 代码审查' },
    { target: 'kf-ui-prototype-generator', type: 'workflow', note: 'Stage 2/5 UI原型' },
    { target: 'kf-image-editor', type: 'workflow', note: 'Stage 2/5 图片编辑' },
    { target: 'kf-token-tracker', type: 'workflow', note: '按需 token 追踪' },
  ],
  'kf-reverse-spec': [
    { target: 'kf-web-search', type: 'workflow', note: '搜索技术资料' },
    { target: 'kf-alignment', type: 'workflow', note: '产出后对齐' },
    { target: 'kf-code-review-graph', type: 'workflow', note: '代码审查图谱' },
    { target: 'kf-model-router', type: 'workflow', note: '自动路由' },
  ],
  'kf-grant-research': [
    { target: 'kf-web-search', type: 'workflow', note: '搜索顶刊论文' },
    { target: 'kf-scrapling', type: 'workflow', note: '深度抓取论文详情' },
    { target: 'kf-alignment', type: 'workflow', note: '产出后对齐' },
    { target: 'kf-add-skill', type: 'workflow', note: '安装缺失工具' },
    { target: 'kf-model-router', type: 'workflow', note: '自动路由' },
  ],
  'kf-autoresearch': [
    { target: 'kf-model-router', type: 'workflow', note: '自动路由' },
  ],
  'kf-add-skill': [
    { target: 'kf-skill-design-expert', type: 'workflow', note: '设计评审' },
    { target: 'kf-doc-consistency', type: 'workflow', note: '一致性检查' },
    { target: 'kf-model-router', type: 'workflow', note: '自动路由' },
  ],
  'kf-code-review-graph': [
    { target: 'kf-alignment', type: 'workflow', note: '审查报告后对齐' },
  ],
  'kf-ui-prototype-generator': [
    { target: 'kf-alignment', type: 'workflow', note: '原型后对齐' },
  ],
  'kf-langextract': [
    { target: 'kf-model-router', type: 'workflow', note: '自动路由' },
  ],
  'kf-doc-consistency': [
    { target: 'kf-model-router', type: 'workflow', note: '自动路由' },
  ],
  'kf-token-tracker': [
    { target: 'kf-model-router', type: 'workflow', note: '自动路由' },
  ],
  'kf-image-editor': [
    { target: 'kf-alignment', type: 'workflow', note: '编辑后对齐' },
  ],

  // ===== 语义边 (0.2) — 功能相近 =====
  'kf-web-search': [
    { target: 'kf-scrapling', type: 'semantic', note: '都是数据采集，深度不同', bidirectional: true },
    { target: 'kf-exa-code', type: 'semantic', note: '都是搜索，领域不同', bidirectional: true },
  ],
  'kf-scrapling': [
    { target: 'kf-opencli', type: 'semantic', note: '都是网页数据提取', bidirectional: true },
  ],
  'kf-browser-ops': [
    { target: 'kf-opencli', type: 'semantic', note: '都是浏览器自动化', bidirectional: true },
    { target: 'kf-ui-prototype-generator', type: 'semantic', note: '都和浏览器/UI 相关' },
  ],
  'kf-spec': [
    { target: 'kf-prd-generator', type: 'semantic', note: '都是需求/文档生成', bidirectional: true },
    { target: 'kf-reverse-spec', type: 'semantic', note: '正向/逆向 Spec', bidirectional: true },
  ],
  'kf-code-review-graph': [
    { target: 'kf-skill-design-expert', type: 'semantic', note: '都是质量审查', bidirectional: true },
  ],
  'kf-multi-team-compete': [
    { target: 'kf-triple-collaboration', type: 'semantic', note: '都是多 Agent 评审', bidirectional: true },
  ],
  'kf-token-tracker': [
    { target: 'kf-model-router', type: 'semantic', note: '都和 token 成本相关' },
  ],

  // ===== 替代边 (0.1) — 降级方案 =====
  'kf-web-search': [
    { target: 'kf-scrapling', type: 'substitution', note: '搜索不到时深度抓取' },
  ],
  'kf-scrapling': [
    { target: 'kf-web-search', type: 'substitution', note: '反爬失败时走搜索' },
  ],
  'kf-exa-code': [
    { target: 'kf-web-search', type: 'substitution', note: '代码搜索无结果降级通用搜索' },
  ],
  'kf-web-search': [
    { target: 'kf-exa-code', type: 'substitution', note: '通用搜索找不到代码示例' },
  ],
  'kf-opencli': [
    { target: 'kf-scrapling', type: 'substitution', note: 'CLI 不可用时降级爬虫' },
  ],
  'kf-browser-ops': [
    { target: 'kf-opencli', type: 'substitution', note: 'Playwright 不可用时降级 CLI' },
  ],
};

// ── 读取 SKILL.md 解析 frontmatter ──
function parseFrontmatter(content) {
  const match = content.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  try {
    return yaml.load(match[1]) || {};
  } catch {
    return {};
  }
}

// ── 主流程 ──
function buildGraph() {
  // 1. 扫描所有 kf- 技能的 SKILL.md
  const skills = {};
  const entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (!entry.name.startsWith('kf-')) continue;

    const skillPath = path.join(SKILLS_DIR, entry.name, 'SKILL.md');
    if (!fs.existsSync(skillPath)) continue;

    const content = fs.readFileSync(skillPath, 'utf-8');
    const fm = parseFrontmatter(content);

    skills[entry.name] = {
      name: entry.name,
      description: fm.description || '',
      triggers: Array.isArray(fm.triggers) ? fm.triggers : [],
      model: fm.recommended_model || 'flash',
      pattern: fm.metadata?.pattern || 'unknown',
    };
  }

  // 2. 构建图
  const nodes = [];
  const edges = [];
  const nodeSet = new Set();

  // 添加所有技能节点
  for (const [name, skill] of Object.entries(skills)) {
    nodes.push({
      id: name,
      name: name,
      description: skill.description.slice(0, 120),
      triggers: skill.triggers.slice(0, 5),
      model: skill.model,
      pattern: skill.pattern,
    });
    nodeSet.add(name);
  }

  // 添加边
  const edgeSet = new Set();

  for (const [source, targets] of Object.entries(EDGES)) {
    if (!nodeSet.has(source)) continue;
    for (const t of targets) {
      if (!nodeSet.has(t.target)) continue;
      const weight = EDGE_WEIGHTS[t.type] || 0.5;
      const edgeKey = `${source}->${t.target}:${t.type}`;
      if (edgeSet.has(edgeKey)) continue;
      edgeSet.add(edgeKey);

      edges.push({
        source,
        target: t.target,
        type: t.type,
        weight,
        note: t.note || '',
      });

      // Bidirectional semantic/substitution edges
      if (t.bidirectional) {
        const revKey = `${t.target}->${source}:${t.type}`;
        if (!edgeSet.has(revKey)) {
          edgeSet.add(revKey);
          edges.push({
            source: t.target,
            target: source,
            type: t.type,
            weight,
            note: t.note || '',
          });
        }
      }
    }
  }

  // 3. 统计每个节点的入度/出度
  const stats = {};
  for (const node of nodes) {
    const inEdges = edges.filter(e => e.target === node.id);
    const outEdges = edges.filter(e => e.source === node.id);
    stats[node.id] = {
      inDegree: inEdges.length,
      outDegree: outEdges.length,
      dependencyOf: inEdges.filter(e => e.type === 'dependency').map(e => e.source),
      dependsOn: outEdges.filter(e => e.type === 'dependency').map(e => e.target),
      substitutes: [
        ...outEdges.filter(e => e.type === 'substitution').map(e => e.target),
        ...inEdges.filter(e => e.type === 'substitution').map(e => e.source),
      ],
    };
  }

  // 4. 写出
  const graph = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    totalSkills: nodes.length,
    totalEdges: edges.length,
    edgeTypes: EDGE_WEIGHTS,
    nodes,
    edges,
    stats,
    metadata: {
      source: 'CLAUDE.md calling chain + SKILL.md integrated-skills analysis',
      goSReference: 'Graph of Skills: Dependency-Aware Structural Retrieval for Massive Agent Skills (arXiv:2604.05333)',
      note: 'Phase 1 graph — edges manually curated from codebase analysis. Phase 2 will add auto-detection.',
    },
  };

  const dir = path.dirname(GRAPH_OUT);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(GRAPH_OUT, JSON.stringify(graph, null, 2), 'utf-8');
  console.log(`[skill-graph] Generated: ${GRAPH_OUT}`);
  console.log(`[skill-graph]   ${nodes.length} skills, ${edges.length} edges`);
  console.log(`[skill-graph]   By type:`);
  for (const [type, w] of Object.entries(EDGE_WEIGHTS)) {
    const count = edges.filter(e => e.type === type).length;
    console.log(`[skill-graph]     ${type} (weight ${w}): ${count}`);
  }
  console.log(`[skill-graph]   Top 5 most connected:`);
  const sorted = [...nodes].map(n => ({
    name: n.name,
    total: (stats[n.name]?.inDegree || 0) + (stats[n.name]?.outDegree || 0),
    in: stats[n.name]?.inDegree || 0,
    out: stats[n.name]?.outDegree || 0,
  })).sort((a, b) => b.total - a.total).slice(0, 5);
  for (const s of sorted) {
    console.log(`[skill-graph]     ${s.name}: ${s.total} edges (in:${s.in} out:${s.out})`);
  }

  return graph;
}

// ── 添加 dependencies 到 SKILL.md ──
function applyToSkillFiles(graph) {
  let updated = 0;
  for (const node of graph.nodes) {
    const skillPath = path.join(SKILLS_DIR, node.id, 'SKILL.md');
    if (!fs.existsSync(skillPath)) continue;

    let content = fs.readFileSync(skillPath, 'utf-8');

    // Normalize line endings (handle Windows \r\n)
    content = content.replace(/\r\n/g, '\n');

    // 获取该技能的所有出边
    const outEdges = graph.edges.filter(e => e.source === node.id);
    if (outEdges.length === 0) continue;

    // 构建 dependencies YAML 块
    const depsBlock = outEdges.map(e => {
      const note = e.note ? `  # ${e.note}` : '';
      return `    - target: ${e.target}\n      type: ${e.type}${note}`;
    }).join('\n');

    const graphBlock = `\ngraph:\n  dependencies:\n${depsBlock}\n`;

    // 检查是否已有 graph 字段
    if (content.includes('\ngraph:\n')) {
      // 替换现有的 graph 块
      content = content.replace(/\ngraph:[\s\S]*?(?=\n---|\n[a-z])/, graphBlock);
    } else {
      // 在 frontmatter 末尾（--- 之前）插入
      content = content.replace(/\n---\n/, graphBlock + '\n---\n');
    }

    fs.writeFileSync(skillPath, content, 'utf-8');
    updated++;
  }
  console.log(`[skill-graph] Updated ${updated} SKILL.md files`);
}

// ── Main ──
const shouldApply = process.argv.includes('--apply');
const graph = buildGraph();

if (shouldApply) {
  applyToSkillFiles(graph);
}
