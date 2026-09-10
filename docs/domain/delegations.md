# QCET E-Office — Domain Specification: Delegations & Authority Grants
**Document Code:** `SPEC-DOMAIN-DEL-2026-01`  
**Domain:** First-Class Delegation Grants, Operational Lifecycles, and Multi-Level Authorization  
**Institution:** Trường Cao đẳng Kinh tế và Công nghệ Quảng Ninh (QCET)  
**Status:** Canonical Domain Specification  
**Version:** 1.0.0  
**Effective Date:** 2026-09-09  

---

## 1. Executive Domain Summary

The Delegation domain provides a **first-class, audit-proof, regulatory-grounded mechanism** for transferring operational and administrative capabilities between appointed officeholders. In higher education governance, institutional leadership must maintain operational continuity during official travel, research leave, or cross-departmental coordination, without degrading institutional accountability or creating security backdoors.

Under Vietnamese administrative law and institutional regulations, **an individual does not delegate their personal identity; an officeholder delegates a bounded subset of capabilities associated with their position assignment**.

### 1.1. Core Regulatory Foundations
1. **Bộ luật Dân sự số 91/2015/QH13 (Điều 138, Điều 142)**: Quy định về đại diện theo ủy quyền; xác lập nguyên tắc người được ủy quyền chỉ được thực hiện hành vi trong phạm vi ủy quyền và **tuyệt đối không được ủy quyền lại (cấm tái ủy quyền)** trừ trường hợp người ủy quyền đồng ý bằng văn bản.
2. **Quyết định số 283/QĐ-CĐKTCNQN (19/08/2026)**: Quy chế làm việc của Nhà trường (Điều 3, Điều 4: Nguyên tắc ủy quyền điều hành, ký văn bản và giải quyết công việc).
3. **Thông báo số 619/TB-CĐKTCNQN**: Về việc phân công, ủy quyền điều hành giải quyết công việc của Ban Giám hiệu và các Trưởng đơn vị trong thời gian đi công tác hoặc vắng mặt.
4. **Quyết định số 420/QĐ-CĐKTCNQN (03/12/2025)**: Phân công nhiệm vụ cụ thể của Ban Giám hiệu và thẩm quyền ký thay Hiệu trưởng (KT. HIỆU TRƯỞNG).
5. **Nghị định số 30/2020/NĐ-CP (Điều 13)**: Thẩm quyền và thể thức ký thừa ủy quyền (TUQ. HIỆU TRƯỞNG), ký thay (KT. HIỆU TRƯỞNG) trong văn bản hành chính.

### 1.2. Ubiquitous Language (Ngôn ngữ chung)
- **DelegationGrant (Văn bản ủy quyền điện tử)**: Bản ghi thực thể hạng nhất (First-Class Entity) trao quyền có thời hạn từ một vị trí công tác giao quyền sang một vị trí công tác nhận quyền, có đầy đủ căn cứ pháp lý.
- **Grantor Assignment (`fromAssignment`)**: Bản vị trí công tác của người có thẩm quyền gốc thực hiện việc ủy thác quyền hạn.
- **Grantee Assignment (`toAssignment`)**: Bản vị trí công tác của viên chức tiếp nhận quyền hạn được ủy thác.
- **Delegated Capability (`capability`)**: Quyền năng kỹ thuật cụ thể được phép chuyển giao (ví dụ: `task:approve_step1`, `document:sign_level2`, `deliverable:evaluate`).
- **Responsibility Area Filter (`responsibilityArea`)**: Giới hạn mảng công tác được ủy quyền (ví dụ: chỉ được phê duyệt trong mảng `TRAINING` hoặc `FACILITIES`).
- **Resource Scope (`resourceScope`)**: Phạm vi tài nguyên mà quyền ủy quyền có hiệu lực (`INSTITUTION_WIDE`, `UNIT_ONLY`, `SPECIFIC_TASK`, `SPECIFIC_DOCUMENT_TYPE`).
- **Source Document (`sourceDocument`)**: Số, ký hiệu và ngày tháng của văn bản pháp lý ủy quyền (ví dụ: *"Thông báo số 619/TB-CĐKTCNQN"*, *"Quyết định số 142/QĐ-CĐKTCNQN"*).
- **Sub-Delegation (Tái ủy quyền)**: Việc người được ủy quyền tiếp tục ủy quyền cho người thứ ba. **Mặc định bị cấm tuyệt đối trên toàn hệ thống**.
- **Maker-Checker Anti-Self-Approval Invariant**: Ràng buộc bất biến ngăn chặn người được ủy quyền tự phê duyệt nhiệm vụ hoặc sản phẩm minh chứng do chính mình làm chủ trì hoặc tải lên.

---

## 2. Domain Model & Aggregate Definition

### 2.1. DelegationGrant Aggregate

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DelegationGrant (Aggregate Root)                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ - id: UUID / CUID                                                           │
│ - fromAssignmentId: UUID (FK -> PositionAssignment of Grantor)              │
│ - toAssignmentId: UUID (FK -> PositionAssignment of Delegate)               │
│ - capability: String (e.g., "task:approve_step1", "document:sign_level2")   │
│ - responsibilityArea: ResponsibilityArea? (Optional portfolio filter)       │
│ - resourceScope: DelegationResourceScope                                    │
│   (INSTITUTION_WIDE | UNIT_ONLY | SPECIFIC_TASK | SPECIFIC_DOC_TYPE)        │
│ - specificResourceId: String? (Task ID or Category Code if bounded)         │
│ - validFrom: DateTime (Enforced in ICT / UTC+7)                             │
│ - validUntil: DateTime (Enforced in ICT / UTC+7)                            │
│ - sourceDocument: String (e.g., "TB 619/TB-CĐKTCNQN ngày 12/09/2026")       │
│ - reason: String (e.g., "Hiệu trưởng đi công tác theo QĐ số 45/QĐ-UBND")    │
│ - status: DelegationStatus (ACTIVE | REVOKED | EXPIRED | PENDING)           │
│ - noSubDelegation: Boolean = true [HARD INVARIANT]                          │
│ - revokedAt: DateTime?                                                      │
│ - revokedByAssignmentId: UUID?                                              │
│ - revokeReason: String?                                                     │
│ - createdAt: DateTime                                                       │
│ - updatedAt: DateTime                                                       │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ 1
                                       │
                                       │ 0..*
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       DelegatedActionAuditLog (Entity)                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ - id: UUID                                                                  │
│ - delegationGrantId: UUID                                                   │
│ - executedByUserId: UUID (The actual person acting)                         │
│ - actingAssignmentId: UUID                                                  │
│ - onBehalfOfAssignmentId: UUID (The original officeholder)                  │
│ - actionName: String (e.g., "APPROVE_DELIVERABLE_STEP1")                    │
│ - resourceType: String (e.g., "task", "document")                           │
│ - resourceId: String                                                        │
│ - timestamp: DateTime (ICT, UTC+7)                                          │
│ - ipAddress: String                                                         │
│ - userAgent: String                                                         │
│ - signatureHash: String? (SHA-256 hash of signed content)                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Delegation Lifecycle & State Machine

```
               [Creation Request]
                       │
                       │ (Validates Preconditions & Eligibility)
                       ▼
                    ACTIVE ────────────────────────────────┐
                       │                                   │
       ┌───────────────┴───────────────┐                   │
       │ (validUntil < CURRENT_TIME)   │ (Manual Revoke)   │ (Grantor Position
       ▼                               ▼                   │  Assignment Ends)
    EXPIRED                         REVOKED                │
  (Terminal)                      (Terminal)               ▼
                                                        REVOKED
                                                  (System Automated)
```

### 3.1. Automatic Expiration
1. The validity window `[validFrom, validUntil]` is evaluated at the exact microsecond of transaction execution in Indochina Time (ICT, UTC+7).
2. If `CURRENT_TIMESTAMP > validUntil`, any attempt to exercise the capability fails with `403 Forbidden` (`DELEGATION_EXPIRED`).
3. A scheduled reconciliation service periodically flags expired records from `ACTIVE` to `EXPIRED` for reporting cleanliness, but authorization logic **does not depend on this background job**; it validates timestamps in-line during every request.

### 3.2. Manual Revocation
1. An active delegation may be revoked at any time prior to `validUntil` by:
   - The Grantor (`fromAssignment.userId`).
   - The Institutional Chief Executive (Hiệu trưởng, `BGH_HT`).
   - An authorized System Administrator (`ADMIN`).
2. Revocation is instantaneous; active user sessions holding cached capability tokens are invalidated immediately via WebSocket / Server-Sent Events signals.

---

## 4. Fundamental System Invariants

### Invariant 1: Strict Prohibition of Sub-Delegation (Không tái ủy quyền)
- **Legal Rule**: Theo Điều 142 Bộ luật Dân sự 2015, người được ủy quyền không có quyền ủy quyền lại thẩm quyền đã nhận cho người khác nếu không có văn bản chấp thuận trước của người ủy quyền ban đầu.
- **System Invariant**: Khi một người dùng `User_B` sở hữu quyền lực thông qua `DelegationGrant_1` (nhận từ `User_A`), hệ thống **chặn đứng hoàn toàn** khả năng tạo `DelegationGrant_2` trong đó `fromAssignment` là quyền lực phát sinh từ `DelegationGrant_1`.
- **Enforcement**:
  ```typescript
  if (assignment.isDelegatedAuthority) {
    throw new DomainException(
      "SUB_DELEGATION_PROHIBITED", 
      "Theo Bộ luật Dân sự và Quy chế 283, viên chức được ủy quyền tuyệt đối không được ủy quyền lại cho người khác."
    );
  }
  ```

### Invariant 2: Maker-Checker & Anti-Self-Approval (Chống tự phê duyệt)
- **Legal Rule**: Quy chế làm việc QĐ 283/QĐ-CĐKTCNQN và nguyên tắc kiểm soát xung đột lợi ích.
- **System Invariant**: Viên chức nhận ủy quyền quyền phê duyệt (ví dụ: Phó Trưởng phòng nhận ủy quyền từ Trưởng phòng) **tuyệt đối không được phê duyệt**:
  1. Nhiệm vụ do chính mình làm người chịu trách nhiệm chính (`PRIMARY_OWNER`).
  2. Sản phẩm minh chứng do chính mình tải lên (`uploadedById === session.user.id`).
  3. Đề xuất tài chính hoặc văn bản do chính mình khởi tạo.
- **Fallback Routing**: Khi xảy ra xung đột lợi ích này, thẩm quyền phê duyệt phải được:
  - Tự động định tuyến vượt cấp lên Ban Giám hiệu phụ trách mảng tương ứng.
  - Hoặc bảo lưu để Trưởng phòng giải quyết trực tiếp khi hết thời gian vắng mặt.

### Invariant 3: Strict Prohibition of Delegating Non-Delegable Statutory Powers (Thẩm quyền luật định bất khả chuyển giao)
- **Legal Rule**: Căn cứ Luật Giáo dục nghề nghiệp, Thông tư số 63/2026/TT-BGDĐT (Điều lệ Trường Cao đẳng), Luật Ngân sách Nhà nước và Quy chế 283/QĐ-CĐKTCNQN.
- **System Invariant**: Dù có văn bản ủy quyền tạm thời (kể cả trường hợp Hiệu trưởng ủy quyền điều hành cho Phó Hiệu trưởng khi đi công tác theo Thông báo 619), các thẩm quyền pháp định tối cao sau đây **tuyệt đối không được chuyển giao** qua `DelegationGrant` tác nghiệp thông thường:
  1. Ký quyết định bổ nhiệm, điều động, luân chuyển, biệt phái, miễn nhiệm, kỷ luật nhân sự lãnh đạo cấp Trưởng, Phó đơn vị (`position.manage_leadership`, `hr.disciplinary_action`).
  2. Quyền Chủ tài khoản ngân sách nhà nước đã đăng ký và cam kết mẫu dấu, chữ ký với Kho bạc Nhà nước tỉnh Quảng Ninh (thẩm quyền rút dự toán KBNN).
  3. Ký văn bản sửa đổi, bổ sung Quy chế tổ chức và hoạt động, Quy chế chi tiêu nội bộ của Nhà trường.
- **Enforcement (`NON_DELEGABLE_CAPABILITIES`)**:
  ```typescript
  export const NON_DELEGABLE_CAPABILITIES: CapabilityAction[] = [
    "position.manage_leadership",
    "hr.disciplinary_action",
    "finance.treasury_disbursement",
    "regulation.institutional_amend"
  ];

  export function assertDelegableCapability(capability: CapabilityAction): void {
    if (NON_DELEGABLE_CAPABILITIES.includes(capability)) {
      throw new DomainException(
        "NON_DELEGABLE_POWER_VIOLATION",
        `Thẩm quyền ${capability} là quyền luật định tối cao của Hiệu trưởng, tuyệt đối không được chuyển giao qua ủy quyền tác nghiệp.`
      );
    }
  }
  ```

### Invariant 4: Ubiquitous Language & Entity Alignment (`DelegationGrant` vs `DacumDelegation`)
- **Domain Standard**: `DelegationGrant` là Aggregate Root chuẩn tắc duy nhất của miền Ủy quyền (First-Class Domain Entity).
- **Prisma Transition**: Mô hình `DacumDelegation` hiện diện trong `schema.prisma` là tên bảng chuyển tiếp (Transitional Schema Layer). Trong Phase 3-4 của Lộ trình Di trú, bảng dữ liệu này sẽ được chuẩn hóa thành `delegation_grants` với đầy đủ các thuộc tính ràng buộc quan hệ `fromAssignmentId`, `toAssignmentId`, `sourceDocument` và cờ kiểm soát `noSubDelegation`.

---

## 5. Structured Business Rules

### Rule DEL-01: Granting Operational Delegation (Thông báo 619 & QĐ 283)
- **Source regulation**: Thông báo số 619/TB-CĐKTCNQN; Quyết định số 283/QĐ-CĐKTCNQN Điều 4; Bộ luật Dân sự 2015 Điều 138.
- **Business actor**: Người giữ chức danh lãnh đạo có thẩm quyền gốc (Hiệu trưởng, Phó Hiệu trưởng, Trưởng phòng, Trưởng khoa, Giám đốc trung tâm).
- **Precondition**:
  1. Người giao quyền phải đang có `PositionAssignment` ở trạng thái `ACTIVE`.
  2. Người nhận quyền phải có `PositionAssignment` tích cực tại đơn vị (đối với cấp phòng/khoa) hoặc trong Nhà trường (đối với Ban Giám hiệu).
  3. Phải có văn bản ủy quyền gốc (`sourceDocument`) ghi rõ số hiệu, trích yếu và lý do vắng mặt.
  4. Khoảng thời hạn ủy quyền `validUntil` phải lớn hơn `validFrom`, và không được vượt quá 30 ngày đối với ủy quyền hành chính thông thường (trừ trường hợp quyết định cử đi học/công tác dài hạn có phê duyệt của Hiệu trưởng).
- **Action**: Tạo bản ghi `DelegationGrant` với trạng thái `ACTIVE`.
- **Resource**: Thực thể `DelegationGrant`.
- **Result**: Người nhận quyền có thể tạm thời thực thi các quyền năng được chỉ định trong khoảng thời gian hiệu lực.
- **Exceptions**:
  - `400 Bad Request`: Thiếu căn cứ văn bản `sourceDocument` hoặc khoảng thời gian không hợp lệ.
  - `403 Forbidden`: Người giao quyền không có quyền hạn gốc tương ứng hoặc đang cố gắng tái ủy quyền.
  - `422 Unprocessable Entity`: Người nhận quyền đang bị kỷ luật hoặc đang trong trạng thái nghỉ dài hạn.
- **Audit requirement**: Ghi nhật ký `DELEGATION_GRANTED` với mã định danh người giao quyền, người nhận quyền, danh sách quyền năng được ủy thác, văn bản căn cứ và địa chỉ IP.

---

### Rule DEL-02: Execution of Delegated Authority & Non-Repudiation Logging
- **Source regulation**: Luật Giao dịch điện tử số 20/2023/QH15; Nghị định số 30/2020/NĐ-CP Điều 13.
- **Business actor**: Viên chức nhận quyền được ủy thác (`toAssignment`).
- **Precondition**:
  1. Bản ghi `DelegationGrant` đang ở trạng thái `ACTIVE`.
  2. `CURRENT_TIMESTAMP >= validFrom` và `CURRENT_TIMESTAMP <= validUntil`.
  3. Hành động yêu cầu khớp với `capability` và nằm trong `responsibilityArea` / `resourceScope`.
  4. Thỏa mãn điều kiện Maker-Checker (không phê duyệt sản phẩm của chính mình).
- **Action**: Thực hiện hành động nghiệp vụ (ký văn bản, duyệt minh chứng nhiệm vụ).
- **Resource**: Thực thể nghiệp vụ đích (`Task`, `Document`, `TaskDeliverable`).
- **Result**: Hành động được thực thi thành công. Hệ thống tự động ghi nhận dấu ấn ủy quyền:
  - Trên giao diện: Hiển thị rõ danh nghĩa *"Được ủy quyền bởi [Họ tên Người giao quyền] theo [sourceDocument]"*.
  - Trên văn bản ký phát hành: Áp dụng thể thức ký thừa ủy quyền (`TUQ. HIỆU TRƯỞNG`) hoặc ký thay (`KT. TRƯỞNG PHÒNG`).
- **Exceptions**:
  - `403 Forbidden`: Vi phạm nguyên tắc tự phê duyệt (Maker-Checker) hoặc hết thời hạn ủy quyền.
  - `404 Not Found`: Quyết định ủy quyền đã bị thu hồi trước đó.
- **Audit requirement**: Bắt buộc tạo bản ghi `DelegatedActionAuditLog` bất biến lưu trữ: `delegationGrantId`, `executedByUserId`, `onBehalfOfAssignmentId`, `actionName`, `timestamp`, `ipAddress` và mã băm SHA-256 của tài liệu/sản phẩm được duyệt.

---

### Rule DEL-03: Immediate Revocation of Delegation
- **Source regulation**: Bộ luật Dân sự 2015 Điều 140; Quyết định số 283/QĐ-CĐKTCNQN.
- **Business actor**: Người giao quyền gốc (`Grantor`) hoặc Hiệu trưởng Nhà trường (`BGH_HT`).
- **Precondition**:
  1. Bản ghi `DelegationGrant` đang ở trạng thái `ACTIVE`.
  2. Người yêu cầu hủy bỏ là chính người đã giao quyền hoặc là Hiệu trưởng (cấp trên cao nhất).
- **Action**: Cập nhật bản ghi `DelegationGrant`:
  - `status = REVOKED`.
  - `revokedAt = CURRENT_TIMESTAMP`.
  - `revokedByAssignmentId = actor.assignmentId`.
  - `revokeReason = lý do hủy bỏ`.
- **Resource**: Thực thể `DelegationGrant`.
- **Result**: Toàn bộ thẩm quyền ủy quyền chấm dứt hiệu lực ngay tức khắc; mọi phiên làm việc tiếp theo của người nhận quyền bị tước bỏ quyền năng này.
- **Exceptions**:
  - `403 Forbidden`: Người không có thẩm quyền (đồng cấp hoặc cấp dưới) cố gắng thu hồi ủy quyền của người khác.
- **Audit requirement**: Lưu vết `DELEGATION_REVOKED` kèm `actorId`, `delegationId`, `revokeReason`, `timestamp`.

---

### Rule DEL-04: Automated Cascade Revocation on Position Termination
- **Source regulation**: Nghị định số 232/2026/NĐ-CP; Quyết định số 283/QĐ-CĐKTCNQN.
- **Business actor**: Hệ thống quản lý nhân sự / Event Handler (`ON_POSITION_TERMINATED`).
- **Precondition**:
  1. Một `PositionAssignment` của người giao quyền hoặc người nhận quyền bị chấm dứt (`status = TERMINATED` hoặc `SUPERSEDED`) do chuyển công tác, miễn nhiệm hoặc nghỉ hưu.
- **Action**: Kích hoạt quy trình thu hồi tự động:
  1. Thu hồi toàn bộ các `DelegationGrant` đang hoạt động do vị trí này ban hành (`fromAssignmentId = terminatedId`).
  2. Thu hồi toàn bộ các `DelegationGrant` đang hoạt động mà vị trí này tiếp nhận (`toAssignmentId = terminatedId`).
  3. Đánh dấu `revokeReason = "Tự động thu hồi do chấm dứt vị trí công tác theo QĐ bổ nhiệm/điều động mới"`.
- **Resource**: Tất cả `DelegationGrant` liên đới.
- **Result**: Không còn bất kỳ quyền lực ủy quyền nào trôi nổi sau khi cán bộ lãnh đạo thay đổi vị trí công tác.
- **Exceptions**: Không có (Hệ thống bảo đảm tính toàn vẹn thông qua Database Transaction).
- **Audit requirement**: Ghi nhật ký hệ thống `CASCADE_DELEGATION_AUTO_REVOKED` với danh sách ID ủy quyền bị thu hồi.

---

## 6. Authorization Engine Integration Strategy

The authorization layer evaluates user access through a tripartite resolution cascade:

```
                          ┌───────────────────────────┐
                          │ Incoming API / Action Call│
                          └─────────────┬─────────────┘
                                        │
                                        ▼
             ┌─────────────────────────────────────────────────────┐
             │ 1. Direct Statutory Authority                       │
             │ Does user's active PositionAssignment grant this    │
             │ directly at the requested Scope and Portfolio?      │
             └──────────────────────────┬──────────────────────────┘
                                        │ NO
                                        ▼
             ┌─────────────────────────────────────────────────────┐
             │ 2. Active Delegation Grant                          │
             │ Does user possess an ACTIVE DelegationGrant from    │
             │ an authorized officeholder covering:                │
             │ - Capability?                                       │
             │ - Responsibility Area?                              │
             │ - Resource Scope?                                   │
             │ - Temporal Window [validFrom <= NOW <= validUntil]? │
             └──────────────────────────┬──────────────────────────┘
                                        │ YES
                                        ▼
             ┌─────────────────────────────────────────────────────┐
             │ 3. Maker-Checker Invariant Verification             │
             │ Is actor the creator or primary owner of target?    │
             └──────────────────────────┬──────────────────────────┘
                         │ NO                           │ YES
                         ▼                              ▼
                 [ ALLOW ACCESS ]               [ 403 FORBIDDEN ]
             (Log DelegatedAction)           (Conflict of Interest)
```

This model provides mathematical guarantee that no delegated action can bypass institutional conflict-of-interest protections or outlive its formal legal basis.
