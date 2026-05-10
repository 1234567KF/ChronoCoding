# gspowers Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the gspowers orchestrator skill — 7 markdown prompt files that guide Claude through a unified gstack + superpowers development workflow.

**Architecture:** Dispatcher router (SKILL.md ~50 lines) reads `.gspowers/state.json` and loads one of four phase-specific instruction files from `references/`. Two additional reference docs (sop.md, tools-guide.md) are human-readable and not loaded by the dispatcher.

**Tech Stack:** Claude Code skill system (markdown prompts), no code dependencies.

**Spec:** `docs/superpowers/specs/2026-03-25-gspowers-skill-design.md`

**Install path:** `~/.claude/skills/gspowers/`

**Note on superpowers detection:** superpowers is installed as a Claude Code plugin (not in `~/.claude/skills/`). The environment check should verify superpowers availability by checking if `superpowers:brainstorming` appears in the available skills list, rather than checking a directory path. Update the init.md prompt accordingly.

---

### Task 1: Create SKILL.md — Dispatcher Router

**Files:**
- Create: `~/.claude/skills/gspowers/SKILL.md`

This is the entry point for `/gspowers`. It routes to the correct phase instruction file based on state.json.

- [ ] **Step 1: Create the skill directory structure**

```bash
mkdir -p ~/.claude/skills/gspowers/references
```

- [ ] **Step 2: Write SKILL.md**

Write `~/.claude/skills/gspowers/SKILL.md` with the following content structure:

**Frontmatter:**
```yaml
---
name: gspowers
description: |
  AI development workflow orchestrator. Coordinates gstack (product/architecture)
  and superpowers (engineering/testing) in a unified flow. Run /gspowers to see
  your current position and next step.
---
```

**Body — the dispatcher prompt (~50 lines):**

The prompt must instruct Claude to:

1. Check if `.gspowers/state.json` exists (use Bash: `test -f .gspowers/state.json`)
   - Does not exist → Read `~/.claude/skills/gspowers/references/init.md` and follow its instructions
   - Exists → Read state.json, proceed to step 2

2. Resumption mode:
   a. Read `.gspowers/handoff.md` if it exists, display the status summary to user
   b. Ask user: "上一步（{current_step}）完成了吗？"
      - Yes → Ask for artifact file path, copy to `.gspowers/artifacts/` using `cp`, update state.json (advance current_step + add to completed_steps + update last_updated), rewrite handoff.md
      - No → Display the command to continue executing the current step
   c. Based on `current_phase`, Read the corresponding instruction file:
      - `plan` → Read `~/.claude/skills/gspowers/references/plan.md`
      - `execute` → Read `~/.claude/skills/gspowers/references/execute.md`
      - `finish` → Read `~/.claude/skills/gspowers/references/finish.md`
      - `done` → Display completion statistics summary

3. Always display the flow map with current position markers:
   - ✅ for completed_steps
   - 🔄 for current_step
   - ⏭️ for skipped_steps
   - ⬜ for pending steps
   - If `has_ui` is false, show /qa as `[⏭️ 跳过]`

4. State write rule: every time state.json is updated, also rewrite handoff.md using the template from the spec (§ handoff.md 模板).

**Key implementation details for the prompt:**
- Use absolute paths for Read tool calls to reference files (`~/.claude/skills/gspowers/references/...`)
- The flow map is a fixed template string with `{status}` placeholders — instruct Claude to read state.json and fill in the markers
- The "advance current_step" logic needs a next-step mapping embedded in the prompt:
  ```
  office-hours → plan-ceo-review (or plan-eng-review if skipped)
  plan-ceo-review → plan-eng-review
  plan-eng-review → brainstorming
  brainstorming → writing-plans (or subagent-dev if both artifacts exist)
  writing-plans → subagent-dev
  subagent-dev → review
  review → qa (if has_ui) or ship
  qa → ship
  ship → document-release
  document-release → done
  ```
- The phase mapping:
  ```
  office-hours, plan-ceo-review, plan-eng-review → plan
  brainstorming, writing-plans, subagent-dev → execute
  review, qa, ship, document-release → finish
  ```

- [ ] **Step 3: Verify SKILL.md against spec**

Checklist — confirm the prompt covers:
- [ ] state.json existence check → routes to init.md
- [ ] Resumption mode: handoff display → user confirmation → artifact collection → state update
- [ ] Phase routing: plan/execute/finish/done
- [ ] Flow map with status markers
- [ ] state.json + handoff.md sync write rule
- [ ] Next-step mapping is complete and correct
- [ ] All Read paths use absolute paths to `~/.claude/skills/gspowers/references/`

- [ ] **Step 4: Commit**

```bash
git add ~/.claude/skills/gspowers/SKILL.md
git commit -m "feat: add gspowers dispatcher SKILL.md"
```

---

### Task 2: Create references/init.md — First-Time Setup

**Files:**
- Create: `~/.claude/skills/gspowers/references/init.md`

Loaded when state.json does not exist. Handles environment check, project info collection, and state initialization.

- [ ] **Step 1: Write init.md**

Write `~/.claude/skills/gspowers/references/init.md` with the following sections:

**Section 1 — Environment Check:**

Instruct Claude to check three items using Bash:
1. `test -d ~/.claude/skills/gstack` — gstack installed
2. Check if `superpowers:brainstorming` is in the available skills list (Claude can check this by attempting to reference the skill — if superpowers is a registered plugin, it will appear in the skill list shown in system prompts. Instruct Claude: "Confirm that you can see superpowers skills (e.g., superpowers:brainstorming) in your available skills. If not visible, tell the user to install superpowers.")
3. `test -d .git` — git initialized

If any check fails: display what's missing with install instructions, then STOP.

**Section 2 — Collect Project Info:**

Q1: Ask "这是新项目还是已有项目的迭代？"
- new → `project_type = "new"`
- existing → `project_type = "existing"`, display Update_Plan.md template and instruct user to create it in project root

Q2 (only if new): Ask "选择流程模式："
- 完整模式 → `mode = "full"`
- 快速模式 → `mode = "quick"`
- If existing: auto-set `mode = "quick"`, skip this question

Q3: Ask "这个项目有前端 UI 吗？"
- Yes → `has_ui = true`
- No → `has_ui = false`

**Section 3 — Calculate Starting Step:**

```
new + full → office-hours, phase = plan
new + quick → plan-eng-review, phase = plan
existing → plan-eng-review, phase = plan
```

Also compute `skipped_steps`:
- quick mode → add "office-hours" and "plan-ceo-review" to skipped_steps
- existing → add "office-hours" and "plan-ceo-review" to skipped_steps

**Section 4 — Create Files:**

Instruct Claude to:
1. `mkdir -p .gspowers/artifacts`
2. Write `.gspowers/state.json` with all fields from spec schema, using computed values
3. Write `.gspowers/handoff.md` using the template
4. Display the flow map (instruct Claude to follow the flow map template from SKILL.md)
5. Display the first step's execution command

**Section 5 — Update_Plan.md Template:**

Include the full template from spec § Update_Plan.md.

- [ ] **Step 2: Verify init.md against spec**

Checklist:
- [ ] Three env checks with correct paths/methods
- [ ] Q1/Q2/Q3 questions with all branches
- [ ] existing auto-sets mode=quick, skips Q2
- [ ] Starting step matrix matches spec (3 rows)
- [ ] state.json schema matches spec exactly (all fields)
- [ ] handoff.md generated on creation
- [ ] Update_Plan.md template included for existing projects
- [ ] Flow map displayed after initialization

- [ ] **Step 3: Commit**

```bash
git add ~/.claude/skills/gspowers/references/init.md
git commit -m "feat: add init.md — first-time setup flow"
```

---

### Task 3: Create references/plan.md — Planning Phase

**Files:**
- Create: `~/.claude/skills/gspowers/references/plan.md`

Loaded when `current_phase = "plan"`. Covers office-hours → plan-ceo-review → plan-eng-review.

- [ ] **Step 1: Write plan.md**

Write `~/.claude/skills/gspowers/references/plan.md` with:

**Preamble:** "existing 项目跳过 office-hours 和 plan-ceo-review，直接从 plan-eng-review 开始。"

**Section: office-hours**

Instruct Claude to:
1. Display command: `/office-hours`
2. After user returns, ask: "office-hours 完成了吗？请提供产出文件路径（通常在 ~/.gstack/projects/{slug}/ 下）"
3. Copy artifact: `cp <user-provided-path> .gspowers/artifacts/product-requirements.md`
4. Update state.json: add "office-hours" to completed_steps, set current_step to "plan-ceo-review"
5. Ask: "下一步是 plan-ceo-review（可选）。需要 CEO 视角审查吗？"
   - Yes → continue to plan-ceo-review section
   - No → add "plan-ceo-review" to skipped_steps, set current_step to "plan-eng-review"
6. Rewrite handoff.md

**Section: plan-ceo-review**

Instruct Claude to:
1. Display command: `/plan-ceo-review`
2. After completion, collect artifact path
3. Copy to `.gspowers/artifacts/ceo-review.md`
4. Update state.json: add "plan-ceo-review" to completed_steps, set current_step to "plan-eng-review"
5. Rewrite handoff.md

**Section: plan-eng-review**

Instruct Claude to:
1. Check project_type from state.json:
   - new → Display: `/plan-eng-review` with note to read `.gspowers/artifacts/product-requirements.md`
   - existing → Display: `/plan-eng-review` with note to read `Update_Plan.md` from project root
2. After completion, collect artifact path
3. Copy to `.gspowers/artifacts/architecture.md`
4. Update state.json: add "plan-eng-review" to completed_steps, set current_phase to "execute", current_step to "brainstorming"
5. Rewrite handoff.md
6. Display: "⚠️ 下一步进入执行期（superpowers），需要清理上下文。请执行 /clear，然后输入 /gspowers"

- [ ] **Step 2: Verify plan.md against spec**

Checklist:
- [ ] existing project preamble note present
- [ ] office-hours: artifact collection + copy to artifacts/
- [ ] plan-ceo-review: optional with skip logic
- [ ] plan-eng-review: different input based on project_type
- [ ] plan-eng-review: transitions to execute phase
- [ ] /clear prompt after plan-eng-review
- [ ] Every state.json update syncs handoff.md

- [ ] **Step 3: Commit**

```bash
git add ~/.claude/skills/gspowers/references/plan.md
git commit -m "feat: add plan.md — planning phase instructions"
```

---

### Task 4: Create references/execute.md — Execution Phase

**Files:**
- Create: `~/.claude/skills/gspowers/references/execute.md`

Loaded when `current_phase = "execute"`. Covers brainstorming → writing-plans → subagent-dev.

- [ ] **Step 1: Write execute.md**

Write `~/.claude/skills/gspowers/references/execute.md` with:

**Section: brainstorming**

Instruct Claude to:
1. Display command block:
   ```
   /brainstorm

   请读取 .gspowers/artifacts/architecture.md 作为架构输入。
   ```
2. Note: "brainstorming 完成后会自动衔接 writing-plans，无需返回调度器。"
3. When user returns to /gspowers, check which artifacts exist:
   - Ask user to confirm which are done, then check:
   - Only design-spec exists (no implementation-plan) → set current_step to "writing-plans", collect design-spec artifact
   - Both exist → set current_step to "subagent-dev", collect both artifacts
4. Artifact collection: ask user for file paths, copy to:
   - `.gspowers/artifacts/design-spec.md`
   - `.gspowers/artifacts/implementation-plan.md`
5. Update state.json + rewrite handoff.md

**Section: writing-plans (recovery only)**

Instruct Claude to:
1. Display: "上次 brainstorming 完成但 writing-plans 未开始。"
2. Display command block:
   ```
   /superpowers:writing-plans

   请读取 .gspowers/artifacts/design-spec.md
   ```
3. After completion: collect implementation-plan artifact, update current_step to "subagent-dev"
4. Update state.json + rewrite handoff.md

**Section: subagent-dev**

Instruct Claude to:
1. Display command block:
   ```
   /superpowers:subagent-driven-development

   请读取 .gspowers/artifacts/implementation-plan.md
   ```
2. After completion: update state.json: current_phase → "finish", current_step → "review", add "subagent-dev" to completed_steps
3. Rewrite handoff.md
4. Display: "⚠️ 下一步进入收尾期（gstack），需要清理上下文。请执行 /clear，然后输入 /gspowers"

- [ ] **Step 2: Verify execute.md against spec**

Checklist:
- [ ] brainstorming: correct command with architecture.md reference
- [ ] brainstorming: artifact-based detection for mid-phase interruption
- [ ] writing-plans: recovery-only scenario handled
- [ ] subagent-dev: transitions to finish phase
- [ ] /clear prompt after subagent-dev
- [ ] All three steps: artifact collection + state.json + handoff.md sync

- [ ] **Step 3: Commit**

```bash
git add ~/.claude/skills/gspowers/references/execute.md
git commit -m "feat: add execute.md — execution phase instructions"
```

---

### Task 5: Create references/finish.md — Finishing Phase

**Files:**
- Create: `~/.claude/skills/gspowers/references/finish.md`

Loaded when `current_phase = "finish"`. Covers /review → /qa → /ship → /document-release.

- [ ] **Step 1: Write finish.md**

Write `~/.claude/skills/gspowers/references/finish.md` with:

**Preamble:** "收尾期所有步骤都是 gstack skill，同一上下文内可连续执行，无需 /clear。"

**Section: review**

Instruct Claude to:
1. Display command: `/review`
2. After completion, collect artifact, copy to `.gspowers/artifacts/review-report.md`
3. Ask user: "review 结果如何？有严重问题需要返回修复，还是通过了？"
   - Severe issues → Update state.json: current_phase → "execute", current_step → "subagent-dev", status → "failed", set failure_reason. Display: "⚠️ 需要返回执行期修复。请执行 /clear，然后输入 /gspowers"
   - Passed → Check has_ui from state.json:
     - true → set current_step to "qa"
     - false → add "qa" to skipped_steps, set current_step to "ship"
4. Update state.json + rewrite handoff.md

**Section: qa (conditional)**

Instruct Claude to:
1. Only execute if `has_ui = true`
2. Display: "请提供你的开发服务器端口号"
3. Display command: `/qa http://localhost:<PORT>`
4. Remind: "如有登录墙，先执行 /setup-browser-cookies"
5. After completion: set current_step to "ship"
6. Update state.json + rewrite handoff.md

**Section: ship**

Instruct Claude to:
1. Display command: `/ship`
2. After completion: ask user for PR link, record in artifacts.pr_link
3. Set current_step to "document-release"
4. Update state.json + rewrite handoff.md

**Section: document-release**

Instruct Claude to:
1. Display command: `/document-release`
2. After completion: set current_phase → "done", status → "completed"
3. Update state.json + rewrite handoff.md
4. Display completion statistics:
   ```
   gspowers 流程完成！

     项目类型：{project_type} | {mode}模式
     总步骤：{len(completed_steps)} 完成 / {len(skipped_steps)} 跳过
     产出物：{artifact_count} 份（.gspowers/artifacts/）
     耗时：{started_at} → {last_updated}
     PR：{pr_link}
   ```

- [ ] **Step 2: Verify finish.md against spec**

Checklist:
- [ ] review: artifact collection + pass/fail branching
- [ ] review failure: rollback to execute phase with /clear prompt
- [ ] qa: conditional on has_ui, PORT from user, setup-browser-cookies reminder
- [ ] ship: PR link collection
- [ ] document-release: phase → done, completion statistics
- [ ] No /clear between finish steps
- [ ] Every state update syncs handoff.md

- [ ] **Step 3: Commit**

```bash
git add ~/.claude/skills/gspowers/references/finish.md
git commit -m "feat: add finish.md — finishing phase instructions"
```

---

### Task 6: Create references/sop.md — Human-Readable SOP

**Files:**
- Create: `~/.claude/skills/gspowers/references/sop.md`

Not loaded by the dispatcher. Human-readable complete operating procedure.

- [ ] **Step 1: Write sop.md**

Write `~/.claude/skills/gspowers/references/sop.md` covering:

1. **What is gspowers** — one paragraph explaining the orchestrator concept
2. **Prerequisites** — gstack, superpowers, git
3. **Quick Start** — `/gspowers` command, what to expect on first run
4. **Complete Flow Table** — new project (full mode) with all 10 steps: step name, tool, command, artifact, /clear needed
5. **Streamlined Flow Table** — existing project: which steps are skipped and why
6. **Quick Mode** — what it skips, when to use it
7. **Step-by-Step Guide** — for each of the 10 steps: input, output, exact command, what to expect
8. **/clear Boundary Rules** — the full table from spec with explanations
9. **state.json Reference** — full schema with field descriptions
10. **Troubleshooting** — state.json corruption recovery, /review rollback, mid-session /clear
11. **Update_Plan.md Template** — for existing projects

Style: concise, scannable. Use tables for reference, prose for explanations. Write in Chinese (matching the user-facing tone of gspowers).

- [ ] **Step 2: Verify sop.md against spec**

Checklist:
- [ ] All 10 steps documented with correct commands
- [ ] /clear boundaries match spec table exactly
- [ ] state.json schema matches spec
- [ ] Update_Plan.md template included
- [ ] Troubleshooting covers: corruption, rollback, mid-clear
- [ ] Quick mode documented correctly

- [ ] **Step 3: Commit**

```bash
git add ~/.claude/skills/gspowers/references/sop.md
git commit -m "docs: add sop.md — complete operating procedure"
```

---

### Task 7: Create references/tools-guide.md — Supplemental Tools

**Files:**
- Create: `~/.claude/skills/gspowers/references/tools-guide.md`

Not loaded by the dispatcher. Reference for tools outside the main flow.

- [ ] **Step 1: Write tools-guide.md**

Write `~/.claude/skills/gspowers/references/tools-guide.md` covering five tools:

1. **/plan-ceo-review** — CEO/founder perspective review
   - When to use: new product direction, large-scale refactoring, multiple strategic options
   - Timing: after office-hours, before plan-eng-review
   - Command: `/plan-ceo-review`
   - Note: integrated as optional step in main flow

2. **/retro** — Engineering retrospective
   - When to use: weekly reviews, post-release retrospectives, SOP optimization
   - Timing: periodic, not within a single dev flow
   - Command: `/retro`

3. **/investigate** — Deep debugging
   - When to use: cross-module bugs, production incident root cause analysis
   - 4-phase approach: investigate → analyze → hypothesize → implement
   - Command: `/investigate "description of issue"`

4. **/design-consultation** — Design system consultation
   - When to use: new project visual style, major UI redesign
   - Command: `/design-consultation`

5. **/cso** — Security audit
   - When to use: pre-release security check, sensitive data handling
   - Command: `/cso`

Style: each tool gets a short section with When/Timing/Command/Example. Write in Chinese.

- [ ] **Step 2: Verify tools-guide.md against spec**

Checklist:
- [ ] All 5 tools covered: /plan-ceo-review, /retro, /investigate, /design-consultation, /cso
- [ ] /plan-ceo-review includes relation to main flow (optional after office-hours)
- [ ] /investigate includes 4-phase approach description
- [ ] Written in Chinese

- [ ] **Step 3: Commit**

```bash
git add ~/.claude/skills/gspowers/references/tools-guide.md
git commit -m "docs: add tools-guide.md — supplemental tools reference"
```

---

### Task 8: End-to-End UX Walkthrough

**Files:**
- Review: all 7 files created in Tasks 1-7

Manual verification — walk through the complete user journey to catch prompt gaps.

- [ ] **Step 1: New project + full mode walkthrough**

Mentally simulate:
1. User runs `/gspowers` in an empty project with git → SKILL.md routes to init.md
2. Init: env check passes → Q1: new → Q2: full → Q3: no UI
3. State created, flow map shown, prompted to run `/office-hours`
4. User runs `/gspowers` after office-hours → asks "完成了吗？" → collects artifact → shows plan-ceo-review option
5. User skips CEO review → advances to plan-eng-review
6. User runs `/gspowers` after plan-eng-review → collects artifact → prompts /clear
7. User /clear → `/gspowers` → reads handoff → loads execute.md → prompts brainstorming
8. User runs `/gspowers` after brainstorming+writing-plans+subagent-dev → collects artifacts → prompts /clear
9. User /clear → `/gspowers` → loads finish.md → prompts /review
10. /review passes → skips /qa (no UI) → /ship → /document-release → done statistics

Verify: every transition has the correct command prompt and state update.

- [ ] **Step 2: Existing project walkthrough**

Simulate:
1. `/gspowers` → init → existing → auto quick → no UI
2. Skips office-hours + plan-ceo-review → starts at plan-eng-review with Update_Plan.md
3. Rest follows same flow

Verify: skipped_steps correctly populated, flow map renders correctly.

- [ ] **Step 3: Recovery walkthrough**

Simulate:
1. User /clear mid-brainstorming (before writing-plans completes)
2. `/gspowers` → handoff shows brainstorming as current
3. User confirms brainstorming done but writing-plans not → collects design-spec only → advances to writing-plans
4. Prompts writing-plans command

Verify: artifact-based detection logic works correctly.

- [ ] **Step 4: Rollback walkthrough**

Simulate:
1. /review finds severe issues → state rolls back to execute phase
2. handoff.md shows failure reason
3. User /clear → `/gspowers` → loads execute.md → prompts subagent-dev to fix issues

Verify: failure_reason displayed, correct phase/step after rollback.

- [ ] **Step 5: Fix any issues found, commit**

```bash
git add -A ~/.claude/skills/gspowers/
git commit -m "fix: address issues found in UX walkthrough"
```
