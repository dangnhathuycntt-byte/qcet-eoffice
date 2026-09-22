# RFC-10: Institutional Meeting Governance, Minutes Approval, and Resolution-to-Task Pipeline (Quy chế Quản trị Cuộc họp, Phê duyệt Biên bản và Tự động Hóa Nhiệm vụ từ Kết luận Họp)

- **Status**: PROPOSED
- **Date**: 2026-09-23
- **Author**: Enterprise Architecture & Security Architecture Team (WI-6.1b / Issue #76)
- **Deciders**: Ban Giám hiệu, Chủ tịch Hội đồng trường, Trưởng phòng Hành chính - Tổng hợp, Trưởng các Khoa/Phòng
- **Target Implementation**: WI-6.1c / Phase 7 (Institutional Meetings & Resolutions Domain)
- **Affects**:
  - `src/domain/meetings/state-machine.ts` (Meeting Finite State Machine & Guard Contracts)
  - `src/server/services/meeting-service.ts` (`draftMinutes`, `confirmMinutes`, `createResolution`, `publishResolution`)
  - `src/server/policies/meeting-policy.ts` (Meeting Access Control & Authorization Policies)
  - `src/server/authorization/authorization-engine.ts` (Step 10 SoD Rule 10.4: Secretary != Chair Approver)
  - `src/contracts/meeting.ts` (Data Transfer Objects & Meeting Contracts)
  - `src/app/api/meetings/` (Meeting Management REST Endpoints)

---

## 1. Bối cảnh & Đặt vấn đề (Context & Statutory Background)

Trong quản trị trường đại học và cơ sở giáo dục nghề nghiệp công lập như Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (QCET), các cuộc họp định kỳ và đột xuất đóng vai trò quyết định trong việc thảo luận, quyết nghị và điều hành:
1. **Hội đồng trường (Governing Council)**: Cơ quan quản trị cao nhất quyết định định hướng chiến lược, nhân sự chủ chốt và tài chính.
2. **Ban Giám hiệu (Executive Leadership)**: Giao ban lãnh đạo định kỳ hàng tuần/tháng, chỉ đạo tác nghiệp toàn trường.
3. **Giao ban toàn thể / Trưởng đơn vị**: Quán triệt kế hoạch đào tạo, công tác sinh viên, tài chính và cơ sở vật chất.
4. **Hội đồng chuyên môn**: Hội đồng Khoa học & Đào tạo, Hội đồng Tuyển sinh, Hội đồng Đánh giá luận văn/đồ án, Hội đồng Thi đua - Khen thưởng.

Trong hệ thống E-Office hiện tại, mô hình dữ liệu `Meeting`, `MeetingParticipant`, `MeetingResolution` và dịch vụ `MeetingService` (triển khai tại `src/server/services/meeting-service.ts`) đã hỗ trợ quy trình vòng đời:
`DRAFT_AGENDA` $\to$ `INVITED` $\to$ `HELD` $\to$ `MINUTES_DRAFT` $\to$ `MINUTES_CONFIRMED`.

Tuy nhiên, qua kiểm toán kiến trúc và bảo mật phân quyền (Issue #76 / WI-6.1b), hệ thống bộc lộ **ba vấn đề trọng yếu cần chuẩn hóa**:

### 1.1. Lỗ hổng thiếu phân lập trách nhiệm (Separation of Duties - SoD) trong phê duyệt biên bản
Theo quy định hành chính và Điều lệ trường cao đẳng:
- **Thư ký cuộc họp (`MeetingParticipantRole.SECRETARY`)** có trách nhiệm ghi chép trung thực, khách quan diễn biến cuộc họp và soạn thảo dự thảo biên bản (`meeting.draft_minutes`).
- **Người chủ trì cuộc họp (`MeetingParticipantRole.CHAIR`)** có thẩm quyền kiểm tra, kết luận và ký xác nhận biên bản cuộc họp (`meeting.confirm_minutes`).

Hiện tại, `MeetingService.confirmMinutes()` chỉ kiểm tra xem người thực hiện có quyền `meeting.confirm_minutes` hay không (thông qua vị trí lãnh đạo hoặc kiểm tra vai trò), **nhưng chưa có cơ chế cưỡng chế Separation of Duties (SoD)**: Nếu một cán bộ được gán vai trò Thư ký trong cuộc họp nhưng đồng thời giữ chức vụ Trưởng khoa hoặc Phó Hiệu trưởng, cán bộ đó có thể **tự mình soạn thảo biên bản và tự mình phê duyệt biên bản đó mà không qua sự chuẩn y của Người chủ trì**. Điều này vi phạm nghiêm trọng tính khách quan pháp lý và nguyên tắc phân lập quyền lực trong ADR-001.

### 1.2. Tính bất biến sau khi phê duyệt biên bản (Minutes Immutability)
Khi biên bản cuộc họp đã được Người chủ trì xác nhận (`MINUTES_CONFIRMED`), về mặt pháp lý hành chính:
- Nội dung biên bản, danh sách thành viên tham gia, và các ý kiến biểu quyết đã được niêm phong.
- Cuộc họp không được phép quay ngược về trạng thái `MINUTES_DRAFT` hay `INVITED`.
- Không được tùy tiện thêm bớt người tham gia (`MeetingParticipant`) hoặc hủy cuộc họp (`CANCELLED`).
Tuy nhiên, `MeetingService` hiện chưa có cơ chế kiểm tra `isMeetingFinalized()` đồng bộ để chặn các thao tác sửa đổi gián tiếp (như `addParticipant`, `updateAttendance`, `updateMeeting`).

### 1.3. Cơ chế tự động hóa và truy vết nhiệm vụ từ Nghị quyết họp (Resolution-to-Task Pipeline)
Một trong những điểm nghẽn phổ biến của quản lý hành chính là: **Nghị quyết cuộc họp ban hành nhưng không được chuyển đổi thành kế hoạch hành động giám sát được**.
Mô hình `MeetingResolution` cần một cơ chế sinh nhiệm vụ tự động (`Task`) đồng bộ trong transaction, xác lập rõ:
- Cấp độ nhiệm vụ: Toàn trường (`scope = 'SCHOOL'`).
- Đơn vị chủ trì (`leadUnitId`) và Chuyên viên/Cán bộ thụ lý chính (`leadUserId`).
- Thời hạn thực hiện (`deadline`).
- Liên kết hai chiều không thể phá vỡ giữa `MeetingResolution.resultingTaskId` và `Task.sourceEntityId`.

---

## 2. Nguyên tắc Quản trị & Phân lập Trách nhiệm (Core Governance Principles)

Tài liệu này xác lập 4 nguyên tắc bất biến cho phân hệ Cuộc họp:

### Nguyên tắc 1: Maker-Checker SoD trong Phê duyệt Biên bản họp (Rule 10.4)
```text
┌────────────────────────────────────────────────────────┐
│               MAKER-CHECKER SoD MATRIX                │
│                                                        │
│  [Thư ký / Người soạn thảo] ───(Soạn thảo biên bản)───┐│
│            (MAKER)                                     ││
│                                                        ▼│
│                                             [MINUTES_DRAFT]
│                                                        ││
│  [Chủ trì / Lãnh đạo phê duyệt] ──(Ký xác nhận)───────┘│
│           (CHECKER)                                     │
│                                                         │
│  BẤT BIẾN: CHECKER !== MAKER (Thư ký không được tự duyệt)│
└────────────────────────────────────────────────────────┘
```
- **Bắt buộc**: Người chủ trì (`CHAIR`) hoặc Lãnh đạo cấp trên có thẩm quyền mới được duyệt biên bản.
- **Ràng buộc SoD**: Nếu `actor.userId === meeting.minutesDrafterId` (hoặc actor là người tạo dự thảo biên bản gần nhất), yêu cầu xác nhận biên bản **bị từ chối ngay lập tức** với mã lỗi `SOD_VIOLATION` (`SOD_SECRETARY_CANNOT_CONFIRM`).

### Nguyên tắc 2: Phân cấp thẩm quyền triệu tập và chủ trì (Convening Authority)
1. **Cuộc họp Hội đồng trường**: Do Chủ tịch Hội đồng trường triệu tập và chủ trì; Thư ký Hội đồng ghi chép.
2. **Cuộc họp Ban Giám hiệu**: Do Hiệu trưởng triệu tập và chủ trì (hoặc Phó Hiệu trưởng được ủy quyền theo ADR-001/RFC-03); Trưởng phòng HC-TH hoặc Chuyên viên tổng hợp làm thư ký.
3. **Giao ban toàn trường**: Hiệu trưởng chủ trì.
4. **Cuộc họp Khoa / Trung tâm**: Trưởng đơn vị triệu tập và chủ trì; Thư ký Khoa ghi chép.

### Nguyên tắc 3: Tính Bất biến Tuyệt đối (Strict Immutability) của Cuộc họp Finalized
- Trạng thái `MINUTES_CONFIRMED` và `CANCELLED` là các **Terminal States**.
- Khi đạt trạng thái này:
  * Không thể thay đổi trạng thái cuộc họp.
  * Không thể thêm/xóa/sửa người tham gia (`MeetingParticipant`).
  * Không thể sửa đổi nội dung biên bản (`minutes`).
  * Trường hợp cần đính chính biên bản: Phải tạo **Phụ lục biên bản (Minutes Addendum)** được Người chủ trì ký duyệt, hoặc lập cuộc họp giải quyết bổ sung.

### Nguyên tắc 4: Tự động hóa Nhiệm vụ từ Kết luận họp (Resolution-to-Task Invariant)
Mỗi Quyết nghị / Kết luận họp (`MeetingResolution`) khi ban hành (`publish`):
- Tự động kích hoạt `TaskCommandService.createFromMeetingResolution` trong `$transaction`.
- Task được tạo mang thuộc tính:
  * `scope = 'SCHOOL'` (hoặc `UNIT` nếu cuộc họp nội bộ đơn vị).
  * `priority = 'URGENT'` nếu có thời hạn $< 3$ ngày, ngược lại `'HIGH'`.
  * `title = [Kết luận họp: ${meeting.title}] ${resolution.title}`.
  * `departmentId = resolution.leadUnitId`.
  * `assignees = [resolution.leadUserId]`.
  * Ghi nhận `AuditLog` và phát hành `OutboxEvent: MEETING_RESOLUTION_TASK_DERIVED`.

---

## 3. Kiến trúc Chuyển đổi Trạng thái FSM (State Machine Specification)

### 3.1. Danh mục Trạng thái (`MeetingStatus`)
| Mã trạng thái | Tên tiếng Việt hành chính | Ý nghĩa nghiệp vụ |
|:---|:---|:---|
| `DRAFT_AGENDA` | Dự thảo chương trình | Khởi tạo cuộc họp, chuẩn bị nội dung và tài liệu họp |
| `INVITED` | Đã phát hành giấy mời | Đã gửi giấy mời họp và tài liệu đến các thành viên |
| `HELD` | Đã tổ chức họp | Cuộc họp đã diễn ra, kết thúc thời gian họp thực tế |
| `MINUTES_DRAFT` | Dự thảo biên bản | Thư ký đã hoàn thành ghi chép và gửi dự thảo biên bản |
| `MINUTES_CONFIRMED` | Biên bản đã xác nhận | Người chủ trì đã ký duyệt biên bản cuộc họp (Terminal) |
| `CANCELLED` | Đã hủy cuộc họp | Cuộc họp bị hoãn hoặc hủy bỏ chính thức (Terminal) |

### 3.2. Ma trận Chuyển đổi Hợp lệ (`ALLOWED_MEETING_TRANSITIONS`)
```typescript
export const ALLOWED_MEETING_TRANSITIONS: Record<MeetingStatus, readonly MeetingStatus[]> = {
  DRAFT_AGENDA: ['INVITED', 'CANCELLED'],
  INVITED: ['HELD', 'CANCELLED'],
  HELD: ['MINUTES_DRAFT', 'CANCELLED'],
  MINUTES_DRAFT: ['MINUTES_CONFIRMED', 'CANCELLED'],
  MINUTES_CONFIRMED: [], // Terminal
  CANCELLED: [],         // Terminal
};
```

### 3.3. Các chuyển đổi bị cấm (Disallowed & Anti-Skip Invariants)
1. **Cấm nhảy cóc vòng đời (No Skipping)**:
   - `DRAFT_AGENDA` $\to$ `HELD` (Không được họp khi chưa phát giấy mời).
   - `DRAFT_AGENDA` $\to$ `MINUTES_DRAFT` / `MINUTES_CONFIRMED` (Không thể có biên bản khi chưa họp).
   - `INVITED` $\to$ `MINUTES_CONFIRMED` (Bắt buộc phải qua bước Thư ký lập dự thảo).
2. **Cấm hồi tố trạng thái (No Backward Transitions)**:
   - `HELD` $\to$ `INVITED` / `DRAFT_AGENDA`.
   - `MINUTES_CONFIRMED` $\to$ bất kỳ trạng thái nào khác.
3. **Cấm chuyển đổi vòng lặp tự thân (No Self-transitions)**:
   - `status` $\to$ `status` không được coi là transition hợp lệ.

---

## 4. Đặc tả Phân quyền Ngữ cảnh (Contextual Authorization Matrix)

Tích hợp vào Step 7 và Step 10 của `src/server/authorization/authorization-engine.ts`:

| Hành động | Thẩm quyền cho phép (Step 7) | Điều kiện Phân lập Trách nhiệm SoD (Step 10) |
|:---|:---|:---|
| `meeting.create` | Lãnh đạo BGH, Trưởng đơn vị, Thư ký Hội đồng | Không có ràng buộc SoD |
| `meeting.read` | Thành viên tham gia, Lãnh đạo BGH, Cán bộ đơn vị tổ chức | Tuân thủ bảo mật cấp độ dữ liệu (Data Classification) |
| `meeting.update` | Người tổ chức (`organizerId`), Lãnh đạo đơn vị | Phải ở trạng thái `DRAFT_AGENDA` hoặc `INVITED` |
| `meeting.manage_participants` | Người tổ chức, Thư ký họp | Cuộc họp chưa finalized (`assertMeetingNotFinalized`) |
| `meeting.draft_minutes` | Thư ký cuộc họp (`SECRETARY`), Cán bộ được phân công | Cuộc họp đã ở trạng thái `HELD` hoặc `MINUTES_DRAFT` |
| `meeting.confirm_minutes` | Người chủ trì cuộc họp (`CHAIR`), Hiệu trưởng, Chủ tịch Hội đồng | **Rule 10.4: `actor.id !== meeting.minutesDrafterId`** (SoD bắt buộc) |
| `meeting.create_resolution` | Người chủ trì họp, Lãnh đạo BGH | Cuộc họp đã `HELD` hoặc `MINUTES_CONFIRMED` |
| `meeting.publish_resolution` | Người chủ trì họp, Hiệu trưởng | Phải gắn liền với việc sinh Task giám sát |

---

## 5. Kế hoạch Triển khai (Target Implementation Plan)

- **WI-6.1a (Đã hoàn thành)**: Xây dựng `src/domain/meetings/state-machine.ts` và test suite `tests/domain/meeting-state-machine.test.ts`.
- **WI-6.1b (Tài liệu này)**: Ban hành RFC-10 chuẩn hóa quy chế cuộc họp, SoD biên bản, và pipeline sinh nhiệm vụ.
- **WI-6.1c (Tiếp theo)**:
  * Bổ sung trường `minutesDrafterId` (hoặc truy vết qua AuditLog) vào bảng `meetings`.
  * Cài đặt Rule 10.4 SoD vào `authorization-engine.ts` và `MeetingService.confirmMinutes()`.
  * Kiểm thử chống tự phê duyệt biên bản bằng automated test.

---

## 6. Đánh giá Rủi ro & Giải pháp Giảm thiểu (Risk & Mitigation)

| Rủi ro | Mức độ | Biện pháp kiểm soát |
|:---|:---:|:---|
| **Người chủ trì kiêm luôn vai trò ghi chép** trong cuộc họp quy mô nhỏ | Trung bình | Trong các cuộc họp đơn vị dưới 5 người, nếu không phân công thư ký, Trưởng đơn vị được phép ghi chép nhưng hệ thống bắt buộc ghi rõ vai trò kiêm nhiệm và ghi nhận AuditLog cảnh báo |
| **Biên bản bị trì hoãn xác nhận** làm chậm tiến độ giao việc | Cao | Hỗ trợ tính năng ban hành Quyết nghị sơ bộ ngay sau khi kết thúc họp (`HELD`) để sinh Task khẩn, không bắt buộc đợi biên bản toàn văn |
| **Mất mát dữ liệu dự thảo biên bản** khi đang họp | Thấp | Cài đặt auto-save dự thảo biên bản vào local storage và định kỳ sync qua API |

---

## 7. Kết luận & Đề xuất (Recommendation)

Hội đồng Kiến trúc khuyến nghị Owner:
1. **Phê duyệt RFC-10 (ACCEPT)** làm quy chuẩn hành chính cho phân hệ Cuộc họp & Nghị quyết tại QCET.
2. Cho phép triển khai ngay **WI-6.1c** để cưỡng chế Rule 10.4 SoD trên code production.
