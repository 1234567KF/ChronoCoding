---
name: kf-skill-design-expert
description: >-
  Load when user asks to design, create, review, or optimize a Claude Code
  skill (触发: "设计Skill", "创建Skill", "优化Skill", "审查Skill", "skill design",
  "固化经验", "技能设计"). Also load when evaluating whether a skill's benefit
  exceeds its context-window tax.
metadata:
  pattern: inversion + tool-wrapper + reviewer
  domain: skill-design
recommended_model: pro
graph:
  dependencies:
    - target: kf-add-skill
      type: dependency
    - target: kf-code-review-graph
      type: semantic
---

# Skill Design Expert — Perplexity-Inspired Six-Step Methodology

> **Core belief**: A Skill is a **model-facing runtime context unit** — not code, not a config file, not documentation. It encapsulates team experience, rules, and processes into a structure an Agent can reliably execute at runtime. And **every Skill is a tax** — every session and every user pays its token cost. The only question: does the benefit exceed the tax?

**Division of labor**: This Skill focuses on **content architecture design** (which pattern, how to organize execution logic, what to include vs. exclude). File engineering conventions (frontmatter, directory structure, description format) follow the file-engineering-spec in `references/file-engineering-spec.md`.

---

## Core Philosophy

Derived from Perplexity's *"Designing, Refining, and Maintaining Agent Skills at Perplexity"* and our own Harness Engineering system:

1. **Skill ≠ documentation** — It's a runtime context unit injected into the model. The model reads it and acts on it. Write for the model, not for humans.
2. **Description = Router** — A wrong description degrades ALL other skills (off-target loading causes action-at-a-distance). This is the hardest and most important line in the entire Skill.
3. **Gotchas > Instructions** — The model already knows how to do things. What it doesn't know are your project's specific traps, naming inconsistencies, and edge cases. Gotchas are the highest-signal content.
4. **Every Skill is a tax** — Before adding anything, ask: *"Would the Agent get this wrong without it?"* If not, it cannot afford to be there. "I have only made this letter longer because I have not had the time to make it shorter."
5. **Evals before content** — Write evaluation cases first. Negative examples (when the Skill should NOT load) often matter more than positive ones.
6. **Multi-model reality** — Skills must work across model families (Claude Opus, Claude Sonnet, DeepSeek, etc.). They behave differently with the same Skill.
7. **Append-mostly maintenance** — After shipping, the gotchas section accrues the most value. Failure → add gotcha. Wrong load → tighten description. Missed load → add keyword.

---

# Six-Step Skill-Building Methodology

> This replaces the old 5-step workflow. It's inspired by Perplexity's process + our Harness verification loop.

## Step 0: Write Evals First

**Do not write a single line of the Skill before you have evaluation cases.**

Source eval cases from three places:

| Source | Description | Example |
|--------|-------------|---------|
| **Real user queries** | Sampled from production or your team's common requests | "帮我写个 FastAPI 的 CRUD" |
| **Known failures** | Cases where the Agent failed because this Skill didn't exist | "上次没装这个 Skill，Agent 用了错误的 API" |
| **Neighbor confusion** | Queries close to your domain boundary that should route to ANOTHER skill | "这个请求应该触发 X Skill，不是我们" |

**Eval structure** (one JSON/Markdown file per Skill):

```markdown
# Evals for {skill-name}

## Positive (Skill SHOULD load)
| # | User Query | Expected: loads? | Notes |
|---|-----------|-----------------|-------|
| 1 | "帮我用 FastAPI 写个登录接口" | YES | Core trigger |
| 2 | "这个 endpoint 的 dependency injection 怎么写" | YES | Sub-domain |

## Negative (Skill should NOT load)
| # | User Query | Expected: loads? | Notes |
|---|-----------|-----------------|-------|
| 3 | "用 Express 写个 middleware" | NO | Different framework |
| 4 | "FastAPI 和 Django 哪个好" | NO | Comparison, not implementation |
```

**Negative examples are extremely powerful and can matter more than positive examples.** They prevent the most expensive failure mode: a Skill loading when it shouldn't, making every other Skill slightly worse.

**Gate 0**: Do not proceed to Step 1 until at least 3 positive AND 3 negative eval cases exist.

---

## Step 1: Write the Description (The Router)

**The description is a routing trigger, not documentation.** It determines when the Skill loads. A bad description explains what the Skill does; a good one says **when to load it**.

### Description Checklist

- [ ] Starts with "Load when..."
- [ ] ≤ 50 words (Perplexity target) — shorter is better; every extra word increases false-trigger risk
- [ ] Describes **user intent**, ideally phrased as real user queries
- [ ] Does NOT summarize the workflow or list what the Skill "can do"
- [ ] Includes explicit Chinese/English trigger keywords
- [ ] Clearly defines the domain boundary (what's IN scope and what's OUT)

### Example: Good vs. Bad

```yaml
# BAD — describes what the Skill does internally
description: This skill helps with FastAPI development. It provides best practices,
  code patterns, Pydantic model generation, and dependency injection guidance.

# GOOD — describes when to load, from user's perspective
description: Load when user asks to build, debug, or review a FastAPI application,
  REST API endpoint, or Pydantic model. Triggers: FastAPI, fastapi, Pydantic,
  dependency injection, API开发, 接口开发, 路由定义.
```

**Key failure modes:**
- **Off-target loading**: Skill loads for queries outside its domain → degrades all other skills
- **Missed loading**: Skill doesn't load when it should → user gets wrong answer
- **Spillover**: Adding one Skill subtly changes routing for seemingly unrelated queries

**Gate 1**: Run the description against all Step 0 eval cases. Does it trigger on all positives? Does it NOT trigger on all negatives? If any fail, rewrite the description.

---

## Step 2: Write the Body (Gotchas-First)

**The body is NOT documentation.** It's runtime context the model reads to avoid mistakes. The model already knows general best practices — what it needs are the **project-specific traps** that would cause it to fail.

### Body Writing Rules

1. **Skip the obvious.** Don't explain what a REST API is. Don't list `git add; git commit; git push`. The model knows.
2. **Don't write command lists.** Instead of "Step 1: run X, Step 2: run Y", give high-level intent: "Cherry-pick the commit onto a clean branch based off main."
3. **Gotchas are the highest-signal content.** Things the model would get wrong without being told:
   - Naming inconsistencies across the codebase (`user_id` in DB, `uid` in auth, `accountId` in billing)
   - Soft-delete conventions (must add `WHERE deleted_at IS NULL`)
   - Environment-specific traps (`/health` returns 200 even when DB is down)
   - Implicit ordering assumptions
4. **Move conditional/heavy content to references/.** If something is only needed in specific scenarios, don't put it in SKILL.md — reference it conditionally: "If the API returns a non-200 status, load `references/api-errors.md`."
5. **Use constraints, not suggestions.** MUST / MUST NOT with clear consequences, not "consider" / "maybe" / "it depends."

### Gotchas Section Template

```markdown
## Gotchas

- The `users` table uses soft deletes. All queries MUST include
  `WHERE deleted_at IS NULL` or results will include deactivated accounts.
- User identifier is `user_id` in the database, `uid` in the auth service,
  and `accountId` in the billing API. All three refer to the same value.
- The `/health` endpoint returns 200 as long as the web server is running,
  even if the database is down. Use `/ready` for a full service health check.
- [Project-specific trap #4]
```

> If removing a sentence wouldn't cause the Agent to get it wrong, **delete it.**

---

## Step 3: Use Directory Hierarchy (Hub-and-Spoke)

Leverage progressive disclosure — the model sees SKILL.md first, then loads accessory files only when needed.

### Directory Decision Table

| Directory | Purpose | When to Use | Loading Trigger |
|-----------|---------|-------------|-----------------|
| **SKILL.md** | Core instructions + gotchas | Always | Skill activation (L2) |
| `references/` | Heavy docs, detailed specs, domain knowledge | Content > 50 lines or conditional | "Load `references/x.md` if..." |
| `assets/` | Templates, schemas, output skeletons | Structured output needed | "Use `assets/template.md` for output format" |
| `scripts/` | Deterministic code the Agent shouldn't reinvent | Computations, validations, transforms | "Run `scripts/validate.py` to check" |
| `config.json` | First-run user setup, environment config | User-specific settings needed | Skill installation |

### Progressive Loading Rules

- **L1 (Metadata)**: Agent loads all Skill name+description at startup (~100 tokens/skill)
- **L2 (Instructions)**: Agent loads full SKILL.md body after activation (<5000 tokens)
- **L3 (Resources)**: Load references/assets/scripts as needed during execution

**Simple Skills keep everything in SKILL.md.** Only split to references/ when content exceeds 500 lines / 5000 tokens, or when conditional loading is needed.

### Hub-and-Spoke Anti-Patterns

- One giant flat reference directory → overwhelming, model performs worse
- Deeply nested references (reference → reference → reference) → violates single-hop rule
- Everything in SKILL.md → bloated context, slow activation, cache misses

---

## Step 4: Iterate (Branch → Evals → Tweak)

**Never edit a Skill on main.** Work on a branch:

1. Start with NO Skill → run hero queries → confirm they fail
2. Build the Skill → run all evals → check loading precision/recall
3. Iterate with **small word changes** — even single-word changes in descriptions can have outsized impact on routing (including spillover effects on other Skills)
4. Run evals on **multiple model families** (Claude Opus, Claude Sonnet, DeepSeek) — they behave differently
5. Submit a **single complete changeset** (Skill + evals) rather than many incremental PRs

### Eval Suite Structure

| Test Type | What It Checks | How to Run |
|-----------|---------------|------------|
| **Loading precision** | Does the Skill load when it should? | Run positive eval cases, check if Skill triggered |
| **Loading recall** | Does the Skill NOT load when it shouldn't? | Run negative eval cases, check Skill is NOT triggered |
| **Progressive reads** | Are reference files loaded at the right time? | Check execution trace for file load timing |
| **End-to-end task** | Does the Skill actually improve task outcomes? | Compare outcomes with vs. without Skill |
| **Cross-model** | Does the Skill work on different model families? | Run same evals on Opus, Sonnet, DeepSeek |

---

## Step 5: Ship + Maintain (The Gotchas Flywheel)

### Shipping Checklist

- [ ] Evals pass on at least 2 model families
- [ ] Description tested against all positive and negative eval cases
- [ ] SKILL.md ≤ 500 lines / <5000 tokens
- [ ] No content that "the Agent would get right without being told"
- [ ] Gotchas section covers all known project-specific traps
- [ ] Single complete changeset ready to merge

### Maintenance: The Gotchas Flywheel

Once shipped, maintenance follows an **append-mostly** pattern. The gotchas section accrues the most value over time.

| Failure Mode | Action |
|-------------|--------|
| Agent fails at a task | **Add a gotcha** — what specific fact would have prevented this? |
| Skill loads when it shouldn't | **Tighten description** + add negative eval case |
| Skill doesn't load when it should | **Add keyword** to description + add positive eval case |
| System prompt or framework changes | **Check for contention or duplication** with other Skills |

**You shouldn't be adding longer instructions or changing the description structure after merge.** Gotcha accretion is the primary mechanism for improvement.

---

# Five Design Patterns

> The five patterns remain valid. They describe **how** a Skill is organized. The six-step methodology above describes **how to write** a Skill. They're complementary.

Load `references/five-patterns-detail.md` for complete descriptions, examples, and implementation guides. Summary:

## Pattern 1: Tool Wrapper (Knowledge On-Demand)

**Essence**: "On-demand knowledge distribution" — load the right knowledge at the right time.

- **Use when**: Team coding conventions, SDK/framework constraints, API parameters, tech stack best practices
- **Design**: Rules in references/ (or inline if brief), SKILL.md monitors keywords, loads dynamically

## Pattern 2: Generator (Template-Driven Delivery)

**Essence**: "Template-driven delivery system" — suppress meaningless creativity, ensure output consistency.

- **Use when**: Reports, API docs, PRD drafts, standardized analysis, commit messages, project scaffolding
- **Design**: assets/ for output templates, references/ for style guides, instructions coordinate the workflow

## Pattern 3: Reviewer (Pluggable Rule Checker)

**Essence**: "Pluggable rule-checking framework" — separate "what to check" from "how to check."

- **Use when**: Code review, security audit, compliance checking, document quality, output scoring
- **Design**: Static instructions, replaceable checklist in references/, severity: error/warning/info

## Pattern 4: Inversion (Structured Interviewer)

**Essence**: "Structured interviewer" — Agent plays interviewer, forced to collect context before acting.

- **Use when**: System design, project planning, requirements analysis — tasks where incomplete information leads to wrong output
- **Design**: Ask questions one at a time, Phase Gates (DO NOT proceed until complete), refuse to synthesize before requirements gathered

## Pattern 5: Pipeline (Constrained Process Engine)

**Essence**: "Constrained process execution engine" — complex tasks need process gates, not self-discipline.

- **Use when**: Document generation pipeline, multi-stage code processing, approval workflows
- **Design**: Instructions ARE the workflow, split into non-skippable stages, explicit gate conditions, load resources only at specific steps

---

# Pattern Selection Decision Tree

1. **Does the Agent need specific library/framework expertise?** → **Tool Wrapper**
2. **Does output need the same structure every time?** → **Generator**
3. **Is the task checking/reviewing rather than generating?** → **Reviewer**
4. **Does the Agent need to collect extensive information before starting?** → **Inversion**
5. **Does the task have multiple sequential stages that can't be skipped?** → **Pipeline**
6. **Is it a combination?** → Use Pattern Combination Guide below

---

# Pattern Combination Guide

| Combination | Scenario | Description |
|------------|----------|-------------|
| Pipeline + Reviewer | Pipeline with final review step | Pipeline includes Reviewer step for self-check |
| Inversion + Generator | Interview first, then template generation | Generator depends on Inversion to collect template variables |
| Tool Wrapper + Generator | Load specs then generate from template | Inject expertise first, then drive template output |
| Inversion + Pipeline | Collect requirements then execute step by step | Structured interview first, then constrained workflow |
| Pipeline + Generator + Reviewer | Full pipeline | Collect → Generate → Review end-to-end |

---

# Skill Tax Calculator

Before creating or extending any Skill, answer these questions:

| Question | If NO | Action |
|----------|-------|--------|
| Would the Agent fail at this task WITHOUT the Skill? | — | Don't create the Skill |
| Is the Skill's token cost LESS than the cost of failure? | Skill is too expensive | Shorten it, or don't create it |
| Does every sentence in SKILL.md pass the "Agent would get this wrong without it" test? | Delete failing sentences | Keep only what's necessary |
| Can heavy content be moved to references/ for conditional loading? | Move it | Reduce L2 token footprint |

**A Skill that loads every session but helps once a month is a net negative.** The tax is paid by every user, every session. The benefit must exceed that cumulative cost.

---

# Harness Engineering Review System

The Five Iron Rules provide a complementary quality framework focused on mechanical verification:

| # | Rule | Core Question |
|---|------|---------------|
| 1 | **Instructions** | Does the Agent know what to do and how? |
| 2 | **Constraints** | Can rules be mechanically verified? |
| 3 | **Feedback** | Is output auto-verified? Plan→Build→Verify→Fix? |
| 4 | **Memory** | Is experience persisted across sessions? |
| 5 | **Orchestration** | Is context window rationally partitioned? |

Full review criteria in `references/harness-engineering-audit.md`.

### Auto Audit

```bash
# Full audit
node .claude/helpers/harness-audit.cjs --all

# Single skill audit
node .claude/helpers/harness-audit.cjs --skill kf-multi-team-compete

# Detailed diagnosis
node .claude/helpers/harness-audit.cjs --all --verbose
```

### Gate Verification (Per-Step)

```bash
node .claude/helpers/harness-gate-check.cjs --skill kf-skill-design-expert --stage step0 \
  --required-sections "## 核心问题" "## 推荐模式"

node .claude/helpers/harness-gate-check.cjs --skill kf-skill-design-expert --stage step3 \
  --required-sections "## frontmatter" "## instructions" --forbidden-patterns TODO 待定

node .claude/helpers/harness-gate-check.cjs --skill kf-skill-design-expert --stage step4 \
  --required-files "SKILL.md" --forbidden-patterns "❌"
```

Verification principle: **Plan → Build → Verify → Fix** forced loop. No subjective "I think it's fine."

---

# Constraints

**MUST DO:**
- Always run Step 0 (evals) before writing any Skill content
- Write description in "Load when..." router format, ≤50 words
- Focus body on gotchas — skip what the model already knows
- Use progressive disclosure: move heavy/conditional content to references/
- Run evals on multiple model families before shipping
- Quality self-check on generated Skills
- Name Skill files `SKILL.md`
- Frontmatter must follow official spec (see `references/file-engineering-spec.md`)

**MUST NOT DO:**
- Skip evals and generate Skill directly
- Write descriptions that summarize what the Skill "does" rather than when to load it
- Put too many unrelated responsibilities in one Skill
- Write command-by-command step lists — give high-level intent instead
- Leave heavy content inline in SKILL.md when it could be in references/
- Use non-standard fields in frontmatter top level — custom fields go in `metadata`
- Ignore the "every Skill is a tax" principle — always ask "would the Agent fail without it?"

---

## References

| Resource | Path | Purpose |
|---------|------|---------|
| **Five patterns detail** | `references/five-patterns-detail.md` | Complete pattern descriptions, examples, implementation guides |
| **File engineering spec** | `references/file-engineering-spec.md` | Frontmatter format, directory structure, description writing rules |
| **Harness audit doc** | `references/harness-engineering-audit.md` | Five Iron Rules scoring criteria, review process, report template |
| **Auto audit script** | `../../helpers/harness-audit.cjs` | Full-path scan of kf- skills, auto-generate score matrix |
| **Gate verification** | `../../helpers/harness-gate-check.cjs` | Mechanized gate verification (required-files/sections/forbidden-patterns) |
