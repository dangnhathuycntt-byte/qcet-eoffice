# RFC-07: Action Inbox vs. Notification Feed Separation (Phân tách Hộp tác nghiệp và Dòng thông báo sự kiện)

- **Status**: PROPOSED
- **Date**: 2026-09-23
- **Author**: Enterprise Architecture & UX Architecture Team (WI-7.1 / Issue #87)
- **Deciders**: Ban Giám hiệu, Trưởng các Khoa/Phòng, Hội đồng Công nghệ thông tin
- **Target Implementation**: WI-7.2 / Phase 7 (Platform Work)
- **Affects**:
  - `src/domain/tasks/attention-resolver.ts` (Actionable Attention Projections)
  - `src/server/services/notification-service.ts` (Notification Delivery Pipeline)
  - `src/app/api/inbox/` (Action Inbox Query Endpoints)
  - `src/app/api/notifications/` (Passive Event Feed Endpoints)
  - `prisma/schema.prisma` (`Notification`, `NotificationCategory`, `NotificationType`)
  - Giao diện người dùng: Bàn làm việc (Dashboard), Thanh thông báo (Notification Drawer)

---

## 1. Bối cảnh & Đặt vấn đề (Context & Problem Statement)

Trong các hệ thống phần mềm quản trị tác nghiệp đại học và văn phòng điện tử, người dùng thường xuyên gặp phải hiện tượng **"Ô nhiễm thông báo" (Notification Fatigue / Inbox Clutter)**. Hiện tượng này xuất phát từ việc trộn lẫn hai loại thông điệp có bản chất hoàn toàn khác nhau vào cùng một bảng cơ sở dữ liệu `Notification`:

1. **Thông điệp hành động cần xử lý (Actionable Work Items)**:
   - "Có 1 văn bản đến mới được phân công cho đơn vị bạn chủ trì."
   - "Nhiệm vụ X vừa được nộp sản phẩm, đang chờ bạn duyệt nghiệm thu."
   - "Dự thảo biên bản cuộc họp giao ban tuần đang chờ bạn ký xác nhận."
   - "Hồ sơ công việc Y đã nộp lưu, đang chờ bạn tiếp nhận vào kho lưu trữ."
2. **Thông điệp thụ động thông báo sự kiện (Passive Informational Notifications)**:
   - "Nhiệm vụ Z đã được cán bộ A hoàn thành."
   - "Lịch tuần của trường đã được cập nhật sự kiện mới."
   - "Văn bản đi số 45/QĐ đã được văn thư phát hành thành công."
   - "Tệp tin báo cáo quý III của bạn đã được tải lên thành công."

### Hệ quả của việc trộn lẫn hiện tại:
- **Tình trạng "Đánh dấu đã đọc" giả tạo (False Completion Paradox)**: Người dùng bấm "Đánh dấu tất cả là đã đọc" để xóa huy hiệu đỏ (badge count) trên thanh tiêu đề. Khi đó, các việc cần xử lý thực tế (nhiệm vụ chờ duyệt, văn bản chờ chỉ đạo) bị chìm lấp và biến mất khỏi tầm mắt, dẫn tới tình trạng trễ hạn và ách tắc công việc.
- **Dữ liệu dư thừa và không nhất quán (State Drift)**: Nếu một nhiệm vụ được người khác duyệt (hoặc đã bị hủy), bản ghi thông báo "Chờ duyệt" trong bảng `Notification` của người dùng vẫn tồn tại nguyên trạng là "Chưa đọc" trừ khi có background job cập nhật thủ công từng bản ghi.
- **Hiệu năng suy giảm**: Bảng `Notification` phình to với hàng trăm nghìn bản ghi lịch sử, trong khi việc truy vấn "Hôm nay tôi cần làm gì?" lại phải scan qua bảng này kèm nhiều điều kiện join phức tạp.

Do đó, **RFC-07** xác lập kiến trúc chuẩn tắc: **Phân tách hoàn toàn Action Inbox (Hộp tác nghiệp) thành một Real-time Derived Projection độc lập khỏi Notification Feed (Dòng thông báo lịch sử)**.

---

## 2. Mô hình Kiến trúc Phân tách (Architectural Separation Model)

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                             QCET WORKSPACE SHELL                            │
│                                                                             │
│   ┌───────────────────────────────────┐ ┌─────────────────────────────────┐ │
│   │       ACTION INBOX (Hộp việc)     │ │   NOTIFICATION FEED (Thông báo) │ │
│   │      [Derived Query Projection]   │ │      [Event Store / Audit]      │ │
│   ├───────────────────────────────────┤ ├─────────────────────────────────┤ │
│   │ • Trạng thái động (Real-time)     │ │ • Dữ liệu lịch sử tĩnh (Append) │ │
│   │ • Tự động xuất hiện khi có việc   │ │ • Ghi nhận sự kiện hệ thống     │ │
│   │ • Tự động BIẾN MẤT khi xong việc  │ │ • Đánh dấu Đã đọc / Chưa đọc   │ │
│   │ • KHÔNG CÓ nút "Đánh dấu đã đọc" │ │ • Có thông báo đẩy (Push/Email) │ │
│   │ • Gom 4 Domain: Task, Document,   │ │ • Lưu trữ trong DB              │ │
│   │   Meeting, Dossier                │ │   (bảng `notifications`)        │ │
│   └─────────────────▲─────────────────┘ └────────────────▲────────────────┘ │
│                     │                                    │                  │
└─────────────────────┼────────────────────────────────────┼──────────────────┘
                      │                                    │
              [Attention Resolver]                 [Outbox Event Worker]
                      │                                    │
     ┌────────────────┴───────────────┐           ┌────────┴────────┐
     │ DOMAIN DATA STORES             │           │ OUTBOX EVENTS   │
     │ • tasks (WAITING_APPROVAL)     │           │ (Transactional  │
     │ • documents (CHO_PHAN_CONG)    │           │  Event Log)     │
     │ • meetings (MINUTES_DRAFT)     │           └─────────────────┘
     │ • dossiers (SUBMITTED_ARCHIVE) │
     └────────────────────────────────┘
```

### 2.1. Bản chất của Action Inbox (Hộp tác nghiệp)
- **Cơ chế**: Là một **Derived Query Projection (Hình chiếu truy vấn dẫn xuất)**, tổng hợp tức thời từ trạng thái thực tế của các thực thể nghiệp vụ:
  1. **Task Domain**: Nhiệm vụ mà actor là Reviewer/Approver đang ở trạng thái `WAITING_APPROVAL`; hoặc nhiệm vụ actor là Assignee/DRI đang ở trạng thái `NOT_STARTED` / `IN_PROGRESS` sắp đến hạn / quá hạn.
  2. **Document Domain**: Văn bản đến cần BGH chỉ đạo (`PRESENTED`), văn bản chờ Trưởng đơn vị phân công (`ASSIGNED_TO_LEAD_UNIT`), hoặc văn bản đi chờ Lãnh đạo ký duyệt (`AUTHORIZED_SIGN`).
  3. **Meeting Domain**: Cuộc họp đã diễn ra cần Thư ký soạn biên bản (`HELD`), hoặc dự thảo biên bản chờ Chủ trì ký xác nhận (`MINUTES_DRAFT`).
  4. **Dossier Domain**: Hồ sơ công việc nộp lưu chờ Lưu trữ viên tiếp nhận (`SUBMITTED_TO_ARCHIVE`).
- **Quy tắc bất biến**:
  * **Zero Read Tracking**: Action Inbox **KHÔNG CÓ trường `isRead`** và không có nút "Đánh dấu đã đọc".
  * **Tự động thanh toán (Auto-Resolution)**: Khi hành động nghiệp vụ hoàn thành (ví dụ: Hiệu trưởng bấm Ký số văn bản đi, hoặc Trưởng phòng duyệt nhiệm vụ), thực thể chuyển trạng thái FSM, và mục việc này **ngay lập tức tự động biến mất khỏi Action Inbox của người đó**.
  * **Zero Stale State**: Không có hiện tượng việc đã được người khác xử lý mà vẫn còn báo đỏ.

### 2.2. Bản chất của Notification Feed (Dòng thông báo lịch sử)
- **Cơ chế**: Là một **Event Log Stream**, ghi nhận các sự kiện đã xảy ra nhằm cung cấp nhận thức ngữ cảnh (situational awareness) cho người dùng.
- **Lưu trữ**: Bảng `Notification` trong cơ sở dữ liệu PostgreSQL.
- **Quy tắc**:
  * Lưu trữ append-only khi có Outbox Event tương ứng được xử lý.
  * Có trạng thái `isRead`, `readAt`.
  * Có các kênh phân phối phụ: Web Push (Service Worker), Email digest, In-app toast.
  * Tự động dọn dẹp (Retention pruning) sau 90 hoặc 180 ngày.

---

## 3. Cấu trúc Schema & Phân loại Thông báo (Controlled Vocabulary)

Trong Phase 7 (WI-7.2), cấu trúc bảng `Notification` sẽ được tiến hóa để phân loại rõ ràng:

### 3.1. Phân loại nhóm thông báo (`NotificationCategory`)
```prisma
enum NotificationCategory {
  TASK_ACTIVITY       // Diễn biến thực hiện nhiệm vụ (giao việc, báo cáo, hoàn thành)
  DOCUMENT_DISPATCH   // Diễn biến văn bản (ban hành, tiếp nhận, luân chuyển)
  MEETING_CALENDAR    // Lịch công tác và giấy mời họp
  DOSSIER_ARCHIVE     // Nộp lưu và lưu trữ hồ sơ
  SYSTEM_ANNOUNCEMENT // Thông báo hệ thống, bảo trì
}
```

### 3.2. Cấu trúc bảng `Notification` chuẩn hóa
```prisma
model Notification {
  id          String               @id @default(cuid())
  userId      String               @map("user_id")
  category    NotificationCategory @default(TASK_ACTIVITY)
  type        String               @db.VarChar(100) // Controlled event type
  title       String               @db.VarChar(255)
  message     String               @db.Text
  linkUrl     String?              @map("link_url") @db.VarChar(500)
  entityType  String?              @map("entity_type") @db.VarChar(50)
  entityId    String?              @map("entity_id") @db.VarChar(100)
  isRead      Boolean              @default(false) @map("is_read")
  readAt      DateTime?            @map("read_at")
  createdAt   DateTime             @default(now()) @map("created_at")
  user        User                 @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, isRead])
  @@index([userId, createdAt(sort: Desc)])
  @@map("notifications")
}
```

---

## 4. Đặc tả Hợp đồng API Action Inbox (`/api/inbox`)

Endpoint `/api/inbox` trả về tập hợp các hành động cần thực hiện của người dùng hiện tại, phân nhóm theo Domain và mức độ khẩn cấp:

```json
{
  "summary": {
    "totalActionableCount": 5,
    "urgentCount": 2,
    "tasksPendingApproval": 2,
    "documentsPendingDirective": 1,
    "documentsPendingSign": 1,
    "meetingsPendingMinutesConfirm": 1,
    "dossiersPendingArchive": 0
  },
  "items": [
    {
      "id": "action-task-cmuc123",
      "domain": "TASK",
      "actionType": "APPROVE_DELIVERABLE",
      "title": "[Duyệt nghiệm thu] Đề cương chi tiết môn Lập trình Web",
      "urgency": "URGENT",
      "deadline": "2026-09-24T17:00:00Z",
      "entityId": "task-cmuc123",
      "actionUrl": "/tasks/task-cmuc123?action=approve",
      "actorRoleInItem": "APPROVER"
    },
    {
      "id": "action-doc-cmuc456",
      "domain": "DOCUMENT",
      "actionType": "AUTHORIZED_SIGN",
      "title": "[Ký ban hành] Quyết định thành lập Hội đồng Đánh giá luận văn",
      "urgency": "HIGH",
      "deadline": "2026-09-25T11:30:00Z",
      "entityId": "doc-cmuc456",
      "actionUrl": "/documents/outgoing/doc-cmuc456?action=sign",
      "actorRoleInItem": "SIGNER"
    }
  ]
}
```

---

## 5. Đánh giá Rủi ro & Giải pháp Giảm thiểu (Trade-offs & Alternatives)

| Phương án | Ưu điểm | Nhược điểm | Đánh giá |
|:---|:---|:---|:---:|
| **Phương án A: Tiếp tục dùng chung bảng Notification** | Không cần đổi API endpoint | Lỗi ô nhiễm thông báo, state drift, không giải quyết được gốc rễ bài toán | ❌ BÁC BỎ |
| **Phương án B: Bảng ActionItem vật lý riêng biệt trong DB** | Dễ query | Phải đồng bộ 2 chiều qua trigger/event; nguy cơ mất đồng bộ khi transaction fail | ⚠️ KHÔNG TỐI ƯU |
| **Phương án C: Derived Query Projection (Đề xuất của RFC-07)** | Tuyệt đối nhất quán (zero drift), không tốn dung lượng lưu trữ, tự động thanh toán | Cần tối ưu chỉ mục DB (indexes) trên các bảng domain | ✅ **LỰA CHỌN** |

---

## 6. Kế hoạch Chuyển đổi (Implementation & Migration Track)

1. **WI-7.1 (Tài liệu này)**: Ban hành RFC-07 chốt kiến trúc phân tách Action Inbox vs Notification Feed.
2. **WI-7.2**: Tiến hóa schema `NotificationCategory` và `NotificationType` trên Prisma và API routes.
3. **Frontend Integration**: Xây dựng widget **"Việc cần xử lý ngay" (Action Center)** tại Bàn làm việc BGH / Trưởng đơn vị / Chuyên viên, gọi trực tiếp `/api/inbox`.
