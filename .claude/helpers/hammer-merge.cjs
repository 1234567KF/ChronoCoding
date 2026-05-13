#!/usr/bin/env node
/**
 * hammer-merge.cjs — 三队产物并集合并工具
 *
 * 解决三队并行编码产生的文件冲突。策略：
 * 1. 命名空间隔离 — 每队产物在独立 team-{color}/ 目录下
 * 2. 冲突检测 — 同名文件内容不同时标记冲突
 * 3. 并集合并 — 非冲突文件直接合并，冲突文件三版保留
 * 4. 生成合并报告 — 标注冲突、合并策略、最终文件清单
 *
 * 用法:
 *   node .claude/helpers/hammer-merge.cjs --teams red,blue,green [--output merged]
 *   node .claude/helpers/hammer-merge.cjs --base .claude-flow/hammer-artifacts --teams red,blue,green
 *   node .claude/helpers/hammer-merge.cjs --check-only   # 仅检测冲突，不执行合并
 *   node .claude/helpers/hammer-merge.cjs --resolve auto  # 自动解决非语义冲突（空白/格式）
 *
 * API:
 *   const merge = require('./hammer-merge.cjs');
 *   merge.detectConflicts({ teams, baseDir }) → { conflicts, fileMap }
 *   merge.unionMerge({ teams, baseDir, outputDir }) → { merged, conflicts, report }
 *   merge.resolveAuto({ conflicts }) → { resolved, remaining }
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_BASE = path.join(ROOT, '.claude-flow', 'hammer-artifacts');
const DEFAULT_OUTPUT = path.join(ROOT, '.claude-flow', 'hammer-artifacts', 'merged');

// ─── File Hashing ───

function hashFile(filePath) {
  try {
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex').substring(0, 16);
  } catch (_) {
    return null;
  }
}

function hashContent(content) {
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
}

// ─── File Discovery ───

/**
 * Collect all output files from a team's artifact directory.
 * Returns a map: relativePath → { team, fullPath, hash, size }
 */
function collectTeamFiles(team, baseDir) {
  const teamDir = path.join(baseDir, `team-${team}`);
  const files = {};

  if (!fs.existsSync(teamDir)) return files;

  walkDir(teamDir, (fullPath) => {
    const relativePath = path.relative(teamDir, fullPath).replace(/\\/g, '/');
    const stat = fs.statSync(fullPath);
    files[relativePath] = {
      team,
      fullPath,
      relativePath,
      hash: hashFile(fullPath),
      size: stat.size,
    };
  });

  return files;
}

/**
 * Collect files directly from team root output (no team subdir).
 * Scans for {team}-* prefixed files.
 */
function collectTeamFilesFromRoot(team, baseDir) {
  const files = {};

  if (!fs.existsSync(baseDir)) return files;

  try {
    for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
      if (!entry.isFile()) continue;

      // Match {team}- prefix files
      if (entry.name.startsWith(`${team}-`)) {
        const fullPath = path.join(baseDir, entry.name);
        const stat = fs.statSync(fullPath);
        files[entry.name] = {
          team,
          fullPath,
          relativePath: entry.name,
          hash: hashFile(fullPath),
          size: stat.size,
        };
      }

      // Also include test directories
      if (entry.name === `${team}-05-tests` && entry.isDirectory()) {
        walkDir(path.join(baseDir, entry.name), (filePath) => {
          const rel = path.relative(baseDir, filePath).replace(/\\/g, '/');
          const stat = fs.statSync(filePath);
          files[rel] = {
            team,
            fullPath: filePath,
            relativePath: rel,
            hash: hashFile(filePath),
            size: stat.size,
          };
        });
      }
    }
  } catch (_) {}

  return files;
}

// ─── Conflict Detection ───

/**
 * Detect conflicts across team files.
 *
 * Conflict types:
 *   - IDENTICAL: Same path, same content hash → no conflict (any version ok)
 *   - CONTENT: Same path, different content → REAL conflict
 *   - UNIQUE: Path only exists in one team → no conflict (direct merge)
 *   - TEAM_PREFIX: Team-specific files (red-*, blue-*, green-*) → no conflict
 */
function detectConflicts({ teams, baseDir } = {}) {
  const teamNames = teams || ['red', 'blue', 'green'];
  const base = baseDir || ROOT;

  // Collect all files from all teams
  const teamFiles = {};
  for (const team of teamNames) {
    const fromRoot = collectTeamFilesFromRoot(team, base);
    const fromSubdir = collectTeamFiles(team, base);
    teamFiles[team] = { ...fromRoot, ...fromSubdir };
  }

  // Build global file map: path → [team entries]
  const fileMap = {};
  for (const [team, files] of Object.entries(teamFiles)) {
    for (const [relPath, info] of Object.entries(files)) {
      if (!fileMap[relPath]) fileMap[relPath] = [];
      fileMap[relPath].push(info);
    }
  }

  // Classify conflicts
  const conflicts = { IDENTICAL: [], CONTENT: [], UNIQUE: [] };

  for (const [relPath, entries] of Object.entries(fileMap)) {
    if (entries.length === 1) {
      conflicts.UNIQUE.push({ path: relPath, team: entries[0].team, entry: entries[0] });
    } else {
      const hashes = new Set(entries.map(e => e.hash));
      if (hashes.size === 1) {
        conflicts.IDENTICAL.push({ path: relPath, teams: entries.map(e => e.team), entry: entries[0] });
      } else {
        conflicts.CONTENT.push({ path: relPath, entries });
      }
    }
  }

  return {
    teams: teamNames,
    teamFileCounts: Object.fromEntries(Object.entries(teamFiles).map(([t, f]) => [t, Object.keys(f).length])),
    totalFiles: Object.keys(fileMap).length,
    conflicts,
    summary: {
      identical: conflicts.IDENTICAL.length,
      content: conflicts.CONTENT.length,
      unique: conflicts.UNIQUE.length,
      hasConflicts: conflicts.CONTENT.length > 0,
    },
  };
}

// ─── Union Merge ───

/**
 * Execute union merge.
 *
 * Strategy:
 * - IDENTICAL files → copy to merged/ from first team (or symlink)
 * - UNIQUE files → copy to merged/ with team source annotation
 * - CONTENT files → keep all three versions:
 *   merged/{path}.base → primary version (blue team, as "robust engineering")
 *   merged/{path}.red  → red team variant
 *   merged/{path}.green → green team variant
 *   merged/{path}.resolution.md → merge decision record
 */
function unionMerge({ teams, baseDir, outputDir, resolveAuto = false } = {}) {
  const teamNames = teams || ['red', 'blue', 'green'];
  const base = baseDir || ROOT;
  const output = outputDir || DEFAULT_OUTPUT;

  if (!fs.existsSync(output)) {
    fs.mkdirSync(output, { recursive: true });
  }

  const result = detectConflicts({ teams: teamNames, baseDir: base });
  const merged = [];
  const unresolved = [];
  const resolved = [];

  // Copy IDENTICAL files
  for (const item of result.conflicts.IDENTICAL) {
    const dest = path.join(output, item.path);
    ensureDir(path.dirname(dest));
    fs.copyFileSync(item.entry.fullPath, dest);
    merged.push({ path: item.path, strategy: 'identical', source: item.teams.join(',') });
  }

  // Copy UNIQUE files
  for (const item of result.conflicts.UNIQUE) {
    const dest = path.join(output, item.path);
    ensureDir(path.dirname(dest));
    fs.copyFileSync(item.entry.fullPath, dest);
    merged.push({ path: item.path, strategy: 'unique', source: item.team });
  }

  // Handle CONTENT conflicts
  for (const item of result.conflicts.CONTENT) {
    const dir = path.dirname(item.path);
    const ext = path.extname(item.path);
    const basename = path.basename(item.path, ext);

    // Auto-resolve: whitespace-only / formatting-only differences
    if (resolveAuto) {
      const contents = item.entries.map(e => fs.readFileSync(e.fullPath, 'utf-8'));
      const normalized = contents.map(c => c.replace(/\s+/g, ' ').trim());
      const allSame = normalized.every(c => c === normalized[0]);

      if (allSame) {
        // Only formatting differences — use blue team (robust engineering) version
        const primary = item.entries.find(e => e.team === 'blue') || item.entries[0];
        const dest = path.join(output, item.path);
        ensureDir(path.dirname(dest));
        fs.copyFileSync(primary.fullPath, dest);
        merged.push({ path: item.path, strategy: 'auto-resolved', source: primary.team, note: '仅格式差异，自动合并' });
        resolved.push({ path: item.path, strategy: 'auto-resolved' });
        continue;
      }
    }

    // Keep all versions with team suffix
    for (const entry of item.entries) {
      const teamDest = path.join(output, `${basename}.${entry.team}${ext}`);
      ensureDir(path.dirname(teamDest));
      fs.copyFileSync(entry.fullPath, teamDest);
    }

    // Write resolution record
    const resolutionMd = [
      `# 合并冲突: ${item.path}`,
      '',
      `> 三队产生了不同版本的此文件。保留所有版本供裁判/汇总者抉择。`,
      '',
      '| 团队 | 文件 | 大小 | Hash |',
      '|------|------|------|------|',
    ];
    for (const entry of item.entries) {
      resolutionMd.push(`| ${entry.team} | ${basename}.${entry.team}${ext} | ${entry.size}B | ${entry.hash} |`);
    }
    resolutionMd.push('');
    resolutionMd.push('## 建议合并策略');
    resolutionMd.push('');
    resolutionMd.push('1. **蓝队为基线**（稳健工程）→ 作为主体');
    resolutionMd.push('2. 红队的创新点按需 cherry-pick');
    resolutionMd.push('3. 绿队的安全加固 MUST 合并入基线');
    resolutionMd.push('');
    resolutionMd.push('> 由汇总者在 Phase 4 融合阶段执行最终合并决策。');

    const resolutionPath = path.join(output, `${basename}.resolution.md`);
    fs.writeFileSync(resolutionPath, resolutionMd.join('\n'));

    unresolved.push({ path: item.path, teams: item.entries.map(e => e.team), variants: item.entries.map(e => `${basename}.${e.team}${ext}`) });
  }

  // Generate merge report
  const reportMd = [
    `# 三队产物合并报告`,
    '',
    `> 合并时间: ${new Date().toISOString()}`,
    `> 团队: ${teamNames.join(', ')}`,
    '',
    '## 统计',
    '',
    `| 类别 | 数量 |`,
    `|------|------|`,
    `| 文件总计 | ${result.totalFiles} |`,
    `| 一致文件（直接合并） | ${result.summary.identical} |`,
    `| 独有文件（直接合并） | ${result.summary.unique} |`,
    `| 冲突文件（保留多版） | ${result.summary.content} |`,
    `| 自动解决 | ${resolved.length} |`,
    '',
    `| 团队 | 产出文件数 |`,
    `|------|-----------|`,
  ];
  for (const [team, count] of Object.entries(result.teamFileCounts)) {
    reportMd.push(`| ${team} | ${count} |`);
  }
  reportMd.push('');

  if (unresolved.length > 0) {
    reportMd.push('## 冲突文件清单');
    reportMd.push('');
    reportMd.push('| 文件 | 涉及团队 | 变体 |');
    reportMd.push('|------|---------|------|');
    for (const u of unresolved) {
      reportMd.push(`| ${u.path} | ${u.teams.join(', ')} | ${u.variants.join(', ')} |`);
    }
    reportMd.push('');
  }

  if (resolved.length > 0) {
    reportMd.push('## 自动解决');
    reportMd.push('');
    for (const r of resolved) {
      reportMd.push(`- ${r.path} — ${r.strategy}`);
    }
    reportMd.push('');
  }

  reportMd.push('## 合并文件清单');
  reportMd.push('');
  for (const m of merged) {
    reportMd.push(`- ${m.path} (${m.strategy}, 来自 ${m.source})`);
  }

  const reportPath = path.join(output, 'MERGE-REPORT.md');
  fs.writeFileSync(reportPath, reportMd.join('\n'));

  return {
    totalFiles: result.totalFiles,
    merged: merged.length,
    conflicts: unresolved.length,
    autoResolved: resolved.length,
    outputDir: output,
    reportPath,
    report: reportMd.join('\n'),
    unresolved,
  };
}

// ─── Merge with Blue-Baseline strategy (default for code) ───

/**
 * Smart merge: blue team as baseline, cherry-pick red innovations, always merge green security.
 */
function smartMerge({ teams, baseDir, outputDir } = {}) {
  const result = unionMerge({ teams, baseDir, outputDir, resolveAuto: true });

  // For unresolved content conflicts, apply smart strategy:
  // 1. Start with blue team version
  // 2. Overlay green team security patches
  // 3. Document red team innovations for manual cherry-pick
  // This is handled by the resolution.md files already generated

  return {
    ...result,
    strategy: 'blue-baseline',
    recommendation: 'Phase 4 融合阶段由汇总者对比各版本，按裁判评分权重采纳最佳方案',
  };
}

// ─── Helpers ───

function walkDir(dir, callback) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('node_modules') && !entry.name.startsWith('.git')) {
          walkDir(fullPath, callback);
        }
      } else if (entry.isFile()) {
        callback(fullPath);
      }
    }
  } catch (_) {}
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ─── Main ───

function main() {
  const args = process.argv.slice(2);
  const opts = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--teams':
        opts.teams = args[++i].split(',').map(t => t.trim());
        break;
      case '--base':
        opts.baseDir = args[++i];
        break;
      case '--output':
        opts.outputDir = args[++i];
        break;
      case '--check-only':
        opts.checkOnly = true;
        break;
      case '--resolve':
        opts.resolve = args[++i]; // 'auto' or 'smart'
        break;
      case '--json':
        opts.json = true;
        break;
      case '--help':
        console.log('hammer-merge — 三队产物并集合并');
        console.log('  --teams <red,blue,green>    团队列表');
        console.log('  --base <dir>                产物根目录');
        console.log('  --output <dir>              合并输出目录');
        console.log('  --check-only                仅检测冲突，不合并');
        console.log('  --resolve auto              自动解决格式差异');
        console.log('  --resolve smart             蓝队基线+绿队安全+红队创新');
        console.log('  --json                      JSON 输出');
        process.exit(0);
        break;
    }
  }

  const base = opts.baseDir || ROOT;

  if (opts.checkOnly) {
    const result = detectConflicts({ teams: opts.teams, baseDir: base });
    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`文件总计: ${result.totalFiles}`);
      console.log(`一致: ${result.summary.identical} | 独有: ${result.summary.unique} | 冲突: ${result.summary.content}`);
      if (result.conflicts.CONTENT.length > 0) {
        console.log('\n冲突文件:');
        for (const c of result.conflicts.CONTENT) {
          console.log(`  ${c.path} — ${c.entries.map(e => e.team).join(', ')} (${c.entries.length} 版本)`);
        }
      }
    }
    process.exit(result.summary.hasConflicts ? 1 : 0);
  }

  // Execute merge
  const resolveMode = opts.resolve || 'none';
  let mergeResult;

  if (resolveMode === 'smart') {
    mergeResult = smartMerge({ teams: opts.teams, baseDir: base, outputDir: opts.outputDir });
  } else {
    mergeResult = unionMerge({
      teams: opts.teams,
      baseDir: base,
      outputDir: opts.outputDir,
      resolveAuto: resolveMode === 'auto',
    });
  }

  if (opts.json) {
    console.log(JSON.stringify({
      totalFiles: mergeResult.totalFiles,
      merged: mergeResult.merged,
      conflicts: mergeResult.conflicts,
      autoResolved: mergeResult.autoResolved,
      outputDir: mergeResult.outputDir,
      reportPath: mergeResult.reportPath,
    }, null, 2));
  } else {
    console.log(`合并完成:`);
    console.log(`  文件总计: ${mergeResult.totalFiles}`);
    console.log(`  已合并: ${mergeResult.merged} | 冲突保留: ${mergeResult.conflicts} | 自动解决: ${mergeResult.autoResolved}`);
    console.log(`  输出目录: ${mergeResult.outputDir}`);
    console.log(`  合并报告: ${mergeResult.reportPath}`);
  }

  process.exit(mergeResult.conflicts > 0 ? 1 : 0);
}

if (require.main === module) {
  main();
}

module.exports = { detectConflicts, unionMerge, smartMerge, collectTeamFiles, collectTeamFilesFromRoot };
