# THIẾT KẾ CHI TIẾT: PHÂN CỤM & QUẢN TRỊ NHIỆM VỤ THEO ĐƠN VỊ
## Dựa trên chuẩn Đại học Quốc tế: Stanford Authority Manager, Workday Higher Education & MIT Atlas
**Tài liệu:** `docs/superpowers/specs/2026-09-06-department-task-organization-design.md`  
**Ngày:** `2026-09-06`  
**Dự án:** QCET E-Office (Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn)

---

## 1. BỐI CẢNH & VẤN ĐỀ CẦN GIẢI QUYẾT

Hệ thống quản lý công việc trước đây hiển thị danh sách nhiệm vụ dưới dạng danh sách phẳng (flat list). Khi quy mô công việc của trường tăng lên (hơn 300 nhiệm vụ cấp trường và gần 1.000 công việc đơn vị), Ban Giám Hiệu và các Trưởng đơn vị gặp phải các hạn chế:
1. **Không phân biệt rõ trách nhiệm đơn vị**: BGH khó thấy ngay Khoa/Phòng nào đang làm tốt, đơn vị nào đang có công việc ách tắc.
2. **Quá tải thông tin (Cognitive Overload)**: Người dùng phải tự lọc thủ công qua từng bộ lọc thay vì có góc nhìn tổng thể theo từng khối tổ chức.
3. **Thiếu cơ chế tổ chức theo đơn vị giám sát (Supervisory Organization)**: Chưa áp dụng được các bài học thành công từ Workday Higher Ed và Stanford Authority Manager về việc nhóm công việc theo đơn vị phụ trách và hỗ trợ ủy quyền tạm thời.

---

## 2. NGUYÊN TẮC THIẾT KẾ (THEO CHUẨN THẾ GIỚI)

1. **Supervisory Organization First (Chuẩn Workday)**: Mọi nhiệm vụ luôn thuộc về một Đơn vị chủ trì (Primary Unit) và có người đứng đầu đơn vị (Department Head) chịu trách nhiệm giải trình trực tiếp trước BGH.
2. **Chế độ xem Phân cụm Đa tầng (Department-Grouped Accordion View)**: Cho phép BGH xem toàn cảnh tiến độ của 12 Khoa/Phòng cùng lúc, mở rộng/thu gọn danh sách nhiệm vụ của từng đơn vị chỉ với 1 click.
3. **Mã hóa trạng thái RAG (Red - Amber - Green)**: Mỗi khối đơn vị có huy hiệu trạng thái tiến độ trực quan:
   - **XANH (Bình thường)**: $\ge 70\%$ tiến độ, 0 việc trễ hạn.
   - **VÀNG (Cần lưu ý)**: $40\% - 69\%$ tiến độ, hoặc có việc cận hạn.
   - **ĐỎ (Cảnh báo)**: $< 40\%$ tiến độ, hoặc có $\ge 1$ việc trễ hạn.
4. **Tiêu chuẩn Anti-Slop**: 0% emoji trang trí, 100% icon `lucide-react` nét `1.5`, số liệu `font-mono tabular-nums`.

---

## 3. CẤU TRÚC GIAO DIỆN & THÀNH PHẦN (COMPONENT ARCHITECTURE)

### 3.1 Thành phần mới: `DepartmentGroupedTaskView`
- **Vị trí**: `src/components/dashboard/department-grouped-task-view.tsx`
- **Chức năng**:
  - Nhận danh sách nhiệm vụ (`tasks`) và danh sách đơn vị (`QCET_DEPARTMENTS`).
  - Gom nhóm (group by) nhiệm vụ theo `departmentId`.
  - Hiển thị danh sách các khối phòng ban dạng Accordion.
  - Mỗi header đơn vị hiển thị:
    - Tên đơn vị + Mã phòng ban (kèm màu sắc nhận diện).
    - Họ tên Trưởng đơn vị (`leadTitle` + `leadName`).
    - Dải tiến độ trung bình (`Progress bar` & `% font-mono tabular-nums`).
    - Huy hiệu RAG (*Bình thường* / *Cần lưu ý* / *Trễ hạn*).
    - Thống kê tóm tắt: Tổng số việc, Số việc Cấp trường, Số việc Đơn vị, Số việc Trễ hạn.
    - Nút mở rộng/thu gọn (Expand/Collapse all và per-item).
  - Nội dung khi mở rộng: Bảng nhiệm vụ chi tiết của đơn vị đó, hỗ trợ xem SideDrawer khi click vào dòng.

### 3.2 Cập nhật `UnifiedTaskToolbar`
- **Vị trí**: `src/components/dashboard/unified-task-toolbar.tsx`
- **Bổ sung**:
  - Tùy chọn chuyển đổi chế độ xem: `viewMode: "table" | "board" | "department"`.
  - Icon phân cụm: `Building2` hoặc `Boxes` (stroke 1.5).

### 3.3 Tích hợp tại `src/app/page.tsx`
- Khi người dùng chọn `viewMode === "department"`, render `DepartmentGroupedTaskView` thay thế cho bảng phẳng, đồng bộ trạng thái tìm kiếm và bộ lọc toàn trường.

---

## 4. HÀM XỬ LÝ DỮ LIỆU & KIỂM THỬ

### 4.1 Hàm gom nhóm & tính chỉ số: `aggregateTasksByDepartment`
- **Vị trí**: `src/lib/department-task-aggregator.ts`
- **Input**: `Task[]`, `DepartmentNode[]`.
- **Output**: Mảng các `DepartmentTaskGroup` chứa đầy đủ thống kê, danh sách việc và trạng thái RAG.

### 4.2 Hợp đồng Kiểm thử (Test Contracts)
- `tests/department-task-aggregator.test.ts`:
  - Kiểm tra tính toán chính xác số lượng việc, tỉ lệ % trung bình của từng đơn vị.
  - Kiểm tra gán nhãn RAG (Red/Amber/Green) chính xác theo điều kiện trễ hạn và tiến độ.
  - Kiểm tra đơn vị không có công việc nào vẫn render đúng định dạng rỗng an toàn.
- `tests/anti-slop-department-view.test.ts`:
  - Đảm bảo 0% emoji, icon strokeWidth 1.5, tabular-nums được áp dụng đầy đủ.
