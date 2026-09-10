# ĐẶC TẢ THIẾT KẾ KỸ THUẬT: LOẠI BỎ TOÀN BỘ MOCK DATA & KẾT NỐI DỮ LIỆU THỰC PRISMA POSTGRESQL
## DỰ ÁN: HỆ THỐNG VĂN PHÒNG ĐIỆN TỬ QCET E-OFFICE
* **Mã tài liệu:** `SPEC-2026-09-07-REMOVE-MOCK-DATA`
* **Đơn vị:** Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (QCET)
* **Thời gian lập:** Ngày 07 tháng 09 năm 2026
* **Trạng thái:** Đã phê duyệt (Approved)

---

## 1. MỤC TIÊU & PHẠM VI DỰ ÁN (OBJECTIVES & SCOPE)

### 1.1. Hiện trạng & Vấn đề Cốt lõi
1. **Phụ thuộc Mock Data:** Hệ thống giao diện hiện tại (`UnifiedTaskHub`, `DashboardZone`, `TasksZone`, `DocumentRegistryView`) vẫn phụ thuộc vào các tệp tĩnh `src/lib/mock-dashboard-data.ts` và `src/lib/mock-document-data.ts`.
2. **Fallback che giấu lỗi:** Endpoint `/api/dashboard/overview` gọi `fetchNotionDashboardData()`, khi thất bại tự động trả về `mock-fallback` thay vì dữ liệu cơ sở dữ liệu thực.
3. **Cơ sở dữ liệu đã sẵn sàng:** PostgreSQL (`qcet_eoffice`) đã được cấu hình với 13 bảng Prisma, chứa sẵn 18 người dùng, 16 phòng ban và 40 nhiệm vụ, nhưng chưa có sổ văn bản và chưa được kết nối hoàn chỉnh với giao diện người dùng.

### 1.2. Mục tiêu Thiết kế
1. **100% Dữ liệu Thực:** Chuyển toàn bộ các thành phần hiển thị và nghiệp vụ sang đọc/ghi trực tiếp vào cơ sở dữ liệu PostgreSQL qua Prisma Client.
2. **Idempotent Database Seeding:** Bổ sung toàn bộ danh mục Sổ văn bản chuẩn Nghị định 30/2020/NĐ-CP (Văn bản đến, Văn bản đi, Tờ trình nội bộ, Bút phê chỉ đạo, Tệp đính kèm scan PDF) vào `prisma/seed.ts` với cơ chế `upsert`.
3. **Tầng Dịch vụ Máy chủ Hợp nhất (`DashboardService`):** Xây dựng tầng tổng hợp số liệu thời gian thực không cache ngầm (`force-dynamic`, `no-store`).
4. **Optimistic Updates với Cơ chế Rollback:** Đảm bảo trải nghiệm người dùng phản hồi tức thì (< 50ms) khi thao tác đổi trạng thái, phê duyệt, nộp bài, đồng thời tự động hoàn tác và thông báo nếu API máy chủ phát sinh lỗi.
5. **Triệt tiêu Hoàn toàn Mock Fallback:** Khi mất kết nối cơ sở dữ liệu, trả về mã lỗi HTTP chuẩn (`500/503`) cùng giao diện thông báo lỗi trực quan thay vì âm thầm hiển thị dữ liệu giả.

---

## 2. KIẾN TRÚC TẦNG DỮ LIỆU & SEEDING (DATA ARCHITECTURE)

### 2.1. Idempotent Seeding Quy chuẩn NĐ 30/2020 (`prisma/seed.ts`)
Bổ sung nạp dữ liệu Sổ văn bản vào `prisma/seed.ts`:
* **Văn bản đến (VAN_BAN_DEN):** 10+ văn bản thực tế từ Tổng cục GDNN, UBND Tỉnh Bình Định, Sở LĐTBXH.
* **Văn bản đi (VAN_BAN_DI):** 10+ quyết định, công văn do Hiệu trưởng / Phó Hiệu trưởng ký ban hành.
* **Tờ trình nội bộ (TO_TRINH_NOI_BO):** 5+ tờ trình thẩm định DACUM, mua sắm vật tư xưởng thực hành.
* **Bộ đếm số tự động (`document_number_sequences`):** Khởi tạo chỉ số `lastNumber` cho năm 2026.
* **Ý kiến chỉ đạo (`document_directives`):** Gắn bút phê của Hiệu trưởng và phân công phòng/khoa chủ trì, người phối hợp.
* **Tệp đính kèm (`document_attachments`):** Thông tin tệp scan PDF/A chuẩn hành chính.

### 2.2. Dịch vụ Máy chủ Hợp nhất (`src/lib/server/dashboard-service.ts`)
Xây dựng module truy vấn dữ liệu thời gian thực:
```typescript
export interface LiveDashboardOptions {
  userId?: string;
  departmentId?: string;
  academicMonth?: number;
  academicYear?: string;
}

export async function getLiveDashboardData(options?: LiveDashboardOptions): Promise<DashboardPayload> {
  // 1. Tải danh sách nhiệm vụ cấp trường (TaskScope.SCHOOL) kèm subTasks và assignees
  // 2. Tính toán DashboardStats (totalTasks, inProgress, completed, overdue, pendingApprovals)
  // 3. Tính toán Ma trận 11 đơn vị (DepartmentHealthSummary[])
  // 4. Lọc danh sách Approvals Queue (5 mục chờ duyệt) & Bottlenecks Queue (3 mục trễ hạn)
  // 5. Tổng hợp dòng sự kiện hoạt động (ActivityEvent[])
}
```

---

## 3. KIẾN TRÚC API ROUTES (BACKEND CONTRACTS)

### 3.1. `/api/dashboard/overview`
* **Phương thức:** `GET`
* **Cấu hình Cache:**
  ```typescript
  export const dynamic = "force-dynamic";
  export const revalidate = 0;
  ```
* **Luồng xử lý:**
  1. Xác thực phiên đăng nhập (JWT Session Cookie / Bearer Token).
  2. Gọi `getLiveDashboardData()`.
  3. Trả về payload với header `Cache-Control: no-store, max-age=0`.
  4. Nếu có lỗi truy vấn cơ sở dữ liệu: Trả về HTTP 500 `{ success: false, error: "Lỗi kết nối cơ sở dữ liệu" }`.

### 3.2. `/api/documents` & `/api/documents/stats`
* **`GET /api/documents`:** Truy vấn phân trang, tìm kiếm, lọc theo loại văn bản, năm, trạng thái trực tiếp từ bảng `documents`.
* **`POST /api/documents`:** Vào sổ văn bản mới kèm cập nhật atomic bộ đếm số (`document_number_sequences`).
* **`GET /api/documents/stats`:** Thống kê tổng số văn bản đến/đi/tờ trình, số văn bản chờ xử lý, số văn bản khẩn.

### 3.3. `/api/tasks` & Các thao tác Đột biến (Mutations)
* **`PATCH /api/tasks/[id]`:** Cập nhật trạng thái nhiệm vụ, tỷ lệ hoàn thành.
* **`POST /api/tasks/[id]/deliverables`:** Nộp tệp minh chứng và chuyển trạng thái nhiệm vụ sang `WAITING_APPROVAL`.
* **`POST /api/executive/resolutions`:** Ban hành nghị quyết xử lý điểm nghẽn (Gia hạn tiến độ, Điều phối nhân sự, Bút phê chỉ đạo).
* **`POST /api/delegations`:** Ủy quyền thẩm định và phê duyệt nhiệm vụ chuyên môn DACUM.

---

## 4. KIẾN TRÚC TẦNG GIAO DIỆN (CLIENT ARCHITECTURE)

### 4.1. `useTaskMutations` Hook
* Loại bỏ `getMockDashboardPayload()` làm state khởi tạo.
* Sử dụng trạng thái ban đầu:
  ```typescript
  const [dashboardData, setDashboardData] = useState<DashboardPayload | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  ```
* Cơ chế Optimistic Update với Rollback Snapshot:
  1. Ghi nhận `previousState = dashboardData`.
  2. Cập nhật state cục bộ ngay lập tức.
  3. Gửi yêu cầu HTTP đến API tương ứng (`/api/tasks/[id]`, `/api/tasks/[id]/deliverables`...).
  4. Khi API thất bại: Khôi phục lại `setDashboardData(previousState)` và kích hoạt Toast thông báo lỗi.

### 4.2. `DocumentRegistryView`
* Xóa bỏ khai báo `useState<OfficialDocument[]>(MOCK_DOCUMENTS)`.
* Tải dữ liệu thật từ `/api/documents` và `/api/documents/stats` khi component mount hoặc khi bộ lọc thay đổi.
* Hiển thị Skeleton loading cho bảng sổ văn bản trong thời gian chờ dữ liệu.

### 4.3. UI Skeleton Loading & Trạng thái Rỗng (Empty States)
* Thiết kế Skeleton placeholder chuẩn công thái học cho:
  * 4 Thẻ chỉ số BGH (`ExecutiveStatStrip`).
  * 2 Hàng đợi Chiến lược (`ExecutiveActionCenter`).
  * Ma trận 11 đơn vị (`DepartmentProgressMatrix`).
  * Bảng nhiệm vụ (`CascadingTaskTable`).
  * Sổ văn bản (`DocumentRegistryView`).
* Đảm bảo khi cơ sở dữ liệu chưa có bản ghi nào, hiển thị Empty State văn minh, có nút "Khởi tạo dữ liệu mẫu / Làm mới".

---

## 5. KẾ HOẠCH BẢO ĐẢM CHẤT LƯỢNG & KIỂM THỬ (QA & VERIFICATION)

1. **Kiểm tra Seed Cơ sở dữ liệu:**
   * Chạy `npx prisma db seed` không phát sinh lỗi trùng lặp khóa hoặc vi phạm ràng buộc toàn vẹn.
   * Xác nhận số lượng bản ghi trong các bảng: `users >= 18`, `departments >= 16`, `tasks >= 40`, `documents >= 15`.
2. **Kiểm tra TypeScript & Không suy thoái Kiểu:**
   * `npm run typecheck` (`tsc --noEmit`) đạt 0 lỗi.
3. **Kiểm thử Đơn vị & Tích hợp (TDD Suite):**
   * Cập nhật các test suite để kiểm thử `DashboardService` và các API endpoints với cơ chế mock Prisma hoặc kiểm thử trực tiếp trên DB test.
   * Chạy `npm test` đảm bảo 100% tests vượt qua.
4. **Kiểm tra Hồi quy Thị giác (Headless Chrome Visual Capture):**
   * Chạy `scripts/verify-ui-ux-visual-regressions.sh` trên `localhost:3001` xác thực giao diện hiển thị dữ liệu thật sắc nét, không bị giật layout hay vỡ định dạng.
