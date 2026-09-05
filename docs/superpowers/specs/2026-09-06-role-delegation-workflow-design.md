# Thiết Kế Kiến Trúc: Quy Trình Giao Việc & Phân Cấp Trách Nhiệm 3 Cấp (QCET Work)

- **Ngày ban hành:** 2026-09-06
- **Tác giả:** QCET Development Team & Antigravity
- **Căn cứ pháp lý & phương pháp luận:** 
  - Nghị định số 232/2026/NĐ-CP của Chính phủ về vị trí việc làm viên chức trong đơn vị sự nghiệp công lập.
  - Phương pháp phân tích nghề và phân rã công việc DACUM (Developing A CurriculUM / Task Analysis).
  - Quy chế tổ chức và hoạt động Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn.

---

## 1. Mục tiêu & Bối cảnh

### 1.1. Vấn đề giải quyết
Trong môi trường quản lý trường cao đẳng kỹ thuật, cơ chế giao việc thường gặp 2 bất cập lớn:
1. **Giao việc vượt cấp / thiếu thông tin:** Cấp lãnh đạo giao việc trực tiếp xuống nhân viên khiến cán bộ quản lý cấp trung (Trưởng phòng/Trưởng khoa) bị động, không nắm được khối lượng công việc thực tế của nhân sự mình quản lý.
2. **"Cha chung không ai khóc" trong phối hợp liên đơn vị:** Việc cấp trường đòi hỏi nhiều phòng ban cùng làm, nhưng đơn vị chủ trì không có quyền điều phối nhân viên đơn vị phối hợp, dẫn đến đùn đẩy hoặc chậm trễ tiến độ.

### 1.2. Mục tiêu thiết kế
- Chuẩn hóa luồng giao việc và thẩm quyền 3 cấp: **Ban Giám hiệu (Hiệu trưởng) $\rightarrow$ Trưởng phòng / Trưởng khoa $\rightarrow$ Chuyên viên / Giảng viên**.
- Áp dụng nguyên lý DACUM: Phân rã mục tiêu lớn (Duty) thành các gói công việc (Sub-duties) và nhiệm vụ tác nghiệp cụ thể (Staff Tasks) gắn liền với sản phẩm đầu ra (Deliverables).
- Gắn chặt với tiêu chuẩn vị trí việc làm (VTVL) theo Nghị định 232/2026/NĐ-CP: Đánh giá theo sản phẩm/kết quả thực chất thay vì chấm điểm cảm tính.

---

## 2. Mô hình phân tầng dữ liệu (Data Hierarchy)

```
[TẦNG 1: DUTY / STRATEGIC GOAL] - NHIỆM VỤ CẤP TRƯỜNG (School Task)
  │  Người tạo: Hiệu trưởng / BGH (ADMIN)
  │  Thành phần: 1 Đơn vị Chủ trì (Lead Dept) + N Đơn vị Phối hợp (Co-op Depts)
  │  Đặc trưng: Mục tiêu vĩ mô, mốc thời gian toàn trường, tiêu chuẩn nghiệm thu cấp trường.
  │
  ├── [TẦNG 2: WORK PACKAGE / SUB-DUTY] - GÓI CÔNG VIỆC ĐƠN VỊ (Unit Delegation)
  │     Người quản lý: Trưởng đơn vị Chủ trì / Phối hợp (MANAGER)
  │     Hình thức:
  │       a) Gói nhiệm vụ chủ trì: Phân rã thành các Staff Tasks cho nhân viên trong phòng.
  │       b) Phiếu yêu cầu phối hợp (Collaboration Request): Gửi sang Trưởng phòng khác kèm yêu cầu và thời hạn.
  │
  └── [TẦNG 3: OPERATIONAL TASK / DACUM TASK] - TÁC VỤ CỦA VIÊN CHỨC (Staff Task)
        Người thực hiện: Chuyên viên / Giảng viên (STAFF)
        Quy chuẩn:
          - Bắt đầu bằng động từ hành động + đối tượng cụ thể.
          - Gắn với Vị trí việc làm (VTVL) của người nhận.
          - Hạn chót: Phải trước hoặc bằng hạn chót nội bộ đơn vị (Internal Due Date <= School Task Due Date).
          - Sản phẩm đầu ra (Deliverables): File đính kèm, đường dẫn tài liệu, link phần mềm, báo cáo số liệu.
```

---

## 3. Đặc tả vai trò & Logic nghiệp vụ chi tiết

### 3.1. Hiệu trưởng / Ban Giám hiệu (`ADMIN`)
* **Chức năng chính:** Chỉ đạo chiến lược, giao mục tiêu, cấp phát nguồn lực, nghiệm thu cấp trường.
* **Hành vi trên hệ thống:**
  1. **Khởi tạo School Task:**
     - Thiết lập tên nhiệm vụ, danh mục lĩnh vực (`TaskCategory`), căn cứ pháp lý/kế hoạch.
     - Chỉ định Đơn vị Chủ trì (`leadAssigneeName`, `leadDepartment`).
     - Chỉ định các Đơn vị Phối hợp (`coAssignees`, `coDepartments`).
     - Thiết lập thời hạn toàn trường (`dueDate`) và tiêu chuẩn kết quả mong đợi.
  2. **Giám sát điều hành:**
     - Truy cập Dashboard tổng quan: Theo dõi `ExecutiveStatStrip` (tỷ lệ hoàn thành %, việc trễ hạn, cảnh báo điểm nghẽn theo phòng ban).
     - Không hiển thị hàng trăm tác vụ lẻ tẻ của nhân viên; tập trung vào thanh tiến độ tổng hợp theo phòng ban.
  3. **Đôn đốc & Gia hạn:**
     - Gửi thông báo đôn đốc (Nudge) tới Trưởng đơn vị chủ trì khi phát hiện nguy cơ chậm trễ.
     - Phê duyệt gia hạn thời hạn nhiệm vụ cấp trường nếu có tờ trình hợp lệ.
  4. **Nghiệm thu đóng nhiệm vụ:**
     - Khi đơn vị chủ trì báo cáo 100% hoàn tất kèm Báo cáo tổng kết, Hiệu trưởng bấm **Nghiệm thu (`COMPLETED`)** hoặc **Yêu cầu bổ sung/Giải trình (`REQUEST_REVISION`)**.

### 3.2. Trưởng phòng / Trưởng khoa (`MANAGER`)
* **Chức năng chính:** Phân rã nhiệm vụ theo DACUM, điều phối nguồn lực, giao việc nội bộ, giám sát tiến độ và nghiệm thu cấp 1.
* **Hành vi trên hệ thống:**
  1. **Tiếp nhận & Phân rã (Nhiệm vụ cấp Trường mà phòng chủ trì):**
     - Nhận thông báo nhiệm vụ từ BGH.
     - Sử dụng công cụ phân rã (Breakdown): Tạo các `StaffTask` gán đích danh cho nhân viên trong phòng mình dựa trên bản mô tả VTVL.
     - Thiết lập hạn chót nội bộ (luôn sớm hơn hạn chót của trường tối thiểu 2-5 ngày để dự phòng kiểm tra, sửa đổi).
     - Xác định yêu cầu minh chứng bắt buộc cho từng task.
  2. **Cơ chế phối hợp liên phòng ban:**
     - **Nguyên tắc bất biến:** Trưởng phòng A **không được phép** gán việc trực tiếp cho nhân viên phòng B.
     - **Quy trình:** Trưởng phòng A tạo **Phiếu yêu cầu phối hợp** gửi đến tài khoản Trưởng phòng B. Trưởng phòng B tiếp nhận, xem xét khối lượng công việc và tự gán cho nhân viên thuộc phòng B.
  3. **Quản lý việc thường xuyên của đơn vị (`UnitTask`):**
     - Tự tạo và giao các nhiệm vụ nội bộ không thuộc chương trình cấp trường. Các tác vụ này chỉ hiển thị trong nội bộ phòng và tính vào chỉ số hoạt động của đơn vị.
  4. **Tiền nghiệm thu (Duyệt cấp 1):**
     - Nhận thông báo khi nhân viên nộp sản phẩm (`NEEDS_REVIEW`).
     - Kiểm tra minh chứng:
       - Đạt yêu cầu: Duyệt `COMPLETED`, ghi nhận đóng góp KPI cho nhân viên.
       - Chưa đạt yêu cầu: Trả lại (`REJECT`) kèm ghi chú yêu cầu chỉnh sửa, task quay lại trạng thái `IN_PROGRESS`.
  5. **Báo cáo BGH:**
     - Khi tất cả tác vụ thành phần hoàn tất, Trưởng phòng chủ trì tổng hợp hồ sơ và bấm nút **"Trình BGH nghiệm thu"**.

### 3.3. Chuyên viên / Giảng viên / Nhân viên (`STAFF`)
* **Chức năng chính:** Tiếp nhận nhiệm vụ đúng VTVL, thực thi tác nghiệp, cập nhật tiến độ và nộp sản phẩm minh chứng.
* **Hành vi trên hệ thống:**
  1. **Tiếp nhận việc minh bạch:**
     - Danh sách công việc cá nhân (`My Workspace`): Chỉ chứa các việc do Trưởng phòng trực tiếp giao hoặc BGH giao đặc nhiệm.
     - Xem rõ bối cảnh nhiệm vụ: Trực thuộc School Task nào, sản phẩm cần bàn giao là gì, hạn chót khi nào.
  2. **Thực thi tác nghiệp:**
     - Tiếp nhận việc: Chuyển trạng thái từ `NEW` sang `IN_PROGRESS`.
     - Cập nhật tiến độ theo tỷ lệ % và ghi nhật ký công việc (activity logs).
     - Đánh dấu cản trở (`Flag as Blocked`) khi gặp vướng mắc ngoài tầm kiểm soát để Trưởng phòng can thiệp.
  3. **Nộp sản phẩm nghiệm thu:**
     - Không cho phép chuyển sang hoàn thành nếu thiếu minh chứng: Bắt buộc đính kèm tệp tin, đường dẫn tài liệu Google Drive/OneDrive, link hệ thống hoặc báo cáo kết quả.
     - Bấm nộp bài $\rightarrow$ Chuyển sang trạng thái `NEEDS_REVIEW` để Trưởng phòng kiểm tra.

---

## 4. Vòng đời trạng thái (Task State Machine) & Quy tắc Rollup

### 4.1. Vòng đời Staff Task
```
    [ NEW ] ──────────► [ IN_PROGRESS ] ──────────► [ NEEDS_REVIEW ] ──────────► [ COMPLETED ]
       ▲                      │                             │
       │                      │ (Báo vướng mắc)             │ (Trưởng phòng từ chối)
       │                      ▼                             │
       └─────────────── [ BLOCKED ] ◄───────────────────────┘
```
1. `NEW`: Việc mới được giao, nhân viên đã nhận thông báo.
2. `IN_PROGRESS`: Nhân viên đã xác nhận bắt đầu làm, cập nhật tiến độ định kỳ.
3. `BLOCKED`: Đang gặp trở ngại (thiếu thiết bị, đối tác chưa phản hồi), hệ thống bắn cảnh báo cho Trưởng phòng.
4. `NEEDS_REVIEW`: Nhân viên đã đính kèm sản phẩm minh chứng và trình duyệt.
5. `COMPLETED`: Trưởng phòng đã nghiệm thu đạt yêu cầu.

### 4.2. Quy tắc Rollup tiến độ lên School Task
- Tiến độ của 1 School Task (%) = $\frac{\sum \text{Số Subtask đã COMPLETED}}{\text{Tổng số Subtask}} \times 100\%$ (hoặc tính theo trọng số công việc nếu có cấu hình).
- Khi $100\%$ Subtask đạt `COMPLETED`, School Task chuyển sang trạng thái phụ: `PENDING_EXECUTIVE_APPROVAL` (Chờ BGH phê duyệt nghiệm thu toàn trường).

---

## 5. Ma trận phân quyền (RACI Matrix)

| Nghiệp vụ hệ thống | Hiệu trưởng (ADMIN) | Trưởng phòng (MANAGER) | Nhân viên (STAFF) |
| :--- | :---: | :---: | :---: |
| Tạo / Chỉnh sửa Nhiệm vụ cấp Trường | **A** | **C** | **I** |
| Phân rã Subtasks (DACUM Breakdown) | **I** | **A / R** | **I** |
| Giao việc cho nhân viên trong phòng | **A** (Giám sát) | **R** | **I** |
| Giao việc cho nhân viên phòng khác | ❌ *Chặn* (Trừ việc khẩn) | ❌ *Chặn* (Gửi yêu cầu phối hợp) | ❌ *Chặn* |
| Tạo việc nội bộ đơn vị (`UnitTask`) | **I** | **A / R** | ❌ *Chặn* |
| Cập nhật tiến độ & Nộp sản phẩm minh chứng | ❌ | ❌ (Trừ khi tự làm việc cá nhân) | **R** |
| Tiền nghiệm thu công việc nhân viên (Cấp 1) | **I** | **A / R** | ❌ |
| Nghiệm thu & Đóng nhiệm vụ cấp Trường (Cấp 2) | **A / R** | **C** (Trình báo cáo) | **I** |

---

## 6. Xử lý các tình huống ngoại lệ (Edge Cases)

1. **Lệnh khẩn cấp từ Ban Giám hiệu (Bypass Workflow):**
   - Trường hợp Hiệu trưởng cần giao việc gấp cho 1 chuyên viên cụ thể (ví dụ: chuẩn bị hạ tầng mạng cho đoàn thanh tra đột xuất).
   - *Quy tắc hệ thống:* Cho phép ADMIN chọn trực tiếp nhân viên, nhưng hệ thống tự động sinh thông báo khẩn cấp gắn cờ `[CHỈ ĐẠO BGH]` gửi đồng thời cho Trưởng phòng quản lý nhân viên đó để phối hợp bố trí công việc.
2. **Đơn vị phối hợp không phản hồi:**
   - Nếu sau 48 giờ kể từ khi gửi Phiếu phối hợp mà Trưởng phòng B chưa tiếp nhận/phân công, hệ thống tự động gửi nhắc nhở và thông báo cho Trưởng phòng A biết để chủ động đôn đốc. Nếu quá hạn 3 ngày, Trưởng phòng A có quyền báo cáo lên BGH can thiệp.
3. **Thay đổi nhân sự phụ trách (Reassignment):**
   - Khi nhân viên nghỉ phép, ốm đau hoặc chuyển công tác, Trưởng phòng có quyền tái phân công (`Reassign`) việc cho nhân viên khác. Hệ thống bảo lưu toàn bộ lịch sử trao đổi, nhật ký và minh chứng đã nộp trước đó.

---

## 7. Kế hoạch xác minh & Tiêu chuẩn nghiệm thu (Verification Plan)

1. **Kiểm tra ma trận quyền (RBAC Tests):**
   - Đảm bảo STAFF không thể tự tạo School Task hoặc Unit Task.
   - Đảm bảo MANAGER không thể gán trực tiếp nhân viên phòng khác nếu không thông qua Phiếu phối hợp.
   - Đảm bảo STAFF không thể đổi trạng thái thành `COMPLETED` mà bắt buộc phải qua `NEEDS_REVIEW`.
2. **Kiểm tra ràng buộc dữ liệu (Validation Tests):**
   - Không cho phép nộp duyệt (`NEEDS_REVIEW`) khi trường minh chứng (link hoặc file) đang trống.
   - Kiểm tra ràng buộc thời hạn: `StaffTask.dueDate` $\le$ `SchoolTask.dueDate`.
3. **Kiểm tra tính toán Rollup:**
   - Khi các subtask chuyển trạng thái, tiến độ của SchoolTask và thống kê trên `ExecutiveStatStrip` phải được cập nhật tương ứng.
