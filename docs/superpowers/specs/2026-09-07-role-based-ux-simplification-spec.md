# ĐẶC TẢ CHI TIẾT TÁI THIẾT KẾ UX/UI: ĐƠN GIẢN HÓA & CÁ NHÂN HÓA THEO VAI TRÒ
**Dự án:** QCET E-Office (Hệ thống Điều hành & Quản lý Nhiệm vụ Trường Cao đẳng Kinh tế Kỹ thuật Quảng Nam)  
**Tài liệu:** Product & UX/UI Specification  
**Ngày:** 2026-09-07  
**Trạng thái:** Bản thảo đề xuất triển khai (Draft Proposal)

---

## 1. TỔNG QUAN & BỐI CẢNH VẤN ĐỀ

### 1.1 Hiện trạng và Phản hồi từ người dùng
Người dùng thực tế (gồm cả Ban Giám hiệu, Trưởng phòng/khoa và Giảng viên/Chuyên viên) khi truy cập hệ thống hiện tại đều phản hồi: **"Web quá rối, vào không biết bắt đầu từ đâu, UX quá tệ"**.

### 1.2 Nguyên nhân gốc rễ (Root Causes)
1. **Sai lầm "One Homepage Fits All"**: Toàn bộ người dùng khi truy cập trang chủ (`/`) đều nhận cùng một giao diện đồ sộ gồm: 5 Phân khu (Zones), biểu đồ KPI vĩ mô, ma trận sức khỏe 11 đơn vị, bảng việc 2 cấp lồng nhau, lịch tháng, cùng hàng chục nút bấm.
2. **Quá tải nhận thức (Cognitive Overload) từ 7 bộ lọc đồng thời**:
   - `Zone` (5 lựa chọn)
   - `Academic Month` (13 thẻ tháng)
   - `Workbox Filter` (5 trạng thái)
   - `Scope` (4 phạm vi: Tất cả / Của tôi / Đơn vị / Trường)
   - `View Mode` (5 chế độ: Bảng / Kanban / Lịch / Đơn vị / BGH)
   - `Department` (12 phòng/khoa)
   - `Priority` & `Category` (9 danh mục/mức độ)
   *Hậu quả:* Người dùng rơi vào trạng thái tê liệt lựa chọn (Choice Paralysis).
3. **Mất liên kết với mục tiêu công việc (Job-To-Be-Done)**:
   - **Giảng viên / Chuyên viên:** Chỉ muốn biết *"Hôm nay tôi phải làm gì? Nộp báo cáo ở đâu?"* nhưng bị bao vây bởi ma trận KPI trường.
   - **Ban Giám hiệu:** Cần *"Duyệt nhanh đề xuất và xem đơn vị nào đang chậm trễ"* nhưng phải cuộn qua danh sách hàng trăm công việc vụn vặt.
   - **Trưởng đơn vị:** Cần *"Giao việc trường giao cho chuyên viên và kiểm tra hồ sơ nộp lên"* nhưng không có luồng gom việc riêng.

---

## 2. NGUYÊN TẮC THIẾT KẾ MỚI (CORE UX PRINCIPLES)

1. **Role-First Landing (Đăng nhập đúng không gian)**: 
   - Hệ thống tự động chuyển hướng màn hình đầu tiên phù hợp 100% với vai trò của người dùng (`STAFF` → **My Focus**, `ADMIN` → **Executive Cockpit**, `MANAGER` → **Unit Command Hub**).
2. **Rule of 3 (Quy tắc 3 giây - 3 hành động)**:
   - Trong 3 giây đầu tiên, người dùng phải đọc được trạng thái công việc của mình và nhìn thấy ngay nút hành động chính (Primary CTA).
3. **Progressive Disclosure (Tiết lộ thông tin lũy tiến)**:
   - Mặc định chỉ hiển thị: Ô tìm kiếm thông minh + 3 tab trạng thái lớn (`Cần làm ngay`, `Đang chờ duyệt`, `Hoàn thành`).
   - Ẩn toàn bộ bộ lọc nâng cao (Phòng ban, tháng học, phân loại) vào popover **[Bộ lọc nâng cao]**.
4. **Action-Centric Approval (Phê duyệt 1 chạm)**:
   - Thao tác Duyệt / Yêu cầu làm lại / Chuyển tiếp có thể thực hiện ngay trên thẻ tóm tắt, không bắt buộc phải mở 3 tầng modal để xem.

---

## 3. ĐẶC TẢ CHI TIẾT THEO TỪNG VAI TRÒ (PERSONA SPECIFICATIONS)

```
                       ┌───────────────────────────────────────┐
                       │     ĐĂNG NHẬP / XÁC THỰC VAI TRÒ      │
                       └───────────────────┬───────────────────┘
                                           │
         ┌─────────────────────────────────┼─────────────────────────────────┐
         ▼                                 ▼                                 ▼
┌──────────────────┐             ┌──────────────────┐              ┌──────────────────┐
│  BAN GIÁM HIỆU   │             │   TRƯỞNG ĐƠN VỊ  │              │    NHÂN SỰ /     │
│     (ADMIN)      │             │    (MANAGER)     │              │ GIẢNG VIÊN/NV    │
│                  │             │                  │              │     (STAFF)      │
├──────────────────┤             ├──────────────────┤              ├──────────────────┤
│ 1. Hàng đợi duyệt│             │ 1. Việc chờ phân │              │ 1. Việc hôm nay  │
│    chiến lược    │             │    công nhân viên│              │    cần làm       │
│ 2. Cảnh báo trễ  │             │ 2. Hàng đợi duyệt│              │ 2. Nộp minh chứng│
│    hạn 11 đơn vị │             │    cấp khoa/phòng│              │    1 chạm        │
│ 3. Nút giao việc │             │ 3. Tiến độ nội bộ│              │ 3. Việc sắp tới  │
│    trường nhanh  │             │    khoa/phòng    │              │    hạn tuần này  │
└──────────────────┘             └──────────────────┘              └──────────────────┘
```

---

### PHÂN HỆ 1: DÀNH CHO GIẢNG VIÊN & CHUYÊN VIÊN (`STAFF`)
**Tên không gian:** `My Focus` (Không gian Làm việc Cá nhân)  
**Mục tiêu:** Tối đa hóa sự tập trung, triệt tiêu phân tâm, nộp báo cáo trong 15 giây.

#### Thành phần giao diện (UI Elements):
1. **Khối Chào & Trạng thái trong ngày (Daily Hero Widget):**
   - Tiêu đề: *"Xin chào [Tên cán bộ], hôm nay bạn có [X] việc cần hoàn thành."*
   - Huy hiệu tóm tắt:
     - Đỏ: `[X] Quá hạn / Hạn hôm nay`
     - Vàng: `[Y] Đang chờ Trưởng phòng duyệt`
     - Xanh lá: `[Z] Hoàn thành trong tuần`
   - Nút hành động nhanh (CTA): **`[+ Báo cáo tiến độ / Nộp minh chứng]`** (Mở modal nộp file hoặc link).
2. **Danh sách Nhiệm vụ Cần làm (My Focused To-Do List):**
   - Thiết kế dạng danh sách tinh giản kiểu Notion/Linear (không dùng bảng lưới đa cột phức tạp).
   - Phân đoạn thành 3 nhóm rõ rệt:
     - **Nhóm 1: Khẩn cấp & Hôm nay (Cần xử lý ngay):** Thẻ có viền đỏ nhẹ, hiện rõ hạn chót và nút `[Nộp kết quả]`.
     - **Nhóm 2: Sắp tới hạn (Trong 7 ngày tới):** Thẻ thông tin tiêu chuẩn.
     - **Nhóm 3: Đang chờ duyệt (Submitted for Review):** Hiển thị minh chứng đã nộp kèm trạng thái *"Chờ Trưởng phòng Trần Hùng duyệt"*.
3. **Thanh công cụ tối giản (Staff Toolbar):**
   - Chỉ gồm 1 ô tìm kiếm nhanh (Search by title/deliverable).
   - 3 nút lọc nhanh: `Tất cả` | `Đang thực hiện` | `Đã xong`.
   - **Tuyệt đối ẩn:** Không hiển thị chọn phòng ban khác, không hiển thị ma trận 11 đơn vị, không hiển thị các tác vụ BGH.

---

### PHÂN HỆ 2: DÀNH CHO BAN GIÁM HIỆU (`ADMIN`)
**Tên không gian:** `Executive Cockpit` (Khoang Điều hành Chiến lược)  
**Mục tiêu:** Nắm bắt toàn cảnh trường trong 30 giây, phát hiện điểm nghẽn, phê duyệt hồ sơ chiến lược.

#### Thành phần giao diện (UI Elements):
1. **Khối Hàng đợi Phê duyệt Chiến lược (Strategic Approval Queue - Priority 1):**
   - Nằm ngay đầu trang. Danh sách các hồ sơ/nhiệm vụ trình BGH phê duyệt.
   - Thẻ hiển thị: Tên việc, Đơn vị trình, Người trình, Ngày trình, Tệp đính kèm.
   - **Action Bar 1 chạm trên từng thẻ:**
     - Nút `[ Phê duyệt ngay ]` (Xanh lục, 1 click)
     - Nút `[ Yêu cầu điều chỉnh ]` (Mở ô nhập nhanh lý do)
     - Nút `[ Xem chi tiết hồ sơ ]`
2. **Radar Cảnh báo Điểm nghẽn (Red-Flag Alert Cards):**
   - 3 chỉ số khẩn cấp dạng thẻ cảnh báo tương tác:
     - **Thẻ 1: Nhiệm vụ quá hạn toàn trường**: Ví dụ `08 nhiệm vụ trễ hạn` → Click để mở ngay danh sách 8 việc trễ hạn.
     - **Thẻ 2: Đơn vị cần đôn đốc**: Liệt kê 2-3 đơn vị có tỷ lệ tồn đọng cao nhất (ví dụ: *Khoa CNTT: 3 việc chậm; Phòng Đào tạo: 2 việc nghẽn*).
     - **Thẻ 3: Tỷ lệ hoàn thành tháng hiện tại**: Tiến độ % hoàn thành kế hoạch năm học.
3. **Nút Giao việc Trường Thần tốc (Quick Strategic Task Modal):**
   - Nút cố định nổi bật góc trên bên phải: **`[+ Giao nhiệm vụ Cấp trường]`**.
   - Form tinh gọn gồm 5 trường cần thiết nhất:
     1. Tên nhiệm vụ
     2. Đơn vị chủ trì (Dropdown 11 đơn vị)
     3. Đơn vị phối hợp (Multi-select)
     4. Hạn chót hoàn thành
     5. Yêu cầu sản phẩm đầu ra (Deliverables)
4. **Ma trận sức khỏe 11 đơn vị (Department Health Matrix - Collapsible):**
   - Mặc định thu gọn dạng thanh tóm tắt, có nút mở rộng để BGH xem sâu khi cần kiểm tra định kỳ.

---

### PHÂN HỆ 3: DÀNH CHO TRƯỞNG PHÒNG / TRƯỞNG KHOA (`MANAGER`)
**Tên không gian:** `Unit Command Hub` (Trung tâm Điều hành Đơn vị)  
**Mục tiêu:** Điều phối công việc từ Trường xuống cán bộ trong phòng và kiểm soát chất lượng đầu ra.

#### Thành phần giao diện (UI Elements):
1. **Hộp việc Trường giao cần phân rã (Unassigned Inbound Tasks):**
   - Cảnh báo: *"Có [N] nhiệm vụ từ BGH giao cho [Tên Khoa/Phòng] chưa được phân công cán bộ thụ lý."*
   - Nút trực tiếp: **`[Phân công cán bộ]`** ngay trên từng dòng nhiệm vụ để trưởng đơn vị gán cho chuyên viên/giảng viên kèm hạn chót nội bộ.
2. **Hàng đợi Kiểm tra & Ký duyệt cấp Đơn vị (Unit Review Queue):**
   - Danh sách công việc cán bộ trong khoa vừa hoàn thành và nộp minh chứng.
   - Nút: `[Xác nhận đạt & Chuyển trường]` hoặc `[Yêu cầu cán bộ bổ sung]`.
3. **Bảng phân bổ tải công việc cán bộ (Workload Balance Panel):**
   - Danh sách các cán bộ thuộc khoa/phòng kèm số việc đang gánh:
     - Ví dụ: *Nguyễn Ngọc Vinh (3 việc - 1 sắp trễ); Lê Thị Mai (1 việc - Bình thường)*.
     - Giúp Trưởng khoa không giao việc chồng chéo hoặc quá tải cho 1 người.

---

## 4. TÁI CẤU TRÚC ĐIỀU HƯỚNG & THANH CÔNG CỤ (NAVIGATION & TOOLBAR)

### 4.1 Tinh giản Sidebar (Navigation Menu)
Thay vì các mục phân khu trùng lặp, chuẩn hóa Sidebar thành **4 mục trực quan**:

| Icon | Nhãn hiển thị | Hành vi khi Click | Đối tượng sử dụng |
| :--- | :--- | :--- | :--- |
| 🏠 | **Trang làm việc chính** | Mở Cockpit (BGH) / Hub (Trưởng phòng) / My Focus (Chuyên viên) | Mọi người dùng |
| 📋 | **Bảng Công việc** | Bảng chi tiết toàn bộ công việc (Table/Kanban/Lịch) | Khi cần tra cứu sâu |
| 📅 | **Lịch công tác** | Lịch tuần BGH & Lịch hạn chót nhiệm vụ | Mọi người dùng |
| 👥 | **Cơ cấu & Danh bạ** | Sơ đồ cây 11 đơn vị và danh bạ điện thoại/email cán bộ | Tra cứu liên hệ |

*Mục Thông báo được tích hợp trên Topbar (chuông thông báo popover) thay vì chiếm 1 dòng lớn trong thanh công cụ.*

### 4.2 Tinh giản Thanh công cụ lọc (Unified Toolbar Redesign)
Áp dụng mẫu hình **Progressive Disclosure**:
- **Trạng thái mặc định (Default Clean State):**
  - Trái: Ô tìm kiếm thông minh (`Tìm theo tên việc, mã số, người phụ trách...`).
  - Giữa: 3 Pill bộ lọc trạng thái cốt lõi: `Tất cả` | `Cần xử lý ngay` | `Đã hoàn thành`.
  - Phải: Nút `[Bộ lọc nâng cao]` kèm badge số lượng bộ lọc đang áp dụng (ví dụ: `Lọc (2)`).
- **Khi bấm `[Bộ lọc nâng cao]` (Filter Popover Sheet):**
  - Mới xuất hiện các trường: Tháng học trong năm, Phòng ban chủ trì, Mức độ ưu tiên, Loại nhiệm vụ.
  *Điều này loại bỏ hoàn toàn 7 thanh dropdown đang dàn hàng ngang gây nghẹt màn hình.*

---

## 5. BẢN ĐẶC TẢ TRẠNG THÁI RỖNG & HƯỚNG DẪN THAO TÁC (EMPTY STATES & ONBOARDING)

Mỗi màn hình bắt buộc phải có trạng thái khi chưa có dữ liệu (Empty state) mang tính hướng dẫn tích cực:
1. **Khi không có việc quá hạn:**
   - Hình minh họa nhẹ nhàng + Dòng chữ: *"Tuyệt vời! Không có nhiệm vụ nào bị trễ hạn. Mọi công việc đang vận hành đúng tiến độ."*
2. **Khi chuyên viên chưa được giao việc:**
   - Dòng chữ: *"Bạn chưa có nhiệm vụ nào cần làm hôm nay."* + Nút `[Xem lịch công tác trường]`.
3. **Khi BGH đã duyệt hết hàng đợi:**
   - Huy hiệu xanh: *"Hàng đợi trống! Toàn bộ tờ trình và hồ sơ đã được xử lý xong."*

---

## 6. LỘ TRÌNH KỸ THUẬT & DANH MỤC THAY ĐỔI MÃ NGUỒN

### 6.1 Các Component mới cần tạo:
1. `src/components/dashboard/roles/staff-focus-view.tsx`: Màn hình My Focus cho Giảng viên & Chuyên viên.
2. `src/components/dashboard/roles/executive-cockpit-view.tsx`: Tinh chỉnh từ ExecutiveActionCenter thành khoang điều hành 30s.
3. `src/components/dashboard/roles/manager-unit-hub-view.tsx`: Màn hình giao việc & duyệt nội bộ cho Trưởng phòng/khoa.
4. `src/components/dashboard/simplified-task-filter-bar.tsx`: Thanh lọc tối giản 1 tầng với popover nâng cao.

### 6.2 Cập nhật Component hiện có:
1. `src/app/page.tsx`:
   - Kiểm tra `user.role` để render component tương ứng làm màn hình mặc định thay vì nhồi nhét tất cả vào một viewport.
   - Thêm nút chuyển đổi nhanh chế độ xem `"Xem chi tiết toàn trường"` cho người dùng muốn tra cứu sâu.
2. `src/components/layout/app-sidebar.tsx` & `sidebar-context.tsx`:
   - Thu gọn các mục lặp lại, ánh xạ link chuẩn xác.

### 6.3 Kiểm soát an toàn kỹ thuật (Engineering Rules):
- Tuyệt đối không chạy `npm run build` khi dev server đang chạy (tránh xung đột cache Next.js theo `CLAUDE.md`).
- Sử dụng `npm run typecheck` và `npm test` để nghiệm thu chất lượng sau từng thay đổi.
- Đảm bảo tương thích CSS Tailwind v4 OKLCH token và dark/light mode.
