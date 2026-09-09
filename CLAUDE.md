# QCET E-Office - Claude Code Guidelines

@AGENTS.md

## Scoped Domain Rules
Detailed, path-specific rules are loaded automatically from `.claude/rules/*.md`.
Do not import heavy architecture or domain documents directly into global instructions.

## Operating Principles
- **Inspect Canonical Architecture First**: Check `ARCHITECTURE.md` and `docs/` before authoring new abstractions.
- **Inspect Existing Implementations**: Reuse existing canonical components; never add secondary parallel engines.
- **Plan Before Editing**: Formulate an explicit plan before modifying multi-file subsystems.
- **Verify Before Completion**: Run `npm run typecheck` and `npm test`, confirming outputs before claiming completion.
- **Use Skills for Procedures**: Execute standard checklists and database procedures via `.claude/skills/`.
- **Use Subagents for Audits**: Dispatch specialized reviewer agents for broad reviews to maintain lean context.
