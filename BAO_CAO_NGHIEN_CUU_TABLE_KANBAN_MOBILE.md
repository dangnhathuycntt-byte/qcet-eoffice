# BÁO CÁO NGHIÊN CỨU & RÀ SOÁT CHUYÊN SÂU: RESPONSIVE TABLE, KANBAN BOARD & TOUCH GESTURES TRÊN MOBILE
## DỰ ÁN: HỆ THỐNG VĂN PHÒNG ĐIỆN TỬ QCET E-OFFICE
**Đơn vị:** Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (QCET)  
**Thời gian lập:** Tháng 09/2026  
**Chủ đề:** Đánh giá & Chuẩn hóa Bảng phân cấp nhiệm vụ, Bảng Kanban và Cử chỉ vuốt chạm trên thiết bị di động (360px - 430px)

---

## 1. TỔNG QUAN PHÁT HIỆN TỪ SUB-AGENT 1

Qua khảo sát toàn diện 4 thành phần cốt lõi:
1. `src/components/tasks/cascading-task-table.tsx`
2. `src/components/tasks/task-kanban-board.tsx`
3. `src/components/tasks/executive-department-command-center.tsx`
4. `src/components/dashboard/unified-task-toolbar.tsx`

Hệ thống ghi nhận **4 khiếm khuyết trải nghiệm nghiêm trọng** khi xem trên điện thoại:

```
    [ 4 KHIẾM KHUYẾT TRẢI NGHIỆM TABLE & KANBAN TRÊN MOBILE ]
                                │
    ┌───────────────────────────┼───────────────────────────┬───────────────────────────┐
    ▼                           ▼                           ▼                           ▼
[1. Bẫy cuộn ngang 2D]    [2. Nút ảo Hover ẩn]     [3. Cột Kanban xếp dọc]   [4. Phím bấm < 24px]
- Bảng 7 cột (920px)      - "Duyệt nhanh",         - 4 cột chồng chất thành  - Mũi tên mở rộng chỉ
  bị ép cuộn ngang trên     "Nhận việc" dùng         1 dải dọc 3000px, mất     24px, bấm nhầm vào
  màn hình 375px.           opacity-0 hover!         luồng tiến độ ngang.      dòng mở modal chi tiết.
```

---

## 2. CHI TIẾT TỪNG THÀNH PHẦN & KỊCH BẢN LỖI (FAILURE SCENARIOS)

### 2.1. `CascadingTaskTable` (Bảng phân cấp nhiệm vụ)
* **Kịch bản lỗi 1 (Bẫy cuộn 2 chiều):** Bảng có 7 cột đòi hỏi tối thiểu 920px. Trên màn hình 375px (iPhone SE/13 mini), 5 cột bên phải (Chủ trì, Hạn chót, Tiến độ, Thao tác) bị đẩy ra khỏi màn hình. Khi người dùng vuốt ngón tay chéo, trang web bị trôi ngang giật cục.
* **Kịch bản lỗi 2 (Nút bấm tàng hình - Ghost Action Buttons):**
  - Các nút hành động 1-chạm như `"Duyệt nhanh"`, `"Đôn đốc"`, `"Nhận việc"` được gán CSS `opacity-0 group-hover:opacity-100`.
  - Trên màn hình cảm ứng điện thoại **không có sự kiện chuột rê (hover)**, dẫn đến các nút này bị ẩn vĩnh viễn! Người dùng điện thoại không thể duyệt việc hay nhận việc nhanh.
* **Kịch bản lỗi 3 (Bấm nhầm mở modal thay vì mở rộng nhiệm vụ con):**
  - Nút mũi tên mở rộng nhiệm vụ con chỉ có kích thước `size-6` (24px x 24px), nằm bên trong một dòng `<tr>` có sự kiện `onClick={() => onSelectTask(task)}`.
  - Do ngón tay người dùng có bề mặt tiếp xúc 10–14mm (~44px), khi bấm vào mũi tên 24px thường xuyên bị lệch vào dòng `<tr>`, làm bật cửa sổ chi tiết nhiệm vụ thay vì mở danh sách việc con!
* **Kịch bản lỗi 4 (Thụt lề nhiệm vụ con chiếm hết chiều ngang):**
  - Nhiệm vụ con thụt lề 50px (`pl-[34px] + pl-4`), chiếm hơn 15% bề ngang màn hình điện thoại, làm tiêu đề bị ép chữ gãy vụn.

### 2.2. `TaskKanbanBoard` (Bảng Kanban)
* **Kịch bản lỗi 1 (Cột Kanban bị xếp chồng chất theo chiều dọc):**
  - Khi màn hình nhỏ hơn `md` (768px), layout rơi vào `grid-cols-1`.
  - Cả 4 cột (*Mới*, *Đang làm*, *Cần sửa*, *Hoàn thành*) bị xếp nối đuôi nhau theo chiều dọc. Mỗi cột lại có `overflow-y-auto max-h-[calc(100vh-280px)]`, tạo ra bẫy cuộn lồng nhau (Nested scroll trap).
  - Người dùng muốn xem cột "Hoàn thành" phải cuộn qua hàng chục nhiệm vụ của 3 cột trước đó, làm mất hoàn toàn hình ảnh trực quan của quy trình xử lý công việc từ trái sang phải.
* **Kịch bản lỗi 2 (Bấm nhầm phím dịch chuyển trạng thái 24px):**
  - Nút chuyển trạng thái `<` và `>` chỉ rộng 24px, khi bấm thường xuyên bị kích hoạt nhầm vào thân thẻ mở modal.

### 2.3. `ExecutiveDepartmentCommandCenter` (Trung tâm chỉ huy phòng ban)
* Dải nút lọc phòng ban `"Điểm nghẽn cần BGH chỉ đạo (3)"` bị rớt thành 3 dòng.
* Ô tìm kiếm dùng `text-xs` (12px) làm Safari tự động phóng to màn hình.
* Tên tab quá dài (`"Nhiệm vụ Cấp Trường giao cho Đơn vị"`) làm nút bấm cao tới 80px trên điện thoại.

### 2.4. `UnifiedTaskToolbar` (Thanh công cụ lọc công việc)
* Bộ 3 nút chuyển phạm vi (`"Việc của tôi"`, `"Nhiệm vụ cấp Trường"`, `"Công việc Đơn vị"`) rộng 365px, tràn mép màn hình 360px.
* Dải 12 tháng học kỳ thiếu hiệu ứng mờ biên (fade mask) khiến người dùng không biết có thể cuộn ngang tiếp, phím tháng chỉ cao 26px khó bấm.

---

## 3. GIẢI PHÁP CHUẨN HÓA CÔNG THÁI HỌC DI ĐỘNG

### 3.1. Chuyển đổi Bảng thành Dòng thẻ Di động (Card-List Transformation)
* **Quy tắc:** Màn hình máy tính giữ nguyên Bảng đa cột (`hidden md:block`). Màn hình di động tự động chuyển sang Luồng thẻ dọc (`flex flex-col gap-3 md:hidden`):
  - **Đầu thẻ:** Mã nhiệm vụ mono + Badge trạng thái nổi bật (vùng chạm $\ge$ 40px).
  - **Thân thẻ:** Tiêu đề 2 dòng (`line-clamp-2`), người chủ trì, hạn chót (chữ đỏ nếu trễ).
  - **Chân thẻ:** Thanh tiến độ 4px và các nút hành động luôn hiển thị rõ ràng: `[Duyệt nhanh]`, `[Nhận việc]` (cao 40px, màu rõ nét, không dùng hover ẩn).
  - **Nhiệm vụ con:** Accordion toàn chiều rộng với nút chạm 44px, không thụt lề quá sâu.

### 3.2. Bảng Kanban Di động: Horizontal Snap-Carousel (Cuộn trượt từng Cột)
* **Quy tắc chuẩn ngành (Linear / Jira Mobile):**
  - Không xếp chồng 4 cột theo chiều dọc.
  - Chuyển thành dạng Carousel cuộn ngang có cơ chế Snap:
    ```css
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    ```
  - Mỗi cột rộng `w-[86vw] max-w-[340px] shrink-0 snap-center`. Khoảng hở 14vw còn lại để lộ mép cột tiếp theo (Peek affordance), báo hiệu trực quan cho người dùng vuốt sang phải.
  - Phía trên có thanh Tab 4 giai đoạn (`[Mới (4)] [Đang làm (12)] [Cần sửa (2)] [Hoàn thành (9)]`) bấm vào để trượt nhanh tới cột tương ứng.
  - Dưới chân có 4 dấu chấm tròn (Pagination Dots) đồng bộ theo vị trí cột.

### 3.3. Rút gọn Nhãn & Chuẩn hóa Vùng chạm trên Toolbar
* Rút gọn nút Scope Switcher trên mobile:
  - `"Việc của tôi"` $\rightarrow$ `"Cá nhân"`
  - `"Nhiệm vụ cấp Trường"` $\rightarrow$ `"Cấp Trường"`
  - `"Công việc Đơn vị"` $\rightarrow$ `"Đơn vị"`
* Thêm viền mờ gradient (`mask-image`) cho dải 12 tháng và nâng chiều cao nút lên 36px–40px.

---

## 4. KẾT LUẬN

Giải pháp chuyển đổi kép (Dual-Mode: Table cho Desktop, Card Feed cho Mobile) và Snap Carousel cho Kanban sẽ giải quyết triệt để 100% các vấn đề hiển thị dữ liệu phức tạp trên điện thoại mà không làm ảnh hưởng đến trải nghiệm trên máy tính để bàn.
