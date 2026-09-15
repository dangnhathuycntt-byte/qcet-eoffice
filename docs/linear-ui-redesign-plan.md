# Kế hoạch Tái cấu trúc Giao diện QCET Work: Chuẩn Linear Hệ Thống Hoàn Chỉnh (100% Theme Light)

## Context (Bối cảnh & Tổng hợp Yêu cầu Người dùng)

Người dùng đã cung cấp trọn bộ trải nghiệm Linear trực quan (Ảnh #3, #4, #5, #6, #7, #8) và đưa ra các chỉ đạo kiến trúc nhất quán:
1. **Mô hình thực thể chuẩn Linear**:
   - **Team trong Linear $\to$ Phòng ban / Đơn vị** (Phòng Đào tạo, Phòng TCHC, Khoa CNTT, v.v.).
   - **Member trong Linear $\to$ Nhân sự / Cán bộ, Giảng viên, Chuyên viên**.
   - **Lead trong Linear $\to$ Người chủ trì nhiệm vụ (DRI)**.
   - **BGH (Ban Giám hiệu)**: Tạm thời **để sau**, giữ cho hệ thống tập trung vào luồng cộng tác Phòng ban - Nhân sự tinh gọn, không bị phức tạp hóa bởi các tầng phân cấp BGH lúc này.
2. **Quy tắc tuyệt đối: 100% THEME LIGHT (Giao diện Sáng)**:
   - Ứng dụng chỉ chạy theme light (nền sáng `#ffffff`, text đen/than `#0f172a`, viền hairline `#e2e8f0` / `border-border/40`). Tuyệt đối không dùng dark mode.
3. **Không dùng quá nhiều container ("không cần container nhiều quá đâu, để chỗ để content")**:
   - Loại bỏ card lồng card ("Russian doll"), mở rộng bề ngang canvas (`max-w-[1600px]`), bảng dữ liệu phẳng (flush table) trực tiếp trên canvas.
4. **Trang Danh sách Nhiệm vụ**: Áp dụng giao diện bảng dự án của Linear (**Ảnh #3**).
5. **Trang Chi tiết Nhiệm vụ**: Khi bấm vào nhiệm vụ (click chuột trái / `Enter`), hiển thị trang chi tiết Linear Project Detail 2 cột (**Ảnh #4**) thay thế hoàn toàn Drawer/SideSheet trượt cũ.
6. **Thao tác nhanh bằng Chuột phải (Context Menu - Ảnh #7)**:
   - Click chuột phải vào bất kỳ nhiệm vụ nào để mở Context Menu thao tác nhanh: Đổi trạng thái (`S`), Đổi độ ưu tiên (`P`), Phân công (`A`), Đổi hạn chót (`D`), Sao chép liên kết (`⌘⇧C`), Sao chép mã nhiệm vụ (`⌘⌥C`), Xóa.
   - Không nhồi nhét hàng tá nút bấm rườm rà lên từng dòng bảng, giữ cho bảng luôn thanh thoát và tập trung vào dữ liệu.
7. **Xem nhanh bằng phím `Space` (Peek Preview - Ảnh #8)**:
   - Khi đang duyệt danh sách (bằng phím mũi tên `↑`/`↓` hoặc rê chuột), nhấn phím `Space` để mở cửa sổ xem nhanh (Quick Look) xem tóm tắt nhiệm vụ, hạn chót, người chủ trì mà **không cần rời bảng**, nhấn `Space` hoặc `Escape` để đóng ngay. Bấm `↑`/`↓` để xem nhanh liên tục các nhiệm vụ tiếp theo.
8. **Tạo nhiệm vụ chuẩn Linear kết hợp AI Agent hỗ trợ (**Ảnh #5 & #6**)**:
   - Modal tạo nhiệm vụ dạng canvas thoáng đãng với icon khối hộp, Tên, Tóm tắt, Dải thuộc tính inline (Trạng thái, Độ ưu tiên, Lead, Thành viên, Hạn chót, Mốc việc).
   - Tích hợp **AI Agent Panel** bên phải (`▷ Tạo cùng Agent` / `Create with Agent`): Cho phép người dùng nhập yêu cầu ngôn ngữ tự nhiên hoặc bấm các chip gợi ý (`Xác định phạm vi`, `Lập kế hoạch thời gian`, `Phân rã việc con`) để Agent tự động soạn thảo và điền form nhiệm vụ.
9. **Phím tắt tạo nhanh**: Hỗ trợ phím tắt **giữ `n` sau đó nhấn `p`** (hoặc chuỗi `n` $\to$ `p` chuẩn Linear) để mở ngay modal tạo nhiệm vụ từ bất cứ đâu.
10. **Quy tắc kiểm tra**: Đã bỏ lệnh cấm `next build` theo yêu cầu người dùng; xác thực hoàn chỉnh bằng `npm run build`.

---

## Mô hình Ánh xạ & Tương tác (Linear $\to$ QCET Work)

| Khái niệm Linear | Ánh xạ trong QCET Work | Chi tiết hiển thị & Phím tắt |
| :--- | :--- | :--- |
| **Workspace** | **Cổng Điều hành QCET** | Toàn trường CĐ Kỹ thuật Công nghệ Quy Nhơn |
| **Teams** | **Phòng ban / Đơn vị** | Phòng Đào tạo, Phòng TCHC, Phòng QLKH-HTQT, Khoa CNTT... |
| **Members** | **Nhân sự / Cán bộ** | Giảng viên, Chuyên viên, Cán bộ tham gia thực hiện |
| **Lead (DRI)** | **Người chủ trì** | Cán bộ chịu trách nhiệm chính (Avatar + Tên) |
| **Projects / Issues** | **Nhiệm vụ & Đầu việc** | Nhiệm vụ của đơn vị hoặc nhiệm vụ cá nhân |
| **Health / Status** | **Tiến độ / Tình trạng** | Đúng hạn, Quá hạn, Cần chú ý, Tiến độ % |
| **Context Menu** | **Chuột phải thao tác nhanh** | Click chuột phải trên dòng: Đổi trạng thái (`S`), Đổi ưu tiên (`P`), Gán người (`A`), Hạn chót (`D`)... |
| **Peek Preview** | **Xem nhanh** | Nhấn phím `Space` để xem tóm tắt dạng Quick Look mà không chuyển trang |
| **Detail View** | **Chi tiết nhiệm vụ (thay drawer)** | Click chuột trái hoặc `Enter`: Mở trang chi tiết 2 cột (Ảnh #4) |
| **Quick Create** | **Phím tắt giao việc** | Giữ `n` rồi bấm `p` (hoặc `n` $\to$ `p`): Mở tạo nhiệm vụ |
| **Agent Assistant** | **Trợ lý QCET AI** | Panel AI hỗ trợ soạn thảo nhiệm vụ, mốc việc, hạn chót (Ảnh #5) |

---

## 4 Trụ cột Trải nghiệm Cần Hiện thực

### 1. Bảng Danh sách Nhiệm vụ Phẳng (Linear Projects - Ảnh #3)
Nằm tại `/tasks` (khi chưa chọn nhiệm vụ cụ thể):
- **Header & Breadcrumbs**: Tiêu đề trang `Nhiệm vụ`, bên phải là nút `+ Giao việc` (kèm badge phím tắt `N P`), nút `Bộ lọc`, nút `Tùy chọn hiển thị`.
- **Thanh Đơn vị / Phòng ban (Team Tabs)**:
  - Các tab phẳng: `[Tất cả phòng ban]` `[Đơn vị của tôi]` `[Cá nhân tôi]` (kèm dropdown lọc nhanh theo từng Phòng ban cụ thể).
- **Bảng dữ liệu phẳng (Flush Table) trực tiếp trên nền sáng**:
  - Không bọc trong card bo tròn hay đổ bóng (`rounded-xl border bg-card shadow-2xs`).
  - Đường kẻ hairline siêu mảnh `border-border/40` ngăn cách các hàng.
  - Các cột dữ liệu chuẩn Linear:
    1. `[Checkbox]` + Icon khối hộp (`Box`) + `Tên nhiệm vụ & Mã` (rộng rãi, chữ đậm vừa, hover đổi màu primary).
    2. `Tình trạng (Health)`: Đúng hạn, Quá hạn, Cần chú ý, Chưa có cập nhật.
    3. `Độ ưu tiên (Priority)`: Biểu tượng vạch sóng (Khẩn cấp, Cao, Bình thường, Thấp).
    4. `Người chủ trì (Lead)`: Avatar/Initials tròn + Họ tên cán bộ phụ trách.
    5. `Hạn chót (Target date)`: Ngày định dạng Việt Nam (`DD/MM/YYYY`).
    6. `Đầu việc (Issues)`: Số lượng nhiệm vụ con trực thuộc.
    7. `Tiến độ (Status / %)`: Icon vòng tròn tiến độ + phần trăm (ví dụ: `0%`, `50%`, `100%`).
- Hover toàn hàng êm ái (`hover:bg-slate-50/80`), chiều cao hàng tối ưu `h-10 sm:h-11`.

---

### 2. Chuột Phải Mở Menu Thao Tác Nhanh (Context Menu - Ảnh #7)
Khi click chuột phải vào bất kỳ hàng nào trên bảng:
- Mở popover Context Menu mượt mà ngay tại tọa độ con trỏ chuột:
  - `⭐ Đánh dấu ưu tiên`
  - `Đổi trạng thái...` (Phím `S`) $\to$ Submenu: Chưa bắt đầu, Đang làm, Chờ duyệt, Hoàn thành.
  - `Đặt độ ưu tiên...` (Phím `P`) $\to$ Submenu: Khẩn cấp, Cao, Bình thường, Thấp.
  - `Phân công người chủ trì...` (Phím `A`) $\to$ Danh sách cán bộ trong phòng ban.
  - `Thay đổi hạn chót...` (Phím `D`) $\to$ Chọn ngày nhanh.
  - Đường kẻ phân cách.
  - `Sao chép liên kết` (`⌘⇧C`).
  - `Sao chép mã nhiệm vụ` (`⌘⌥C`).
  - `Xem chi tiết nhiệm vụ` (`Enter`).
  - Đường kẻ phân cách.
  - `Hủy / Xóa nhiệm vụ...` (màu đỏ).
- Phím tắt bàn phím khi một hàng đang focus: nhấn `s`, `p`, `a`, `d` kích hoạt trực tiếp các thao tác tương ứng.

---

### 3. Nhấn Phím `Space` Xem Nhanh (Peek Preview - Ảnh #8)
- Khi người dùng dùng phím `↑`/`↓` hoặc rê chuột đến một nhiệm vụ, nhấn phím `Space`:
- Bật cửa sổ xem nhanh (Peek Modal / Quick Look):
  - Hiển thị popover nổi trang nhã giữa màn hình:
    - Tiêu đề nhiệm vụ + Mã nhiệm vụ + Icon khối hộp.
    - Dải thuộc tính: Trạng thái, Độ ưu tiên, Người chủ trì, Hạn chót, Phòng ban.
    - Trích đoạn mô tả nhiệm vụ & kết quả đầu ra.
    - Tiến độ hoàn thành & danh sách các mốc đầu việc con.
  - Nhấn `Space` lần nữa hoặc nhấn `Escape`: Đóng ngay cửa sổ xem nhanh.
  - Nhấn phím mũi tên `↑` / `↓`: Chuyển ngay nội dung xem nhanh sang nhiệm vụ kế tiếp mà không cần đóng mở lại.
  - Nhấn `Enter`: Mở trang Chi tiết Nhiệm vụ đầy đủ.

---

### 4. Trang Chi tiết Nhiệm vụ (Linear Project Detail - Ảnh #4)
**Thay thế hoàn toàn Drawer/SideSheet trượt cũ**:
Khi nhấp chuột trái hoặc nhấn `Enter` vào một nhiệm vụ, toàn bộ canvas chuyển sang trang chi tiết với bố cục 2 cột:
- **Thanh Breadcrumb trên cùng**:
  `Nhiệm vụ > [Mã nhiệm vụ] [Tên nhiệm vụ] ⭐ ...`
  Kèm nút `← Quay lại` (hoặc click vào chữ `Nhiệm vụ` để trở về danh sách), nút copy link, và nút ẩn/hiện cột thuộc tính bên phải (`Cmd/Ctrl + I`).
- **Thanh Sub-Tabs**:
  `[Tổng quan (Overview)]` `[Nhật ký hoạt động (Activity)]` `[Đầu việc con (Subtasks)]`
- **Bố cục 2 cột chuẩn Linear**:
  - **Cột Trái / Trung tâm (Nội dung tài liệu nhiệm vụ - ~68% bề ngang)**:
    - **Header**: Icon khối hộp lớn (`Box`) + Tiêu đề nhiệm vụ cỡ lớn (`text-2xl font-bold text-slate-900`) + Tóm tắt ngắn.
    - **Dải thuộc tính nhanh (Properties inline strip)**:
      `Thuộc tính:` `[Trạng thái]` `[Độ ưu tiên]` `[Người chủ trì]` `[Hạn chót]` `[Phòng ban (Team)]`
    - **Tài liệu & Minh chứng (Resources)**:
      Nút `+ Thêm văn bản chỉ đạo hoặc liên kết minh chứng...`
      Hiển thị danh sách văn bản và tài liệu đính kèm.
    - **Cập nhật tiến độ nhanh**:
      Box `Cập nhật tiến độ nhiệm vụ` cho phép cán bộ cập nhật % tiến độ và ghi chú báo cáo.
    - **Mô tả chi tiết (Description)**:
      Nội dung giao việc, yêu cầu thực hiện, căn cứ văn bản, kết quả cần đạt.
    - **Đầu việc con / Mốc thực hiện (Milestones / Subtasks)**:
      Nút `+ Thêm đầu việc con`
      Danh sách các việc con kèm checklist trạng thái.
  - **Cột Phải (Properties Sidebar cố định trong trang - ~32% bề ngang)**:
    - Khối **Thuộc tính (Properties)**:
      - **Trạng thái (Status)**: Chưa bắt đầu, Đang thực hiện, Chờ duyệt, Hoàn thành.
      - **Độ ưu tiên (Priority)**: Khẩn cấp, Cao, Bình thường, Thấp.
      - **Người chủ trì (Lead / DRI)**: Cán bộ chịu trách nhiệm chính (Avatar + Tên).
      - **Phòng ban phụ trách (Team / Department)**: Tên đơn vị (ví dụ: Phòng Đào tạo).
      - **Nhân sự phối hợp (Members)**: Danh sách cán bộ tham gia thực hiện.
      - **Thời hạn (Dates)**: Ngày bắt đầu → Hạn chót.
      - **Nhãn / Lĩnh vực (Labels)**: Đào tạo, Hành chính, Tuyển sinh...
    - Khối **Nhật ký hoạt động (Activity)**:
      - Ai đã giao việc, ai cập nhật tiến độ, thời gian tương đối.

---

### 5. Modal Tạo Nhiệm Vụ & AI Agent Hỗ Trợ (Linear Create - Ảnh #5 & #6)
**Hiện diện khi bấm `+ Giao việc` hoặc dùng phím tắt giữ `n` rồi bấm `p`**:
- **Bố cục Modal chính (Ảnh #6)**:
  - Header: `[Icon đơn vị] [Tên phòng ban] > Giao việc mới`, góc phải có nút `▷ Tạo cùng Agent` (Create with Agent) và nút `✕`.
  - Khối nhập liệu:
    - Icon khối hộp (`Box`) + Input Tên nhiệm vụ cỡ lớn (`Tên nhiệm vụ...`).
    - Input tóm tắt: `Thêm tóm tắt ngắn gọn...`.
    - Dải thuộc tính inline (Linear Property Pills): `[Trạng thái: Chưa bắt đầu]` `[Độ ưu tiên: Bình thường]` `[Chủ trì: Chọn cán bộ]` `[Phối hợp: Thêm nhân sự]` `[Ngày bắt đầu]` `[Hạn chót]` `[Lĩnh vực]`.
    - Khối soạn thảo mô tả: `Nhập nội dung chỉ đạo, yêu cầu thực hiện, căn cứ pháp lý...`.
    - Khối Mốc thực hiện (Milestones): `+ Thêm mốc / đầu việc con`.
  - Footer: Nút `Tạo nhiệm vụ` (`Create task`).
- **AI Agent Panel Hỗ Trợ (Ảnh #5)**:
  - Khi bấm `▷ Tạo cùng Agent`, một cột bên phải trượt mở ngay trong modal:
    - Tiêu đề: Icon khối hộp + **Soạn thảo nhiệm vụ cùng Trợ lý QCET AI**.
    - Mô tả: *"Nhiệm vụ xác định mục tiêu rõ ràng, thời hạn hoàn thành và phân công nhân sự cụ thể."*
    - Các chip gợi ý nhanh (Prompt pills):
      - `[ Xác định mục tiêu & phạm vi ]`
      - `[ Lập kế hoạch mốc thời gian ]`
      - `[ Phân rã đầu việc con ]`
      - `[ Chọn nhân sự phụ trách ]`
    - Ô nhập lệnh: `Soạn thảo nhiệm vụ cùng QCET AI...` kèm nút gửi `↑`.
    - Trợ lý AI tự động phân tích và điền tự động vào form bên trái: Tên nhiệm vụ chuẩn thể chế, tóm tắt, mô tả chi tiết, đề xuất mốc thực hiện và sản phẩm đầu ra theo chuẩn DACUM. Người dùng chỉ cần kiểm tra và bấm "Tạo nhiệm vụ".

---

## Các File Sẽ Chỉnh Sửa & Tạo Mới

1. **`src/components/tasks/detail/linear-task-detail-view.tsx`** *(Tạo mới)*:
   - Component chi tiết nhiệm vụ 2 cột theo đúng Ảnh #4.
   - 100% Theme Light, hỗ trợ cập nhật tiến độ, đổi trạng thái, quản lý đầu việc con và minh chứng.
2. **`src/components/tasks/preview/linear-peek-preview-modal.tsx`** *(Tạo mới)*:
   - Component xem nhanh khi nhấn phím `Space` theo đúng Ảnh #8 (Quick Look peek preview).
3. **`src/components/tasks/table/task-context-menu.tsx`** *(Tạo mới)*:
   - Menu chuột phải thao tác nhanh theo đúng Ảnh #7 (Đổi trạng thái, đổi ưu tiên, gán người, đổi hạn chót, sao chép link).
4. **`src/components/tasks/create/linear-create-task-modal.tsx`** *(Tạo mới)*:
   - Modal tạo nhiệm vụ dạng canvas phẳng chuẩn Ảnh #6.
   - Tích hợp Agent Panel chuẩn Ảnh #5 với các quick prompt pills và chức năng tự động điền form.
5. **`src/components/workspace/unified-adaptive-workspace.tsx`**:
   - Tích hợp bộ lắng nghe phím tắt:
     - Giữ `n` rồi bấm `p` (hoặc `n` $\to$ `p`): Mở modal tạo nhiệm vụ.
     - Phím `Space`: Bật/tắt Peek Preview nhiệm vụ đang chọn.
     - Phím `Escape`: Đóng Peek / đóng Modal / quay lại bảng danh sách.
   - Khi có `selectedTask`: Render trực tiếp `LinearTaskDetailView` trên canvas chính thay vì mở `TaskDetailSideSheet` drawer.
6. **`src/components/tasks/table/modular-cascading-task-table.tsx` & `task-row.tsx`**:
   - Chuyển bảng nhiệm vụ sang dạng phẳng (flush table) theo Ảnh #3: Name (icon box + mã/tên), Health, Priority, Lead (Member), Target date, Issues, Status (%).
   - Tích hợp lắng nghe sự kiện `onContextMenu` để kích hoạt `TaskContextMenu`.
   - Bỏ card bọc `rounded-xl border bg-card shadow-2xs`.
7. **`src/components/dashboard/unified-task-toolbar.tsx`**:
   - Tinh giản thành 1 hàng phẳng: Team tabs (Phòng ban), Search bar thanh mảnh, Dropdown tháng, Nút Lọc, Nút Giao việc (kèm badge phím tắt `N P`).
8. **`src/components/layout/app-shell.tsx` & `unified-task-hub-client.tsx`**:
   - Mở rộng canvas lên `max-w-[1600px]`, giảm padding dọc thừa, loại bỏ các lớp bọc `max-w-[1440px]` lồng lặp.

---

## Kế hoạch Xác thực (Verification Plan)

1. **Kiểm tra cú pháp & TypeScript**:
   - Chạy `npx tsc --noEmit` để đảm bảo toàn bộ mã nguồn sạch lỗi types.
2. **Kiểm tra tự động với Vitest / Jest**:
   - Chạy bộ test liên quan đến task workspace & creation:
     ```bash
     npm test -- tests/dashboard-workbench-ux.test.ts tests/tasks-view-kanban.test.ts
     ```
3. **Kiểm tra Build hoàn chỉnh**:
   - Chạy kiểm tra build ứng dụng:
     ```bash
     npm run build
     ```
4. **Kiểm tra trực quan & trải nghiệm người dùng**:
   - Trang `/tasks`: Bảng hiển thị phẳng, sạch sẽ theo mẫu Linear Projects (Ảnh #3), 100% Theme Light.
   - **Click chuột phải**: Kiểm tra menu thao tác nhanh hiện lên chuẩn xác tại vị trí con trỏ (Ảnh #7).
   - **Bấm phím `Space`**: Kiểm tra mở Peek Preview xem nhanh (Ảnh #8), bấm `↑`/`↓` để chuyển nhiệm vụ xem tiếp, bấm `Space` để tắt.
   - **Bấm vào một nhiệm vụ (chuột trái hoặc `Enter`)**: Màn hình chuyển sang Linear Task Detail View (Ảnh #4) thay vì drawer; đầy đủ 2 cột (Content Canvas & Properties Sidebar).
   - **Thử phím tắt `n` + `p`**: Giữ `n` rồi bấm `p` để mở modal Giao việc nhanh (Ảnh #6).
   - **Bấm nút `▷ Tạo cùng Agent`**: Kiểm tra panel Agent trượt mở (Ảnh #5), bấm thử prompt chip hoặc gõ nội dung để Agent tự động điền form.
   - **Bấm `← Nhiệm vụ` hoặc nhấn `Escape`**: Trở về bảng danh sách mượt mà, URL đồng bộ chính xác.
