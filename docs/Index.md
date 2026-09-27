# 🏠 QCET eOffice — Bộ não dự án

> Mở file này trong Obsidian (Open folder as vault → trỏ vào thư mục `docs/`).
> Dùng `[[...]]` để nhảy giữa các tài liệu, `Cmd+G` để xem Graph View.

---

## 📖 Tài liệu gốc (Root)
- [[MASTER_ARCHITECTURE_BLUEPRINT|🧭 MASTER_ARCHITECTURE_BLUEPRINT.md — Bản thiết kế toàn cảnh & La bàn chiến lược (Bắt đầu tại đây!)]]
- [[../ARCHITECTURE|ARCHITECTURE.md — Kiến trúc hệ thống]]
- [[../DESIGN|DESIGN.md — Design system tokens]]
- [[../PRODUCT|PRODUCT.md — Product definition]]
- [[../README|README.md — Tổng quan dự án]]

---

## 🗺️ Bản đồ tri thức

### Kiến trúc & Kỹ thuật
- [[architecture/enterprise-product-architecture|Kiến trúc tổng thể]]
- [[architecture/navigation|Navigation & Routing]]
- [[architecture/task-workspace|Task Workspace]]
- [[architecture/authentication|Authentication]]
- [[architecture/DATABASE_OPERATIONS|Database Operations]]
- [[architecture/api-inventory|API Inventory]]
- [[architecture/runtime-config|Runtime Config]]
- [[architecture/mobile|Mobile / PWA]]

### ADRs — Quyết định kiến trúc
- [[architecture/decisions/ADR-001-single-canonical-maker-checker-guard|ADR-001: Maker-Checker Guard]]
- [[architecture/decisions/ADR-002-contextual-authorization-policy-engine|ADR-002: Authorization Policy Engine]]
- [[architecture/decisions/ADR-003-task-lifecycle-with-derived-attention|ADR-003: Task Lifecycle]]
- [[architecture/decisions/ADR-004-document-status-two-tier-sync|ADR-004: Document Status Sync]]
- [[architecture/decisions/ADR-005-task-assignee-to-actor-migration|ADR-005: Assignee → Actor Migration]]
- [[architecture/decisions/ADR-006-department-to-orgunit-consolidation|ADR-006: Department → OrgUnit]]
- [[architecture/decisions/ADR-007-rest-api-standard-rfc9457|ADR-007: REST API Standard]]
- [[architecture/decisions/ADR-008-fileobject-canonical-model|ADR-008: FileObject Model]]

### RFCs — Đề xuất thiết kế
- [[architecture/decisions/RFC-01-task-assignee-actor-reconciliation|RFC-01: Task Actor]]
- [[architecture/decisions/RFC-02-department-orgunit-reconciliation|RFC-02: OrgUnit]]
- [[architecture/decisions/RFC-03-delegation-consolidation|RFC-03: Ủy quyền]]
- [[architecture/decisions/RFC-04-document-domain-location|RFC-04: Document Domain]]
- [[architecture/decisions/RFC-05-document-json-text-relations|RFC-05: Document Relations]]
- [[architecture/decisions/RFC-06-task-scope-origin-boundary|RFC-06: Task Scope]]
- [[architecture/decisions/RFC-07-action-inbox-notification-separation|RFC-07: Inbox/Notification]]
- [[architecture/decisions/RFC-08-user-directory-policy|RFC-08: User Directory]]
- [[architecture/decisions/RFC-09-dossier-read-policy|RFC-09: Dossier Read]]
- [[architecture/decisions/RFC-10-meeting-governance|RFC-10: Meeting Governance]]
- [[architecture/decisions/RFC-11-dossier-archival-governance|RFC-11: Dossier Archival]]

---

## 🏢 Nghiệp vụ — Domain Knowledge
- [[domain/README|Tổng quan nghiệp vụ]]
- [[domain/task-management|Quản lý công việc]]
- [[domain/incoming-documents|Văn bản đến]]
- [[domain/outgoing-documents|Văn bản đi]]
- [[domain/records-archive|Hồ sơ & Lưu trữ]]
- [[domain/delegations|Ủy quyền]]
- [[domain/authority|Thẩm quyền]]
- [[domain/organization|Cơ cấu tổ chức]]
- [[domain/positions|Chức danh & Vị trí]]
- [[domain/permission-matrix|Ma trận phân quyền]]
- [[domain/regulations_knowledge_base|Quy định pháp luật]]

---

## 📦 Sản phẩm — Product
- [[product/roles-and-scopes|Vai trò & Phạm vi]]
- [[product/invariants|Bất biến hệ thống]]
- [[product/metrics|Metrics]]

### Specs
- [[product/specs/SPEC_MODULE_VAN_BAN_VA_DIEU_HANH|SPEC: Module Văn bản & Bút phê (Nghị định 30)]]
- [[product/specs/SPEC_BAN_LAM_VIEC_UIUX_STANDARD|SPEC: Bàn làm việc UI/UX]]
- [[product/specs/SPEC_DASHBOARD_DATA_CONSISTENCY_AND_AGGREGATION|SPEC: Dashboard Data]]
- [[product/specs/SPEC-QCET-PERF-2025-01|SPEC: Performance]]
- [[product/specs/SPEC_ERADICATE_MOCKUPS_AND_REAL_QCET_ALIGNMENT|SPEC: Real Alignment]]

---

## 🎨 UX & Giao diện
- [[ux/QCET_UI_VOCABULARY|Bộ từ vựng giao diện]]
- [[ux/WORLD_CLASS_UI_UX_PRINCIPLES|Nguyên tắc UI/UX]]

---

## 🔒 Bảo mật & Vận hành
- [[security/data-classification|Phân loại dữ liệu]]
- [[security/secrets|Quản lý Secrets]]
- [[security/logging-policy|Logging Policy]]
- [[operations/deployment|Deployment]]
- [[operations/staging|Staging]]
- [[operations/rollback|Rollback]]
- [[operations/retention|Data Retention]]

---

## 🔍 Audit & Remediation
- [[architecture/audits/security-debt-triage|Security Debt Triage]]
- [[architecture/audits/doc-dossier-action-auth-audit|Doc/Dossier Auth Audit]]
- [[architecture/audits/file-authorization-audit|File Authorization Audit]]
- [[architecture/audits/outbox-infrastructure-assessment|Outbox Assessment]]
- [[architecture/remediation/task-overdue-remediation|Task Overdue Remediation]]

---

## 📋 Kế hoạch đang triển khai
- [[plans/active/2026-09-09-database-architecture-hardening-plan|DB Hardening Plan]]
- [[plans/active/qcet-calendar-ux-remediation-source-aware-plan-2026-09-13|Calendar UX Remediation]]
- [[plans/active/qcet-portal-workspace-ux-remediation-plan-2026-09-13|Portal Workspace UX]]
- [[plans/active/qcet-source-uiux-remediation-plan-65f99561|Source UI/UX Remediation]]
- [[plans/active/qcet-task-management-app-shell-ux-consolidation-plan-2026-09-13|Task App Shell UX]]

---

## 🗃️ Database Models (Prisma)

| Domain | Models |
|--------|--------|
| **Auth** | `User`, `Account`, `Session`, `VerificationToken` |
| **Task** | `Task`, `TaskDeliverable`, `TaskActor`, `TaskSequence`, `TaskRelation`, `TaskApprovalProcess`, `TaskApprovalStep`, `TaskResult` |
| **Document** | `Document`, `DocumentNumberSequence`, `DocumentAttachment`, `DocumentDirective`, `DocumentIncomingWorkflow`, `DocumentOutgoingWorkflow`, `UnitWorkAssignment`, `SignatureRecord` |
| **Organization** | `OrganizationalUnit`, `UnitClosurePath`, `OrganizationalBody`, `BodyMembership` |
| **HR** | `PositionDefinition`, `PositionAssignment`, `ResponsibilityArea`, `PortfolioAssignment`, `JobCatalogItem`, `DacumDuty`, `DacumTaskDef` |
| **Delegation** | `DelegationGrant`, `DelegationScopeRule` |
| **Executive** | `ExecutiveResolution` |
| **Dossier** | `WorkDossier`, `DossierItem` |
| **Meeting** | `Meeting`, `MeetingParticipant`, `MeetingResolution` |
| **Notification** | `Notification`, `PushSubscription` |
| **Infra** | `AuditEvent`, `OutboxEvent`, `RetentionRule`, `IdempotencyRecord` |

---

## 🧠 Domain Code (`src/domain/`)

| Module | File | Chức năng |
|--------|------|-----------|
| `tasks/` | `state-machine.ts` | FSM vòng đời công việc |
| | `canonical-semantics.ts` | Chuẩn hóa trạng thái hiển thị |
| | `deadlines.ts` | Tính toán trạng thái hạn chót |
| | `display-config.ts` | Cấu hình hiển thị status/priority |
| | `contract.ts` | Domain contract/interface |
| | `attention-resolver.ts` | Xác định mức độ chú ý cần thiết |
| | `create-task-policy.ts` | Chính sách tạo công việc |
| | `subtask-status-guard.ts` | Guard trạng thái subtask |
| `documents/` | `unit-assignment-status.ts` | Trạng thái giao việc đơn vị |
| `notifications/` | `controlled-vocabulary.ts` | Từ vựng chuẩn thông báo |

---

*Cập nhật lần cuối: 2026-09-26*
