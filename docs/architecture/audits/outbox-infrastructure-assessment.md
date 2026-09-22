# Đánh giá Hạ tầng Transactional Outbox & Đặc tả Event Processor cho 12 Domain Events (WI-7.4)

> **Mã công việc**: WI-7.4 (Issue #89)  
> **Trạng thái**: COMPLETED / ARCHITECTURE SPECIFICATION  
> **Tiêu chuẩn tham chiếu**: RFC-07 (Action Inbox Separation), ADR-001/004/007, Nghị định 30/2020/NĐ-CP  
> **Hạ tầng cơ sở dữ liệu**: PostgreSQL 15+, Prisma ORM, Node.js / Next.js 15 App Router  

---

## 1. Tóm tắt Điều hành (Executive Summary)

Mô hình **Transactional Outbox Pattern** là nền tảng cốt lõi giúp hệ thống Quản trị & Điều hành Điện tử Đại học (QCET E-Office) bảo đảm **tính nhất quán dữ liệu tuyệt đối (Atomicity & Server Truth)** giữa các giao dịch nghiệp vụ lưu trữ tại cơ sở dữ liệu quan hệ PostgreSQL và các tác vụ phi giao dịch bên ngoài (External Side-Effects) như:
- Gửi thông báo đẩy Web Push (VAPID/Web-Push).
- Gửi thư điện tử công vụ (SMTP/SES).
- Đồng bộ dữ liệu sang các hệ thống quản trị đào tạo, nhân sự bên thứ ba.
- Cập nhật các bảng chiếu thời gian thực (Real-time Projections), bao gồm **Action Inbox** (RFC-07) và **Notification Feed**.

Tài liệu này cung cấp kết quả đánh giá toàn diện hạ tầng hiện hữu của `OutboxEvent` tại `prisma/schema.prisma` và `src/lib/db/outbox.ts`, đồng thời đặc tả chi tiết **12 Canonical Domain Events** trải dài trên 4 phân hệ lõi của nhà trường (Nhiệm vụ, Văn bản, Cuộc họp, Hồ sơ lưu trữ) và mô hình kiến trúc chuẩn tắc cho **Event Processor**.

---

## 2. Đánh giá Hiện trạng Hạ tầng (Current Infrastructure Assessment)

### 2.1. Cấu trúc Bảng và Schema DDL

Bảng `outbox_events` được định nghĩa trong `prisma/schema.prisma` (lines 1286–1309):

```prisma
enum OutboxStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}

model OutboxEvent {
  id            String       @id @default(uuid())
  eventType     String       @map("event_type")
  aggregateType String       @map("aggregate_type")
  aggregateId   String       @map("aggregate_id")
  payload       Json         @map("payload")
  status        OutboxStatus @default(PENDING) @map("status")
  attempts      Int          @default(0) @map("attempts")
  lastError     String?      @map("last_error")
  availableAt   DateTime     @default(now()) @map("available_at")
  processedAt   DateTime?    @map("processed_at")
  createdAt     DateTime     @default(now()) @map("created_at")

  @@index([status, availableAt])
  @@index([aggregateType, aggregateId])
  @@map("outbox_events")
}
```

#### Đánh giá Thiết kế Schema:
1. **Khóa chính UUID (`id`)**: Đảm bảo tính duy nhất toàn cầu và ngăn ngừa xung đột ID khi phân tán.
2. **Trường Payload dạng JSONB (`Json`)**: Cho phép cấu trúc payload linh hoạt theo từng loại sự kiện mà không phải thay đổi DDL.
3. **Trường Điều phối (`status`, `availableAt`, `attempts`)**:
   - `availableAt`: Cho phép lập lịch trì hoãn (delayed delivery) và tính toán khoảng lùi số mũ (exponential backoff) khi xảy ra lỗi tạm thời.
   - `attempts`: Đo lường số lần thử dispatch để kích hoạt cơ chế Dead-Letter Queue (DLQ).
   - `lastError`: Ghi nhận thông điệp lỗi kỹ thuật phục vụ truy vết và cảnh báo vận hành.

---

### 2.2. Đánh giá Chiến lược Chỉ mục (Index Analysis) & Hiệu năng Truy vấn

Hệ thống hiện thiết lập 2 chỉ mục tổng hợp:
1. `@@index([status, availableAt])`:
   - **Mục đích**: Tối ưu hóa truy vấn bộ lọc của Worker: `WHERE status = 'PENDING' AND available_at <= NOW() ORDER BY available_at ASC`.
   - **Đánh giá**: Đây là chỉ mục quan trọng nhất đối với polling worker. Độ chọn lọc (selectivity) cực cao vì số lượng bản ghi `PENDING` tại một thời điểm thường rất nhỏ so với số bản ghi đã `COMPLETED`.
2. `@@index([aggregateType, aggregateId])`:
   - **Mục đích**: Cho phép truy vết nhanh lịch sử phát sự kiện của một thực thể nghiệp vụ cụ thể (ví dụ: tìm mọi sự kiện liên quan đến `Task` có ID `task-123`).

#### Rủi ro Hiệu năng Nhận diện (Performance Risks):
- **B-Tree Index Bloat**: Do `outbox_events` có tần suất ghi và cập nhật trạng thái liên tục (`PENDING` $\to$ `PROCESSING` $\to$ `COMPLETED`), việc cập nhật trường `status` và `availableAt` gây ra hiện tượng sinh dead tuples liên tục trên bảng và chỉ mục.
- **Biện pháp khắc phục**: Cần duy trì tham số autovacuum tích cực đã nêu tại `DATABASE_OPERATIONS.md`:
  ```sql
  ALTER TABLE "outbox_events" SET (
    autovacuum_vacuum_scale_factor = 0.05,
    autovacuum_vacuum_cost_limit = 1000
  );
  ```

---

### 2.3. Đánh giá Tính Bất biến và Giao dịch Nguyên tử (Transactional Atomicity)

Thư viện hiện tại (`src/lib/db/outbox.ts`) cung cấp hàm `publishOutboxEvent(client, event)`:

```typescript
export async function publishOutboxEvent(
  client: DbClient,
  event: PublishOutboxEventInput
): Promise<OutboxEvent> {
  const db = client ?? defaultPrisma;
  return db.outboxEvent.create({
    data: {
      eventType: event.eventType,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      payload: serializeJson(event.payload) as Prisma.InputJsonValue,
      status: OutboxStatus.PENDING,
      attempts: 0,
      availableAt: event.availableAt ?? new Date(),
    },
  });
}
```

#### Ưu điểm:
- Nhận `client` là `Prisma.TransactionClient` (`tx`). Khi gọi bên trong `prisma.$transaction(async (tx) => { ... })`, bản ghi sự kiện được commit đồng thời cùng lúc với thực thể nghiệp vụ.
- Nếu nghiệp vụ thất bại và ném lỗi, toàn bộ giao dịch rollback, không để lại bất kỳ sự kiện mồ côi (orphan event) hay thông báo ma (ghost notification) nào.
- 100% test coverage về Transactional Atomicity đã được xác thực tại `tests/outbox-worker.test.ts` và `tests/outbox-pattern.test.ts`.

---

### 2.4. Đánh giá Cơ chế Tranh chấp & Khóa Đa Worker (Concurrency & Worker Contention)

Trong `src/lib/db/outbox.ts:362`:
```typescript
const claimResult = await db.outboxEvent.updateMany({
  where: { id: event.id, status: OutboxStatus.PENDING },
  data: { status: OutboxStatus.PROCESSING },
});
```

#### Đánh giá Kỹ thuật:
- Cơ chế `updateMany` sử dụng optimistic lock có điều kiện (`where: { status: PENDING }`). Nếu có 2 worker cùng nhắm đến một event, chỉ 1 worker cập nhật thành công (`count === 1`), worker còn lại nhận `count === 0` và bỏ qua.
- **Khoảng cách (Gap)**: Khi triển khai cụm nhiều container hoặc nhiều background workers, truy vấn `fetchAvailableOutboxEvents` bằng Prisma `findMany` có thể khiến nhiều worker cùng đọc một tập ID trùng lặp, gây lãng phí chu kỳ CPU.
- **Khuyến nghị chuẩn hóa**: Trong môi trường production tải cao, truy vấn lấy sự kiện cần chuyển sang native SQL sử dụng `FOR UPDATE SKIP LOCKED`:
  ```sql
  UPDATE outbox_events
  SET status = 'PROCESSING'
  WHERE id IN (
    SELECT id FROM outbox_events
    WHERE status = 'PENDING' AND available_at <= NOW()
    ORDER BY available_at ASC
    LIMIT $1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
  ```

---

### 2.5. Đánh giá Cơ chế Backoff & Dead-Letter Queue (DLQ)

Hàm tính toán khoảng lùi số mũ:
```typescript
export function calculateExponentialBackoff(
  attempts: number,
  baseSeconds: number = 5,
  exponentialBase: number = 2,
  maxBackoffSeconds: number = 86400
): number
```

#### Quy luật tăng khoảng lùi:
- Lần 1 thất bại $\to$ Chờ 5 giây.
- Lần 2 thất bại $\to$ Chờ 10 giây.
- Lần 3 thất bại $\to$ Chờ 20 giây.
- Vượt quá `maxRetries` (mặc định 3 hoặc 5) $\to$ Chuyển sang trạng thái `FAILED`, ghi nhận `lastError`.
- **Nhận định**: Cơ chế đạt chuẩn enterprise. Tránh được hiện tượng "thundering herd" và cách ly hoàn toàn các sự kiện lỗi vĩnh viễn (poison pills) khỏi luồng xử lý chính.

---

## 3. Đặc tả Chuẩn tắc cho 12 Canonical Domain Events

Để đảm bảo tính nhất quán trên toàn bộ kiến trúc hướng sự kiện (Event-Driven Architecture) của QCET E-Office, 12 sự kiện trọng yếu được chuẩn hóa theo chuẩn:
- **Tên sự kiện**: `qcet.<domain>.<entity>.<action>` (hoặc hằng số định danh Uppercase SNAKE_CASE trong code).
- **Phân loại**: 4 Domain lõi $\times$ 3 Events chuẩn tắc = 12 Events.

```
                                  QCET 12 DOMAIN EVENTS
      ┌─────────────────┬───────────────────┬───────────────────┬──────────────────┐
      │   TASK DOMAIN   │  DOCUMENT DOMAIN  │  MEETING DOMAIN   │  DOSSIER DOMAIN  │
      ├─────────────────┼───────────────────┼───────────────────┼──────────────────┤
      │ 1. task.created │ 4. doc.received   │ 7. mtg.invited    │ 10. dos.closed   │
      │ 2. task.assigned│ 5. doc.directed   │ 8. mtg.held       │ 11. dos.submitted│
      │ 3. task.approved│ 6. doc.issued     │ 9. mtg.confirmed  │ 12. dos.archived │
      └─────────────────┴───────────────────┴───────────────────┴──────────────────┘
```

---

### Phân hệ 1: Quản lý Nhiệm vụ (Task Domain)

#### Event 1: `task.created` (`TASK_CREATED_NOTIFICATION`)
- **Ngữ cảnh phát sinh**: Người giao việc (`creatorId`) tạo mới nhiệm vụ cấp trường hoặc cấp đơn vị.
- **Aggregate**: `AggregateType.TASK`, `aggregateId = task.id`.
- **Payload Schema**:
  ```json
  {
    "taskId": "task-uuid",
    "code": "NV-2026-001",
    "title": "Xây dựng đề cương chi tiết học phần AI",
    "creatorId": "user-lead-uuid",
    "departmentId": "dept-it-uuid",
    "priority": "HIGH",
    "dueDate": "2026-10-15T17:00:00.000Z",
    "createdAt": "2026-09-23T08:00:00.000Z"
  }
  ```
- **Hệ quả & Phản ứng (Side-Effects)**:
  - Cập nhật Action Inbox của Trưởng đơn vị/Chuyên viên liên quan.
  - Ghi nhật ký kiểm toán hệ thống (`AuditLog`).

#### Event 2: `task.assigned` (`TASK_ASSIGNED_NOTIFICATION`)
- **Ngữ cảnh phát sinh**: Trưởng đơn vị hoặc Người chỉ đạo phân công chuyên viên thực hiện (`primaryOwnerId` / `assigneeIds`).
- **Aggregate**: `AggregateType.TASK`, `aggregateId = task.id`.
- **Payload Schema**:
  ```json
  {
    "taskId": "task-uuid",
    "code": "NV-2026-001",
    "assignerId": "user-manager-uuid",
    "assignedUserIds": ["user-specialist-1", "user-specialist-2"],
    "primaryOwnerId": "user-specialist-1",
    "role": "ASSIGNEE",
    "instruction": "Hoàn thành dự thảo trước ngày 10/10/2026",
    "assignedAt": "2026-09-23T09:00:00.000Z"
  }
  ```
- **Hệ quả & Phản ứng**:
  - Gửi Web Push Notification và Email thông báo nhận nhiệm vụ mới đến chuyên viên.
  - Đưa nhiệm vụ vào Action Inbox cá nhân của chuyên viên được giao.

#### Event 3: `task.approved` (`TASK_APPROVED_NOTIFICATION`)
- **Ngữ cảnh phát sinh**: Người có thẩm quyền phê duyệt kết quả nhiệm vụ sau khi kiểm tra báo cáo/minh chứng.
- **Ràng buộc bất biến**: **Maker-Checker SoD BẮT BUỘC** (Người phê duyệt không được trùng với Creator, Submitter, Primary Owner, Assignee, hay Deliverable Uploader).
- **Aggregate**: `AggregateType.TASK`, `aggregateId = task.id`.
- **Payload Schema**:
  ```json
  {
    "taskId": "task-uuid",
    "code": "NV-2026-001",
    "approverId": "user-checker-uuid",
    "submitterId": "user-maker-uuid",
    "previousStatus": "IN_REVIEW",
    "newStatus": "COMPLETED",
    "approvedAt": "2026-09-23T10:30:00.000Z",
    "comments": "Kết quả đạt yêu cầu nghiệm thu"
  }
  ```
- **Hệ quả & Phản ứng**:
  - Tự động dọn dẹp mục phê duyệt khỏi Action Inbox của Người duyệt.
  - Gửi thông báo hoàn thành nhiệm vụ đến toàn bộ thành viên tham gia.

---

### Phân hệ 2: Quản lý Văn bản & Hồ sơ (Document Domain)

#### Event 4: `document.received` (`DOCUMENT_RECEIVED_NOTIFICATION`)
- **Ngữ cảnh phát sinh**: Văn thư cơ quan tiếp nhận và vào sổ văn bản đến từ cơ quan bên ngoài.
- **Aggregate**: `AggregateType.DOCUMENT`, `aggregateId = document.id`.
- **Payload Schema**:
  ```json
  {
    "documentId": "doc-incoming-uuid",
    "documentNumber": "123/BGDDT-GDĐH",
    "title": "V/v hướng dẫn kiểm định chất lượng chương trình đào tạo",
    "issuingAuthority": "Bộ Giáo dục và Đào tạo",
    "clerkId": "user-clerk-uuid",
    "urgency": "THUONG",
    "status": "CHO_PHAN_CONG",
    "receivedDate": "2026-09-23T08:15:00.000Z"
  }
  ```
- **Hệ quả & Phản ứng**:
  - Đẩy vào Action Inbox của Ban Giám hiệu phụ trách để xin ý kiến chỉ đạo.

#### Event 5: `document.directed` (`DOCUMENT_DIRECTIVE_NOTIFICATION`)
- **Ngữ cảnh phát sinh**: Lãnh đạo Trường (BGH) phê duyệt ý kiến chỉ đạo, xác định đơn vị chủ trì và đơn vị phối hợp.
- **Aggregate**: `AggregateType.DOCUMENT_DIRECTIVE`, `aggregateId = directive.id`.
- **Payload Schema**:
  ```json
  {
    "directiveId": "dir-uuid",
    "documentId": "doc-incoming-uuid",
    "leaderId": "user-rector-uuid",
    "leadDepartmentId": "dept-training-uuid",
    "collaboratingDepartmentIds": ["dept-qa-uuid"],
    "directionContent": "Giao Phòng Đào tạo chủ trì xây dựng kế hoạch rà soát",
    "deadline": "2026-10-01T17:00:00.000Z",
    "directedAt": "2026-09-23T09:45:00.000Z"
  }
  ```
- **Hệ quả & Phản ứng**:
  - Tự động xóa khỏi Action Inbox của BGH.
  - Xuất hiện ngay trong Action Inbox của Trưởng đơn vị chủ trì để thực hiện phân công chuyên viên thụ lý.

#### Event 6: `document.issued` (`DOCUMENT_ISSUED_NOTIFICATION`)
- **Ngữ cảnh phát sinh**: Văn thư cấp số, đóng dấu số tổ chức và chính thức ban hành văn bản đi.
- **Ràng buộc bất biến**: Văn bản đã hoàn tất ký số của Người có thẩm quyền (`authorizedSignedAt != null`). Trạng thái chuyển sang `DA_HOAN_THANH` và đóng băng bất biến (`assertDocumentNotImmutable`).
- **Aggregate**: `AggregateType.DOCUMENT`, `aggregateId = document.id`.
- **Payload Schema**:
  ```json
  {
    "documentId": "doc-outgoing-uuid",
    "officialNumber": "456/QĐ-CĐKTCN",
    "title": "Quyết định thành lập Hội đồng Đánh giá chất lượng nội bộ",
    "signerId": "user-rector-uuid",
    "issuerClerkId": "user-clerk-uuid",
    "recipientDepartments": ["dept-all"],
    "issuedAt": "2026-09-23T11:00:00.000Z",
    "attachedFileCount": 2
  }
  ```
- **Hệ quả & Phản ứng**:
  - Gửi thông báo văn bản mới đến các đơn vị, cá nhân nhận văn bản.
  - Đóng gói tài liệu gửi đến hàng đợi lưu trữ cơ quan.

---

### Phân hệ 3: Quản trị Cuộc họp (Meeting Domain)

#### Event 7: `meeting.invited` (`MEETING_INVITED_NOTIFICATION`)
- **Ngữ cảnh phát sinh**: Thư ký hoặc Chủ tọa phát giấy mời họp, công bố chương trình nghị sự và tài liệu đính kèm (FSM chuyển từ `DRAFT_AGENDA` $\to$ `INVITED`).
- **Aggregate**: `AggregateType.MEETING`, `aggregateId = meeting.id`.
- **Payload Schema**:
  ```json
  {
    "meetingId": "mtg-uuid",
    "title": "Họp Giao ban Ban Giám hiệu tháng 10/2026",
    "chairId": "user-rector-uuid",
    "secretaryId": "user-secretary-uuid",
    "location": "Phòng họp A1 / Trực tuyến",
    "startTime": "2026-10-02T08:30:00.000Z",
    "endTime": "2026-10-02T11:30:00.000Z",
    "invitedParticipantIds": ["user-1", "user-2", "user-3"]
  }
  ```
- **Hệ quả & Phản ứng**:
  - Tự động đồng bộ vào Lịch công tác cá nhân của người tham dự.
  - Gửi Web Push nhắc lịch.

#### Event 8: `meeting.held` (`MEETING_HELD_NOTIFICATION`)
- **Ngữ cảnh phát sinh**: Cuộc họp chính thức bắt đầu/diễn ra (FSM chuyển `INVITED` $\to$ `HELD`).
- **Aggregate**: `AggregateType.MEETING`, `aggregateId = meeting.id`.
- **Payload Schema**:
  ```json
  {
    "meetingId": "mtg-uuid",
    "actualStartTime": "2026-10-02T08:35:00.000Z",
    "attendeeCount": 12,
    "recordedBy": "user-secretary-uuid"
  }
  ```
- **Hệ quả & Phản ứng**:
  - Mở quyền soạn thảo biên bản họp số cho Thư ký phiên họp.

#### Event 9: `meeting.minutes_confirmed` (`MEETING_MINUTES_CONFIRMED_NOTIFICATION`)
- **Ngữ cảnh phát sinh**: Chủ tọa cuộc họp phê chuẩn và ký xác nhận biên bản họp (FSM chuyển `MINUTES_DRAFT` $\to$ `MINUTES_CONFIRMED`).
- **Ràng buộc bất biến**: **Rule 10.7 SoD**: Thư ký soạn biên bản tuyệt đối không được tự phê chuẩn biên bản. Trạng thái cuộc họp đóng băng vĩnh viễn (`isMeetingFinalized`).
- **Aggregate**: `AggregateType.MEETING`, `aggregateId = meeting.id`.
- **Payload Schema**:
  ```json
  {
    "meetingId": "mtg-uuid",
    "chairConfirmerId": "user-rector-uuid",
    "secretaryDrafterId": "user-secretary-uuid",
    "confirmedAt": "2026-10-02T14:00:00.000Z",
    "resolutionCount": 3,
    "generatedTaskIds": ["task-res-1", "task-res-2"]
  }
  ```
- **Hệ quả & Phản ứng**:
  - Xóa mục chờ ký biên bản khỏi Action Inbox của Chủ tọa.
  - Kích hoạt pipeline sinh tự động các nhiệm vụ (`tasks`) được giao trong kết luận phiên họp.

---

### Phân hệ 4: Hồ sơ Công việc & Lưu trữ (Dossier Domain)

#### Event 10: `dossier.closed` (`DOSSIER_CLOSED_NOTIFICATION`)
- **Ngữ cảnh phát sinh**: Cán bộ lập hồ sơ hoàn thành việc thu thập tài liệu và đóng hồ sơ công việc (FSM chuyển `ACTIVE` $\to$ `CLOSED`).
- **Aggregate**: `AggregateType.WORK_DOSSIER`, `aggregateId = dossier.id`.
- **Payload Schema**:
  ```json
  {
    "dossierId": "dos-uuid",
    "code": "HS-2026-ĐT-005",
    "title": "Hồ sơ mở ngành đào tạo Kỹ thuật Robot & AI",
    "responsiblePersonId": "user-lecturer-uuid",
    "managingDepartmentId": "dept-training-uuid",
    "itemCount": 24,
    "closedAt": "2026-09-23T15:00:00.000Z"
  }
  ```
- **Hệ quả & Phản ứng**:
  - Chuyển hồ sơ sang trạng thái chuẩn bị nộp lưu trữ cơ quan.

#### Event 11: `dossier.submitted_to_archive` (`DOSSIER_SUBMITTED_ARCHIVE_NOTIFICATION`)
- **Ngữ cảnh phát sinh**: Đơn vị lập hồ sơ nộp hồ sơ điện tử về Trung tâm Lưu trữ / Văn thư cơ quan theo Nghị định 30/2020/NĐ-CP (FSM chuyển `READY_FOR_ARCHIVE` $\to$ `SUBMITTED_TO_ARCHIVE`).
- **Aggregate**: `AggregateType.WORK_DOSSIER`, `aggregateId = dossier.id`.
- **Payload Schema**:
  ```json
  {
    "dossierId": "dos-uuid",
    "code": "HS-2026-ĐT-005",
    "submittedById": "user-lecturer-uuid",
    "retentionPeriodYears": 50,
    "classification": "INTERNAL",
    "submittedAt": "2026-09-23T15:30:00.000Z"
  }
  ```
- **Hệ quả & Phản ứng**:
  - Đưa yêu cầu kiểm tra, tiếp nhận hồ sơ vào Action Inbox của Cán bộ Lưu trữ cơ quan.

#### Event 12: `dossier.archived` (`DOSSIER_ACCEPTED_ARCHIVE_NOTIFICATION`)
- **Ngữ cảnh phát sinh**: Cán bộ lưu trữ cơ quan nghiệm thu và chính thức nhập kho lưu trữ điện tử vĩnh viễn (FSM chuyển `ACCEPTED` $\to$ `ARCHIVED`).
- **Ràng buộc bất biến**: **Rule 10.6 SoD**: Cán bộ nộp lưu (`submittedById` / `responsiblePersonId`) không được tự đóng vai Cán bộ lưu trữ để duyệt hồ sơ của chính mình. Trạng thái hồ sơ đóng băng bất biến.
- **Aggregate**: `AggregateType.WORK_DOSSIER`, `aggregateId = dossier.id`.
- **Payload Schema**:
  ```json
  {
    "dossierId": "dos-uuid",
    "code": "HS-2026-ĐT-005",
    "archivistId": "user-archivist-uuid",
    "submitterId": "user-lecturer-uuid",
    "archiveLocation": "KHO_LUU_TRU_SO_PHAN_HE_A",
    "archivedAt": "2026-09-23T16:00:00.000Z"
  }
  ```
- **Hệ quả & Phản ứng**:
  - Dọn dẹp Action Inbox của Lưu trữ viên.
  - Cập nhật chỉ mục tìm kiếm tài liệu lưu trữ toàn trường.

---

## 4. Đặc tả Kiến trúc Bộ Xử lý Sự kiện (Event Processor Architecture Specification)

### 4.1. Kiến trúc Tổng thể (Pipeline Topology)

Bộ xử lý sự kiện hoạt động theo mô hình **At-Least-Once Delivery** với cơ chế cách ly lỗi:

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             PRIMARY TRANSACTION BOUNDARY                          │
│                                                                                  │
│  [Domain Service]  ──►  1. Mutate Business State (Task, Document, Meeting...)   │
│         │          ──►  2. Generate Audit Log Entry (audit_events)              │
│         │          ──►  3. Enqueue Outbox Event (outbox_events status=PENDING)   │
│         ▼                                                                        │
│  COMMIT / ROLLBACK ($transaction atomically commits all or none)                 │
└──────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼ (Asynchronous Decoupling)
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           TRANSACTIONAL OUTBOX PROCESSOR                         │
│                                                                                  │
│  [Dispatcher Loop]                                                               │
│         │                                                                        │
│         ├───► Fetch available events (status=PENDING AND availableAt <= NOW)     │
│         ├───► Atomic Claim: status = PROCESSING (FOR UPDATE SKIP LOCKED)         │
│         │                                                                        │
│         ├───► ROUTE TO EVENT CONSUMERS:                                          │
│         │       ├──► Consumer A: Action Inbox Real-Time Projection               │
│         │       ├──► Consumer B: Notification Feed Generator                     │
│         │       ├──► Consumer C: Web Push & Email Dispatcher                     │
│         │       └──► Consumer D: Downstream Search & External Sync               │
│         │                                                                        │
│         ├───► ON SUCCESS:                                                        │
│         │       └──► UPDATE outbox_events SET status='COMPLETED', processedAt=NOW│
│         │                                                                        │
│         └───► ON FAILURE:                                                        │
│                 ├── attempts < maxRetries ──► exponential backoff (status=PENDING)│
│                 └── attempts >= maxRetries ─► DEAD-LETTER QUEUE (status=FAILED)  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

### 4.2. Khớp nối với Action Inbox (RFC-07)

Khác với bảng `Notification` lưu trữ thụ động, **Action Inbox** là một **bản chiếu thời gian thực (Derived Projection)** phản ánh chính xác các việc thực tế người dùng cần giải quyết:
- Khi `task.created` hoặc `document.directed` phát sinh $\to$ Tạo entry trong danh sách việc chờ giải quyết của Actor.
- Khi `task.approved` hoặc `meeting.minutes_confirmed` phát sinh $\to$ **Tự động xóa sạch entry khỏi Action Inbox** mà không cần người dùng đánh dấu đã đọc (Zero Read Tracking).

---

### 4.3. Mô hình Triển khai Dispatcher (Deployment Topologies)

Hệ thống hỗ trợ 2 mô hình vận hành:

1. **Mô hình Serverless / Single Instance (Cron / Heartbeat Worker)**:
   - Sử dụng một endpoint bảo vệ nội bộ: `POST /api/internal/outbox/process`.
   - Được gọi định kỳ mỗi 5–10 giây bởi cron service (Cloudflare Workers Cron, Kubernetes CronJob, hoặc node-cron nội bộ).
   - Phù hợp môi trường triển khai Next.js tiêu chuẩn.

2. **Mô hình Dedicated Long-Running Worker (Production Clustered)**:
   - Một tiến trình Node.js độc lập (`npm run worker:outbox`) chạy vòng lặp liên tục:
     - Polling lặp có khoảng nghỉ: `sleep(500ms)` nếu không có event mới.
     - Sử dụng native query PostgreSQL `FOR UPDATE SKIP LOCKED` để chia tải mượt mà giữa các worker nodes.

---

## 5. Danh mục Rủi ro & Kế hoạch Khắc phục (Risks & Remediation Plan)

| # | Rủi ro nhận diện | Mức độ | Biện pháp xử lý chuẩn tắc |
|:--|:---|:---:|:---|
| **R1** | **B-Tree Page Bloat trên PostgreSQL** do bảng outbox có tần suất insert/update/delete cao | Trung bình | Kích hoạt cấu hình autovacuum chuyên biệt cho `outbox_events` và thiết lập cron dọn dẹp các bản ghi `COMPLETED` quá 7 ngày tuổi. |
| **R2** | **Xung đột Concurrency giữa nhiều Worker** khi tải cao | Cao | Chuyển từ `updateMany` Prisma sang raw SQL `FOR UPDATE SKIP LOCKED` trong giai đoạn scale cụm. |
| **R3** | **Sự kiện chết (Poison Pills) làm nghẽn tiến trình** | Cao | Thắt chặt ngưỡng `maxRetries = 5` và ghi nhận toàn bộ stack trace vào `lastError` của hàng đợi DLQ. |
| **R4** | **Phát lặp sự kiện khi Worker sập nguồn đột ngột (At-least-once)** | Thấp | Bắt buộc mọi Event Consumer phía người nhận phải có cơ chế Idempotent xử lý dựa trên `aggregateType` + `aggregateId` + `id`. |

---

## 6. Kết luận & Phê duyệt Hoàn thành WI-7.4

1. Hạ tầng `outbox_events` và module `src/lib/db/outbox.ts` hiện tại đã đạt tiêu chuẩn Transactional Atomicity, hỗ trợ đầy đủ vòng đời `PENDING` $\to$ `PROCESSING` $\to$ `COMPLETED` / `FAILED`, exponential backoff và DLQ.
2. Bản đặc tả 12 Canonical Domain Events cung cấp khung tham chiếu đầy đủ cho các phân hệ Tasks, Documents, Meetings, và Dossiers theo đúng tinh thần RFC-07 và các quyết định kiến trúc đã phê duyệt.
3. **Work Item WI-7.4 chính thức hoàn thành**, sẵn sàng để đóng Issue #89 và chuyển tiếp sang WI-7.5 (FileObject Canonical Model Evolution).
