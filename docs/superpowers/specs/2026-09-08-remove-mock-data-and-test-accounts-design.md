# Thiết Kế Kiến Trúc: Loại Bỏ Toàn Bộ Mock Data & Tài Khoản Kiểm Thử 1-Click

- **Ngày ban hành**: 2026-09-08
- **Dự án**: QCET E-Office (Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn)
- **Mục tiêu**: Chuyển đổi toàn diện hệ thống sang mô hình **Database-First 100%**, loại bỏ toàn bộ dữ liệu giả lập (mock data), mã hóa cứng thông tin đăng nhập trong client, và tài khoản kiểm thử 1-Click nhằm đáp ứng tiêu chuẩn an toàn thông tin cơ quan hành chính nhà nước (OWASP ASVS / WSTG).

---

## 1. Bối Cảnh & Vấn Đề Hiện Tại

1. **Rủi ro An toàn Thông tin & Lộ Mật khẩu Mặc định**:
   - Trang `src/app/login/page.tsx` chứa mảng `SEED_ACCOUNTS` cùng mật khẩu cứng `Qcet@2026` được nhúng trực tiếp vào JavaScript bundle của trình duyệt.
   - Khối giao diện `Tài khoản kiểm thử CSDL hạt nhân (1-Click)` cho phép đăng nhập nhanh vào tài khoản BGH, Trưởng đơn vị, Chuyên viên mà không qua quy trình xác thực thực tế.
2. **Hiện tượng Flash of Mock Data (Nhấp nháy dữ liệu giả)**:
   - Các trang `/dashboard`, `/tasks`, `/unit-tasks` dùng `useState(() => getMockDashboardPayload())`. Khi người dùng mở trang, hệ thống render dữ liệu giả trước khi API CSDL kịp phản hồi, gây mất tính nhất quán và dễ nhầm lẫn dữ liệu báo cáo điều hành.
3. **Cơ chế Tự động Đăng nhập Giả lập (Auto-Login Demo)**:
   - Trong `src/lib/auth-context.tsx`, khi khách chưa đăng nhập hoặc cookie hết hạn, hệ thống tự động gán `DEFAULT_DEMO_USERS[0]` (TS. Nguyễn Văn Hiệu - Hiệu trưởng) làm người dùng hiện tại và tự cấp cookie demo.
4. **Phụ thuộc Tĩnh ở Modal Tạo Việc & Thông báo**:
   - `create-task-modal.tsx`, `notification-popover.tsx`, và `/notifications` phụ thuộc vào mảng tĩnh `QCET_PERSONNEL` và `INITIAL_NOTIFICATIONS` thay vì dữ liệu thực từ CSDL.
5. **Dữ liệu Mock nằm trong Runtime `src/`**:
   - `src/lib/mock-dashboard-data.ts` (~800 dòng) và `src/lib/mock-document-data.ts` nằm trực tiếp trong bundle ứng dụng, làm tăng kích thước bundle và gây phân mảnh nguồn dữ liệu chân lý.

---

## 2. Mục Tiêu & Tiêu Chuẩn Thiết Kế

1. **Tuân thủ Tiêu chuẩn Bảo mật OWASP**:
   - Loại bỏ hoàn toàn test credentials, demo bypass và default accounts khỏi giao diện sản xuất.
   - Form đăng nhập chuẩn hóa: Email công vụ (`@qcet.edu.vn`) + Mật khẩu thực tế được băm bằng bcrypt trong CSDL + Google Workspace SSO.
2. **Database-First & Zero-Mock Runtime**:
   - Toàn bộ dữ liệu hiển thị (Thống kê, Bảng nhiệm vụ, Cán bộ phân công, Thông báo) đều lấy từ PostgreSQL/SQLite qua Prisma ORM và Next.js API Routes.
   - Không tồn tại bất kỳ tệp mock nào trong thư mục `src/lib/`.
3. **Trải nghiệm Tải Dữ liệu Chuyên nghiệp (Loading Skeletons)**:
   - Trạng thái ban đầu nạp `isLoading = true`, `payload = null`.
   - Hiển thị Skeleton mượt mà trong khi chờ dữ liệu.
   - Khi có lỗi kết nối, hiển thị Error Alert kèm nút "Thử lại kết nối" (Retry), tuyệt đối không âm thầm tráo dữ liệu giả.
4. **Cô lập Dữ liệu Test sang Thư mục Kiểm thử (`tests/fixtures/`)**:
   - Di chuyển các hàm mock phục vụ Unit/Integration tests sang `tests/fixtures/`, tách rời 100% khỏi mã nguồn chạy thực tế. Đảm bảo toàn bộ test suites (`npm test`) tiếp tục xanh 100%.
5. **Tuân thủ Nghiêm ngặt Light-Only Standard**:
   - Giao diện sử dụng thuần túy Light mode chuẩn công sở hành chính giáo dục theo `CLAUDE.md`. Không dùng class `dark:`.

---

## 3. Chi Tiết Thay Đổi Kiến Trúc

### 3.1. Trang Đăng nhập (`src/app/login/page.tsx`)
- **Gỡ bỏ**:
  - `SEED_ACCOUNTS` hằng số.
  - `handleQuickSeedLogin` hàm xử lý.
  - `loadingSeedEmail` state.
  - Phân vùng divider và 3 thẻ bấm `Tài khoản kiểm thử CSDL hạt nhân (1-Click)`.
- **Giữ lại & Tối ưu**:
  - Khối định danh thương hiệu QCET (Logo, Tên trường, Tên hệ thống).
  - Form Đăng nhập chính quy (Email + Password + Show/Hide password).
  - Nút Đăng nhập Google SSO (`@qcet.edu.vn`).
  - Tab Đăng ký tài khoản nội bộ (đã kết nối với `/api/auth/register` lưu CSDL).

### 3.2. Ngăn Điều Hướng Di Động (`src/components/layout/mobile-menu-drawer.tsx`)
- Gỡ bỏ khối "CHUYỂN VAI TRÒ TRẢI NGHIỆM" (`DEMO_USERS.map(...)`).

### 3.3. Cơ Chế Quản Lý Phiên Xác Thực (`src/lib/auth-context.tsx`)
- **Xóa bỏ Auto-login Demo**:
  - Khi chưa đăng nhập (`/api/auth/me` trả về `authenticated: false` và không có thông tin hợp lệ trong `localStorage`), chuyển `user = null` (hoặc guest state) và `isLoading = false`.
  - Không tự ý cấp cookie demo cho khách vãng lai.
- **Xử lý Đăng xuất**:
  - `logout()` gọi API `/api/auth/logout`, xóa sạch token/user trong `localStorage`, chuyển hướng về `/login`. Không reset về tài khoản Hiệu trưởng.

### 3.4. Các Trang Bàn Làm Việc (`/dashboard`, `/tasks`, `/unit-tasks`)
- Thay đổi state khởi tạo:
  ```typescript
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  ```
- Hiển thị component `DashboardSkeleton` hoặc khung xương nạp sẵn:
  - 4 thẻ KPI thống kê rỗng hiển thị hiệu ứng `animate-pulse` với nền `bg-muted/60`.
  - Bảng nhiệm vụ hiển thị 5 dòng skeleton.
- Khi API `/api/dashboard/overview` hoàn thành: cập nhật `payload` và tắt `isLoading`.
- Khi API thất bại: hiển thị thông báo lỗi mạng/kết nối kèm nút "Thử lại".

### 3.5. Cung Cấp API Người Dùng Thật (`src/app/api/users/route.ts`)
- Tạo endpoint mới `GET /api/users`:
  - Truy vấn từ Prisma: `prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, departmentId: true, department: { select: { id: true, name: true, shortName: true } }, title: true, avatarUrl: true } })`.
  - Hỗ trợ lọc theo `departmentId` hoặc tìm kiếm `q`.

### 3.6. Modal Tạo Công Việc (`src/components/dashboard/create-task-modal.tsx`)
- Xóa import `QCET_PERSONNEL` từ `mock-dashboard-data.ts`.
- Gọi `GET /api/users` để lấy danh sách cán bộ thực tế của trường làm danh sách lựa chọn Người chủ trì và Người phối hợp.

### 3.7. Trung Tâm Thông Báo (`notification-popover.tsx` & `/notifications/page.tsx`)
- Xóa import `INITIAL_NOTIFICATIONS` và `QCET_PERSONNEL`.
- Nạp thông báo từ `/api/notifications`. Nếu không có thông báo, hiển thị giao diện rỗng trang nhã.

### 3.8. Xử Lý Notion Client Fallback (`src/lib/notion-client.ts`)
- Gỡ bỏ việc import và trả về `getMockDashboardPayload()`.
- Trả về đối tượng rỗng chuẩn kiểu dữ liệu kèm thông báo lỗi cấu hình nếu Notion Token chưa được thiết lập.

### 3.9. Tách Rời Test Fixtures & Dọn Dẹp Mã Nguồn Runtime
- Tạo `tests/fixtures/dashboard-fixtures.ts` chứa dữ liệu mẫu để phục vụ cho các file kiểm thử unit test.
- Tạo `tests/fixtures/document-fixtures.ts` chứa dữ liệu mẫu cho kiểm thử quản lý văn bản.
- Xóa vĩnh viễn:
  - `src/lib/mock-dashboard-data.ts`
  - `src/lib/mock-document-data.ts`
- Cập nhật toàn bộ file trong `tests/*.test.ts` để import từ `tests/fixtures/`.

### 3.10. Khắc Phục Lộ Mật Khẩu ở Modal Google Login (`google-login-button.tsx`)
- Rà soát phát hiện: `src/components/auth/google-login-button.tsx` hiển thị thông báo chứa mật khẩu văn bản thô `Qcet@2026` và gợi ý click tài khoản kiểm thử 1-Click.
- Thay thế bằng thông báo hướng dẫn chuẩn: Cán bộ sử dụng email công vụ được cấp bởi Ban Giám hiệu hoặc liên hệ Bộ phận Quản trị mạng & CNTT để được cấp quyền truy cập.

### 3.11. Rà Soát CSDL Seed Script (`prisma/seed.ts` - Tuân thủ CWE-798 & CWE-1188)
- Gỡ bỏ nhóm 3 tài khoản demo kiểm thử tĩnh tại mục 2.1 (`user-admin-bgh`, `user-manager-daotao`, `user-staff-vinh`).
- Giữ lại danh sách 11 phòng/khoa/trung tâm chuẩn và danh mục cán bộ công vụ ban đầu phục vụ vận hành. Mật khẩu khởi tạo được quản lý qua biến môi trường hoặc chính sách bảo mật thay vì nhúng cứng vào giao diện client.

---

## 4. Kế Hoạch Triển Khai & Kiểm Thử (Verification Plan)

1. **Kiểm tra tĩnh & Biên dịch (Typecheck)**:
   - Chạy `npm run typecheck` để đảm bảo không còn bất kỳ import mồ côi nào trỏ đến các tệp mock đã xóa.
2. **Kiểm thử tự động (Unit & Integration Tests)**:
   - Chạy `npm test` để kiểm chứng toàn bộ 100% test suites vẫn chạy thành công.
3. **Kiểm tra giao diện thực tế (Visual Verification)**:
   - Mở trang `/login`: Xác nhận khối 1-Click đã biến mất hoàn toàn, form đăng nhập chính quy và nút Google SSO hiển thị sắc nét.
   - Mở trang `/dashboard` và `/tasks`: Xác nhận hiển thị Skeleton trong lúc fetch dữ liệu và hiển thị đầy đủ dữ liệu CSDL sau khi nạp xong.
   - Mở modal Tạo việc: Xác nhận danh sách cán bộ được lấy từ CSDL.
