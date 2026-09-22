# ADR-002: Contextual Authorization Policy Engine (10-Step Pipeline)

- **Status**: ACCEPTED
- **Date**: 2026-09-22
- **Deciders**: Owner (pending Architecture Review Gate)

## Context

Hệ thống QCET E-Office phải tuân thủ khung pháp lý phức tạp (Luật Giáo dục nghề nghiệp, QĐ 283/QĐ-CĐKTCNQN, QĐ 420/QĐ-CĐKTCNQN, NĐ 30/2020/NĐ-CP, NĐ 13/2023/NĐ-CP, Luật 117/2025/QH15) đòi hỏi authorization không thể quy giản thành static role strings hay RBAC đơn thuần.

### Vấn đề với RBAC truyền thống

Thẩm quyền trong tổ chức giáo dục nghề nghiệp **không phải hàm đơn biến** của role:
- Phó Hiệu trưởng phụ trách Đào tạo **có thể** phê duyệt task thuộc lĩnh vực đào tạo nhưng **không thể** phê duyệt task thuộc lĩnh vực cơ sở vật chất.
- Trưởng phòng **chỉ có thể** thao tác trên resource thuộc đơn vị mình quản lý.
- Ủy quyền (Delegation) cho phép chuyên viên hành xử với thẩm quyền trưởng đơn vị trong phạm vi task được ủy quyền, nhưng **không thể ủy quyền** các quyền hạn bất khả ủy (NON_DELEGABLE_CAPABILITIES).
- Văn bản Tối mật (STATE_SECRET) bị cấm tuyệt đối trên nền tảng số — không exception, không delegation.

### Implementation hiện tại

`authorization-engine.ts` đã implement pipeline 10 bước nghiêm ngặt:

```
Step 1:  Account / Session Validation
Step 2:  Resource Classification (DATA_CLASSIFICATION)
Step 3:  Separation of Powers (Technical Admin ≠ Business Admin)
Step 4:  Direct Resource Relationship
Step 5:  Position Capability (via PositionAssignment)
Step 6:  Portfolio Responsibility (ResponsibilityArea)
Step 7:  Organizational Scope (Unit Boundary)
Step 8:  Valid Delegation (DacumDelegation)
Step 9:  Workflow State Guard
Step 10: Separation of Duties (Anti-Self-Approval, Signer ≠ Numberer, Submitter ≠ Archivist)
Default: DENY
```

## Decision

**Authority derives from the Contextual Authorization Policy Engine**, không từ static role strings.

### Nguyên tắc kiến trúc

1. **PositionAssignment là MỘT input** trong pipeline 10 bước, không phải quyết định duy nhất. Các nguồn thẩm quyền song song:
   - `User` (account status, system role)
   - `PositionAssignment` (vị trí chức danh)
   - `OrganizationalUnit` (ranh giới tổ chức)
   - `ResponsibilityArea` (lĩnh vực phụ trách — Portfolio)
   - `DacumDelegation` (ủy quyền có thời hạn)
   - `AuthorizationResource` (resource context: owner, state, classification)
   - Workflow state (FSM trạng thái hiện tại)
   - SoD invariants (phân lập trách nhiệm)

2. **Strict evaluation order**: Các step có thể DENY sớm nhưng không thể GRANT vượt step trước đó. Step 2 (Classification) chặn trước Step 5 (Position) — Phó Hiệu trưởng vẫn bị chặn nếu tài liệu là Tối mật.

3. **Default-deny**: Nếu không step nào GRANT, kết quả là DENY.

4. **Audit trail bắt buộc**: Mỗi kết quả authorization mang `AuditRecord` với `policyMatched` chỉ rõ step nào quyết định.

## Alternatives Considered

1. **Pure RBAC (Role → Permission mapping)**: Quá thô — không thể mô hình hóa Portfolio scope, delegation boundaries, hay document classification levels.

2. **ABAC (Attribute-Based Access Control) thuần túy**: Linh hoạt quá mức — khó audit, khó verify compliance với các nghị định cụ thể, khó debug khi quyết định sai.

3. **Policy-as-Code (OPA/Rego)**: Lợi ích về tách biệt policy và code, nhưng thêm runtime dependency, đội ngũ chưa có expertise, và latency concern cho mỗi authorization check.

## Consequences

### Tích cực
- Compliance với khung pháp lý phức tạp: Mỗi step map trực tiếp đến một yêu cầu pháp lý.
- Audit trail đầy đủ: `policyMatched` cho phép tra soát tại sao một thao tác bị chặn hoặc được phép.
- Extensibility có kiểm soát: Thêm step mới (ví dụ Step 2b: IP Geo-fencing) không phá vỡ pipeline hiện tại.
- Portfolio-aware: PHT phụ trách Đào tạo chỉ thấy và thao tác resource trong lĩnh vực của mình.

### Tiêu cực
- Complexity: 10 steps, 1473+ dòng code trong `authorization-engine.ts`.
- Performance: Mỗi authorization call có thể cần lookup PositionAssignment, DacumDelegation, ResponsibilityArea — cần caching strategy.
- Testing burden: Cần test matrix lớn covering tất cả 10 steps × rejection codes.

## Migration Impact

| Thành phần | Thay đổi |
|------------|----------|
| API route handlers (86 files) | Phải gọi `authorize()` hoặc `assertAuthorized()` thay vì role-check thủ công |
| FSM `canTransition()` | Step 9 (Workflow State) và Step 10 (SoD) phải align với FSM logic |
| Client-side capability checks | Server trả về capability matrix, client không tự quyết định |
| Delegation system | Tích hợp `DacumDelegation` model vào Step 8 |

## Evidence

| Bằng chứng | File:Line |
|------------|-----------|
| Pipeline 10-step specification | `src/server/authorization/authorization-engine.ts:1-24` |
| Step 1: Account validation | `src/server/authorization/authorization-engine.ts:145-177` |
| Step 2: Resource classification | `src/server/authorization/authorization-engine.ts:180+` |
| Step 3: Separation of Powers | `src/server/authorization/authorization-engine.ts` (TECHNICAL_ADMIN guard) |
| Step 5: Position capability | `src/server/authorization/authorization-engine.ts` (PositionAssignment lookup) |
| Step 6: Portfolio responsibility | `src/server/authorization/authorization-engine.ts` (PORTFOLIO_BOUND_ACTIONS) |
| Step 8: Delegation validation | `src/server/authorization/authorization-engine.ts` (DacumDelegation expiry/revocation) |
| Step 10: SoD — Task approval | `src/server/authorization/authorization-engine.ts:1330-1393` |
| Step 10: SoD — Signer ≠ Numberer | `src/server/authorization/authorization-engine.ts:1395-1422` |
| Step 10: SoD — Submitter ≠ Archivist | `src/server/authorization/authorization-engine.ts:1424-1447` |
| `assertAuthorized()` error taxonomy | `src/server/authorization/authorization-engine.ts:1479-1539` |
| 86 API route files | `src/app/api/***/route.ts` (86 files) |

## Related ADRs

- [ADR-001](ADR-001-single-canonical-maker-checker-guard.md) — SoD guard unification phải align với Step 10 của engine này.
- [ADR-005](ADR-005-task-assignee-to-actor-migration.md) — TaskActor model cung cấp richer actor context cho Step 4 (Direct Resource Relationship).
- [ADR-006](ADR-006-department-to-orgunit-consolidation.md) — OrganizationalUnit cung cấp hierarchical scope cho Step 7.
