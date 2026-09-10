# ĐẶC TẢ KIẾN TRÚC KỸ THUẬT & TRẢI NGHIỆM: PHÂN VÙNG TOÀN DI��N THEO THÁNG
**Mã tài liệu:** SPEC-2026-09-09-MONTHLY-ENGINE  
**Ngày phê duyệt:** 09/09/2026  
**Phân hệ áp dụng:** Bàn làm việc (Desk/Workspace), Lịch làm việc (Calendar), Quản lý nhiệm vụ (Tasks Hub), Văn bản & Hồ sơ (Documents)  
**Tiêu chuẩn kỹ thuật:** Next.js 15+ (App Router), Tailwind CSS v4 (Light-Only OKLCH), React 19 Concurrent Features, Prisma ORM, QCET Operational Academic Calendar Engine.

---

## I. TỔNG QUAN & BỐI CẢNH KIẾN TRÚC

### 1.1. Thực trạng hệ thống trước khi cải tổ
Qua khảo sát và kiểm toán kiến trúc trên toàn bộ mã nguồn:
1. **Bàn làm việc (Dashboard Zone / Desk):**
   - Các khối `displayedStats` (KPI strip) và `departmentHealth` (Ma trận tiến độ 11 đơn vị) hiện đang gọi thẳng vào mảng `tasks` gốc không có giới hạn thời gian, dẫn đến việc số liệu hiển thị là lũy kế vô hạn thay vì phản ánh tình trạng vận hành thực tế của tháng hiện hành.
   - Lãnh đạo không thể chuyển đổi xem hiệu suất của Tháng 9 so với Tháng 10 hoặc các tháng trước.
2. **Lịch làm việc (Calendar Zone):**
   - Lưới lịch tháng (`CalendarMonthView`) đang hoạt động độc lập, chưa có sự liên kết hai chiều chặt chẽ với trạng thái tháng toàn cục.
3. **Quản lý nhiệm vụ (Tasks Hub):**
   - Đã có cơ chế lọc tháng sơ khởi trong `unified-task-hub.ts`, nhưng bộ điều khiển tháng bị giấu sâu trong toolbar mở rộng, thiếu thanh dải 12 tháng trực quan (12-month strip), và còn xảy ra hiện tượng rò rỉ nhiệm vụ con (subtasks) vắt qua nhiều tháng.
4. **Văn bản & Hồ sơ (Documents):**
   - Chưa hỗ trợ nhóm hoặc lọc theo chu kỳ tháng phát hành / tiếp nhận.

### 1.2. Mục tiêu kiến trúc (Architectural North Star)
Xây dựng **Hệ điều hành Thời gian Vận hành (QCET Operational Time Engine)** đưa Tháng trở thành **chiều dữ liệu thứ nhất (First-Class Dimension)** xuyên suốt toàn bộ ứng dụng:
- **Đồng bộ toàn cục (Single Source of Truth):** Chọn tháng tại thanh Topbar hoặc bất kỳ phân hệ nào thì toàn bộ hệ thống (Bàn làm việc, Lịch, Nhiệm vụ, Văn bản) đều đồng bộ hiển thị tương ứng.
- **Tuân thủ Chu kỳ Vận hành QCET (25 - 24):** Tháng $M$ bắt đầu từ ngày 25 tháng $M-1$ đến hết ngày 24 tháng $M$.
- **Bảo toàn công việc tồn đọng (Zero Overdue Loss):** Đảm bảo việc quá hạn từ tháng trước không bị giấu nhẹm khi xem tháng sau.
- **Tốc độ chuyển đổi tức thì (Sub-16ms Instant Month Switching):** Sử dụng cấu trúc Bucket Indexing phía client để đổi tháng mượt mà 60 FPS không giật lag.

---

## II. QUY CHUẨN THỜI GIAN VẬN HÀNH QCET (OPERATIONAL TIME ENGINE)

### 2.1. Cấu trúc Chu kỳ Tháng & Năm học
Quy chuẩn đào tạo và hành chính của QCET chia năm học thành 12 tháng vận hành theo thứ tự:
$$\text{Academic Months} = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8]$$

Mỗi tháng vận hành $M$ có cận thời gian nghiêm ngặt:
- **Ngày bắt đầu ($startDate_M$):** `YYYY-MM-25` (ngày 25 của tháng liền trước) lúc `00:00:00.000` (UTC+7).
- **Ngày kết thúc ($endDate_M$):** `YYYY-MM-24` (ngày 24 của tháng $M$) lúc `23:59:59.999` (UTC+7).
- **Năm học ($academicYear$):** Ví dụ `2026-2027` kéo dài từ `2026-08-25` đến `2027-08-24`.

```
                  CHỦ KỲ NĂM HỌC QCET 2026 - 2027
2026-08-25                                                    2027-08-24
    │                                                             │
    ▼                                                             ▼
┌────────┬────────┬────────┬────────┬───────┬───────┬─────┬��──────┐
│Tháng 9 │Tháng 10│Tháng 11│Tháng 12│Tháng 1│Tháng 2│ ... │Tháng 8│
└────────┴────────┴────────┴────────┴───────┴───────┴─────┴───────┘
 (25/08 - (25/09 - (25/10 - (25/11 - (25/12 - (25/01 -        (25/07 -
  24/09)   24/10)   24/11)   24/12)   24/01)   24/02)         24/08)
```

### 2.2. Quy tắc phân định nhiệm vụ vào tháng
Một nhiệm vụ thuộc tháng $M$ khi thỏa mãn một trong các điều kiện:
1. **Nhiệm vụ cấp trường / cha:** Hạn hoàn thành chính thức `dueDate` nằm trong $[startDate_M, endDate_M]$.
2. **Nhiệm vụ đơn vị / con (Subtask):** Có `dueDate` con nằm trong $[startDate_M, endDate_M]$.
3. **Nhiệm vụ kéo dài qua nhiều tháng (Multi-month Spanning):** `startDate <= endDate_M` và `dueDate >= startDate_M`. Trong tháng $M$, chỉ hiển thị các mốc giao nộp (Deliverables) hoặc công việc con có hạn trong tháng $M$.
4. **Nhiệm vụ quá hạn chưa hoàn thành (Carryover Overdue):** Nếu nhiệm vụ có `dueDate < startDate_M` và trạng thái khác `COMPLETED`, nhiệm vụ sẽ được gom vào nhóm **"Tồn đọng kỳ trước" (Prior Overdue Backlog)** với huy hiệu cảnh báo riêng, không bị ẩn đi.

---

## III. THIẾT KẾ TRẢI NGHIỆM NGƯỜI DÙNG (UI/UX BLUEPRINT)

### 3.1. Bộ chọn thời gian toàn cục trên App Topbar (Global Temporal Selector)
Nằm ngay cạnh `ScopeSwitcher` (Trường / Đơn vị / Cá nhân) trên Topbar của hệ thống.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [≡] 🏛️ QCET E-OFFICE  │ [🏛️ Toàn trường ▾]  [📅 Tháng 9 (25/08 - 24/09) ▾] │  [🔍] [🔔] [👤]│
└─────────────────────────────────────────────┬──────────────────────────────────────────┘
                                              │
               ┌──────────────────────────────▼────────────────────────────────┐
               │ 📅 KỲ VẬN HÀNH HỌC THUẬT: 2026 - 2027                         ���
               │ [ Hiện tại: Tháng 9 ]  [ Xem cả năm ]                         │
               ├───────────────────────────────────────────────────────────────┤
               │ Học kỳ I:                                                     │
               │  [T9 (25/08-24/09) • 24 việc]  [T10 (25/09-24/10) • 18 việc] │
               │  [T11 (25/10-24/11) • 12 việc] [T12 (25/11-24/12) • 31 việc] │
               │ Học kỳ II:                                                    │
               │  [T1 (25/12-24/01) • 9 việc]   [T2 (25/01-24/02) • 14 việc]  │
               │  [T3 (25/02-24/03) • 22 việc]  [T4 (25/03-24/04) • 19 việc]  │
               │  [T5 (25/04-24/05) • 16 việc]                                 │
               │ Học kỳ Hè / Tổng kết:                                         │
               │  [T6 (25/05-24/06)]  [T7 (25/06-24/07)]  [T8 (25/07-24/08)]   │
               └───────────────────────────────────────────────────────────────┘
```

- **Trên Mobile:** Thu gọn thành icon lịch kèm chip nhỏ: `[📅 T9]`. Chạm vào mở Bottom Sheet chọn tháng chuyên dụng.

---

### 3.2. Bàn làm việc theo Tháng (Desk / Dashboard Zone)
Toàn bộ số liệu KPI, hàng đợi phê duyệt và ma trận đơn vị co giãn theo tháng đã chọn:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ BÀN LÀM VIỆC ĐIỀU HÀNH • THÁNG 9/2026 (25/08 - 24/09)                                  │
│ Đang hiển thị kết quả vận hành kỳ Tháng 9 • 11 Đơn vị trực thuộc                      │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐               │
│ │ VIỆC TRONG T9 │ │ HOÀN THÀNH T9 │ │ TRỄ HẠN TRONG T9│ │ CẦN DUYỆT T9 │               │
│ │     24        │ │   18 (75%)    │ │    2 (8.3%)     │ │      4        │               │
│ │ ↑ 12% so T8   │ │ Mục tiêu: 80% │ │ [Xem việc trễ]  │ │ Chờ BGH duyệt │               │
│ └───────────────┘ └───────────────┘ └───────────────┘ └───────────────┘               │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ ⚠️ CẢNH BÁO TỒN ĐỌNG KỲ TRƯỚC (PRIOR BACKLOG): 3 nhiệm vụ trễ hạn từ Tháng 8 [Xử lý]   │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 🏢 MA TRẬN TIẾN ĐỘ 11 ĐƠN VỊ TRONG THÁNG 9                                             │
│ Đơn vị            Tổng việc   Hoàn thành   Trễ hạn   Tiến độ TB   Tình trạng           │
│ ─────────────────────────────────────────────────────────────────────────────          │
│ P. Đào tạo & QLKH    8            6           0         88%       🟢 Tốt               │
│ P. TCHC - Quản trị   5            4           1         72%       🟡 Chậm 1 việc       │
│ Khoa CNTT            6            5           0         91%       🟢 Tốt               │
│ Khoa Kinh tế         5            3           1         65%       🔴 Cần đôn đốc       │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 3.3. Lịch làm việc theo Tháng (Calendar Zone)
- Lưới lịch nhảy trực tiếp đến tháng được chọn từ Topbar.
- Header lịch trang bị thanh chuyển tháng nhanh `[◄ Tháng trước] [Tháng 9 / 2026] [Tháng sau ►]`.
- Nút `[Về tháng hiện tại]` giúp điều hướng tức thì.
- Hiển thị ranh giới chu kỳ: Ô ngày 25/08 đến 24/09 được highlight viền nét liền, các ngày thuộc chu kỳ khác được mờ hóa dịu nhẹ.

---

### 3.4. Quản lý nhiệm vụ theo Tháng (Tasks Hub)
Trang bị **Thanh trượt dải 12 tháng tương tác (Interactive 12-Month Strip)** cố định ngay trên bảng nhiệm vụ:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [ Tất cả (180) ] [ T9 (24) ]* [ T10 (18) ] [ T11 (12) ] [ T12 (31) ] ... [ T8 (10) ]   │
└────────────────────────────────────────────────────────────────────────────────────────┘
  * Đang chọn Tháng 9 (25/08 - 24/09)

  [🔍 Tìm kiếm việc...]  [Trạng thái ▾]  [Phòng ban ▾]  [Chế độ: Bảng ▾]  [+ Tạo việc mới]

┌────────────────────────────────────────────────────────────────────────────────────────┐
│ NHIỆM VỤ THUỘC THÁNG 9/2026 (24 Nhiệm vụ)                                              │
│ ┌───────────────────────────────────────────────────────────���────────────────────────┐ │
│ │ 📌 Đợt tuyển sinh và khai giảng năm học mới 2026 - 2027              Hạn: 15/09/2026│ │
│ │    Đơn vị: P. Đào tạo & QLKH • Tiến độ: 85% • [COMPLETED]                          │ │
│ │    ├─ Chuẩn bị hồ sơ tân sinh viên (Hạn: 05/09) ────── [Xong]                      │ │
│ │    └─ Tổ chức lễ khai giảng tập trung (Hạn: 15/09) ─── [Đang làm]                  │ │
│ └────────────────────────────────────────────────────────────────────────────────────┘ │
│ ┌────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ 📌 Kiểm định chất lượng CTĐT chuyên ngành CNTT                      Hạn: 22/09/2026│ │
│ │    Đơn vị: Khoa CNTT & KTĐBCL • Tiến độ: 60% • [IN_PROGRESS]                       │ │
│ └────────────────────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## IV. KIẾN TRÚC KỸ THUẬT & HỢP ĐỒNG DỮ LIỆU (TECHNICAL ARCHITECTURE)

### 4.1. Quản lý Trạng thái & Đồng bộ URL
Trạng thái tháng được phản chiếu vào URL SearchParams làm chuẩn mực lưu vết:
- URL Contract: `/?zone=dashboard&month=9&year=2026-2027&scope=school&dept=ALL`
- Hỗ trợ giá trị đặc biệt: `month=ALL` hoặc `month=CURRENT` (tự tính ra tháng hiện tại).
- Lưu cấu hình ưu tiên người dùng vào `localStorage.getItem("qcet_selected_academic_month")` để duy trì khi mở phiên làm việc mới.

### 4.2. Cấu trúc Bucket Indexing (Zero-Lag Performance)
Để việc bấm chuyển tháng phản hồi ngay lập tức trong vòng **< 16ms** mà không phải lọc lại mảng hàng ngàn tác vụ:
1. Khi nạp dữ liệu nhiệm vụ lần đầu (`tasks`), thực hiện băm trước (pre-index) vào một `Map<monthNumber, TaskBucket>`:
   ```typescript
   export interface MonthPartitionBucket {
     monthNumber: number;
     period: AcademicMonthPeriod;
     tasks: SchoolTask[];
     stats: DashboardStats;
     departmentHealth: DepartmentHealthSummary[];
     executiveStats: ExecutiveActionStats;
     upcoming: UpcomingItem[];
     priorOverdueBacklog: SchoolTask[];
   }
   ```
2. Khi người dùng click chọn Tháng 9 -> Tháng 10, ứng dụng chỉ việc đọc từ bộ nhớ `Map.get(10)` với độ phức tạp $O(1)$.
3. Áp dụng `React.startTransition` khi cập nhật URL để giao diện chuyển đổi mượt mà và không block khung hình người dùng.

---

## V. CHIẾN LƯỢC PHÒNG NGỪA RỦI RO & CA BIÊN (ADVERSARIAL DEFENSE)

| Ca biên / Rủi ro | Nguy cơ | Giải pháp kỹ thuật chuẩn mực |
|---|---|---|
| **1. Quá hạn kỳ trước** | Chọn Tháng 10 sẽ bỏ sót các việc trễ hạn nghiêm trọng của Tháng 9. | Bổ sung Banner/Accordion "Tồn đọng kỳ trước" (`priorOverdueBacklog`) luôn ghim đầu trang khi có việc trễ chưa đóng. |
| **2. Việc vắt qua nhiều tháng** | Bắt đầu T9, hoàn thành T11: dễ bị tính trùng hoặc biến mất ở T10. | Phân giải theo mốc giao nộp: Nhiệm vụ cha hiển thị ở mọi tháng nằm trong khoảng `[startDate, dueDate]`, nhưng số liệu KPI của tháng chỉ tính các sản phẩm giao nộp (`deliverables`) và việc con có hạn trong tháng đó. |
| **3. Lệch múi giờ UTC vs UTC+7** | Ngày 25/08 ở UTC có thể rơi vào 24/08 lúc 17:00, làm sai lệch phân loại tháng. | Toàn bộ chuỗi ngày giờ được chuẩn hóa qua `parseDateParts` cố định múi giờ Việt Nam (+07:00), không dùng hàm `getUTCDay()`. |
| **4. Ranh giới Năm học** | Chuyển từ Tháng 8 (cuối năm cũ) sang Tháng 9 (đầu năm mới). | Tự động tính toán lại giá trị `academicYear` khi tháng được chọn thuộc chu kỳ mới (VD: tháng 9 sẽ mang year `2026-2027`, tháng 8 mang year `2025-2026`). |

---

## VI. LỘ TRÌNH TRIỂN KHAI MÃ NGUỒN (ACTIONABLE ROADMAP)

1. **Giai đoạn 1: Tầng lõi Thời gian & Bộ lọc (Core Engine & Data Layer)**
   - Cập nhật `src/lib/academic-calendar.ts`: Bổ sung helper phân loại nhiệm vụ vắt nhiều tháng và tính toán `priorOverdueBacklog`.
   - Cập nhật `src/hooks/use-task-filters.ts`: Đồng bộ `displayedStats`, `departmentHealth`, `executiveStats` với `selectedAcademicMonth`.
2. **Giai đoạn 2: Điều hướng & Topbar (Global Navigation)**
   - Xây dựng component `GlobalMonthSelector` tích hợp vào `src/components/layout/app-topbar.tsx` cạnh `ScopeSwitcher`.
   - Hỗ trợ BottomSheet trên mobile.
3. **Giai đoạn 3: Bàn làm việc & Lịch công tác (Desk & Calendar Sync)**
   - Cập nhật `DashboardZone`: Hiển thị KPI, cảnh báo việc tồn đọng và ma trận phòng ban theo tháng.
   - Cập nhật `CalendarZone`: Đồng bộ trực tiếp với `selectedAcademicMonth`.
4. **Giai đoạn 4: Quản lý nhiệm vụ (Tasks Hub)**
   - Tích hợp thanh trượt 12 tháng `MonthStripSelector` vào đầu trang Quản lý nhiệm vụ.
   - Hoàn thiện chế độ hiển thị Bảng và Kanban chia theo tháng.
5. **Giai đoạn 5: Kiểm thử tự động (QA & Typecheck)**
   - Viết test suite kiểm tra độ chính xác của bộ tính toán theo tháng.
   - Chạy `npm run typecheck` và `npm test` bảo đảm 100% xanh.
