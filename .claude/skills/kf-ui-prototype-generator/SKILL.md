---
name: kf-ui-prototype-generator
description: >-
  Load when user wants to generate zero-dependency HTML UI prototypes from PRD
  documents with embedded 暗门注释 (7-layer business annotation system with L0-L6
  tab navigation in a resizable drawer). Triggers: "生成原型", "UI原型", "页面原型",
  "HTML原型", "prototype", "原型生成", "暗门注释", "页面 mockup".
metadata:
  pattern: generator + pipeline
  domain: ui-prototype
integrated-skills:
  - kf-alignment
recommended_model: flash
graph:
  dependencies:
    - target: kf-alignment
      type: workflow
---

# UI Prototype Generator — Annotation-Driven HTML Prototypes

> Zero external dependencies. One clean design system. Every prototype embeds a 7-layer annotation drawer with L0-L6 tab navigation — developers and testers have zero remaining questions.

Generate high-fidelity HTML prototypes from PRD documents. Every generated HTML ships with a **built-in annotation drawer** — Ctrl+B to toggle a resizable right-side panel with L0-L6 tabbed annotations.

---

## Architecture Overview

```
Phase 0: Intake          Phase 1: Build            Phase 1.5: Annotate    Phase 2: Verify
─────────────────────     ──────────────────────   ────────────────────   ─────────────────
Collect Inputs       →    CSS Variable Injection    Load Annotation Spec   Self-Check
Project Detect            HTML Skeleton + CSS       Generate 7-Layer Ann.  Quality Review
PRD Parse                 Interaction Layer         Embed Tab Drawer UI    Harness Gate
Component Decision        Responsive Breakpoints    Wire Badge Anchors     Auto-Repair
    │                             │                       │                       │
    └───── Gate 1 ───────────────┴────── Gate 1.5 ────────┴────── Gate 2 ─────────┘
```

---

## Phase 0 — Intake

### Step 0.1 — Collect Required Inputs

| Parameter | Required | Description |
|-----------|----------|-------------|
| PRD document | Yes | Reference via `@file` |
| Prototype mode | optional | **Single-page** (default) or **Multi-page** |
| Dev scenario | optional | **New project** (default) or **Iteration** |
| Page name | Yes | Target page name |
| Page list | optional | Multi-page only. Auto-detect from PRD if omitted |
| Output path | optional | Relative to workspace root, e.g. `prototypes/` |
| Page type | optional | List / Form / Detail / Dashboard / Composite |
| Device target | optional | **web** (default) or **mobile** |

### Step 0.2 — Project Context Detection

1. Search for page-level component files (`.vue`, `.tsx`, `.jsx`, etc.)
2. Reference framework config files (`vite.config.*`, `next.config.*`)
3. Identify route configuration files for page directory locations

- **Detected** → Context-Aware Mode: generate based on existing page style
- **Not detected** → Ask: "No project page directory detected. Is this for an actual project?"
  - User provides directory → Context-Aware Mode
  - User says "standalone" → Standalone Mode

### Step 0.3 — Parse PRD

**Context-Aware Mode:** Scan project page directory — if page exists, renovation mode (only modify what PRD changes). If new page, scan similar pages for layout conventions.

**Standalone Mode:** Generate from default template.

### Step 0.4 — Component Decision Matrix

Match PRD semantics to HTML components:

| Intent \ Data Shape | Single Value | List / Array | Hierarchical | Rich Content |
|---------------------|-------------|--------------|--------------|--------------|
| Input / Create | Input / Select / DatePicker | Checkbox.Group / Transfer | TreeSelect / Cascader | Editor / Upload |
| Display / Read | Text / Badge / Tag | Table / List / Card.Grid | Tree / Collapse | Descriptions / Card |
| Action / Trigger | Button / Link | Dropdown.Button | Menu | Modal.confirm / Drawer |
| Filter / Query | Input.Search / Select | DatePicker.RangePicker | TreeSelect | — |
| Navigate | Breadcrumb | Tabs / Steps | Menu / Pagination | Layout / Space |
| Feedback | Tooltip / Popover | — | — | Modal / Drawer / Alert |

Map to semantic CSS classes: `.ui-table`, `.ui-btn`, `.ui-card`, `.ui-modal`, `.ui-form`, `.ui-input`, `.ui-select`, `.ui-tag`, `.ui-badge`, `.ui-menu`, `.ui-tabs`, `.ui-breadcrumb`, `.ui-pagination`, `.ui-alert`.

### Gate 1

> Do not enter Phase 1 until all required parameters collected, project context detected, and PRD parsed.

---

## Phase 1 — Build

### Step 1.1 — CSS Variable Injection

Copy the `:root {}` block from `references/css-variables.md` into every `<style>` block. All components reference only `var(--primary)`, `var(--text)`, etc. — no hardcoded colors.

### Step 1.2 — Generate HTML Skeleton

Structure:
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{page_title}}</title>
  <style>
    /* Layer 1: CSS Variables — from references/css-variables.md */
    /* Layer 2: Skeleton CSS — from references/skeleton-css.md */
    /* Layer 3: Responsive breakpoints */
    /* Layer 4: Annotation Drawer — from references/anno-drawer-template.md */
  </style>
</head>
<body>
  {{page_content}}
  {{annotation_drawer}}
</body>
</html>
```

#### Generation Rules

**Responsive strategy** (device-aware):
- **web target**: Desktop-first. Sidebar ≥992px, collapses <768px. Tables full columns on desktop, card view on mobile.
- **mobile target**: Mobile-first. Bottom tab nav. Full-width cards. Touch targets ≥44px. Single-column layouts.

**Real data (no empty tables):**
- 5-8 rows of realistic demo data with varied states (normal, disabled, pending, at least 3 tag colors)
- Timestamps with realistic dates, not "2024-01-01"
- Pre-fill search fields with example values
- Empty state only shown via toggle, not default

**All buttons must be functional:**
- Every button triggers a modal, navigation, toggle, or submission
- Table action buttons (view/edit/delete) each open distinct modals
- Buttons with no defined action: create confirmation modal "This feature is not yet implemented"

**Four mandatory state views:**
1. Data state (default) — real content
2. Empty state — `.ui-empty` with guidance, triggerable via checkbox
3. Loading state — skeleton shimmer animation, triggerable via checkbox
4. Error state — error alert + retry button, triggerable via checkbox

**Iteration scenario:** Only modify what PRD explicitly changes. Preserve unchanged areas. Annotate: `<!-- [新增] -->` / `<!-- [变更] -->`.

**Multi-page mode:** Create directory by menu module. Generate `shared.css` first. Output sidebar HTML once. `index.html` = lightweight shell only. Inter-page links via `<a href>`.

### Step 1.3 — Interaction Simulation (CSS-Only)

Use CSS checkbox/radio hacks for all interactions (except annotation drawer JS). Full patterns in `references/interaction-patterns.md`.

Quick reference:
| Interaction | Technique |
|-------------|-----------|
| Modal | `input[type=checkbox]:checked ~ .modal-overlay { display: flex; }` |
| Tabs | `input[type=radio]:checked ~ .tab-panel-n { display: block; }` |
| Alert dismiss | Checkbox + `:checked + .ui-alert { display: none; }` |

### Step 1.5 — Source Traceability

Add inline comments:
- `<!-- PRD: 4.1 -->` — maps to PRD sections
- `<!-- [新增] -->` / `<!-- [变更] -->` — iteration markers
- `<!-- TODO: 确认筛选条件枚举值 -->` — unresolved decisions

---

## Phase 1.5 — Annotation Injection (暗门注释)

### Step 1.5.1 — Load Annotation Spec

Load `references/annotation-spec.md` for the 7-layer structure and 6-type business annotation templates (enhanced L0-L6).

### Step 1.5.1a — Load Annotation Templates

Load `references/annotation-templates.md` for standard fillable templates covering all 6 required annotation types:
- **L0**: Business description (CRUD matrix + data permissions + entity relationships)
- **L1-a**: Search/query field dictionary (4 attributes per field)
- **L1-b**: List column dictionary (4 attributes per column)
- **L1-c**: Create form field dictionary (5 attributes per field, incl. boundary values)
- **L1-d**: Edit form field dictionary (6 attributes incl. diff-from-create)
- **L6**: Exception handling table + boundary value definition table

Load `references/annotation-example.md` as a reference for expected output quality.

### Step 1.5.1b — 6-Type Annotation Completeness Check

Before generating annotations, MUST verify the PRD covers all 6 types. If any type's data is missing from the PRD, mark with `<!-- ⚠️ [MISSING: {type}] -->` and use sensible defaults.

### Step 1.5.2 — Generate Annotation Content

Per page-type layer mapping (see annotation-spec.md for the full 6-type customization strategy):

| Page Type | Core Layers | Optional |
|-----------|-------------|----------|
| **List** | L0, L1(search+table), L2, L4, L6 | L3(slim), L5 |
| **Form** | L0, L1(all fields+cascade+validation), L2, L4, L6 | L3(—), L5(—) |
| **Detail** | L0, L1, L2, L3(full), L4, L6 | L5 |
| **Dashboard** | L0, L1(metrics), L2, L4, L6 | L3(—), L5 |
| **Composite** | All 7 layers, content tabbed by region | — |

Missing layers MUST still have empty `anno-tab-content` containers (prevents JS errors). Use placeholder text: "本页面无状态机相关注释（{{页面类型}}不涉及实体状态流转）".

All example data MUST be fictional and marked `(示例)`. No PII, credentials, or internal IPs.

### Step 1.5.3 — Wire Annotation Badges

```html
<span class="annotation-badge" data-anno-ref="1">1</span>
```

Parent elements with badges MUST have class `has-annotation` (for `position: relative`).

### Step 1.5.4 — Embed Drawer Component

Load the complete drawer HTML/CSS/JS from `references/anno-drawer-template.md`. All 7 tab containers (`anno-tab-l0` through `anno-tab-l6`) must be present even if some layers are empty.

### Gate 1.5

> Do not enter Phase 2 until annotation content generated for all required layers and drawer component embedded.

---

## Phase 2 — Verify

### Step 2.1 — Self-Check

- [ ] Opens in browser without errors (no CDN, no broken references)
- [ ] CSS variables used everywhere (no hardcoded colors)
- [ ] All buttons trigger actions — no dead buttons
- [ ] Four state views present and triggerable
- [ ] 5-8 rows realistic data with varied statuses
- [ ] Annotation drawer: Ctrl+B toggles, Escape closes, resizable
- [ ] L0-L6 tabs present and switching correctly
- [ ] Badges hidden when drawer closed, visible when open
- [ ] No real PII/credentials in annotation examples

### Step 2.2 — Quality Review

Two-dimensional review:
- **Component Correctness**: Components match PRD semantics, `.ui-*` naming
- **Requirement Consistency**: All PRD fields present, actions complete, states correct
- **Annotation Quality**: All required layers present, every BR maps to test scenario, enum values complete
- **Safety**: No real data in examples, path safety rules followed

### Gate 2

> Do not deliver until self-check and quality review both pass. Fix all `[❌]` items.

---

## Gotchas

-  Annotation drawer tab content panels MUST have `id` matching the `data-tab` attribute exactly, or tab switching JS silently fails
-  Mobile preview uses `m-anno-tab-l*` ID prefix to avoid collision with desktop's `anno-tab-l*` — forgetting this creates duplicate IDs and broken tab switching
-  Empty annotation layers still need `<div class="anno-tab-content" id="anno-tab-lN">` containers, or `getElementById` returns null and the tab JS breaks
-  CSS radio-hack tabs CANNOT be used for the annotation drawer because the input elements are in a different DOM branch from the content panels (sibling selector `~` won't reach)
-  Badge visibility depends on `.annotations-visible` class on `<html>` — forgetting to add `.has-annotation` + `position: relative` to badge parents makes badges position incorrectly
-  The resize handle relies on `--anno-drawer-width` CSS variable on the drawer element — if set elsewhere it gets overwritten
-  `shared.css` path differs by page depth level: `../shared.css` for pages one level deep, `../../shared.css` for two levels — get this wrong and the entire page is unstyled
-  In multi-page mode, the sidebar HTML must be identical across all pages except the `active` class on the current menu item — any divergence causes visual jump during navigation
-  Checkbox hack for modals requires the `<input>` to be a preceding sibling of `.ui-modal-overlay` — placing it inside the overlay breaks the `:checked +` selector
-  The four-state toggle (data/empty/loading/error) uses radio inputs with the same `name` attribute — using different names makes all states show simultaneously

---

## Reference Files

| File | Content | Load When |
|------|---------|-----------|
| `references/annotation-spec.md` | 7-layer annotation specification, 6-type business annotation templates, per-page-type strategy, quality checklist | Phase 1.5 always |
| `references/annotation-templates.md` | Standard fillable templates for all 6 annotation types (L0-L6) | Phase 1.5 for template-based generation |
| `references/annotation-example.md` | Complete annotation example using Enterprise Management scenario | Phase 1.5 as reference for expected output quality |
| `references/anno-drawer-template.md` | Complete drawer HTML/CSS/JS template (desktop + mobile) | Phase 1.5 for drawer embedding |
| `references/css-variables.md` | Full `:root {}` CSS variable block | Phase 1.1 always |
| `references/skeleton-css.md` | Responsive skeleton CSS (reset, layout, components, utilities) | Phase 1.2 always |
| `references/interaction-patterns.md` | CSS-only interaction patterns (modal, tabs, alert dismiss) | Phase 1.3 when implementing interactions |
| `references/multi-page-structure.md` | Directory structure and rules for multi-page mode | Phase 1.2 only when mode=multi-page |
| `references/evals.md` | Positive/negative evaluation cases for this Skill | Step 0 (quality verification) |

---

## Iron Rules

1. **Self-contained**: Zero external dependencies, no CDN, no external assets
2. **CSS variables, never hardcode**: Hex values only inside `:root {}`
3. **Responsive**: Mobile-first, `min-width` breakpoints. Web and mobile layouts differ.
4. **CSS-only interactions**: Checkbox/radio hacks — JS only for annotation drawer
5. **Annotation drawer mandatory**: Every prototype includes annotation drawer (web) or mobile preview (mobile) with L0-L6 tabs
6. **Single file ≤ 800 lines**: Split for multi-page mode
7. **Context detection mandatory**: Never default to standalone without asking
8. **Multi-page shared CSS single source**: `shared.css` first, referenced by all pages
9. **Quality review mandatory**: Generate and output review report
10. **Stop after 2 unresolved rendering issues**: Report to user
11. **Iteration preserves existing**: Only modify what PRD explicitly changes
12. **Validate or default**: Invalid params default with `<!-- ⚠️ [PARAM] -->` annotation
13. **Path safety**: Never write outside workspace, never overwrite without confirmation
14. **Fail with annotation**: Every failure → `<!-- ⚠️ -->` or `<!-- 🚨 -->` annotation
15. **All states required**: Data / Empty / Loading / Error triggerable via checkbox
16. **No real data in examples**: All annotation examples fictional with `(示例)` prefix

---

## Safety & Security (Green Team Supplement)

### Parameter Validation

| Parameter | Allowed | Default | Invalid Action |
|-----------|---------|---------|----------------|
| Prototype mode | `single-page`, `multi-page` | `single-page` | Log, use default, annotate |
| Dev scenario | `new-project`, `iteration` | `new-project` | Same |
| Page name | Non-empty, no `/` `\` `:` `*` `?` `"` `<` `>` `\|`, ≤255 chars | MUST provide | Reject, after 3: use "untitled-page" |
| Page type | `list`, `form`, `detail`, `dashboard`, `composite` | Auto-detect→`list` | Auto-detect, then default |
| Device target | `web`, `mobile` | `web` | Same |

### Path Safety Rules

1. Resolve to absolute path from workspace root
2. Reject paths that escape workspace (e.g., `../../../etc`)
3. Confirm before overwriting existing files
4. Reject reserved Windows names: CON, PRN, AUX, NUL, COM1-9, LPT1-9
5. Max 5 directory levels deep
6. Ensure `.html` extension

### Failure Handling

| Level | Condition | Action |
|-------|-----------|--------|
| **Info** | Non-critical style dimension missing | Auto-detect, annotate: `<!-- ⚡ [AUTO] -->` |
| **Warning** | Invalid param, path conflict | Use fallback, annotate: `<!-- ⚠️ [WARN] -->` |
| **Error** | Required file unreadable, disk full | Ask user. After 2 prompts, use fallback, annotate: `<!-- 🚨 [ERROR] -->` |
| **Critical** | All data sources unavailable | Report failure. Do NOT generate empty output. After 2 criticals, stop. |
