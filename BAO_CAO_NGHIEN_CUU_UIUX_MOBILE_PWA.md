# BÁO CÁO NGHIÊN CỨU & ĐÁNH GIÁ TOÀN DIỆN UI/UX MOBILE PWA
## DỰ ÁN: HỆ THỐNG VĂN PHÒNG ĐIỆN TỬ QCET E-OFFICE
**Đơn vị:** Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (QCET)  
**Thời gian lập:** Tháng 09/2026  
**Chủ đề:** Rà soát mã nguồn, nghiên cứu chuẩn mực quốc tế & đề xuất kiến trúc giao diện Mobile PWA thích ứng (Linear-Grade Adaptive Mobile Architecture)

---

## 1. TỔNG QUAN VẤN ĐỀ (EXECUTIVE SUMMARY)

Khi trải nghiệm hệ thống QCET E-Office trên thiết bị di động (cụ thể là màn hình iPhone 16 Pro Max qua trình duyệt Safari PWA / Add to Home Screen), người dùng ghi nhận phản ánh:
> *"Sao UI UX mobile pwa lại là một giao diện hoàn toàn khác vậy, quá kinh dị."*

Qua rà soát chi tiết toàn bộ mã nguồn frontend (`src/app`, `src/components/layout`, `src/components/portal`, `src/components/dashboard`) kết hợp phân tích 3 ảnh chụp thực tế màn hình iPhone, nguyên nhân **không phải do CSS bị hỏng đơn thuần**, mà do **sự phân mảnh kiến trúc (Fractured Architecture) giữa Desktop và Mobile**:
1. **Lỗi phân giải phân vùng Zone (`parseZoneParam`):** Đường dẫn gốc `/` bị ép cứng về `zone=tasks`, khiến tab "Tổng quan" và tab "Công việc" trên thanh điều hướng đáy hiển thị chung một màn hình. Người dùng hoàn toàn bị tước mất quyền xem Dashboard điều hành và các chỉ số KPI trên điện thoại.
2. **Rẽ nhánh hiển thị sang component biệt lập (`LecturerFocusWorkspace`):** Thay vì dùng một cấu trúc layout thích ứng (Adaptive Layout) chung cho toàn hệ thống, mã nguồn lại tách riêng vai trò `STAFF` sang một giao diện độc lập với các khối màu sắc tự phát, chưa qua chuẩn hóa Design System.
3. **Vi phạm nghiêm trọng công thái học di động (Anti-Ergonomics):** Nhồi nhét các phần tử desktop vào khung 390px – 440px của điện thoại; bộ lọc 6 màu sắc rớt thành 3 dòng lởm chởm; Onboarding Tour đè bẹp 55% màn hình và che lấp thanh điều hướng đáy.

---

## 2. KẾT QUẢ RÀ SOÁT MÃ NGUỒN & ĐỐI CHIẾU ẢNH CHỤP THỰC TẾ (AUDIT & EVIDENCE)

### 2.1. Lỗi phân giải Zone và Điều hướng đáy (Navigation Routing Hijack)
* **Vị trí mã nguồn:** `src/types/workspace.ts` (dòng 114)
  ```typescript
  export function parseZoneParam(param: string | null | undefined): WorkspaceZone {
    if (!param) return "tasks"; // <-- Gốc rễ gây hiểu lầm
  ```
* **Hậu quả thực tế:**
  - Nút **"Tổng quan"** trên thanh Bottom Nav dẫn tới `/` $\rightarrow$ Next.js phân giải thành `zone=tasks` $\rightarrow$ Render trang nhiệm vụ cá nhân.
  - Nút **"Công việc"** dẫn tới `/?zone=tasks` $\rightarrow$ Cũng render trang nhiệm vụ cá nhân.
  - Người dùng bấm qua lại giữa 2 tab chính ở thanh đáy nhưng giao diện không hề thay đổi, tạo cảm giác hệ thống bị lỗi hoặc "chắp vá".

### 2.2. Thanh điều hướng đỉnh bị bóp nghẹt (Topbar Cramping & Truncation)
* **Vị trí mã nguồn:** `src/components/layout/app-topbar.tsx`
* **Hiện trạng trên ảnh chụp [Image #2]:**
  - Chiều ngang màn hình iPhone (~400px) phải gánh cùng lúc: `Breadcrumb Title` + `Scope Switcher (Cá nhân)` + `Bell` + `PWA Install Button` + `User Avatar`.
  - Hậu quả: Tiêu đề bị cắt cụt thảm hại thành `Quản lý cô...`; dropdown `Cá nhân` bị đẩy ép; icon chuông và avatar dính sát mép; huy hiệu Next.js DevTools (`N`) đè trực tiếp lên chữ và avatar.

### 2.3. Trải nghiệm Onboarding đè nghẽn màn hình (Spotlight Modal Hijack)
* **Vị trí mã nguồn:** `src/components/onboarding/spotlight-tour.tsx` (dòng 188 - 192)
  ```tsx
  className={isMobile 
    ? "fixed bottom-0 left-0 right-0 p-4 bg-card border-t border-border rounded-t-2xl shadow-xl z-50"
    : "absolute w-80 bg-card ..."}
  ```
* **Hiện trạng trên ảnh chụp [Image #3]:**
  - Khung hướng dẫn *"Bước 1 / 3 - Bàn Làm Việc Cá Nhân"* trồi lên từ đáy, chiếm hơn 55% chiều cao màn hình.
  - Khung này đè bẹp lên nội dung bên dưới, khóa cứng thanh Bottom Nav, không tính toán `env(safe-area-inset-bottom)`. Người dùng mới truy cập bị cảm giác như bị "kẹt trong bẫy modal", không thể cuộn xem giao diện.

### 2.4. Bùng nổ màu sắc & vỡ dòng tại thanh lọc (Rainbow Soup & Jagged Wrapping)
* **Vị trí mã nguồn:** `src/components/portal/lecturer-focus-workspace.tsx` (dòng 893 - 980)
  ```tsx
  <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pt-1 border-t border-border/50">
    <button className="bg-rose-500/10 text-rose-700 ...">Hôm nay cần làm</button>
    <button className="bg-blue-500/10 text-blue-700 ...">Trong tuần này</button>
    <button className="bg-purple-500/10 text-purple-700 ...">Chờ lãnh đạo duyệt</button>
    <button className="bg-amber-500/10 text-amber-700 ...">Cần chỉnh sửa</button>
    <button className="bg-emerald-500/10 text-emerald-700 ...">Đã hoàn thành</button>
  </div>
  ```
* **Hiện trạng trên ảnh chụp [Image #2] & [Image #4]:**
  - Sử dụng class `flex-wrap` khiến 6 viên pill rớt thành **3 dòng so le nham nhở**, chiếm tới 35% diện tích màn hình.
  - 6 màu sắc rực rỡ (đỏ, xanh dương, tím, vàng, xanh lục, xám) cạnh nhau tạo cảm giác "chợ búa", mất đi tính trang nghiêm và chuẩn mực của một ứng dụng hành chính công sở.
  - Tab phân loại sở hữu: `Tất cả | Tôi chủ trì (DRI) | Tôi tham gia (Phối hợp)` bị co hẹp, làm chữ trong ngoặc đơn bị rớt dòng méo mó.

### 2.5. Nút Làm mới trơ trọi và Empty State khổng lồ
* Nút làm mới (`RefreshCw`) đứng trơ trọi một mình bên dưới thanh tiêu đề mà không có nhãn chữ, tạo khoảng hở thừa thãi.
* Empty State chiếm trọn phần thân màn hình với một icon dấu tick xanh bé tí xíu và nút bấm đề xuất nhiệm vụ quá to, mất cân đối tỷ lệ trực quan (Visual Hierarchy).

---

## 3. NGHIÊN CỨU CHUẨN MỰC THIẾT KẾ QUỐC TẾ & E-OFFICE VIỆT NAM (EXA BENCHMARK)

### 3.1. Bài học từ Linear Mobile (Thiết kế bởi Gavin Nelson & Tomas Pustelnik)
1. **Nguyên lý Responsive Slot Container trong Header:**
   - Linear không bao giờ cho phép 2 thành phần tiêu đề / điều hướng (Breadcrumb + Dropdown bộ lọc) cùng xuất hiện trên thanh header của mobile.
   - Khi màn hình nhỏ hơn 768px, header chỉ giữ **1 cấp ngữ cảnh duy nhất (Single-level Context)**: Logo hoặc Tên màn hình hiện tại. Mọi nút chức năng phụ tự động chuyển vào menu trượt hoặc bottom sheet.
2. **Muted Palette with Intentional Pops:**
   - Linear kiên quyết loại bỏ hiện tượng "nồi lẩu màu sắc". Các thẻ lọc (filter chips) ở trạng thái chưa chọn đều mang màu nền trung tính xám nhẹ (`bg-muted/60 text-muted-foreground`).
   - Chỉ khi người dùng bấm chọn, thẻ đó mới sáng màu chủ đạo (`bg-primary text-primary-foreground`) kèm đốm đếm số rõ ràng.
3. **Single-row Horizontal Scroll (Carousel Tabs):**
   - Bộ lọc trên mobile **tuyệt đối không dùng `flex-wrap`**. 100% sử dụng thanh cuộn ngang 1 dòng (`overflow-x-auto scrollbar-none flex-nowrap`) kết hợp cử chỉ chạm vuốt (touch-swipe) mượt mà.
4. **Bottom Sheet Pickers (Tương tác chuẩn 60fps):**
   - Với các bộ lọc nhiều chiều (Phòng ban, Trạng thái, Tháng học vụ), Linear chuyển sang một nút bấm `Lọc (Filters)` nhỏ gọn. Khi chạm, một **Bottom Sheet** trượt êm ái từ đáy màn hình, phù hợp với tầm với của ngón tay cái (Thumb-zone).

### 3.2. Tiêu chuẩn Apple Human Interface Guidelines (HIG) cho iOS 18/26
1. **Kích thước vùng chạm tối thiểu (Touch Target):**
   - Mọi nút bấm, tab điều hướng phải đạt kích thước tối thiểu **44pt x 44pt** (tương đương 44px x 44px).
   - Khoảng cách giữa các phần tử tương tác tối thiểu 8px để tránh bấm nhầm khi đang di chuyển.
2. **Kiểm soát Safe Area Viewport:**
   - Lề trên phải tôn trọng Dynamic Island và tai thỏ: `pt-[env(safe-area-inset-top,0px)]`.
   - Thanh Bottom Nav và các Bottom Sheet phải bao trọn thanh Home Indicator: `pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]`.
3. **Loại bỏ Modal xâm thực (Non-intrusive Onboarding):**
   - Apple khuyến cáo không dùng modal che khuất giao diện thao tác chính trên điện thoại. Onboarding cần thiết kế dạng **Inline Dismissible Card** nằm tự nhiên trong luồng cuộn của nội dung, cho phép người dùng lướt qua hoặc tắt bằng nút `✕`.

### 3.3. Đối chiếu các nền tảng E-Office hàng đầu tại Việt Nam (VNPT iOffice, Vi-Office, Base.vn)
- **VNPT iOffice & Vi-Office:** Ứng dụng di động tập trung giải quyết 3 nhu cầu cốt lõi nhất của người dùng khi ra ngoài:
  1. *Xem nhanh văn bản / công việc khẩn:* Dashboard thẻ tóm tắt (3-4 chỉ số quan trọng).
  2. *Duyệt nhanh 1 chạm (One-tap approval):* Ký duyệt tờ trình, công văn đến/đi.
  3. *Tra cứu danh bạ & lịch công tác:* Truy cập nhanh lịch họp của trường/đơn vị.
- Không một hệ thống nào ép người dùng di động nhìn vào một bảng phân cấp desktop thu nhỏ hoặc nhồi nhét 6 hàng nút lọc rực rỡ trên một màn hình nhỏ.

---

## 4. BẢNG ĐỐI CHIẾU HIỆN TRẠNG VÀ QUY CHUẨN MỚI

| Thành phần | Hiện trạng (Lỗi & Gây khó chịu) | Quy chuẩn mới (Linear-Grade Adaptive) |
| :--- | :--- | :--- |
| **Phân luồng Zone** | `/` bị ép cứng về `zone=tasks`. Tab Tổng quan và Công việc trùng lặp. | `/` mở đúng **DashboardZone** (Tổng quan điều hành, KPI, việc khẩn). `/?zone=tasks` mở **TasksZone**. |
| **Topbar đỉnh** | Cắt cụt chữ `Quản lý cô...`, Breadcrumbs + Scope Switcher chen chúc, 5 icon dồn cục. | Rút gọn chuẩn Mobile: `[Logo QCET + Scope Selector gọn]` (trái) và `[Chuông + Avatar]` (phải). Không bao giờ cắt cụt chữ. |
| **Tab quyền hạn** | 3 tab nhồi trong khung hẹp, chữ `(DRI)` và `(Phối hợp)` rớt dòng xấu xí. | Nhãn công thái học ngắn gọn: `Tất cả` \| `Chủ trì` \| `Phối hợp`. Chiều cao 40px, chạm vuốt dễ dàng. |
| **Bộ lọc trạng thái** | 6 viên pill mang 6 màu sắc rực rỡ, `flex-wrap` rớt 3 dòng lởm chởm. | **Single-row Horizontal Scroll (Cuộn ngang 1 dòng)**. Tone màu Muted thanh lịch, chỉ sáng màu `primary` khi được kích hoạt. |
| **Onboarding Tour** | Khung cố định `fixed bottom-0` đè bẹp 55% màn hình, khóa thanh điều hướng đáy. | Tắt Spotlight Tour che màn hình trên mobile. Thay bằng banner nhỏ gọn có nút tắt ở đầu trang. |
| **Nút Làm mới** | Icon tròn trơ trọi giữa trang. | Tích hợp vào góc phải thanh công cụ hoặc hỗ trợ vuốt xuống để làm mới (Pull-to-refresh). |
| **Empty State** | Khung to chiếm trọn màn hình, icon tí hon, nút bấm quá khổ. | Bố cục căn giữa tinh gọn, chiều cao vừa phải, thông điệp tích cực và nút bấm vừa tầm tay. |
| **Thanh Bottom Nav** | Nhồi nhét icon, khoảng cách đáy chưa tối ưu Home Indicator. | Tối ưu 4 tab rõ ràng + 1 nút Action ở giữa, padding chuẩn `env(safe-area-inset-bottom)`. |

---

## 5. GIẢI PHÁP KIẾN TRÚC & KẾ HOẠCH TRIỂN KHAI KỸ THUẬT

### Bước 1: Sửa chữa dứt điểm phân luồng Zone (`src/types/workspace.ts`)
* Cấu hình phân giải URL chuẩn xác:
  - Khi người dùng truy cập `/` (không có param `zone`): Trả về `"dashboard"` (Tổng quan điều hành với các thẻ KPI, chỉ số công việc, lịch sắp tới).
  - Khi người dùng truy cập `/?zone=tasks`: Trả về `"tasks"` (Kho quản lý công việc).
* Đảm bảo tab "Tổng quan" trên thanh `MobileBottomNav` trỏ đúng vào `/?zone=dashboard` hoặc `/`, tab "Công việc" trỏ vào `/?zone=tasks`.

### Bước 2: Tinh chỉnh Topbar Mobile (`src/components/layout/app-topbar.tsx`)
* Sử dụng CSS Media Query chuẩn:
  - Trên màn hình `< 768px`: Ẩn `TopbarBreadcrumbs` phân cấp dài dòng.
  - Thu gọn `ScopeSwitcher` thành icon kèm tên đơn vị ngắn (VD: `QCET` / `Khoa CNTT` / `Cá nhân`).
  - Ẩn nút cài đặt PWA và ô tìm kiếm dài vào Menu "Thêm" của Bottom Nav.
  - Đảm bảo khoảng cách thông thoáng giữa Chuông thông báo và Avatar người dùng.

### Bước 3: Tái thiết kế bộ lọc `LecturerFocusWorkspace`
* Thay thế `flex-wrap` bằng `flex-nowrap overflow-x-auto scrollbar-none py-1 px-0.5`.
* Chuẩn hóa bảng màu:
  - Tất cả các pill ở trạng thái không kích hoạt: `bg-muted/60 text-muted-foreground hover:bg-muted`.
  - Khi được kích hoạt: `bg-primary text-primary-foreground shadow-xs font-semibold`.
* Rút gọn nhãn hiển thị:
  - `Tôi chủ trì (DRI)` $\rightarrow$ `Chủ trì` (kèm icon `User`).
  - `Tôi tham gia (Phối hợp)` $\rightarrow$ `Phối hợp` (kèm icon `Users`).

### Bước 4: Tối ưu Onboarding cho Mobile (`src/components/onboarding/spotlight-tour.tsx`)
* Bổ sung điều kiện kiểm tra kích thước màn hình: Nếu `window.innerWidth < 768px`, không kích hoạt `SpotlightTour` dạng backdrop mask đè màn hình.
* Thay thế bằng một thẻ thông báo chào mừng nhỏ gọn phía trên danh sách công việc: *"Chào mừng Thầy/Cô đến với QCET E-Office"* kèm nút *"Đã hiểu"* để đóng lại trong 1 chạm.

### Bước 5: Kiểm thử và Xác thực (QA Verification)
* Chạy `npm run typecheck` đảm bảo không có lỗi kiểu dữ liệu TypeScript.
* Chạy `npm test` đảm bảo 100% test suites vượt qua.
* Xác thực trên trình mô phỏng Responsive (iPhone 16 Pro Max, iPhone SE, Samsung Galaxy S24) để đảm bảo không còn bất kỳ hiện tượng vỡ layout hay cắt chữ nào.

---

## 6. KẾT LUẬN & KIẾN NGHỊ

Sự cố giao diện mobile hiện tại hoàn toàn có thể khắc phục triệt để bằng cách áp dụng **Kiến trúc thích ứng đồng nhất (Unified Adaptive Mobile)**. Thay vì chấp nhận một giao diện "lạ lẫm, kinh dị" do việc phân mảnh component tạo ra, việc chuẩn hóa theo các nguyên lý của Linear Mobile và Apple HIG sẽ biến phiên bản Mobile PWA của QCET E-Office trở thành một công cụ làm việc di động cao cấp, mượt mà và sang trọng, xứng tầm với phiên bản Desktop của nhà trường.
