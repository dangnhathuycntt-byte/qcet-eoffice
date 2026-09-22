# ADR-005: TaskAssignee → TaskActor Migration

- **Status**: PROPOSED (remains PROPOSED until RFC-01 completes)
- **Date**: 2026-09-22
- **Deciders**: Owner (pending Architecture Review Gate)

## Context

Prisma schema hiện chứa **cả hai model `TaskAssignee` và `TaskActor`** cùng tồn tại, với Task model reference cả hai:

### Model `TaskAssignee` — Legacy (đơn giản)
```prisma
model TaskAssignee {
  id         String       @id @default(cuid())
  taskId     String       @map("task_id")
  userId     String       @map("user_id")
  roleInTask AssigneeRole @default(PRIMARY_OWNER) @map("role_in_task")
  assignedAt DateTime     @default(now()) @map("assigned_at")
  // Relations: task, user
  @@unique([taskId, userId, roleInTask])
}

enum AssigneeRole {
  PRIMARY_OWNER
  COLLABORATOR
  SUPERVISOR
}
```
*Nguồn: `prisma/schema.prisma:278-290`, enum `prisma/schema.prisma:68-72`*

### Model `TaskActor` — New (rich context)
```prisma
model TaskActor {
  id           String              @id @default(cuid())
  taskId       String              @map("task_id")
  userId       String?             @map("user_id")       // Optional — có thể assign cho unit
  unitId       String?             @map("unit_id")       // NEW: assign cho OrganizationalUnit
  role         TaskActorRole                              // 9 roles thay vì 3
  isPrimaryDRI Boolean             @default(false)
  assignedById String?             @map("assigned_by_id") // NEW: ai phân công
  appointedAt  DateTime            @default(now())
  notes        String?
  // Relations: task, user, unit, assignedBy
}

enum TaskActorRole {
  ASSIGNER, LEAD_UNIT, COORDINATING_UNIT, DRI, COLLABORATOR,
  FOLLOWER, REVIEWER, APPROVER, OBSERVER
}
```
*Nguồn: `prisma/schema.prisma:1157-1176`, enum `prisma/schema.prisma:1116-1126`*

### Sự khác biệt quan trọng

| Đặc điểm | TaskAssignee | TaskActor |
|-----------|-------------|-----------|
| Roles | 3 (PRIMARY_OWNER, COLLABORATOR, SUPERVISOR) | 9 (ASSIGNER, LEAD_UNIT, DRI, REVIEWER, APPROVER, ...) |
| Assign cho unit | Không | Có (`unitId`) |
| Track ai phân công | Không | Có (`assignedById`) |
| Primary DRI flag | Qua `roleInTask = PRIMARY_OWNER` | Explicit `isPrimaryDRI` boolean |
| userId | Required | Optional (unit assignment) |

### Cả hai model đang active

Task model reference cả hai:
```prisma
model Task {
  assignees    TaskAssignee[]    // Legacy
  actors       TaskActor[]       // New
}
```
*Nguồn: `prisma/schema.prisma:237, 253`*

Domain code (`state-machine.ts`, `contract.ts`, `attention-resolver.ts`) chủ yếu đọc từ `assignees` (TaskAssignee shape), trong khi authorization engine cần rich context từ TaskActor (unit assignment, assignedBy).

## Decision

Migrate từ `TaskAssignee` sang `TaskActor` là model canonical duy nhất cho task-actor relationships:

1. **TaskActor là source of truth** cho tất cả actor-task relationships.
2. **TaskAssignee giữ lại read-only** trong giai đoạn transition (dual-write/dual-read) cho backward compatibility.
3. **Domain code migrate sang TaskActor interface** — FSM, contract, attention resolver phải đọc từ `actors[]` thay vì `assignees[]`.
4. **RFC-01 document** sẽ specify:
   - Data migration strategy (existing TaskAssignee records → TaskActor)
   - Role mapping: `PRIMARY_OWNER → DRI`, `COLLABORATOR → COLLABORATOR`, `SUPERVISOR → REVIEWER | APPROVER`
   - Write path cutover timeline
   - TaskAssignee deprecation và eventual removal

## Alternatives Considered

1. **Chỉ dùng TaskAssignee, mở rộng AssigneeRole**: Không support unit assignment (`unitId`), không track `assignedById`, schema thay đổi lớn nhưng vẫn limited.

2. **Giữ cả hai model vĩnh viễn**: Dual-write complexity, inconsistency risk cao, tăng query cost (join 2 tables).

3. **Merge fields vào Task model trực tiếp**: Phá vỡ normalization — một task có thể có N actors, cần separate table.

## Consequences

### Tích cực
- **9 roles** mô hình hóa đầy đủ quy trình hành chính: ASSIGNER (người giao), LEAD_UNIT (đơn vị chủ trì), COORDINATING_UNIT (đơn vị phối hợp), DRI (người chịu trách nhiệm chính), COLLABORATOR, FOLLOWER, REVIEWER, APPROVER, OBSERVER.
- **Unit-level assignment**: Task có thể giao cho `OrganizationalUnit` trước khi Trưởng đơn vị phân công xuống cá nhân — phù hợp quy trình 2 tier (BGH → Đơn vị → Cá nhân).
- **Audit trail**: `assignedById` + `appointedAt` cho phép tra soát ai giao việc cho ai, khi nào.
- **Authorization engine alignment**: TaskActor roles map trực tiếp vào authorization Step 4 (Direct Resource Relationship).

### Tiêu cực
- **Dual-model period**: Trong giai đoạn transition, cần sync 2 bảng hoặc dual-read.
- **Breaking change cho domain code**: `isMaker()`, `checkAntiSelfApproval()`, `isTaskMaker()` tất cả đọc `assignees[]` — phải refactor.
- **Data migration risk**: Phải map existing TaskAssignee records sang TaskActor chính xác, đặc biệt `SUPERVISOR → REVIEWER vs APPROVER`.

## Migration Impact

| Thành phần | Thay đổi |
|------------|----------|
| `prisma/schema.prisma` | Deprecate `TaskAssignee` (keep read-only), `TaskActor` canonical |
| DB migration | Insert `TaskActor` records from existing `TaskAssignee` data |
| `state-machine.ts` | `TaskContext.assignees` → `TaskContext.actors` with `TaskActorRole` |
| `contract.ts` | `SoDEvaluationContext.assignees` → actor-based check |
| `attention-resolver.ts` | `isTaskMaker()` → check `TaskActor.role` thay vì generic shape matching |
| API route handlers | Write to `TaskActor`, deprecate `TaskAssignee` write path |
| UI components | Actor picker thay vì assignee picker (support unit selection) |

## Evidence

| Bằng chứng | File:Line |
|------------|-----------|
| `TaskAssignee` model (legacy) | `prisma/schema.prisma:278-290` |
| `AssigneeRole` enum (3 giá trị) | `prisma/schema.prisma:68-72` |
| `TaskActor` model (new) | `prisma/schema.prisma:1157-1176` |
| `TaskActorRole` enum (9 giá trị) | `prisma/schema.prisma:1116-1126` |
| Task references both models | `prisma/schema.prisma:237` (`assignees`) và `:253` (`actors`) |
| Domain code đọc `assignees` | `src/domain/tasks/state-machine.ts:126-141` |
| Domain code đọc `assignees` | `src/domain/tasks/contract.ts:77, 143-153` |
| Attention resolver any-typed `assignees` | `src/domain/tasks/attention-resolver.ts:282-311` |

## Related ADRs

- [ADR-001](ADR-001-single-canonical-maker-checker-guard.md) — SoD guard phải migrate sang TaskActor roles.
- [ADR-002](ADR-002-contextual-authorization-policy-engine.md) — TaskActor provides richer context cho Authorization Step 4.
- [ADR-006](ADR-006-department-to-orgunit-consolidation.md) — TaskActor.unitId references OrganizationalUnit, không Department.
