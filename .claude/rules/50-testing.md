---
paths:
  - "tests/**/*"
---
# Testing & Quality Invariants

1. **Encode Intended Behavior**: Tests must verify intended business rules, not mirror flawed current behavior.
2. **Never Weaken Assertions**: Do not relax test expectations, broaden matchers, or delete assertions merely to make tests green.
3. **Deterministic Time Mocks**: Mock system clocks and dates deterministically for academic periods, deadlines, and overdue logic.
4. **Boundary Testing**: Explicitly test role boundaries, scope restrictions (`school`, `unit`, `my`), and authorization rejection paths.
5. **Regression Coverage**: Every bug fix must include an automated regression test reproducing the original failure.
6. **Authentic Reporting**: Never report unexecuted or skipped tests as passed. Run `npm test` and verify genuine passing assertions.
