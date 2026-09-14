---
paths:
  - "src/app/**/*.tsx"
  - "src/components/**/*"
  - "src/hooks/**/*"
  - "tests/*mobile*.test.ts"
---
# UI, Layout & Domain Surface Invariants

## Visual & Component Standards

1. **Light-Only Standard**: Tailwind CSS v4 OKLCH light tokens only. Never use `dark:` variants, `.dark` classes, or theme switchers.
2. **Semantic Tokens**: Ground values in DESIGN.md tokens (`bg-background`, `border-border`, `text-foreground`, `text-muted-foreground`, administrative accents). Never raw palette colours for semantic surfaces.
3. **Restrained Iconography**: Lucide icons default to `strokeWidth={1.5}`. No decorative emojis, no coloured icon enclosure boxes.
4. **Typography**: Minimum text size 12px (`text-xs`). Display and body use `Be Vietnam Pro` with correct Vietnamese diacritics. Numeric metrics and dates use `font-mono tabular-nums`.
5. **Accessibility**: Every interactive element needs an accessible name (`aria-label` or visible text), a visible focus ring, and valid roles.
6. **Action Hierarchy**: Exactly one prominent primary CTA per flow; secondary actions use outline or ghost variants.
7. **No Duplicate Controls**: Never render duplicate search bars, parallel toolbars, or conflicting view toggles in the same view tree.

## Mobile & Layout

8. **Adaptive, Not Shrunk**: Compact UI adapts structure (cards, agenda, sheets) rather than horizontally squeezing desktop tables.
9. **Centralized Spacing**: `AppShell` owns global mobile safe-area padding and bottom-navigation offset. Never stack ad-hoc `pb-20`/`pb-24` in child views.
10. **Touch Ergonomics**: Primary tap targets (buttons, inputs, tabs) provide at least 44×44px (`min-h-[44px]`).
11. **Mobile Surfaces**: Detail views and action sheets use dedicated slide-up sheets or full-viewport overlays with explicit dismiss controls.
12. **Keyboard Safety**: Never obscure a focused input with a virtual keyboard or sticky bottom bar; use `src/hooks/use-virtual-keyboard.ts` offset guards.

## Task Domain

13. **Canonical Engine**: Task views render through `UnifiedAdaptiveWorkspace` with `ModularCascadingTaskTable`. Never build parallel task tables or alternate workspace shells.
14. **Single Filter Source of Truth**: All task filtering, search, sorting, and pagination is driven exclusively by `useTaskFilters`.
15. **Hierarchical Integrity**: Preserve parent task and subtask relationships through filtering, grouping, and rendering.
16. **State Synchronization**: Breadcrumbs, tab badges, search params, active filters, and item counts stay strictly synchronized with URL state.
17. **Canonical Date Helpers**: Use `src/lib/tasks/*` and `src/lib/academic-calendar.ts`. Never write ad-hoc date parsers.
18. **No Facade Expansion**: Legacy route wrappers and compatibility facades only delegate into the canonical engine; never add business UI to a wrapper.

## Document Domain

19. **Canonical Registry & Detail**: One registry model and detail drawer across all document types. Never build separate detail pages.
20. **Directional Semantics**: Keep incoming (`van_ban_den`) and outgoing (`van_ban_di`) lifecycles and metadata strictly distinct.
21. **Authentic Metadata**: Real document numbers, issuing entities, dates, and signers only. Never invent document IDs or signatories.
22. **Canonical Viewer**: Reuse the canonical PDF/document viewer. Never introduce parallel preview modals or ad-hoc file loaders.

## Calendar Domain

23. **Dynamic Academic Cycles**: Never hard-code academic years, semesters, or months. Derive them via `src/lib/academic-calendar.ts`.
24. **Local Timezone Safety**: Never slice UTC strings (`toISOString().slice(0, 10)`) for deadlines or meetings; use ICT (UTC+7) local date boundaries.
25. **Task Identity Integrity**: Calendar task markers preserve canonical task IDs, status transitions, and drawer triggers identical to task tables.
26. **Adaptive Calendar Layout**: On compact viewports default to list/agenda when multi-column month grids degrade readability.
