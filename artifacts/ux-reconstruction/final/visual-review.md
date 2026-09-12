# Visual Review — Information Architecture Hierarchy

**Candidate SHA:** 728eb247
**Standard:** QCET UX Reconstruction Master Plan V3, Section 2 & External Design Principles

## 1. Action → Situation → Context (Dashboard)

Verified via `ux-accessibility-gates.test.ts` Suite 8:

- `data-slot="section-action"` appears before `data-slot="section-situation"`, which appears before `data-slot="section-context"` in source order (positional index assertion passed).
- Exactly one instance of each slot in `dashboard-zone.tsx` — no duplicate attention surfaces.
- Vietnamese aria-labels confirm intentional labelling: "CẦN XỬ LÝ" (Action), "TÌNH HÌNH" (Situation), "ĐƠN VỊ CẦN CHÚ Ý" (Context).

The dashboard information hierarchy now presents:
1. Items requiring immediate action (top)
2. Situational overview (middle)
3. Unit-level context (bottom)

This matches the target hierarchy from plan Section 1: `Context → What needs attention / current view → Actual work → Secondary configuration on demand`.

## 2. View-First Toolbar (Task Workspace)

- Workspace toolbar consolidation verified: no duplicate search bars or parallel toolbars in the same view tree (UI invariant 5, `10-ui.md`).
- Smart-filter rail (`active-filter-breadcrumb`) is hidden by default (`hasAnyFilter` guard confirmed present); it surfaces only when filters are active, keeping the default state uncluttered.
- Scope header uses tab-like navigation without permanent pill explosion; `min-h-[44px]` ensures touch ergonomics.

## 3. Card-First Kanban

- Kanban cards no longer carry a permanent inline `<Select>` status dropdown on the card surface.
- Status transitions are accessed via an action menu (`data-slot="kanban-action-menu"`) — card face is clean and content-first.
- Status submenu uses `aria-expanded` state binding, maintaining progressive disclosure.
- Column keyboard navigation (`Chuyển tới cột`) allows users to move between columns without drag.

## 4. Content-First Calendar

- Calendar workspace consolidated to exactly one unified control bar (`flex flex-col sm:flex-row`) on desktop — verified by gate test (Suite 9).
- Previous multi-row chrome pattern (separate date navigation row + view toggle row + filter row) collapsed to single bar.
- Collapsed chrome rows: **1** (gate passes `<= 1` criterion).
- Date navigation is keyboard accessible with Vietnamese labels.

## 5. Light-Only Visual Consistency

- Zero `dark:` classes across all audited component directories. Tailwind OKLCH light token surface is consistent.
- Zero decorative emojis. Icon usage confined to Lucide icons per UI invariant 3.

## Summary

| Criterion | Result |
|---|---|
| Action → Situation → Context order | PASS |
| Exactly 1 attention surface | PASS |
| View-First Toolbar (no duplicate controls) | PASS |
| Card-First Kanban (no permanent inline status select) | PASS |
| Content-First Calendar (collapsed chrome ≤ 1 row) | PASS |
| Light-only visual consistency | PASS |
