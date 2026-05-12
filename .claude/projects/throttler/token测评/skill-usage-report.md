# kf-skill-monitor Report

> Generated: 2026-05-05T16:55:20 | Task: hammer-20260505-0055

## Overview

| Metric | Value |
|---|---|
| Task | hammer-20260505-0055 |
| Start | 2026-05-05T16:55:19.924Z |
| End | 2026-05-05T16:55:20.095Z |
| Duration | 1 min |
| Agents | 3 |
| Teams | red / blue / green |
| Skills used | 1 / 95 installed |
| Calls | 3 |
| Success Rate | 67% |

## Token Usage

| Metric | Value |
|---|---|
| Total Input Tokens | 120,000 |
| Total Output Tokens | 23,500 |
| Cache Hit Tokens | 0 |
| Cache Hit Rate | 0.0% |
| Effective Input (uncached) | 120,000 |

## Skill Type Breakdown

| Type | Calls | Unique Skills | Input Tok | Output Tok | Cache Hit |
|---|---|---|---|---|---|
| other | 3 | 1 | 120,000 | 23,500 | 0 |

## Skill Coverage

- **kf-custom skills**: 22 installed, 0 called
- **General skills**: 73 installed, 0 called
- **Uncalled skills**: 94 (not used in this task)

## Call Chain Tree

```
/hang (hammer-20260505-0055, 2026-05-05T16:55:19)
|-- R red-team
|       ... directory-scan [???] [pro] OK 40000/14000 (/夯 round2: read .claude/ dir tree, wrote architecture.md 14KB)
|-- B blue-team
|       ... directory-scan [???] [pro] FAIL 50000/5000 (/夯 round2: deep-read helpers+skills, no output)
... G green-team
        ... directory-scan [???] [pro] OK 30000/4500 (/夯 round2: quick scan, architecture.md 4.5KB)
```

## Skill Frequency

| Skill | Type | Calls | Agents | OK | Fail | Input Tok | Output Tok | Cache Hit | Cache% |
|---|---|---|---|---|---|---|---|---|---|
| directory-scan | other | 3 | 3 | 2 | 1 | 120,000 | 23,500 | 0 | 0.0% |

## Agent x Skill Matrix

| Agent | Skills (count) |
|---|---|
| red-team | directory-scan(1) |
| blue-team | directory-scan(1) |
| green-team | directory-scan(1) |

## Token Savings

| Mechanism | Tokens Saved | Cache Hit | Note |
|---|---|---|---|
| lean-ctx | 0 | 0 | checkpoint/ctx_read |
| model-router | 0 | — | pro->flash auto |
| ccp skip | 0 | — | skip unnecessary spawn |
| lambda-lang | 0 | — | 3x agent comm |
| **Total** | **0** | | |

## Full Log

| Time | Agent | Skill | Type | Result | Phase | Model | In Tok | Out Tok | Cache | Note |
|---|---|---|---|---|---|---|---|---|---|---|
| 16:55:19 | red-team | directory-scan | other | OK |  | pro | 40000 | 14000 | 0 | /夯 round2: read .claude/ dir tree, wrote architecture.md 14KB |
| 16:55:20 | blue-team | directory-scan | other | FAIL |  | pro | 50000 | 5000 | 0 | /夯 round2: deep-read helpers+skills, no output |
| 16:55:20 | green-team | directory-scan | other | OK |  | pro | 30000 | 4500 | 0 | /夯 round2: quick scan, architecture.md 4.5KB |
