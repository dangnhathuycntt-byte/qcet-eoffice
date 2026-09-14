---
paths:
  - "tests/**/*"
---
# Testing Invariants

## Philosophy

Every test is maintenance baggage. A good test catches real bugs cheaply. A bad test breaks on valid refactors, inflates the suite, and degrades signal.

> Trustworthy 1500 tests > noisy 4500 tests.

## What to Test Strongly

- **Security & authorization**: RBAC, JWT, session, separation of duties, permission enforcement
- **Data integrity**: Prisma schema constraints, foreign keys, cascades, check constraints
- **API contracts**: Request/response shapes, status codes, error structures
- **Domain state machines**: Task workflow transitions, delegation authority, business rules
- **Business logic**: Calculations, filters, sort orders, date logic

## What Not to Test

- **Tailwind class names**: CSS implementation changes constantly; visual behavior stays
- **Source code text** via `readFileSync` + regex: tests implementation, breaks on refactor, passes vacuously
- **File existence**: unless the file is an architecture invariant (e.g. `middleware.ts`)
- **Exact import paths**: refactoring file structure should not break tests
- **Component structure**: internal JSX nesting, prop drilling shape, render order

## Regression Protection

1. **Lowest-cost layer**: Every bug fix needs regression protection at the cheapest layer that catches the defect. A domain/unit test beats a UI test.
2. **Extend before creating**: Prefer extending an existing test case over adding a new file. If a file covers the component or behavior, add there.
3. **No source-text assertions**: Enforce static invariants with ESLint rules or architecture fitness tests, not `readFileSync` + regex.
4. **Consolidate over accumulate**: Before adding a test, check if existing tests already cover the invariant. During implementation, run affected tests — not the full suite.

## Verification Gates

**During implementation** — after each meaningful change:

```
npm run typecheck
npm run lint
node_modules/.bin/tsx --test <affected-test-file.ts>   # or: npm run test:changed
```

Do **not** run the full suite on every iteration.

**Before commit** — quick confidence gate:

```
npm run test:critical
```

**Before PR merge / at integration boundaries**:

```
npm run typecheck && npm test
```

## Test Layers

| Script | Scope | When |
| --- | --- | --- |
| `test:changed` | tests affected by git diff | after each edit |
| `test:smoke` | 5–10 critical sanity checks | quick validation |
| `test:unit` | pure logic, no I/O, parallel | local dev |
| `test:security` | auth, RBAC, JWT, permission enforcement | security changes |
| `test:domain` | business rules, state machines, workflow transitions | domain changes |
| `test:critical` | security + domain — the pre-commit gate | before commit |
| `test:integration` | API routes, data integrity, Prisma (serial) | API changes |
| `test:full` | entire suite — CI / final gate only | merge to main |

## Anti-Patterns

- "Every bug fix needs a new test file" — inflates the suite without improving safety.
- Asserting CSS class presence — brittle, zero behavioral value.
- Reading source files with `readFileSync` — tests implementation, not behavior.
- Duplicating one invariant across many files because it was introduced in different sprints.
- Running the full suite (4000+ tests) after changing one component.
- Skipping tests and reporting them as passed — never claim unexecuted verification.
- Weakening security/domain assertions to make a suite green — fix the test or fix the code, with evidence.
