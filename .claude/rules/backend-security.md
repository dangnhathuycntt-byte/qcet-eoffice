---
paths:
  - "src/app/api/**/*"
  - "src/lib/server/**/*"
  - "src/lib/auth*"
  - "src/context/**/*"
  - "src/components/auth/**/*"
  - "prisma/**/*"
---
# Backend, Security & Data Integrity Invariants

## API Routes

1. **Authentication Required**: Authenticate all protected routes with a server session check before executing business logic.
2. **Server-Side Authorization**: Enforce RBAC on the server. Never trust role, department, or permissions supplied in a client request.
3. **Payload Validation**: Validate and sanitize every mutation payload (POST, PUT, PATCH) before persistence.
4. **Canonical Error Shape**: API errors follow `{ error: string, code?: string }` with correct HTTP status codes.
5. **No Production Bypass**: No guest, demo, or unauthenticated developer mock fallbacks in production endpoints.
6. **Information Leak Prevention**: Never expose database internals, stack traces, raw error dumps, or secrets in responses.

## Authentication & Authorization

7. **Server Session Truth**: The server session is the sole authority for authentication. localStorage and cookie state are UI cache only.
8. **Role Isolation**: Role grants authority; dataset scope governs visible operational boundaries. Never conflate the two.
9. **Separation of Duties**: Workflow actions enforce role segregation — a task's creator cannot be its sole approver.
10. **Secret & Token Protection**: Never expose session tokens, password hashes, webhook secrets, or private keys to the client.
11. **No Insecure Shortcuts**: Never add convenience auth shortcuts, hardcoded tokens, or permissive bypasses.

## Data Integrity

12. **One Metric, One Definition**: Operational metrics (completion rate, overdue counts, active tasks) have a single canonical formula across every surface.
13. **Denominator Integrity**: Explicitly distinguish parent tasks from subtasks. Never silently mix parent and subtask denominators in completion calculations.
14. **No Synthetic Business Data**: Never inject fake progress numbers, fabricated audit logs, or synthetic operational metadata into queries or pipelines.
15. **Canonical Date Helpers**: Academic dates, week numbers, and deadlines use `src/lib/academic-calendar.ts` in Indochina Time (ICT, UTC+7).
16. **Database Truth Wins**: Database state is canonical. Optimistic updates reconcile against server truth.
17. **Query-Stat Derivation Symmetry**: Filtered lists and their displayed count badges derive from identical query semantics and filters.
