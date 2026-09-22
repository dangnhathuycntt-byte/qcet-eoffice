# ADR-001: Hợp nhất Maker-Checker / Separation of Duties Guard thành một hàm canonical duy nhất

- **Status**: ACCEPTED
- **Date**: 2026-09-22
- **Deciders**: Owner (Approved at Architecture Review Gate)

## Context

Hệ thống hiện có **3 implementation phân tán** của logic Separation of Duties (SoD) / Maker-Checker, mỗi implementation kiểm tra một tập hợp trường khác nhau và bỏ sót các trường quan trọng:

### 1. `TaskStateMachine.isMaker()` — `state-machine.ts:115-154`
- Kiểm tra: `driId`, `primaryOwnerId`, `assignees[].roleInTask === 'PRIMARY_OWNER'`, sole assignee (assigneeIds/assignees), `deliverableUploadedByIds`, `deliverables[].uploadedById`.
- **Bỏ sót**: `creatorId` / `createdById`, `submittedByUserId` — người tạo task có thể vượt qua guard này và tự phê duyệt qua FSM transition path `WAITING_APPROVAL → COMPLETED`.

### 2. `checkAntiSelfApproval()` — `contract.ts:96-172`
- Kiểm tra: `creatorId`, `createdById`, `primaryOwnerId`, `driId`, `assigneeIds`, `assignees[].userId`, `submittedByUserId`, `deliverableUploadedByIds`, `deliverables[].uploadedById`.
- **Đầy đủ nhất** — 5 role categories (creator, DRI, assignee, submitter, deliverable uploader) với violation codes riêng biệt.

### 3. `isTaskMaker()` — `attention-resolver.ts:185-259` (Attention Layer)
- Kiểm tra: `createdById`, `primaryOwnerId`, `driId`, `assignedToId`, `assignedTo` (string/object), `primaryOwner`, `assigneeIds`, `assignees` (string/object), `collaborators` (string/object), `coAssigneeIds`, `coAssignees`.
- **Đặc thù**: Chấp nhận `any`-typed task, xử lý nhiều shape variants (string, object, nested userId/id), nhưng **bỏ sót** `submittedByUserId` và `deliverableUploadedByIds`.
- Mục đích UI (attention resolution) nhưng gián tiếp ảnh hưởng đến SoD qua `canUserReviewTask()`.

### Hệ quả bảo mật

Khi FSM path (`state-machine.ts`) sử dụng `isMaker()` (dòng 345-351) để guard transition `WAITING_APPROVAL → COMPLETED`, người tạo task (`createdById`) **không bị chặn** vì `isMaker()` không kiểm tra trường này. Đây là lỗ hổng SoD cho phép self-approval qua FSM.

## Decision

Hợp nhất thành **một hàm canonical duy nhất** `checkSeparationOfDuties()` với đặc tả:

1. **Input contract cố định**: Kiểm tra đầy đủ 5 maker-role categories:
   - Creator (`creatorId` / `createdById`)
   - Primary Owner / DRI (`primaryOwnerId` / `driId`)
   - Assignee / Collaborator (`assigneeIds`, `assignees[].userId`)
   - Submitter (`submittedByUserId`)
   - Deliverable Uploader (`deliverableUploadedByIds`, `deliverables[].uploadedById`)

2. **Single violation code taxonomy**: Giữ nguyên `SOD_CREATOR_CANNOT_APPROVE`, `SOD_DRI_CANNOT_APPROVE`, `SOD_ASSIGNEE_CANNOT_APPROVE`, `SOD_SUBMITTER_CANNOT_APPROVE` từ `contract.ts`.

3. **FSM integration**: `TaskStateMachine.canTransition()` gọi trực tiếp hàm canonical thay vì `isMaker()` riêng biệt.

4. **Attention layer adapter**: `attention-resolver.ts` sử dụng canonical guard + adapter để xử lý any-typed shapes.

5. **Nguyên tắc Ủy quyền Không Vượt rào SoD (Delegation Invariant)**:
   - **Thẩm quyền phê duyệt có thể được ủy quyền**: Văn bản ủy quyền (`DelegationGrant`) có thể trao quyền hạn phê duyệt (`task.approve`) cho cấp phó hoặc cán bộ thụ lý theo quy định pháp lý.
   - **TUYỆT ĐỐI KHÔNG ĐƯỢC VƯỢT RÀO MAKER-CHECKER (MUST NOT bypass SoD)**: Một cá nhân là Maker của nhiệm vụ (người khởi tạo, người chịu trách nhiệm chính DRI, người th���c hiện, người nộp báo cáo hoặc người tải lên minh chứng) **TIẾP TỤC BỊ CẤM TUYỆT ĐỐI** khỏi việc phê duyệt hoặc nghiệm thu công việc của chính mình, **kể cả khi người đó đang nắm giữ giấy ủy quyền phê duyệt hợp lệ** từ Trưởng đơn vị hoặc Ban Giám hiệu.
   - Cơ chế ủy quyền chỉ cấp quyền phê duyệt thay thế cho các nhiệm vụ mà người được ủy quyền **không phải là Maker**. Khi đối tượng là Maker, quy tắc SoD có thứ tự ưu tiên cao hơn (precedence) và ghi đè (override) quyết định ủy quyền, trả về mã lỗi `SOD_VIOLATION`.

## Alternatives Considered

1. **Giữ 3 implementation riêng biệt, thêm test coverage**: Rủi ro cao — mỗi thay đổi business rule phải sync 3 nơi, dễ bỏ sót.

2. **Chỉ sửa `isMaker()` thêm `creatorId`**: Giải quyết lỗ hổng trước mắt nhưng không loại bỏ duplication, 3 implementations vẫn drift theo thời gian.

3. **Cho phép Ủy quyền ghi đè SoD**: Nếu Trưởng đơn vị ủy quyền cho Phó khoa, và Phó khoa làm DRI một nhiệm vụ thì Phó khoa được duyệt.
   - *Bác bỏ*: Vi phạm trực tiếp nguyên tắc kiểm soát quyền lực và phòng ngừa xung đột lợi ích theo Luật Phòng, chống tham nhũng và Quy chế hoạt động nhà trường.

## Consequences

### Tích cực
- Loại bỏ hoàn toàn lỗ hổng self-approval qua FSM path và qua cơ chế ủy quyền.
- Single source of truth cho SoD logic — mọi thay đổi business rule chỉ cần update 1 file.
- Violation codes nhất quán xuyên suốt API responses, audit logs, và UI error messages.

### Tiêu cực
- Attention resolver cần adapter layer để chuyển đổi any-typed task shapes sang canonical input.
- Breaking change nội bộ — tất cả callers của `isMaker()` và `checkAntiSelfApproval()` phải migrate.

## Migration Impact

| File | Thay đổi |
|------|----------|
| `src/domain/tasks/state-machine.ts` | Xóa `isMaker()`, import canonical guard |
| `src/domain/tasks/contract.ts` | Re-export từ canonical, deprecate local `checkAntiSelfApproval()` |
| `src/domain/tasks/attention-resolver.ts` | Adapter wrapping canonical guard cho any-typed input |
| `src/server/authorization/authorization-engine.ts` | Step 10 (SoD) kiểm tra sau Step 8 (Delegation) để bảo đảm SoD luôn chặn Maker dù có delegation |
| Toàn bộ callers FSM `.canTransition()` | Không đổi (internal refactor) |

## Evidence

| Bằng chứng | File:Line |
|------------|-----------|
| `isMaker()` thiếu `creatorId` | `src/domain/tasks/state-machine.ts:115-154` |
| `isMaker()` dùng trong approval guard | `src/domain/tasks/state-machine.ts:345-351` |
| `checkAntiSelfApproval()` đầy đủ 5 roles | `src/domain/tasks/contract.ts:96-172` |
| `isTaskMaker()` any-typed, thiếu submitter | `src/domain/tasks/attention-resolver.ts:185-314` |
| `canUserReviewTask()` phụ thuộc `isTaskMaker()` | `src/domain/tasks/attention-resolver.ts:148-183` |
| FSM approval path không chặn creator | `src/domain/tasks/state-machine.ts:340-351` |
| Step 10 SoD nằm sau Step 8 Delegation | `src/server/authorization/authorization-engine.ts:899-960` |

## Related ADRs

- [ADR-002](ADR-002-contextual-authorization-policy-engine.md) — Authorization engine (Step 10) cũng enforce SoD; canonical guard phải align.
- [ADR-003](ADR-003-task-lifecycle-with-derived-attention.md) — Task lifecycle statuses ảnh hưởng khi nào SoD guard được trigger.
