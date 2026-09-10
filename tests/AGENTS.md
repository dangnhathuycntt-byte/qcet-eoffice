# Test Invariants

- **Encode Real Requirements**: Regression tests must encode actual requirements, not implementation quirks.

- **Deterministic Time**: Use deterministic date/time mocks pinned to Indochina Time (ICT, UTC+7).

- **Never Weaken Assertions**: Never weaken assertions or relax bounds to turn a failing test green.

- **Test Isolation Boundaries**: Explicitly test authentication, role-based access, and scope boundaries.
