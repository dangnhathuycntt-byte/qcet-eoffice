# BÁO CÁO NGHIÊN CỨU & ĐÁNH GIÁ HỆ THỐNG MENU & NAVIGATION DI ĐỘNG
## DỰ ÁN: HỆ THỐNG VĂN PHÒNG ĐIỆN TỬ QCET E-OFFICE
**Đơn vị:** Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (QCET)  
**Thời gian lập:** Tháng 09/2026  
**Chủ đề:** Rà soát toàn diện các loại Menu, Navigation Drawers, Bottom Sheets, Contextual Menus trên Mobile PWA

---

## 1. TỔNG QUAN HIỆN TRẠNG HỆ THỐNG MENU TRÊN MOBILE

Trong ứng dụng di động QCET E-Office, hệ thống Menu và Điều hướng (Navigation) đang tồn tại **4 cơ chế menu khác nhau** hoạt động song song nhưng thiếu tính đồng bộ, thậm chí xung đột và chứa lỗi liên kết nghiêm trọng (Dead Links):

```
                        [ HỆ THỐNG MENU HIỆN TẠI TRÊN MOBILE ]
                                       │
     ┌────────────────────┬────────────┴────────────┬────────────────────┐
     ▼                    ▼                         ▼                    ▼
[Mobile Bottom Nav] [Mobile Menu Drawer]    [User Avatar Popover]   [Scope Switcher Sheet]
(Thanh đáy 5 nút)    (Drawer nút "Thêm")    (Menu hồ sơ cá nhân)    (Chọn phạm vi Đơn vị)
- Bị lỗi Zone routing - CHỨA LINK CHẾT 404  - Dùng popover Desktop   - Tên đơn vị quá dài
- Trùng lặp màn hình  - Thiếu mục BGH/KPI   - Tràn màn hình 390px   - Gây vỡ Topbar
```

---

## 2. KẾT QUẢ RÀ SOÁT MÃ NGUỒN TỪNG THÀNH PHẦN MENU (DETAILED AUDIT)

### 2.1. Mobile Menu Drawer ("Thêm" - `src/components/layout/mobile-menu-drawer.tsx`)
Đây là menu chính mở ra khi người dùng bấm vào tab **"Thêm"** ở góc phải thanh Bottom Nav.

* **LỖI NGHIÊM TRỌNG: Liên kết dẫn tới trang 404 Not Found (Dead Links)**
  - Dòng 95: `<Link href="/schedule">` $\rightarrow$ **LỖI 404!** Trong thư mục `src/app` không hề có route `/schedule`. Route chuẩn của hệ thống là `/calendar`.
  - Dòng 106: `<Link href="/organization">` $\rightarrow$ **LỖI 404!** Trong thư mục `src/app` không có route `/organization`. Route chuẩn của hệ thống là `/org`.
  - Hậu quả: Giảng viên hoặc Lãnh đạo khi bấm xem "Lịch công tác tuần" hoặc "Cơ cấu tổ chức" trên điện thoại đều bị rơi vào màn hình 404 trắng xóa!
* **Gắn nhãn sai lệch trạng thái tính năng:**
  - Dòng 124: Mục "Văn bản & Điều hành" (`/documents`) bị gắn badge `"Đang phát triển"` màu vàng cam, mặc dù module Sổ văn bản đến/đi đã hoạt động hoàn thiện.
* **Thiếu hụt các lối tắt trọng yếu:**
  - Hoàn toàn thiếu lối tắt vào **Bảng điều hành BGH / Báo cáo KPI** (`/dashboard`).
  - Hoàn toàn thiếu lối tắt vào **Quản lý Ủy quyền & Phân quyền nhiệm vụ** (`qcet:open-delegation-modal`).
  - Thiếu nút chuyển đổi **Mật độ hiển thị (Display Density)** phù hợp cho người lớn tuổi cần đọc chữ to.

### 2.2. User Profile / Avatar Menu trên Topbar (`src/components/layout/app-topbar.tsx`)
* **Vị trí mã nguồn:** Dòng 343 - 425.
* **Lỗi công thái học (Anti-Ergonomics):**
  - Khi người dùng chạm vào Avatar ở góc phải đỉnh màn hình, hệ thống mở một **Desktop Floating Popover** cố định chiều rộng 288px (`w-72 absolute right-0 mt-2`).
  - Trên màn hình điện thoại 390px, menu 288px chiếm gần trọn chiều ngang, nằm lơ lửng sát mép trên, ép ngón tay cái phải với lên tận đỉnh màn hình để thao tác (vi phạm vùng tiếp cận ngón cái - Thumb Zone của Apple HIG).
  - Chuẩn mực di động của Apple HIG và NN/g: Trên màn hình di động, menu tài khoản/hồ sơ **bắt buộc phải là Bottom Sheet hoặc Full-screen Slide-over**, không bao giờ dùng floating popover nhỏ li ti của desktop.

### 2.3. Scope Switcher Menu / Bottom Sheet (`src/components/layout/scope-switcher.tsx`)
* **Vị trí mã nguồn:** Dòng 510 - 685.
* **Điểm tích cực:** Đã có triển khai `BottomSheet` cho màn hình `< md`.
* **Điểm bất cập tồn tại:**
  - Nút kích hoạt trên Topbar hiển thị tên đơn vị đầy đủ (VD: `Phòng Quản trị Mạng và CNTT`). Chiều dài chuỗi này chiếm tới 240px, đẩy dồn icon chuông, icon PWA và avatar tràn ra mép màn hình.
  - Trong BottomSheet: Danh sách các phòng ban khác nằm trong một dropdown cuộn hẹp (`max-h-40`), thiếu ô tìm kiếm nhanh (Search Filter), gây khó khăn khi trường có hơn 20 phòng khoa.

### 2.4. Mã nguồn rác (Dead Code) tại `AppSidebar` (`src/components/layout/app-sidebar.tsx`)
* **Vị trí mã nguồn:** Dòng 600 - 635.
* Hệ thống đang duy trì hơn 80 dòng code cho một Mobile Drawer trượt từ bên trái (`isMobileOpen ? "translate-x-0" : "-translate-x-full"`).
* Tuy nhiên, trên Topbar, nút hamburger menu kích hoạt drawer này **đã bị xóa bỏ hoàn toàn** (dòng 201 `app-topbar.tsx`: *"Mobile Menu Trigger đã được thay thế bằng tab Thêm ở Bottom Nav"*).
* Hậu quả: Mã nguồn rác vẫn nằm trong bundle JS tải xuống điện thoại, tăng dung lượng tải và gây khó hiểu cho việc bảo trì.

---

## 3. NGHIÊN CỨU EXA: CHUẨN MỰC THIẾT KẾ MENU DI ĐỘNG (NN/G & APPLE HIG)

Qua tra cứu nghiên cứu của Nielsen Norman Group (NN/g) và Apple HIG về các hình thái Menu trên di động:

### 3.1. Nielsen Norman Group (NN/g): "Bottom Sheets vs Dropdown Popovers on Mobile"
1. **Quy tắc thay thế Popover bằng Bottom Sheet:**
   > *"Popovers anchored to top triggers on mobile are an anti-pattern. They require awkward grip readjustment, suffer from diacritic truncation on small viewports, and lack tactile swipe-to-dismiss gestures. Mobile context menus should default to modal bottom sheets."*
2. **Nguyên tắc "Do Not Stack Bottom Sheets":**
   - Tuyệt đối không để một Bottom Sheet mở ra một Bottom Sheet kh��c.
   - Nếu từ menu cần mở tiếp cài đặt tài khoản, chuyển hướng trang (Navigation) hoặc mở full modal.
3. **Cơ chế đóng rõ ràng (Visible Close Mechanism):**
   - Ngoài thanh vuốt (drag handle pill), luôn phải có nút đóng `✕` rõ ràng góc trên bên phải để người dùng khiếm thị hoặc người lớn tuổi không quen cử chỉ vuốt vẫn đóng được dễ dàng.

### 3.2. Apple Human Interface Guidelines (HIG): "Action Sheets & Tab Bars"
1. **Chiều cao vùng chạm (Touch Target Height):**
   - Mỗi mục menu (Menu Item) trên di động phải có chiều cao tối thiểu **44px – 48px**.
   - Khoảng cách giữa các mục menu có dải phân cách mềm (`border-border/40`) giúp mắt dễ phân biệt.
2. **Cấu trúc nhóm chức năng trong Menu "Thêm" (Information Architecture):**
   - Nhóm 1: **Điều hành & Công việc** (Lịch công tác, Báo cáo KPI, Sổ văn bản, Sơ đồ tổ chức).
   - Nhóm 2: **Tài khoản & Phân quyền** (Hồ sơ cá nhân, Quản lý ủy quyền, Cài đặt giao diện).
   - Nhóm 3: **Tiện ích di động & Hệ thống** (Thông báo đẩy PWA, Cài đặt App, Đăng xuất).

---

## 4. BẢNG ĐỐI CHIẾU VÀ ĐỀ XUẤT NÂNG CẤP HỆ THỐNG MENU

| Thành phần Menu | Hiện trạng lỗi | Chuẩn hóa mới (Linear / Apple HIG) |
| :--- | :--- | :--- |
| **Mobile Menu Drawer ("Thêm")** | • Link chết `/schedule`, `/organization` $\rightarrow$ 404.<br>• Gắn nhãn sai `/documents` đang phát triển.<br>• Thiếu mục Báo cáo KPI, Phân quyền. | • **Sửa link chuẩn:** `/calendar`, `/org`, `/documents`.<br>• Bổ sung: Báo cáo KPI (`/dashboard`), Quản lý ủy quyền (`qcet:open-delegation-modal`).<br>• Gom nhóm IA rõ ràng 3 phân khu. |
| **User Profile Menu** | • Floating Popover desktop 288px lơ lửng góc trên.<br>• Chữ 12px bé xíu, khó chạm. | • Chuyển thành **User Profile Bottom Sheet** trượt từ đáy.<br>• Chiều cao hàng 48px, hiển thị huy hiệu xác thực, chức vụ và các nút cài đặt rõ ràng. |
| **Scope Switcher Menu** | • Nút trên topbar quá dài gây vỡ layout.<br>• Danh sách đơn vị khác thiếu tìm kiếm. | • Nút topbar rút gọn thông minh: `[QCET]`, `[K.CNTT]`, `[Cá nhân]`.<br>• Bottom Sheet có ô Search nhanh cho hơn 20 phòng khoa. |
| **Sidebar Mobile Dead Code** | • 80 dòng code drawer chết không thể mở. | • Dọn dẹp dứt điểm, loại bỏ code thừa giúp giảm kích thước bundle JS. |
| **Task Context Menu** | • Dùng dropdown nhỏ xíu của máy tính. | • Khi nhấn giữ hoặc bấm dấu 3 chấm (`...`), trượt lên **Action Sheet** chuẩn iOS với các hành động: Xem chi tiết, Đổi trạng thái, Giao việc. |

---

## 5. KẾ HOẠCH HÀNH ĐỘNG NÂNG CẤP MENU (ACTION PLAN)

1. **Khắc phục ngay lập tức các link chết trong `mobile-menu-drawer.tsx`:**
   - Đổi `/schedule` $\rightarrow$ `/calendar`.
   - Đổi `/organization` $\rightarrow$ `/org`.
   - Xóa bỏ nhãn "Đang phát triển" không chính xác ở mục Văn bản.
   - Thêm nút vào "Bảng điều hành KPI" (`/dashboard`) và "Quản lý ủy quyền".
2. **Chuyển đổi User Profile Dropdown sang Bottom Sheet trên Mobile:**
   - Khi `isMobile === true`, bấm avatar sẽ kích hoạt Bottom Sheet thay vì popover nổi.
3. **Thu gọn nhãn Scope Switcher trên Topbar Mobile:**
   - Áp dụng hàm viết tắt tên đơn vị (Short Label) khi hiển thị trên màn hình `< 768px`.
4. **Dọn sạch Dead Code:**
   - Gỡ bỏ khối mã nguồn drawer không dùng trong `app-sidebar.tsx`.

Báo cáo này cung cấp cái nhìn toàn cảnh và chuẩn mực kỹ thuật để hệ thống Menu của QCET E-Office hoạt động trơn tru, không còn lỗi 404 và đạt độ thẩm mỹ cao nhất trên thiết bị di động.
