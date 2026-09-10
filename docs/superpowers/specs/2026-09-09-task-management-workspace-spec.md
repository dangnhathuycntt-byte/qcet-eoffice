# ĐẶC TẢ KỸ THUẬT (TECHNICAL SPECIFICATION)
## Phân Hệ Quản Lý Công Việc & Điều Hành Nhiệm Vụ (QCET Tasks Workspace)

- **Mã tài liệu:** `SPEC-QCET-TASK-MGMT-2026`
- **Tập tin liên quan:** `docs/superpowers/specs/2026-09-09-task-management-workspace-spec.md`
- **Phiên bản:** `1.0.0-PROD`
- **Tiêu chuẩn kỹ thuật:** Next.js 15+ (App Router), Tailwind CSS v4 (OKLCH Color Space, Light-Only Standard, Zero `dark:` variants), TypeScript Strict Mode.
- **Tiêu chuẩn nghiệp vụ:** Nghị định 30/2020/NĐ-CP (Thể thức văn bản hành chính), Thông tư 28/2017/TT-BLĐTBXH (Đảm bảo chất lượng GDNN), Mô hình định biên DACUM (Developing A Curriculum).

---

## 1. TỔNG QUAN & MỤC TIÊU KỸ THUẬT (OVERVIEW & OBJECTIVES)

### 1.1 Hiện trạng & Vấn đề Cần Giải Quyết
1. **Đứt gãy đồng bộ URL (Deep Linking Breakdown):** Toàn bộ state (`viewMode`, `category`, `search`, `tab`, `taskId`) lưu tạm thời trong RAM (`useState`). Tải lại trang (F5) làm mất sạch bộ lọc; không thể gửi link trực tiếp tới một nhiệm vụ hoặc báo cáo đơn vị.
2. **Đột biến dữ liệu không đồng bộ API (State Mutation Leak):** Hàm `handleStatusChange` và `handleCreateTask` chỉ cập nhật mảng in-memory mà không gọi `PATCH /api/tasks/${id}` hoặc `POST /api/tasks`. Nút "Đôn đốc" chỉ có `e.stopPropagation()`.
3. **Xung đột 2 thanh tìm kiếm (Dual Search Disconnect):** Thanh tìm kiếm trang không truyền props xuống `CascadingTaskTable`, trong khi bảng tự render thanh tìm kiếm thứ 2 và ép cứng danh mục `"ALL"`. Tìm kiếm không có debounce gây nghẽn render.
4. **Monolith 92.3 KB & Dual-DOM Re-render:** `cascading-task-table.tsx` (1,970 LOC) gộp chung Desktop Table và Mobile Cards, duy trì đồng thời 2 cây DOM làm chậm hiệu năng khi vượt quá 200 tác vụ; tính toán lặp subtasks trong render loop; hardcode ngày `"2026-09-04"` rải rác.
5. **Trùng lặp mã nguồn:** `src/app/tasks/page.tsx` và `src/app/unit-tasks/page.tsx` trùng nhau 98% (~1,200 dòng lặp).
6. **Lỗ hổng quản trị DACUM & Minh chứng:** Database cho phép nhiều `PRIMARY_OWNER`; nhân sự có thể tự bấm hoàn thành nhiệm vụ mà không cần nộp hồ sơ minh chứng nghiệm thu.

### 1.2 Mục tiêu Đạt Được
- **Trải nghiệm đẳng cấp Linear:** Hỗ trợ phím tắt (`J/K`, `X`, `ArrowKeys`, `/` hoặc `Cmd+K`), thanh thao tác nổi (Floating Bulk Action Bar), chuyển đổi mật độ hiển thị (Compact / Comfortable), giao diện mượt mà đạt chuẩn 60 FPS.
- **Chuẩn hóa công quyền giáo dục:** Cổng kiểm soát hồ sơ minh chứng (Deliverable Gatekeeper), nguyên tắc một đầu mối chịu trách nhiệm duy nhất (Single DRI), tính tiến độ cuốn chiếu liên tục (Weighted Progress Rollup).
- **Kiến trúc module sạch:** Phân rã monolith 92.3 KB thành các sub-module $< 250$ LOC; hợp nhất `tasks` và `unit-tasks` thành 1 workspace thích ứng duy nhất; đồng bộ URL 2 chiều 100%.

---

## 2. KIẾN TRÚC PHÂN RÃ COMPONENT (MODULAR ARCHITECTURE)

Hệ thống phân tách tệp monolith `src/components/tasks/cascading-task-table.tsx` thành cấu trúc module hướng chức năng:

```
src/components/tasks/
├── task-management-workspace.tsx    # Container cốt lõi (dùng chung cho cả /tasks và /unit-tasks)
├── task-kanban-board.tsx            # Bảng Kanban cột trạng thái (WIP Limits, Drag/Drop)
├── cascading-task-table.tsx         # Facade Re-export (đảm bảo tương thích ngược 100% tests)
└── table/                           # Module bảng phân cấp chuyên trách
    ├── types.ts                     # Interfaces: TableProps, SelectionState, ColumnConfig
    ├── constants.ts                 # Nhãn trạng thái, màu sắc OKLCH, tabs chuyên môn
    ├── utils/
    │   ├── table-filter-engine.ts   # Thuật toán lọc đa chiều (dept, category, search, SLA)
    │   ├── table-date-helpers.ts    # Kết nối academic-calendar.ts, định dạng UTC-safe
    │   └── progress-rollup-calc.ts  # Tính toán tiến độ trọng số liên tục
    ├── hooks/
    │   ├── use-task-table-state.ts  # Quản lý sorting, pagination, selection, expansion
    │   ├── use-task-keyboard-nav.ts # Roving tabindex, phím tắt J/K, X, ArrowKeys, Enter
    │   └── use-task-url-sync.ts     # Đồng bộ hóa URLSearchParams 2 chiều
    └── components/
        ├── task-table-toolbar.tsx   # Search có debounce, smart filter pills, density toggle
        ├── task-table-header.tsx    # Header bảng, checkbox indeterminate, sort cột
        ├── task-row.tsx             # Hàng cấp cha (Tier-1), memoized tránh re-render thừa
        ├── subtask-row-group.tsx    # Nhóm công việc con (Tier-2) kèm nhánh cây phân cấp
        ├── subtask-inline-row.tsx   # Hàng công việc con với nút phê duyệt nhanh
        ├── task-bulk-action-bar.tsx # Thanh dock nổi thực hiện thao tác hàng loạt
        ├── task-pagination-bar.tsx  # Phân trang, chọn pageSize, nhảy trang
        ├── mobile-task-card.tsx     # Thẻ mobile render điều kiện theo viewport
        └── task-empty-state.tsx     # Trạng thái không có dữ liệu + nút reset bộ lọc
```

---

## 3. MÔ HÌNH DỮ LIỆU & QUẢN TRỊ DACUM (DATA MODELS & GOVERNANCE)

### 3.1 Ràng buộc Single DRI
Mỗi nhiệm vụ chỉ có **duy nhất 1 cá nhân chịu trách nhiệm chính (`PRIMARY_OWNER`)**. Các thành viên khác tham gia với vai trò `COLLABORATOR` (phối hợp) hoặc `SUPERVISOR` (giám sát).

### 3.2 Chuẩn hóa Cấu trúc Dữ liệu Tác vụ (`src/types/dashboard.ts`)
- `SchoolTask`: Thêm `leadAssigneeId`, `leadAssigneeName`, `deliverables`, `standardHours`, `weight`.
- `StaffTask`: Thuộc tính `weight`, `progressPercent`, `deliverables`.
- `TaskDeliverableItem`: Minh chứng hoàn thành (`reviewStatus: PENDING | APPROVED | REVISION_REQUIRED`).

---

## 4. ĐẶC TẢ GIAO DIỆN & TƯƠNG TÁC (UI/UX SPECIFICATION)

### 4.1 Thanh điều khiển tập trung (Universal Task Action Bar)
- **View Mode Switcher:** `Bảng (Table)` | `Kanban (Board)` | `Tiến độ (Gantt)`.
- **Density Toggle:** `Gọn (Compact, 36px row)` | `Chuẩn (Comfortable, 48px row)`.
- **Smart Filter Pills:** `Tất cả` | `Việc của tôi` | `Quá hạn` | `Chờ duyệt minh chứng` | `Cần xử lý hôm nay`.
- **Search:** Debounce 250ms, phím tắt `/` hoặc `Cmd+K`.

### 4.2 Dock Thao tác Hàng loạt Nổi (Floating Bulk Action Bar)
- Xuất hiện khi `selectedCount > 0` tại `fixed bottom-6 inset-x-0 mx-auto w-fit z-40`.
- Hỗ trợ đổi trạng thái hàng loạt, gia hạn tiến độ, chuyển đổi DRI, xuất Excel, phím `Esc` bỏ chọn.

### 4.3 Phím tắt & Bàn phím
- `J/K` hoặc `ArrowDown/ArrowUp`: Di chuyển dòng.
- `X` hoặc `Space`: Chọn checkbox.
- `ArrowRight/ArrowLeft`: Đóng/Mở subtasks.
- `Enter`: Mở Side Sheet chi tiết.

### 4.4 Quy chuẩn Light-Only
- Nền `bg-background` (`oklch(0.985 0.002 247.5)`).
- Viền `border-border` (`oklch(0.92 0.004 240)`).
- Không có class `dark:`.
