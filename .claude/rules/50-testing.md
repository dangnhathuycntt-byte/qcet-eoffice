---
paths:
  - "tests/**/*"
---
# Testing Philosophy

## Regression Protection
- Every bug fix needs regression protection at the LOWEST-COST appropriate layer.
- Prefer EXTENDING an existing test case over creating a new test file.
- Do NOT add source-text regex assertions — use ESLint rules for static invariants.
- Do NOT assert exact Tailwind class names — use lint/design-token enforcement.
- Do NOT create a new test file if an existing file tests the same component or behavior.

## Verification Gate (during implementation)
Run after each meaningful implementation change:
```
npm run typecheck
npm run lint --if-present
npx vitest run <affected-test-file>
```
Do NOT run `npm test` (full suite) on every iteration.

## Integration Gate (before PR merge)
Run the full suite only at final integration boundaries:
```
npm run typecheck && npm test
```

## Test Layers
- **test:smoke** — 5-10 critical sanity checks
- **test:unit** — pure logic, no I/O, fast
- **test:security** — auth, RBAC, JWT, permission enforcement
- **test:domain** — business rules, state machines, workflow transitions
- **test:critical** — security + domain (pre-commit gate)
- **test:integration** — API routes, data integrity, Prisma
- **test:full** — entire suite (CI/final gate only)

## What to Test
**Keep strong**: security/auth, data integrity, API contracts, domain state machines, task workflow transitions.

**Avoid**: Tailwind class assertions, source-file regex, file-existence checks, duplicate coverage of the same component from multiple test files.

## Anti-patterns
- "Every bug fix needs a new test file" — inflates test count without improving coverage; extend existing tests instead.
- Asserting a CSS class is present — brittle, breaks on refactor, zero behavioral value.
- Reading source files with `readFileSync` in tests — tests implementation, not behavior.
- Skipping tests and reporting them as passed — never report unexecuted or skipped tests as passing.
