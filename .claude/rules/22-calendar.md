---
paths:
  - "src/components/calendar/**/*"
  - "src/app/calendar/**/*"
  - "src/lib/*calendar*.ts"
---
# Calendar Domain Invariants

1. **Dynamic Academic Cycles**: Never hard-code academic years, semesters, or months. Derive them dynamically via `src/lib/academic-calendar.ts`.
2. **Canonical Helpers**: Always calculate teaching weeks, holidays, and milestones using `src/lib/academic-calendar.ts` and `src/lib/work-calendar-adapter.ts`.
3. **Local Timezone Safety**: Never slice UTC strings (`toISOString().slice(0, 10)`) for deadlines or meeting schedules; use ICT (UTC+7) local date boundaries.
4. **Task Identity Integrity**: Calendar task markers must preserve canonical task IDs, status transitions, and drawer triggers identical to task tables.
5. **Adaptive Calendar Layout**: On compact mobile viewports, default to list/agenda views when multi-column month grids degrade readability.
