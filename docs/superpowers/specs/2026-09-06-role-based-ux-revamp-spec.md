# QCET E-Office: Đặc Tả Thiết Kế Cải Cách Trải Nghiệm Người Dùng Phân Quyền (Role-Based UX Architecture)

- **Ngày ban hành:** 2026-09-06
- **Trạng thái:** Bản thảo đề xuất (Approved Draft)
- **Tác giả:** Đội ngũ Kỹ thuật & Thiết kế QCET
- **Phiên bản:** 2.0 Enterprise

---

## 1. Bối Cảnh & Vấn Đề Cốt Lõi (Context & Problem Statement)

### 1.1 Hiện trạng
Hệ thống QCET E-Office hiện tại bị quá tải thông tin nghiêm trọng ("Dashboard Fatigue" & "Information Overload"). 
- Cả Giảng viên/Nhân sự (`STAFF`), Trưởng đơn vị (`MANAGER`) và Ban Giám Hiệu (`ADMIN`) khi đăng nhập đều bị đưa vào một giao diện dày đặc chỉ số: thanh 12 tháng học thuật, 6 bộ lọc nâng cao, ma trận KPI 11 đơn vị và bảng phân cấp nhiệm vụ lồng ghép 2 tầng.
- **Hậu quả:** 
  - Giảng viên không biết việc của mình ở đâu, hạn chót khi nào, nộp minh chứng vào đâu.
  - Trưởng đơn vị không có nơi duyệt nhanh minh chứng cho khoa mình.
  - Ban Giám hiệu bị chôn vùi trong các nhiệm vụ vụn vặt thay vì tập trung vào các hồ sơ phê duyệt chiến lược và cảnh báo rủi ro.

### 1.2 Nguyên lý chỉ đạo (Guiding Philosophy)
Áp dụng nguyên tắc chuẩn hóa quốc tế: **"Same Truth, Different Altitude" (Cùng một dữ liệu, khác tầng quan sát)**:
1. **Giảng viên / Nhân sự (`STAFF`):** Tầng quan sát cá nhân (Tối giản như Linear/Todoist) — Chỉ hiển thị việc của tôi, hạn chót và nút nộp minh chứng 1 chạm.
2. **Trưởng Khoa / Trưởng Phòng (`MANAGER`):** Tầng quan sát đơn vị — Hàng đợi duyệt minh chứng khoa (Approve / Request Revision / Reject) + Phân công việc khoa + Nút chuyển nhanh sang việc cá nhân (Dual-Role).
3. **Ban Giám Hiệu (`ADMIN`):** Tầng quan sát chiến lược — Hàng đợi phê duyệt cấp trường + Radar phát hiện rủi ro/chậm trễ của 11 đơn vị.

---

## 2. Kiến Trúc Điều Hướng & Điều Tuyến (Navigation & Routing Architecture)

### 2.1 Chuẩn hóa URL Routes (Loại bỏ URL Query `?zone=...`)
Xóa bỏ hoàn toàn cơ chế chuyển tab giả lập `/?zone=tasks`, `/?zone=dashboard` trên Sidebar, chuyển sang các Route chuẩn Next.js App Router:
- `/`: **Bàn làm việc Trang chủ (Home Workspace)** — Tự động nhận diện role để tải đúng Workspace tương ứng.
- `/tasks`: **Kho nhiệm vụ toàn trường (Master Task Directory)** — Bảng phân cấp CascadingTable, Kanban, bộ lọc 12 tháng học thuật đầy đủ.
- `/calendar`: **Lịch công tác chu kỳ 25 - 24**.
- `/org`: **Cơ cấu tổ chức & Danh bạ 11 đơn vị**.
- `/notifications`: **Trung tâm thông báo & Phê duyệt**.

### 2.2 Menu Sidebar Cố định (Global Navigation)
Giữ nguyên Sidebar nhất quán với 5 mục điều hướng thân thuộc, không làm xáo trộn thói quen của người dùng.

---

## 3. Thiết Kế Chi Tiết 3 Bàn Làm Việc (Workspace Specifications)

### 3.1 Staff Workspace (Dành cho Giảng viên / Chuyên viên)
- **Component:** `src/components/workspace/staff-workspace.tsx`
- **Mục tiêu:** Xử lý việc cá nhân trong vòng dưới 15 giây.
- **Bố cục:**
  1. **Khối tóm tắt nhanh (Urgency Strip):**
     - Hôm nay / Quá hạn (Đỏ)
     - Trong tuần này (Vàng)
     - Đang chờ duyệt (Xanh lam)
     - Cần sửa lại (Cam - kèm ghi chú của Trưởng khoa)
  2. **Bộ lọc danh sách cá nhân tinh gọn:**
     - Tab: `Tất cả việc của tôi` | `Cần làm ngay` | `Chờ duyệt` | `Đã hoàn thành`
  3. **Thẻ nhiệm vụ cá nhân (Personal Task Card):**
     - Tiêu đề nhiệm vụ + Thuộc nhiệm vụ trường nào.
     - Hạn chót (định dạng ngày tháng trực quan, ví dụ: "17:00 Hôm nay", "Còn 2 ngày").
     - Nút hành động trực tiếp: **[+ Nộp minh chứng / Báo cáo]**.

### 3.2 Manager Workspace (Dành cho Trưởng Khoa / Trưởng Phòng)
- **Component:** `src/components/workspace/manager-workspace.tsx`
- **Mục tiêu:** Duyệt nhanh minh chứng cấp khoa và phân công nhiệm vụ khoa.
- **Bố cục:**
  1. **Dual-Role Switcher (Góc trên):**
     - Nút toggle chuyển đổi 1-chạm: **[🏢 Điều hành Khoa]** $\leftrightarrow$ **[👤 Việc cá nhân của tôi (2)]**. Có chấm số đỏ báo việc cá nhân sắp đến hạn.
  2. **Hàng đợi Phê duyệt Minh chứng Khoa (Unit Approval Queue):**
     - Hiển thị các `StaffTask` có trạng thái `NEEDS_REVIEW` thuộc khoa mình.
     - Hiển thị người nộp, thời gian nộp, tên file đính kèm.
     - 3 nút hành động nhanh:
       - `[👁️ Xem file]`: Mở xem trước nhanh.
       - `[✅ Duyệt]`: Phê duyệt đạt yêu cầu.
       - `[↩️ Yêu cầu sửa]`: Mở hộp thoại nhập lý do chỉnh sửa (bắt buộc nhập) để gửi lại giảng viên.
  3. **Tiến độ Công việc Trường giao Khoa (Department Assigned Tasks):**
     - Thanh tiến độ hoàn thành các nhiệm vụ trường giao trong tháng hiện tại.
     - Nút **[+ Giao việc con cho Giảng viên]** ngay tại từng đầu việc.

### 3.3 Executive Workspace (Dành cho Ban Giám Hiệu)
- **Component:** `src/components/workspace/executive-workspace.tsx`
- **Mục tiêu:** Ra quyết định phê duyệt cấp trường và theo dõi điểm nghẽn rủi ro.
- **Bố cục:**
  1. **Hàng đợi Phê duyệt Chiến lược (Strategic Approval Queue):**
     - Hiển thị các hồ sơ cấp trường đã qua Trưởng đơn vị thẩm định (`WAITING_BGH_APPROVAL`).
     - Xem tóm tắt tờ trình, danh sách minh chứng $\rightarrow$ Bấm **[Ký duyệt ban hành]** hoặc **[Trả lại đơn vị]**.
  2. **Radar Sức Khỏe 11 Đơn Vị (Department Health Radar):**
     - Danh sách 11 đơn vị với thanh tiến độ % và mã màu trạng thái (Xanh / Vàng / Đỏ).
     - Đơn vị có việc trễ hạn được đẩy lên trên cùng kèm nút **[Xem chi tiết điểm nghẽn]** và **[Gửi nhắc nhở]**.
  3. **Nút chỉ đạo nhanh:**
     - **[+ Giao nhiệm vụ chỉ đạo BGH]** $\rightarrow$ Tạo nhiệm vụ trọng tâm cấp trường.

---

## 4. Quy Trình Nộp & Duyệt Minh Chứng (Submission & Approval Lifecycle)

### 4.1 Máy trạng thái (State Machine)
- `IN_PROGRESS` $\rightarrow$ Giảng viên làm việc.
- `NEEDS_REVIEW` $\rightarrow$ Giảng viên nộp file/link minh chứng.
- `REVISION_REQUESTED` $\rightarrow$ Trưởng khoa yêu cầu bổ sung/sửa đổi (kèm comment).
- `WAITING_BGH_APPROVAL` $\rightarrow$ Trưởng khoa duyệt việc cấp trường, đẩy lên BGH.
- `COMPLETED` $\rightarrow$ Hoàn thành nghiệm thu.

### 4.2 Modal nộp minh chứng (`submit-deliverable-modal.tsx`)
- Kéo thả file PDF, Word, Excel, Ảnh hoặc dán link Google Drive/OneDrive.
- Ô nhập ghi chú ngắn gọn.
- Tự động lưu bản nháp vào `sessionStorage` chống mất dữ liệu khi rớt mạng.

### 4.3 Dialog xử lý phê duyệt (`review-action-dialog.tsx`)
- Xem trước tài liệu.
- Lựa chọn 3 quyết định:
  1. `approved`: Xác nhận hợp lệ.
  2. `revision_requested`: Yêu cầu làm lại (bắt buộc nhập lý do $\ge 5$ ký tự).
  3. `rejected`: Từ chối hoàn toàn.

---

## 5. Chiến Lược Triển Khai An Toàn (Safety & Rollout Strategy)

1. **Strangler Fig Pattern:** Giữ nguyên toàn bộ logic dữ liệu và trang kho nhiệm vụ cũ tại `/tasks`. Người dùng có thể bấm nút **[👁️ Xem kho nhiệm vụ toàn trường]** bất cứ lúc nào nếu cần tra cứu sâu.
2. **Derived State & Single Source of Truth:** Không nhân bản state. Toàn bộ 3 workspace lấy dữ liệu dẫn xuất từ nguồn dữ liệu gốc của ứng dụng.
3. **Phân quyền hiển thị (Action Gating):** Nút hành động chỉ hiển thị khi người dùng có thẩm quyền VÀ nhiệm vụ ở đúng trạng thái. Không hiển thị các nút mờ gây nhiễu giao diện.
4. **Tối ưu hiệu năng:** Sử dụng `next/dynamic` để code-split 3 workspace, giảm dung lượng bundle ban đầu và loại bỏ hoàn toàn hiện tượng Hydration Mismatch.

---

## 6. Tiêu Chuẩn Nghiệm Thu & Đảm Bảo Chất Lượng (Quality Gates)

1. **TypeScript Typecheck:** `npm run typecheck` đạt 0 lỗi.
2. **Automated Testing:** `npm test` vượt qua 100% các bộ unit & integration tests.
3. **Kiểm định thực tế (Browser Preview Verification):**
   - Đăng nhập với role `STAFF`: Giao diện sạch sẽ, chỉ có việc của tôi, nộp minh chứng thành công.
   - Đăng nhập với role `MANAGER`: Hàng đợi duyệt hoạt động trơn tru (Duyệt / Yêu cầu sửa), chuyển đổi việc khoa - việc cá nhân tức thì.
   - Đăng nhập với role `ADMIN`: Hàng đợi phê duyệt cấp trường và Radar rủi ro 11 đơn vị hiển thị chính xác.
