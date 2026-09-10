# QCET E-Office — Business Domain & Workflow Re-Baseline Execution Plan

> **Authority**: Quy chế làm việc QCET 283/QĐ-CĐKTCNQN (19/08/2026), Quy chế tổ chức & hoạt động 282/QĐ-CĐKTCNQN, Quyết định phân công BGH 420/QĐ-CĐKTCNQN, Thông tư 63/2026/TT-BGDĐT, Nghị định 232/2026/NĐ-CP, Nghị định 30/2020/NĐ-CP, Nghị định 68/2024/NĐ-CP, Luật Lưu trữ 33/2024/QH15, Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15.
> **Universal Invariants**:
> 1. Role Is Not Scope
> 2. One Capability, One Canonical Implementation
> 3. Server Truth Wins
> 4. Never Invent Operational Data
> 5. Never Weaken Security to Pass Tests

---

### Task 1: Phase 4B — Task Domain Commands & State Separation APIs

- **Scope**: Implement typed domain command endpoints replacing generic PATCH for tasks:
  - `POST /api/tasks/[id]/actions/submit-result`
  - `POST /api/tasks/[id]/actions/review`
  - `POST /api/tasks/[id]/actions/request-revision`
  - `POST /api/tasks/[id]/actions/approve`
  - `POST /api/tasks/[id]/actions/reassign`
  - `POST /api/tasks/[id]/actions/remind`
- **Requirements**:
  - Connect with `src/lib/services/task-actor-service.ts` and `src/lib/auth/hybrid-authorization.ts`.
  - Validate Maker-Checker / SoD rules (DRI/Submitter cannot approve own work).
  - Enforce atomic transaction, audit logging (`AuditEvent`), and outbox event publishing.
  - Return canonical error responses (`{ error, code }`) on authorization failure.
  - Add comprehensive integration tests in `tests/task-domain-commands.test.ts`.

---

### Task 2: Phase 5 — Incoming Documents V2 Domain & Workflow

- **Scope**: Implement Incoming Document schema, lifecycle, and two-tier directive workflow.
- **Requirements**:
  - Lifecycle: `RECEIVED` -> `REGISTERED` -> `PRESENTED` -> `DIRECTED` -> `ASSIGNED_TO_LEAD_UNIT` -> `UNIT_ASSIGNED_PERSON` -> `IN_PROGRESS` -> `RESOLVED` -> `FILED` -> `ARCHIVED`.
  - Two-tier delegation:
    - Tier 1: School Leadership (`DocumentDirective` to Lead Unit & Coordinating Units with instruction, deadline, responsibility area).
    - Tier 2: Unit Head (`UnitWorkAssignment` appointing individual DRI and collaborators).
  - Schema additions in `prisma/schema.prisma`: `DocumentIncomingWorkflow`, `UnitWorkAssignment` or appropriate relational entities linking to `OrganizationalUnit` and `User`.
  - Command APIs:
    - `POST /api/documents/incoming` (registration by Văn thư)
    - `POST /api/documents/[id]/actions/present` (trình lãnh đạo)
    - `POST /api/documents/[id]/actions/direct` (lãnh đạo giao đơn vị chủ trì)
    - `POST /api/documents/[id]/actions/assign-unit` (trưởng đơn vị phân công DRI cá nhân)
    - `POST /api/documents/[id]/actions/resolve` (báo cáo giải quyết xong)
    - `POST /api/documents/[id]/actions/file` (lập hồ sơ/nộp lưu)
  - Service layer in `src/lib/services/incoming-document-service.ts`.
  - Integration tests in `tests/incoming-documents-v2.test.ts`.

---

### Task 3: Phase 6 — Outgoing Documents V2 & Digital Signatures

- **Scope**: Implement Outgoing Document lifecycle and digital signature records.
- **Requirements**:
  - Outgoing lifecycle: `DRAFT` -> `CONTENT_REVIEW` -> `FORMAT_CHECK` -> `AUTHORIZED_SIGN` -> `NUMBERED` -> `ORGANIZATION_SIGNED` -> `ISSUED` -> `DELIVERED` -> `FILED` -> `ARCHIVED`.
  - Strict separation of concepts:
    - Content approval != Authorized person signature != Organization digital signature (con dấu điện tử) != Issue.
  - Schema additions in `prisma/schema.prisma`:
    - `SignatureRecord` (documentId, version, signerAssignmentId, signingCapacity, signatureType, certificateMetadata, signedAt, verificationStatus).
    - Version immutability: once `SIGNED`, content at that version cannot be modified; any correction requires a new version.
  - Command APIs under `/api/documents/outgoing/...` and `/api/documents/[id]/actions/...`:
    - `submit-content-review`, `approve-content`
    - `submit-format-check`, `approve-format`
    - `sign` (ký chức danh / ký thẩm quyền)
    - `assign-number` (văn thư cấp số văn bản đi)
    - `organization-sign` (văn thư đóng dấu số cơ quan)
    - `issue` (phát hành)
  - Service layer in `src/lib/services/outgoing-document-service.ts`.
  - Integration tests in `tests/outgoing-documents-v2.test.ts`.

---

### Task 4: Phase 7 — Work Dossier & Archival Domain

- **Scope**: Implement Work Dossier and Archival subsystem per Luật Lưu trữ 2024 & NĐ 30.
- **Requirements**:
  - Schema additions:
    - `WorkDossier`: id, code, title, owningUnitId, responsiblePersonId, openedAt, closedAt, retentionRuleId, status (`OPEN`, `ACTIVE`, `CLOSED`, `READY_FOR_ARCHIVE`, `SUBMITTED_TO_ARCHIVE`, `ACCEPTED`, `ARCHIVED`).
    - `DossierItem`: dossierId, itemType (`DOCUMENT`, `TASK`, `RESULT`, `DECISION`, `MEETING_MINUTES`, `ATTACHMENT`), itemId, title, addedById, addedAt.
    - `RetentionRule`: code, name, durationYears, legalBasis.
  - Service layer in `src/lib/services/dossier-service.ts`.
  - APIs:
    - `POST /api/dossiers`
    - `POST /api/dossiers/[id]/items`
    - `POST /api/dossiers/[id]/actions/close`
    - `POST /api/dossiers/[id]/actions/submit-archive`
    - `POST /api/dossiers/[id]/actions/accept-archive`
  - Integration tests in `tests/work-dossier-archive.test.ts`.

---

### Task 5: Phase 8 — Institutional Meetings, Bodies & Resolutions

- **Scope**: Implement Meeting workflows and formal Resolutions linked to Institutional Bodies.
- **Requirements**:
  - Link with `OrganizationalBody` (`COUNCIL`, `COMMITTEE`, `STEERING_COMMITTEE`, `WORKING_GROUP`).
  - Schema additions:
    - `InstitutionalMeeting`: id, bodyId, title, organizerId, scheduledAt, location, status (`DRAFT_AGENDA`, `INVITED`, `HELD`, `MINUTES_DRAFT`, `MINUTES_CONFIRMED`, `RESOLUTIONS_ISSUED`), agenda, minutesText.
    - `MeetingResolution`: id, meetingId, code, title, content, effectiveDate, signatoryId.
  - Service layer in `src/lib/services/meeting-service.ts`.
  - APIs under `/api/meetings/...`.
  - Integration tests in `tests/institutional-meetings.test.ts`.

---

### Task 6: Phase 9 — Context API, Action Inbox & Data Classification

- **Scope**: Implement dynamic user context and domain-derived Action Inbox.
- **Requirements**:
  - `GET /api/me/context`:
    - Returns authenticated identity, active position assignments with units, view scopes, assigned responsibility areas (portfolios), technical capabilities, active delegations.
  - `GET /api/me/inbox`:
    - Derives actionable items across tasks waiting for action (as DRI or Approver), documents awaiting direction (for leaders) or assignment (for unit heads), signatures awaiting signer, dossiers awaiting archive acceptance.
    - Each item carries: resource, requiredAction, deadline, and `reasonWhyMe` (e.g., "Bạn là Trưởng đơn vị chủ trì", "Bạn được ủy quyền đến 14/09/2026").
    - Each item carries `availableActions`.
  - Data Classification tagging:
    - Support classification levels: `PUBLIC`, `INTERNAL`, `RESTRICTED`, `PERSONAL_DATA`.
    - Server-side filter ensuring RESTRICTED and PERSONAL_DATA require appropriate position or assignment.
  - Integration tests in `tests/user-context-action-inbox.test.ts`.

---

### Task 7: Phase 10 — Comprehensive DoD & Acceptance Test Verification

- **Scope**: Execute and verify all 11 institutional acceptance scenarios defined in Section 50 of the Re-Baseline plan.
- **Requirements**:
  - Test scenario 1: PHT đào tạo -> task tài chính -> DENY.
  - Test scenario 2: PHT đào tạo -> task đào tạo -> ALLOW.
  - Test scenario 3: PHT hành chính -> task tuyển sinh -> ALLOW.
  - Test scenario 4: System Admin -> approve official document -> DENY (SoP).
  - Test scenario 5: Văn thư -> assign document number -> ALLOW, approve content -> DENY.
  - Test scenario 6: Head of Unit A -> Task unit B -> DENY.
  - Test scenario 7: Collaborator -> update own progress -> ALLOW, replace DRI -> DENY.
  - Test scenario 8: Delegation valid -> delegated action -> ALLOW.
  - Test scenario 9: Delegation expired -> same action -> DENY.
  - Test scenario 10: Signed document -> edit same version -> DENY (Version Immutability).
  - Test scenario 11: System Admin -> confidential HR resource -> DENY.
  - Run full test suite (`npm test`) and full TypeScript check (`npm run typecheck`).
  - Generate comprehensive verification report.
