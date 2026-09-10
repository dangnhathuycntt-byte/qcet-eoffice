# QCET E-Office - Agent Working Foundation

## Mission
QCET E-Office is the institutional administration, academic operations, and task management operating system for Quang Ninh College of Economic and Technology (Trường Cao đẳng Kinh tế và Công nghệ Quảng Ninh).

## Canonical Documentation
Consult canonical references before designing or modifying architecture:
- System Architecture: `ARCHITECTURE.md`
- Product Specifications & Invariants: `docs/product/`
- Architectural Deep-Dives: `docs/architecture/`
- Active Execution Plans: `docs/plans/active/`

## Universal Invariants
All agents and contributors across all environments must uphold these invariants:

- **One Capability, One Canonical Implementation**:
  Never build parallel engines, duplicate workflows, or temporary V2 facades. Consolidate logic into the single canonical owner.

- **Role Is Not Scope**:
  Role represents authority (who can take action); Scope represents the active dataset filter (`school`, `unit`, `personal`). Never substitute role checks for dataset filters.

- **Server Truth Wins**:
  The server database and authenticated session are authoritative. Client state, cached storage, and optimistic UI must always yield to server truth.

- **Never Invent Operational Data**:
  Use actual database entities and relationships. Never introduce fake metrics, fabricated operational records, or hardcoded fallback identifiers.

- **Preserve Unrelated Changes**:
  Keep edits strictly confined to the assigned task. Never revert, overwrite, or reformat unrelated user changes or parallel work.

- **Never Weaken Security to Pass Tests**:
  Enforce server-side authentication, authorization, and input validation. Never bypass RBAC or relax security assertions to satisfy test suites.

- **Never Claim Verification That Was Not Run**:
  Assertions require real proof. Always execute checks (`npm run typecheck`, `npm test`) and inspect outputs before claiming success.

- **Git Safety**:
  Keep commits focused and atomic. Never push, rebase, or force-reset without explicit user instruction.

## Change Workflow
1. Inspect canonical documentation and existing implementations before authoring code.
2. Formulate an explicit plan before editing multi-file subsystems.
3. Validate all changes with automated tests and typecheck before claiming completion.
