---
name: qcet-verify
description: "Run the official QCET verification procedure: inspect git diff, run targeted module tests, full TypeScript check, full test suite, scan for architectural invariants (light-only, no mockups, denominator separation), and generate a clean structured verification report."
---

# QCET Verification Procedure (`qcet-verify`)

This skill defines the rigorous, 6-step verification pipeline for QCET E-Office. Always run this procedure before submitting any pull request, completing complex tasks, or declaring an implementation done.

---

## Step 1: Inspect Working Tree & Git Diff

Understand precisely what was modified, added, or removed.

1. **Review change summary:**
   ```bash
   git status --short
   git diff --stat
   ```
2. **Review detailed code modifications:**
   ```bash
   git diff
   ```
3. **Classify affected subsystems:**
   - **UI / Design System**: `src/components/**/*`, `src/app/**/*`, `globals.css`
   - **Data Layer / Server**: `src/lib/server/**/*`, `prisma/**/*`, `src/lib/services/**/*`
   - **Navigation / IA**: `src/lib/navigation/**/*`, `src/components/layout/**/*`
   - **Business Logic & Time**: `src/lib/academic-calendar.ts`, `src/lib/metrics/**/*`
   - **Security / RBAC**: `src/lib/auth/**/*`, `src/app/api/**/*`

---

## Step 2: Targeted Module Test Execution

Execute focused tests directly related to the modified components to catch fast regressions before running the complete test suite.

Run targeted commands using Node test runner with `tsx`:
```bash
# Task Engine & Workspace
npx tsx --test tests/cascading-task-table.test.ts tests/task-table-engine.test.ts tests/task-ownership-model.test.ts

# Design Tokens & Theme Hygiene
npx tsx --test tests/theme-standardization.test.ts tests/typography-tokens-contract.test.ts tests/typography-micro-classes.test.ts

# Mobile Ergonomics & Touch Targets
npx tsx --test tests/touch-targets-ergonomics.test.ts tests/cascading-table-mobile.test.ts

# Academic Calendar & ICT Timezone
npx tsx --test tests/academic-calendar.test.ts tests/timezone-safety.test.ts tests/academic-month-strict-filter.test.ts

# Auth, RBAC & Separation of Duties
npx tsx --test tests/auth-role-isolation.test.ts tests/api-rbac-and-sod.test.ts tests/separation-of-duties-fsm.test.ts

# Navigation & Canonical Routes
npx tsx --test tests/canonical-routes.test.ts tests/single-tier-navigation-e2e.test.ts
```

---

## Step 3: Full TypeScript Static Analysis

Ensure zero type discrepancies, missing interface members, or bad imports across the entire project.

```bash
npm run typecheck
```
*Requirement*: Must exit with code 0 (no TypeScript errors allowed).

---

## Step 4: Complete Test Suite Execution

Run the complete automated test suite to guarantee zero side-effects on distant modules.

```bash
npm test
```
*Requirement*: All tests must pass (0 failed, 0 cancelled).

---

## Step 5: System Invariant Checks

Perform deterministic checks against QCET core architectural rules:

### 1. Light-Only Standard Check (No `dark:`)
The application is strictly Light-Only (Tailwind v4 OKLCH tokens). Never introduce dark mode classes or theme switchers.
```bash
# Check for dark mode classes in codebase
git diff -U0 HEAD | grep -E "^\+[ ]*.*dark:" || true
```
*Pass condition*: Zero occurrences of `dark:` classes.

### 2. Typography Floor Check (Min 12px)
Text size must not drop below 12px (`text-xs`). Never use `text-[9px]` or `text-[10px]`.
```bash
git diff -U0 HEAD | grep -E "^\+[ ]*.*text-\[(9|10)px\]" || true
```
*Pass condition*: Zero occurrences of `text-[9px]` or `text-[10px]`.

### 3. Anti-Slop & Data Dignity Check (No Synthetic Data)
Ensure operational paths do not use fake fallback counters, fabricated progress bars, or placeholder mock arrays.
```bash
git diff -U0 HEAD | grep -E "^\+[ ]*.*(mockTasks|fakeData|dummyMetrics|Math\.random)" || true
```
*Pass condition*: Zero synthetic data shims in operational paths.

### 4. Denominator Separation Check
Ensure parent tasks and subtasks are not commingled in task metrics or calculations.
- Confirm parent tasks are filtered by `parentId: null` when aggregating parent statistics.
- Confirm subtask statistics are calculated from child tasks explicitly.

### 5. Dev Server Port 3001 Safety Check
Verify dev cache was not poisoned by a concurrent `next build`:
```bash
lsof -ti:3001 >/dev/null && echo "Dev server active on 3001 - Do NOT run next build" || echo "Port 3001 idle"
```

---

## Step 6: Generate Structured Verification Report

Produce a clean Markdown report with the following format:

```markdown
### Verification Summary: [Feature / Fix Title]

| Verification Step | Command / Check | Result | Details |
|---|---|---|---|
| Git Diff Review | `git diff --stat` | PASS | N files changed, +X/-Y |
| Targeted Tests | `npx tsx --test <modules>` | PASS | N/N passed |
| TypeScript Check | `npm run typecheck` | PASS | 0 errors |
| Full Test Suite | `npm test` | PASS | 134/134 passed |
| Light-Only Invariant | No `dark:` in diff | PASS | 0 occurrences |
| Typography Floor | No `text-[9px\|10px]` | PASS | Min size >= 12px |
| Data Dignity | Real DB records | PASS | Zero mockups |
| Denominator Integrity| Parent vs Subtask | PASS | Separated rollups |

**Residual Risks / Notes:** None identified. Ready for integration.
```
