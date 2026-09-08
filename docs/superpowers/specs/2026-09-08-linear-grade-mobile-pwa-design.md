# ĐẶC TẢ THIẾT KẾ: CHUẨN HÓA MOBILE PWA THEO MÔ HÌNH LINEAR-GRADE & CHỐNG AI SLOP

**Mã dự án:** QCET-EOFFICE-MOBILE-PWA-ANTI-SLOP-2026  
**Ngày lập:** 08/09/2026  
**Trạng thái:** Approved by User  
**Định hướng:** Linear-Grade Pocket Cockpit (Tối giản, Triệt tiêu 100% AI Slop, 1-Chạm phản hồi tức thì, Công thái học ngón cái)

---

## 1. Bối cảnh & Phân tích Vấn đề (Root Cause Analysis)

### 1.1 Hiện trạng xung đột kiến trúc và "AI Slop" trên Mobile
Qua khảo sát thực tế và đối chiếu bộ quy tắc thiết kế chống AI Slop quốc tế (`craft/anti-ai-slop.md`, `avoid-ai-slop.md` và `2026-09-06-ui-ux-anti-slop-redesign-design.md`):

1. **Nút sấm sét vàng cam (`Zap`) vi phạm nghiêm trọng chuẩn mực công sở:**
   - Tại `src/components/layout/mobile-bottom-nav.tsx:95-101`, khi vai trò là Lãnh đạo (`isApprover`), nút chính giữa bị gán màu cam game `bg-amber-500` và icon tia sét `Zap`.
   - Nút này kích hoạt sự kiện `qcet:open-briefing-modal` — một sự kiện **hoàn toàn không có bất kỳ component nào trong hệ thống lắng nghe** (Dead/Fake Control do AI sinh mã ngẫu nhiên).
2. **Xung đột 2 hệ thống Menu trượt (Dual Drawer Collision):**
   - Đỉnh trang (`app-topbar.tsx:165`) có nút Hamburger ☰ mở Sidebar trượt từ bên trái (`app-sidebar.tsx`).
   - Đáy trang (`mobile-bottom-nav.tsx:112`) có nút "Thêm" ☰ mở Bottom Sheet trượt từ đáy lên (`mobile-menu-drawer.tsx`).
   - Tồn tại cùng lúc 2 menu trượt từ 2 hướng đối nghịch khiến người dùng ngỡ ngàng và cảm thấy như 2 ứng dụng khác nhau bị ghép cưỡng ép.
3. **Cạn kiệt diện tích hiển thị dọc (Vertical Space Exhaustion):**
   - Trên màn hình điện thoại (~390px rộng, ~650px cao hữu dụng), các khối chiếm chỗ gồm: Topbar (56px) + Banner góc nhìn (44px) + Header tiêu đề & 3 nút to (120px) + 4 thẻ KPI to (140px) + 4 Tabs in hoa (44px) + Thanh tìm kiếm và 2 dropdown (88px) + Bottom bar (80px).
   - **Hơn 85% diện tích bị các khối khung vỏ và bộ lọc chiếm đoạt**, chỉ còn lại dưới 70px cho nội dung thực tế. Người dùng mở app lên không thấy công việc đâu, chỉ thấy màn hình chật chội nghẹt thở.
4. **Bảng dữ liệu máy tính bị ép khung trên di động:**
   - Các bảng 6-8 cột ngang của Desktop (`ExecutiveCockpitWorkspace`) bị co ép khi hiển thị trên mobile, buộc người dùng phải vuốt ngang và bấm vào những dòng chữ li ti rất dễ nhầm lẫn.

---

## 2. Nguyên tắc Thiết kế Cốt lõi (Anti-AI-Slop & Linear Mobile Heuristics)

1. **Zero Emoji & Zero Gaming Tells:**
   - Triệt tiêu 100% emoji trang trí (`🔥`, `⚡`, `🚀`, `🎯`).
   - Bỏ toàn bộ màu cam/vàng neon đồ chơi; đồng nhất màu thương hiệu **Primary Navy (`bg-primary`)** chuẩn QCET.
   - Sử dụng icon Lucide nét mảnh `strokeWidth={1.5}` với kích thước chuẩn 14px–18px.
2. **One Vertical Feed & Single Focus (Một luồng dọc duy nhất):**
   - Trên mobile, người dùng không mở app để xem ma trận phân tích hay bảng thống kê 11 đơn vị.
   - Họ mở app để trả lời một câu hỏi duy nhất: *"Có việc gì khẩn cấp cần tôi duyệt hoặc gỡ nghẽn ngay bây giờ không?"*.
   - Màn hình mobile ưu tiên hiển thị ngay danh sách **Cần xử lý gấp** với thẻ một cột rộng rãi, dễ đọc, dễ chạm.
3. **Triage Velocity & 1-Tap Execution (Bắn tỉa tác vụ 1-chạm):**
   - Mỗi thẻ việc có sẵn nút hành động trực tiếp ngay trên bề mặt (`[Phê duyệt]`, `[Đôn đốc]`, `[Gia hạn]`).
   - Không bắt mở trang chi tiết hay hiển thị popup hỏi xác nhận cản trở.
   - Áp dụng cơ chế **Hoàn tác 5 giây (Optimistic UI + Undo Banner)** để người dùng ra quyết định siêu tốc mà vẫn an tâm tuyệt đối.
4. **Ergonomic Thumb-Zone Docking (Công thái học ngón cái):**
   - Đỉnh màn hình siêu mỏng (44px–48px), loại bỏ hoàn toàn nút Hamburger góc trên xa tầm tay.
   - Mọi hành động quan trọng nằm ở 2/3 phần dưới của màn hình.

---

## 3. Kiến trúc Thành phần & Chi tiết Thay đổi

### 3.1 Khung Vỏ Đỉnh Trang (`src/components/layout/app-topbar.tsx`)
1. **Gỡ bỏ nút Hamburger trên di động:**
   - Xóa bỏ nút `md:hidden` kích hoạt `toggleMobile()` của `sidebar-context`.
   - Giữ lại `toggleCollapse()` trên Desktop (`hidden md:flex`).
2. **Chuẩn hóa Header Mobile 44px thanh mảnh:**
   - **Bên trái:** Logo QCET thu nhỏ 24px + Huy hiệu đơn vị gọn gàng.
   - **Ở giữa:** Nút chuyển đổi góc nhìn / đơn vị `ScopeSwitcher` dạng Pill bo tròn trang nhã.
   - **Bên phải:** Chuông thông báo (`Bell`) kèm chấm đỏ số lượng việc chờ xử lý.

### 3.2 Thanh Điều Hướng Đáy (`src/components/layout/mobile-bottom-nav.tsx`)
1. **Chuẩn hóa Nút trung tâm (Elevated FAB):**
   - Màu sắc: `bg-primary text-primary-foreground shadow-md` (triệt tiêu hoàn toàn `bg-amber-500`).
   - Icon: `Plus` với `strokeWidth={1.5}`.
   - Tương tác: Luôn kích hoạt đúng sự kiện chuẩn `qcet:open-create-task` để mở modal tạo công việc/chỉ đạo mới của hệ thống.
2. **Hệ 5 Tab Chuẩn mực:**
   - Tab 1: **Tổng quan** (`LayoutDashboard`) — Góc nhìn điều hành / công việc của tôi.
   - Tab 2: **Công việc** (`CheckSquare`) — Danh sách nhiệm vụ chi tiết theo bộ lọc.
   - Tab 3: **Tạo việc (+)** — Nút trung tâm nổi bật.
   - Tab 4: **Thông báo** (`Bell`) — Hộp thư đến và nhắc việc.
   - Tab 5: **Thêm** (`Menu`) — Cửa sổ duy nhất mở `MobileMenuDrawer` (Lịch công tác, Đổi vai trò, Cài đặt PWA, Hồ sơ cá nhân).

### 3.3 Giao diện Khoang Lái Di động (`ExecutiveCockpitWorkspace` Mobile View)
Khi phát hiện kích thước màn hình nhỏ (`< md` hoặc `block md:hidden`):
1. **Thu gọn Header trang:**
   - Ẩn dòng tiểu sử dài dòng và các nút bấm macro cồng kềnh.
   - Thay bằng 1 dòng tóm tắt chỉ số nhẹ nhàng: `3 Điểm nghẽn · 5 Chờ duyệt · 11 Đơn vị`.
2. **Chuyển đổi Bảng thành Thẻ Danh Sách Một Cột (Compact Card Stack):**
   - **Thẻ Điểm Nghẽn Khẩn Cấp:**
     - Huy hiệu trạng thái: `bg-rose-500/10 text-rose-700 border-rose-500/20` (Quá hạn X ngày).
     - Tiêu đề công việc chữ to, đậm, rõ nét (`text-sm font-semibold`).
     - Đơn vị chủ trì và tên người thực hiện (`text-xs text-muted-foreground`).
     - Hạn chót định dạng `tabular-nums`.
     - Cặp nút hành động nhanh 1-chạm: `[Đôn đốc tiến độ]` và `[Gia hạn]`.
   - **Thẻ Hàng Đợi Phê Duyệt:**
     - Huy hiệu: `bg-amber-500/10 text-amber-700 border-amber-500/20` (Chờ nghiệm thu).
     - Nút hành động: `[Phê duyệt ngay]` (kích hoạt `onReview` tức thì) và `[Xem minh chứng]`.
   - **Khối Tiến độ 11 Đơn vị:**
     - Thu gọn thành danh sách phẳng dạng accordion gập/mở: Tên đơn vị kèm tỷ lệ hoàn thành dạng số font mono (`tabular-nums`) và thanh micro-progress 2px.
3. **Định vị Banner Hoàn tác (`undoState`):**
   - Di chuyển vị trí banner từ trong luồng cuộn thành dạng ghim nổi phía trên thanh đáy di động (`fixed bottom-20 left-4 right-4 z-40 md:relative md:bottom-auto`).
   - Đảm bảo banner không bị che khuất và ngón tay cái có thể bấm nút "Hoàn tác (5s)" dễ dàng.

---

## 4. Kiểm Thử & Tiêu Chí Nghiệm Thu (Acceptance Criteria)

1. **Kiểm tra Layout & Trực quan (Visual Inspection):**
   - Màn hình mobile không còn bất kỳ nút Hamburger nào trên Topbar.
   - Đáy màn hình không còn nút màu vàng cam `Zap`; toàn bộ nút trung tâm dùng màu Navy `Plus`.
   - Không xuất hiện bất kỳ emoji nào trong toàn bộ giao diện mobile.
2. **Kiểm tra Tương tác & Sự kiện (Event Flow):**
   - Bấm nút `+` ở đáy kích hoạt chính xác `qcet:open-create-task`.
   - Bấm các nút tác vụ gỡ nghẽn/duyệt việc trên thẻ phản hồi dưới 100ms kèm banner hoàn tác 5 giây nổi trên thanh đáy.
3. **Chất lượng Mã Nguồn & Kiểm Thử Tự Động:**
   - `npm run typecheck` thành công không lỗi.
   - `npm test` vượt qua 100% các unit test (không còn tham chiếu đến sự kiện rác `qcet:open-briefing-modal`).
