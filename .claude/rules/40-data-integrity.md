---
paths:
  - "src/lib/**/*"
  - "src/lib/server/**/*"
  - "src/components/workspace/hooks/**/*"
  - "prisma/**/*"
---
# Data Integrity Invariants

1. **One Metric, One Definition**: Operational metrics (completion rate, overdue counts, active tasks) must have a single canonical formula across all surfaces.
2. **Denominator Integrity**: Explicitly distinguish parent tasks from subtasks. Never mix parent and subtask denominators silently in completion calculations.
3. **No Synthetic Business Data**: Never inject fake progress numbers, fabricated audit logs, or synthetic operational metadata into data queries or pipelines.
4. **Canonical Date Helpers**: All academic dates, week numbers, and deadlines must use `src/lib/academic-calendar.ts` in Indochina Time (ICT, UTC+7).
5. **Database Truth Wins**: Database state is canonical. Client state and optimistic updates must reconcile against server truth.
6. **Query-Stat Derivation Symmetry**: Filtered item lists and displayed count badges/metrics must derive from identical query semantics and filters.
