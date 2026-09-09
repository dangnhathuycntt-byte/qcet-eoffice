---
status: completed
domain: agent
created: 2026-09-09
completed: 2026-09-09
---

# QCET Agent Rules Refactor Implementation Plan

## Spec & Directives
Refactor the entire agent instruction and architecture system for QCET E-Office to achieve:
- Minimal startup context (CLAUDE.md <= 25 lines, AGENTS.md <= 60 lines, 00-core.md <= 20 lines)
- No duplicate rules
- Path-scoped rules for specific domains (target 10-30 lines/file)
- Procedures moved to Skills
- Hard safety enforced by Permissions & deterministic Hooks
- System & domain knowledge moved to canonical docs/
- Dual compatibility for Claude Code and OpenAI Codex

## Global Constraints
- Strictly adhere to line budgets:
  - CLAUDE.md: <= 25 lines
  - AGENTS.md: <= 60 lines
  - .claude/rules/00-core.md: <= 20 lines (the ONLY global rule without paths)
  - All domain rules (.claude/rules/*.md): <= 30 lines, MUST have YAML `paths:` frontmatter
  - Scoped AGENTS.md: <= 15 lines
- Light-only mode invariant: Never introduce dark mode classes or toggles.
- Role != Scope invariant: Role controls authority; Scope controls dataset.
- Server truth wins: Server/database truth wins over cached client state.
- One capability, one canonical implementation: Never create parallel versions or V2 shims.
- Never weaken security or tests.
- Non-destructive execution: preserve all unrelated business source code and user changes.

---

### Task 1: Inventory Current Instructions & Global Foundation (Batch 1 - Phases 0, 1, 2)
**Objective:** Inventory all existing agent instruction files and establish the minimal global foundation: `AGENTS.md`, `CLAUDE.md`, and `.claude/rules/00-core.md`.
**Requirements:**
1. Inventory all current rules, instructions, and plans across `CLAUDE.md`, `docs/`, `.claude/`, etc.
2. Author root `AGENTS.md` (40-60 lines max):
   - Project mission, canonical docs pointer, core architecture invariants (One capability, one canonical implementation; Role is not Scope; Server truth wins; Never invent operational data; Preserve unrelated user changes; Never weaken security; Never claim unexecuted verification; Git safety).
   - No Tailwind details, mobile spacing, or task filter logic.
3. Author root `CLAUDE.md` (15-25 lines max):
   - Reference `@AGENTS.md`, point to `.claude/rules/`, inspect canonical architecture first, plan before editing, verify before completion, use Skills for procedures, use subagents for broad audits.
   - Do NOT `@import` heavy docs like ARCHITECTURE.md or mobile.md.
4. Author `.claude/rules/00-core.md` (<= 20 lines max, NO `paths:` frontmatter):
   - The ONLY unconditional global rule for Claude Code.
**Verification:**
- Check line count: `wc -l AGENTS.md CLAUDE.md .claude/rules/00-core.md`. Confirm AGENTS.md <= 60, CLAUDE.md <= 25, 00-core.md <= 20.
- Confirm `00-core.md` has NO paths.

---

### Task 2: Scoped Rules for UI, Mobile & Core Business Domains (Batch 2 Part 1 - Phases 3, 4, 5, 6, 7)
**Objective:** Create path-scoped rules for UI, Mobile, Task domain, Document domain, and Calendar domain.
**Requirements:**
1. `.claude/rules/10-ui.md` (<= 25 lines):
   - Scope: `src/app/**/*.tsx`, `src/components/**/*.tsx`
   - Content: Light-only, semantic tokens, Lucide strokeWidth 1.5, no decorative emoji, no fake KPI, no duplicate controls, typography floor, accessible focus/name, visual hierarchy.
2. `.claude/rules/11-mobile.md` (<= 25 lines):
   - Scope: `src/components/layout/**/*`, `src/components/**/*mobile*.tsx`, `src/components/pwa/**/*`, `src/hooks/use-virtual-keyboard.ts`, `tests/*mobile*.test.ts`
   - Content: Adaptive not compressed desktop, AppShell owns safe-area/bottom-nav spacing, no stacked pb-20/24 hacks, touch target ~44px, no desktop horizontal tables as primary compact UX, keyboard safety, compact sheets.
3. `.claude/rules/20-tasks.md` (<= 30 lines):
   - Scope: `src/components/tasks/**/*`, `src/components/workspace/**/*`, `src/app/tasks/**/*`, `src/app/unit-tasks/**/*`, `src/hooks/use-task-*.ts`, `src/lib/tasks/**/*`
   - Content: One canonical Task Workspace & Table, one filter model, no duplicate toolbar/search/view switcher, Role != Scope, canonical scopes (school/unit/my), preserve parent/subtask semantics, URL/filter/count alignment, legacy facades receive no new UI.
4. `.claude/rules/21-documents.md` (<= 20 lines):
   - Scope: `src/components/documents/**/*`, `src/app/documents/**/*`, `src/lib/documents/**/*`
   - Content: One registry/detail model, incoming/outgoing semantics, real metadata, server-backed authorization, reuse canonical document viewer.
5. `.claude/rules/22-calendar.md` (<= 20 lines):
   - Scope: `src/components/calendar/**/*`, `src/app/calendar/**/*`, `src/lib/*calendar*.ts`
   - Content: No hard-coded academic year/semester/month, canonical academic-calendar helpers, no UTC slicing for local deadlines, calendar events reuse task identity, agenda mode on compact view.
**Verification:**
- Validate YAML frontmatter in all 5 rule files.
- Validate line counts: all files <= 30 lines.

---

### Task 3: Scoped Rules for API, Auth/Security, Data Integrity, Testing & Docs (Batch 2 Part 2 - Phases 8, 9, 10, 11, 12)
**Objective:** Create path-scoped rules for backend API, Auth & Security, Data Integrity, Testing, and Documentation.
**Requirements:**
1. `.claude/rules/30-api.md` (<= 20 lines):
   - Scope: `src/app/api/**/*`, `src/lib/server/**/*`
   - Content: Authenticate protected routes, authorize server-side, never trust client role, validate mutation payloads, canonical error shape, no production guest/demo fallback, no leaked internal errors/secrets.
2. `.claude/rules/31-auth-security.md` (<= 20 lines):
   - Scope: `src/app/api/auth/**/*`, `src/components/auth/**/*`, `src/lib/auth*`, `src/context/**/*`
   - Content: Server session = authentication truth, cached identity != auth session, role isolation & Separation of Duties, protect tokens/secrets, no insecure bypasses.
3. `.claude/rules/40-data-integrity.md` (<= 25 lines):
   - Scope: `src/lib/**/*`, `src/lib/server/**/*`, `src/components/workspace/hooks/**/*`, `prisma/**/*`
   - Content: One metric = one definition, never mix parent/subtask denominators silently, no synthetic operational business metadata, canonical date/academic-period helpers, database truth wins, filter/counts derived from same query.
4. `.claude/rules/50-testing.md` (<= 20 lines):
   - Scope: `tests/**/*`
   - Content: Tests encode intended behavior, do not weaken assertions to pass, deterministic date/time mocks, test role/scope/security boundaries, regression coverage for bugfixes, never report unexecuted tests as pass.
5. `.claude/rules/60-docs.md` (<= 20 lines):
   - Scope: `docs/**/*`, `*.md`
   - Content: Search existing docs first, Architecture = current state, ADR = durable decision, Plan = future work, completed plans leave active/, mark superseded explicitly, 1 master active plan per domain.
**Verification:**
- Validate YAML frontmatter in all 5 rule files.
- Validate line counts: all files <= 25 lines.

---

### Task 4: Codex Native Scoped AGENTS.md Files (Batch 3 - Phase 13)
**Objective:** Establish localized, directory-scoped `AGENTS.md` files for Codex compatibility at key architectural boundaries.
**Requirements:**
1. `src/components/tasks/AGENTS.md` (10-15 lines):
   - Invariants: One canonical task workspace/table/filter, Role != Scope, preserve parent/subtask semantics, no duplicate toolbar/search, URL/filter/count consistency.
2. `src/app/api/AGENTS.md` (10-15 lines):
   - Invariants: Authenticate, authorize server-side, validate inputs, never trust client role, no demo/guest bypass in production.
3. `src/lib/AGENTS.md` (10-15 lines):
   - Invariants: Canonical domain helpers, no fake operational data, canonical dates & academic periods, consistent metric definitions.
4. `tests/AGENTS.md` (<= 10 lines):
   - Invariants: Regression tests encode actual requirements, deterministic time, never weaken assertions, test auth boundaries.
5. `docs/AGENTS.md` (<= 10 lines):
   - Invariants: Check existing docs before adding, one master active plan per domain, archive completed plans, ADRs for architectural decisions.
**Verification:**
- Verify line counts (all <= 15 lines).
- Confirm no unnecessary nested AGENTS.md in leaf folders.

---

### Task 5: Canonical System Knowledge Base (Batch 4 - Phase 14)
**Objective:** Author canonical architecture and product documentation so rules stay lean and refer to docs for explanations.
**Requirements:**
1. Root `ARCHITECTURE.md` (clean, high-level map of QCET E-Office architecture, canonical boundaries, tech stack, data flow).
2. `docs/product/invariants.md`: Unbreakable product truths (Role vs Scope, Light-only, Server truth, Separation of Duties).
3. `docs/product/roles-and-scopes.md`: Complete explanation of School vs Unit vs Personal scopes and Role mappings.
4. `docs/product/metrics.md`: Canonical metric definitions, denominator rules (parent vs subtask), status calculations.
5. `docs/architecture/task-workspace.md`: Canonical Task Workspace architecture, component hierarchy, toolbar/filter lifecycle.
6. `docs/architecture/navigation.md`: Canonical navigation registry, desktop vs mobile routing, sync mechanisms.
7. `docs/architecture/authentication.md`: Authentication flow, session management, RBAC enforcement.
8. `docs/architecture/mobile.md`: Adaptive mobile design rules, safe areas, sheet/dialog patterns, keyboard handling.
**Verification:**
- Verify files exist and are well-structured with clear TOC and invariants.

---

### Task 6: Plan & Spec Organization and Migration (Batch 5 - Phase 20)
**Objective:** Restructure `docs/plans/` into clean lifecycle folders and categorize all existing plans.
**Requirements:**
1. Ensure structure:
   - `docs/plans/active/`
   - `docs/plans/completed/`
   - `docs/plans/superseded/`
2. Migrate existing plans from `docs/superpowers/plans/` and root `docs/` into appropriate target directories with metadata frontmatter:
   - Active: current active plans (<= 1 master active plan per domain: UX, Security, Data).
   - Completed: completed historical plans.
   - Superseded: older plans replaced by newer plans, with `superseded_by:` or `supersedes:` tags.
3. Keep clean symlinks or references if needed.
**Verification:**
- Verify `docs/plans/active/` contains only currently active plans.
- Verify metadata frontmatter on migrated plans.

---

### Task 7: Automation - Skills, Permissions & Deterministic Hooks (Batch 6 - Phases 16, 18, 19)
**Objective:** Move repeatable procedures to Skills, enforce hard restrictions in Permissions, and establish deterministic safety Hooks.
**Requirements:**
1. Create 4 QCET-specific Skills in `.claude/skills/`:
   - `qcet-verify/SKILL.md`: Verification procedure (git diff -> targeted tests -> typecheck -> broader tests -> invariant check -> report).
   - `qcet-ux-audit/SKILL.md`: Complete checklist for IA, hierarchy, mobile, light mode, touch targets, accessibility, data trust.
   - `qcet-data-audit/SKILL.md`: Checklist for hardcoded data, metric mismatches, date/time UTC issues, parent/subtask denominators.
   - `qcet-db-change/SKILL.md`: Procedure for Prisma schema changes, migrations, seed data, and safety checks.
2. Configure `.claude/settings.json`:
   - Deny: `.env*`, `*.pem`, `*.key`, `git reset --hard`, `git push`, destructive operations.
   - Ask: `npm install`, `npx prisma migrate*`, `npx prisma db push`, `git commit`.
   - Allow: `git status`, `git diff`, `npm run typecheck`, `npm test`, read-only inspection.
3. Implement deterministic Hooks in `.claude/hooks/`:
   - `protect-sensitive-files`: Prevent reading or editing secret files (.env, credentials).
   - `guard-next-build`: Detect if dev server on port 3001 is running before running `next build` to prevent cache poisoning.
   - `fast-changed-file-check`: Fast linter hook on changed files checking for `dark:`, raw small font sizes (`text-[9px]`, `text-[10px]`), or new `tailwind.config.js`.
**Verification:**
- Verify `.claude/settings.json` parses as valid JSON.
- Verify hook scripts have executable permissions and valid syntax.

---

### Task 8: Specialized Reviewer Agents & Agent Navigation Index (Batch 7 Part 1 - Phases 17, 21)
**Objective:** Create specialized single-responsibility reviewer subagents and the human-readable agent maintenance index.
**Requirements:**
1. Create reviewer agent definitions in `.claude/agents/`:
   - `ux-reviewer.md`: Specialized agent for UX, mobile layout, typography floor, light mode, accessibility.
   - `data-reviewer.md`: Specialized agent for data integrity, metric definitions, filter synchronization, mock data detection.
   - `security-reviewer.md`: Specialized agent for RBAC, auth session validation, payload sanitization, separation of duties.
   - `verifier.md`: Specialized agent for running tests, typecheck, checking diffs, ensuring no false claims.
2. Create `docs/agent/index.md`:
   - Human-readable map of the agent architecture (Core instructions -> AGENTS.md, Claude -> CLAUDE.md, Architecture -> ARCHITECTURE.md, Scoped rules -> .claude/rules/*, Codex -> scoped AGENTS.md, Skills -> .claude/skills/*, Plans -> docs/plans/*).
**Verification:**
- Check agent definition files.
- Verify `docs/agent/index.md` accurately indexes all files.

---

### Task 9: System-wide Anti-duplication, Line Budget & Verification Audit (Batch 7 Part 2 - Phases 15, 22, 23, 24, 25, 26)
**Objective:** Audit all instruction files against line budgets, ensure zero duplicate rules across files, run verification tests, and measure startup context.
**Requirements:**
1. Line budget check:
   - `CLAUDE.md` <= 25 lines
   - `AGENTS.md` <= 60 lines
   - `.claude/rules/00-core.md` <= 20 lines
   - Every domain rule in `.claude/rules/*.md` <= 30 lines
   - Every scoped `AGENTS.md` <= 15 lines
2. Anti-duplication audit:
   - Search concepts ("Role is not Scope", "Light mode", "Server truth", "safe area", "Lucide") to verify each concept has exactly ONE canonical owner.
3. Verify test suite and typecheck remain green:
   - Run `npm run typecheck`
   - Run `npm test`
**Verification:**
- Full line budget report script / output.
- Anti-duplication check results.
- `npm run typecheck` passes with exit code 0.
- `npm test` passes with exit code 0.
