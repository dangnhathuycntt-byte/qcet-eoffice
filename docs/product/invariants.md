# QCET E-Office — Universal Product Invariants

**Document Status**: Canonical Reference  
**Scope**: Universal Product Rules, Non-Negotiable System Invariants  
**Last Updated**: 2026-09-09  

---

## 1. Overview & Purpose

This document establishes the fundamental, non-negotiable product invariants of QCET E-Office. Every feature, refactor, API handler, user interface component, and background automation must adhere to these principles without exception.

---

## 2. Universal Product Invariants

### Invariant 1: Light-Only Standard (Zero Dark Mode)
- **Administrative Context**: QCET E-Office serves an educational and administrative institution (Cao đẳng Công nghệ Quang Châu) where institutional documents, official dispatches, and formal directives are reviewed in professional daytime office environments.
- **Styling Architecture**: The styling system is strictly Light-Only, implemented with Tailwind CSS v4 OKLCH tokens in `src/app/globals.css`.
- **Enforcement**:
  - The `@custom-variant dark (&:not(*));` rule permanently disables dark-mode compilation.
  - Never introduce `dark:` utility classes, `.dark` CSS selectors, or `ThemeProvider` contexts.
  - All color tokens derive from semantic administrative variables (`bg-background`, `border-border`, `text-foreground`, `text-muted-foreground`).

### Invariant 2: Role Is Not Scope
- **Clear Distinction**:
  - **Role** (`ADMIN`, `BAN_GIAM_HIEU`, `TRUONG_PHONG`, `CHUYEN_VIEN`, etc.) defines **Authority & Permissions** — what actions an actor may perform (e.g., approve deliverables, assign tasks, issue directives, delete records).
  - **Scope** (`school`, `unit`, `my`) defines **Dataset Visibility** — which subset of institutional records the user is currently viewing.
- **Decoupled Operation**:
  - Switching scope changes the query filter, never the user's authority.
  - A Rector (Role: `BAN_GIAM_HIEU`) in `my` scope sees only personal assignments but retains school-wide executive approval authority.
  - A Specialist (Role: `CHUYEN_VIEN`) viewing `unit` scope sees department tasks but cannot approve or reassign colleagues' deliverables.

### Invariant 3: Server Truth Wins
- **Canonical Authority**:
  - The server database (PostgreSQL / SQLite via Prisma) and the cryptographically verified server session (`jwt-session.ts`) are the sole sources of truth.
  - Local browser storage (`localStorage`, `sessionStorage`) and in-memory React state are purely ephemeral client caches.
- **Reconciliation Invariant**:
  - Optimistic client mutations must immediately reconcile with the response from the server route handler.
  - If a server validation or permission check rejects a mutation, the client UI must roll back cleanly to server state.
  - Client-side data must never overwrite server records without authoritative backend validation.

### Invariant 4: Zero Synthetic Operational Data
- **Real Business Integrity**:
  - The platform operates on real organizational data: active faculty tasks, accredited courses, actual departments, and authentic document dispatches.
  - Never fabricate fake KPI numbers, synthetic completion rates, placeholder employee records, or mock audit logs.
- **Zero-State Dignity**:
  - When an entity has no tasks or deliverables, display an authentic empty state (`Chưa có nhiệm vụ`) rather than generating simulated numbers or placeholder progress bars.
  - All aggregation pipelines must calculate values strictly from database rows.

### Invariant 5: Separation of Duties (Maker-Checker Invariant)
- **Institutional Governance**:
  - To prevent administrative conflicts of interest and uphold auditing standards, operational actions enforce role segregation.
  - **Creator != Sole Approver**: A staff member who creates or submits a task deliverable cannot be the sole approver who signs off on completion.
  - **Submitter != Reviewer**: Deliverable review (`/api/tasks/[id]/deliverables`) requires an independent supervisor, Department Head (`TRUONG_PHONG`), or Executive (`BAN_GIAM_HIEU`).
  - System bypasses, self-approval shortcuts, or guest privilege escalations are forbidden in production.

### Invariant 6: Deterministic Verification
- **Predictable Time & Calendar**:
  - Academic deadlines, overdue thresholds, and week numbers must be evaluated against deterministic reference times using `src/lib/academic-calendar.ts`.
  - All date calculations are pinned to Indochina Time (ICT, UTC+7).
- **Test Integrity**:
  - Automated tests must encode real institutional requirements, not artificial implementation quirks.
  - Never weaken assertions, widen tolerances, or mock away security checks to force a test suite to pass.

---

## 3. Invariant Violation Consequences

Any code submission introducing:
1. Alternate task tables or duplicated workspace engines,
2. Dark-mode variant classes (`dark:`),
3. Entanglement between user role and dataset scope,
4. Synthetic or hardcoded business metrics,
5. Unchecked client-side authorization bypasses,

will be rejected during automated quality gates (`npm run typecheck`, `npm test`) or code review.
