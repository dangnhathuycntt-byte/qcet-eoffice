# Đặc Tả Kỹ Thuật: Executive Department Command Center (Trung Tâm Chỉ Huy Đơn Vị Ban Giám Hiệu)

**Ngày lập:** 2026-09-06  
**Trạng thái:** Được phê duyệt  
**Đường dẫn tham chiếu:** `?zone=tasks`  
**Chuẩn tham chiếu:** Stanford Authority Manager, Workday Higher Ed Supervisory Organizations, HigherED360, Lucid UQ

---

## 1. Bối Cảnh & Mục Tiêu Nghiệp Vụ

### 1.1 Vấn Đề
Trước đây, khi Hiệu trưởng truy cập phân khu Giao việc & Nhiệm vụ (`?zone=tasks`), giao diện đổ hàng trăm dòng nhiệm vụ phẳng (flat tasks) của tất cả chuyên viên, giảng viên. Điều này gây ra hiện tượng quá tải thông tin (information overload) và không trả lời được 3 câu hỏi cốt lõi của Ban Giám hiệu:
1. Từng Khoa/Phòng đang làm nhiệm vụ trọng tâm gì tuần này/tháng này?
2. Đơn vị nào đang có điểm nghẽn hoặc nguy cơ trễ hạn cần BGH can thiệp/chỉ đạo gấp?
3. Có công việc nào đang tắc ở khâu chờ phê duyệt của Ban Giám hiệu không?

### 1.2 Mục Tiêu Thiết Kế
Thiết lập **Executive Department Command Center** làm chế độ xem mặc định cho Hiệu trưởng (`role === "ADMIN"`):
- Thay thế bảng phẳng bằng lưới 12 Thẻ Chỉ Huy Đơn Vị (Department Command Cards).
- Tự động trích xuất 1 Việc Trọng Tâm (Focus Initiative) cho mỗi đơn vị.
- Cung cấp bộ 3 lăng kính điều hành (Tất cả, Điểm nghẽn cần BGH chỉ đạo, Chờ BGH ký duyệt).
- Drill-down xem chi tiết nhiệm vụ của từng Khoa/Phòng chỉ với 1 cú click, không làm loãng dữ liệu toàn trường.

---

## 2. Mô Hình Dữ Liệu & Bộ Chuyển Đổi (Data Model & Logic)

### 2.1 Cấu Trúc Types (`src/types/executive-command.ts`)

```typescript
export type ExecutiveRAGStatus = "RED" | "AMBER" | "GREEN";

export type ExecutiveTriageFilter = "ALL" | "BOTTLENECKS" | "PENDING_APPROVAL";

export interface FocusInitiative {
  taskId: string;
  title: string;
  dueDate: string;
  progressPercent: number;
  priority: "HIGH" | "MEDIUM" | "LOW";
  categoryLabel?: string;
}

export interface ExecutiveDepartmentSummary {
  departmentId: string;
  departmentCode: string;
  departmentName: string;
  headOfDepartment: {
    name: string;
    title: string;
    email?: string;
  };
  ragStatus: ExecutiveRAGStatus;
  ragReason?: string;
  focusInitiative?: FocusInitiative;
  metrics: {
    totalTasks: number;
    inProgress: number;
    dueSoon: number; // Deadline <= 3 ngày
    overdue: number;
    completed: number;
    completionRate: number; // 0 - 100
  };
  pendingApprovalCount: number;
  schoolLevelTaskCount: number;
  unitLevelTaskCount: number;
  tasks: SchoolTask[];
}
```

### 2.2 Quy Tắc Đánh Giá RAG (Red - Amber - Green)
1. **RED (Báo động đỏ):**
   - Đơn vị có ít nhất 1 nhiệm vụ quá hạn (`overdue > 0`), HOẶC
   - Tỷ lệ hoàn thành trung bình `< 35%` khi đã quá 50% thời gian chu kỳ.
2. **AMBER (Cần lưu ý):**
   - Không có việc quá hạn nhưng có nhiệm vụ sắp đến hạn (`dueSoon > 0`), HOẶC
   - Tỷ lệ hoàn thành trung bình dao động từ `35%` đến dưới `60%`.
3. **GREEN (Bình thường):**
   - Không có vi���c quá hạn, không có nguy cơ sát hạn khẩn cấp, tiến độ `≥ 60%`.

### 2.3 Tiêu Chí Trích Xuất Việc Trọng Tâm (Focus Initiative)
Hàm pure `computeExecutiveDepartmentSummaries` quét qua danh sách nhiệm vụ của đơn vị:
- Ưu tiên 1: Nhiệm vụ Cấp Trường có trọng số ưu tiên cao nhất (`priority === "HIGH"`).
- Ưu tiên 2: Nhiệm vụ có deadline gần nhất trong tương lai mà chưa hoàn thành.
- Nếu không có nhiệm vụ nào đang mở: Trích xuất nhiệm vụ hoàn thành gần nhất.

---

## 3. Kiến Trúc Giao Diện Người Dùng (UI Architecture)

### 3.1 Component Hierarchy
```
src/components/tasks/executive-department-command-center.tsx
├── ExecutiveQuickTriageBar (3 Tabs: Tất cả | Điểm nghẽn BGH | Chờ BGH duyệt)
├── DepartmentCommandCardsGrid (Lưới 12 thẻ Khoa/Phòng responsive)
│   └── DepartmentCommandCard (Thẻ đơn vị cá nhân hóa)
│       ├── Header: Tên đơn vị, Avatar Trưởng đơn vị, RAG Badge
│       ├── Focus Initiative Callout Box: Tên việc lớn nhất, deadline
│       ├── Mini Metric Strip: Đang làm | Sắp hạn | Trễ hạn
│       └── Action Footer: Nút "Soi chi tiết đơn vị"
└── DepartmentDrillDownDrawer / InlinePanel (Bung bảng việc riêng của đơn vị khi được chọn)
```

### 3.2 Tích Hợp Vào `src/app/page.tsx`
- Khi `activeZone === "tasks"` và `user.role === "ADMIN"`:
  - Hiển thị nút chuyển đổi `Executive View` vs `Standard View` trên thanh toolbar.
  - Mặc định khởi tạo view `ExecutiveDepartmentCommandCenter`.
  - Hiệu trưởng có thể bấm xem chi tiết từng đơn vị hoặc quay lại tổng thể mọi lúc.

---

## 4. Tiêu Chuẩn Kỹ Thuật & Anti-Slop (Quality Standards)

1. **0% Decorative Emoji:** Toàn bộ biểu tượng sử dụng thư viện `lucide-react` ngữ nghĩa (`Building2`, `AlertTriangle`, `CheckCircle2`, `Clock`, `ArrowUpRight`, `ShieldAlert`).
2. **Icon Stroke Width:** Toàn bộ icon đặt chính xác `strokeWidth={1.5}`.
3. **Typography Số Liệu:** Mọi con số (tiến độ %, số task, ngày tháng) bắt buộc khai báo `font-mono tabular-nums`.
4. **Không Hardcode Color:** Sử dụng semantic CSS classes (`bg-destructive/10 text-destructive`, `bg-amber-500/10 text-amber-600 dark:text-amber-400`, `bg-primary/10 text-primary`).
5. **SSR Safe & Dynamic Import:** Lazy loading component chỉ huy để đảm bảo thời gian tải trang ban đầu $\le 150ms$.

---

## 5. Kế Hoạch Kiểm Thử Tự Động (Automated Testing)

1. **Unit Tests (`tests/executive-department-aggregator.test.ts`):**
   - Đảm bảo tính toán RAG chuẩn xác với các tập dữ liệu giả lập (overdue, dueSoon, on-track).
   - Kiểm thử thuật toán trích xuất Việc trọng tâm (Focus Initiative).
2. **Integration & Anti-Slop Audit Tests (`tests/executive-department-command-center.test.ts`):**
   - Xác thực render đủ 12 đơn vị và xử lý lọc theo 3 lăng kính điều hành.
   - Quét mã nguồn để đảm bảo không chứa emoji trang trí và icon tuân thủ `strokeWidth={1.5}`.
