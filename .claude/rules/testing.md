---
paths:
  - "tests/**/*"
---
# Testing Invariants

## Regression Protection

1. **Lowest-cost layer**: Every bug fix needs regression protection at the cheapest layer that actually catches the defect. That is often a domain or unit test, not a new UI test.
2. **Extend before creating**: Prefer extending an existing test case over adding a new test file. If an existing file already covers the component or behaviour, add there.
3. **No source-text assertions**: Do not assert on source code text (`readFileSync` + regex/`assert.match`). It tests implementation, breaks on refactor, and passes vacuously against comments. Enforce static invariants with ESLint or a single global scan.
4. **No Tailwind class assertions**: Do not assert exact class names. Enforce design tokens and the light-only standard via lint or the canonical global audit.
5. **No file-existence tests** unless the file itself is an architecture invariant.

## Verification Gates

**During implementation** — after each meaningful change:

```
npm run typecheck
npm run lint
node_modules/.bin/tsx --test <affected-test-file.ts>   # or: npm run test:critical
```

Do **not** run the full suite on every iteration.

**Before PR merge / at integration boundaries**:

```
npm run typecheck && npm test
```

## Test Layers

| Script | Scope |
| --- | --- |
| `test:smoke` | 5–10 critical sanity checks |
| `test:unit` | pure logic, no I/O, parallel |
| `test:security` | auth, RBAC, JWT, permission enforcement |
| `test:domain` | business rules, state machines, workflow transitions |
| `test:critical` | security + domain — the pre-commit gate |
| `test:integration` | API routes, data integrity, Prisma (serial) |
| `test:full` | entire suite — CI / final gate only |

## What to Test

**Keep strong**: security and authorization, data integrity, API contracts, domain state machines, task workflow transitions, separation of duties.

**Avoid**: Tailwind class assertions, source-file regex, file-existence checks, duplicate coverage of one component across several files.

## Anti-Patterns

- "Every bug fix needs a new test file" — inflates the suite without improving coverage.
- Asserting a CSS class is present — brittle, zero behavioural value.
- Reading source files with `readFileSync` — tests implementation, not behaviour.
- Duplicating one invariant across many files because it was introduced in different sprints.
- Skipping tests and reporting them as passed — never report unexecuted or skipped tests as passing.
- Never weaken a security or domain assertion merely to make a suite green. If a test is wrong, fix the test with evidence; if the code is wrong, fix the code.
