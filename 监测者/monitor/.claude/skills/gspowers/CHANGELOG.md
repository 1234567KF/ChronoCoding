# Changelog

All notable changes to gspowers will be documented in this file.

## [1.1.0.0] - 2026-04-02

### Added
- Knowledge compounding loop: compound step after /ship captures development learnings to `docs/solutions/`
- Pre-brainstorming knowledge search: automatically searches `docs/solutions/` for relevant past experiences before brainstorming
- Simplified init for existing projects: natural language description auto-generates `Update_Plan.md` instead of manual template
- `/ce:compound` and `/ce:compound-refresh` entries in tools guide
- Knowledge compounding section in SOP documentation
- v1.1 design spec and implementation plan

### Changed
- Step mapping: `ship → compound → document-release` (was `ship → document-release`)
- Flow map: added `/ce:compound (optional)` between /ship and /document-release
- state.json version bumped to "1.1" for new projects
- Existing project init flow detects pre-existing `Update_Plan.md` instead of always prompting
- Agent dispatch failure in knowledge search now shows distinct error message (not silent degradation)
- Compound step includes explicit "skip" option for quick bypass
