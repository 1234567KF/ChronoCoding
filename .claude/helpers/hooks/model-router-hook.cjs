#!/usr/bin/env node
/**
 * kf-model-router Hook — PreToolUse for Skill matcher
 *
 * Reads invoked skill's SKILL.md frontmatter, extracts recommended_model,
 * outputs system-reminder for model routing.
 *
 * Usage:
 *   node .claude/helpers/model-router-hook.cjs [--skill <name>]
 *
 * When called as PreToolUse hook, env CLAUDE_TOOL_USE_REQUEST
 * contains the Skill tool call JSON.
 */

const fs = require("fs");
const path = require("path");

const SKILLS_DIR = path.resolve(
  __dirname,
  "..",
  "skills"
);

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const yaml = match[1];
  const result = {};
  let meta = {};
  let inMeta = false;
  let currentListKey = null;
  let currentList = [];

  for (const line of yaml.split("\n")) {
    // Metadata section
    const metaKeyMatch = line.match(/^metadata:\s*$/);
    if (metaKeyMatch) { inMeta = true; continue; }

    // Top-level key: value
    const kvMatch = line.match(/^(\w[\w-]*):\s*(.*)/);
    if (kvMatch && !line.startsWith(" ")) {
      // Save any in-progress list
      if (currentListKey && currentList.length > 0) {
        if (inMeta) meta[currentListKey] = currentList.join(", ");
        else result[currentListKey] = currentList.join(", ");
      }
      currentListKey = null;
      currentList = [];
      inMeta = false;

      const key = kvMatch[1];
      const val = kvMatch[2].trim();
      // Check for nested key (no value = could be list parent or multi-line)
      result[key] = val || "";
      continue;
    }

    // Metadata nested key
    const metaKvMatch = line.match(/^\s{2}(\w[\w-]*):\s*(.*)/);
    if (metaKvMatch && inMeta) {
      // Save any in-progress list
      if (currentListKey && currentList.length > 0) {
        meta[currentListKey] = currentList.join(", ");
      }
      currentListKey = null;
      currentList = [];

      const key = metaKvMatch[1];
      const val = metaKvMatch[2].trim();
      meta[key] = val || "";
      if (!val) currentListKey = key;
      continue;
    }

    // List item (starts with -)
    const listMatch = line.match(/^\s{4}-\s+(.+)/);
    if (listMatch && currentListKey) {
      currentList.push(listMatch[1].replace(/['"]/g, ""));
    }
  }

  // Save last list
  if (currentListKey && currentList.length > 0) {
    if (inMeta) meta[currentListKey] = currentList.join(", ");
    else result[currentListKey] = currentList.join(", ");
  }

  result.metadata = meta;
  return result;
}

function findSkillMd(skillName) {
  const dir = path.join(SKILLS_DIR, skillName);
  const mdPath = path.join(dir, "SKILL.md");
  if (fs.existsSync(mdPath)) return mdPath;
  return null;
}

function getSkillName() {
  // 1. Command line arg
  const idx = process.argv.indexOf("--skill");
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];

  // 2. Environment variable
  const env = process.env.CLAUDE_TOOL_USE_REQUEST ||
              process.env.CLAUDE_EXTRA_CONTEXT;
  if (env) {
    try {
      const p = JSON.parse(env);
      const s = p?.skill || p?.args?.skill || p?.arguments?.skill;
      if (s) return s;
    } catch {}
  }

  // 3. stdin
  try {
    const buf = fs.readFileSync(0, "utf-8").trim();
    if (buf) {
      const p = JSON.parse(buf);
      return p?.skill || p?.args?.skill || null;
    }
  } catch {}
  return null;
}

function main() {
  const skillName = getSkillName();
  if (!skillName) process.exit(0);

  const mdPath = findSkillMd(skillName);
  if (!mdPath) {
    console.error(`[model-router] SKILL.md not found for: ${skillName}`);
    process.exit(0);
  }

  const content = fs.readFileSync(mdPath, "utf-8");
  const fm = parseFrontmatter(content);
  const meta = fm.metadata || {};

  // Check integrated-skills from metadata or top-level
  const integrated = (meta["integrated-skills"] || fm["integrated-skills"] || "");
  const recommended = (meta["recommended_model"] || fm["recommended_model"] || "");
  const hasModelRouter = integrated.includes("kf-model-router");

  if (recommended || hasModelRouter) {
    console.error(
      `[model-router] skill=${skillName} rec="${recommended}" router=${hasModelRouter}`
    );
    // Output actionable model routing instruction (NOT an HTML comment — must be visible to the model)
    const instruction = recommended
      ? `[model-router] 技能 "${skillName}" 推荐模型: ${recommended}。请确保当前对话使用 ${recommended} 以获得最佳效果（计划/设计阶段），执行阶段可切换回 flash。`
      : `[model-router] 技能 "${skillName}" 已集成模型路由，请按 SKILL.md 的阶段模型分配执行。`;
    console.log(instruction);
  }
}

main();
