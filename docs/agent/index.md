# QCET E-Office Agent Architecture & Navigation Index

This document serves as the master navigation map and reference manual for all agent configurations, scoped rules, skills, hooks, and architectural specifications in QCET E-Office.

It is maintained as a human-readable index and is not auto-loaded into agent startup context.

---

## 1. System Architecture Overview

The QCET E-Office agent system is engineered with strict context-efficiency principles:

1. **Minimal Global Startup Context**:
   - `CLAUDE.md` (<= 25 lines): Lightweight entry point referencing `AGENTS.md` and directing workflows.
   - `AGENTS.md` (<= 60 lines): Foundational universal invariants applicable across all environments.
   - `.claude/rules/00-core.md` (<= 20 lines): The single unconditional global rule.
2. **Path-Scoped Domain Rules**:
   - Specific rule files in `.claude/rules/*.md` load only when matching paths are read or modified.
   - Rules are strictly budgeted (<= 30 lines per file) and define non-negotiable boundaries.
3. **Dual Compatibility**:
   - Anthropic Claude Code utilizes `.claude/rules/*.md` and `.claude/agents/*.md`.
   - OpenAI Codex utilizes directory-scoped `AGENTS.md` files placed directly in subsystem folders.
4. **Separation of Concerns**:
   - Architectural facts reside in `docs/architecture/` and `docs/product/`.
   - Repeatable multi-step procedures reside in `.claude/skills/`.
   - Hard safety constraints reside in `.claude/settings.json` and `.claude/hooks/`.
   - Broad auditing tasks are delegated to specialized reviewer agents in `.claude/agents/`.

---

## 2. Core Instructions Map

| File Path | Environment | Scope | Key Responsibility |
| :--- | :--- | :--- | :--- |
| `AGENTS.md` | Universal (Claude & Codex) | Global | Core mission, pointer to canonical docs, 8 universal architectural invariants. |
| `CLAUDE.md` | Claude Code | Global | Pointers to scoped rules, operating principles, skills, and verification workflow. |
| `.claude/rules/00-core.md` | Claude Code | Global | The only global rule file without `paths:`; enforces core invariants across all turns. |

---

## 3. Architecture & Product Knowledge Base

Canonical documentation must be consulted before authoring or modifying subsystem architecture.

### Product Specifications (`docs/product/`)

| File Path | Focus Area | Core Content |
| :--- | :--- | :--- |
| `docs/product/invariants.md` | Product Truths | Unbreakable product invariants: Role vs Scope, Light-Only, Server Truth, Separation of Duties. |
| `docs/product/roles-and-scopes.md` | Authorization & Scopes | Definitive mappings for School vs Unit vs Personal datasets and administrative roles. |
| `docs/product/metrics.md` | Business Metrics | Exact mathematical formulas for task completion, overdue states, and parent vs subtask denominator separation. |

### Architectural Deep-Dives (`docs/architecture/`)

| File Path | Focus Area | Core Content |
| :--- | :--- | :--- |
| `ARCHITECTURE.md` | High-Level Architecture | System topology, technology stack, directory map, domain boundaries, and data flows. |
| `docs/architecture/task-workspace.md` | Task Engine | Canonical Task Workspace architecture, component hierarchy, toolbar, and filter synchronization. |
| `docs/architecture/navigation.md` | Routing & Navigation | Canonical navigation registry, desktop sidebar, mobile bottom nav, and route synchronization. |
| `docs/architecture/authentication.md` | Auth & Sessions | NextAuth.js flow, JWT lifecycle, RBAC enforcement, and session verification. |
| `docs/architecture/mobile.md` | Mobile Ergonomics | Adaptive layouts, AppShell safe area ownership, bottom sheets, touch targets, and virtual keyboard. |
| `docs/architecture/api-inventory.md` | REST API Inventory | Exhaustive catalog of all backend endpoints, supported methods, and authentication requirements. |
| `docs/architecture/dependency-baseline.md` | Package Baseline | Pinned runtime dependencies, framework versions, and compatibility constraints. |

---

## 4. Claude Path-Scoped Rules (`.claude/rules/`)

Each rule file contains a YAML frontmatter specifying `paths:` matching globs. Rules are automatically loaded only when relevant files are touched.

| Rule File | Glob Scope (`paths:`) | Line Budget | Domain Invariants & Requirements |
| :--- | :--- | :--- | :--- |
| `00-core.md` | None (Global) | <= 20 lines | Single canonical engine, Role != Scope, Server truth, no fake data, no unverified claims. |
| `05-domain-freeze.md` | `src/**/*`, `docs/domain/**/*` | <= 30 lines | Protects frozen domain architecture boundaries and prevents duplicate engines. |
| `10-ui.md` | `src/app/**/*.tsx`, `src/components/**/*.tsx` | <= 30 lines | Light-Only standard, semantic OKLCH tokens, Lucide stroke 1.5, no emoji decor, typography floor >= 12px. |
| `11-mobile.md` | `src/components/layout/**/*`, `src/components/**/*mobile*.tsx`, `src/components/pwa/**/*`, `src/hooks/use-virtual-keyboard.ts`, `tests/*mobile*.test.ts` | <= 30 lines | Adaptive layout, AppShell safe-area ownership, touch target >= 44px, no stacked pb-20/24 hacks. |
| `20-tasks.md` | `src/components/tasks/**/*`, `src/components/workspace/**/*`, `src/app/tasks/**/*`, `src/app/unit-tasks/**/*`, `src/hooks/use-task-*.ts`, `src/lib/tasks/**/*` | <= 30 lines | Single canonical Task Workspace & Table, single filter model, Role != Scope, parent/subtask denominator integrity. |
| `21-documents.md` | `src/components/documents/**/*`, `src/app/documents/**/*`, `src/lib/documents/**/*` | <= 30 lines | Unified document registry, incoming/outgoing metadata semantics, server-backed authorization. |
| `22-calendar.md` | `src/components/calendar/**/*`, `src/app/calendar/**/*`, `src/lib/*calendar*.ts` | <= 30 lines | Dynamic academic periods, ICT date utilities, no naive UTC slicing for deadlines, agenda mode on compact view. |
| `30-api.md` | `src/app/api/**/*`, `src/lib/server/**/*` | <= 30 lines | Authenticate protected routes, server-side RBAC, Zod payload validation, canonical error shape. |
| `31-auth-security.md` | `src/app/api/auth/**/*`, `src/components/auth/**/*`, `src/lib/auth*`, `src/context/**/*` | <= 30 lines | Server session = truth, cryptographic JWT check, zero client-trust, prevent secret and token leakage. |
| `40-data-integrity.md` | `src/hooks/use-*.ts`, `src/lib/db/**/*`, `src/lib/tasks/**/*`, `src/lib/metrics/**/*` | <= 30 lines | Zero synthetic operational data, canonical metric formulas, ICT (UTC+7) timestamps, server truth reconciliation. |
| `50-testing.md` | `tests/**/*`, `**/*.test.ts`, `**/*.test.tsx`, `playwright.config.ts` | <= 30 lines | Verification before completion, run typecheck and test suites, test real behaviors, no disabled tests. |
| `60-docs.md` | `docs/**/*`, `*.md` | <= 30 lines | Search before creating, plan lifecycle (active/completed/superseded), at most 1 active plan per domain. |

---

## 5. Codex Scoped Instructions (Directory-Scoped `AGENTS.md`)

For environments operating under the OpenAI Codex harness, directory-scoped `AGENTS.md` files provide localized guidelines without bloating global context.

| File Path | Directory Scope | Key Invariants Enforced |
| :--- | :--- | :--- |
| `src/components/tasks/AGENTS.md` | `src/components/tasks/` | Single Task Workspace engine, unified filter state, no parallel task views, parent/subtask denominator rules. |
| `src/app/api/AGENTS.md` | `src/app/api/` | Server-side authentication and authorization, Zod schema validation, canonical JSON error shapes. |
| `src/lib/AGENTS.md` | `src/lib/` | Pure business logic, ICT date conversions, zero mock fallback constants in production logic. |
| `tests/AGENTS.md` | `tests/` | Strict test execution, testing real assertions, no skipping failing security or invariant tests. |
| `docs/AGENTS.md` | `docs/` | Single active plan per domain, archiving completed plans, updating ADRs for structural decisions. |

---

## 6. Repeatable Skills (`.claude/skills/`)

Skills encapsulate multi-step, standardized procedures so they do not burden the base instructions.

| Skill Name | Location | Invocation | Purpose & Procedure |
| :--- | :--- | :--- | :--- |
| `qcet-verify` | `.claude/skills/qcet-verify/SKILL.md` | `/qcet-verify` | 6-step deterministic verification: git diff check, targeted tests, typecheck (`tsc --noEmit`), full test suite, invariant pattern scan, structured report. |
| `qcet-ux-audit` | `.claude/skills/qcet-ux-audit/SKILL.md` | `/qcet-ux-audit` | Systematic checklist for Information Architecture, visual hierarchy, Light-Only compliance, mobile safe areas, touch targets (>=44px), typography floor (>=12px), and accessibility. |
| `qcet-data-audit` | `.claude/skills/qcet-data-audit/SKILL.md` | `/qcet-data-audit` | Checklist auditing data integrity: zero synthetic operational data, canonical metric calculations (`docs/product/metrics.md`), parent/subtask denominator separation, ICT date handling. |
| `qcet-db-change` | `.claude/skills/qcet-db-change/SKILL.md` | `/qcet-db-change` | Safe Prisma migration checklist: schema inspection, backward compatibility, SQL migration verification, seed data synchronization, rollback preparation. |

---

## 7. Specialized Reviewer Agents (`.claude/agents/`)

Reviewer subagents operate in isolated subagent contexts to execute comprehensive audits without polluting the main conversation thread.

| Agent Name | Definition File | Specialized Review Scope |
| :--- | :--- | :--- |
| `ux-reviewer` | `.claude/agents/ux-reviewer.md` | UI/UX visual hierarchy, responsive & mobile layouts (375px/390px/430px), safe areas, touch targets (>=44px), typography floor (>=12px), Light-Only standard (no `dark:`), WCAG AA accessibility, loading/empty states, anti-slop. |
| `data-reviewer` | `.claude/agents/data-reviewer.md` | Data integrity, canonical metric formulas (`docs/product/metrics.md`), zero synthetic operational data, parent vs subtask denominator separation, ICT (UTC+7) timezone formatting, server truth vs client cache reconciliation. |
| `security-reviewer` | `.claude/agents/security-reviewer.md` | Server-side RBAC and authorization, JWT session validation, Zod payload validation, Separation of Duties (Maker-Checker), secret/credential leak prevention, no guest/demo authentication bypasses. |
| `verifier` | `.claude/agents/verifier.md` | Deterministic verification pipeline, `npm run typecheck`, targeted and full `npm test`, git diff inspection, architectural invariant scans (`dark:`, `text-[9px]`, `tailwind.config.js`), enforcement of zero false verification claims. |

---

## 8. Permissions & Deterministic Hooks

Hard boundaries and deterministic safety are enforced through harness configuration and executable pre-tool hooks.

### Settings Configuration (`.claude/settings.json`)

- **Deny List**:
  - Direct reading or editing of sensitive files (`.env*`, `*.pem`, `*.key`, credentials).
  - Destructive git operations (`git reset --hard`, `git push --force`, checkout overwriting).
- **Ask List**:
  - Package installations (`npm install`, `npm add`).
  - Database schema alterations (`npx prisma migrate*`, `npx prisma db push`).
  - Git commits (`git commit`).
- **Allow List**:
  - Read-only inspection commands (`git status`, `git diff`, `git log`, file searches).
  - Verification commands (`npm run typecheck`, `npm test`).

### Deterministic Hook Scripts (`.claude/hooks/`)

| Hook Script | Event Trigger | Guard Behavior |
| :--- | :--- | :--- |
| `protect-sensitive-files` | Pre-tool (Read, Edit, Write, Bash) | Rejects attempts to inspect or mutate environment variables, secrets, certificates, or private keys. |
| `guard-next-build` | Pre-tool (Bash) | Checks if dev server is running on port 3001; blocks `next build` if active to prevent `.next` cache poisoning and unstyled UI crashes. |
| `fast-changed-file-check` | Post-tool (Edit, Write) | Scans newly saved files for forbidden patterns (`dark:` classes, `text-[9px]`, `text-[10px]`, or new `tailwind.config.js`) and warns immediately. |

---

## 9. Plan & Specification Lifecycles (`docs/plans/`)

Implementation plans follow a strict three-tier lifecycle to avoid conflicting instructions and stale context:

1. **Active Plans (`docs/plans/active/`)**:
   - Contains currently in-progress implementation plans.
   - Invariant: Maximum of ONE master active plan per domain (e.g., Agent Architecture, Database, UX).
2. **Completed Plans (`docs/plans/completed/`)**:
   - Archive of fully implemented, tested, and verified plans.
   - Preserved for historical provenance and implementation rationale.
3. **Superseded Plans (`docs/plans/superseded/`)**:
   - Plans replaced by subsequent architectural redesigns.
   - Must contain frontmatter metadata (`superseded_by: <path>` or `supersedes: <path>`).

---

## 10. Agent Maintenance Guidelines

When adding, modifying, or retiring rules and agents in the repository:

1. **Check Line Budgets**:
   - `CLAUDE.md`: <= 25 lines.
   - `AGENTS.md`: <= 60 lines.
   - `.claude/rules/00-core.md`: <= 20 lines.
   - Any `.claude/rules/*.md`: <= 30 lines with valid `paths:` frontmatter.
   - Any directory-scoped `AGENTS.md`: <= 15 lines.
2. **Enforce Single Ownership**:
   - Every invariant must have exactly one canonical owner. Do not duplicate rules across multiple rule files.
3. **Keep Operational Procedures in Skills**:
   - Do not bloat rules with step-by-step checklists; place checklists in `.claude/skills/<name>/SKILL.md`.
4. **Use Subagents for Heavy Audits**:
   - Dispatch `ux-reviewer`, `data-reviewer`, `security-reviewer`, or `verifier` to keep main context clean.
5. **Update This Index**:
   - Whenever adding a new rule, skill, agent, or canonical architecture doc, update this index to maintain total system visibility.
