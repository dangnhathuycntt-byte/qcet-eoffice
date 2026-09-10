# ĐẶC TẢ THIẾT KẾ: CHUẨN HÓA KHÔNG GIAN CÁ NHÂN & LOẠI BỎ AI SLOP (LINEAR-GRADE PERSONAL WORKSPACE)

**Mã dự án:** QCET-EOFFICE-ANTI-SLOP-PERSONAL-WORKSPACE  
**Ngày lập:** 08/09/2026  
**Trạng thái:** Proposed (Chờ phê duyệt)  
**Mục tiêu:** Xóa bỏ toàn bộ rác thị giác (AI Slop), triệt tiêu sự trùng lặp nút bấm và bộ lọc, chuẩn hóa màn hình "Công việc của tôi" (`lecturer-focus-workspace.tsx` / `staff-workspace.tsx`) theo chuẩn mực Linear/Notion.

---

## 1. Bối cảnh & Phân tích Vấn đề (Problem Analysis)

### 1.1 Vấn đề cốt lõi trên màn hình hiện tại
Qua rà soát thực tế và ảnh chụp màn hình Bàn làm việc cá nhân (`/` với vai trò Giảng viên/Chuyên viên CNTT):
1. **Trùng lặp Nút hành động chính (Primary Action Duplication):**
   - Topbar cố định (`app-topbar.tsx:276`) đã có nút chính `+ Tạo việc`.
   - Ngay bên dưới, Header của trang (`lecturer-focus-workspace.tsx:751`) lại thêm một nút chính cùng màu xanh `+ Tạo việc mới` và cùng kích hoạt sự kiện `qcet:open-create-task`.
   - Header trang còn kéo theo các nút phụ `Kho nhiệm vụ ->` và `Làm mới`, tạo thành cụm nút rối rắm.
2. **Bẫy trùng lặp Widget (Dual-Widget Trap - Lặp 100% logic & số đếm):**
   - Phía trên có **5 Thẻ chỉ số KPI to** (*Hôm nay cần làm, Trong tuần này, Chờ lãnh đạo duyệt, Cần chỉnh sửa, Đã hoàn thành*).
   - Ngay bên dưới lại có **dải 6 nút Pill lọc trạng thái** (*Khẩn cấp / Quá hạn, Trong tuần này, Đang làm, Chờ duyệt, Cần bổ sung, Đã xong*).
   - Cả 2 widget này cùng điều khiển biến `activeFilter`, cùng hiển thị con số và cùng nằm chung một góc nhìn, gây lãng phí nghiêm trọng diện tích hiển thị (chiếm hơn 300px chiều dọc).
3. **Nhiễu loạn số 0 (Zero-State Cognitive Overload):**
   - Chữ số `(0)` xuất hiện đồng loạt 14 lần trên màn hình trống: trong từng thẻ KPI, từng tab vai trò, từng pill trạng thái và dòng đếm số lượng.
   - Khi người dùng không có việc tồn đọng, màn hình tạo cảm giác "hệ thống bị lỗi / trống rỗng" thay vì mang lại cảm giác hoàn thành công việc.
4. **Văn bản tiểu sử dư thừa (Noisy Biographical Subtitle):**
   - Chuỗi `Chuyên viên CNTT · Nguyễn Ngọc Vinh · Khoa Công nghệ thông tin · Năm học 2026 - 2027` lặp lại toàn bộ thông tin đã hiển thị rõ ràng trên Topbar (User Profile) và Sidebar (Năm học).
5. **Hai thanh tìm kiếm nằm thẳng hàng dọc:**
   - Topbar có ô `Tìm nhanh công việc, nhân sự... ⌘K`.
   - Thân trang lại có thêm một ô input to đùng `Tìm theo tên nhiệm vụ, mã công việc...` chiếm riêng một dòng lớn.

---

## 2. Nguyên tắc Thiết kế Cốt lõi (Linear-Grade Principles)

Dựa trên nghiên cứu tiêu chuẩn thiết kế từ Linear, Height và Nielsen Norman Group:

1. **No Macro KPI Cards in IC Views (Không nhồi thẻ KPI vĩ mô vào trang cá nhân):**
   - Thẻ KPI to chỉ phù hợp cho màn hình Điều hành của Ban Giám hiệu (`ExecutiveCockpitWorkspace`).
   - Màn hình cá nhân của Giảng viên/Chuyên viên cần đẩy danh sách công việc lên cao nhất có thể để người dùng bắt tay vào làm việc ngay.
2. **Single-Row Integrated Toolbar (Thanh công cụ tích hợp 1 dòng duy nhất):**
   - Gom toàn bộ phân loại vai trò (*Tất cả / Tôi chủ trì / Phối hợp*) và ô lọc nhanh cục bộ vào một hàng duy nhất.
3. **Conditional Sectioning & Clean Filtering (Nhóm trạng thái tự nhiên):**
   - Một trạng thái chỉ xuất hiện ở 1 nơi duy nhất.
   - Thay vì 2 tầng widget chồng chéo, cung cấp bộ lọc trạng thái nhanh tích hợp (Status Tabs/Dropdown) gọn gàng.
4. **Zero-Noise Suppression (Triệt tiêu rác số 0):**
   - Không hiển thị huy hiệu `(0)` khi số lượng bằng 0.
   - Chỉ hiển thị badge số đếm nổi bật khi số lượng $> 0$.
5. **Positive "All Caught Up" Empty State (Trạng thái rỗng tích cực):**
   - Khi không có việc: Hiển thị icon trạng thái nhẹ nhàng cùng thông điệp hoàn thành: *"Tuyệt vời! Bạn không có công việc nào tồn đọng"*.
   - Chỉ khi tìm kiếm/lọc không ra kết quả: Hiển thị thông báo tìm kiếm không khớp kèm nút `[Xóa bộ lọc]`.

---

## 3. Đặc tả Chi tiết Giao diện & Component (`lecturer-focus-workspace.tsx`)

### 3.1 Cấu trúc 3 Khu vực Mới

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  Công việc của tôi                                           [ Kho nhiệm vụ → ]  [ ↻ ] │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  [ Tất cả ]  [ Tôi chủ trì ]  [ Phối hợp ]  │  [ Trạng thái ▾ ]  │ 🔍 Lọc việc...  [⤢] 0/0│
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│                                 ✓ (Icon dịu mát)                                       │
│                       Tuyệt vời! Bạn đã hoàn thành hết việc                            │
│                     Không có nhiệm vụ nào cần xử lý trong hôm nay                      │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Tầng 1: Page Header Tinh gọn
- **Tiêu đề:** `h1` "Công việc của tôi" (font-heading, font-bold, text-xl).
- **Phụ đề:** Một dòng tóm tắt trạng thái động ngắn gọn hoặc lời chào:
  - Nếu có việc khẩn cấp: `"Bạn có X việc khẩn cấp / quá hạn cần xử lý."` (màu đỏ nhẹ).
  - Nếu bình thường: `"Không gian theo dõi và nộp báo cáo tiến độ nhiệm vụ cá nhân."`
  - *Loại bỏ hoàn toàn:* Dòng chức danh dài dòng `Chuyên viên CNTT · Nguyễn Ngọc Vinh · Khoa CNTT...`.
- **Hành động bên phải:**
  - *Xóa bỏ:* Nút `+ Tạo việc mới` (đã có nút chính trên Topbar).
  - *Giữ lại:* Nút phụ `Kho nhiệm vụ ->` (dạng ghost/outline text-xs) và icon làm mới `↻` (nếu có `onRefresh`).

### 3.3 Tầng 2: Thanh Toolbar Tích hợp Duy nhất (Integrated Toolbar)
Thay thế toàn bộ 4 tầng cũ (5 thẻ KPI + 1 hàng search + 1 hàng tab vai trò + 1 hàng pill trạng thái) bằng **1 hàng duy nhất**:

1. **Cụm Tab Quyền sở hữu (Ownership Segmented Control):**
   - `Tất cả`: Active khi `ownershipFilter === "ALL"`. Chỉ hiện `(X)` nếu $X > 0$.
   - `Tôi chủ trì (DRI)`: Có icon `User`. Chỉ hiện `(Y)` nếu $Y > 0$.
   - `Tôi tham gia (Phối hợp)`: Có icon `Users`. Chỉ hiện `(Z)` nếu $Z > 0$.
2. **Bộ lọc trạng thái tinh gọn (Status Filter Segment / Dropdown):**
   - Tích hợp 4 nhóm trạng thái chính dạng menu/tab nhỏ:
     - `Khẩn cấp / Quá hạn` (chỉ nổi bật khi `todayCount > 0`).
     - `Chờ duyệt` (chỉ nổi bật khi `waitingApprovalCount > 0`).
     - `Cần chỉnh sửa` (chỉ nổi bật khi `revisionRequestedCount > 0`).
     - `Đã hoàn thành`.
   - Khi bấm lọc, cập nhật `activeFilter`. Không sinh thêm bất kỳ widget KPI độc lập nào.
3. **Ô lọc tại chỗ (In-Page Search Filter):**
   - Kích thước nhỏ gọn (`h-8 w-48 sm:w-64`), viền mỏng hairline, icon kính lúp 14px.
   - Placeholder: `"Lọc theo tên, mã việc..."`.
   - Có nút xóa `x` khi có text.
4. **Cụm chức năng phụ:**
   - Nút `Thu gọn / Mở rộng tất cả` (`h-8`, icon `ChevronDown`/`ChevronUp`).
   - Bộ đếm kết quả thực tế: Hiển thị dạng chữ nhỏ trang nhã `Hiển thị X nhiệm vụ`.

### 3.4 Tầng 3: Trạng thái Rỗng Đa Tình huống (Contextual Empty State)

1. **Trường hợp A: Người dùng không có công việc nào (Inbox Zero):**
   - Icon: `CheckCircle2` (màu `text-emerald-600` hoặc `text-primary/70` dịu mát, nét 1.5px).
   - Tiêu đề: `"Tuyệt vời! Bạn không có công việc nào tồn đọng"`.
   - Mô tả: `"Tất cả nhiệm vụ được giao đã hoàn thành hoặc đang chờ phê duyệt."`.
2. **Trường hợp B: Không tìm thấy kết quả do Tìm kiếm hoặc Lọc:**
   - Icon: `Search` (màu `text-muted-foreground`, nét 1.5px).
   - Tiêu đề: `"Không tìm thấy nhiệm vụ phù hợp"`.
   - Mô tả: `"Không có công việc nào khớp với từ khóa hoặc bộ lọc đã chọn."`.
   - Nút hành động: `[Xóa bộ lọc và tìm kiếm]` -> Đặt lại `searchTerm = ""` và `activeFilter = "ALL"`.

---

## 4. Quản lý State & Data Flow

Các state nội bộ trong component được bảo toàn nguyên vẹn để không làm ảnh hưởng đến logic xử lý:
- `activeFilter`: `LecturerFilterTab` (`"ALL" | "TODAY" | "THIS_WEEK" | "IN_PROGRESS" | "NEEDS_REVIEW" | "REVISION" | "COMPLETED"`).
- `ownershipFilter`: `LecturerOwnershipFilter` (`"ALL" | "LEADING" | "PARTICIPATING"`).
- `searchTerm`: `string`.
- `paginatedGroupedTasks`, `filteredGroupedTasks`: Giữ nguyên pipeline tính toán lọc dữ liệu hiện có.

---

## 5. Tiêu chuẩn Kỹ thuật & Kiểm thử (Verification & Acceptance)

1. **Anti-Slop Audit:**
   - 0% emoji trong code và giao diện (`lucide-react` nét 1.5px duy nhất).
   - Không còn sự xuất hiện của chữ số `(0)` vô nghĩa khi danh sách rỗng.
   - 0% sự trùng lặp giữa các nút tác vụ trên Topbar và Header trang.
2. **Light-Only Standard:**
   - Tuân thủ 100% không gian màu OKLCH, không sử dụng class `dark:`.
3. **Bảo toàn Test Suites:**
   - Chạy pass 100% các file test:
     - `tests/staff-focus-view.test.ts`
     - `tests/role-based-workspace-workflow.test.ts`
     - `tests/role-task-filter.test.ts`
4. **TypeScript & Build:**
   - `npm run typecheck` vượt qua không có bất kỳ lỗi nào.
