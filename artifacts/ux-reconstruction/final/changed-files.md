# Changed Files — UX Reconstruction (baseline 5abd205e → candidate 728eb247)

19 files changed, 1985 insertions(+), 807 deletions(-)

## Added

| File | Purpose |
|---|---|
| `artifacts/ux-reconstruction/baseline/baseline-sha.txt` | Baseline SHA record for audit trail |
| `artifacts/ux-reconstruction/baseline/metrics.json` | Quantitative before-metrics (chrome rows, attention surfaces, pill counts) |
| `scripts/capture-baseline.mjs` | Baseline screenshot capture script |
| `src/components/dashboard/dashboard-situation-strip.tsx` | Extracted Situation section into its own component; ensures single bounded rendering surface |
| `tests/semantic-overdue-regression.test.ts` | Regression test for overdue task semantic correctness |
| `tests/ux-accessibility-gates.test.ts` | Structural, a11y, and light-only invariant gate suite (39 tests across 10 suites) |

## Modified

| File | Purpose |
|---|---|
| `src/app/calendar/page.tsx` | Collapsed calendar chrome to single unified control row (`flex flex-col sm:flex-row`); removed duplicate nav bars; added WCAG aria-labels for date navigation |
| `src/components/calendar/calendar-month-view.tsx` | Month grid touch target hardening; accessible focus rings |
| `src/components/dashboard/personal-workbench.tsx` | Action → Situation → Context section ordering; removed duplicate metric headers |
| `src/components/dashboard/task-detail-side-sheet.tsx` | Minor a11y label corrections; aria-label alignment |
| `src/components/dashboard/unified-task-toolbar.tsx` | Removed redundant chrome rows; consolidated toolbar; fixed duplicate re-export of `SavedViewsSelector` (lines 40/69) |
| `src/components/dashboard/zones/dashboard-zone.tsx` | Enforced exactly one `section-action`, one `section-situation`, one `section-context` slot; Vietnamese aria-labels added |
| `src/components/tasks/saved-views-selector.tsx` | Minor prop cleanup; accessible name enforcement |
| `src/components/tasks/task-kanban-board.tsx` | Replaced permanent `<Select>` status controls with action-menu pattern; `data-slot=kanban-action-menu`; Escape/outside-click handlers; `min-h-[44px]` mobile touch targets; keyboard column navigation with aria-labels |
| `tests/calendar-route-hygiene.test.ts` | Extended calendar hygiene coverage |
| `tests/dashboard-composition-invariants.test.ts` | Slot count assertions for Action/Situation/Context ordering |
| `tests/dashboard-zone.test.ts` | Dashboard zone structural assertions |
| `tests/task-kanban-board.test.ts` | Kanban accessibility and interaction pattern tests |
| `tests/unified-task-toolbar.test.ts` | Toolbar consolidation regression tests |
