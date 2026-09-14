# Core System Invariants

These universal invariants apply unconditionally across all files and operations in QCET E-Office.

1. **One Capability, One Implementation**: Never create parallel engines, secondary components, or duplicate stores. Consolidate into the single canonical owner.
2. **Role Is Not Scope**: Role defines authority (who can act); Scope defines the dataset filter (`school`, `unit`, `personal`). Never substitute a role check for a dataset filter, and never let scope selection widen or narrow statutory authority.
3. **Server Truth Wins**: Database state and the authenticated server session are authoritative. Client state, cached storage, and optimistic UI always yield to server truth.
4. **Never Invent Operational Data**: Use real schema records and relationships. No fake metrics, fabricated operational records, synthetic audit logs, or hardcoded fallback identifiers.
5. **Preserve Unrelated Changes**: Keep edits confined to the assigned task. Never overwrite, discard, or reformat unrelated work or parallel changes.
6. **Never Weaken Security to Pass Tests**: Server-side RBAC, authentication, and validation must never be bypassed or diluted to satisfy a test suite.
7. **Never Claim Unexecuted Verification**: Run the verification commands and inspect real output before claiming success.
8. **Git Safety**: Keep commits focused and atomic. Never rebase or force-reset without explicit user instruction.

## Authority Model

Institutional authority is expressed through statutory Vietnamese vocational-education titles (Hiệu trưởng, Phó Hiệu trưởng, Trưởng phòng, Phó Trưởng phòng, Trưởng khoa, Phó Trưởng khoa, Chuyên viên, Giảng viên, Văn thư) and the capability engine — not a generic three-tier SaaS triad.

- **Do not add new values to the `UserRole` enum** to express a business authority that the capability engine can already derive.
- **Do not author new client-side `user.role` branches** for authorization. Authority is evaluated server-side; the client renders what the server authorizes.
- **`TaskScope` is a display and query-aggregation filter only.** It must never grant, restrict, or assert operational permissions, write authority, or approval rights.
- **DACUM job duties are occupational analysis, not software permissions.** Never bind workflow transitions or approval rights to DACUM duty codes.
- Authorization changes belong in the canonical capability engine (`src/lib/**authority*`, `src/lib/**capability*`), not in ad-hoc role conditionals.
