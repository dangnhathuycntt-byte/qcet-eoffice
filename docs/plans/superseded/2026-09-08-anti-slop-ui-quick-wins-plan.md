---
status: superseded
domain: ux
created: 2026-09-08
superseded_by: 2026-09-09-master-ux-consolidation-plan.md
---

# Anti-Slop UI & Academic Ergonomics Quick Wins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate mechanical AI-slop patterns, fix Vietnamese typography clipping/tracking, remove consumer SaaS gamification (confetti), eradicate orphaned labels, improve form accessibility/contrast, and standardize public administration microcopy across QCET E-Office.

**Tech Stack:** Next.js 15 App Router, Tailwind CSS v4, OKLCH Light-only theme, Node.js test runner (`tsx --test`).

**References:**
- Audit Report: `docs/BAO_CAO_DANH_GIA_UI_UX_ANTI_SLOP.md`
- Engineering Rules: `CLAUDE.md` (Build & Cache rules, Tailwind v4 Light-only standard)

## Global Constraints

- Never run `next build` over `.next` while `next dev` is running (`CLAUDE.md`).
- Strict light-only theme: OKLCH color space, no `dark:` classes or ThemeProvider.
- All tests must pass: `npx tsx --test tests/**/*.test.ts` and `npm run typecheck`.

---

### Task 1: Fix Vietnamese Typographic Tracking, Line-Height & Remove Forced Composite Layers in `globals.css`

**Files:**
- Modify: `src/app/globals.css:135-155`
- Test: `tests/theme-standardization.test.ts`
- Test: `tests/ui-ux-ergonomics-review.test.ts`

**Requirements:**
1. In `src/app/globals.css`:
   - Remove `transform: translateZ(0);` and `will-change: transform;` from `body::before`.
   - Ensure `.content-auto` utility is defined with `content-visibility: auto; contain-intrinsic-size: 1px 64px;`.
   - Update heading styles (`h1, h2, h3, h4, h5, h6`):
     - Change `letter-spacing: -0.025em;` to `letter-spacing: -0.01em;` (prevents Vietnamese diacritic collision).
     - Add `line-height: 1.35;`.
     - Keep `text-wrap: balance;`.
   - In `@layer base`, add `p, td, li { text-wrap: pretty; }`.

- [x] **Step 1: Inspect and run theme standardization test**
Run: `npx tsx --test tests/theme-standardization.test.ts`

- [x] **Step 2: Update `src/app/globals.css`**
Apply typography adjustments and remove forced composite layers.

- [x] **Step 3: Run tests to verify**
Run: `npx tsx --test tests/theme-standardization.test.ts`
Expected: PASS (all tests green)

- [x] **Step 4: Commit**
`git add src/app/globals.css && git commit -m "style(typography): fix vietnamese heading tracking and composite layers in globals.css"`

---

### Task 2: Remove Celebration Confetti & De-gamify Onboarding

**Files:**
- Modify: `src/components/onboarding/onboarding-checklist-widget.tsx`
- Delete: `src/components/onboarding/celebration-confetti.tsx`
- Test: `tests/onboarding-state.test.ts`
- Test: `tests/onboarding-integration.test.ts`

**Requirements:**
1. In `src/components/onboarding/onboarding-checklist-widget.tsx`:
   - Remove import and usage of `<CelebrationConfetti />`.
   - Remove `showConfetti` state.
2. Delete `src/components/onboarding/celebration-confetti.tsx`.
3. Preserve `calculateOnboardingProgress` and checklist logic intact so existing onboarding tests pass.

- [x] **Step 1: Check onboarding tests before modifying**
Run: `npx tsx --test tests/onboarding-state.test.ts tests/onboarding-integration.test.ts`
Expected: PASS

- [x] **Step 2: Remove Confetti from widget and delete celebration-confetti.tsx**
Remove confetti rendering and delete the file.

- [x] **Step 3: Verify tests and typecheck**
Run: `npm run typecheck && npx tsx --test tests/onboarding-state.test.ts tests/onboarding-integration.test.ts`
Expected: PASS

- [x] **Step 4: Commit**
`git add -A src/components/onboarding/ && git commit -m "refactor(onboarding): remove consumer confetti gamification from onboarding widget"`

---

### Task 3: Form Accessibility & Contrast in Task Creation Modal

**Files:**
- Modify: `src/components/dashboard/create-task-modal.tsx:620-660`
- Test: `tests/dashboard-subhooks-logic.test.ts`

**Requirements:**
1. In `src/components/dashboard/create-task-modal.tsx`:
   - Add explicit `<label htmlFor="task-title-input">` for the task title input field.
   - Set `id="task-title-input"` on the title input.
   - Add explicit `<label htmlFor="task-description-input">` for the task description input field.
   - Set `id="task-description-input"` on the description textarea.
   - Adjust placeholder opacity from `placeholder:text-muted-foreground/40` to `placeholder:text-muted-foreground/75` (WCAG AA compliant contrast).

- [x] **Step 1: Check existing dashboard tests**
Run: `npx tsx --test tests/dashboard-subhooks-logic.test.ts`
Expected: PASS

- [x] **Step 2: Update labels and placeholders in `create-task-modal.tsx`**
Add labels with proper IDs and improve placeholder contrast.

- [x] **Step 3: Verify with typecheck and tests**
Run: `npm run typecheck && npx tsx --test tests/dashboard-subhooks-logic.test.ts`
Expected: PASS

- [x] **Step 4: Commit**
`git add src/components/dashboard/create-task-modal.tsx && git commit -m "fix(a11y): add explicit form labels and improve placeholder contrast in create-task-modal"`

---

### Task 4: Eradicate Orphaned "Chuyển góc nhìn:" Label in Role Viewpoint Banner

**Files:**
- Modify: `src/components/auth/role-viewpoint-banner.tsx:70-82`
- Test: `tests/role-based-workspace-workflow.test.ts`

**Requirements:**
1. In `src/components/auth/role-viewpoint-banner.tsx`:
   - Remove the orphaned label `<span ...>Chuyển góc nhìn:</span>`.
   - Remove the dead `<RoleSwitcherPill />` invocation and its import since `RoleSwitcherPill` returns `null`.
   - Keep the clean viewpoint banner display text (`viewpointText`) and icon intact.

- [x] **Step 1: Run role-based workspace tests**
Run: `npx tsx --test tests/role-based-workspace-workflow.test.ts`
Expected: PASS

- [x] **Step 2: Clean up orphaned label in `role-viewpoint-banner.tsx`**
Remove unused label and dead pill component wrapper.

- [x] **Step 3: Verify tests**
Run: `npm run typecheck && npx tsx --test tests/role-based-workspace-workflow.test.ts`
Expected: PASS

- [x] **Step 4: Commit**
`git add src/components/auth/role-viewpoint-banner.tsx && git commit -m "fix(banner): remove orphaned viewpoint switcher label from role-viewpoint-banner"`

---

### Task 5: Upgrade Modal Backdrop Blur on Key Dialogs

**Files:**
- Modify: `src/components/portal/review-action-dialog.tsx`
- Modify: `src/components/portal/submit-deliverable-modal.tsx`
- Modify: `src/components/dashboard/create-task-modal.tsx`
- Test: `tests/sprint2-integration.test.ts`

**Requirements:**
1. In `review-action-dialog.tsx`, `submit-deliverable-modal.tsx`, and `create-task-modal.tsx`:
   - Upgrade the backdrop overlay from `backdrop-blur-xs` (2px, insufficient occlusion) to `backdrop-blur-sm` (4px, clean professional depth).

- [x] **Step 1: Run integration test**
Run: `npx tsx --test tests/sprint2-integration.test.ts`
Expected: PASS

- [x] **Step 2: Replace backdrop-blur-xs with backdrop-blur-sm in dialog backdrops**
Update backdrop classes.

- [x] **Step 3: Verify tests**
Run: `npm run typecheck && npx tsx --test tests/sprint2-integration.test.ts`
Expected: PASS

- [x] **Step 4: Commit**
`git add src/components/portal/review-action-dialog.tsx src/components/portal/submit-deliverable-modal.tsx src/components/dashboard/create-task-modal.tsx && git commit -m "style(dialogs): upgrade backdrop blur from xs to sm for enhanced visual separation"`

---

### Task 6: Standardize Public Administration Vocabulary Across Workspace Components

**Files:**
- Modify: `src/components/dashboard/task-detail-side-sheet.tsx`
- Modify: `src/components/dashboard/cascading-task-table.tsx`
- Modify: `src/components/tasks/cascading-task-table.tsx`
- Modify: `src/components/portal/department-manager-workspace.tsx`
- Modify: `src/components/portal/executive-cockpit-workspace.tsx`
- Test: `tests/task-ownership-model.test.ts`
- Test: `tests/role-based-workspace-workflow.test.ts`

**Requirements:**
1. Replace informal slang terms with academic/public-service terms:
   - "việc con" / "đầu việc con" -> "nhiệm vụ thành phần"
   - "Giao việc con" -> "Giao nhiệm vụ thành phần"
   - "Thu gọn việc con" / "Mở rộng việc con" -> "Thu gọn nhiệm vụ thành phần" / "Mở rộng nhiệm vụ thành phần"
   - "Thường quy (Tự xong)" -> "Thường quy (Tự nghiệm thu)"
   - "Đang làm" (when referring to task status) -> "Đang thực hiện" (keep "Đang làm mới..." for refresh indicators).

- [ ] **Step 1: Run task ownership & workflow tests**
Run: `npx tsx --test tests/task-ownership-model.test.ts tests/role-based-workspace-workflow.test.ts`
Expected: PASS

- [ ] **Step 2: Update vocabulary in targeted components**
Perform surgical string replacements.

- [ ] **Step 3: Verify all tests pass**
Run: `npm run typecheck && npm test`
Expected: PASS

- [ ] **Step 4: Commit**
`git add src/components/ && git commit -m "style(microcopy): standardize public administration vocabulary across workspace components"`
