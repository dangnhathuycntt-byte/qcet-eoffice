# BÁO CÁO NGHIÊN CỨU & RÀ SOÁT CHUYÊN SÂU: CỬ CHỈ VUỐT CHẠM DI ĐỘNG (SWIPE-TO-ACTION) & PULL-TO-REFRESH KHÔNG XUNG ĐỘT TRÊN PWA
## DỰ ÁN: HỆ THỐNG VĂN PHÒNG ĐIỆN TỬ QCET E-OFFICE
**Đơn vị:** Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (QCET)  
**Thời gian lập:** Tháng 09/2026  
**Chủ đề:** Khắc phục Xung đột Cuộn dọc (Scroll Collision), Cơ chế Khóa Trục (Axis Lock 8px) và Kéo Làm Mới Chuẩn Công Nghiệp (Linear Mobile, Apple Mail, Jira)

---

## 1. PHÂN TÍCH CHUẨN CÔNG NGHIỆP & CÁC THÁCH THỨC KỸ THUẬT

Trên nền tảng Web di động và PWA, thao tác cử chỉ vuốt ngang thẻ (Swipe) và kéo làm mới (Pull-to-Refresh) thường gặp 3 lỗi kinh điển:
1. **Xung đột cuộn dọc (Scroll Collision):** Người dùng lướt ngón tay để cuộn xem danh sách nhiệm vụ nhưng góc nghiêng ngón tay vô tình làm giật thẻ sang bên hoặc kích hoạt nhầm thao tác.
2. **Kích hoạt Pull-to-Refresh mặc định của trình duyệt:** Chrome Android hoặc iOS Safari kích hoạt làm mới toàn bộ trang web (Full Page Reload) làm mất toàn bộ trạng thái trong RAM.
3. **Hiện tượng giật khung hình (Jank):** Cập nhật React State trong sự kiện `touchmove` gây re-render liên tục.

### Giải pháp kỹ thuật chuẩn công nghiệp:
* **CSS `touch-action: pan-y`:** Khai báo trên thẻ nhiệm vụ. Báo hiệu cho trình duyệt biết phần tử chỉ cho phép cuộn dọc gốc, chuyển động ngang do JavaScript quản lý.
* **Ngưỡng khóa trục (Axis-Locking Slop 8-10px):** Trong 8px di chuyển đầu tiên, nếu $|dy| \ge |dx|$, lập tức khóa trạng thái sang "Cuộn dọc" và nhường toàn quyền cho trình duyệt cuộn mượt mà 60/120fps. Chỉ khi $|dx| > |dy|$ mới xử lý vuốt ngang.
* **Lực cản cao su (Rubber-band Damping):** $visualPullY = pullDistance \times 0.42$.
* **Cô lập chuỗi cuộn bằng `overscroll-behavior-y: contain`:** Ngăn chặn việc lan truyền cuộn lên `body`/`html`.

---

## 2. RÀ SOÁT HIỆN TRẠNG MÃ NGUỒN QCET E-OFFICE

1. **`cascading-task-table.tsx`**:
   - Hiện tại sử dụng `<table>` truyền thống và ẩn các nút thao tác sau lớp hover: `opacity-0 group-hover:opacity-100`.
   - Trên điện thoại không có hover chuột, khiến giảng viên **hoàn toàn không thể bấm được các nút Duyệt nhanh, Nhận việc, Đôn đốc**.
2. **`task-kanban-board.tsx`**:
   - Các thẻ Kanban chỉ có `onClick` mở modal, chưa hỗ trợ cử chỉ vuốt chuyển trạng thái nhanh giữa các cột.
3. **`unified-task-toolbar.tsx`**:
   - Dải lọc 12 tháng năm học cuộn ngang cần đặt `overscroll-behavior-x: contain` để không kích hoạt cử chỉ vuốt lùi trang (Back Gesture) của iOS Safari.

---

## 3. THIẾT KẾ HAI REACT HOOKS CHUẨN MỰC

### 3.1. Hook `useSwipeAction` (`src/hooks/use-swipe-action.ts`)
* Tự động nhận diện hướng vuốt sau 8px.
* Vuốt phải $\ge 75\text{px}$: Kích hoạt **"Duyệt nhanh"** kèm rung nhẹ Haptic 12ms.
* Vuốt trái $\le -75\text{px}$: Kích hoạt **"Đôn đốc / Cần bổ sung"**.
* Sử dụng `transform: translate3d(...)` trực tiếp để chuyển động siêu mượt mà không re-render React.

### 3.2. Hook `usePullToRefresh` (`src/hooks/use-pull-to-refresh.ts`)
* Chỉ kích hoạt khi danh sách đang ở đỉnh tuyệt đối (`scrollTop <= 0`).
* Tích hợp `overscroll-behavior-y: contain` triệt tiêu reload của trình duyệt.
* Hiển thị biểu tượng quay tròn xoay theo khoảng cách kéo, đạt 64px rung nhẹ 10ms xác nhận kích hoạt làm mới dữ liệu.

---

## 4. KẾT LUẬN

Việc bổ sung cử chỉ vuốt thẻ và kéo làm mới biến danh sách nhiệm vụ trên điện thoại của QCET E-Office thành trải nghiệm ứng dụng siêu tốc: chỉ cần 1 thao tác gạt tay là duyệt xong công việc, kéo nhẹ từ đỉnh để cập nhật tiến độ tức thì.
