# TÀI LIỆU ĐẶC TẢ KỸ THUẬT VÀ NGHIỆP VỤ HỆ THỐNG
## HỆ THỐNG VĂN PHÒNG ĐIỀU HÀNH & QUẢN TRỊ CÔNG VIỆC ĐIỆN TỬ (QCET E-OFFICE)
**Đơn vị thụ hưởng:** Trường Cao đẳng Kinh tế - Kỹ thuật Cần Thơ (QCET)  
**Phiên bản tài liệu:** 2.0 (Toàn diện Sprint 1 & Sprint 2)  
**Ngày phát hành:** Tháng 09/2026  
**Tiêu chuẩn thiết kế:** Twenty CRM Clean Slate & Zinc (Ưu tiên Light Mode)

---

## MỤC LỤC
1. [Giới thiệu & Mục tiêu Hệ thống](#1-giới-thiệu--mục-tiêu-hệ-thống)
2. [Mô hình Nghiệp vụ Phân cấp 2 Tầng (Two-Tier Delegation Engine)](#2-mô-hình-nghiệp-vụ-phân-cấp-2-tầng-two-tier-delegation-engine)
3. [Kiến trúc Kỹ thuật & Công nghệ (Technical Stack)](#3-kiến-trúc-kỹ-thuật--công-nghệ-technical-stack)
4. [Đặc tả Dữ liệu Thực tế & Tích hợp Notion API](#4-đặc-tả-dữ-liệu-thực-tế--tích-hợp-notion-api)
5. [Quy chuẩn Thiết kế Giao diện (Twenty Design System)](#5-quy-chuẩn-thiết-kế-giao-diện-twenty-design-system)
6. [Đặc tả Chi tiết các Phân hệ Chức năng](#6-đặc-tả-chi-tiết-các-phân-hệ-chức-năng)
   - 6.1. Phân hệ Bảng điều hành Trung tâm (`Executive Dashboard - /`)
   - 6.2. Phân hệ Quản lý Nhiệm vụ & Kanban Board (`Tasks Management - /tasks`)
   - 6.3. Phân hệ Lịch công tác Toàn trường (`Calendar & Schedule - /calendar`)
   - 6.4. Phân hệ Cơ cấu Tổ chức & Danh bạ Cán bộ (`Organization Tree - /org`)
   - 6.5. Hộp thoại Tạo & Giao việc Thông minh (`CreateTaskModal`)
   - 6.6. Ngăn kéo Chi tiết Trượt phải (`TaskDetailSideSheet`)
7. [Ma trận Phân quyền Người dùng (RBAC Matrix)](#7-ma-trận-phân-quyền-người-dùng-rbac-matrix)
8. [Kiểm thử & Đảm bảo Chất lượng (Quality Assurance)](#8-kiểm-thử--đảm-bảo-chất-lượng-quality-assurance)
9. [Bảo mật, Triển khai & Lộ trình Nâng cấp (Roadmap)](#9-bảo-mật-triển-khai--lộ-trình-nâng-cấp-roadmap)

---

## 1. Giới thiệu & Mục tiêu Hệ thống

### 1.1. Bối cảnh
Trước khi triển khai QCET E-Office, việc giao việc, chỉ đạo và báo cáo tiến độ tại Trường Cao đẳng Kinh tế - Kỹ thuật Cần Thơ phụ thuộc vào văn bản giấy, email nội bộ hoặc các nhóm chat phân tán. Điều này dẫn đến tình trạng:
* Thiếu tính liên kết giữa chỉ đạo chiến lược của Ban Giám hiệu và việc thực thi của chuyên viên.
* Khó đo lường tỷ lệ hoàn thành KPI thực tế của từng Khoa/Phòng.
* Không có bức tranh tổng thể về các hạn chót (deadlines) và khối lượng công việc đang tồn đọng.

### 1.2. Mục tiêu cốt lõi
QCET E-Office được thiết kế để giải quyết triệt để các vấn đề trên thông qua:
1. **Phân cấp giao việc 2 tầng minh bạch:** BGH giao đơn vị chủ trì ➔ Đơn vị bẻ nhỏ việc giao nhân viên.
2. **Đo lường tiến độ tự động:** Rollup tiến độ từ các việc con lên nhiệm vụ cha theo thời gian thực.
3. **Trải nghiệm người dùng chuẩn quốc tế:** Kế thừa trọn vẹn triết lý thiết kế tối giản, sạch sẽ và siêu tốc của **Twenty CRM** (Open-source CRM hàng đầu thế giới).
4. **Tích hợp dữ liệu kép:** Vận hành đồng thời với dữ liệu Notion API hiện có và cơ chế Fallback nội bộ ổn định 100%.

---

## 2. Mô hình Nghiệp vụ Phân cấp 2 Tầng (Two-Tier Delegation Engine)

```text
┌─────────────────────────────────────────────────────────────┐
│                   BAN GIÁM HIỆU (Lãnh đạo Trường)           │
│                   - Tạo Nhiệm vụ cấp Trường (Tier 1)         │
│                   - Chỉ định Đơn vị/Lãnh đạo chủ trì        │
│                   - Thiết lập Hạn chót & Lĩnh vực công tác   │
└──────────────────────────────┬──────────────────────────────┘
                               │
               (Giao việc chiến lược / chỉ đạo)
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│           TRƯỞNG PHÒNG / KHOA / TRUNG TÂM (Lãnh đạo Đơn vị) │
│           - Tiếp nhận Nhiệm vụ cấp Trường                   │
│           - Phân rã thành các Công việc Đơn vị (Tier 2)     │
│           - Phân công cán bộ/giảng viên thực hiện           │
│           - Duyệt kết quả / Đánh dấu hoàn tất               │
└──────────────────────────────┬──────────────────────────────┘
                               │
                (Giao việc chi tiết / thực thi)
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│               VIÊN CHỨC / CHUYÊN VIÊN / GIẢNG VIÊN          │
│               - Nhận việc được phân công                    │
│               - Cập nhật trạng thái: Mới ➔ Đang làm ➔ Xong │
│               - Đính kèm báo cáo / Ghi chú điều hành        │
└─────────────────────────────────────────────────────────────┘
                               ▲
                               │  (Rollup tự động)
┌──────────────────────────────┴──────────────────────────────┐
│  CÔNG THỨC TÍNH TIẾN ĐỘ TỰ ĐỘNG (PROGRESS ROLLUP):          │
│                                                             │
│         Tổng số việc con hoàn thành (COMPLETED)             │
│  % = ───────────────────────────────────────────── × 100%   │
│               Tổng số việc con thuộc nhiệm vụ               │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Kiến trúc Kỹ thuật & Công nghệ (Technical Stack)

Hệ thống được phát triển trên nền tảng Fullstack Serverless hiện đại nhất hiện nay:

* **Framework cốt lõi:** `Next.js 15.5+` (App Router, React Server Components & Client Components).
* **Ngôn ngữ:** `TypeScript 5.x` (Chế độ `strict: true`, đảm bảo an toàn kiểu dữ liệu 100%).
* **Thư viện UI & Styling:** 
  * `Tailwind CSS v4` (Kiến trúc `@theme inline` không phụ thuộc file config cồng kềnh).
  * `lucide-react` (Bộ icon nét mảnh 1.5px chuẩn mực).
  * `clsx` & `tailwind-merge` (Xử lý hợp nhất class linh hoạt).
* **Data Fetching & API Layer:**
  * Next.js Serverless Route Handler (`/api/dashboard/overview`).
  * Tích hợp `@notionhq/client` & Native Fetch chuẩn Web API.
  * In-memory cache với thời gian sống `TTL = 60 giây`.
* **Môi trường Kiểm thử:**
  * Node.js Test Runner chuẩn (`tsx --test`).
  * 61 kịch bản kiểm thử tự động (Unit Tests & Integration Tests).

---

## 4. Đặc tả Dữ liệu Thực tế & Tích hợp Notion API

Hệ thống kết nối trực tiếp với 2 cơ sở dữ liệu đang vận hành thực tế tại QCET:

### 4.1. Bảng `HOẠT ĐỘNG` (Nhiệm vụ cấp Trường - Tier 1)
* **Notion Database ID:** `6e1726a4-e693-45ec-a961-3774c3e9c582` (Source ID: `9b658ae9-4c59-4ee7-ad05-9c8f3b95a4f4`).
* **Quy mô thực tế:** **304** nhiệm vụ cấp trường.
* **Cấu trúc trường dữ liệu:**
  | Tên trường | Kiểu dữ liệu | Mô tả |
  | :--- | :--- | :--- |
  | `Tiêu đề` | `title` | Tên nhiệm vụ cấp trường |
  | `Nhiệm vụ` | `select` | Lĩnh vực công tác (*Chuyển đổi số, Truyền thông, CNTT, ATTT, Thư viện, Báo cáo, Khác*) |
  | `Trạng thái` | `status` | `Đang thực hiện 🔨`, `Hoàn thành 👍` |
  | `Xử lý chính` | `people` | Lãnh đạo đơn vị / Trưởng đầu mối chịu trách nhiệm |
  | `Phối hợp` | `multi_select` | Danh sách cán bộ/đơn vị cùng tham gia |
  | `Ngày giao việc` | `date` | Thời điểm bắt đầu giao nhiệm vụ |
  | `Hạn xử lý` | `date` | Hạn chót nhiệm vụ |
  | `Tiến độ` | `formula` | Tự động tính toán từ các việc con |
  | `📷 LỊCH LÀM VIỆC` | `relation` | Liên kết 1-N sang các việc con của nhân viên |

### 4.2. Bảng `LỊCH LÀM VIỆC` (Công việc Đơn vị / Nhân viên - Tier 2)
* **Notion Database ID:** `63c187f9-7c5a-49a4-a854-26e830fd44c7` (Source ID: `880dde7c-15af-41d2-becb-c8fe8b1396f5`).
* **Quy mô thực tế:** **920** công việc cụ thể.
* **Cấu trúc trường dữ liệu:**
  | Tên trường | Kiểu dữ liệu | Mô tả |
  | :--- | :--- | :--- |
  | `Công việc` | `title` | Tên việc cụ thể giao cho nhân viên |
  | `Người phụ trách` | `people` | Cán bộ/viên chức trực tiếp làm |
  | `Ngày thực hiện` | `date` | Thời hạn hoàn thành công việc |
  | `Trạng thái` | `select` | `Mới 🆕`, `Đang thực hiện 🔨`, `Cần chỉnh sửa ⚠️`, `Hoàn thành 👍` |
  | `Hoạt động` | `relation` | Liên kết N-1 ngược về Nhiệm vụ cấp trường tương ứng |

### 4.3. Cơ chế Resilient Fallback (Không sợ mất mạng)
* Token API được đọc bảo mật qua `process.env.NOTION_TOKEN`.
* Khi gọi API thất bại, hết quota hoặc chạy offline, hệ thống tự động kích hoạt `getMockDashboardPayload()`.
* Dữ liệu mock được mô phỏng chính xác **304 việc trường** và **920 việc đơn vị** cùng đầy đủ tên cán bộ thật của trường, đảm bảo hiển thị 0ms không bao giờ bị lỗi màn hình trắng.

---

## 5. Quy chuẩn Thiết kế Giao diện (Twenty Design System)

Hệ thống tuân thủ nghiêm ngặt theo tài liệu `DESIGN.md` và `PRODUCT.md` của **Twenty CRM**:

```text
┌─────────────────────────────────────────────────────────────┐
│  BẢNG MÀU CHUẨN TWENTY (LIGHT-MODE PRIORITY)                 │
├──────────────────────────────┬──────────────────────────────┤
│  Mặt nền ứng dụng (Canvas)   │  #FBFBFB                     │
│  Mặt thẻ / Card / Sheet      │  #FFFFFF                     │
│  Mặt nền Sidebar / Thanh nav │  #FAFAFA                     │
│  Đường kẻ Hairline (1px)     │  #E4E4E7 (Zinc-200)          │
│  Viền khi Hover              │  #D4D4D8 (Zinc-300)          │
│  Màu chữ chính (Foreground)  │  #09090B (Zinc-950)          │
│  Màu chữ phụ (Muted)         │  #52525B (Zinc-600)          │
│  Nút hành động đặc (Solid)   │  #18181B (Chữ trắng #FFFFFF) │
├──────────────────────────────┴──────────────────────────────┤
│  HUY HIỆU TRẠNG THÁI (SOFT PASTEL BADGES - 10% TINT)        │
│  • Hoàn thành 👍  : Nền #ECFDF5, Viền #A7F3D0, Chữ #047857    │
│  • Đang làm 🔨    : Nền #EFF6FF, Viền #BFDBFE, Chữ #1D4ED8    │
│  • Cần duyệt ⚠️   : Nền #FFFBEB, Viền #FDE68A, Chữ #B45309    │
│  • Mới 🆕         : Nền #FEF2F2, Viền #FECACA, Chữ #B91C1C    │
├─────────────────────────────────────────────────────────────┤
│  HÌNH HỌC & BO GÓC (GEOMETRY RULES)                         │
│  • Thẻ, Container, Bảng, Sheet: rounded-lg (8px)             │
│  • Nút bấm, Ô nhập liệu, Badge: rounded-md (6px)             │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Đặc tả Chi tiết các Phân hệ Chức năng

### 6.1. Phân hệ Bảng điều hành Trung tâm (`Executive Dashboard - /`)
Là màn hình điều hành tối cao dành cho Ban Giám hiệu và các Trưởng đơn vị:

1. **Thanh chỉ số KPI điều hành (Executive Stat Strip - 4 Cards):**
   * **Thẻ 1 - Nhiệm vụ cấp Trường:** Hiển thị tổng số `304`, nhãn phụ: `212 đang làm · 92 xong`.
   * **Thẻ 2 - Công việc Đơn vị:** Hiển thị tổng số `920`, nhãn phụ: `580 đang làm · 290 xong`.
   * **Thẻ 3 - Cần xử lý & Trễ hạn:** Hiển thị tổng số việc cảnh báo (`42 cần duyệt · 5 trễ hạn`).
   * **Thẻ 4 - Tỷ lệ hoàn thành toàn trường:** Hiển thị `%` hoàn thành trung bình kèm thanh tiến độ mini.
2. **Cột chính (Trái - 65% width): Bảng phân cấp 2 tầng (`CascadingTaskTable`):**
   * Hỗ trợ tìm kiếm nhanh toàn hệ thống qua phím tắt `⌘K` hoặc `Ctrl+K`.
   * Bộ lọc Tabs theo 7 lĩnh vực công tác.
   * Hàng cha hiển thị: Tên nhiệm vụ, Đơn vị/Cán bộ chủ trì, Hạn chót, Thanh tiến độ Rollup (`X/Y việc - Z%`).
   * Bấm mũi tên `>` bung mở ngay các hàng con (thụt lề `28px` kèm đường kẻ chỉ dẫn).
3. **Cột phụ (Phải - 35% width):**
   * **Widget Hạn chót 7 ngày tới (`UpcomingDeadlinesWidget`):** Liệt kê các việc có hạn hoàn thành trong tuần, gắn nhãn màu đỏ cảnh báo nếu đã quá hạn.
   * **Widget Dòng hoạt động thời gian thực (`ActivityFeedWidget`):** Ghi nhận tức thời lịch sử cán bộ hoàn thành việc hoặc BGH giao nhiệm vụ mới.

---

### 6.2. Phân hệ Quản lý Nhiệm vụ & Kanban Board (`Tasks Management - /tasks`)
Dành cho việc quản lý và điều phối chuyên sâu:

1. **Bộ chuyển đổi chế độ xem (View Switcher):**
   * Chế độ **[Bảng phân cấp / Table]**: Sử dụng `CascadingTaskTable` để nhìn cây nhiệm vụ.
   * Chế độ **[Bảng Kanban / Board]**: Phân loại toàn bộ công việc vào 4 cột trạng thái.
2. **Cấu trúc 4 Cột Kanban:**
   * Cột 1: `Mới 🆕`
   * Cột 2: `Đang thực hiện 🔨`
   * Cột 3: `Cần chỉnh sửa ⚠️`
   * Cột 4: `Hoàn thành 👍`
3. **Thẻ Kanban thông minh:**
   * Hiển thị rõ cấp độ: Huy hiệu Xanh dương cho việc *Cấp Trường*, Huy hiệu Chàm cho việc *Đơn vị*.
   * Nút dịch chuyển trạng thái nhanh (◀ / ▶) trên từng thẻ, tự động cập nhật lại tiến độ rollup lên việc cha.

---

### 6.3. Phân hệ Lịch công tác Toàn trường (`Calendar & Schedule - /calendar`)
Số hóa lịch họp, sự kiện và hạn chót theo dòng thời gian:

1. **Lưới lịch Tháng thông minh (`CalendarMonthView`):**
   * Hiển thị chuẩn 7 cột từ Thứ 2 đến Chủ nh��t (T2 - CN).
   * Ô ngày hiện tại được làm nổi bật với huy hiệu màu sắc.
   * Mỗi ô hiển thị tối đa 3 đầu việc có hạn trong ngày kèm chấm màu theo lĩnh vực, có nhãn `+N việc nữa` nếu nhiều hơn.
   * Điều hướng linh hoạt: Tháng trước, Tháng sau và nút "Hôm nay".
2. **Panel Chi tiết ngày được chọn:**
   * Cột bên cạnh hiển thị toàn bộ danh sách các việc cần hoàn thành trong ngày đang bấm chọn.
   * Có nút bấm mở nhanh Modal Giao việc với ngày hết hạn được điền sẵn theo ngày đang chọn.

---

### 6.4. Phân hệ Cơ cấu Tổ chức & Danh bạ Cán bộ (`Organization Tree - /org`)
Sơ đồ cây 11 đơn vị chuẩn mực của Trường Cao đẳng Kinh tế - Kỹ thuật Cần Thơ:

1. **Danh mục Đơn vị:**
   * **Ban Giám hiệu:** Hiệu trưởng, các Phó Hiệu trưởng.
   * **Phòng chức năng (5 phòng):**
     * Phòng Đào tạo & Quản lý Khoa học (`P_DTQLKH`)
     * Phòng Hành chính - Quản trị (`P_HCQT`)
     * Phòng Kế hoạch - Tài chính (`P_KHTC`)
     * Phòng Khảo thí & Đảm bảo chất lượng (`P_KTDBCL`)
     * Phòng Công tác HSSV (`P_CTHSSV`)
   * **Khoa chuyên môn (3 khoa):**
     * Khoa Công nghệ thông tin (`K_CNTT`)
     * Khoa Kinh tế - Quản trị (`K_KTQT`)
     * Khoa Kỹ thuật - Công nghệ (`K_KTCN`)
   * **Trung tâm trực thuộc (2 trung tâm):**
     * Trung tâm Truyền thông & Số hóa (`TT_DCC`)
     * Trung tâm Ngoại ngữ - Tin học (`TT_NNTH`)
2. **Danh bạ Cán bộ & Trạng thái Công tác:**
   * Bấm vào từng đơn vị sẽ hiển thị danh sách viên chức kèm ảnh đại diện, chức vụ, email công vụ, số điện thoại nội bộ.
   * **Số nhiệm vụ đang phụ trách:** Đếm trực tiếp số việc mà cán bộ đó đang làm trên hệ thống.
   * Hỗ trợ tìm kiếm cán bộ toàn trường, chuyển đổi xem dạng Lưới (Grid) hoặc Bảng (Table), và chức năng In danh bạ / Xuất file CSV.

---

### 6.5. Hộp thoại Tạo & Giao việc Thông minh (`CreateTaskModal`)
Tích hợp nút `+ Giao việc` thường trực trên thanh điều hướng Topbar và mọi bảng công việc:
* **Toggle phân cấp nhiệm vụ:**
  * Chọn `Nhiệm vụ cấp Trường (BGH giao)`: Giao cho Trưởng đơn vị chủ trì.
  * Chọn `Công việc Đơn vị (Giao nhân viên)`: Hiển thị dropdown chọn nhiệm vụ trường cha để liên kết tự động.
* **Validation thời gian thực:** Kiểm tra bắt buộc Tiêu đề, Người chịu trách nhiệm và Hạn hoàn thành.
* **Quản lý Cán bộ phối hợp:** Cho phép thêm tag nhiều cán bộ phối hợp và xóa bỏ dễ dàng bằng phím `Enter`.

---

### 6.6. Ngăn kéo Chi tiết Trượt phải (`TaskDetailSideSheet`)
Khi bấm vào bất kỳ dòng hoặc thẻ công việc nào trên màn hình, ngăn kéo sẽ trượt êm ái từ cạnh phải:
* Không chuyển hướng trang, giữ nguyên vị trí cuộn chuột của người dùng.
* Xem toàn bộ mô tả, lĩnh vực, người chủ trì, hạn chót và ngày giao việc.
* Đổi trạng thái tức thì qua dropdown.
* Nếu là việc cấp Trường: Hiển thị thanh tiến độ %, danh sách các việc con của nhân viên và form thêm nhanh việc con ngay trong ngăn kéo.
* Khu vực trao đổi / Ghi chú chỉ đạo: Lưu lại nhật ký điều hành theo thời gian thực.

---

## 7. Ma trận Phân quyền Người dùng (RBAC Matrix)

| Chức năng | Ban Giám hiệu (`ADMIN`) | Trưởng Phòng/Khoa (`MANAGER`) | Viên chức/GV (`STAFF`) |
| :--- | :---: | :---: | :---: |
| **Xem Dashboard toàn trường** | ✅ Toàn quyền | ✅ Chỉ số trường + Đơn vị mình | ❌ Chỉ xem việc cá nhân |
| **Tạo Nhiệm vụ cấp Trường** | ✅ Có quyền | ❌ Không có quyền | ❌ Không có quyền |
| **Tạo Công việc cấp Đơn vị** | ✅ Có quyền | ✅ Giao việc trong đơn vị mình | ❌ Không có quyền |
| **Cập nhật trạng thái việc cá nhân** | ✅ Có quyền | ✅ Có quyền | ✅ Có quyền |
| **Duyệt hoàn thành việc cấp Trường** | ✅ Có quyền | ❌ Cần BGH duyệt | ❌ Không có quyền |
| **Xem Sơ đồ tổ chức & Danh bạ** | ✅ Toàn trường | ✅ Toàn trường | ✅ Toàn trường |

---

## 8. Kiểm thử & Đảm bảo Chất lượng (Quality Assurance)

Hệ thống áp dụng phương pháp **Test-Driven Development (TDD)** nghiêm ngặt:
* **Tổng số kịch bản test tự động:** **61 / 61 tests PASS (100%)**.
* **Độ bao phủ kiểm thử:**
  1. `tests/smoke.test.ts`: Kiểm tra Design Tokens, biến CSS, class CVA của Button, Badge, Card.
  2. `tests/dashboard-aggregator.test.ts`: Kiểm tra độ chính xác của thuật toán Rollup % và bộ lọc đa tiêu chí.
  3. `tests/dashboard-api.test.ts`: Kiểm tra endpoint `/api/dashboard/overview`, tính toàn vẹn của dataset 304/920.
  4. `tests/executive-stat-strip.test.ts`: Kiểm tra tính toán 4 thẻ số liệu KPI.
  5. `tests/cascading-task-table.test.ts`: Kiểm tra bung nở Accordion và màu huy hiệu trạng thái.
  6. `tests/dashboard-widgets.test.ts`: Kiểm tra logic hạn chót 7 ngày và dòng hoạt động.
  7. `tests/task-detail-sheet.test.ts`: Kiểm tra type guard và ngăn kéo chi tiết.
  8. `tests/dashboard-integration.test.ts`: Kiểm tra tích hợp trang chủ.
  9. `tests/create-task-modal.test.ts`: Kiểm tra form validation tạo việc.
  10. `tests/task-kanban.test.ts`: Kiểm tra phân bổ 4 cột Kanban và chuyển trạng thái.
  11. `tests/calendar-view.test.ts`: Kiểm tra tạo lưới lịch 35/42 ô và mapping sự kiện.
  12. `tests/organization-tree.test.ts`: Kiểm tra cấu trúc 11 đơn vị và thuật toán tìm kiếm cán bộ.
  13. `tests/sprint2-integration.test.ts`: Kiểm tra liên kết toàn bộ 10 route của dự án.
* **TypeScript Strict Check:** `tsc --noEmit` đạt **0 lỗi / 0 cảnh báo**.
* **Next.js Production Build:** Hoàn tất trong **866ms**, toàn bộ các route tĩnh và động được sinh mã tối ưu.

---

## 9. Bảo mật, Triển khai & Lộ trình Nâng cấp (Roadmap)

### 9.1. An toàn & Bảo mật Dữ liệu
* Toàn bộ mã nguồn không chứa bất kỳ chuỗi token hoặc mật khẩu nhạy cảm nào (được quản lý hoàn toàn qua biến môi trường `NOTION_TOKEN`).
* Hệ thống hoạt động tốt sau reverse proxy, bảo vệ header HTTP và chống tấn công XSS thông qua cơ chế escape tự động của React 19.

### 9.2. Triển khai & Vận hành
* Máy chủ chạy ổn định tại cổng `3000` (được cấu hình qua `.claude/launch.json` với lệnh `npm run start`).
* Tương thích hoàn hảo với Docker container hóa, Vercel, hoặc hệ thống máy chủ nội bộ của Trường Cao đẳng Kinh tế - Kỹ thuật Cần Thơ.

### 9.3. Lộ trình Phát triển Tiếp theo (Sprint 3)
1. **Phân hệ Quản lý Văn bản & Trình ký (`E-Document`):** Tiếp nhận công văn đến, dự thảo công văn đi và luồng phê duyệt văn bản số.
2. **Ký số Điện tử (`Digital Signature`):** Tích hợp chứng thư số cá nhân/tổ chức vào tệp PDF quyết định giao việc.
3. **Hệ thống Thông báo Đẩy (`Web Push & Zalo ZNS`):** Nhắc việc tự động khi nhiệm vụ sắp đến hạn (còn 3 ngày, 1 ngày hoặc quá hạn).
