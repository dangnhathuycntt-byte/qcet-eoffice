# ĐẶC TẢ KIẾN TRÚC & THIẾT KẾ: KHÔNG GIAN LÀM VIỆC THỐNG NHẤT THÍCH ỨNG (UNIFIED ADAPTIVE WORKSPACE)
**Dự án:** QCET E-Office (Hệ thống Điều hành & Quản lý Nhiệm vụ Trường CĐ Kỹ thuật Công nghệ Quy Nhơn)  
**Tài liệu:** Product & Technical Architecture Specification  
**Ngày:** 2026-09-08  
**Tác giả:** Principal Product Architect & UX Specialist  
**Trạng thái:** Sẵn sàng phê duyệt & Triển khai (Approved for Implementation)  

---

## 1. TỔNG QUAN & BỐI CẢNH VẤN ĐỀ (PROBLEM STATEMENT)

### 1.1 Hiện trạng & Vấn đề Cốt lõi
Hệ thống hiện tại đang duy trì 3 giao diện (Workspace) độc lập:
1. `ExecutiveCockpitWorkspace.tsx` (Dành riêng cho Ban Giám hiệu - ADMIN)
2. `DepartmentManagerWorkspace.tsx` (Dành riêng cho Lãnh đạo Đơn vị - MANAGER)
3. `LecturerFocusWorkspace.tsx` (Dành riêng cho Giảng viên/Chuyên viên - STAFF)

Mô hình này xuất phát từ ý định ban đầu là "tối ưu riêng cho từng vai trò", nhưng trong thực tế vận hành tại môi trường giáo dục cao đẳng/đại học công lập, nó bộc lộ **4 nghịch lý nghiêm trọng**:

1. **Nghịch lý "Vai trò kép & Kiêm nhiệm" (Dual-Role Faculty Friction)**:
   - Trong trường học, Trưởng khoa và Phó Hiệu trưởng bản chất vẫn là Giảng viên (vẫn tham gia giảng dạy, biên soạn giáo trình, nghiên cứu khoa học và chịu trách nhiệm trước các công việc cá nhân).
   - Khi chia làm 3 portal riêng, một Trưởng khoa muốn nộp giáo án phải đổi sang giao diện Giảng viên; muốn duyệt việc cấp dưới lại phải chuyển sang giao diện Quản lý. Sự chuyển đổi ngữ cảnh liên tục (*Context-switching Fatigue*) làm giảm hiệu suất và gây ức chế lớn.
2. **Gãy đổ luồng liên kết sâu & Cộng tác (Deep-linking Breakdown)**:
   - Khi cán bộ gửi link nhiệm vụ qua Zalo, Email hoặc Teams, người nhận thuộc vai trò khác dễ gặp lỗi phân quyền hoặc bị đẩy về màn hình mặc định của role đó, làm mất ngữ cảnh công việc toàn trường.
3. **Phá vỡ mô hình tư duy tổ chức (Broken Mental Model)**:
   - Thay vì thúc đẩy văn hóa minh bạch (Radical Transparency), việc cô lập BGH trong "phòng điều khiển kín" và nhốt Giảng viên trong "góc cá nhân hẹp" tạo ra khoảng cách hành chính quan liêu và rào cản thông tin giữa các cấp.
4. **Nợ kỹ thuật & Phình to Codebase (Code Bloat & Multiplicity)**:
   - 3 workspace chiếm hơn **4.200 dòng code**, trong đó hơn 80% logic bảng việc, bộ lọc tháng học, modal nộp minh chứng, thanh tiến độ bị sao chép lặp lại (vi phạm nguyên tắc DRY). Mọi thay đổi về quy chế DACUM hay Nghị định 232 đều phải cập nhật ở cả 3 nơi.

### 1.2 Giải pháp Đột phá: "Role as a Lens, NOT a Destination"
Học tập từ các sản phẩm B2B SaaS đỉnh cao thế giới (Linear, Asana, Notion, ServiceNow SOW), QCET E-Office sẽ chuyển đổi toàn bộ sang kiến trúc **Single Canvas with Adaptive Views (Một không gian làm việc thống nhất với các góc nhìn thích ứng)**.

---

## 2. NGUYÊN TẮC THIẾT KẾ CỐT LÕI (CORE PRINCIPLES)

```
┌────────────────────────────────────────────────────────────────────────┐
│              KIẾN TRÚC GIAO DIỆN THỐNG NHẤT THÍCH ỨNG                  │
│                                                                        │
│   [ Scope Switcher ]: (•) Toàn trường   ( ) Đơn vị   ( ) Việc của tôi  │
├────────────────────────────────────────────────────────────────────────┤
│  1. ADAPTIVE METRIC STRIP (4 thẻ KPI tự động tính toán theo Scope)     │
├────────────────────────────────────────────────────────────────────────┤
│  2. UNIVERSAL ACTION QUEUE (Hàng đợi hành động 2 làn):                 │
│     - Làn 1: Cần tôi phê duyệt (Dành cho Lãnh đạo / Người ủy quyền)   │
│     - Làn 2: Cần tôi nộp minh chứng / Báo cáo (Dành cho Cá nhân)       │
├────────────────────────────────────────────────────────────────────────┤
│  3. UNIFIED TASK CANVAS (Cùng 1 Bảng phân tầng / Kanban):              │
│     - Nút "Duyệt nhanh" / "Đôn đốc" xuất hiện tại chỗ theo quyền hạn   │
│     - Cùng 1 hệ thống phím tắt J/K/X/A/S                               │
│     - Cùng 1 Side-sheet thẩm định minh chứng chuẩn Nghị định 232       │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Single Canvas (Một hệ khung duy nhất)**: Toàn bộ cán bộ, từ Hiệu trưởng đến Giảng viên trẻ, đều làm việc trên cùng một cấu trúc trang, cùng hệ thống bảng công việc phân tầng.
2. **Scope as a Filter (Phạm vi là bộ lọc)**: Chuyển đổi giữa 3 góc nhìn chỉ bằng một thanh trượt 3 nấc (*Segmented Scope Switcher*):
   - `Toàn trường (School Scope)`: Bức tranh chiến lược 11 đơn vị (Mặc định cho BGH).
   - `Đơn vị (Unit Scope)`: Điều phối công việc phòng/khoa nội bộ (Mặc định cho Trưởng đơn vị).
   - `Việc của tôi (My Focus Scope)`: Tập trung vào các việc cá nhân hôm nay (Mặc định cho Giảng viên).
3. **Contextual Action In-Place (Hành động theo thẩm quyền tại chỗ)**: Quyền hạn quyết định hành động khả dụng tại chỗ, không quyết định trang đích.
4. **Progressive Disclosure (Tiết lộ tăng dần)**: Mặc định tối giản hóa; người dùng có thể mở rộng để xem sâu cây phụ thuộc cha - con khi cần.

---

## 3. ĐẶC TẢ THÀNH PHẦN KIẾN TRÚC (COMPONENT ARCHITECTURE)

### 3.1 Cấu trúc Thư mục Mới
```
src/components/workspace/
├── unified-adaptive-workspace.tsx             # Entry point duy nhất thay thế 3 workspace cũ
├── components/
│   ├── adaptive-scope-header.tsx              # Header tích hợp Segmented Scope Switcher
│   ├── adaptive-metric-strip.tsx              # 4 thẻ chỉ số thích ứng tự động theo Scope
│   ├── universal-action-queue.tsx             # Hàng đợi 2 làn: Cần tôi duyệt vs Cần tôi nộp
│   ├── unified-task-canvas.tsx                # Canvas hiển thị (Table phân tầng / Kanban)
│   ├── inplace-dacum-actions.tsx              # Nút Duyệt, Đôn đốc, Nộp minh chứng tại chỗ
│   └── dacum-review-drawer.tsx                # Drawer thẩm định minh chứng chuẩn Nghị định 232
└── hooks/
    ├── use-adaptive-workspace-data.ts         # Hook gom dữ liệu, lọc theo scope và vai trò
    └── use-inplace-dacum-actions.ts           # Hook xử lý duyệt 1 chạm, nộp minh chứng, đôn đốc
```

### 3.2 Đặc tả Interface TypeScript Cốt lõi

```typescript
// src/components/workspace/types.ts
import type { AuthUser, UserRole } from "@/types/auth";
import type { SchoolTask, StaffTask, TaskStatus } from "@/types/dashboard";
import type { DeliverableSubmissionPayload, ApprovalActionPayload } from "@/types/workspace";

export type WorkspaceScope = "school" | "unit" | "my";

export interface ScopeConfig {
  id: WorkspaceScope;
  label: string;
  badgeCount?: number;
  description: string;
}

export interface AdaptiveWorkspaceMetrics {
  totalTasks: number;
  urgentOverdueCount: number;
  waitingApprovalCount: number;
  completedRate: number;
  labelScope: string;
}

export interface UnifiedAdaptiveWorkspaceProps {
  user: AuthUser;
  tasks: SchoolTask[];
  initialScope?: WorkspaceScope;
  selectedDepartment?: string;
  onSelectTask: (task: SchoolTask | StaffTask) => void;
  onReview?: (payload: ApprovalActionPayload) => Promise<void> | void;
  onSubmitDeliverable?: (payload: DeliverableSubmissionPayload) => Promise<void> | void;
  onStatusChange?: (taskId: string, status: TaskStatus, note?: string) => void;
  onSendReminder?: (targetDeptOrUser: string, reason: string) => void;
  onCreateTask?: (level: "TRUONG" | "DON_VI", parentTaskId?: string) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}
```

---

## 4. CHI TIẾT CÁC PHÂN HỆ GIAO DIỆN (UI/UX SPECIFICATIONS)

### 4.1 Thanh Điều Hướng Phạm Vi (`AdaptiveScopeHeader`)
- **Vị trí**: Nằm cố định ngay dưới thanh Header chính, trên cùng của Workspace.
- **Cấu trúc**:
  - Bên trái: Tiêu đề động kèm breadcrumb chức vụ (`Ban Giám hiệu` / `Khoa Công nghệ Thông tin` / `Cá nhân`).
  - Ở giữa: **Segmented Control 3 nấc**:
    - Nấc 1: `Toàn trường` (Chỉ hiện khi `role === "ADMIN"` hoặc có quyền thanh tra).
    - Nấc 2: `Khoa CNTT` (Tự động hiển thị tên đơn vị của người dùng).
    - Nấc 3: `Của tôi` (Kèm badge đếm số việc cần xử lý hôm nay).
  - Bên phải: Nút tạo nhiệm vụ nhanh (`+ Giao nhiệm vụ`) & nút Làm mới (`Refresh`).

### 4.2 Dải Chỉ Số Thích Ứng (`AdaptiveMetricStrip`)
Tự động tính toán lại giá trị theo `activeScope`:

| Thẻ Chỉ Số | Scope: Toàn trường | Scope: Đơn vị | Scope: Việc của tôi |
|---|---|---|---|
| **Thẻ 1 (Khối lượng)** | Tổng nhiệm vụ trọng tâm trường | Tổng nhiệm vụ đơn vị đang gánh | Số việc tôi được giao trực tiếp |
| **Thẻ 2 (Khẩn cấp)** | Số đơn vị có việc quá hạn đỏ | Số việc con trong đơn vị trễ hạn | Việc của tôi quá hạn hôm nay |
| **Thẻ 3 (Hàng đợi duyệt)** | Hồ sơ đơn vị trình BGH duyệt | Hồ sơ chuyên viên nộp chờ Trưởng khoa | Hồ sơ tôi đã nộp đang chờ duyệt |
| **Thẻ 4 (Tiến độ/Tỷ lệ)** | Tỷ lệ hoàn thành toàn trường | Tỷ lệ nghiệm thu của đơn vị | Tỷ lệ hoàn thành cá nhân |

### 4.3 Hàng Đợi Hành Động 2 Làn (`UniversalActionQueue`)
Giải quyết triệt để vấn đề "Tôi cần làm gì ngay bây giờ?":
- **Làn 1 - "Cần tôi phê duyệt" (Approval In-tray)**:
  - Hiển thị nếu người dùng là BGH, Trưởng khoa, hoặc được ủy quyền `DACUM_REVIEW_STEP1`.
  - Mỗi thẻ hiển thị: Tên cán bộ nộp, Minh chứng đính kèm (icon PDF/Docx), Điểm thẩm định AI (Compliance Score).
  - 2 nút 1 chạm: **"Phê duyệt đạt"** (Emerald) & **"Yêu cầu hoàn thiện"** (Amber).
- **Làn 2 - "Cần tôi nộp minh chứng / Báo cáo" (Submission To-do)**:
  - Hiển thị các việc mà người dùng là người chịu trách nhiệm chính (DRI).
  - Nút 1 chạm: **"Nộp minh chứng"** (Mở nhanh modal kéo thả tệp không qua 3 bước rườm rà).

### 4.4 Bảng Công Việc Phân Tầng Thống Nhất (`UnifiedTaskCanvas`)
- Tái sử dụng `CascadingTaskTable` đã được chuẩn hóa, áp dụng bộ lọc thông minh:
  - Nếu `scope === "school"`: Bảng mở ở cấp Trường, cho phép mở rộng xem 11 đơn vị.
  - Nếu `scope === "unit"`: Bảng chỉ lọc các nhiệm vụ liên quan đến Đơn vị người dùng, mở rộng xem từng chuyên viên.
  - Nếu `scope === "my"`: Bảng chỉ hiển thị các dòng công việc mà `matchesUser(user, task)` là true.
- **Tương tác Phím tắt Tốc độ cao**:
  - `J` / `K`: Di chuyển vùng chọn lên / xuống.
  - `X`: Đánh dấu chọn nhiều dòng.
  - `A`: Mở phân công DACUM.
  - `S`: Đổi nhanh trạng thái.
  - `Enter`: Mở Side-sheet chi tiết.

---

## 5. BẢO TỒN NGHIỆP VỤ DACUM & PHÁP LÝ NGHỊ ĐỊNH 232

Kiến trúc thống nhất **không làm suy giảm mà còn tăng cường tính tuân thủ pháp lý**:

1. **Quy tắc Thẩm định 2 Bước Bất biến**:
   - Nhân viên nộp minh chứng $\rightarrow$ Chuyển sang `NEEDS_REVIEW` (Bước 1: Trưởng đơn vị kiểm tra).
   - Trưởng đơn vị nghiệm thu $\rightarrow$ Đạt: chuyển sang `PENDING_EXECUTIVE_APPROVAL` (Bước 2: BGH phê duyệt cấp trường).
   - Tuyệt đối không cho phép nhân sự không có thẩm quyền chuyển thẳng task sang `COMPLETED`.
2. **Kiểm tra Minh chứng Bắt buộc (Deliverable Compliance)**:
   - Khi bấm Duyệt hoặc Nộp, hệ thống kiểm tra sự tồn tại của tệp đính kèm và đường link hợp lệ.
3. **Vết Kiểm Toán Minh Bạch (Immutable Audit Trail)**:
   - Mọi hành động Duyệt, Trả lại, Ủy quyền đều ghi nhận thời gian, địa chỉ IP và định danh cán bộ vào bảng `ActivityEvent`.

---

## 6. CHIẾN LƯỢC CHUYỂN ĐỔI AN TOÀN (ZERO-DOWNTIME MIGRATION)

Để đảm bảo an toàn tuyệt đối, không làm đứt gãy hệ thống đang chạy và vượt qua 100% test suite hiện hành:

### Giai đoạn 1: Triển khai Component Lõi & Adapter Shims (Tuần 1)
- Xây dựng cụm component tại `src/components/workspace/unified-adaptive-workspace.tsx`.
- Chuyển đổi 3 file cũ thành **Thin Wrapper Adapters**:
  ```tsx
  // src/components/portal/executive-cockpit-workspace.tsx
  export function ExecutiveCockpitWorkspace(props: any) {
    return <UnifiedAdaptiveWorkspace {...props} initialScope="school" />;
  }
  
  // src/components/portal/department-manager-workspace.tsx
  export function DepartmentManagerWorkspace(props: any) {
    return <UnifiedAdaptiveWorkspace {...props} initialScope="unit" />;
  }
  
  // src/components/portal/lecturer-focus-workspace.tsx
  export function LecturerFocusWorkspace(props: any) {
    return <UnifiedAdaptiveWorkspace {...props} initialScope="my" />;
  }
  ```

### Giai đoạn 2: Thay thế Điểm Nhúng Trung Tâm (Tuần 2)
- Cập nhật `src/components/dashboard/zones/tasks-focus-landing.tsx` và `src/app/page.tsx`:
  - Thay thế toàn bộ khối `if (isExecutive) ... else if (isManager) ...` bằng duy nhất `<UnifiedAdaptiveWorkspace />`.
  - Quản lý trạng thái scope qua URL Query Param: `?scope=school | unit | my`.

### Giai đoạn 3: Dọn Dẹp Code Trùng Lặp & Tối Ưu (Tuần 3)
- Xóa bỏ các đoạn mã thừa bên trong 3 file cũ.
- Giảm hơn 4.000 LOC, đạt chứng chỉ Clean Architecture.

---

## 7. TIÊU CHÍ NGHIỆM THU & ĐO LƯỜNG CHẤT LƯỢNG (ACCEPTANCE CRITERIA)

| Chỉ số | Hiện tại (3 UIs) | Mục tiêu sau Chuyển đổi (Unified) |
|---|---|---|
| **Số lần chuyển màn hình của Trưởng khoa** | 4 - 6 lần / ngày | **0 lần** (chỉ bấm chuyển tab Scope trong 0.1s) |
| **Thời gian duyệt 1 hồ sơ minh chứng** | ~3 - 5 phút (qua nhiều lớp modal) | **< 15 giây** (In-place Action Queue) |
| **Dung lượng code Workspace** | ~4.200 LOC | **< 1.200 LOC** (Cắt giảm 70% nợ kỹ thuật) |
| **Độ bao phủ Test Suite** | 100% Tests Pass | **100% Tests Pass** (Không hồi quy logic DACUM) |
| **Độ tương phản & Touch Target** | Nhiều nút < 28px | **100% WCAG AA/AAA, Touch Target ≥ 44px** |
| **Light-Only Standard** | Tuân thủ thuần túy Light mode | **100% OKLCH Semantic Tokens** |
