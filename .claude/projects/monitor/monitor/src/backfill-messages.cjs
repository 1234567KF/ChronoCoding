#!/usr/bin/env node
/**
 * backfill-messages — 从 Claude Code 转录文件回填真实对话内容到 Monitor DB
 *
 * Usage:
 *   node backfill-messages.cjs                        # 回填所有已有会话
 *   node backfill-messages.cjs --session <sessionId>  # 回填指定会话
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const MONITOR_DB = path.join(__dirname, '../data/monitor.db');
const TRANSCRIPT_DIR = path.join(require('os').homedir(), '.claude', 'projects', 'D--AICoding');

function extractTextContent(content) {
  if (!content) return '';
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .filter(c => c.type === 'text')
      .map(c => c.text || '')
      .join('\n')
      .trim();
  }
  return '';
}

function getSessionTranscriptPath(sessionId) {
  // Try exact match
  const exact = path.join(TRANSCRIPT_DIR, `${sessionId}.jsonl`);
  if (fs.existsSync(exact)) return exact;

  // Try wildcard partial match (first 8 chars)
  if (sessionId && sessionId.length >= 8) {
    try {
      const files = fs.readdirSync(TRANSCRIPT_DIR).filter(f => f.startsWith(sessionId.slice(0, 8)));
      if (files.length === 1) return path.join(TRANSCRIPT_DIR, files[0]);
    } catch {}
  }
  return null;
}

function importTranscriptMessages(convId, transcriptPath) {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) {
    console.log(`  [skip] Transcript not found for ${convId.slice(0, 20)}`);
    return 0;
  }

  const db = new Database(MONITOR_DB);
  db.pragma('journal_mode = WAL');

  const content = fs.readFileSync(transcriptPath, 'utf-8');
  const lines = content.split('\n').filter(Boolean);

  // Read existing message IDs and content hashes to avoid duplicates
  const existingContents = new Map();
  const existingRows = db.prepare(
    'SELECT id, content, role FROM messages WHERE conversation_id = ? ORDER BY id'
  ).all(convId);
  for (const row of existingRows) {
    // Use first 100 chars as dedup key
    const key = (row.content || '').slice(0, 100);
    existingContents.set(key, row.role);
  }

  // Check if conversation exists
  const conv = db.prepare('SELECT id FROM conversations WHERE id = ?').get(convId);
  if (!conv) {
    // Create conversation record if not exists
    const firstLine = lines.length > 0 ? JSON.parse(lines[0]) : null;
    const model = firstLine?.message?.model || 'unknown';
    db.prepare(
      'INSERT INTO conversations (id, session_id, title, model, started_at) VALUES (?, ?, ?, ?, ?)'
    ).run(convId, convId, `会话 ${convId.slice(0, 16)}`, model, new Date().toISOString());
    console.log(`  Created conversation record for ${convId.slice(0, 20)}`);
  }

  const insertMsg = db.prepare(
    `INSERT INTO messages (conversation_id, role, content, input_tokens, output_tokens, cache_hit, input_cost, output_cost, cache_cost, baseline_cost, model, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  let imported = 0;
  let skipped = 0;

  const tx = db.transaction(() => {
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        const role = entry.message?.role;
        if (role !== 'user' && role !== 'assistant') continue;

        const content = extractTextContent(entry.message?.content);
        if (!content || content.length < 5) continue; // skip empty/minimal content

        const usage = entry.message?.usage || {};
        const inputTokens = usage.input_tokens || 0;
        const outputTokens = usage.output_tokens || 0;
        const cacheRead = usage.cache_read_input_tokens || 0;
        const model = entry.message?.model || '';

        // Deduplicate by content fingerprint (first 100 chars)
        const dedupKey = content.slice(0, 100);
        if (existingContents.has(dedupKey)) {
          skipped++;
          continue;
        }

        // Compute approximate cost
        const cost = estimateCost(model, role === 'user' ? inputTokens : 0, outputTokens, cacheRead);

        // Truncate content for storage (keep full content, db can handle it)
        // But limit to first 5000 chars to keep DB size manageable
        const truncatedContent = content.length > 10000 ? content.slice(0, 10000) + '...' : content;

        const timestamp = entry.message?.timestamp || new Date(entry.timestamp || Date.now()).toISOString();

        insertMsg.run(
          convId,
          role,
          truncatedContent,
          inputTokens,
          outputTokens,
          cacheRead,
          cost?.input_cost || null,
          cost?.output_cost || null,
          cost?.cache_cost || 0,
          cost?.baseline_cost || null,
          model || null,
          timestamp
        );
        imported++;

        // Track for dedup in this session
        existingContents.set(dedupKey, role);
      } catch {}
    }

    // Update conversation totals from transcript
    let totalIn = 0, totalOut = 0, totalCache = 0;
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        const u = entry.message?.usage;
        if (u) {
          totalIn += u.input_tokens || 0;
          totalOut += u.output_tokens || 0;
          totalCache += u.cache_read_input_tokens || 0;
        }
      } catch {}
    }

    // Recalculate cost
    const totalCost = estimateCost('deepseek-v4-flash', totalIn, totalOut, totalCache);

    db.prepare(
      `UPDATE conversations SET
        total_input_tokens = ?,
        total_output_tokens = ?,
        total_cost = ?,
        model = COALESCE(NULLIF(model, ''), ?),
        ended_at = datetime('now')
       WHERE id = ? AND total_input_tokens = 0`
    ).run(totalIn, totalOut, totalCost?.total_cost || 0, 'deepseek-v4-flash', convId);
  });

  tx();
  db.close();

  console.log(`  Imported ${imported} messages for ${convId.slice(0, 20)} (skipped ${skipped} duplicates)`);
  return imported;
}

/**
 * Wrapper around pricing.calcCost that adapts DeepSeek transcript token format.
 *
 * DeepSeek format: input_tokens = total (uncached + cached), cache_read_input_tokens = cached
 * pricing.calcCost expects: tokensIn = uncached only, cacheHit = cached
 */
function estimateCost(model, tokensIn, tokensOut, cacheHit) {
  const { calcCost, calcBaselineCost } = require('./pricing');
  const cached = cacheHit || 0;
  const uncached = Math.max(0, (tokensIn || 0) - cached);
  const cost = calcCost(model, uncached, tokensOut || 0, cached);
  const baseline = calcBaselineCost(uncached, tokensOut || 0, cached);
  return {
    input_cost: cost?.input_cost ?? 0,
    output_cost: cost?.output_cost ?? 0,
    cache_cost: cost?.cache_cost ?? 0,
    total_cost: cost?.total_cost ?? 0,
    baseline_cost: baseline?.total_cost ?? 0,
  };
}

function main() {
  const args = process.argv.slice(2);
  const targetSession = args.includes('--session') ? args[args.indexOf('--session') + 1] : null;

  const db = new Database(MONITOR_DB);
  db.pragma('journal_mode = WAL');

  let conversations;
  if (targetSession) {
    conversations = [{ id: targetSession }];
  } else {
    conversations = db.prepare('SELECT id FROM conversations ORDER BY started_at DESC').all();
  }
  db.close();

  console.log(`=== Backfilling ${conversations.length} conversations ===`);
  let totalImported = 0;
  for (const conv of conversations) {
    const transcriptPath = getSessionTranscriptPath(conv.id);
    if (!transcriptPath) {
      console.log(`  [skip] No transcript found for ${conv.id.slice(0, 20)}`);
      continue;
    }
    const n = importTranscriptMessages(conv.id, transcriptPath);
    totalImported += n;
  }
  console.log(`\nDone. Imported ${totalImported} messages total.`);
}

main();
