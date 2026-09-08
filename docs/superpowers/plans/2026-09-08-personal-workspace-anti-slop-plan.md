# KẾ HOẠCH TRIỂN KHAI: TINH GIẢN KHÔNG GIAN CÁ NHÂN & LOẠI BỎ AI SLOP (LINEAR-GRADE ANTI-SLOP WORKSPACE)

**Ngày lập:** 08/09/2026  
**Dựa trên đặc tả:** `docs/superpowers/specs/2026-09-08-personal-workspace-anti-slop-design.md`  
**File mục tiêu chính:** `src/components/portal/lecturer-focus-workspace.tsx`  
**Mục tiêu:** Loại bỏ sự thừa thãi, trùng lặp nút bấm và bộ lọc; gom 5 tầng widget thành 1 thanh Toolbar tinh gọn; triệt tiêu rác số 0; đưa trải nghiệm đạt chuẩn mực Linear/Notion.

---

## 1. Các Hạng mục Thay Đổi Cụ Thể (Proposed Changes)

### 1.1 Tinh gọn Header trang (`Section 1: Page Header`)
- **Vấn đề:** 
  - Nút `+ Tạo việc mới` trùng lặp với nút `+ Tạo việc` trên Topbar.
  - Nút `Kho nhiệm vụ ->` trùng lặp với mục `Kho nhiệm vụ` trong Sidebar.
  - Dòng thông tin tiểu sử `Chuyên viên CNTT · Nguyễn Ngọc Vinh · Khoa CNTT · Năm học 2026 - 2027` gây thừa thãi.
- **Giải pháp:**
  - Xóa nút `+ Tạo việc mới` trong header trang.
  - Xóa nút `Kho nhiệm vụ ->` trong header trang.
  - Giữ lại nút `Làm mới (↻)` gọn gàng bên phải tiêu đề.
  - Rút gọn subtitle thành dạng thanh lịch, chứa đủ: Tên người dùng, Đơn vị, Vai trò (đảm bảo pass test `test("renders welcome header with user name and department")`).

### 1.2 Hợp nhất Thẻ KPI và Dải Pill Lọc (`Section 2 & Section 3 -> Unified Toolbar`)
- **Vấn đề:** 
  - 5 Thẻ KPI to (`Hôm nay cần làm`, `Trong tuần này`, `Chờ lãnh đạo duyệt`, `Cần chỉnh sửa`, `Đã hoàn thành`) chiếm 150px chiều cao màn hình chỉ để hiển thị con số `0`.
  - Ngay bên dưới là dải 6 nút Pill lọc trạng thái lặp lại 100% cùng chức năng và cùng đếm số lượng.
  - Ô tìm kiếm to chiếm nguyên một hàng ngang.
  - Các badge `(0)` rải khắp nơi.
- **Giải pháp:**
  - Thay vì để 5 thẻ to đùng độc lập bên trên rồi lại lặp lại bên dưới, ta gom thành **1 thanh Toolbar tích hợp chuẩn Linear**:
    - **Hàng 1 (Chức năng cốt lõi):**
      - Bên trái: Cụm Segmented Tabs theo quyền sở hữu: `Tất cả` | `Tôi chủ trì (DRI)` | `Tôi tham gia (Phối hợp)`.
        - Triệt tiêu số 0: Chỉ hiển thị `(X)` khi $X > 0$, nếu bằng 0 chỉ hiển thị nhãn chữ.
      - Bên phải:
        - Ô tìm kiếm cục bộ tích hợp nhỏ gọn (`w-56 sm:w-64`, icon kính lúp 14px, có nút clear `x`).
        - Nút `Thu gọn tất cả / Mở rộng tất cả`.
        - Bộ đếm: `Hiển thị X / Y nhiệm vụ`.
    - **Hàng 2 (Dải lọc trạng thái tương tác):**
      - Dải `Lọc trạng thái:` chứa trực tiếp các nhãn lọc theo hợp đồng test:
        - `Hôm nay cần làm`
        - `Trong tuần này`
        - `Chờ lãnh đạo duyệt`
        - `Cần chỉnh sửa`
        - `Đã hoàn thành`
      - Nếu số đếm tương ứng $> 0$, hiển thị badge nổi bật (vd: `Hôm nay cần làm (3)`). Nếu bằng 0, hiển thị nhãn phẳng dịu nhẹ, không gây áp lực số 0.
      - Có nút `[Xóa lọc]` khi `activeFilter !== "ALL"`.

### 1.3 Nâng cấp Empty State kép (Dual Contextual Empty State)
- **Vấn đề:** Khi nhân sự không có việc tồn đọng (hoặc chưa được phân công việc), màn hình hiển thị icon rỗng cùng thông điệp như bị lỗi tìm kiếm: *"Không tìm thấy nhiệm vụ nào / Không có công việc nào thỏa mãn tiêu chí tìm kiếm..."*.
- **Giải pháp:**
  - Phân tách rõ 2 ngữ cảnh:
    - **Ngữ cảnh 1 (Inbox Zero - Hoàn thành hết việc):** Khi `groupedTasks.length === 0` và không có từ khóa tìm kiếm (`searchTerm === ""`) và `activeFilter === "ALL"`:
      - Icon: `CheckCircle2` dịu mát (`text-emerald-600` hoặc `text-primary/80`).
      - Tiêu đề: `"Tuyệt vời! Bạn không có công việc nào tồn đọng"`.
      - Mô tả: `"Tất cả nhiệm vụ được giao đã hoàn thành hoặc đang chờ phê duyệt."`.
    - **Ngữ cảnh 2 (Không tìm thấy do bộ lọc hoặc tìm kiếm):** Khi có `searchTerm` hoặc `activeFilter !== "ALL"`:
      - Icon: `Search` hoặc `Inbox` tinh tế.
      - Tiêu đề: `"Không tìm thấy nhiệm vụ phù hợp"`.
      - Mô tả: `"Không có công việc nào khớp với từ khóa hoặc bộ lọc đã chọn."`.
      - Nút hành động: `[Xóa bộ lọc & tìm kiếm]`.

---

## 2. Kế hoạch Kiểm thử & Bảo toàn Hệ thống (Testing & Safety Plan)

Theo quy tắc kỹ thuật trong `CLAUDE.md`:
1. **Không chạy `next build` khi dev server đang chạy** để tránh làm hỏng cache CSS.
2. Kiểm tra tính tương thích ngược và tính đúng đắn bằng:
   - `npm test tests/task-ownership-model.test.ts`
   - `npm test tests/role-based-workspace-workflow.test.ts`
   - `npm test tests/staff-focus-view.test.ts`
   - `npm run typecheck`
3. Kiểm tra preview trực tiếp trên giao diện để bảo đảm không có lỗi vỡ layout hoặc styling.

---

## 3. Các bước thực hiện (Execution Steps)

1. [x] Lập Kế hoạch Triển khai (Implementation Plan) & Commit tài liệu.
2. [ ] Refactor `src/components/portal/lecturer-focus-workspace.tsx` theo chuẩn Linear anti-slop.
3. [ ] Chạy kiểm thử tự động với Node/tsx test runner và TypeScript typecheck.
4. [ ] Xác nhận giao diện trực quan sạch đẹp, trực quan, không còn rác thị giác.
