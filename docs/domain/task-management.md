# QCET E-Office — Đặc Tả Nghiệp Vụ Quản Lý Nhiệm Vụ (Task Management Specification)

**Cơ quan ban hành:** Trường Cao đẳng Kinh tế và Công nghệ Quy Nhơn  (QCET)  
**Tình trạng tài liệu:** Văn bản Chuẩn tắc Miền Nghiệp vụ (Canonical Domain Specification)  
**Phạm vi áp dụng:** Mô hình dữ liệu Prisma, Bộ máy Phân quyền ReBAC (Relationship-Based Access Control), Động cơ Luồng duyệt (Approval Engine), và Kiến trúc Giao tác vụ Liên thông.  
**Căn cứ pháp lý:** 
- Quyết định số 283/QĐ-CĐKTCNQN (Quy chế làm việc của Nhà trường);
- Quyết định số 282/QĐ-CĐKTCNQN (Quy chế tổ chức và hoạt động);
- Quyết định số 203/QĐ-CĐKTCNQN (Quy chế làm việc của Khoa, Phòng, Trung tâm);
- Quyết định số 420/QĐ-CĐKTCNQN (Phân công nhiệm vụ Ban Giám hiệu);
- Nghị định số 30/2020/NĐ-CP (Công tác văn thư và xử lý văn bản);
- Nghị định số 232/2026/NĐ-CP & Nghị định số 106/2020/NĐ-CP (Vị trí việc làm và định mức viên chức).

---

## 1. TỔNG QUAN VÀ NGUYÊN TẮC BẤT BIẾN (CORE INVARIANTS)

Hệ thống Quản lý Nhiệm vụ của QCET E-Office được thiết kế nhằm số hóa toàn diện quy trình điều hành hành chính, học thuật và chuyên môn trong môi trường giáo dục nghề nghiệp công lập. Mọi logic nghiệp vụ, dịch vụ miền (domain services) và API routes xử lý nhiệm vụ đều phải tuân thủ tuyệt đối các nguyên tắc sau:

1. **Role Is Not Scope (Vai trò không phải là Phạm vi xem)**:
   - `Role` đại diện cho quyền lực hành chính của chủ thể (Who can act? - Ai có thẩm quyền làm gì).
   - `Scope` đại diện cho bộ lọc dữ liệu hiển thị (What is being viewed? - Đang nhìn vào tập dữ liệu nào: Toàn trường, Đơn vị hay Cá nhân).
   - Cấp phát sinh nhiệm vụ (`TaskOriginLevel`) phản ánh xuất xứ thẩm quyền ban hành, tuyệt đối không được đánh đồng với Scope xem dữ liệu.
2. **Single DRI Invariant (Chủ trì duy nhất)**:
   - Mỗi nhiệm vụ bất kể quy mô cấp trường hay cấp phòng chỉ có duy nhất **01 cá nhân chịu trách nhiệm chính (Directly Responsible Individual - DRI)**.
   - Tuyệt đối cấm giao việc không có người chủ trì hoặc giao đồng chủ trì ngang hàng không phân định quyền quyết định tối hậu.
3. **Maker-Checker Separation (Nguyên tắc ngăn chặn tự phê duyệt)**:
   - Cán bộ khởi tạo nhiệm vụ, nộp sản phẩm minh chứng (`TaskDeliverable`) hoặc giữ vai trò DRI không được phép tự phê duyệt sản phẩm hoặc tự nghiệm thu hoàn thành nhiệm vụ của chính mình.
   - Thẩm quyền đánh giá (`REVIEWER`) và phê duyệt (`APPROVER`) phải độc lập với người thực thi.
4. **Two-Tier Dispatch Traceability (Truy vết phân phối hai tầng)**:
   - Nhiệm vụ phát sinh từ văn bản hoặc chỉ đạo của Ban Giám hiệu phải tuân thủ luồng phân phối 2 tầng: Cấp Trường giao Đơn vị chủ trì $\rightarrow$ Trưởng ��ơn vị phân bổ cho Cá nhân thụ lý.
   - Quan hệ phụ thuộc cha - con (`parentTaskId` $\rightarrow$ `subTasks`) và quan hệ liên thông văn bản (`linkedDocumentId`, `directiveId`) phải bảo đảm tính toàn vẹn tham chiếu hai chiều.
5. **Server Truth Wins & Zero Synthetic Data (Chân lý máy chủ & Không bịa dữ liệu)**:
   - Toàn bộ trạng thái tiến độ, phê duyệt, phân công và vết kiểm toán đều được xác thực và lưu trữ tại máy chủ cơ sở dữ liệu.
   - Không tạo các trạng thái nhiệm vụ giả lập hoặc số liệu tiến độ ảo không bắt nguồn từ hồ sơ minh chứng thực tế.

---

## 2. CẤP PHÁT SINH NHIỆM VỤ (TASK ORIGIN LEVEL)

Khác với `Scope` (bộ lọc góc nhìn giao diện người dùng), `TaskOriginLevel` là thuộc tính thực thể định danh **Cấp độ thẩm quyền ban hành và tính chất pháp lý khởi tạo của nhiệm vụ**.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TASK ORIGIN LEVEL                                 │
│                   (Thẩm quyền ban hành / Cấp phát sinh)                     │
├───────────────────────┬─────────────────────────┬───────────────────────────┤
│        SCHOOL         │          UNIT           │         PERSONAL          │
│     (Cấp Trường)      │      (Cấp Đơn vị)       │       (Cấp Cá nhân)       │
├───────────────────────┼─────────────────────────┼───────────────────────────┤
│ • Ban Giám hiệu giao  │ • Trưởng đơn vị giao    │ • Viên chức tự đăng ký    │
│ • Nghị quyết, Quyết   │ • Kế hoạch tháng Khoa/  │ • Kế hoạch cá nhân tuần   │
│   định, Lịch tuần     │   Phòng/Trung tâm       │ • Chuẩn bị bài giảng,     │
│ • Bút phê văn bản đến │ • Phân rã nhiệm vụ nội  │   nghiên cứu khoa học     │
│ • Chương trình mục    │   bộ của đơn vị         │ • Tác nghiệp bàn giấy     │
│   tiêu chiến lược     │ • Chuyên môn nghiệp vụ  │   thường nhật             │
└───────────────────────┴─────────────────────────┴───────────────────────────┘
```

### 2.1 Chi tiết 3 Cấp phát sinh

#### A. Cấp Trường (`SCHOOL`)
- **Nguồn phát sinh**:
  1. Ban Giám hiệu trực tiếp chỉ đạo, giao việc qua Lịch công tác tuần hoặc Thông báo kết luận cuộc họp giao ban;
  2. Bút phê của Hiệu trưởng hoặc các Phó Hiệu trưởng trên Văn bản đến (`DocumentDirective` $\rightarrow$ `Task`);
  3. Quyết định của Hội đồng trường hoặc Ban Giám hiệu về các chương trình, đề án, tuần lễ tuyển sinh, kiểm định chất lượng đào tạo;
  4. Các nhiệm vụ đột xuất do Tỉnh ủy, UBND Tỉnh , Bộ GD&ĐT hoặc Sở LĐ-TB&XH giao trực tiếp cho QCET.
- **Tính chất pháp trị**:
  - Có mã định danh văn bản hoặc số quyết định kèm theo;
  - Đơn vị chủ trì (`LEAD_UNIT`) bắt buộc phải là một Phòng, Khoa hoặc Trung tâm trực thuộc;
  - Được giám sát trực tiếp trên Khoang Chỉ huy Ban Giám hiệu (`ExecutiveCockpit`);
  - Được tính vào mẫu số nhiệm vụ cấp trường (`Institutional Denominator`) khi tổng hợp báo cáo tỷ lệ hoàn thành công tác năm học của toàn trường.

#### B. Cấp Đơn vị (`UNIT`)
- **Nguồn phát sinh**:
  1. Trưởng khoa, Trưởng phòng, Giám đốc Trung tâm giao cho cán bộ, giảng viên, chuyên viên thuộc thẩm quyền quản lý;
  2. Phân rã nội bộ từ một nhiệm vụ cấp trường (`subTasks` của một `SCHOOL` task mẹ) do đơn vị được giao chủ trì;
  3. Kế hoạch công tác tháng, chương trình sinh hoạt bộ môn chuyên môn, kế hoạch bảo dưỡng thiết bị định kỳ của xưởng thực hành;
  4. Các giao dịch công vụ phát sinh giữa các bộ môn, tổ công tác nội bộ đơn vị.
- **Tính chất pháp trị**:
  - Giao việc theo thẩm quyền quy định tại Quyết định số 203/QĐ-CĐKTCNQN;
  - Chỉ giới hạn phạm vi trách nhiệm và nhân sự trong nội bộ đơn vị (trừ trường hợp mời chuyên gia phối hợp theo văn bản);
  - Được tính vào mẫu số nhiệm vụ cấp đơn vị (`Operational Denominator`) khi đánh giá thi đua tháng của Khoa/Phòng.

#### C. Cấp Cá nhân (`PERSONAL`)
- **Nguồn phát sinh**:
  1. Giảng viên, chuyên viên tự khởi tạo để quản lý công việc chuyên môn cá nhân (chu���n bị giáo án, soạn thảo đề cương, nghiên cứu khoa học cá nhân, chấm bài thi, tự bồi dưỡng nghiệp vụ);
  2. Nhiệm vụ ghi chép tác nghiệp thường nhật (Desk agenda items) không yêu cầu phê duyệt từ cấp trên;
  3. Các sáng kiến đổi mới phương pháp giảng dạy đăng ký theo học kỳ.
- **Tính chất pháp trị**:
  - Không bắt buộc phải gắn với văn bản đến hay quyết định giao việc;
  - Không tham gia vào mẫu số chỉ tiêu chung của Nhà trường trừ khi được Trưởng đơn vị nghiệm thu chuyển thành công việc chính thức trong Đề án vị trí việc làm (DACUM matrix);
  - Cho phép người tạo tự đánh dấu hoàn thành nếu không cấu hình luồng duyệt.

### 2.2 Ma trận phân định: Task Origin Level vs. View Scope

| Tiêu chí so sánh | Task Origin Level (`originLevel`) | Dataset View Scope (`scope`) |
|---|---|---|
| **Bản chất** | **Xuất xứ quyền lực & Trách nhiệm pháp trị** | **Bộ lọc hiển thị giao diện tác nghiệp** |
| **Giá trị hợp lệ** | `SCHOOL`, `UNIT`, `PERSONAL` | `school` (Toàn trường), `unit` (Đơn vị), `my` (Cá nhân) |
| **Thời điểm xác định** | Xác lập tại thời điểm khởi tạo, bất biến trừ khi có quyết định nâng cấp thẩm quyền | Do người dùng chủ động chuyển đổi tức thời trên thanh công cụ Workspace |
| **Tác động quyền hạn** | Xác định ai có quyền duyệt, ai chịu trách nhiệm pháp lý, báo cáo lên cấp nào | Không thay đổi thẩm quyền người dùng; chỉ lọc danh sách dòng hiển thị |
| **Ví dụ tương quan** | Một task có `originLevel = SCHOOL` giao cho Khoa CNTT. | Hiệu trưởng chọn scope `school` để thấy toàn cảnh; Trưởng khoa chọn scope `unit` để theo dõi; Giảng viên được giao làm DRI chọn scope `my` để tập trung làm bài. |

---

## 3. MÔ HÌNH CHỦ THỂ NHIỆM VỤ THEO ReBAC (RELATIONSHIP-BASED ACCESS CONTROL)

QCET E-Office áp dụng mô hình **Kiểm soát truy cập dựa trên mối quan hệ (ReBAC)** để quản lý chính xác từng vai trò tác nghiệp trong một nhiệm vụ. Mỗi mối quan hệ giữa một Thực thể (User hoặc Department) và một Nhiệm vụ (Task) được định danh rõ ràng, bảo đảm phản ánh đúng cơ chế thủ trưởng và chế độ phân công viên chức.

```
                                  ┌───────────────────────────┐
                                  │      ASSIGNER (Leader)    │
                                  │       (Người giao việc)   │
                                  └─────────────┬─────────────┘
                                                │ Giao nhiệm vụ
                                                ▼
┌──────────────────────────┐      ┌───────────────────────────┐      ┌──────────────────────────┐
│ LEAD_UNIT (Khoa/Phòng)   │◄────►│  TASK (Nhiệm vụ cụ thể)   │◄────►│ COORDINATING_UNIT (ĐVPH) │
│ (Đơn vị chủ trì)         │      └─────────────┬─────────────┘      │ (Đơn vị phối hợp)        │
└────────────┬─────────────┘                    │                    └─────────────┬────────────┘
             │ Bổ nhiệm DRI                     │                                  │ Cử cán bộ
             ▼                                  ▼                                  ▼
┌──────────────────────────┐      ┌───────────────────────────┐      ┌──────────────────────────┐
│ DRI (Primary Owner)      │      │ FOLLOWER / REVIEWER       │      │ COLLABORATOR (Thành viên)│
│ (01 Người chịu TN chính) │      │ APPROVER / OBSERVER       │      │ (Cán bộ phối hợp)        │
└──────────────────────────┘      └───────────────────────────┘      └──────────────────────────┘
```

### 3.1 Danh mục 9 Chủ thể Quan hệ (ReBAC Actor Roles)

#### 1. `ASSIGNER` (Người giao việc)
- **Định danh**: Cán bộ lãnh đạo trực tiếp ban hành nhiệm vụ (Hiệu trưởng, Phó Hiệu trưởng hoặc Trưởng/Phó đơn vị).
- **Thẩm quyền ReBAC**:
  - Có toàn quyền điều chỉnh nội dung, mục tiêu, tiêu chí nghiệm thu và hạn chót (`dueDate`);
  - Có quyền thu hồi, hủy bỏ (`CANCEL`), hoặc tạm dừng nhiệm vụ;
  - Có quyền chỉ định hoặc điều chuyển Đơn vị chủ trì và DRI;
  - Có quyền can thiệp vào các bước phê duyệt khi phát sinh ách tắc (Executive Bottleneck Resolution).

#### 2. `LEAD_UNIT` (Đơn vị chủ trì)
- **Định danh**: Phòng ban, Khoa hoặc Trung tâm chịu trách nhiệm toàn diện trước Ban Giám hiệu về kết quả thực hiện nhiệm vụ.
- **Thẩm quyền ReBAC**:
  - Trưởng đơn vị chủ trì có thẩm quyền tối cao trong việc phân rã nhiệm vụ thành các subtask;
  - Chỉ định và thay đổi nhân sự DRI thuộc thẩm quyền quản lý của đơn vị;
  - Giám sát tiến độ của toàn bộ thành viên trong đơn vị và các đơn vị phối hợp;
  - Chịu trách nhiệm tổng hợp hồ sơ công việc và đại diện ký báo cáo nghiệm thu.

#### 3. `COORDINATING_UNIT` (Đơn vị phối hợp)
- **Định danh**: Một hoặc nhiều Phòng ban, Khoa, Trung tâm được giao trách nhiệm phối hợp thực hiện theo chỉ đạo của BGH hoặc theo quy chế phối hợp công tác giữa các đơn vị.
- **Thẩm quyền ReBAC**:
  - Trưởng đơn vị phối hợp có quyền cử cán bộ thuộc đơn vị mình tham gia làm `COLLABORATOR` trong nhiệm vụ;
  - Theo dõi các hạng mục công việc mà đơn vị mình phụ trách đóng góp;
  - Cung cấp số liệu, hồ sơ chuyên môn thuộc phạm vi quản lý của đơn vị mình cho Đơn vị chủ trì.

#### 4. `DRI` (Directly Responsible Individual - Người chịu trách nhiệm chính)
- **Định danh**: **Chính xác 01 cá nhân** (Viên chức, Giảng viên hoặc Chuyên viên) được giao quyền chủ trì trực tiếp triển khai nhiệm vụ.
- **Bất biến hệ thống (System Invariant)**:
  $$\forall \text{Task } T, \quad \left| \{ u \in \text{Users} \mid \text{Rel}(u, T) = \text{DRI} \} \right| = 1$$
  Cấm hoàn toàn việc tạo task có $0$ DRI hoặc $> 1$ DRI.
- **Thẩm quyền ReBAC**:
  - Là người duy nhất có quyền cập nhật tỷ lệ phần trăm tiến độ (`progressPercent`);
  - Khởi tạo và phân công các nhiệm vụ con phụ trợ (`subTasks`);
  - Tải lên sản phẩm minh chứng chính thức (`TaskDeliverable`);
  - Yêu cầu người phối hợp nộp minh chứng thành phần;
  - Gửi yêu cầu chuyển bước phê duyệt (`Submit for Review / Approval`);
  - Chịu trách nhiệm chính về việc lập và nộp lưu Hồ sơ công việc điện tử (`WorkDossier`).

#### 5. `COLLABORATOR` (Người phối hợp thực hiện)
- **Định danh**: Các cá nhân được phân công tham gia giải quyết một hoặc một số phần việc thuộc nhiệm vụ.
- **Thẩm quyền ReBAC**:
  - Xem toàn bộ nội dung và tài liệu trao đổi của nhiệm vụ;
  - Tải lên các tệp dữ liệu, báo cáo chuyên môn thành phần phục vụ cho DRI tổng hợp;
  - Bình luận, trao đổi nghiệp vụ trong phạm vi nhiệm vụ;
  - Không có quyền thay đổi tiến độ tổng thể của nhiệm vụ hoặc gửi duyệt nghiệm thu toàn bộ task.

#### 6. `FOLLOWER` (Người theo dõi / đôn đốc)
- **Định danh**: Cán bộ theo dõi tiến độ tổng hợp (Ví dụ: Chuyên viên tổng hợp Phòng Hành chính - Quản trị, Chuyên viên theo dõi tiến độ đào tạo Phòng QLĐT, Thư ký Ban Giám hiệu).
- **Thẩm quyền ReBAC**:
  - Nhận thông báo tự động (App & Telegram) khi nhiệm vụ có cập nhật tiến độ, nộp minh chứng hoặc có nguy cơ trễ hạn;
  - Phát lệnh nhắc nhở, đôn đốc (`Nudge / Ping DRI`) gửi thông báo trực tiếp đến thiết bị cá nhân của DRI;
  - Đánh dấu tình trạng rủi ro tắc nghẽn (`Flag Bottleneck`) để trình Lãnh đạo can thiệp;
  - Không can thiệp vào nội dung chuyên môn hay kết quả đánh giá.

#### 7. `REVIEWER` (Người đánh giá chuyên môn)
- **Định danh**: Cá nhân hoặc thành viên Tiểu ban chuyên môn có trách nhiệm thẩm định chất lượng sản phẩm trước khi trình ký/trình duyệt chính thức (Ví dụ: Trưởng bộ môn thẩm định đề cương, Chuyên viên thanh tra thẩm tra hồ sơ thi).
- **Thẩm quyền ReBAC**:
  - Thẩm tra nội dung các tệp minh chứng (`TaskDeliverable`);
  - Ghi nhận xét, đánh giá chuyên môn chi tiết (`reviewNote`);
  - Quyết định xác nhận đạt (`PASSED`) hoặc yêu cầu chỉnh sửa bổ sung (`REVISION_REQUIRED`);
  - **Maker-Checker Invariant**: `REVIEWER` $\neq$ `DRI` và `REVIEWER` $\neq$ `COLLABORATOR` (người nộp sản phẩm).

#### 8. `APPROVER` (Người phê duyệt nghiệm thu)
- **Định danh**: Người có thẩm quyền hành chính quyết định nghiệm thu hoàn thành nhiệm vụ (Trưởng phòng/Trưởng khoa đối với task cấp đơn vị; Hiệu trưởng hoặc Phó Hiệu trưởng phụ trách đối với task cấp trường).
- **Thẩm quyền ReBAC**:
  - Ký duyệt nghiệm thu chính thức (`APPROVE`);
  - Bác bỏ kết quả và yêu cầu làm lại (`REJECT`);
  - Chuyển trạng thái nhiệm vụ sang `COMPLETED`;
  - Ban hành văn bản kết luận hoặc xác nhận hoàn thành định mức giờ chuẩn DACUM;
  - **Maker-Checker Invariant**: `APPROVER` $\neq$ `DRI`.

#### 9. `OBSERVER` (Nhận để biết / Giám sát thụ động)
- **Định danh**: Các cá nhân hoặc lãnh đạo các đơn vị liên quan cần nắm bắt thông tin phục vụ công tác điều hành chung nhưng không tham gia tác nghiệp.
- **Thẩm quyền ReBAC**:
  - Quyền xem chỉ đọc (`Read-Only`) toàn bộ tiến trình và hồ sơ nhiệm vụ;
  - Không nhận thông báo đôn đốc tác nghiệp dồn dập;
  - Không có quyền chỉnh sửa, nộp bài, đánh giá hay phê duyệt.

### 3.2 Ma trận Quyền Hạn ReBAC (ReBAC Permission Matrix)

| Hành động nghiệp vụ / Thao tác | ASSIGNER | LEAD_UNIT (Head) | DRI | COLLABORATOR | FOLLOWER | REVIEWER | APPROVER | OBSERVER |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Xem chi tiết nhiệm vụ & tiến độ** | Có | Có | Có | Có | Có | Có | Có | Có |
| **Chỉnh sửa tiêu đề, mô tả, hạn chót** | Có | Có | Không | Không | Không | Không | Không | Không |
| **Điều chỉnh % tiến độ (Progress)** | Có | Có | **Có** | Không | Không | Không | Không | Không |
| **Tải lên sản phẩm nghiệm thu chính** | Không | Không | **Có** | Không | Không | Không | Không | Không |
| **Tải lên minh chứng thành phần** | Không | Không | Có | **Có** | Không | Không | Không | Không |
| **Phân công / Thay đổi COLLABORATOR** | Có | Có | **Có** | Không | Không | Không | Không | Không |
| **Thêm / Xóa người theo dõi (OBSERVER)** | **Có** | **Có** | Không | Không | Không | Không | Không | Không |
| **Phát lệnh đôn đốc / Nhắc việc** | Có | Có | Không | Không | **Có** | Không | Không | Không |
| **Thẩm tra chuyên môn (Review)** | Không | Không | Không | Không | Không | **Có** | Không | Không |
| **Phê duyệt nghiệm thu (Approve)** | Có | Có (Cấp ĐV) | Không | Không | Không | Không | **Có** | Không |
| **Bác bỏ / Yêu cầu làm lại (Reject)**| Có | Có (Cấp ĐV) | Không | Không | Không | Có | **Có** | Không |
| **Đóng nhiệm vụ & Nộp lưu hồ sơ** | Có | Có | **Có** | Không | Không | Không | Có | Không |
| **Hủy bỏ nhiệm vụ (Cancel)** | **Có** | Có (Cấp ĐV) | Không | Không | Không | Không | Có (BGH) | Không |

---

## 4. QUY TRÌNH PHÊ DUYỆT NHIỆM VỤ ĐA CẤP LINH HOẠT (DYNAMIC MULTI-STEP APPROVAL PROCESS)

Hệ thống QCET E-Office kiên quyết **loại bỏ mô hình phê duyệt cứng nhắc 3 cấp cố định (Chuyên viên $\rightarrow$ Trưởng phòng $\rightarrow$ Admin/BGH)**. Trong thực tế quản trị đại học công lập, các nhiệm vụ có mức độ rủi ro, danh mục quản lý và tính chất pháp lý khác nhau đòi hỏi các luồng phê duyệt thích ứng theo rủi ro và danh mục (Risk-based & Portfolio-based Approval Flows).

```
[Khởi tạo & Thực hiện] ──► [DRI nộp sản phẩm] ──► {Định tuyến theo Risk & Portfolio}
                                                              │
   ┌──────────────────────────────────────────────────────────┴───────────────────────────────────────────────────────┐
   ▼ (Rủi ro Thấp - Thường quy)                               ▼ (Rủi ro Trung bình - Liên phòng)                      ▼ (Rủi ro Cao - Chiến lược/Tài chính)
┌─────────────────────────┐                                ┌─────────────────────────┐                             ┌─────────────────────────┐
│ Bước 1: Trưởng đơn vị   │                                │ Bước 1: Thẩm định viên  │                             │ Bước 1: Trưởng đơn vị   │
│ duyệt nghiệm thu        │                                │ chuyên môn sơ duyệt     │                             │ sơ duyệt hồ sơ          │
└────────────┬────────────┘                                └────────────┬────────────┘                             └────────────┬────────────┘
             │ Hoàn thành                                               │ Đạt                                                   │ Đạt
             ▼                                                          ▼                                                       ▼
      [COMPLETED]                                          ┌─────────────────────────┐                             ┌─────────────────────────┐
                                                           │ Bước 2: Trưởng đơn vị   │                             │ Bước 2: Phòng chức năng │
                                                           │ chủ trì phê duyệt       │                             │ thẩm tra chuyên môn     │
                                                           └────────────┬────────────┘                             └────────────┬────────────┘
                                                                        │ Hoàn thành                                            │ Đạt
                                                                        ▼                                                       ▼
                                                                 [COMPLETED]                                       ┌─────────────────────────┐
                                                                                                                   │ Bước 3: Ban Giám hiệu   │
                                                                                                                   │ phê duyệt tối hậu       │
                                                                                                                   └────────────┬────────────┘
                                                                                                                                │ Hoàn thành
                                                                                                                                ▼
                                                                                                                         [COMPLETED]
```

### 4.1 Bốn Luồng Phê Duyệt Chuẩn Hóa Theo Danh Mục & Rủi Ro

#### Luồng 1: Tác nghiệp Thường xuyên / Rủi ro Thấp (`OPERATIONAL_LOW_RISK`)
- **Phạm vi áp dụng**: 
  - Tác vụ nội bộ phòng ban;
  - Báo cáo định kỳ tuần;
  - Cập nhật số liệu hành chính thông thường;
  - Bảo dưỡng kỹ thuật thường xuyên.
- **Quy trình luồng (1 cấp)**:
  $$\text{DRI (Nộp minh chứng)} \xrightarrow{\quad} \text{Trưởng Đơn vị / Phó được ủy quyền (Nghiệm thu \& Đóng task)}$$
- **Thời hạn chuẩn (SLA)**: Phê duyệt trong vòng 24 giờ làm việc.

#### Luồng 2: Nghiệp vụ Liên Phòng / Rủi ro Trung bình (`TACTICAL_MEDIUM_RISK`)
- **Phạm vi áp dụng**:
  - Tổ chức hội thảo cấp trường;
  - Biên soạn đề cương chi tiết học phần;
  - Kế hoạch thực tập doanh nghiệp của sinh viên;
  - Mua sắm vật tư tiêu hao xưởng thực hành theo hạn mức thường xuyên.
- **Quy trình luồng (2 cấp)**:
  1. **Bước 1 (Review)**: Cán bộ Thẩm định chuyên môn hoặc Trưởng đơn vị phối hợp xác nhận tính đầy đủ, hợp lệ của sản phẩm (`REVIEWER`).
  2. **Bước 2 (Approve)**: Trưởng đơn vị chủ trì phê duyệt nghiệm thu chính thức (`APPROVER`).
- **Thời hạn chuẩn (SLA)**: Mỗi bước tối đa 48 giờ làm việc.

#### Luồng 3: Chiến lược, Tài chính & Quản trị Toàn trường (`STRATEGIC_HIGH_RISK`)
- **Phạm vi áp dụng**:
  - Báo cáo tài chính, quyết toán ngân sách quý/năm;
  - Đề án vị trí việc làm, quy hoạch nhân sự và thi đua khen thưởng;
  - Đầu tư mua sắm trang thiết bị lớn, sửa chữa cơ sở vật chất lớn;
  - Đề án mở ngành đào tạo mới hoặc thẩm định chuẩn đầu ra;
  - Các nhiệm vụ thực hiện theo Bút phê chỉ đạo trực tiếp của Hiệu trưởng.
- **Quy trình luồng (3 cấp)**:
  1. **Bước 1 (Sơ duyệt Đơn vị)**: Trưởng đơn vị chủ trì kiểm tra, hoàn thiện hồ sơ và ký xác nhận đề xuất.
  2. **Bước 2 (Thẩm tra Chức năng)**: Phòng chức năng liên quan (Phòng Tài chính thẩm định dự toán; Phòng QLĐT thẩm định chương trình; Phòng TC-ĐBCL thẩm định hồ sơ nhân sự/chất lượng) kiểm tra tính pháp lý và ký xác nhận.
  3. **Bước 3 (Phê duyệt Tối hậu)**: Hiệu trưởng hoặc Phó Hiệu trưởng phụ trách lĩnh vực (theo QĐ 420) ký số phê duyệt và kết thúc nhiệm vụ.
- **Thời hạn chuẩn (SLA)**: Bước 1 (24h) $\rightarrow$ Bước 2 (48h) $\rightarrow$ Bước 3 (48h).

#### Luồng 4: Hội đồng Học thuật & Khoa học Chuyên môn (`ACADEMIC_COMMITTEE`)
- **Phạm vi áp dụng**:
  - Nghiệm thu đề tài Nghiên cứu khoa học cấp trường;
  - Thẩm định giáo trình, bài giảng, tài liệu đào tạo số;
  - Đánh giá hồ sơ ngân hàng câu hỏi thi, đề thi tốt nghiệp;
  - Xét tốt nghiệp và công nhận học vị cho học sinh sinh viên.
- **Quy trình luồng (Hội đồng đa phương)**:
  1. **Bước 1 (Tiểu ban Chuyên môn)**: Các thành viên phản biện và Chủ tịch Hội đồng chuyên môn cho điểm, lập Biên bản nghiệm thu chuyên môn.
  2. **Bước 2 (Tổng hợp Quản lý)**: Phòng Quản lý Đào tạo kiểm tra điều kiện, tổng hợp kết quả.
  3. **Bước 3 (Ban Giám hiệu)**: Phó Hiệu trưởng Đào tạo (hoặc Hiệu trưởng) ký quyết định công nhận k���t quả.

### 4.2 Máy Trạng Thái Của Tiến Trình Phê Duyệt (State Transition Engine)

Mỗi nhiệm vụ có một trạng thái tác nghiệp chính (`status`) và trạng thái con phục vụ phê duyệt (`approvalStatus`):

```
┌──────────────┐     Nhận việc      ┌──────────────┐     Nộp minh chứng     ┌────────────────────────┐
│ NOT_STARTED  │ ─────────────────► │ IN_PROGRESS  │ ─────────────────────► │  SUBMITTED_FOR_REVIEW  │
└──────────────┘                    └──────▲───────┘                        └───────────┬────────────┘
                                           │                                            │
                                           │ Yêu cầu bổ sung                            │ Bắt đầu thẩm định
                                           │ (REVISION_REQUIRED)                        ▼
                                           │                                ┌────────────────────────┐
                                           ├─────────────────────────────── │       IN_REVIEW        │
                                           │                                └───────────┬────────────┘
                                           │                                            │
                                           │                                            │ Chuyên môn đạt (PASSED)
                                           │                                            ▼
                                           │ Yêu cầu sửa đổi                ┌────────────────────────┐
                                           ├─────────────────────────────── │    PENDING_APPROVAL    │
                                           │                                └───────────┬────────────┘
                                           │                                            │
                                           │ Bác bỏ                                     │ Phê duyệt (APPROVED)
                                    ┌──────┴───────┐                                    ▼
                                    │   REJECTED   │                        ┌────────────────────────┐
                                    └──────────────┘                        │       COMPLETED        │
                                                                            └────────────────────────┘
```

1. `NOT_STARTED` (Chưa bắt đầu): Nhiệm vụ đã khởi tạo, phân công người chủ trì nhưng chưa có hoạt động triển khai.
2. `IN_PROGRESS` (Đang thực hiện): DRI đã nhận việc, đang triển khai, tiến độ $0\% < \text{Progress} < 100\%$.
3. `SUBMITTED_FOR_REVIEW` (Đã nộp chờ thẩm định): DRI hoàn tất và nộp sản phẩm minh chứng lên hệ thống.
4. `IN_REVIEW` (Đang thẩm định chuyên môn): Người đánh giá (`REVIEWER`) đang kiểm tra tính chuẩn tắc của hồ sơ.
5. `PENDING_APPROVAL` (Chờ phê duyệt lãnh đạo): Đã qua bước đánh giá chuyên môn, đang chờ Lãnh đạo có thẩm quyền ký duyệt.
6. `REVISION_REQUIRED` (Yêu cầu chỉnh sửa): Người duyệt hoặc thẩm định từ chối và ghi rõ lý do, task quay về `IN_PROGRESS` để DRI sửa đổi.
7. `APPROVED` $\rightarrow$ `COMPLETED` (Đã duyệt hoàn thành): Hồ sơ đạt chuẩn, task kết thúc thành công, khóa tính năng sửa đổi, sẵn sàng nộp lưu hồ sơ công việc.
8. `REJECTED` (Bị bác bỏ): Nhiệm vụ không đạt yêu cầu nghiêm trọng hoặc không còn phù hợp, chuyển trạng thái đóng thất bại có lưu vết kiểm toán.

### 4.3 Cơ Chế Ủy Quyền Phê Duyệt (Delegation Invariants)

Áp dụng mô hình chuẩn quản trị đại học tiên tiến qua thực thể `DacumDelegation`:
- **Ủy quyền có thời hạn & phạm vi**: Trưởng đơn vị có thể ủy quyền cho Phó Trưởng đơn vị phê duyệt nhiệm vụ trong thời gian công tác. Giao dịch ủy quyền bắt buộc phải có `startDate`, `expiresAt` và căn cứ văn bản `documentRef`.
- **Chống tự phê duyệt qua ủy quyền**:
  $$\text{If } \text{Task.DRI} == \text{DelegateId} \implies \text{Delegate cannot approve this Task (HTTP 403 Forbidden)}$$
- **Kiểm toán bất biến**: Mọi quyết định duyệt qua ủy quyền phải ghi nhận rõ danh tính người được ủy quyền (`delegateId`) và người giao ủy quyền (`grantorId`) trong bảng kiểm toán.

---

## 5. CƠ CHẾ LIÊN THÔNG VĂN BẢN VÀ BÚT PHÊ CHỈ ĐẠO (TWO-TIER DISPATCH LINKAGE)

Sự kết nối giữa Công tác Văn thư (Nghị định 30/2020/NĐ-CP) và Quản lý Nhiệm vụ được thực thi thông qua **Cơ chế Phân phối Hai tầng (Two-Tier Dispatch)**.

```
══════════════════════════════════════════════════════════════════════════════════════
TIER 1: CẤP TRƯỜNG ──► ĐƠN VỊ CHỦ TRÌ (School Leader to Department)
══════════════════════════════════════════════════════════════════════════════════════
[Văn bản Đến từ ngoài] 
        │
        ▼
[Văn thư cơ quan đăng ký vào Sổ Đến] (Đánh số liên tục theo năm, lưu trữ SHA-256 PDF)
        │
        ▼
[Trình Ban Giám hiệu] (Phân tuyến theo lĩnh vực QĐ 420)
        │
        ▼
[Ban Giám hiệu ghi Bút phê điện tử (DocumentDirective)]
  • Đơn vị chủ trì: LEAD_UNIT (Ví dụ: Phòng QLĐT)
  • Đơn vị phối hợp: COORDINATING_UNIT (Ví dụ: Khoa CNTT, Phòng HC-QT)
  • Thời hạn giải quyết: deadline
  • Nội dung chỉ đạo: instruction
        │
        ▼
[HỆ THỐNG TỰ ĐỘNG SINH NHIỆM VỤ CẤP TRƯỜNG]
  • Task ID: T-2026-SCHOOL-XXXX
  • Origin Level: SCHOOL
  • Department: Phòng QLĐT
  • Status: NOT_STARTED
  • Linked Document: Document.id
  • Assigner: Lãnh đạo BGH ký bút phê

══════════════════════════════════════════════════════════════════════════════════════
TIER 2: ĐƠN VỊ CHỦ TRÌ ──► CÁ NHÂN THỤ LÝ (Department Head to Individual Staff)
══════════════════════════════════════════════════════════════════════════════════════
[Trưởng đơn vị tiếp nhận nhiệm vụ trong 24h]
        │
        ▼
[Phân rã nhiệm vụ nội bộ (Task Decomposition)]
  • Bổ nhiệm DRI duy nhất: Chuyên viên Nguyễn Văn A (Mã ngạch VCDC)
  • Bổ nhiệm Collaborator: Giảng viên Trần Thị B (Mã ngạch VCMN)
  • Sinh các Subtasks con nếu công việc phức tạp (parentTaskId = T-2026-SCHOOL-XXXX)
  • Gắn mã định mức DACUM (dacumTaskDefId) và quy chuẩn sản phẩm yêu cầu
        │
        ▼
[Cá nhân DRI & Collaborator triển khai]
  • Tiếp nhận thông báo tức thời (In-App Notification & Telegram)
  • Lập Hồ sơ công việc điện tử (WorkDossier)
  • Nộp sản phẩm minh chứng (TaskDeliverable)
        │
        ▼
[Nghiệm thu hoàn thành 2 cấp]
  • Trưởng đơn vị nghiệm thu sản phẩm của DRI
  • Đơn vị soạn thảo Văn bản đi phúc đáp / Báo cáo kết quả
  • Ban Giám hiệu ký số phê duyệt báo cáo
  • Trạng thái Văn bản đến tự động cập nhật: HOAN_THANH
```

### 5.1 Nguyên Tắc Vận Hành Hai Tầng

1. **Cam kết tiếp nhận trong 24h (24-Hour Intake SLA)**:
   - Khi Ban Giám hiệu ban hành `DocumentDirective`, Trưởng đơn vị chủ trì có trách nhiệm trong vòng **24 giờ làm việc** phải thực hiện phân công cán bộ chủ trì (`DRI`) trên hệ thống.
   - Nếu quá 24h chưa phân công, hệ thống tự động gắn cờ cảnh báo tắc nghẽn (`DISPATCH_DELAY_BOTTLENECK`) và gửi thông báo nhắc nhở đến Trưởng đơn vị và Thư ký Ban Giám hiệu.
2. **Tính toàn vẹn liên kết hai chiều (Bidirectional Traceability)**:
   - Từ bất kỳ văn bản đến nào, Ban Giám hiệu có thể mở cây nhiệm vụ (`TaskTree`) để kiểm tra tức thời: Nhiệm vụ đang ở đơn vị nào? Cán bộ nào làm DRI? Tiến độ đạt bao nhiêu %? Đã quá hạn bao nhiêu ngày?
   - Từ bất kỳ nhiệm vụ nào được sinh ra từ văn bản, cán bộ thực thi có thể bấm vào liên kết gốc để xem toàn bộ nội dung văn bản đến, tệp đính kèm scan màu có dấu đỏ và toàn bộ quá trình bút phê chỉ đạo của Lãnh đạo Trường.
3. **Đồng bộ vòng đời tự động (Automated Lifecycle Synchronization)**:
   - Khi một văn bản đến được giải quyết xong, điều kiện để văn bản chuyển trạng thái thành `DA_XU_LY` hoặc `HOAN_THANH` là:
     * Toàn bộ các nhiệm vụ liên kết (`linkedTaskId` và các `subTasks` con) phải đạt trạng thái `COMPLETED`;
     * Đã có dự thảo Văn bản Đi phúc đáp hoặc Báo cáo kết quả đính kèm trong hồ sơ nhiệm vụ;
     * Hồ sơ công việc điện tử đã được DRI đóng gói hợp lệ.

---

## 6. ĐẶC TẢ MÔ HÌNH DỮ LIỆU PRISMA (DATA MODEL EXTENSION SPECIFICATION)

Để hiện thực hóa toàn bộ các yêu cầu nghiệp vụ trên, schema Prisma được định nghĩa mở rộng với các kiểu dữ liệu enum và mô hình quan hệ chuẩn tắc:

```prisma
// ===================================================
// ENUMS FOR TASK MANAGEMENT & REBAC
// ===================================================

enum TaskOriginLevel {
  SCHOOL    // Nhiệm vụ cấp Trường (BGH giao, Bút phê VB đến, Nghị quyết trường)
  UNIT      // Nhiệm vụ cấp Đơn vị (Trưởng phòng/Khoa giao, Kế hoạch nội bộ)
  PERSONAL  // Nhiệm vụ cấp Cá nhân (Tự quản lý tác nghiệp, nghiên cứu độc lập)
}

enum TaskActorRole {
  ASSIGNER          // Người giao việc (Lãnh đạo BGH / Lãnh đạo Đơn vị)
  LEAD_UNIT         // Đơn vị chủ trì (Khoa/Phòng/Trung tâm)
  COORDINATING_UNIT // Đơn vị phối hợp
  DRI               // Người chịu trách nhiệm chính (Exactly ONE primary owner)
  COLLABORATOR      // Người phối hợp thực hiện
  FOLLOWER          // Người theo dõi / đôn đốc tổng hợp
  REVIEWER          // Người đánh giá chuyên môn
  APPROVER          // Người phê duyệt nghiệm thu
  OBSERVER          // Nhận để biết / Giám sát thụ động
}

enum ApprovalRiskTier {
  OPERATIONAL_LOW_RISK  // Rủi ro thấp - 1 cấp (Trưởng đơn vị chủ trì)
  TACTICAL_MEDIUM_RISK  // Rủi ro trung bình - 2 cấp (Thẩm định viên chuyên môn -> Trưởng đơn vị)
  STRATEGIC_HIGH_RISK   // Rủi ro cao - 3 cấp (Trưởng đơn vị -> Phòng chức năng -> Ban Giám hiệu)
  ACADEMIC_COMMITTEE    // Hội đồng học thuật & chuyên môn đa phương
}

enum ApprovalStepStatus {
  PENDING
  IN_REVIEW
  APPROVED
  REVISION_REQUIRED
  REJECTED
  SKIPPED
}

// ===================================================
// TASK ENTITY REBAC EXTENSIONS
// ===================================================

model Task {
  id                  String               @id @default(cuid())
  code                String               @unique @db.VarChar(50)
  title               String               @db.VarChar(500)
  description         String?              @db.Text
  
  // Cấp phát sinh & Phạm vi
  originLevel         TaskOriginLevel      @default(SCHOOL) @map("origin_level")
  scope               TaskScope            @default(SCHOOL) // View filter compat
  status              TaskStatus           @default(NOT_STARTED)
  priority            TaskPriority         @default(NORMAL)
  progressPercent     Int                  @default(0) @map("progress_percent")
  
  // Thời gian học vụ & Lịch công tác
  academicMonth       Int                  @map("academic_month")
  academicYear        String               @map("academic_year") @db.VarChar(20)
  startDate           DateTime             @default(now()) @map("start_date")
  dueDate             DateTime             @map("due_date")
  completedAt         DateTime?            @map("completed_at")
  
  // Đơn vị chủ trì
  departmentId        String?              @map("department_id") @db.VarChar(50)
  department          Department?          @relation(fields: [departmentId], references: [id], onDelete: SetNull)
  
  // Người giao việc (ASSIGNER)
  createdById         String               @map("created_by_id")
  createdBy           User                 @relation("TaskCreatedBy", fields: [createdById], references: [id], onDelete: Restrict)
  
  // Cấu trúc phân rã cha - con
  parentTaskId        String?              @map("parent_task_id")
  parentTask          Task?                @relation("SubTasks", fields: [parentTaskId], references: [id], onDelete: Cascade)
  subTasks            Task[]               @relation("SubTasks")
  
  // Danh sách chủ thể ReBAC
  actors              TaskActorAssignment[]
  
  // Luồng duyệt động
  approvalRiskTier    ApprovalRiskTier     @default(OPERATIONAL_LOW_RISK) @map("approval_risk_tier")
  approvalWorkflow    TaskApprovalWorkflow?
  
  // Minh chứng & Bàn giao
  deliverables        TaskDeliverable[]
  delegations         DacumDelegation[]
  resolutions         ExecutiveResolution[]
  
  // Liên thông Văn bản Đến & Bút phê
  linkedDocument      Document?
  directiveId         String?              @map("directive_id")
  
  // Hồ sơ công việc liên kết
  dossierItems        WorkDossierItem[]
  
  // Danh mục vị trí việc làm DACUM
  dacumTaskDefId      String?              @map("dacum_task_def_id") @db.VarChar(50)
  dacumTaskDef        DacumTaskDef?        @relation(fields: [dacumTaskDefId], references: [id], onDelete: SetNull)
  
  // Lưu trữ & Vết kiểm toán
  archivedAt          DateTime?            @map("archived_at")
  archivedById        String?              @map("archived_by_id")
  archiveReason       String?              @map("archive_reason") @db.Text
  archivedBy          User?                @relation("TaskArchiver", fields: [archivedById], references: [id], onDelete: SetNull)
  createdAt           DateTime             @default(now()) @map("created_at")
  updatedAt           DateTime             @updatedAt @map("updated_at")

  @@index([originLevel, status, dueDate])
  @@index([departmentId, academicYear, academicMonth])
  @@map("tasks")
}

// ===================================================
// REBAC ACTOR ASSIGNMENT
// ===================================================

model TaskActorAssignment {
  id             String        @id @default(cuid())
  taskId         String        @map("task_id")
  userId         String?       @map("user_id")         // Nullable if actor is a department
  departmentId   String?       @map("department_id")   // Populated for LEAD_UNIT / COORDINATING_UNIT
  actorRole      TaskActorRole @map("actor_role")
  assignedAt     DateTime      @default(now()) @map("assigned_at")
  assignedById   String?       @map("assigned_by_id")
  
  task           Task          @relation(fields: [taskId], references: [id], onDelete: Cascade)
  user           User?         @relation(fields: [userId], references: [id], onDelete: Cascade)
  department     Department?   @relation(fields: [departmentId], references: [id], onDelete: Cascade)
  assignedBy     User?         @relation("ActorAssignedBy", fields: [assignedById], references: [id], onDelete: SetNull)

  // Chỉ cho phép đúng 1 DRI trên 1 Task
  @@unique([taskId, actorRole], name: "unique_task_single_dri", map: "unique_task_single_dri")
  @@index([userId, actorRole])
  @@index([departmentId, actorRole])
  @@map("task_actor_assignments")
}

// ===================================================
// DYNAMIC MULTI-STEP APPROVAL MODELS
// ===================================================

model TaskApprovalWorkflow {
  id              String               @id @default(cuid())
  taskId          String               @unique @map("task_id")
  riskTier        ApprovalRiskTier     @map("risk_tier")
  currentStepNo   Int                  @default(1) @map("current_step_no")
  totalSteps      Int                  @map("total_steps")
  isCompleted     Boolean              @default(false) @map("is_completed")
  
  task            Task                 @relation(fields: [taskId], references: [id], onDelete: Cascade)
  steps           TaskApprovalStep[]
  
  createdAt       DateTime             @default(now()) @map("created_at")
  updatedAt       DateTime             @updatedAt @map("updated_at")

  @@map("task_approval_workflows")
}

model TaskApprovalStep {
  id              String               @id @default(cuid())
  workflowId      String               @map("workflow_id")
  stepNumber      Int                  @map("step_number")
  stepName        String               @map("step_name") @db.VarChar(150)
  targetRole      TaskActorRole        @map("target_role")
  assigneeUserId  String?              @map("assignee_user_id") // Cụ thể hoá người duyệt nếu có
  status          ApprovalStepStatus   @default(PENDING)
  decisionNote    String?              @map("decision_note") @db.Text
  decidedAt       DateTime?            @map("decided_at")
  decidedById     String?              @map("decided_by_id")
  
  workflow        TaskApprovalWorkflow @relation(fields: [workflowId], references: [id], onDelete: Cascade)
  decidedBy       User?                @relation("StepDecidedBy", fields: [decidedById], references: [id], onDelete: SetNull)
  
  createdAt       DateTime             @default(now()) @map("created_at")
  updatedAt       DateTime             @updatedAt @map("updated_at")

  @@unique([workflowId, stepNumber])
  @@map("task_approval_steps")
}
```

---

## 7. QUY TRÌNH KIỂM TOÁN VÀ ĐÁNH GIÁ THI ĐUA (AUDITABILITY & KPI GOVERNANCE)

1. **Bảo toàn vết kiểm toán bất biến (Immutable Audit Trail)**:
   - Mọi hoạt động giao việc, chuyển giao DRI, bổ sung người phối hợp, nộp sản phẩm, đánh giá và phê duyệt đều phải được ghi nhận vào bảng `ActivityLog` với đầy đủ định danh người thực hiện (`userId`), địa chỉ IP, dấu thời gian chuẩn ICT (`timestamp`) và ảnh chụp trạng thái trước - sau (`stateDiff`).
2. **Đồng bộ hóa định mức lao động DACUM**:
   - Khi nhiệm vụ chuyển trạng thái `COMPLETED` thành công qua đủ các bước phê duyệt hợp lệ, hệ thống tự động ghi nhận số giờ chuẩn (`standardHours`) từ định nghĩa công việc DACUM (`dacumTaskDefId`) vào hồ sơ tích lũy công tác của cán bộ DRI, phục vụ trực tiếp công tác xếp loại viên chức cuối năm theo Nghị định số 232/2026/NĐ-CP.
3. **Cơ chế cưỡng chế kỷ luật hành chính**:
   - Nhiệm vụ bị trễ hạn (`OVERDUE`) quá 03 ngày làm việc mà không có giải trình hoặc không có nghị quyết can thiệp gỡ nghẽn của Lãnh đạo (`ExecutiveResolution`) sẽ tự động bị hạ bậc thi đua của đơn vị chủ trì trong Bảng xếp hạng thi đua tháng (`ExecutiveMatrix`).
