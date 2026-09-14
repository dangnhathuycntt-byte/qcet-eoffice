# QCET E-Office Agent Architecture & Navigation Index

Navigation map for agent configuration, scoped rules, skills, hooks, and architectural specifications in QCET E-Office.

Maintained as a human-readable index; it is not auto-loaded into agent startup context.

---

## 1. System Architecture Overview

1. **Minimal Global Startup Context**:
   - `CLAUDE.md`: Lightweight entry point referencing `AGENTS.md`.
   - `AGENTS.md`: Universal invariants, applicable across all environments.
   - `.claude/rules/core.md`: The single unconditional global rule (no `paths:` frontmatter).
2. **Path-Scoped Rules**:
   - `.claude/rules/*.md` load only when matching paths are read or modified.
   - Three scoped files: `ui.md`, `backend-security.md`, `testing.md`.
3. **Separation of Concerns**:
   - Architectural facts live in `docs/architecture/` and `docs/product/`.
   - Repeatable multi-step procedures live in `.claude/skills/`.
   - Hard safety constraints live in `.claude/settings.json` and `.claude/hooks/`.
   - Broad audits are delegated to reviewer agents in `.claude/agents/`.

---

## 2. Core Instructions Map

| File Path | Environment | Scope | Key Responsibility |
| :--- | :--- | :--- | :--- |
| `AGENTS.md` | Universal (Claude & Codex) | Global | Mission, canonical-doc pointers, universal architectural invariants. |
| `CLAUDE.md` | Claude Code | Global | Pointers to scoped rules, operating principles, skills. |
| `.claude/rules/core.md` | Claude Code | Global | The only rule file without `paths:`; core invariants and the authority model. |

---

## 3. Canonical Knowledge Base

Read only the smallest relevant file for the task. Do not recursively scan `docs/`.

### Product (`docs/product/`)

| File Path | Focus Area |
| :--- | :--- |
| `docs/product/invariants.md` | Product truths: Role vs Scope, Light-Only, Server Truth, Separation of Duties. |
| `docs/product/roles-and-scopes.md` | School / Unit / Personal dataset and administrative role mappings. |
| `docs/product/metrics.md` | Canonical formulas for completion, overdue states, and parent/subtask denominators. |

### Architecture (`docs/architecture/`)

| File Path | Focus Area |
| :--- | :--- |
| `ARCHITECTURE.md` | System topology, stack, directory map, domain boundaries, data flows. |
| `docs/architecture/task-workspace.md` | Task Workspace architecture, component hierarchy, toolbar, filter synchronization. |
| `docs/architecture/navigation.md` | Navigation registry, sidebar, mobile bottom nav, route synchronization. |
| `docs/architecture/authentication.md` | Session flow, JWT lifecycle, RBAC enforcement. |
| `docs/architecture/mobile.md` | Adaptive layouts, safe areas, bottom sheets, touch targets, virtual keyboard. |
| `docs/architecture/api-inventory.md` | Backend endpoint catalog and authentication requirements. |
| `docs/architecture/TESTING_PYRAMID.md` | Test layers and the verification gates. |

### Domain & Security (`docs/domain/`, `docs/security/`, `docs/operations/`)

Canonical domain specifications (task management, delegations, organization, documents, records), data classification and logging policy, and deployment/rollback runbooks. Read the single file matching the domain being changed.

---

## 4. Claude Path-Scoped Rules (`.claude/rules/`)

Rule files carry YAML frontmatter with `paths:` globs and load only when relevant files are touched.

| Rule File | Glob Scope (`paths:`) | Domain Invariants |
| :--- | :--- | :--- |
| `core.md` | None (Global) | One canonical implementation, Role != Scope, Server Truth, no invented data, preserve unrelated changes, never weaken security to pass tests, git safety. Authority model: statutory titles + capability engine, `UserRole` is not a business-authority slot, `TaskScope` is never a permission, DACUM duties are not permissions. |
| `ui.md` | `src/app/**/*.tsx`, `src/components/**/*`, `src/hooks/**/*`, `tests/*mobile*.test.ts` | Light-Only OKLCH tokens, semantic tokens, restrained iconography, typography floor and `tabular-nums`, accessibility, single control point. Mobile: adaptive layout, AppShell safe-area ownership, 44px touch targets, keyboard safety. Task/Document/Calendar domain invariants incl. canonical engines, filter source of truth, ICT date handling. |
| `backend-security.md` | `src/app/api/**/*`, `src/lib/server/**/*`, `src/lib/auth*`, `src/context/**/*`, `src/components/auth/**/*`, `prisma/**/*` | Route authentication, server-side RBAC, payload validation, canonical error shape, no production bypass, leak prevention. Server session truth, role isolation, separation of duties, secret protection. Metric/denominator integrity, no synthetic data, database truth wins. |
| `testing.md` | `tests/**/*` | Lowest-cost regression layer, extend before creating, no source-text or Tailwind-class assertions, layered `test:*` scripts, verification gates. |

---

## 5. Codex Scoped Instructions (Directory-Scoped `AGENTS.md`)

| File Path | Directory Scope | Key Invariants Enforced |
| :--- | :--- | :--- |
| `src/components/tasks/AGENTS.md` | `src/components/tasks/` | Single Task Workspace engine, unified filter state, parent/subtask denominator rules. |
| `src/app/api/AGENTS.md` | `src/app/api/` | Server-side authentication and authorization, schema validation, canonical JSON error shapes. |
| `src/lib/AGENTS.md` | `src/lib/` | Pure business logic, ICT date conversions, zero mock fallback constants in production logic. |
| `tests/AGENTS.md` | `tests/` | Real assertions, no skipping of security or invariant tests. |

---

## 6. Repeatable Skills (`.claude/skills/`)

| Skill Name | Invocation | Purpose |
| :--- | :--- | :--- |
| `qcet-verify` | `/qcet-verify` | Deterministic verification: git diff inspection, targeted module tests, typecheck, invariant scan, structured report. |
| `qcet-ux-audit` | `/qcet-ux-audit` | Information architecture, visual hierarchy, Light-Only compliance, mobile safe areas, touch targets, typography floor, accessibility. |
| `qcet-data-audit` | `/qcet-data-audit` | Zero synthetic operational data, canonical metric calculations, parent/subtask denominator separation, ICT date handling. |
| `qcet-db-change` | `/qcet-db-change` | Safe Prisma migration checklist: schema inspection, backward compatibility, SQL verification, seed synchronization, rollback. |

---

## 7. Specialized Reviewer Agents (`.claude/agents/`)

| Agent Name | Specialized Review Scope |
| :--- | :--- |
| `ux-reviewer` | Visual hierarchy, responsive/mobile layouts, safe areas, touch targets, typography floor, Light-Only standard, WCAG AA, loading/empty states, anti-slop. |
| `data-reviewer` | Data integrity, canonical metric formulas, zero synthetic operational data, parent vs subtask denominators, ICT timezone handling, server-truth reconciliation. |
| `security-reviewer` | Server-side RBAC, JWT session validation, payload validation, Separation of Duties, secret leak prevention, no guest/demo bypasses. |
| `verifier` | Deterministic verification pipeline, typecheck, targeted and full test runs, git diff inspection, zero false verification claims. |

---

## 8. Permissions & Deterministic Hooks

### `.claude/settings.json`

- **Deny**: sensitive files (`.env*`, `*.pem`, `*.key`), destructive git operations (`git reset --hard`, `git push --force`).
- **Ask**: package installs, `prisma migrate*` / `db push`, `git commit`.
- **Allow**: read-only inspection (`git status`, `git diff`, `git log`), verification commands.

### `.claude/hooks/`

| Hook Script | Trigger | Guard Behavior |
| :--- | :--- | :--- |
| `protect-sensitive-files` | Pre-tool (Read, Edit, Write, Bash) | Rejects inspection or mutation of env vars, secrets, certificates, private keys. |
| `guard-next-build` | Pre-tool (Bash) | Blocks `next build` while the dev server holds port 3001, preventing `.next` cache poisoning. |
| `fast-changed-file-check` | Post-tool (Edit, Write) | Scans saved files for forbidden patterns (`dark:` classes, `text-[9px]`, `text-[10px]`, new `tailwind.config.js`). |

---

## 9. Plan Lifecycle (`docs/plans/`)

Plans live in `docs/plans/active/` while in progress. When a plan finishes or is replaced, **delete it** — git history is the archive. Do not accumulate completed or superseded plan files; they add context cost without adding authority. Maintain at most one master active plan per domain.

---

## 10. Agent Maintenance Guidelines

1. **Keep rules few and non-overlapping**: every invariant has exactly one canonical owner. Prefer adding an invariant to an existing rule file over creating a new one.
2. **Keep operational procedures in skills**: do not bloat rule files with step-by-step checklists.
3. **Use subagents for heavy audits**: dispatch `ux-reviewer`, `data-reviewer`, `security-reviewer`, or `verifier` to keep main context lean.
4. **Update this index** whenever a rule, skill, agent, or canonical doc is added or retired.
