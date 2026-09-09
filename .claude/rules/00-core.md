# Core System Invariants

These universal invariants apply unconditionally across all files and operations in QCET E-Office:

1. **One Capability, One Implementation**: Never create parallel engines, secondary components, or duplicate stores.
2. **Role Is Not Scope**: Role defines user authority; Scope defines dataset filter (`school`, `unit`, `personal`).
3. **Server Truth Wins**: Database state and authenticated server session always override cached or client state.
4. **Never Invent Operational Data**: Use real schema records; never create mock data or fake business metrics.
5. **Preserve Unrelated Changes**: Never overwrite, discard, or format away unrelated user code or parallel work.
6. **Never Weaken Security to Pass Tests**: Server-side RBAC and validation must never be bypassed or diluted.
7. **Never Claim Unexecuted Verification**: Run verification commands directly and inspect outputs before claiming success.
8. **Git Safety**: Never push, rebase interactively, or force-reset without explicit user instruction.
