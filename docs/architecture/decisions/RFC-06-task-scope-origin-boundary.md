# RFC-06: TaskScope vs TaskOriginLevel Boundary Analysis
(Phân Tích Ranh Giới Ngữ Nghĩa Trực Giao Giữa Phạm Vi Hiển Thị và Nguồn Gốc Thẩm Quyền Nhiệm Vụ)

- **Trạng thái**: PROPOSED (Đề xuất thẩm định tại Architecture Review Gate — Phase 4 / WI-4.2, Issue #64)
- **Ngày lập**: 2026-09-22
- **Tác giả**: Technical Architecture Working Group & Core Domain Modeling Team
- **Người thẩm định**: Owner & Tech Lead (Architecture Review Gate)
- **Tài liệu tham chiếu**:
  - `ADR-001: Single Canonical Maker-Checker Guard`
  - `ADR-002: Contextual Authorization Policy Engine (10-Step Pipeline)`
  - `ADR-003: Task Lifecycle with Derived Attention State`
  - `ADR-005: TaskAssignee to TaskActor Migration Strategy`
  - `ADR-006: Department to OrganizationalUnit Consolidation`
  - `ADR-007: REST API Standard với Chuẩn Báo Lỗi RFC 9457 Problem Details`
  - `RFC-02: Department to OrganizationalUnit Reconciliation Analysis`
  - `RFC-03: Delegation Consolidation Analysis (DacumDelegation vs DelegationGrant)`
  - `docs/domain/task-management.md` (Mục 2.2: Task Origin Level vs Dataset View Scope)
  - `Quyết định số 282/QĐ-CĐKTCNQN` & `Quyết định số 420/QĐ-CĐKTCNQN` của Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn về Phân công nhiệm vụ Ban Giám hiệu

---

## 1. Tóm Tắt Thực Thi (Executive Summary)

Trong hệ thống quản trị điều hành tác nghiệp **QCET E-Office**, nhiệm vụ (`Task`) là thực thể trung tâm gắn liền với toàn bộ hoạt động chỉ đạo, phân công công việc, xử lý văn bản và đánh giá hiệu suất của cán bộ, giảng viên Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn.

Tuy nhiên, trong quá trình phát triển từ giai đoạn sơ khởi (Phase 0) đến kiến trúc ReBAC hiện đại (Phase 4), mô hình dữ liệu và mã nguồn ứng dụng đang tồn tại một sự **nhập nhằng ngữ nghĩa (Semantic Conflation)** nghiêm trọng giữa hai thuộc tính tưởng chừng tương tự nhưng về bản chất là hoàn toàn độc lập và trực giao với nhau:
1. **`Task.scope` (`TaskScope`: `SCHOOL` | `DEPARTMENT` | `INDIVIDUAL`)**: Đại diện cho **Phạm vi Tiếp cận & Khán giả Hiển thị (Audience & Visibility Boundary)** — trả lời câu hỏi *"Ai có quyền nhìn thấy, tiếp cận hoặc giám sát nhiệm vụ này trên hệ thống?"*.
2. **`Task.originLevel` (`TaskOriginLevel`: `SCHOOL` | `UNIT` | `PERSONAL`)**: Đại diện cho **Nguồn gốc Phát sinh & Thẩm quyền Thể chế (Provenance & Authority Source)** — trả lời câu hỏi *"Nhiệm vụ này xuất phát từ đâu, do cấp nào ban hành, gắn với căn cứ pháp lý nào và do ai có thẩm quyền phê duyệt / nghiệm thu hoàn thành?"*.

Do lịch sử để lại, hệ thống đã lạm dụng `Task.scope` như một đại lượng gộp (compound variable) vừa dùng để lọc giao diện, vừa dùng để xác định ai được tạo task, vừa dùng để quyết định quy tắc chuyển trạng thái trong máy trạng thái (`taskStateMachine`), và vừa dùng để xác định thẩm quyền nghiệm thu. Ngược lại, thuộc tính `Task.originLevel` mặc dù đã được đưa vào schema cơ sở dữ liệu (`prisma/schema.prisma:248`) nhưng gần như bị bỏ quên trong các dịch vụ nghiệp vụ chính, bị bỏ sót trong hợp đồng API (`src/contracts/tasks.ts`), không có trong domain model (`TaskDomainModel`), và luôn âm thầm nhận giá trị mặc định `@default(SCHOOL)`.

Hệ quả là:
- **Lỗ hổng bảo mật & bypass quy trình**: Một nhiệm vụ do Ban Giám hiệu chỉ đạo nhưng có phạm vi thực hiện nội bộ khoa (`scope = DEPARTMENT`) lại cho phép Trưởng khoa tự duyệt hoàn thành mà không cần BGH nghiệm thu vì máy trạng thái chỉ kiểm tra `task.scope === 'SCHOOL'`.
- **Nghẽn tác nghiệp hành chính**: Một hoạt động phong trào toàn trường do Đoàn Thanh niên / Khoa GDTC chủ trì (`originLevel = UNIT`, `scope = SCHOOL`) bị chặn không cho Trưởng đơn vị tạo hoặc phê duyệt (`SCHOOL_SCOPE_REQUIRES_EXECUTIVE`), buộc phải mượn tài khoản Ban Giám hiệu để tạo và duyệt thay.
- **Xung đột bộ lọc hiển thị**: Tham số URL `?scope=` bị quá tải với 11 biến thể chuỗi khác nhau, vừa đóng vai trò bộ lọc danh mục vừa xung đột với khái niệm `view=` (`related`, `unit`, `all`, `approval`).

Tài liệu RFC này thực hiện kiểm toán toàn diện mã nguồn, xác lập định nghĩa ngữ nghĩa trực giao chuẩn mực, xây dựng Ma trận Kết hợp Hợp lệ $3 \times 3$, và đề xuất giải pháp kiến trúc nhằm phân tách dứt điểm hai chiều kích này mà không làm gián đoạn hệ thống đang vận hành.

---

## 2. Bối Cảnh & Đặt Vấn Đề (Context & Problem Statement)

### 2.1 Lịch sử Hình thành & Nguồn Gốc Phân Mảnh

Hệ thống điều hành tác nghiệp QCET trải qua hai giai đoạn kiến trúc có triết lý thiết kế khác nhau:

1. **Giai đoạn Sơ khởi (Phase 0 - Monolithic CRUD & Flat Layout)**:
   - Thuộc tính `Task.scope` được thiết kế ban đầu với enum `TaskScope { SCHOOL, DEPARTMENT, INDIVIDUAL }`.
   - Trong giai đoạn này, khái niệm "cấp nhiệm vụ" được xem là một thuộc tính duy nhất: một nhiệm vụ hoặc là của Trường, hoặc là của Khoa, hoặc là của Cá nhân. Giao diện người dùng sử dụng `scope` như một nút chuyển đổi danh sách (toggle tab: "Toàn trường", "Khoa phòng", "Cá nhân").
   - Tư duy một chiều này giả định rằng: mọi nhiệm vụ do Trường ban hành thì toàn trường đều thấy, và mọi nhiệm vụ chỉ lưu hành nội bộ Khoa thì đương nhiên do Khoa tự ban hành và tự chịu trách nhiệm.

2. **Giai đoạn Nâng cấp Kiến trúc Phân quyền ReBAC (Phase 2 - Phase 4)**:
   - Khi áp dụng mô hình phân quyền dựa trên quan hệ (ReBAC) với `TaskActor`, `OrganizationalUnit`, `PositionAssignment`, và quy chế làm việc thực tế tại cơ sở giáo dục nghề nghiệp theo Luật GDNN và Điều lệ trường cao đẳng, mô hình một chiều lập tức bộc lộ sự thiếu sót.
   - Để phản ánh nguồn gốc phát sinh nhiệm vụ (từ Nghị quyết Đảng ủy/BGH, từ Quyết định giao việc, từ Kế hoạch năm hay từ sáng kiến cá nhân), thuộc tính `originLevel` (`TaskOriginLevel: SCHOOL | UNIT | PERSONAL`) đã được bổ sung vào `prisma/schema.prisma`.
   - Tuy nhiên, việc bổ sung này diễn ra cục bộ: các dịch vụ lõi (`task-policy.ts`, `state-machine.ts`, `dashboard-service.ts`) vẫn tiếp tục sử dụng `Task.scope` để ra quyết định phân quyền; trong khi đó, tầng giao diện (`unified-task-toolbar.tsx`, `use-task-filters.ts`) lại biến tấu `scope` thành các khái niệm màn hình như `WorkspaceScope` (`"school" | "unit" | "my"`), `TaskView` (`"all" | "unit" | "related"`), và `TaskLevel` (`"TRUONG" | "DON_VI"`).

### 2.2 Năm Khiếm Khuyết Kiến Trúc Cốt Lõi (Core Architectural Deficiencies)

#### Khiếm khuyết 1: Nhầm lẫn giữa Thẩm quyền Thể chế (Authority) và Khán giả Tiếp cận (Audience)
- **Thẩm quyền Thể chế (Provenance / Authority Source)** trả lời câu hỏi: *Ai có quyền ra lệnh, ai giao việc và ai có tư cách pháp nhân nghiệm thu kết quả cuối cùng?*
- **Khán giả Tiếp cận (Visibility / Audience Boundary)** trả lời câu hỏi: *Dữ liệu này được hiển thị cho ai xem? Ai có quyền đọc thông tin để phối hợp hoặc theo dõi tiến độ?*
- Việc gộp hai khái niệm này khiến hệ thống không thể mô hình hóa các trường hợp phổ biến trong quản lý giáo dục:
  - *Trường hợp A*: Ban Giám hiệu giao việc mật hoặc việc chuyên môn nội bộ cho Phòng Quản lý Đào tạo chuẩn bị đề án mở ngành mới $\to$ Nguồn gốc là **Trường** (`originLevel = SCHOOL`), nhưng phạm vi hiển thị chỉ giới hạn trong **Đơn vị** (`scope = DEPARTMENT`). Hiện tại, nếu gán `scope = DEPARTMENT`, hệ thống cho phép Trưởng phòng tự ý duyệt hoàn thành mà BGH không hề hay biết!
  - *Trường hợp B*: Đoàn Thanh niên hoặc Khoa Sư phạm tổ chức "Hội giảng giáo viên dạy giỏi cấp cơ sở" $\to$ Nguồn gốc là **Đơn vị** (`originLevel = UNIT`), nhưng phạm vi hiển thị là **Toàn trường** (`scope = SCHOOL`) để giảng viên các khoa khác đến dự giờ. Hiện tại, nếu gán `scope = SCHOOL`, Trưởng khoa/Bí thư đoàn bị hệ thống chặn không cho duyệt nghiệm thu (`SCHOOL_SCOPE_REQUIRES_EXECUTIVE`)!

#### Khiếm khuyết 2: Lỗ hổng Nguy hiểm trong Máy Trạng thái (`taskStateMachine`)
Trong `src/domain/tasks/state-machine.ts` (dòng 355–361 và dòng 425–434):
```typescript
// Dòng 425-434: State machine kiểm tra phê duyệt hoàn thành
if (taskScope === 'SCHOOL') {
  if (!isExecutive && !hasDelegation) {
    return {
      allowed: false,
      reason: 'Chỉ Ban Giám hiệu hoặc Quản trị viên mới có thẩm quyền phê duyệt nhiệm vụ cấp trường.',
      code: 'SCHOOL_SCOPE_REQUIRES_EXECUTIVE',
    };
  }
  return { allowed: true };
}
```
Máy trạng thái căn cứ hoàn toàn vào `taskScope` (`task.scope`) để chặn quyền duyệt của Trưởng đơn vị (`isManager`). Nó không hề kiểm tra `task.originLevel`. Nếu một nhiệm vụ chỉ đạo của Hiệu trưởng bị người tạo gán nhầm `scope = DEPARTMENT` (hoặc do giao việc từ văn bản đến bị hardcode `DEPARTMENT`), máy trạng thái sẽ phân nhánh sang mục 4 (`Department / Unit Scope Tasks`), cho phép Trưởng đơn vị đóng vai trò Maker/Checker phê duyệt nhiệm vụ của Ban Giám hiệu, vi phạm nghiêm trọng Nguyên tắc Phân lập Thẩm quyền (Segregation of Duties - ADR-001).

#### Khiếm khuyết 3: Bẫy Mặc định Ngầm trong Cơ sở Dữ liệu (`Default Trap`)
Trong `prisma/schema.prisma`:
```prisma
scope        TaskScope       @default(SCHOOL)
originLevel  TaskOriginLevel @default(SCHOOL) @map("origin_level")
```
Khi một cán bộ khoa/phòng tạo nhiệm vụ thông thường thông qua API hoặc Service, nếu payload không truyền `originLevel` (vì `CreateTaskInputSchema` trong `src/contracts/tasks.ts` thậm chí không định nghĩa trường `originLevel`), cơ sở dữ liệu sẽ tự động gán `originLevel = TaskOriginLevel.SCHOOL`. Kết quả là hàng trăm nhiệm vụ nội bộ, cá nhân hoặc việc vặt khoa phòng đều mang danh nghĩa "Nhiệm vụ cấp Trường" trong cơ sở dữ liệu!

#### Khiếm khuyết 4: Lệch pha Thuật ngữ giữa các Enum song sinh
Hệ thống tồn tại sự không đồng nhất về danh pháp giữa hai Enum:
- `TaskScope`: `{ SCHOOL, DEPARTMENT, INDIVIDUAL }`
- `TaskOriginLevel`: `{ SCHOOL, UNIT, PERSONAL }`

Sự khác biệt giữa `DEPARTMENT` vs `UNIT` và `INDIVIDUAL` vs `PERSONAL` gây ra lỗi dịch chuyển (translation friction), đòi hỏi hàng loạt hàm switch-case và if-else chắp vá trên toàn bộ codebase.

#### Khiếm khuyết 5: Sự Ô nhiễm và Quá tải Tham số Truy vấn (`Query Parameter Pollution`)
Trong `src/server/tasks/task-query-service.ts` (dòng 774–782, 1064–1072, 1359–1367) và `src/contracts/tasks.ts` (dòng 119–135), tham số `scope` chấp nhận tới 11 giá trị khác nhau:
`'school'`, `'unit'`, `'personal'`, `'department'`, `'individual'`, `'my'`, `'all'`, `'SCHOOL'`, `'DEPARTMENT'`, `'INDIVIDUAL'`.
Khi người dùng truyền `scope=my`, hệ thống không lọc theo trường `Task.scope` mà lại nhảy sang lọc `assignees: { some: { userId } }`. Điều này làm lu mờ hoàn toàn ranh giới giữa:
1. Chiều lọc dữ liệu (Data Filter: `scope`, `originLevel`, `leadUnitId`).
2. Điểm nhìn tác nghiệp của người dùng (Viewport Perspective: `view=related|unit|all|approval`).

---

## 3. Định Nghĩa Ngữ Nghĩa Trực Giao Chuẩn Tắc (Orthogonal Semantic Definition)

Để chấm dứt hoàn toàn sự nhập nhằng, kiến trúc hệ thống xác lập hai chiều kích độc lập (Orthogonal Dimensions) trong không gian trạng thái nhiệm vụ:

```
                          KHÔNG GIAN TRỰC GIAO NHIỆM VỤ (TASK SEMANTIC SPACE)

       ▲ Thẩm quyền & Xuất xứ (Task.originLevel / originType)
       │
SCHOOL │  [BGH Giao - Công khai]      [BGH Giao - Nội bộ Khoa]      [BGH Giao - Cá nhân Mật]
       │  (Nghị quyết Hội đồng trường,   (Nhiệm vụ mở mã ngành mới,     (Nhiệm vụ thanh tra đặc biệt,
       │   Kế hoạch năm toàn trường)     chuẩn bị kiểm định Khoa)       trợ lý trực tiếp Hiệu trưởng)
       │
  UNIT │  [Khoa Làm - Toàn trường xem] [Khoa Làm - Nội bộ Khoa]      [Khoa Làm - Cá nhân Viên chức]
       │  (Hội thảo khoa học cấp khoa,  (Phân công lịch giảng dạy,     (Biên soạn giáo trình môn học,
       │   Giải thể thao mở rộng)        họp chuyên môn tổ bộ môn)      nghiên cứu đề tài khoa học cấp khoa)
       │
PERS.  │  [Cá nhân - Chia sẻ chung]    [Cá nhân - Báo cáo Đơn vị]    [Việc Cá nhân Thuần túy]
       │  (Sáng kiến kinh nghiệm phổ biến, (Đăng ký học nâng cao,       (To-do list cá nhân,
       │   tài liệu tự học mở rộng)      kế hoạch công tác tuần)        nhắc việc chuẩn bị bài giảng)
       └────────────────────────────────────────────────────────────────────────────────────────►
                 SCHOOL                       DEPARTMENT                     INDIVIDUAL
                 (Toàn trường thấy)           (Nội bộ Đơn vị thấy)           (Chỉ người làm thấy)
                                       Phạm vi Hiển thị & Giám sát (Task.scope)
```

### 3.1 Chiều kích 1: `Task.scope` — Phạm vi Hiển thị & Giám sát (Audience & Visibility Boundary)

- **Bản chất**: Thiết lập ranh giới bảo mật đọc (Read Access Control & Visibility Scope). Xác định tập hợp người dùng nào trong trường có quyền nhìn thấy bản ghi nhiệm vụ, thông tin tiến độ và hồ sơ tài liệu đính kèm trên bảng điều khiển và lịch công tác.
- **Tính chất**: Không quy định ai có thẩm quyền phê duyệt; chỉ quy định ai được phép xem.
- **Giá trị chuẩn tắc (`TaskScope`)**:

| Giá trị (`TaskScope`) | Ý nghĩa Hành chính & Phạm vi Tiếp cận | Cơ chế Kiểm soát Truy cập (ReBAC Read Guard) |
|---|---|---|
| **`SCHOOL`** | **Công khai Toàn trường (School-Wide Public)**:<br>Mọi cán bộ, giảng viên, nhân viên đang công tác tại trường đều có thể tìm kiếm, theo dõi trên Lịch công tác trường hoặc Bàn làm việc chung. | `true` (Cho phép mọi Authenticated User có trạng thái công tác `ACTIVE`). |
| **`DEPARTMENT`** | **Giới hạn Đơn vị (Unit-Confined)**:<br>Chỉ lưu hành và hiển thị cho cán bộ, viên chức trực thuộc Đơn vị chủ trì (`leadUnitId`) và các Đơn vị phối hợp (`coordinatingUnitIds`). Không hiển thị cho cán bộ khoa/phòng khác. | `actor.unitId IN (task.leadUnitId, task.coordinatingUnitIds)` HOẶC Ban Giám hiệu / Thanh tra trường. |
| **`INDIVIDUAL`** | **Giới hạn Thành viên Thực hiện (Actor-Confined / Private)**:<br>Chỉ hiển thị cho các cá nhân được giao việc trực tiếp (DRI, Collaborators, Assigners, Observers). Ngay cả đồng nghiệp trong cùng bộ môn cũng không thấy nếu không được gắn quyền. | `actor.userId IN (task.actors.userId)` HOẶC Trưởng đơn vị trực tiếp quản lý DRI. |

### 3.2 Chiều kích 2: `Task.originLevel` — Nguồn Gốc Thẩm Quyền (Provenance & Authority Source)

- **Bản chất**: Thiết lập xuất xứ pháp lý, cấp ban hành hành chính và thẩm quyền phê duyệt cuối cùng (Approval & Governance Authority).
- **Tính chất**: Xác định thẩm quyền tạo lập, căn cứ văn bản bắt buộc, và quy tắc của máy trạng thái (`taskStateMachine`) khi chuyển sang `COMPLETED` hoặc `CANCELLED`.
- **Giá trị chuẩn tắc (`TaskOriginLevel`)**:

| Giá trị (`TaskOriginLevel`) | Ý nghĩa Thể chế & Căn cứ Pháp lý | Thẩm quyền Tạo lập & Phê duyệt Nghiệm thu |
|---|---|---|
| **`SCHOOL`** | **Cấp Thể chế / Toàn trường (Institutional Authority)**:<br>Phát sinh từ Nghị quyết Đảng ủy, Nghị quyết Hội đồng trường, Quyết định của Hiệu trưởng, Kết luận giao ban Ban Giám hiệu, hoặc Văn bản đến từ UBND Tỉnh, Bộ LĐTBXH/Tổng cục GDNN. Bắt buộc có số văn bản/kết luận căn cứ (`sourceDocumentNumber` / `meetingCode`). | - **Tạo lập**: Ban Giám hiệu, Văn phòng trường, hoặc người được ủy quyền theo QĐ 420.<br>- **Nghiệm thu hoàn thành**: Duy nhất Ban Giám hiệu (hoặc Trưởng mảng phụ trách được ủy quyền hợp pháp). |
| **`UNIT`** | **Cấp Đơn vị Khoa / Phòng (Unit Authority)**:<br>Phát sinh từ Kế hoạch công tác định kỳ của Khoa/Phòng, Kết luận họp giao ban đơn vị, hoặc Phân công tác nghiệp của Trưởng/Phó đơn vị. | - **Tạo lập**: Trưởng đơn vị, Phó trưởng đơn vị.<br>- **Nghiệm thu hoàn thành**: Trưởng đơn vị (hoặc Phó trưởng đơn vị được phân công phụ trách mảng). |
| **`PERSONAL`** | **Cấp Cá nhân Tự thân (Self-Initiated / Personal)**:<br>Phát sinh từ kế hoạch làm việc cá nhân của giảng viên, chuyên viên nhằm tự quản lý tiến độ công việc hoặc chuẩn bị chuyên môn. Không bắt buộc căn cứ văn bản. | - **Tạo lập**: Mọi cán bộ, giảng viên, nhân viên.<br>- **Nghiệm thu hoàn thành**: Cá nhân tự đánh dấu hoàn thành (Self-complete), trừ khi cá nhân chủ động gửi cấp trên duyệt. |

### 3.3 Phân biệt Trực giao với `TaskView` (Điểm nhìn Bàn làm việc)

Cần phân định rõ ràng giữa thuộc tính của Dữ liệu (`Task.scope`, `Task.originLevel`) và Trạng thái Giao diện của Người dùng (`TaskView` / Viewport Perspective):

- `Task.scope` là thuộc tính tĩnh lưu trong cơ sở dữ liệu của từng dòng nhiệm vụ.
- `TaskView` (`related` | `unit` | `all` | `approval`) là **bộ lọc ngữ cảnh (Contextual Perspective)** do người dùng bấm chọn trên thanh công cụ Bàn làm việc:
  - `view = related`: Hiển thị các nhiệm vụ mà tôi trực tiếp tham gia (tôi là DRI, người phối hợp, hoặc người giao).
  - `view = unit`: Hiển thị các nhiệm vụ thuộc đơn vị tôi (bất kể `scope` là `SCHOOL` hay `DEPARTMENT`, miễn là đơn vị tôi chủ trì hoặc phối hợp).
  - `view = all`: Hiển thị toàn cảnh dữ liệu trong phạm vi quyền đọc tối đa của vai trò tôi (Hiệu trưởng thấy toàn trường, Trưởng khoa thấy toàn khoa).
  - `view = approval`: Hiển thị danh sách nhiệm vụ đang chờ tôi duyệt ký nghiệm thu.

---

## 4. Kiểm Toán Hiện Trạng Mã Nguồn (Codebase Audit)

Kiểm toán chi tiết toàn bộ codebase phát hiện 10 vị trí xảy ra sự nhập nhằng, đè nén hoặc bỏ sót giữa `scope` và `originLevel`:

### 4.1 Schema Cơ Sở Dữ Liệu (`prisma/schema.prisma`)
- **Vị trí**: Dòng 46–50, dòng 221, 248, và dòng 1128–1132.
- **Hiện trạng**:
  - `TaskScope` gồm `{ SCHOOL, DEPARTMENT, INDIVIDUAL }`.
  - `TaskOriginLevel` gồm `{ SCHOOL, UNIT, PERSONAL }`.
  - Cả hai cột đều có giá trị mặc định là `SCHOOL`:
    ```prisma
    scope        TaskScope       @default(SCHOOL)
    originLevel  TaskOriginLevel @default(SCHOOL) @map("origin_level")
    ```
  - Có chỉ mục `@@index([scope, status, dueDate])` (dòng 267) nhưng **hoàn toàn không có chỉ mục nào trên `originLevel`**.
- **Hệ lụy**: Khi gọi `prisma.task.create` mà không truyền `originLevel`, nhiệm vụ tự động bị đánh đồng thành nhiệm vụ do Cấp trường ban hành (`originLevel = SCHOOL`).

### 4.2 Lệnh Khởi Tạo Từ Kết Luận Cuộc Họp (`src/server/tasks/task-command-service.ts`)
- **Vị trí**: Dòng 262–263.
- **Hiện trạng**:
  ```typescript
  const originLevel = input.bodyId ? TaskOriginLevel.SCHOOL : TaskOriginLevel.UNIT;
  const scope = input.bodyId ? TaskScope.SCHOOL : (input.unitId ? TaskScope.DEPARTMENT : TaskScope.SCHOOL);
  ```
- **Hệ lụy**: Logic tạo task từ kết luận cuộc họp ép buộc: nếu cuộc họp có `bodyId` (Hội đồng trường / BGH), thì cả `originLevel` VÀ `scope` đều bị ép thành `SCHOOL`. Điều này ngăn cản việc BGH giao một nhiệm vụ mật nội bộ cho một phòng chức năng (`originLevel: SCHOOL`, `scope: DEPARTMENT`).

### 4.3 Khởi Tạo Nhiệm Vụ Với Diễn Viên (`src/server/tasks/task-command-service.ts`)
- **Vị trí**: Dòng 565–586 (`createTaskWithActors`).
- **Hiện trạng**:
  ```typescript
  const task = await tx.task.create({
    data: {
      code,
      title,
      description: description || null,
      departmentId: validDepartmentId,
      // ...
      scope: taskScope,
      // HOÀN TOÀN BỎ QUÊN originLevel !
    }
  });
  ```
- **Hệ lụy**: Hàm tạo nhiệm vụ chuẩn tắc của hệ thống không nhận tham số `originLevel` từ đầu vào, dẫn đến mọi task tạo mới đều bị cơ sở dữ liệu gán mặc định `originLevel = TaskOriginLevel.SCHOOL`.

### 4.4 Quy Định Phân Quyền Tạo và Duyệt Nhiệm Vụ (`src/server/tasks/task-policy.ts`)
- **Vị trí**: Dòng 106–135 và 190–214.
- **Hiện trạng**:
  ```typescript
  // Dòng 107: Chặn quyền tạo dựa vào scope
  if (scopeStr === 'SCHOOL' && !isPrivileged) {
    return {
      allowed: false,
      reason: 'Chỉ Ban Giám hiệu hoặc Quản trị viên mới có quyền tạo nhiệm vụ cấp trường.',
    };
  }

  // Dòng 191: Chặn quyền duyệt hoàn thành dựa vào scope
  const scopeUpper = (task.scope || '').toString().toUpperCase();
  if (scopeUpper === 'SCHOOL') {
    if (!isPrivileged && !activeDelegation) {
      return {
        allowed: false,
        reason: 'Chỉ Ban Giám hiệu hoặc Quản trị viên mới có quyền nghiệm thu nhiệm vụ cấp trường.',
      };
    }
  }
  ```
- **Hệ lụy**: Lạm dụng `task.scope` làm căn cứ phân quyền tạo và nghiệm thu. Một nhiệm vụ do BGH giao cho Khoa nếu có `scope = DEPARTMENT` thì lọt qua cổng kiểm soát của BGH; ngược lại một nhiệm vụ cấp Khoa nhưng muốn công khai toàn trường (`scope = SCHOOL`) thì Trưởng khoa không thể duyệt nghiệm thu.

### 4.5 Máy Trạng Thái Nhiệm Vụ (`src/domain/tasks/state-machine.ts`)
- **Vị trí**: Dòng 181, dòng 355–361, dòng 425–434.
- **Hiện trạng**:
  ```typescript
  const taskScope = normalizeScope(task.scope);
  // Dòng 355:
  if (taskScope === 'SCHOOL' && !hasDelegation) {
    return { allowed: false, reason: 'Trưởng phòng không thể từ chối hoặc can thiệp nhiệm vụ cấp trường.', code: 'SCHOOL_SCOPE_REQUIRES_EXECUTIVE' };
  }
  // Dòng 425:
  if (taskScope === 'SCHOOL') {
    if (!isExecutive && !hasDelegation) {
      return { allowed: false, reason: 'Chỉ Ban Giám hiệu hoặc Quản trị viên mới có thẩm quyền phê duyệt nhiệm vụ cấp trường.', code: 'SCHOOL_SCOPE_REQUIRES_EXECUTIVE' };
    }
    return { allowed: true };
  }
  ```
- **Hệ lụy**: Mã lỗi `SCHOOL_SCOPE_REQUIRES_EXECUTIVE` phản ánh trực tiếp sự nhầm lẫn giữa *Scope* (khán giả) và *Authority* (thẩm quyền điều hành). Cần phải đổi tên và ngữ nghĩa thành kiểm tra theo `originLevel`.

### 4.6 Mô Hình Miền và Bộ Ánh Xạ (`src/domain/tasks/types.ts` & `src/domain/tasks/mappers.ts`)
- **Vị trí**: `types.ts` dòng 70–85 và `mappers.ts` dòng 205.
- **Hiện trạng**:
  - `TaskDomainModel` có `scope: DomainTaskScope` nhưng **hoàn toàn không có trường `originLevel`**.
  - `mappers.ts` dòng 205:
    ```typescript
    requiresReview: Boolean(raw.dacumTaskDefId || scope === 'SCHOOL'),
    ```
- **Hệ lụy**: Toàn bộ tầng domain nghiệp vụ bị "mù" trước thông tin nguồn gốc quyền lực của nhiệm vụ. Quy tắc kiểm tra xem nhiệm vụ có cần nghiệm thu chính thức hay không (`requiresReview`) bị phụ thuộc vào `scope === 'SCHOOL'`.

### 4.7 Dịch Vụ Phân Phối Chỉ Đạo Văn Bản (`src/app/api/documents/[id]/directives/route.ts` & `src/lib/services/incoming-document-service.ts`)
- **Vị trí**: `directives/route.ts` dòng 234 và `incoming-document-service.ts` dòng 725.
- **Hiện trạng**:
  - Khi phân phối văn bản chỉ đạo của lãnh đạo sang nhiệm vụ (`directives/route.ts`): hardcode `scope: TaskScope.SCHOOL`.
  - Khi tạo nhiệm vụ theo dõi văn bản đến (`incoming-document-service.ts`): hardcode `scope: TaskScope.DEPARTMENT`.
  - Cả hai nơi đều **không thiết lập `originLevel`**, mặc dù văn bản đến và chỉ đạo của Lãnh đạo trường đều có nguồn gốc thẩm quyền tối cao là `originLevel = TaskOriginLevel.SCHOOL`.
- **Hệ lụy**: Cùng một nghiệp vụ xử lý văn bản hành chính nhưng sinh ra hai loại nhiệm vụ có `scope` trái ngược nhau và bỏ trống `originLevel`.

### 4.8 Hợp Đồng API và Lớp Dữ Liệu Truy Vấn (`src/contracts/tasks.ts` & `src/server/tasks/task-query-service.ts`)
- **Vị trí**: `contracts/tasks.ts` dòng 119–135, 204–206; `task-query-service.ts` dòng 774–782, 1064–1072, 1359–1367.
- **Hiện trạng**:
  - `CreateTaskInputSchema` không hề có thuộc tính `originLevel`.
  - `TaskQuerySchema` định nghĩa `scope` với ghi chú `// @deprecated Use view instead` nhưng bên trong lại chấp nhận cả `'my'`, `'unit'`, `'department'`, `'personal'`, `'individual'`, `'school'`, `'all'`.
  - `task-query-service.ts` xử lý tham số `scope` vừa để gán `where.scope = TaskScope.*`, vừa đặc cách `scope=my` để nhồi thêm điều kiện `assignees: { some: { userId } }`.
  - Không có bất kỳ bộ lọc nào cho phép truy vấn theo `originLevel`.

### 4.9 Bộ Chuyển Đổi Dữ Liệu Tạo Task và Giao Diện Modal (`src/lib/adapters/create-task-mapper.ts` & `src/components/dashboard/create-task-modal.tsx`)
- **Vị trí**: `create-task-mapper.ts` dòng 26–42; `create-task-modal.tsx` dòng 74, 1281–1310.
- **Hiện trạng**:
  ```typescript
  export type CreateTaskLevel = 'TRUONG' | 'DON_VI' | 'STAFF';
  export const TASK_LEVEL_TO_SCOPE = {
    TRUONG: 'SCHOOL',
    DON_VI: 'DEPARTMENT',
    STAFF: 'INDIVIDUAL',
  } as const satisfies Record<CreateTaskLevel, 'SCHOOL' | 'DEPARTMENT' | 'INDIVIDUAL'>;
  ```
  Trong modal tạo task, người dùng chọn `level` ("Cấp Trường" hoặc "Cấp Đơn vị"). Giá trị này được gán trực tiếp vào `scope`.
- **Hệ lụy**: Người dùng không thể chọn một nhiệm vụ có cấp ban hành là "Cấp Trường" nhưng phạm vi hiển thị chỉ giới hạn trong một đơn vị cụ thể.

### 4.10 Bảng Điều Khiển và Các Định Nghĩa Tự Phát (`src/types/dashboard.ts` & `src/lib/server/dashboard-service.ts`)
- **Vị trí**: `src/types/dashboard.ts` dòng 139; `src/lib/server/dashboard-service.ts` dòng 177–185, dòng 332–338.
- **Hiện trạng**:
  - `types/dashboard.ts` tự phát sinh type:
    ```typescript
    export type TaskOrigin = 'SCHOOL' | 'SELF_INITIATED';
    ```
  - `dashboard-service.ts` tính toán nhãn hiển thị:
    ```typescript
    const isSchool = t.scope === TaskScope.SCHOOL;
    const categoryLabel = (t as any).categoryLabel || (isSchool ? "Nhiệm vụ cấp Trường" : "Nhiệm vụ đơn vị");
    level: (t as any).scope === TaskScope.DEPARTMENT ? "Đơn vị" : "Trường"
    ```
  - Trong `src/lib/work-calendar-adapter.ts` (dòng 15), trường `originType` lại được định nghĩa để phân biệt `"school_milestone"`, `"subtask"`, `"deliverable"`.
- **Hệ lụy**: Sự phân mảnh thuật ngữ đạt đỉnh điểm khi cùng một từ "origin" bị định nghĩa lại ở 4 nơi với 4 tập giá trị hoàn toàn không tương thích.

---

## 5. Ma Trận Kết Hợp Hợp Lệ Chuẩn Tắc (Canonical Valid Combination Matrix)

Bằng việc phân tách dứt điểm hai trục, hệ sinh thái quản lý nhiệm vụ QCET hỗ trợ trọn vẹn **9 trạng thái kết hợp hợp lệ ($3 \times 3$)**. Mỗi ô phản ánh chính xác một tình huống nghiệp vụ có thật trong thực tế quản trị nhà trường:

| `Task.originLevel` (Cấp Ban Hành & Thẩm Quyền) \ `Task.scope` (Khán Gi��� & Phạm Vi Hiển Thị) | **`SCHOOL`**<br>(Công khai Toàn trường) | **`DEPARTMENT`**<br>(Nội bộ Đơn vị chủ trì/phối hợp) | **`INDIVIDUAL`**<br>(Chỉ các cá nhân thực hiện) |
|---|---|---|---|
| **`SCHOOL`**<br>(Ban Giám hiệu, Nghị quyết trường, Quyết định giao việc, Văn bản đến Tỉnh) | **Ô (1,1): Chỉ Đạo Toàn Trường Trọng Điểm**<br>- *Ví dụ*: Kế hoạch năm học mới; Lễ khai giảng; Chiến dịch chuyển đổi số toàn trường.<br>- *Tạo*: BGH / PHO_HIEU_TRUONG.<br>- *Duyệt*: BGH nghiệm thu.<br>- *Xem*: Mọi CBGV xem được. | **Ô (1,2): Giao Việc BGH Cho Đơn Vị Cụ Thể**<br>- *Ví dụ*: BGH giao Phòng QLĐT mở mã ngành Trí tuệ nhân tạo; BGH giao Phòng TCKT giải trình quyết toán.<br>- *Tạo*: BGH / Văn phòng trường.<br>- *Duyệt*: BGH nghiệm thu.<br>- *Xem*: Chỉ cán bộ trong đơn vị thực hiện xem được. | **Ô (1,3): Nhiệm Vụ Đặc Biệt / Thanh Tra Đột Xuất**<br>- *Ví dụ*: Hiệu trưởng giao Trưởng ban Thanh tra nhân dân xác minh đơn thư bảo mật; Trợ lý đặc biệt soạn diễn văn.<br>- *Tạo*: Hiệu trưởng.<br>- *Duyệt*: Hiệu trưởng.<br>- *Xem*: Tuyệt đối bảo mật, chỉ người giao và người nhận xem. |
| **`UNIT`**<br>(Kế hoạch công tác Khoa/Phòng, Trưởng đơn vị giao việc, Cuộc họp đơn vị) | **Ô (2,1): Hoạt Động Khoa Phục Vụ Toàn Trường**<br>- *Ví dụ*: Khoa CNTT tổ chức Hội thảo Trí tuệ nhân tạo mở rộng; Đoàn trường phát động phong trào hiến máu.<br>- *Tạo*: Trưởng khoa / Trưởng đơn vị.<br>- *Duyệt*: Trưởng đơn vị nghiệm thu.<br>- *Xem*: Mọi CBGV toàn trường xem trên Lịch công tác. | **Ô (2,2): Nghiệp Vụ Nội Bộ Khoa/Phòng Chuẩn Tắc**<br>- *Ví dụ*: Phân công giảng dạy bộ môn; Soạn đề thi hết môn; Kiểm kê tài sản phòng thực hành số 3.<br>- *Tạo*: Trưởng khoa, Tổ trưởng bộ môn.<br>- *Duyệt*: Trưởng khoa nghiệm thu.<br>- *Xem*: Cán bộ, giảng viên trong khoa. | **Ô (2,3): Phân Công Cá Nhân Đơn Vị Giới Hạn**<br>- *Ví dụ*: Trưởng khoa giao một giảng viên phụ trách chuẩn bị hồ sơ đánh giá viên chức nội bộ.<br>- *Tạo*: Trưởng đơn vị.<br>- *Duyệt*: Trưởng đơn vị.<br>- *Xem*: Chỉ Trưởng đơn vị và giảng viên được giao. |
| **`PERSONAL`**<br>(Kế hoạch tự thân của Giảng viên, Chuyên viên, Sáng kiến cá nhân) | **Ô (3,1): Sáng Kiến Chia Sẻ Tri Thức Mở**<br>- *Ví dụ*: Giảng viên công khai giáo trình điện tử tự biên soạn; Bài giảng mẫu E-Learning chia sẻ đồng nghiệp tham khảo.<br>- *Tạo*: Bất kỳ giảng viên nào.<br>- *Duyệt*: Tự hoàn thành / Tự xuất bản.<br>- *Xem*: Toàn trường tiếp cận tham khảo. | **Ô (3,2): Báo Cáo Kế Hoạch Cá Nhân Cho Đơn Vị**<br>- *Ví dụ*: Đăng ký đi học bồi dưỡng chuyên môn nâng cao; Kế hoạch rèn luyện nghiệp vụ quý trình Trưởng bộ môn.<br>- *Tạo*: Giảng viên/Chuyên viên.<br>- *Duyệt*: Tự hoàn thành / Trưởng khoa xác nhận.<br>- *Xem*: Nội bộ đơn vị. | **Ô (3,3): Sổ Tay Cá Nhân / Việc Cần Làm (To-Do)**<br>- *Ví dụ*: Soạn giáo án trước tiết dạy ngày mai; Ôn tập chuẩn bị thi chứng chỉ nghề; Nhắc việc cá nhân.<br>- *Tạo*: Bất kỳ ai.<br>- *Duyệt*: Tự đánh dấu hoàn thành.<br>- *Xem*: Chỉ duy nhất tác giả thấy. |

### 5.1 Giải Phẫu Hai Trường Hợp Điển Hình Minh Chứng Tính Ưu Việt

#### Trường hợp 1: Nhiệm vụ Ô (1,2) — `originLevel: SCHOOL` nhưng `scope: DEPARTMENT`
- **Tình huống**: Trong cuộc họp giao ban tháng 9, Ban Giám hiệu ra thông báo kết luận giao Phòng Khảo thí & Đảm bảo chất lượng (KT&ĐBCL) xây dựng đề án khảo sát sự hài lòng của doanh nghiệp tuyển dụng.
- **Dưới cơ chế cũ (1 chiều - conflated)**:
  - Nếu chọn `level = TRUONG` $\to$ `scope = SCHOOL`. Kết quả: Toàn bộ cán bộ, nhân viên, bảo vệ, văn thư toàn trường đều thấy bản dự thảo đề án này trên bàn làm việc của họ, gây loãng thông tin và lộ lọt dữ liệu nội bộ đang soạn thảo.
  - Nếu chọn `level = DON_VI` $\to$ `scope = DEPARTMENT`. Kết quả: Trưởng phòng KT&ĐBCL có thể bấm nút "Phê duyệt hoàn thành" mà không cần thông qua Ban Giám hiệu, do máy trạng thái chỉ kiểm tra `task.scope !== 'SCHOOL'`.
- **Dưới cơ chế trực giao chuẩn tắc**:
  - `originLevel = TaskOriginLevel.SCHOOL`: Máy trạng thái và cổng phân quyền biết ngay rằng nhiệm vụ này do BGH ủy thác. Bắt buộc phải có phê duyệt nghiệm thu từ BGH mới được chuyển sang `COMPLETED`.
  - `scope = TaskScope.DEPARTMENT`: Chỉ các cán bộ thuộc Phòng KT&ĐBCL và Ban Giám hiệu mới thấy nhiệm vụ này trên Bàn làm việc. Không làm phiền các đơn vị khác.

#### Trường hợp 2: Nhiệm vụ Ô (2,1) — `originLevel: UNIT` nhưng `scope: SCHOOL`
- **Tình huống**: Khoa Kỹ thuật Ô tô tổ chức "Ngày hội bảo dưỡng xe máy miễn phí cho sinh viên và cán bộ giảng viên".
- **Dưới cơ chế cũ (1 chiều - conflated)**:
  - Để mọi người nhìn thấy trên lịch tuần, người tạo buộc phải chọn `level = TRUONG` (`scope = SCHOOL`).
  - Khi đó, hệ thống yêu cầu người tạo phải là Ban Giám hiệu (`canUserCreateTask` chặn Trưởng khoa Ô tô). Nếu BGH tạo hộ, thì khi sự kiện kết thúc, Trưởng khoa Ô tô không thể bấm nghiệm thu vì bị chặn bởi lỗi `SCHOOL_SCOPE_REQUIRES_EXECUTIVE`.
- **Dưới cơ chế trực giao chuẩn tắc**:
  - `originLevel = TaskOriginLevel.UNIT`: Trưởng khoa Ô tô toàn quyền lập kế hoạch, phân công giảng viên trong khoa, và nghiệm thu đánh giá chất lượng hoạt động.
  - `scope = TaskScope.SCHOOL`: Toàn trường nhìn thấy sự kiện trên lịch công tác để đăng ký tham gia.

---

## 6. Đề Xuất Chuẩn Hóa Kiến Trúc & Lộ Trình Thực Thi (Recommendations & Roadmap)

### 6.1 Chuẩn Hóa Mô Hình Miền (Domain Model Standard)

1. **Bổ sung `originLevel` vào `TaskDomainModel` (`src/domain/tasks/types.ts`)**:
   ```typescript
   export type DomainTaskOriginLevel = 'SCHOOL' | 'UNIT' | 'PERSONAL';

   export interface TaskDomainModel {
     id: string;
     code: string;
     title: string;
     description: string | null;
     scope: DomainTaskScope;                     // Read & Audience boundary: SCHOOL | DEPARTMENT | INDIVIDUAL
     originLevel: DomainTaskOriginLevel;         // Authority & Provenance boundary: SCHOOL | UNIT | PERSONAL
     // ... các thuộc tính khác giữ nguyên
   }
   ```
2. **Cập nhật Bộ ánh xạ (`src/domain/tasks/mappers.ts`)**:
   - Chuyển đổi an toàn từ Prisma model sang `TaskDomainModel`.
   - Sửa đổi dòng 205:
     ```typescript
     // Thay vì: requiresReview: Boolean(raw.dacumTaskDefId || scope === 'SCHOOL')
     requiresReview: Boolean(raw.dacumTaskDefId || raw.originLevel === 'SCHOOL' || raw.originLevel === TaskOriginLevel.SCHOOL),
     ```
     Nhiệm vụ đòi hỏi phê duyệt chính thức căn cứ vào **Nguồn gốc quyền lực (`originLevel`)**, không căn cứ vào phạm vi hiển thị (`scope`).

### 6.2 Chuẩn Hóa Máy Trạng Thái & Cổng Phân Quyền (FSM & Authorization Policy)

1. **Sửa đổi `src/domain/tasks/state-machine.ts`**:
   - Thay thế việc kiểm tra `taskScope === 'SCHOOL'` bằng việc kiểm tra `taskOriginLevel === 'SCHOOL'`.
   - Thay thế mã lỗi `SCHOOL_SCOPE_REQUIRES_EXECUTIVE` thành `SCHOOL_ORIGIN_REQUIRES_EXECUTIVE`:
     ```typescript
     // Nghiệm thu hoàn thành nhiệm vụ cấp trường do BGH ban hành:
     if (taskOriginLevel === 'SCHOOL') {
       if (!isExecutive && !hasDelegation) {
         return {
           allowed: false,
           reason: 'Nhiệm vụ có nguồn gốc cấp Trường do Ban Giám hiệu ban hành, chỉ Ban Giám hiệu mới có thẩm quyền nghiệm thu hoàn thành.',
           code: 'SCHOOL_ORIGIN_REQUIRES_EXECUTIVE',
         };
       }
       return { allowed: true };
     }
     ```
2. **Sửa đổi `src/server/tasks/task-policy.ts`**:
   - Tách kiểm tra khi tạo nhiệm vụ thành 2 cổng độc lập:
     - **Cổng Thẩm quyền Tạo (`originLevel`)**:
       - `originLevel === 'SCHOOL'`: Yêu cầu vai trò Ban Giám hiệu / Văn phòng trường hoặc có giấy ủy quyền.
       - `originLevel === 'UNIT'`: Yêu cầu vai trò Trưởng/Phó đơn vị đối với `leadUnitId`.
       - `originLevel === 'PERSONAL'`: Mọi cán bộ, viên chức đều có quyền.
     - **Cổng Đăng tải Hiển thị (`scope`)**:
       - `scope === 'SCHOOL'`: Cho phép BGH; cho phép Trưởng đơn vị nếu nhiệm vụ gắn với kế hoạch công khai toàn trường; cảnh báo nếu giảng viên thường đăng bài công khai toàn trường.
       - `scope === 'DEPARTMENT'`: Cho phép cán bộ thuộc đơn vị.
       - `scope === 'INDIVIDUAL'`: Cho phép tất cả.

### 6.3 Chuẩn Hóa REST API & Tham Số Truy Vấn (RFC 9457 & Query Standards)

1. **Mở rộng `CreateTaskInputSchema` trong `src/contracts/tasks.ts`**:
   ```typescript
   export const CreateTaskInputSchema = z.object({
     title: z.string().trim().min(3).max(500),
     scope: z.enum(['SCHOOL', 'DEPARTMENT', 'INDIVIDUAL']).default('DEPARTMENT'),
     originLevel: z.enum(['SCHOOL', 'UNIT', 'PERSONAL']).default('UNIT'),
     leadUnitId: z.string().cuid().optional(),
     // ...
   });
   ```
2. **Chuẩn hóa Tham số Truy vấn (`TaskQuerySchema`)**:
   - **Tuyệt đối không dùng `scope` để truyền giá trị `my` hoặc `unit`**.
   - Phân tách rõ ràng 3 tham số URL độc lập:
     - `view=related|unit|all|approval`: Điểm nhìn bàn làm việc của người dùng (Viewport Perspective).
     - `scope=school|department|individual`: Bộ lọc theo phạm vi bảo mật hiển thị (Audience).
     - `originLevel=school|unit|personal`: Bộ lọc theo cấp ban hành thẩm quyền (Provenance).

### 6.4 Chuẩn Hóa Giao Diện Người Dùng (UI / UX Modals & Workspace)

1. **Nâng cấp `CreateTaskModal` (`src/components/dashboard/create-task-modal.tsx`)**:
   - Thay thế việc chọn 1 trường duy nhất `level: TRUONG | DON_VI` thành 2 cấu hình trực quan:
     - **Cấp ban hành / Thẩm quyền giao việc** (Radio group):
       - `Cấp Trường (BGH)` (Chỉ hiện khi có quyền).
       - `Cấp Đơn vị (Khoa/Phòng)`.
       - `Cá nhân tự khởi tạo`.
     - **Phạm vi hiển thị & Đối tượng tiếp cận** (Dropdown select):
       - `Công khai toàn trường` (Mọi người đều theo dõi được).
       - `Nội bộ đơn vị` (Chỉ nhân sự trong khoa/phòng).
       - `Chỉ định cá nhân` (Chỉ những người được giao).
   - Tự động gợi ý cặp giá trị mặc định hợp lý (ví dụ: Trưởng khoa chọn "Cấp Đơn vị" thì mặc định phạm vi là "Nội bộ đơn vị").

2. **Dọn dẹp các Định nghĩa Type Phân mảnh**:
   - Xóa bỏ `TaskOrigin = 'SCHOOL' | 'SELF_INITIATED'` trong `src/types/dashboard.ts`.
   - Chuẩn hóa `originType` trong `src/lib/work-calendar-adapter.ts` thành `calendarItemType` để tránh trùng từ khóa "origin".

### 6.5 Lộ Trình Triển Khai Không Gián Đoạn (5-Step Zero-Downtime Roadmap)

Quá trình chuyển đổi từ cơ chế gộp sang cơ chế trực giao được thực hiện theo nguyên tắc an toàn, không gián đoạn dịch vụ:

```
[Bước 1: Hợp Đồng & Schema] ──► [Bước 2: Domain & FSM] ──► [Bước 3: Dữ Liệu Lịch Sử] ──► [Bước 4: UI & API] ──► [Bước 5: Dọn Dẹp]
      Expand Contracts              Decouple State              Backfill Origin               Cutover UI              Clean Legacy
```

1. **Bước 1: Expand Contracts & Indexes (Tuần 1)**:
   - Thêm chỉ mục `@@index([originLevel, status, dueDate])` vào `prisma/schema.prisma`.
   - Bổ sung trường `originLevel` vào `CreateTaskInputSchema` và `TaskQuerySchema` trong `src/contracts/tasks.ts`.
2. **Bước 2: Decouple State Machine & Policies (Tuần 2)**:
   - Cập nhật `src/domain/tasks/state-machine.ts`: Tách điều kiện kiểm tra thẩm quyền duyệt sang `originLevel`.
   - Cập nhật `src/server/tasks/task-policy.ts`: Tách logic `canUserCreateTask` và `canUserUpdateTask`.
3. **Bước 3: Backfill Dữ Liệu Lịch Sử (Tuần 2 - 3)**:
   - Viết kịch bản di trú dữ liệu (`prisma/data-migrations/reconcile-task-scope-origin.ts`):
     - Những task có `parentTaskId != null`: Kế thừa `originLevel` từ parent task.
     - Những task liên kết với `ExecutiveResolution` hoặc `meetingCode` cấp trường: Đặt `originLevel = SCHOOL`.
     - Những task do Lãnh đạo khoa tạo hoặc gắn với `departmentId` không có liên kết BGH: Đặt `originLevel = UNIT`.
     - Những task do cá nhân tạo không gắn với đơn vị và không có người phối hợp: Đặt `originLevel = PERSONAL`.
4. **Bước 4: Cutover UI & Query Services (Tuần 3 - 4)**:
   - Nâng cấp `CreateTaskModal` để hỗ trợ lựa chọn 2 chiều độc lập.
   - Cập nhật `TaskQueryService` để hỗ trợ lọc độc lập theo `originLevel` và `scope`.
5. **Bước 5: Clean Legacy Shims & Freeze (Tuần 4)**:
   - Loại bỏ các type chắp vá (`TaskOrigin`, `TASK_LEVEL_TO_SCOPE`).
   - Đóng băng kiến trúc và cập nhật tài liệu `docs/domain/task-management.md`.

---

## 7. Kết Luận (Conclusion)

Việc phân định ranh giới ngữ nghĩa trực giao giữa `Task.scope` (Audience / Visibility) và `Task.originLevel` (Provenance / Authority) là một bước chuyển biến kiến trúc mang tính nền tảng cho hệ thống QCET E-Office. Phân tích này giải quyết triệt để 5 khiếm khuyết cốt lõi, lấp các lỗ hổng phân quyền nghiêm trọng trong máy trạng thái, mở khóa năng lực quản trị linh hoạt cho cả cấp Trường và cấp Đơn vị theo đúng thể chế giáo dục nghề nghiệp, đồng thời tạo tiền đề vững chắc cho việc hợp nhất toàn diện mô hình ReBAC trong các giai đoạn tiếp theo.
