---
paths:
  - "src/components/tasks/**/*"
  - "src/components/workspace/**/*"
  - "src/app/tasks/**/*"
  - "src/app/unit-tasks/**/*"
  - "src/hooks/use-task-*.ts"
  - "src/lib/tasks/**/*"
---
# Task Domain Invariants

1. **Canonical Engine**: All task views render through `UnifiedAdaptiveWorkspace` with `ModularCascadingTaskTable`. Never build parallel task tables or alternate workspace shells.
2. **Single Filter Source of Truth**: All task filtering, search, sorting, and pagination must be driven exclusively by `useTaskFilters`.
3. **No Duplicate Toolbars**: Never instantiate secondary search inputs, duplicate status tabs, or independent view switchers outside the unified toolbar.
4. **Role Is Not Scope**: User role controls write permissions; Scope determines visible dataset (`school` = toàn trường, `unit` = đơn vị/khoa/phòng, `my` = cá nhân).
5. **Hierarchical Integrity**: Always preserve parent task and subtask relationships during filtering, grouping, and rendering.
6. **State Synchronization**: Breadcrumbs, tab badges, search query params, active filters, and item counts must remain strictly synchronized with URL state.
7. **Canonical Utilities**: Use canonical task and date helpers (`src/lib/tasks/*`, `src/lib/academic-calendar.ts`). Never implement ad-hoc date parsers.
8. **No Facade Expansion**: Legacy route wrappers and compatibility facades must only delegate into the canonical engine; never add new business UI to legacy wrappers.
