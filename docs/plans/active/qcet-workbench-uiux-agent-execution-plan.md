# QCET WORK — Kế hoạch thực thi UI/UX Bàn làm việc cho agent

Ngày: 13/09/2026 · Version 1.0

Spec đầu vào: `qcet-workbench-uiux-source-audit-spec.md` (13/09/2026, v1.0). Plan này triển khai F01–F15 và AC01–AC15 trong spec. Bằng chứng source kế thừa audit ở `main`, HEAD `2ae829dc`; không phải một lần xác minh source mới. Agent phải đối chiếu HEAD hiện tại trước khi áp dụng.

## 1. Kết quả phải bàn giao

Bàn làm việc phải thay đổi cả cách chọn dữ liệu và cách sử dụng: một hàng đợi đúng người/đúng phạm vi, tổng đếm khớp danh sách, đơn vị có vấn đề dễ thấy, nhiệm vụ mở được và hoàn tất thao tác không mất ngữ cảnh. Giao diện phải có ảnh trước/sau cùng fixture để chứng minh thay đổi.

Đây là plan thực thi trong repository, không phải báo cáo đã triển khai. Các đường dẫn source có trong audit là điểm bắt đầu; đường dẫn module/test mới ở dưới là đề xuất, phải tái sử dụng cấu trúc hiện có nếu phù hợp. Không mặc định mọi dòng code vẫn ở vị trí cũ.

Phạm vi: `/`, selector/context, các widget Bàn làm việc, luồng mở chi tiết và query `/tasks` cần cho drill-down. Không redesign toàn bộ `/tasks`, `/calendar`, `/org`; không thay quy trình phê duyệt, không thêm bulk approval, không viết lại kiến trúc.

## 2. Cách agent vận hành

1. Đọc spec đầy đủ rồi thực hiện T00 → T12. Mỗi task chỉ đánh dấu xong khi có bằng chứng ở điều kiện hoàn thành.
2. Khi task đang chạy, tự giải quyết lựa chọn implementation nhỏ theo pattern hiện có. Không dừng xin xác nhận giữa các task đã được giao.
3. Nếu thiếu quyền, dữ liệu nghiệp vụ hoặc runtime, hoàn tất phần độc lập còn làm được; ghi blocker đúng task, không tự giả định đạt.
4. Không rollback, stash, reset hoặc stage toàn bộ thay đổi có sẵn của người dùng. Không tự push, merge hoặc deploy chỉ vì plan này yêu cầu implementation.
5. Mỗi task ghi ngắn: trạng thái, file sửa, requirement, lệnh kiểm tra, kết quả, rủi ro còn lại. Dùng `pending / in_progress / done / blocked`; phân biệt `not_run` với `pass`.
6. Chỉ giao một owner tích hợp sửa `dashboard-zone.tsx`, `dashboard-context.tsx`, `use-task-filters.ts` tại một thời điểm. Plan mặc định tuần tự, không cần orchestration hoặc nhiều agent để thực hiện.

Thứ tự bắt buộc:

| Giai đoạn | Task | Điều kiện để đi tiếp |
|---|---|---|
| Baseline | T00–T01 | Có map quyền, query, dữ liệu, test và fixture |
| Thiết kế đích | T02 | Có prototype một luồng, không chỉ ảnh tĩnh |
| Dữ liệu | T03–T05 | Selector production qua test scope, reason, date, count |
| UI và nối hành vi | T06–T09 | Render đúng selector và các thao tác hoạt động |
| Hồi quy và hoàn thiện | T10–T12 | Có test thật, ảnh thật, báo cáo không che blocker |

## 3. T00 — Xác nhận checkout, bảo toàn thay đổi và baseline

**Đầu vào:** spec, repository hiện tại. **File cần đọc:** `package.json`, hướng dẫn repository áp dụng cho checkout, `src/app/page.tsx`, `src/components/dashboard/unified-task-hub-client.tsx`.

Thực hiện:

1. Chạy riêng từng lệnh dưới đây. Ghi HEAD và status vào báo cáo, không xuất nội dung file bí mật.

```bash
git status --short
git rev-parse HEAD
git branch --show-current
git diff --stat
```

2. So sánh HEAD với mốc audit. Dùng `rg` tìm lại symbol nếu file đã đổi, cập nhật map thay vì áp patch mù.
3. Nếu cần branch, tạo nhánh riêng từ checkout hiện tại sau khi xác định cách giữ các thay đổi người dùng; không tự dọn working tree. Tại audit có thay đổi cấu hình Claude và test executor, không thuộc phạm vi UI.
4. Đọc cách runner chọn test và dependency UI/browser đã có:

```bash
rg -n '"(test|typecheck|lint|build)"|playwright|vitest|testing-library|tsx' package.json
rg --files tests scripts | rg 'run-tests|playwright|setup|dashboard|executive|upcoming|workbench'
```

5. Chạy baseline nhóm test liên quan bằng runner thật; ghi failures có sẵn. Không giả định `npm test -- <file>` được hỗ trợ.
6. Khởi động môi trường dev/test theo repo. Dùng account test được phép. Không bật demo session trên production để chụp ảnh.
7. Chụp baseline ở 1440×900, 1280×800, 768×1024, 390×844; ghi role, scope, kỳ, ngày tham chiếu và dataset.

**Hoàn thành:** có bản baseline và danh sách thay đổi có sẵn. Nếu không có browser/runtime, T00 ghi partial; tiếp tục rà soát và code nhưng không nghiệm thu visual.

## 4. T01 — Truy vết hợp đồng trước khi sửa

**Requirement:** F02–F04, F08–F11, F14–F15. **Đầu vào:** T00.

Đọc phần liên quan của:

- `src/hooks/use-task-filters.ts`: scopedBaseTasks, monthScopedBaseTasks, displayedStats, monthFilteredSchoolTasks, executiveStats, departmentHealth, executiveActionItems, roleUpcoming.
- `src/lib/executive-matrix-aggregator.ts`: action items, health matrix, filterTasksByExecutive.
- `src/components/dashboard/dashboard-context.tsx`: data/actions/modal/nav và luồng refresh.
- `src/types/dashboard.ts`, `src/lib/academic-calendar.ts`, `src/lib/format.ts`.
- Policy, endpoint review, schema, component detail và query parser tìm được bằng lệnh sau.

```bash
rg -n 'openTaskDetail|handleSelectUpcoming|TaskDetail' src
rg -n 'requiresReview|PENDING_EXECUTIVE_APPROVAL|NEEDS_REVIEW|approveTaskAtomic' src prisma
rg -n 'capability|canReview|canApprove|reviewLevel|approval' src/server src/app/api
rg -n 'searchParams|useSearchParams|upcoming|audit' src/app/tasks src/components src/hooks
rg -n 'timeZone|Asia/Ho_Chi_Minh|referenceDate|getSystemReferenceDate' src
```

Lập bảng `contract-map`:

| Hợp đồng | Phải ghi rõ |
|---|---|
| Review | Trạng thái request, bước L1/L2 thực tế, actor/capability, endpoint, lỗi 403/409 |
| Scope | Nguồn scope và departmentId, SSR/API confinement, semantics tham gia task con |
| Kỳ | Hàm lọc kỳ hiện có, tồn quá hạn kỳ trước xử lý ở đâu |
| Ngày | Múi giờ chuẩn, date-only so với timestamp, nguồn referenceDate |
| Task detail | Callback, ID lookup, route fallback, close/focus/scroll |
| Drill-down | Query được `/tasks` hiểu thực sự; link audit/upcoming có consumer hay không |
| Activity | Nguồn event type, timestamp, polling/subscription và quyền xem |
| Test | Runner có chạy các test dashboard không, test nào khóa CSS/chuỗi cũ |

**Quyết định bắt buộc:** Không suy quyền từ role label/tên khoa. Nếu payload chưa có đủ thông tin review, ưu tiên tái sử dụng capability đã được server tính; chỉ bổ sung trường nhỏ cần thiết vào payload hiện có khi thực sự thiếu và giữ nguyên quyền server. Nếu chưa chứng minh actor được duyệt, dùng “Hồ sơ chờ xem xét”, không dùng “Chờ bạn duyệt”.

**Hoàn thành:** mỗi dòng hợp đồng có file/symbol thật hoặc ghi unresolved, đặc biệt không để query điều hướng dựa vào phỏng đoán.

## 5. T02 — Fixture và prototype một luồng hoàn chỉnh

**Đầu vào:** T01. **Output:** fixture dùng chung, expected-result độc lập và prototype dev/test.

### Fixture nhỏ có kết quả biết trước

D = 13/09/2026 theo múi giờ nghiệp vụ xác minh ở T01. Ánh xạ trạng thái dưới đây vào schema thật, không tự thêm enum production.

| ID đề xuất | Dữ liệu | Expected |
|---|---|---|
| q01 | IN_PROGRESS, bình thường, D+3, không review | Không vào action queue |
| q02 | 100%, chưa gửi review hợp lệ | Không tự vào chờ bạn duyệt |
| q03 | Review đúng bước cho actor, hạn D+1 | Review queue |
| q04 | Review cho actor, quá hạn D-1 | Một dòng có hai reasons |
| q05 | Blocked, HIGH, D+2 | Vướng mắc |
| q06 | Quá hạn, URGENT, D-3 | Đứng trước priority thấp hơn |
| q07 | COMPLETED, D-2, không blocker còn hiệu lực | Không overdue/action |
| q08 | CANCELLED, D-2 | Không action/upcoming |
| q09 | Không hạn hoặc ngày lỗi | Không đổi thành hôm nay |
| q10 | Task ở đơn vị không được actor truy cập | Không có trong payload/list/count actor |
| q11 | Subtask chờ L1; actor không được duyệt bước đó | Không gắn “chờ bạn duyệt” |
| q12 | Hạn D+6 | Có trong upcoming nếu còn hiệu lực và trong kỳ |
| q13 | Hạn D+7 | Không trong upcoming |
| q14 | Hạn D | Có trong upcoming, không overdue |

Thêm 17 đơn vị: đúng 7 đơn vị có vấn đề và 10 đơn vị không có vấn đề, trong đó có đơn vị 0 task. Expected attention count là 7; attention preview là 5. Nếu footer mở tất cả đơn vị, ghi tổng 17; nếu footer chỉ mở tập cần chú ý, ghi 7. Nhãn và đích phải khớp; không dùng một total cho hai tập.

Fixture lớn: 311 action hợp lệ, 20 upcoming hợp lệ; không gán tất cả IN_PROGRESS thành action để tạo đủ số. Bao gồm tên tiếng Việt dài, thiếu owner, cùng ngày/priority, quyền khác nhau. Expected IDs phải ghi thủ công cho mẫu nhỏ; không dùng chính selector cần test để tạo expected.

### Prototype

1. Dựng trong môi trường preview/test hiện có, không mở route public mới chỉ để demo.
2. Bố cục: header gọn → tóm tắt → queue 5 dòng → đơn vị cần chú ý 5 dòng → upcoming 5 dòng → activity 3 dòng/thu gọn.
3. Có thao tác mở hồ sơ, xem xét, mô phỏng lỗi hợp lệ và trở lại đúng vị trí. Mock chỉ trong dev/test.
4. So với baseline ở 1440×900 và 390×844. Tên/lý do/hạn phải đọc được; loại card lồng card và badge lặp. Không giảm font chỉ để nhét đủ màn hình.
5. Chốt layout bằng screenshot/prototype và ghi quyết định. Mặc định một luồng dọc; không bắt buộc hai cột.

**Hoàn thành:** prototype có luồng và fixture tái lập; agent tự chuyển bước khi yêu cầu rõ. Mục tiêu 4/5 người dùng trong 10 giây để dành kiểm chứng ở T12, không giả lập thành user research.

## 6. T03 — Hợp nhất phạm vi, kỳ và reference date

**File chính:** `src/hooks/use-task-filters.ts`, `src/components/dashboard/dashboard-context.tsx`; reuse helper trong `src/lib/academic-calendar.ts`.

1. Xác định tập task đã được server cho phép truy cập. Không đổi confinement ở page/API để lấy đủ dữ liệu cho dashboard.
2. Tạo một context đầu vào được chuẩn hóa: actor/capabilities, scope, departmentId, kỳ, referenceDate. Tái sử dụng scopedBaseTasks/monthScopedBaseTasks nếu semantics đúng; không tạo bộ lọc thứ ba cùng mục đích.
3. Cho displayedStats, executive queue và department health cùng xuất phát từ tập scope+kỳ đó. Loại nhánh lấy raw `tasks` làm fallback khi tập hợp lệ đang rỗng nếu nó mở rộng scope.
4. Áp cùng context cho deadline; kiểm tra model UpcomingItem có taskId và dữ liệu để giới hạn chính xác. Nếu không đủ thì derive từ scoped tasks hoặc bổ sung mapping hiện có, không lọc bằng title.
5. Truyền referenceDate đã chuẩn hóa xuống presenter. Không tự gọi ngày hiện tại tại từng widget để phân loại.
6. Không gộp dữ liệu khác lần request. Dùng cơ chế query key/cancellation hiện có; nếu chưa có, chặn phản hồi cũ ghi đè theo context key đơn giản. Không thêm thư viện state mới chỉ cho việc này.

**Test:** AC06, AC09, AC14; actor school/unit/my, đổi kỳ, tập rỗng, request trả ngược thứ tự. Assert exact IDs và totals, không chỉ length.

**Hoàn thành:** summary và danh sách cùng context; tập rỗng không quay về school-wide.

## 7. T04 — Sửa action engine và hợp đồng review

**File chính:** `src/lib/executive-matrix-aggregator.ts`, hook và types hiện có. **Phụ thuộc:** T03.

1. Tìm toàn bộ consumer trước khi sửa `ExecutiveFilter`, `ExecutiveActionItem`, `filterTasksByExecutive`.
2. Thay điều kiện review dựa trên 100%/requiresReview bằng request đang chờ đúng workflow đã xác minh T01. Kết hợp capability của actor để chọn nhãn và hành động; không reimplement policy bằng role string.
3. Bỏ rule IN_PROGRESS → STRATEGIC khỏi queue Bàn làm việc. Nếu consumer khác còn cần STRATEGIC, giữ type tương thích ở consumer đó, không đổi semantics toàn app ngoài phạm vi.
4. Dùng taskId làm định danh dòng. Tích lũy reasons trước khi chọn primaryReason, bỏ nhánh `else if` làm mất reason quá hạn khi review.
5. Nhóm chờ xem xét và nhóm vướng mắc/quá hạn lọc theo reasons. Tổng ALL là union distinct, không cộng hai count.
6. Sort: priority giảm dần → overdue trước → due tăng dần → waitingSince tăng dần → taskId. Null date cuối. `primaryReason`: review nếu có request hợp lệ, sau đó blocked, overdue; các badge vẫn giữ reasons còn lại.
7. `actionLabel` là “Xem xét” khi mở hồ sơ review, “Xem chi tiết” cho trường hợp còn lại. Chỉ action trong hồ sơ được ghi “Phê duyệt” nếu thực thi mutation.
8. Không gán BGH khi không resolve được department. Hiển thị “Chưa xác định đơn vị”; log/chẩn đoán theo pattern sẵn có nếu cần, không đổi DB.
9. Trả `allItems`, `filteredTotal`, `previewItems` hoặc cấu trúc tương đương; preview slice sau filter/sort.

**Test:** AC01–AC05, AC10; thêm completed/cancelled và request đã kết thúc. Dùng policy test hiện có cho quyền, không chỉ snapshot nhãn.

**Hoàn thành:** q01/q02 không bị coi action sai; q04 một dòng hai reasons; sort ổn định; review capability không bị mở rộng.

## 8. T05 — Sửa đơn vị, metric và deadline

**File:** aggregator, `dashboard-situation-strip.tsx`, hook, helper ngày/format phù hợp. **Phụ thuộc:** T03; dùng output T04 nếu tổng hợp review.

### Đơn vị

1. Tính attention từ overdue hoặc blocked hoặc SLA có thật. Xóa ngưỡng `<60%` như lý do độc lập.
2. Chuẩn hóa aliases của counters tại một adapter nếu cần; không để mỗi component tự chọn field khác nhau.
3. Phân biệt toàn bộ đơn vị trong scope với tập cần chú ý. Sort attention: overdue giảm dần → blocked giảm dần → tên/ID ổn định.
4. Helper production trả tập đầy đủ, attention count, preview tối đa 5. Không đặt helper này trong test.
5. Dùng nguồn định danh thống nhất; bỏ số đơn vị hardcode từ mô tả header. Không tự bỏ BGH khỏi số liệu nếu semantics chưa thống nhất.
6. Giữ công thức tiến độ có tên đúng; không đổi denominator task cha/task con để làm phần trăm đẹp hơn.

### Deadline

1. Validate date-only nghiêm ngặt, gồm ngày lịch không tồn tại; không chỉ kiểm tra regex.
2. Lọc task còn hiệu lực, cùng scope/kỳ, D ≤ due ≤ D+6 theo ngày nghiệp vụ. So sánh ngày lịch, không cộng 6×24h vào timestamp tùy tiện.
3. Sort due tăng dần → priority giảm dần → ID; giữ total trước khi slice 5.
4. Ngày lỗi được giữ như missing trong data/detail và loại khỏi upcoming. Không fallback hôm nay.
5. Việc quá hạn không xuất hiện trong upcoming; tồn kỳ trước không âm thầm nhập vào kỳ mới.

**Test:** AC07–AC10; đơn vị 0 task không rủi ro, attention 7/full 17/preview 5; D-1,D,D+6,D+7; ranh giới tháng/năm và 23:59/00:01.

**Hoàn thành:** mọi nhãn total có tập dữ liệu rõ; date cùng nghĩa ở server và client.

## 9. T06 — Dựng lại header, summary và action queue

**File:** `dashboard-zone.tsx`, `executive-action-center.tsx`, `dashboard-situation-strip.tsx`, `src/components/workspace/action-queue-shell.tsx` nếu cần. **Phụ thuộc:** T02–T05.

1. H1 “Bàn làm việc”; bỏ role badge/mô tả lặp. Giữ ScopeSwitcher/GlobalMonthSelector và luồng tạo hiện có theo capability. Refresh là action phụ.
2. Đưa summary trước queue. Giữ một summary gọn; count có link đúng tập thay vì thẻ KPI lớn.
3. Queue có ba filter theo spec, accessible selected state và count đúng predicate. Filter được giữ khi mở/đóng detail.
4. Bỏ subtitle/count lặp ở thân. Dùng row căn cột có divider, bỏ border/rounded riêng mỗi item. Tên tối đa hai dòng, metadata đủ đọc.
5. Preview chỉ 5 rows. Bỏ `isExpanded` mở toàn bộ pool và vùng `max-h-[460px]` trong dashboard. “Xem tất cả N” dùng target đã kiểm chứng ở T01/T08.
6. Không dùng destructive button để mở một nhiệm vụ quá hạn; cảnh báo nằm ở reason, action mở là trung tính.
7. Empty state chỉ mô tả đúng tập. Loading/error không dùng chung empty state.
8. Cập nhật test bố cục cũ cùng thay đổi; không giữ ACTION→SITUATION nếu spec đổi thứ tự.

**Kiểm tra:** render fixture lớn chỉ 5 task rows; title dài không đè hạn/CTA; tab/enter thao tác được; không card lồng card trong queue; không dòng count bị lặp.

**Hoàn thành:** cấu trúc đích hiển thị bằng dữ liệu thật từ selector, không duy trì mock prototype trong đường production.

## 10. T07 — Đơn vị, hạn chót và hoạt động

**File:** `department-progress-matrix.tsx`, `upcoming-deadlines-widget.tsx`, `activity-feed-widget.tsx`, `dashboard-zone.tsx`. **Phụ thuộc:** T05–T06.

1. Kiểm tra consumer matrix khác trước khi đổi. Dashboard dùng chế độ summary gọn hoặc component nhỏ tái sử dụng row; không xóa ranking/cards của trang khác nếu vẫn dùng.
2. Hiển thị 5 đơn vị cần chú ý: tên, quá hạn, bị chặn, hoàn thành/tổng, “Xem nhiệm vụ”. Bỏ huy chương, thanh màu dài và toolbar ba kiểu xem tại dashboard.
3. Không có attention: câu ngắn “Không có đơn vị có việc quá hạn hoặc bị chặn trong phạm vi này”; không khẳng định khỏe toàn hệ thống. Vẫn có đích xem đầy đủ.
4. Upcoming nhận total và preview tách bạch, truyền callback/target thật. Không `slice(0,5)` từ parent rồi lấy `items.length` làm total toàn tập.
5. Activity tối đa 3, format timestamp bằng formatter chung; timestamp sai có fallback trung thực. Dùng event type nếu đã có; không thêm event subsystem mới.
6. Bỏ Live cố định. Có subscription state thì nối đúng; polling thì dùng “Cập nhật lúc …”. Category không có nghĩa thì không render nhãn “KHÁC” riêng.
7. Link audit phải đi được và đúng quyền. Nếu không tồn tại đích audit, ẩn link sai và ghi khoảng trống; không điều hướng tới query vô hiệu.

**Kiểm tra:** totals full/preview, click task và unit đúng ID, activity không in ISO thô, component dùng nơi khác không bị mất chức năng.

**Hoàn thành:** F06–F11 được xử lý trong production render, không chỉ sửa helper.

## 11. T08 — Detail, drill-down và đồng bộ sau thao tác

**File:** context, handler openTaskDetail, component detail/route và query parser thực tế từ T01. **Phụ thuộc:** T04–T07.

1. Chọn một target cho mỗi action trong bảng dưới. Không bịa query mới mà không triển khai parser.

| Action | Target và điều kiện |
|---|---|
| Xem xét/task title/deadline | Detail hiện có của đúng taskId; click mở không gửi approval |
| Tất cả action | `/tasks` với predicate tương đương nếu hỗ trợ; nếu thiếu, bổ sung lens nhỏ bằng helper chung hoặc panel list dùng cùng selector |
| Xem nhiệm vụ đơn vị | Scope/kỳ/departmentId giữ nguyên; không chỉ truyền tên đơn vị |
| Tổng quá hạn | Danh sách cùng overdue predicate và context |
| Toàn bộ đơn vị | Đích báo cáo hiện có hoặc panel cùng dữ liệu, total đúng nhãn |

2. Nếu thêm query contract nhỏ, cập nhật serializer/parser cùng nhau; test round-trip và unknown value fallback. Không redesign trang đích.
3. Dùng modal/panel hiện có; mở bằng ID nếu item không có trong preview. Nếu task không tồn tại hoặc không được truy cập, hiển thị thông báo rõ, không return im lặng.
4. Sau review thành công, invalidate/refetch hoặc update nguồn dữ liệu chung để queue, counts, matrix đồng bộ. Không tự decrement mỗi widget riêng.
5. Submit có pending state; 403/409 không xóa hồ sơ như thành công. Lỗi mạng giữ dữ liệu nhập và cho thử lại theo behavior hiện có.
6. Đóng bằng Esc/nút đóng trả focus về trigger. Nếu item vừa biến mất do xử lý xong, focus sang mục tiếp theo hoặc heading queue. Khôi phục scroll/filter; Back/Forward theo navigation pattern T01.

**Test:** AC11–AC13, detail ngoài preview, request stale. Kiểm tra network xác nhận click “Xem xét” không gửi mutation.

**Hoàn thành:** một luồng thật xem → quyết định → quay lại hoạt động; không nút chết, không link sai scope.

## 12. T09 — Mobile và trạng thái dữ liệu

**File:** `workbench-mobile-feed.tsx`, context và dashboard-zone. **Phụ thuộc:** T03–T08.

1. Xóa logic mobile tự lọc NEEDS_REVIEW/overdue nếu trùng selector chung. Mobile nhận cùng action items đã sort; preview có thể 3 thay vì 5 nhưng top 3 phải giống desktop.
2. Giữ scope/kỳ và create theo quyền trên màn nhỏ. Rút greeting dài để nhiệm vụ xuất hiện sớm.
3. Trình bày row dạng dọc: tên → reason → owner/hạn → action. Vùng chạm 44px; không phụ thuộc hover.
4. Nối loading, error, stale, empty, success từ context. Không hiện 0 hoặc “không có việc” trước khi tải thành công.
5. Kiểm tra hai cây mobile/desktop đang mount đồng thời do CSS. Tránh side effect hoặc fetch trùng; không thêm logic data vào cả hai presenter. Không duplicate DOM ID/aria-controls.
6. 390×844 và 768×1024: không overflow ngang trang, CTA không bị bottom nav che. Kiểm tra zoom 200%, keyboard focus, title dài.

**Test:** AC06, AC13–AC15; exact top IDs giữa mobile/desktop cùng role/context; error không bị trình bày thành healthy.

**Hoàn thành:** parity về ý nghĩa và hành động, không chỉ parity màu sắc.

## 13. T10 — Thay các test tạo cảm giác an toàn giả

**File đã biết:** `tests/dashboard-composition-invariants.test.ts`, `tests/executive-action-center-ui.test.ts`, `tests/dashboard-data-consistency-full-regression.test.ts`; tìm test liên quan bằng rg.

1. Test top-5 phải import helper production và có render integration dashboard 17 đơn vị. Xóa helper giả định nghĩa trong test sau khi chuyển coverage.
2. Thống nhất empty-state contract: không bắt buộc ShieldCheck/“Verified Clear” và đồng thời cấm ở nơi khác. Assert nội dung thực render cho loading/error/empty/action-free.
3. Thay assertion class string như max-h 460px, expand label, hideCards bằng kết quả người dùng thấy: 5 rows, count đầy đủ, drill-down đúng, không expand toàn bộ.
4. Test composition render component con; không chỉ search JSX source cha để suy UI.
5. Test selector dùng bộ expected độc lập; test interaction dùng browser/DOM harness hiện có. Nếu chưa có harness, bổ sung tối thiểu tương thích repository và giải thích dependency; không tự nhận source-string test là E2E.
6. Giữ regression authorization, role confinement, denominator và date. Không xóa vì làm UI khó sửa.

Mỗi test được thay phải ghi requirement thay thế. Không cần unit test cho từng class/spacing; visual QA chịu trách nhiệm phần trình bày.

**Hoàn thành:** map AC01–AC15 tới test hoặc kiểm tra thủ công cụ thể; test thật được runner discover. Không còn helper test-only giả làm production.

## 14. T11 — Chạy gate kỹ thuật và visual QA

Chạy targeted test sau mỗi task để phát hiện sai lệch sớm. Khi tích hợp hoàn tất, chạy các gate toàn bộ một lần; chạy lại phần bị ảnh hưởng sau khi sửa lỗi.

```bash
npm run typecheck
npm run lint
npm test
npm run build
git diff --check
git diff --stat
```

Ghi từng command, exit code, thời điểm và log. Không chạy migration/seed production. Nếu build cần service hoặc env chưa có, ghi blocker; hoàn tất kiểm tra còn làm được. Không đổi cấu hình bảo mật để vượt gate.

Chụp cùng fixture và viewport T00; thêm ảnh lỗi/empty và detail. Kiểm tra:

- Header không còn badge/mô tả lặp; tóm tắt nhìn thấy trước queue.
- Task title và reason đọc được; màu không lấn thông tin; không dùng font nhỏ để giảm chiều cao.
- Action và department preview đúng giới hạn, total đầy đủ.
- Không nested scroll hàng đợi 311 dòng.
- Upcoming không chứa quá hạn; task/unit/summary link hoạt động.
- Focus, modal close, Back, scroll và filter được giữ.
- Quyền STAFF/MANAGER/BGH không bị mở rộng.
- Kiểm tra performance trong điều kiện so sánh giống nhau nếu có baseline công cụ: đổi filter và mở detail không xuất hiện waterfall/fetch trùng hoặc render toàn bộ 311 rows. Không đặt con số latency tùy tiện nếu chưa đo.

**Hoàn thành:** kỹ thuật và visual được ghi riêng. Build pass không thay thế UI pass.

## 15. T12 — Nghiệm thu tác vụ và bàn giao

### Tác vụ người dùng

Chuẩn bị ba câu hỏi trên cùng fixture trước/sau: việc cần xử lý trước là gì; đơn vị nào cần đôn đốc và vì sao; mở hồ sơ đó để xem xét rồi quay lại. Nếu có 5 người dùng đại diện, đo thời gian và độ chính xác; mục tiêu spec là 4/5 xác định đúng trong 10 giây.

Nếu không có người tham gia, ghi `usability_validation: not_run`; vẫn bàn giao phần implementation kỹ thuật đã xác minh. Agent không được tự đóng vai năm người dùng để tuyên bố đạt.

### Báo cáo cuối

Đề xuất lưu theo quy ước repo hiện có, ví dụ `docs/agent-work/workbench-uiux/`. Nếu đã có thư mục tương đương thì tái sử dụng. Các tên sau là deliverable đề xuất:

- `baseline.md`: HEAD, status, fixture, failures có sẵn, screenshot references.
- `contract-map.md`: policy, scope, time, route và decision log.
- `acceptance.md`: AC → test → pass/fail/not_run → evidence.
- `implementation-report.md`: file sửa, hành vi thay đổi, gate kỹ thuật, ảnh và blocker.
- Ảnh trước/sau và trace/video lưu theo cơ chế artifact hiện có; tránh commit binary lớn nếu repo có quy tắc khác.

Mẫu bảng tiến độ:

| Task | Trạng thái | File sửa | Requirement | Verification | Blocker |
|---|---|---|---|---|---|
| T00 | pending | — | Baseline | — | — |
| T01 | pending | — | Contract | — | — |
| T02 | pending | — | Prototype | — | — |
| T03 | pending | — | AC06/09/14 | — | — |
| T04 | pending | — | AC01–05/10 | — | — |
| T05 | pending | — | AC07–10 | — | — |
| T06 | pending | — | F01/02/05 | — | — |
| T07 | pending | — | F06–11 | — | — |
| T08 | pending | — | AC11–13 | — | — |
| T09 | pending | — | AC06/13–15 | — | — |
| T10 | pending | — | F12/13 | — | — |
| T11 | pending | — | Technical + visual | — | — |
| T12 | pending | — | Usability + handoff | — | — |

## 16. Bảng truy vết spec → task

| Finding | Task xử lý | Bằng chứng nghiệm thu chính |
|---|---|---|
| F01 | T02,T06 | Ảnh trước/sau, thứ tự render |
| F02 | T04,T08 | Click mở không mutation, review trong hồ sơ |
| F03 | T01,T04 | AC02/03 và policy test |
| F04 | T04 | AC01/04/05 |
| F05 | T06 | AC10, render 5 dòng |
| F06 | T05,T07 | AC07, sort và preview production |
| F07 | T05 | Đơn vị tiến độ thấp không tự thành rủi ro |
| F08 | T03,T05,T07 | Count full/attention/scope nhất quán |
| F09 | T03,T05,T07,T08 | Upcoming total/callback/context |
| F10 | T05 | AC08/09 |
| F11 | T07 | Timestamp và refresh state thật |
| F12 | T10 | Test gọi production và render dashboard |
| F13 | T06,T10 | Empty/error/loading phân biệt |
| F14 | T09 | Top IDs desktop/mobile giống nhau |
| F15 | T03 | AC06 exact IDs theo scope/kỳ |

## 17. Prompt giao cho agent thực thi

Copy phần sau và cung cấp cả hai file spec + plan cho agent trong repository:

```text
Thực thi QCET WORK Bàn làm việc theo hai tài liệu được đính kèm:
1. qcet-workbench-uiux-source-audit-spec.md
2. qcet-workbench-uiux-agent-execution-plan.md

Đọc đầy đủ cả hai trước khi sửa. Bắt đầu T00, kiểm tra HEAD và working tree,
giữ nguyên thay đổi có sẵn của tôi. Mốc audit 2ae829dc chỉ để tham chiếu;
hãy đối chiếu symbol và hành vi hiện tại, không áp patch mù.

Làm lần lượt T00–T12. Mục tiêu là sửa đúng action/scope/date/count và tạo
thay đổi UI nhìn thấy, dùng được. Không chỉ refactor component hoặc đổi màu.
Chốt hợp đồng review từ policy/endpoint hiện có trước khi đổi predicate.
Không tự coi IN_PROGRESS là chiến lược hoặc progress=100 là chờ tôi duyệt.

Tạo fixture expected độc lập; prototype có luồng mở hồ sơ → xem xét → quay lại.
Nối selector production dùng chung desktop/mobile. Cập nhật test cũ mâu thuẫn
theo yêu cầu mới; không xóa test chỉ để xanh. Kiểm tra render component thật.

Tự tiếp tục các bước đã rõ, không dừng sau plan hoặc mỗi task để xin xác nhận.
Nếu thiếu runtime/quyền/dữ liệu, ghi blocker chính xác và hoàn tất phần độc lập.
Không báo test/browser/user testing pass khi chưa chạy. Không tự push/merge/deploy.

Cuối cùng bàn giao file changes, map F01–F15 và AC01–AC15, output typecheck/lint/
test/build, ảnh trước/sau cùng fixture/viewport, luồng review và blocker còn lại.
Nếu chưa có người dùng tham gia đánh giá 10 giây, ghi usability not_run.
```

## 18. Điều kiện dừng đúng

Implementation hoàn thành khi các requirement đã có bằng chứng và gate kỹ thuật/visual đạt; không mở rộng sang redesign module khác. Nếu chỉ thiếu user research, bàn giao kỹ thuật với giới hạn đó. Nếu còn sai quyền, count, scope, ngày hoặc luồng click, trạng thái phải là chưa hoàn thành, ghi task và nguyên nhân cụ thể.
