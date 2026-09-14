# QCET E-Office - Agent Working Foundation

## Mission
QCET E-Office is the institutional administration, academic operations, and task management operating system for Quang Ninh College of Economic and Technology (Trường Cao đẳng Kinh tế và Công nghệ Quy Nhơn).

## Canonical Documentation
Read only the smallest set of files directly relevant to your task. Do not recursively scan docs/, artifacts/, historical plans, or generated output.

- **System Architecture**: `ARCHITECTURE.md` — read only sections relevant to your task.
- **Active Plans**: `docs/plans/active/` — read only the plan for your current task.
- **Product Invariants**: `docs/product/` — read only when changing user-facing behavior.
- **Do NOT read**: `docs/agent-work/`, `docs/superpowers/`, completed/superseded plans, or any artifact/report directories.

## Universal Invariants

- **One Capability, One Implementation**: Never build parallel engines, duplicate workflows, or temporary V2 facades. Consolidate into the single canonical owner.
- **Role Is Not Scope**: Role = authority (who can act); Scope = dataset filter (`school`, `unit`, `personal`). Never substitute role checks for scope filters.
- **Server Truth Wins**: Database and authenticated session are authoritative. Client state and optimistic UI must yield.
- **Never Invent Operational Data**: Use real schema records. No fake metrics, fabricated records, or hardcoded fallback IDs.
- **Preserve Unrelated Changes**: Keep edits strictly confined to the assigned task. Never overwrite parallel work.
- **Never Weaken Security to Pass Tests**: Server-side RBAC and validation must never be bypassed or diluted.
- **Never Claim Unexecuted Verification**: Run verification commands and inspect real output before claiming success.
- **Git Safety**: Keep commits focused and atomic. Never rebase or force-reset without explicit user instruction.

## Change Workflow
1. Read only the canonical files directly relevant to your task before authoring code.
2. Formulate an explicit plan before editing multi-file subsystems.
3. Validate changes: run `npm run typecheck` and AFFECTED tests only. Run the full suite (`npm test`) only at explicit integration gates or when the task requires it.
