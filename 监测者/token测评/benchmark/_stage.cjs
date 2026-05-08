const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const repoRoot = 'D:/AICoding';
const cwd = repoRoot; // run git from repo root

function gitAdd(absPath) {
  try {
    execSync(`git add "${absPath}"`, { cwd, stdio: 'pipe' });
    console.log(`  OK: ${path.basename(absPath)}`);
  } catch (e) {
    console.error(`  FAIL: ${path.basename(absPath)} - ${e.stderr?.toString()?.trim() || e.message}`);
  }
}

// Add benchmark .cjs files
const benchDir = path.join(repoRoot, '监测者', 'token测评', 'benchmark');
const benchFiles = fs.readdirSync(benchDir).filter(f => /\.cjs$/.test(f));
for (const f of benchFiles) {
  gitAdd(path.join(benchDir, f));
}

// Add the staging script itself
gitAdd(path.join(benchDir, '_stage.cjs'));

// Show final status
console.log('\n=== Final Status ===');
execSync('git status --short', { cwd, stdio: 'inherit' });
