# AutoCoding - Complete User Manual

> **Version**: v1.3
>
> This manual is for users to read and understand AutoCoding's complete features and usage methods.
> To let AI auto-install, please read [INSTALL.md](INSTALL.md)

---

## 一、Framework Features

### One-Line Positioning

**AutoCoding** — Let AI autonomously drive the entire programming process, from environment setup to code delivery, with zero manual intervention.

### Core Features

| # | Feature | Description |
|---|---------|-------------|
| 1 | **Claude Autopilot** | Claude Code + Yolo mode, AI autonomous decision-making without frequent confirmations |
| 2 | **gspowers SOP Navigation** | Industry consensus skill rules framework, standardized development process |
| 3 | **ruflo Multi-Agent Parallel** | Session memory integration, multi-agent parallel/relay execution |
| 4 | **RTK Token Saving** | Save 60-90% Token consumption, significantly reducing costs |
| 5 | **markitdown Universal Read** | Markdown/HTML/document conversion, any format can be processed |
| 6 | **TDD Test-First** | Mandatory test-first mode, guaranteed quality |
| 7 | **Universal Triple Collaboration** | Shop around, multi-angle review, more comprehensive decisions |
| 8 | **Pipeline Assembly Line** | Complex tasks split into modules and steps, automatic dependency orchestration, batch verification |

### Detailed Description

#### 1. Claude Autopilot

```
Traditional mode: User → Confirm → Execute → Confirm → ...
Autopilot mode: User → AI autonomously completes → Reports result
```

After enabling Yolo mode in Claude Code, AI can:
- Automatically execute file operations, terminal commands
- Automatically handle popups, exceptions, interrupts
- Resolve issues independently without interruption

#### 2. gspowers SOP Navigation

gspowers is an industry consensus skill rules framework providing standardized development process:

```
/gspowers → /office-hours → /plan-eng-review → /brainstorm → /subagent-dev → /review → /ship
```

Each step has clear deliverables and acceptance criteria.

#### 3. ruflo Multi-Agent Parallel

ruflo integrates session memory and supports multiple agents in parallel/relay mode:

- **Parallel**: Same task, multiple agents executing simultaneously from different angles
- **Relay**: Previous agent output becomes next agent input
- **Memory**: Cross-session memory, no knowledge loss

#### 4. RTK Token Saving

RTK (Rust Token Killer) saves 60-90% Token by filtering and compressing command output:

| Operation | Normal Consumption | RTK Consumption | Savings |
|-----------|-------------------|------------------|---------|
| `ls` / `tree` | 2,000 | 400 | -80% |
| `git status` | 3,000 | 600 | -80% |
| `npm test` | 25,000 | 2,500 | -90% |

#### 5. markitdown Universal Read

markitdown enables Markdown/HTML/document conversion:

- Markdown → HTML (GitHub style)
- Code highlighting, GFM table support
- Any document format convertable to AI-readable format

#### 6. TDD Test-First

gspowers TDD extension enforces test-first mode:

```
RED → GREEN → REFACTOR

1. Write test first (RED)
2. Write implementation to pass test (GREEN)
3. Refactor and optimize (REFACTOR)
```

#### 7. Universal Triple Collaboration

ruflo's `triple` mechanism supports multi-angle parallel review:

```
triple Security Audit
├── Agent-A: Code security scan
├── Agent-B: Dependency vulnerability check
└── Agent-C: Configuration risk assessment
```

#### 8. Pipeline Assembly Line

gspowers Pipeline extension supports multi-module dependency assembly line:

```
Scenario: E-commerce system
├── User Service (no dependencies)
├── Product Service (depends on User Service)
├── Order Service (depends on User Service + Product Service)
└── Payment Service (depends on Order Service)

Pipeline automatically:
1. Batch 1: User Service
2. Gate verification passed
3. Batch 2: Product Service
...and so on
```

### Quick Triggers

| Trigger | Function |
|---------|----------|
| `/gspowers` | Start SOP process navigation |
| `/pipeline-dev` | Multi-module assembly line development |
| `安全审计` (Security Audit) | Multi-agent security scan |
| `triple [task]` | Universal triple collaboration |
| `TDD` | Enable test-first mode |
| `允许 AI 自动扩充技能` (Allow AI to expand skills) | Authorize AI to extend functionality |

---

## 二、Core Principle: Self-Healing Control

When AI executes tasks and encounters missing tools, page changes, or exceptions, **do not interrupt**, instead:

```
1. Missing tool → AI directly writes/edits tool scripts to continue running
2. Page changed → AI re-runs snapshot -i to recognize new elements
3. Popup/exception → AI automatically dialog-accept/handle
4. Failure doesn't interrupt → Analyze reason, fix and continue
```

**Traditional Automation** vs **Self-Healing Control**:

| Traditional Automation | Self-Healing Control |
|----------------------|---------------------|
| Crashes when page changes | AI dynamically adapts, continues running |
| High maintenance cost | AI autonomously fixes without human intervention |
| Frequent human intervention | Agent autonomously makes decisions |

**Key Change**: From "command-driven" to "goal-driven". AI remembers the goal, resolves obstacles independently, doesn't wait for human input.

---

## 三、New Project Usage Process

> Each new project only needs to be initialized once

### Execute in New Project Directory

```powershell
cd D:\your-new-project

# Initialize ruflo (once per new project)
ruflo init --minimal --skip-claude

# Open Claude Code
claude
```

### Verify Memory Sharing

Test in Claude Code:

```
> Security Audit
> Architecture Review
> /gspowers
> triple [any task]
```

---

## 四、Feature Triggers Quick Reference

| Trigger | Function | Source |
|---------|----------|--------|
| `安全审计` (Security Audit) | Multi-agent security vulnerability scan + triple confrontation | ruflo |
| `架构评审` (Architecture Review) | Multi-agent system architecture evaluation + triple confrontation | ruflo |
| `QA团队` / `测试评审` (QA Team/Test Review) | Multi-agent test quality review + triple confrontation | ruflo |
| `三方调研` / `research` | Multi-agent general research task | ruflo |
| `triple [task]` | Universal triple collaboration (any task) | ruflo |
| `/gspowers` | Start SOP process navigation | gspowers |
| `/office-hours` | YC-style product拷问 | gspowers |
| `/brainstorm` | Socratic design refinement | gspowers |
| `/subagent-dev` | Sub-agent TDD development | gspowers |
| `/review` | Code review | gspowers |
| `/qa` | Browser QA | gspowers |
| `/ship` | Publish PR | gspowers |

---

## 五、Memory Sharing Explanation

### 5.1 Memory Hierarchy

```
Global Memory (~/.claude-flow/data/)
    ↓
Project-Level Memory (.claude-flow/data/)
    ↓
Agent Sharing (agents within the same project share memory)
```

### 5.2 Agent Memory Sharing Within Same Project

When `agentScopes.defaultScope: project`, all agents started in the same project share that project's memory context. Memory is isolated between different projects, avoiding bloated global memory.

---

## 六、Directory Structure

```
~$USERPROFILE/
├── .claude/
│   ├── skills/
│   │   ├── gstack/              # GStack (Product Flow Framework)
│   │   └── gspowers/           # gspowers (SOP Navigation)
│   └── settings.json
├── .claude-flow/                 # ruflo Global Configuration
│   ├── config.yaml             # Global configuration (memory path, agent config)
│   └── data/                    # Global memory storage (cross-project sharing)
```

---

## 七、Quick Reference

```powershell
# Post-installation verification
claude-flow --version          # ruflo version
claude mcp list                  # MCP tool list (should include ruflo)
git --version                   # Git version
node --version                  # Node.js version

# New project initialization
cd D:\project
ruflo init --minimal --skip-claude

# Start Claude Code
claude

# Common triggers
安全审计 (Security Audit)              # ruflo triple collaboration
架构评审 (Architecture Review)          # ruflo triple collaboration
/gspowers                        # gspowers SOP
/triple [task]                   # Universal triple collaboration
```

---

## 八、Version Compatibility

| Tool | Recommended Version | Compatibility Notes |
|------|---------------------|--------------------|
| Claude Code | Latest | Main interface |
| ruflo | v3.x | Multi-agent + memory |
| gstack | Latest | Product flow |
| gspowers | Latest | SOP navigation |
| superpowers | Latest | Development execution |

> This manual is designed for long-term use. The core mechanism is the collaboration between Claude Code + ruflo, and the collaboration logic remains unchanged regardless of tool version updates.

---

## 九、Troubleshooting

### Issue: A tool cannot be detected

```powershell
# Refresh environment variables
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Manual refresh
refreshenv 2>$null || Write-Host "Please reopen terminal"
```

### Issue: ruflo MCP not working

```powershell
# Restart MCP
claude mcp remove ruflo
claude mcp add ruflo -- npx -y ruflo@latest mcp start

# Check status
claude mcp list
```

### Issue: gspowers not found

```powershell
# Check directory
Get-ChildItem "$env:USERPROFILE\.claude\skills" -Directory
```

---

## 十、TDD Test-First Mode

### 10.1 What is TDD

TDD (Test-Driven Development) test-first development:

```
RED → GREEN → REFACTOR

1. Write test first (RED) - Test will fail because code isn't written yet
2. Write implementation to pass test (GREEN) - Write simplest code to pass
3. Refactor and optimize (REFACTOR) - Optimize code while ensuring tests still pass
```

### 10.2 TDD Triggers

| Trigger | AI Behavior |
|---------|-------------|
| `TDD` | Enable TDD mode, all development follows test-first |
| `遵循 TDD` (Follow TDD) | Same |
| `测试先行` (Test First) | Same |
| `关闭 TDD` (Turn Off TDD) | Restore normal development mode |

### 10.3 TDD Effect

```
You: "Implement user registration feature, following TDD"
    ↓
AI:
  1. Write test: UserRegister.test.ts
  2. Run test → Fail (RED)
  3. Write implementation: UserRegister.ts
  4. Run test → Pass (GREEN)
  5. Refactor and optimize
  6. Prompt you: "✅ TDD complete, coverage 95%, submit?"
```

---

## 十一、Pipeline Multi-Module Assembly Line

### 11.1 What is Pipeline Mode

When a project contains **multiple modules with dependencies**, Pipeline mode automatically handles:

1. Analyze module dependency topology
2. Execute in batch order (dependent modules must complete first before modules that depend on them)
3. Gate verification between batches (only proceed if verified)
4. Status tracking and breakpoint recovery

### 11.2 Typical Scenario

```
Scenario: E-commerce system
├── User Service (no dependencies)
├── Product Service (depends on User Service)
├── Order Service (depends on User Service + Product Service)
└── Payment Service (depends on Order Service)

Pipeline automatically:
Batch 1: User Service → Gate verification passed
Batch 2: Product Service → Gate verification passed
Batch 3: Order Service → Gate verification passed
Batch 4: Payment Service → Complete
```

### 11.3 Trigger Methods

```
/pipeline-dev
多模块开发 (Multi-module development)
流水线开发 (Assembly line development)
```

---

## 十二、AI Automated Skill Expansion

### 12.1 What is Skill Expansion

When the user authorizes "Allow AI to automatically expand skills", AI can automatically extend functionality.

### 12.2 Trigger Condition

```
User says "允许 AI 自动扩充技能" (Allow AI to automatically expand skills) or similar expression
```

### 12.3 Expanded Functions

| Trigger | AI Action |
|---------|-----------|
| `TDD` | Enable TDD development mode (test-first) |
| `生成 Wiki` (Generate Wiki) | Compress context, generate project Wiki |
| `遵循 TDD + feature name` | TDD mode implement feature |
| `关闭 TDD` (Turn Off TDD) | Restore normal development mode |

---

## 十三、Security Level Description

| Level | Applicable Scenario | Risk Level | Description |
|-------|---------------------|------------|-------------|
| **L1 Observation Mode** | New project/unfamiliar code | Low | allowPermissions=false, confirm each item |
| **L2 Development Mode** | Daily development/debugging | Medium | allowPermissions=true, sensitive operations need confirmation |
| **L3 Yolo Mode** | Rapid prototyping/experimental projects | High | allowPermissions=true, all auto-approve |
| **L4 Controlled Yolo** | Trusted codebase + CI/CD | Medium | allowPermissions=true + audit log |

---

## 十四、Document Index

| Document | Description |
|----------|-------------|
| [README.md](README.md) | Project introduction (GitHub homepage) |
| [MANUAL.md](MANUAL.md) | Complete user manual (you are here) |
| [INSTALL.md](INSTALL.md) | AI execution installation guide |
| [CHANGELOG.md](CHANGELOG.md) | Version change log |
| [FEATURES.md](FEATURES.md) | Framework features introduction |
