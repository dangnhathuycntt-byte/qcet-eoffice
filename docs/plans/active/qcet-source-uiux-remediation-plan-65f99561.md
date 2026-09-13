QCET Work — Kế hoạch cải thiện UI/UX đối chiếu source

Ngày rà soát: 13/09/2026. Workspace: qcet work, kết nối trực tiếp qua c2c- qcet eoffical.

Baseline: main tại 65f99561. Kiểm tra lại cuối lượt vẫn cùng commit. Git không có staged/unstaged code; có một tệp cấu hình cục bộ untracked, phải giữ nguyên. Tài liệu này là kế hoạch, không phải báo cáo đã triển khai.

1. Kết luận

UI hiện tại chưa cải thiện đủ vì các lớp mới được thêm vào nhưng nhiều nhánh hiển thị, quy tắc dữ liệu và kiểm thử cũ vẫn tồn tại. Source có bằng chứng cụ thể:

Bộ lọc phạm vi không được áp dụng đồng nhất cho tổng quan, hàng đợi và ma trận đơn vị.

Hàng đợi suy ra quyền cần duyệt từ trạng thái/tiến độ/cờ trên nhiệm vụ mà không nhận actor; mặc định còn ẩn bộ chọn nhóm.

Ma trận dựng 11 đơn vị từ danh sách tĩnh, suy đoán đơn vị từ tên/ngành và cuối cùng gán về BGH. Header và scope dùng danh mục khác.

Tình hình có thể cộng lại hai bộ đếm quá hạn cùng chứa một nhiệm vụ; đơn vị bị đánh dấu cần chú ý chỉ vì tiến độ dưới 60%.

Facade /tasks ép default Kanban, ngăn nhánh đồng bộ view từ URL trong workspace.

Hồ sơ báo lưu thành công dù chỉ cập nhật state/localStorage.

Một số test kiểm tra chuỗi/hàm trong test, chưa kiểm tra cây UI production nên không ngăn được lỗi nhìn thấy.

Cách triển khai: sửa theo các luồng người dùng trọn vẹn trên thành phần hiện có. Không xây dashboard V2, engine thứ hai hoặc harness mới. Mỗi đợt phải có thay đổi nhìn thấy và bằng chứng hành vi trên cùng baseline dữ liệu.

2. Giới hạn và độ tin cậy

Đã đọc toàn bộ hoặc các đoạn có liên quan của các file được dẫn dưới đây, truy vết đường mount và các hàm dữ liệu chính; chưa đọc từng file của toàn bộ repository. Rà soát sâu tập trung vào các màn hình người dùng gửi: bàn làm việc, phạm vi/kỳ, ma trận đơn vị, chi tiết, giao việc, hồ sơ; mở rộng tới entry point /tasks, bố cục shell, mobile và entry point lịch.

Không chạy ứng dụng, truy vấn database hay thực thi test/build trên máy kết nối trong lượt này: bộ công cụ c2c đang cung cấp thao tác đọc, không cung cấp chạy lệnh. execution_summary trả về danh sách rỗng. Không có kết quả test mới để tuyên bố pass/fail. Phát hiện “đã xác nhận” là xác nhận cấu trúc và hành vi thể hiện trong source; ảnh là bằng chứng bổ sung, không thay thế tái hiện runtime.

Không suy ra các bản ghi kiểm thử phải xóa khỏi database. Không kết luận 311 yêu cầu hoặc 267 việc BGH đều sai: dữ liệu thật cần kiểm chứng riêng. Các alias/fallback đã thấy đủ chứng minh nguy cơ gán sai, chưa chứng minh số bản ghi bị ảnh hưởng.

3. Tài liệu và đường chạy thực tế

Đã đối chiếu AGENTS.md, CLAUDE.md, phần kiến trúc của ARCHITECTURE.md, .claude/rules/10-ui.md, .claude/rules/05-domain-freeze.md, docs/product/metrics.md; phần doctrine đầu V5.1 và các đoạn liên quan của docs/plans/active/plan.md.

docs/plans/active/plan.md hiện là UX Reconstruction V3; phần 15 ghi executor đã nghỉ ngày 13/09/2026. V5.1 vẫn ở thư mục active nhưng dựa trên commit 7363c430. Không chạy lại toàn bộ các plan này hoặc khôi phục executor chỉ vì tên thư mục cũ. Kế hoạch này là phần sửa những khoảng trống tại 65f99561, dùng cách làm trực tiếp trong Claude Code đã ghi trong repo.

Màn hình

Đường chạy đã xác minh

Phạm vi sửa

/

src/app/page.tsx → UnifiedTaskHubClient → DashboardStateProvider → DashboardZone

Sửa nhánh đang mount; không mặc định sửa ExecutiveCockpitWorkspace chỉ vì tên phù hợp

Hàng đợi + ma trận

use-task-filters.ts → executive-matrix-aggregator.ts → các component dashboard

Đồng nhất dữ liệu, capability và presentation

/tasks

src/app/tasks/page.tsx → tasks-page-client.tsx → TaskManagementWorkspace → UnifiedAdaptiveWorkspace

Giữ canonical engine, sửa precedence URL/default và toolbar

Tạo/chi tiết từ dashboard

dashboard-modals-host.tsx → CreateTaskModal / TaskDetailSideSheet

Giữ entry point chung, sửa form và bố cục

Tạo task API

CreateTaskModal → performCreateTaskSubmission → submitCreateTask / buildCreateTaskPayload

Giữ submit adapter, idempotency và phản hồi server

Hồ sơ

UserProfileModal → AuthContext.updateProfile

Cần hoàn thiện lưu server trước khi báo thành công

/calendar

src/app/calendar/page.tsx → CalendarMonthGrid + CalendarDaySheet; dùng form/detail chung

Đã có menu Tạo công việc/Tạo sự kiện; không tạo lại tính năng này

Những nền tảng đã có phải giữ

/ đã redirect ?zone=tasks/calendar/org/documents về route chuẩn, giữ các query chuỗi.

TaskManagementWorkspace đã là forwarding facade của một workspace chính.

Create đã có adapter duy nhất, kết quả created/rejected/unknown, giữ draft trong lần mở khi lỗi, và dùng lại idempotency key cho retry.

Có kiểm tra hạn con không vượt cha và phép ánh xạ user/department sang ID, dù UI chọn người vẫn còn vấn đề trùng tên.

TaskDetailSideSheet đã có thứ tự requirement/evidence/action, capability projection, full-screen mobile và hỗ trợ focus. Không mô tả các phần này như chưa tồn tại.

Lịch đã tách menu tạo việc và tạo sự kiện; giữ cơ chế ICT đã có cho meeting.

Có canonical query state, attention resolver, capability engine và ActionInboxService. Không thêm phiên bản thứ hai của chúng.

4. Danh mục phát hiện có địa chỉ source

Các số dòng là tại baseline, dùng làm điểm bắt đầu và phải tìm lại symbol sau mỗi thay đổi.

F01 — Dashboard dùng các tập dữ liệu khác nhau — P1

Bằng chứng: src/hooks/use-task-filters.ts:434–508.

scopedBaseTasks áp dụng scope/đơn vị; monthScopedBaseTasks áp dụng tháng lên tập đó. displayedStats dùng tập này. Nhưng monthFilteredSchoolTasks lọc tháng trực tiếp từ tasks; executiveStats, departmentHealth và executiveActionItems dùng nhánh này. Vai trò executive còn giữ nguyên khi scope chuyển về cá nhân/đơn vị.

Hệ quả: các khối cùng trang có thể nói về phạm vi khác nhau. dashboard-zone.tsx:84–88 tìm item hàng đợi trong baseTasks đã thu hẹp, nên item ngoài phạm vi có thể không mở được.

Sửa: một tập visible tasks được server cho phép, sau đó scope/đơn vị. Tách rõ tập báo cáo trong kỳ và tập hành động còn mở xuyên kỳ. Mỗi khối có nhãn, tổng và danh sách drill-down cùng hợp đồng. Không dùng role để thay cho dataset scope.

F02 — Quy tắc “chờ duyệt” chưa theo người có quyền duyệt — P1

Bằng chứng: src/lib/executive-matrix-aggregator.ts:359–419, 597–733.

extractExecutiveActionItems(tasks, referenceDate) không nhận actor. Điều kiện gồm progressPercent === 100, subtask requiresReview, NEEDS_REVIEW; các task đang làm cũng thành nhóm STRATEGIC. Sắp xếp cuối chỉ theo loại nhóm. ExecutiveActionCenter nhận hideCards = true, nên điều khiển lọc đang nằm trong phần bị ẩn; queue ALL trở thành tập lớn với CTA “Phê duyệt ngay”.

Sửa: nối presentation vào nguồn hành động/capability hiện có; trạng thái chờ duyệt không tự chứng minh đang chờ người đăng nhập. Cờ “cần nghiệm thu” không chứng minh đã nộp. Đặt nhóm hành động gọn độc lập với metric cards. Hàng thường mở yêu cầu, quyết định ở detail sau nội dung/minh chứng. Không coi mọi IN_PROGRESS là chiến lược hoặc cần can thiệp.

Owner cần tái sử dụng: src/domain/tasks/attention-resolver.ts có canUserReviewTask; src/server/services/action-inbox-service.ts có inbox theo actor; detail dùng capability matrix. Trước khi nối inbox server phải kiểm tra phân trang (take:20 ở từng query), loại tài nguyên và quy tắc quyền; không dùng độ dài trang lấy về làm tổng toàn bộ. Không chỉ chuyển một boolean capability cấp actor sang mọi task rồi coi là đủ.

F03 — Tổng quá hạn có thể đếm hai lần; rỗng có thể bị coi là ổn — P1

Bằng chứng: src/components/dashboard/dashboard-situation-strip.tsx:20–43, 72–80; src/lib/dashboard-aggregator.ts:26–132; src/lib/executive-matrix-aggregator.ts:359–419.

Strip cộng stats.overdueTasksCount + executiveStats.overdueTasksCount. Hai aggregator đều đếm nhiệm vụ quá hạn nên một task đang làm đã quá hạn có thể đóng góp vào cả hai số. deriveSituationState coi executiveStats != null là có dữ liệu, dù object toàn số 0. countUnitsNeedingAttention đánh dấu mọi đơn vị có tiến độ <60%.

Sửa: một nguồn đếm hoặc union theo entity ID, không cộng hai summary cùng ý nghĩa. Dùng metadata đã tải/tổng entity thật để tách lỗi/rỗng/không có hành động. Đơn vị cần chú ý phải có lý do cụ thể; bỏ ngưỡng 60% vô điều kiện.

F04 — Danh mục đơn vị phân mảnh và suy đoán chủ trì — P1

Bằng chứng: dashboard-zone.tsx:25,36–41 dùng QCET_DEPARTMENTS; scope-switcher.tsx:23,44–62 và resolveDepartment; executive-matrix-aggregator.ts:90–356,421–593 dựng QCET_DEPARTMENT_DEFINITIONS gồm 11 nhóm, tìm theo alias/tên nhân sự/category và fallback BGH.

Hệ quả: header có 16 đơn vị trực thuộc nhưng ma trận có 11 nhóm tĩnh; bộ đếm ma trận luôn theo danh sách cố định. Alias có chồng lấn, ví dụ mã trung tâm xuất hiện trong nhóm CNTT. Không thể lấy danh mục này thay cho quan hệ tổ chức trong DB.

Sửa: dùng ID quan hệ và danh mục được trả từ server đã có. src/lib/server/dashboard-service.ts đã có prisma.department.findMany ở vùng dòng 106, cần truy tiếp mapping DTO để dùng chung. Không tạo thêm hằng số danh mục mới. Thiếu quan hệ ghi “Chưa xác định đơn vị”; không tự gán BGH hay suy diễn từ tên. Xác định rõ có/không gồm BGH, đơn vị đang hoạt động, đơn vị có nhiệm vụ trong kỳ.

F05 — Ma trận chiếm chỗ, màu rủi ro sai và thao tác không nối — P1 UI

Bằng chứng: dashboard-zone.tsx:119–120 truyền toàn bộ departmentHealth, defaultViewMode="ranking"; department-progress-matrix.tsx:24–26,58–67,142–164,340–351.

Tiến độ dưới 50% tô đỏ, 50–79% tô hổ phách bất kể hạn/vướng.

onSelectDepartment mặc định no-op; navigateToTasks mặc định false; DashboardZone không truyền hai props này. Vì vậy click hàng/Lọc trên đường này không làm như người dùng mong đợi; link Nhiệm vụ riêng vẫn có thể chạy.

getDepartmentTasksUrl chỉ tạo scope=school&dept=..., mất kỳ và loại chỉ số.

Sửa: dashboard hiển thị tối đa 5 đơn vị cần chú ý với một bảng, danh sách đầy đủ mở sang /tasks hoặc trang đơn vị đã tồn tại. Bỏ huy chương/xếp hạng và toggle ba layout tại dashboard. Link/hàng đều thực hiện một tác vụ rõ, giữ bộ lọc; bỏ CTA no-op.

F06 — /tasks mặc định Kanban và bỏ qua view trên URL — P1

Bằng chứng: src/components/tasks/task-management-workspace.tsx:53–74; src/components/workspace/unified-adaptive-workspace.tsx:407–417, 509–538.

Facade mặc định initialViewMode="kanban" rồi luôn truyền xuống. Workspace chỉ nhận queryState.view nếu !initialViewMode. Chỉ đổi chuỗi mặc định sang table vẫn để lại lỗi bỏ qua URL.

Sửa: tách controlled view với initial fallback; khi không controlled, view hợp lệ trên URL thắng default, sau đó mới fallback bảng. Không phá Saved Views và các embed cố ý control. Kiểm tra tải thẳng, reload, Back/Forward, đổi layout và chọn Saved View.

F07 — Advanced form thu dữ liệu nhưng không đưa vào payload — P1

Bằng chứng: create-task-modal.tsx:97–104,1580–1700; src/lib/adapters/create-task-mapper.ts:171–219.

UI có category/VTVL/internalDueDate/requiredDeliverables/requiresReview; mapper chỉ gửi title/dueDate/scope/description/priority/departmentId/assigneeId/collaboratorIds/parentTaskId. Không được đánh đồng toàn bộ advanced đều mất: collaborators và parentTaskId đã được ánh xạ.

Sửa: lập field matrix UI → schema → command → DB → readback. Đợt này ẩn/loại trường chưa được lưu khỏi flow thường, bỏ validation yêu cầu nhập trường sau đó bị bỏ. Giữ trường thật sự được hỗ trợ; nếu trường nghiệp vụ bắt buộc thì hoàn thiện một luồng lưu/readback trước khi bật, không chỉ xóa lời cảnh báo.

F08 — Chọn người theo tên chưa đảm bảo đúng danh tính — P1

Bằng chứng: create-task-modal.tsx:242–302 dùng directory.find(p => normalizedName...); phần lựa chọn ở 650–742 cũng lấy theo tên. Mapper có name index.

Sửa: form giữ assigneeId, tên là nhãn; payload dùng ID được chọn. Danh sách cho thấy tên + đơn vị + email/chức danh khi trùng tên. Không sửa dữ liệu người dùng hoặc dùng heuristic chọn người đầu tiên. Giữ một DRI và loại DRI khỏi collaborator theo ID.

F09 — Draft reset khi mở lại; chọn nhanh ngày bị âm thầm đổi — P1/P2

Bằng chứng: create-task-modal.tsx:773–820 reset form, lỗi, idempotencyKey khi mở; ESC gọi onClose; :918–988 giữ draft/key trong cùng lần mở khi unknown; :991–1017 clamp ngày chọn nhanh về hạn cha bằng chuỗi ngày, có dùng toISOString().

Sửa: bảo vệ draft khi đóng/rời form; quy định rõ lúc hủy chủ động, lúc giữ nháp và lúc chưa biết server đã tạo hay chưa. Không tạo key mới cho retry cùng yêu cầu unknown. Preset không được mang nhãn “+1 tuần” nhưng chọn một ngày đã qua vì clamp; disable kèm lý do hoặc trình bày ngày thực sẽ chọn. Dùng helper ngày ICT hiện có. Không cấm hồi tố toàn hệ thống bằng quy tắc mới khi chưa có căn cứ nghiệp vụ.

F10 — Hồ sơ lưu cục bộ nhưng báo thành công — P1

Bằng chứng: user-profile-modal.tsx:57–80; src/lib/auth-context.tsx:612–658 không gọi API, chỉ state/localStorage/registered users. src/app/api/auth/me/route.ts:8–79 đang chỉ GET dữ liệu từ DB. Onboarding PATCH chỉ lưu onboardingData, không phải endpoint lưu name/title/phone.

Sửa: hoàn thiện self-profile command qua endpoint phù hợp sau inventory; đề xuất mở rộng handler /api/auth/me nếu chưa có command chính thức khác. Schema whitelist tên/điện thoại/chức danh theo chính sách; cấm role, departmentId, isActive và ID tài khoản tùy ý. Await server → nhận DTO → cập nhật client → báo thành công. Lỗi giữ form; reload/phiên đăng nhập mới đọc lại đúng. Vai trò và đơn vị xác nhận chỉ đọc.

F11 — Chi tiết đã có thứ tự mới nhưng vẫn lặp metadata và khối rỗng — P2

Bằng chứng: task-detail-side-sheet.tsx:950–1008 header status; :1117–1159 thêm status/deadline; :1164 metadata card; :1900–1940 khối rỗng việc con; :2050–2130 audit history và derived milestones.

Sửa: chỉ một status/deadline, metadata thành dòng thuộc tính gọn; ID kỹ thuật không chiếm tiêu đề; việc con rỗng là một dòng. Giữ thật sự khác nhau giữa audit server và mốc suy ra: thu gọn mốc suy ra hoặc đưa vào thuộc tính, không trộn thành lịch sử giả. Panel desktop giảm backdrop/blur để nhận biết danh sách; mobile giữ full-screen, nút quay lại và action cuối.

F12 — Hạn chót 7 ngày tới không được ràng buộc ở thành phần nhận — P2

Bằng chứng: dashboard-zone.tsx:123–124 đưa roleUpcoming.slice(0,5) vào widget; use-task-filters.ts:550–559 lọc upcoming theo role; upcoming-deadlines-widget.tsx:97–130 render trực tiếp và đặt tiêu đề “Hạn chót 7 ngày tới”, không tự lọc khoảng 0–7 ngày. Ảnh cho thấy item quá hạn trong khối này.

Sửa: kiểm tra nguồn tạo upcoming, sau đó đặt một selector dùng chung cho khoảng ngày; tách quá hạn khỏi sắp đến hạn. Truyền callback mở task đã có; giữ phạm vi và minh bạch tập kỳ. Không sửa bằng cách đổi tiêu đề nếu sản phẩm cần đúng danh sách sắp đến hạn.

F13 — Kiểm thử chưa chạm đúng UI được render — P1 cho gate

Bằng chứng: tests/dashboard-composition-invariants.test.ts:153–191 kiểm tra prohibited markers trên dashboardSource, không trên actionCenterSource dù component con có marker đó. Giới hạn 5 đơn vị được kiểm bằng helper getDepartmentDashboardSummary tự định nghĩa trong test, không được gọi ở DashboardZone. tests/profile-rbac-invariants.test.ts chỉ tìm các chuỗi nút role và nhãn chỉ đọc, không kiểm chứng lưu server.

Sửa: test cây production đã mount hoặc production selector thực sự được component sử dụng. Thêm journey kiểm chứng lưu/readback và query navigation. Không thay test để hợp thức hóa lỗi, nhưng bỏ assertion bám layout cũ khi quyết định UX đã đổi có ghi nhận.

F14 — Script chụp ảnh không phải kiểm chứng visual regression — P2

Bằng chứng: scripts/verify-ui-ux-visual-regressions.sh:25–78 trỏ localhost:3001, chụp ?zone=*, chỉ kiểm tra file ảnh tồn tại, không xác nhận phiên đăng nhập, trang cuối, dữ liệu hoặc tương tác. Cỡ “fold” 1440×1200 không đại diện laptop 900 px cao.

Sửa: sửa script hiện có hoặc bổ sung vào hạ tầng capture đã có; không dựng framework mới. Phải xác nhận route canonical, người dùng/fixture hợp lệ, readiness selector và screenshot trước/sau cùng viewport. File tồn tại không tương đương UI đúng. Không tạo cookie admin production để chụp ảnh.

5. Hình dạng UI đích

Giữ doctrine Linear đã chốt và bố cục ACTION → SITUATION → CONTEXT trong plan repo để không tạo thêm thứ tự cạnh tranh. Khác biệt với mockup trước: ma trận dashboard chỉ tối đa 5 đơn vị có lý do cần chú ý; danh sách đầy đủ ở màn hình phù hợp. Không dùng mẫu 4 đơn vị giả để thay dữ liệu sản phẩm.

Vùng

Quyết định cụ thể

Shell

Một sidebar trung tính; một topbar ổn định; dùng DESIGN.md/token hiện có, font Be Vietnam Pro; không đổi toàn bộ spacing chỉ vì screenshot được phóng lớn

Header dashboard

“Bàn làm việc”; bỏ badge lặp vai trò; một hàng Phạm vi + Kỳ vận hành; thêm CTA tạo việc nếu capability cho phép, làm mới là secondary

Hàng đợi

Tab/nhóm hành động gọn độc lập với metric cards; 3–5 hàng; loại yêu cầu và lý do cần bạn xử lý; không expand 300 hàng ngay trong dashboard

Situation

Một dòng tổng, mẫu số rõ; không cộng số cùng nghĩa; thiếu dữ liệu không hiện xanh

Đơn vị

Tối đa 5 dòng cần chú ý; tên, số quá hạn/vướng/chờ duyệt và tiến độ được định nghĩa; mỗi số mở đúng tập nhiệm vụ

Scope

Một bộ chọn; Toàn trường/Đơn vị/Của tôi khác nhau rõ; danh mục từ cùng server; bỏ quản trị phân quyền khỏi menu đổi tập dữ liệu

Kỳ

Nhãn “Kỳ vận hành T9 · 25/08–24/09”; popover ngắn, nhóm kỳ theo năm học, giữ 25–24 và query contract; bỏ số đếm nếu không phục vụ thao tác

/tasks

Bảng mặc định nhưng tôn trọng URL/Saved View; một search danh sách; Filter/Display gom cấu hình; không thêm toolbar thứ hai

Chi tiết

Tên → trạng thái/hạn → chủ trì → yêu cầu → minh chứng → quyết định → việc con → lịch sử; một surface và một nguồn capability

Giao việc

Nội dung → người chủ trì/đơn vị/hạn → thông tin bổ sung có lưu thật → submit; ngữ cảnh cha kế thừa, không ép người dùng hiểu phân loại nội bộ

Hồ sơ

Thông tin cá nhân chỉnh sửa tách khỏi quyền/đơn vị chỉ đọc; lưu có pending/error/server success

Mobile

Cùng dataset/selector và hành động với desktop, chỉ khác bố cục; giữ full-screen detail, focus, bàn phím và một owner cho safe-area

Nguyên tắc thị giác: chữ chính 14 px, chữ phụ tối thiểu 12 px theo rule; hàng 44–56 px tùy nội dung; touch target khoảng 44 px; icon stroke 1.5; một CTA chính mỗi flow; semantic tokens light-only. Không dùng màu đỏ chỉ từ tỷ lệ % thấp.

6. Kế hoạch thực thi theo gói công việc

Mỗi gói kết thúc bằng diff gọn, targeted checks có ý nghĩa và bằng chứng màn hình nếu thay UI. Các file ghi “đề xuất mới” chưa phải file tồn tại. Không mở rộng phạm vi chỉ để chia được thêm agent.

R0 — Khóa baseline và thống nhất tiêu chí

Phụ thuộc: không. Đầu ra: một ghi nhận baseline và danh mục test liên quan.

Đọc lại hướng dẫn repo, git status, HEAD; nếu source đã khác 65f99561, rà lại các symbol trong mục 4.

Chốt kế hoạch này là delta cho các flow đang mount; V3/V5.1 dùng làm context, không chạy lại mọi task cũ.

Sửa điểm mâu thuẫn tài liệu đúng phạm vi: status lifecycle khác attention; requiresReview là cấu hình; overdue không đồng nghĩa blocked; không coi 100% tiến độ là phê duyệt. Chưa đổi enum/quyền.

Chụp baseline /, /tasks, một task detail, form tạo, profile ở 1440×900 và 390×844 với cùng dữ liệu. Kiểm tra thêm 320 px cho tràn ngang.

Chạy các test liên quan một lần; ghi lỗi đã có. Chọn DB test được xác nhận vì scripts/run-tests.mjs bật DB tests và chỉ rewrite tên DB khớp mẫu qcet_eoffice.

Nghiệm thu: biết app đang chạy đúng commit/route và ai đăng nhập; không gọi ảnh login/empty là baseline dashboard.

R1 — Sửa tập dữ liệu, trạng thái chú ý và chỉ số

Phụ thuộc: R0. File chính: src/hooks/use-task-filters.ts, src/lib/dashboard-aggregator.ts, src/lib/executive-matrix-aggregator.ts, src/components/dashboard/dashboard-situation-strip.tsx.

Tách pipeline visible → scoped → reportingPeriod, và scoped → unresolvedActions. Giữ authorization ở server.

Truy vết các consumer cần parent/subtask; ghi rõ entity type và ID dedup. Không tạo tổng trộn tầng không có nhãn.

Thay inference progress/flag bằng lifecycle/attention canonical đã có; kiểm tra maker/checker và explicit server denial.

Một nguồn quá hạn; blocker là chiều riêng; sửa empty stats object không đủ chứng minh có dữ liệu.

Truyền referenceDate thống nhất thay sử dụng TODAY_ISO ở thời điểm import cho một số hàm và ngày runtime ở hàm khác.

Test tái hiện bắt buộc: một task đang làm quá hạn xuất hiện trong hai aggregator vẫn hiển thị 1; task chờ duyệt đồng thời quá hạn không bị mất chiều quá hạn; chưa nộp nhưng requiresReview không thành yêu cầu duyệt; actor không có quyền không có CTA; scope đơn vị không có item đơn vị khác; đổi tháng không che backlog; empty/loading/error phân biệt.

Test hiện có cần mở rộng: tests/dashboard-scope-invariants.test.ts, tests/dashboard-aggregator-consistency.test.ts, tests/executive-action-items-extractor.test.ts, tests/action-queue-authority.test.ts. Chỉ thêm file khi các suite này không phù hợp.

R2 — Chuẩn hóa đơn vị cho đúng luồng dashboard

Phụ thuộc: hợp đồng R1. File chính: executive-matrix-aggregator.ts, src/lib/server/dashboard-service.ts, src/types/dashboard.ts, scope-switcher.tsx, dashboard-zone.tsx.

Theo mapping server đang có để cung cấp cùng danh mục đơn vị cho header/scope/matrix.

Dùng quan hệ ID làm key; chuyển alias vào lớp tương thích duy nhất nếu dữ liệu lịch sử bắt buộc. Loại fallback theo tên người/category/BGH khỏi aggregate đang chạy.

Dùng tổng đơn vị hợp lệ, tổng đơn vị có task và tổng đơn vị cần chú ý với tên riêng. Không hard-code 11 hoặc 16.

Không sửa hàng loạt database trong đợt UX. Nếu tìm thấy bản ghi thiếu quan hệ, báo số lượng và cần quy trình dữ liệu riêng.

Nghiệm thu: thêm một đơn vị hợp lệ trong fixture server thì tất cả surface nhìn thấy nhất quán; tên hiển thị thay đổi không đổi attribution; task thiếu đơn vị không cộng sang BGH. Unit không có nhiệm vụ không bị đánh dấu nguy hiểm chỉ vì 0%.

Tests: tests/department-resolution-consistency.test.ts, tests/executive-matrix-aggregator.test.ts, tests/dashboard-zone-dynamic-units.test.ts.

R3 — Làm lại dashboard trên composition hiện hữu

Phụ thuộc: R1/R2. File chính: dashboard-zone.tsx, executive-action-center.tsx, department-progress-matrix.tsx, dashboard-situation-strip.tsx, upcoming-deadlines-widget.tsx, workbench-mobile-feed.tsx.

Xóa badge/đoạn mô tả lặp ở đầu. Giữ một header ngữ cảnh, CTA theo capability.

Đổi shell hàng đợi thành section phẳng; đưa nhóm lọc ra khỏi nhánh !hideCards. Xóa tiêu đề phụ bị lặp hai lần. Giới hạn 3–5 mục; “Xem tất cả” chuyển sang tập đã lọc.

Ma trận summary compact, tối đa 5 hàng sau lọc/sort theo vấn đề; đặt view mặc định và giới hạn tại component production hoặc selector được thực sự gọi. Không chỉ thêm helper vào test.

Dòng và số dẫn đúng /tasks với scope, đơn vị, period, attention; loại button không có effect; tránh lồng link trong vùng click hàng gây xung đột.

Giữ một situation strip, hoạt động gần đây thu gọn. Upcoming chỉ chứa ngày trong khoảng cần công bố; quá hạn ở nhóm riêng.

Mobile nhận cùng mô hình dữ liệu đã xử lý; không viết rule urgency thứ hai trong mobile feed.

Nghiệm thu hình ảnh: màn hình đầu 1440×900 có item hành động đầu và phần tình hình/đơn vị; không cần cuộn qua 5 thẻ lớn; không có hàng loạt progress đỏ; nhãn scope/kỳ đọc được; 390 px dùng được bằng chạm. Tên dài không che hạn/nút.

Tests: tests/dashboard-composition-invariants.test.ts, tests/department-progress-matrix-view-mode.test.ts, tests/executive-department-drilldown.test.ts. Test render phải kiểm tra text/component con thật.

R4 — Gọn scope và kỳ, giữ hợp đồng URL

Phụ thuộc: R2; UI skeleton có thể chuẩn bị sau R0. File: src/components/layout/scope-switcher.tsx, global-month-selector.tsx, src/hooks/use-workspace-query.ts và consumer thực sự liên quan.

Một trigger ngắn, một nhóm scope chính, danh sách đơn vị có tìm không dấu như hiện có. Chuyển quản trị ủy quyền về vị trí quản trị hiện hữu; giữ entry point có quyền nếu cần.

Sửa nhãn “tháng” thành “kỳ vận hành” tại phần dùng 25–24; không thay tháng lịch dương ở calendar.

Popover dùng danh sách gọn; không nhân bản 12 card đếm số. Giữ current/selected khác nhau và năm học chính xác.

Đổi một context không xóa search/filter/view vô cớ; Back/Forward phục hồi; loading không hiện dữ liệu scope cũ dưới nhãn scope mới.

Tests: tests/scope-switcher-combobox.test.ts, tests/scope-switcher-mobile.test.ts, tests/academic-period-selector-unification.test.ts, tests/workspace-query.test.ts.

R5 — Sửa view mặc định và khôi phục trạng thái /tasks

Phụ thuộc: R0, query contract ổn định. File: src/components/tasks/task-management-workspace.tsx, src/components/workspace/unified-adaptive-workspace.tsx, src/components/dashboard/unified-task-toolbar.tsx.

Bỏ ép Kanban từ facade. Xác lập controlled prop → URL hợp lệ → initial fallback → bảng, hoặc quy tắc tương đương được test rõ.

Không để initial prop được hiểu như controlled prop suốt vòng đời.

Một toolbar: scope/search/filter/display/create; period trong ngữ cảnh phù hợp; density/layout/grouping vào Display; giữ Saved Views hiện có.

Rà nhánh sync chỉ set khi query có giá trị: xóa q/dept/status bằng Back/Forward cũng phải xóa filter nội bộ, không chỉ xử lý lúc query được thêm.

Click task → đóng → quay lại giữ tập dữ liệu, vị trí cuộn và selection theo hợp đồng; không ép mọi thay đổi sang replace nếu người dùng cần lịch sử navigation.

Nghiệm thu: /tasks default table; /tasks?view=table và ?view=kanban đúng sau reload; Saved View có layout riêng đúng; xóa query bằng Back không để lọc ma; chip và hàng khớp.

Tests: tests/workspace-query.test.ts; bổ sung test integration entry-point/forwarding cho lỗi precedence nếu suite hiện có chưa chạm đường mount. Không chỉ test engine độc lập không có facade.

R6 — Sửa giao việc theo field contract thật

Phụ thuộc: R0; không cần chờ ma trận UI. File: create-task-modal.tsx, src/lib/adapters/create-task-mapper.ts, src/contracts/tasks.ts, tests create.

Lập field matrix và bỏ trường không lưu khỏi form thường; giữ collaborators/parent linkage đã được hỗ trợ.

Chuyển selected assignee sang ID ngay tại control; tra tên/đơn vị chỉ để hiển thị; test hai người trùng tên.

Title có label thực; form cơ bản ngắn; parent context dùng tên và hạn gọn; không lộ ID dài hay lời giải thích “hợp đồng tạo nhiệm vụ”.

Preset ngày hiển thị đúng ngày thật sẽ chọn, không silent clamp; dùng helper ICT. Cha quá hạn có hướng xử lý hợp lệ, không tự gia hạn.

Tách state draft khỏi mounted modal nếu cần giữ qua đóng/mở; key unknown đi cùng draft. Discard chủ động phải rõ hậu quả với request chưa xác định.

Giữ nguyên cơ chế performCreateTaskSubmission và adapter một đường; lỗi không xóa form; request chưa xác định không báo thất bại chắc chắn.

Nghiệm thu: tạo → reload vẫn có toàn bộ trường UI nhận; chọn đúng người trùng tên; retry không tạo bản ghi thứ hai; đóng rồi mở không mất draft ngoài hành vi discard đã công bố; label preset khớp ngày chọn.

Tests: tests/create-task-modal-validation.test.ts, tests/create-task-modal.test.ts; thêm integration create/readback vào suite adapters/API hiện có được tìm bằng rg trước khi sửa. Không tắt idempotency test để làm form đơn giản hơn.

R7 — Hoàn thiện lưu hồ sơ rồi mới tinh gọn modal

Phụ thuộc: R0, whitelist schema. File: user-profile-modal.tsx, src/lib/auth-context.tsx, src/contracts/users.ts, src/app/api/auth/me/route.ts nếu chọn mở rộng route hiện hữu; service theo cấu trúc repo sau inventory.

Xác minh không có self-profile command khác; tái sử dụng nếu có. Không dùng onboarding PATCH như chỗ lưu mọi thuộc tính user.

Lưu tên/điện thoại/chức danh được phép; session identity quyết định tài khoản; cấm trường quyền/đơn vị đã xác nhận bằng schema strict và policy server.

updateProfile có kết quả async; chỉ sync state/cache từ DTO server sau success. Await, loading, field error, dirty state.

Modal đổi thành hồ sơ cá nhân gọn; role/đơn vị read-only thành dòng. Dùng primitive dialog/focus sẵn có khi thích hợp, không dựng modal framework mới.

Nghiệm thu: request bị từ chối không hiện success; reload/tab khác/đăng nhập mới đọc đúng DB; không tự đổi role/đơn vị qua body PATCH; đóng modal trả focus.

Tests: giữ tests/profile-rbac-invariants.test.ts; bổ sung API integration self-profile persistence (file mới nếu chưa có). Test chỉ tìm text “chỉ đọc” không đủ.

R8 — Tinh gọn chi tiết và thống nhất hành động

Phụ thuộc: hợp đồng R1, submit/create R6. File: task-detail-side-sheet.tsx, dashboard-modals-host.tsx, capability/command adapters chỉ khi có defect chứng minh.

Giữ một status/deadline; topbar dành cho back/close và thông tin nhận diện ngắn.

Thu metadata grid, bỏ empty card không có thông tin. Giữ requirement/evidence/action đã có thay vì tái viết.

Audit thật giữ nguồn; derived facts thu vào chi tiết phụ, không đóng vai lịch sử.

Mọi entry point dùng cùng capability và server command. Rà callback handleExecutiveClose/onStatusChange để chắc chắn thông báo thành công đi sau kết quả server, không suy từ việc callback đã được gọi.

Khi mở create child, điều phối một flow có back/draft; tránh hai modal cùng giữ scroll lock/focus. Giữ deep link và mobile full-screen.

Tests: tests/tasks/task-detail-action-capability.test.ts, tests/task-detail-side-sheet.test.ts, tests/task-detail-sheet.test.ts; screenshot task không có con, chờ duyệt có minh chứng, denied và title dài.

R9 — Lịch, shell và mobile kiểm tra liên thông

Phụ thuộc: R4/R6/R8. File: src/app/calendar/page.tsx, src/components/calendar/calendar-day-sheet.tsx, src/components/layout/app-shell.tsx, topbar/sidebar nơi cần chỉnh.

Đây là gói kiểm chứng liên thông, mức rà soát hiện tại thấp hơn dashboard; không gán sẵn mọi lỗi của ảnh cũ cho source lịch mới.

Giữ menu Tạo công việc/Tạo sự kiện đã có và prefill ngày được chọn; kiểm tra save meeting đúng API và timezone.

Kiểm tra nhãn tháng dương/kỳ vận hành và phạm vi giữa lịch → task detail → create → back.

Giảm chrome dùng chung khi có ảnh trước/sau cho thấy lợi ích. Không đồng loạt đổi sidebar width mà không xử lý main offset (hiện 248 px trong AppShell).

Kiểm tra 640/768 px: dashboard dùng sm, shell/nav dùng md; không mất control trong khoảng breakpoint.

Một nguồn padding safe-area; CTA không bị bàn phím/bottom nav che; không thêm PWA popup mới.

Tests: tests/calendar-route-integration.test.ts, tests/calendar-task-interaction.test.ts, tests/calendar-presentation.test.ts, tests/app-layout.test.ts và nav suite liên quan sau inventory.

R10 — Gate cuối có khả năng phát hiện lỗi người dùng thấy

Phụ thuộc: từng gói khi hoàn thành, chốt sau R9.

Sửa test composition kiểm tra component con đang render; row limit dùng production code. Xóa helper chỉ tồn tại để chứng minh một điều UI không thực thi.

Chụp đúng route, session, dataset, cùng viewport trước/sau. Mở cả overlay/empty/error, không chỉ chụp trang gốc.

Lưu kết quả thực tế cùng commit; một bảng requirements → bằng chứng. Không gọi “verified” chỉ vì PNG tồn tại.

Chạy verify/build toàn hệ thống một lần ở integration ổn định; chạy lại rộng chỉ khi lỗi còn lại đòi hỏi. Không chạy toàn bộ suite sau mỗi thay đổi bo góc.

7. Thứ tự ghép và phạm vi công việc

R0 baseline và hợp đồng.

R1/R2 dữ liệu và tổ chức; R5 query/view; R7 profile có thể làm thành commit độc lập khi không sửa chung owner.

R3/R4 dashboard và điều khiển; đây là mốc phải cho người dùng thấy ảnh khác biệt rõ.

R6/R8 create/detail, bảo vệ các cải tiến submit đã có.

R9 liên thông; R10 nghiệm thu tổng.

Nếu Claude Code dùng các reviewer/worker theo hướng dẫn riêng của repo, phân ownership rõ: data không cùng lúc sửa layout dashboard-zone; create và detail tách file nhưng thống nhất callback qua dashboard-modals-host; query owner giữ use-workspace-query/workspace. Không có yêu cầu phải dùng multi-agent để đạt kết quả; không tái tạo executor đã nghỉ.

Điểm dừng scope: không refactor backend toàn bộ, đổi mô hình tổ chức, đổi enum, tách microservice, viết lại task engine, làm lại calendar hoặc bổ sung tính năng nâng cao chưa được yêu cầu chỉ để hoàn thành UI.

8. Lệnh và bằng chứng nghiệm thu

Lệnh hiện có đã xác minh từ package.json và scripts; chạy trên máy có repository. Đây là hướng dẫn, chưa phải lệnh đã chạy trong lượt rà soát.

git status --short
git rev-parse HEAD
npx tsx --test tests/dashboard-composition-invariants.test.ts tests/dashboard-scope-invariants.test.ts tests/executive-action-items-extractor.test.ts
npx tsx --test tests/create-task-modal-validation.test.ts tests/create-task-modal.test.ts tests/tasks/task-detail-action-capability.test.ts
npx tsx --test tests/workspace-query.test.ts tests/academic-period-selector-unification.test.ts
npm run typecheck
npm run lint
npm test
npm run build

Không in env/secrets. Trước npm test, kiểm chứng DB đích là môi trường test riêng: runner chỉ thay tên DB theo regex cụ thể, không bảo đảm mọi DATABASE_URL tùy chỉnh đều an toàn. Dùng thông tin kết nối đã thiết lập cho test theo quy trình repo, không bịa URL.

Tình huống

Kết quả bắt buộc

Bằng chứng

Chọn 2 scope liên tiếp

Hàng đợi/bảng/summary đúng scope, không có item bấm không mở

Integration và screenshot

Cùng task quá hạn ở hai aggregate

Tổng quá hạn chỉ một entity tương ứng

Fixture deterministic

Chờ duyệt + quá hạn

Hai chiều đúng; không cộng đôi tổng distinct

Selector/API test

Chuyển kỳ

Report đổi; backlog vẫn có nhãn xuyên kỳ

Journey

Thêm đơn vị server

Header/menu/matrix cùng danh mục và quy tắc count

Contract test

/tasks?view=table

Đúng bảng sau load/reload/Back

Browser journey

Click số quá hạn của đơn vị

Đúng đơn vị + attention + kỳ; số khớp danh sách

Query integration

Hai người trùng tên

ID payload là người được chọn

Form/adapter test

Tạo việc mất phản hồi

Draft giữ, retry key giữ, một bản ghi

Mutation integration

Preset vượt hạn cha

Không âm thầm chọn ngày khác nhãn

Form interaction

Lưu hồ sơ lỗi

Không có success; form giữ dữ liệu

API/UI test

Lưu hồ sơ thành công

Reload từ DB đúng, quyền không đổi

Readback test

Dashboard >5 đơn vị

Chỉ tối đa 5 dòng summary, link tới phần đầy đủ

Render production tree

Empty/denied/loading

Không gắn “healthy” hoặc “Verified Clear” từ thiếu dữ liệu

Render state matrix

Mobile 390/320 px

Không tràn toàn trang; thao tác chính không bị che

Screenshot + keyboard/touch

Mục tiêu trải nghiệm đề xuất, chưa đo: người mới nhận ra việc cần mình quyết định trong khoảng 10 giây; nhận ra đơn vị đang vướng trong khoảng 10 giây; từ chỉ số đi tới danh sách nguyên nhân trong một thao tác. Đo lại với cùng dữ liệu thay vì tuyên bố đạt bằng nhận xét chủ quan.
QCET Work — Kế hoạch cải thiện UI/UX đối chiếu source

Ngày rà soát: 13/09/2026. Workspace: qcet work, kết nối trực tiếp qua c2c- qcet eoffical.

Baseline: main tại 65f99561. Kiểm tra lại cuối lượt vẫn cùng commit. Git không có staged/unstaged code; có một tệp cấu hình cục bộ untracked, phải giữ nguyên. Tài liệu này là kế hoạch, không phải báo cáo đã triển khai.

1. Kết luận

UI hiện tại chưa cải thiện đủ vì các lớp mới được thêm vào nhưng nhiều nhánh hiển thị, quy tắc dữ liệu và kiểm thử cũ vẫn tồn tại. Source có bằng chứng cụ thể:

Bộ lọc phạm vi không được áp dụng đồng nhất cho tổng quan, hàng đợi và ma trận đơn vị.

Hàng đợi suy ra quyền cần duyệt từ trạng thái/tiến độ/cờ trên nhiệm vụ mà không nhận actor; mặc định còn ẩn bộ chọn nhóm.

Ma trận dựng 11 đơn vị từ danh sách tĩnh, suy đoán đơn vị từ tên/ngành và cuối cùng gán về BGH. Header và scope dùng danh mục khác.

Tình hình có thể cộng lại hai bộ đếm quá hạn cùng chứa một nhiệm vụ; đơn vị bị đánh dấu cần chú ý chỉ vì tiến độ dưới 60%.

Facade /tasks ép default Kanban, ngăn nhánh đồng bộ view từ URL trong workspace.

Hồ sơ báo lưu thành công dù chỉ cập nhật state/localStorage.

Một số test kiểm tra chuỗi/hàm trong test, chưa kiểm tra cây UI production nên không ngăn được lỗi nhìn thấy.

Cách triển khai: sửa theo các luồng người dùng trọn vẹn trên thành phần hiện có. Không xây dashboard V2, engine thứ hai hoặc harness mới. Mỗi đợt phải có thay đổi nhìn thấy và bằng chứng hành vi trên cùng baseline dữ liệu.

2. Giới hạn và độ tin cậy

Đã đọc toàn bộ hoặc các đoạn có liên quan của các file được dẫn dưới đây, truy vết đường mount và các hàm dữ liệu chính; chưa đọc từng file của toàn bộ repository. Rà soát sâu tập trung vào các màn hình người dùng gửi: bàn làm việc, phạm vi/kỳ, ma trận đơn vị, chi tiết, giao việc, hồ sơ; mở rộng tới entry point /tasks, bố cục shell, mobile và entry point lịch.

Không chạy ứng dụng, truy vấn database hay thực thi test/build trên máy kết nối trong lượt này: bộ công cụ c2c đang cung cấp thao tác đọc, không cung cấp chạy lệnh. execution_summary trả về danh sách rỗng. Không có kết quả test mới để tuyên bố pass/fail. Phát hiện “đã xác nhận” là xác nhận cấu trúc và hành vi thể hiện trong source; ảnh là bằng chứng bổ sung, không thay thế tái hiện runtime.

Không suy ra các bản ghi kiểm thử phải xóa khỏi database. Không kết luận 311 yêu cầu hoặc 267 việc BGH đều sai: dữ liệu thật cần kiểm chứng riêng. Các alias/fallback đã thấy đủ chứng minh nguy cơ gán sai, chưa chứng minh số bản ghi bị ảnh hưởng.

3. Tài liệu và đường chạy thực tế

Đã đối chiếu AGENTS.md, CLAUDE.md, phần kiến trúc của ARCHITECTURE.md, .claude/rules/10-ui.md, .claude/rules/05-domain-freeze.md, docs/product/metrics.md; phần doctrine đầu V5.1 và các đoạn liên quan của docs/plans/active/plan.md.

docs/plans/active/plan.md hiện là UX Reconstruction V3; phần 15 ghi executor đã nghỉ ngày 13/09/2026. V5.1 vẫn ở thư mục active nhưng dựa trên commit 7363c430. Không chạy lại toàn bộ các plan này hoặc khôi phục executor chỉ vì tên thư mục cũ. Kế hoạch này là phần sửa những khoảng trống tại 65f99561, dùng cách làm trực tiếp trong Claude Code đã ghi trong repo.

Màn hình

Đường chạy đã xác minh

Phạm vi sửa

/

src/app/page.tsx → UnifiedTaskHubClient → DashboardStateProvider → DashboardZone

Sửa nhánh đang mount; không mặc định sửa ExecutiveCockpitWorkspace chỉ vì tên phù hợp

Hàng đợi + ma trận

use-task-filters.ts → executive-matrix-aggregator.ts → các component dashboard

Đồng nhất dữ liệu, capability và presentation

/tasks

src/app/tasks/page.tsx → tasks-page-client.tsx → TaskManagementWorkspace → UnifiedAdaptiveWorkspace

Giữ canonical engine, sửa precedence URL/default và toolbar

Tạo/chi tiết từ dashboard

dashboard-modals-host.tsx → CreateTaskModal / TaskDetailSideSheet

Giữ entry point chung, sửa form và bố cục

Tạo task API

CreateTaskModal → performCreateTaskSubmission → submitCreateTask / buildCreateTaskPayload

Giữ submit adapter, idempotency và phản hồi server

Hồ sơ

UserProfileModal → AuthContext.updateProfile

Cần hoàn thiện lưu server trước khi báo thành công

/calendar

src/app/calendar/page.tsx → CalendarMonthGrid + CalendarDaySheet; dùng form/detail chung

Đã có menu Tạo công việc/Tạo sự kiện; không tạo lại tính năng này

Những nền tảng đã có phải giữ

/ đã redirect ?zone=tasks/calendar/org/documents về route chuẩn, giữ các query chuỗi.

TaskManagementWorkspace đã là forwarding facade của một workspace chính.

Create đã có adapter duy nhất, kết quả created/rejected/unknown, giữ draft trong lần mở khi lỗi, và dùng lại idempotency key cho retry.

Có kiểm tra hạn con không vượt cha và phép ánh xạ user/department sang ID, dù UI chọn người vẫn còn vấn đề trùng tên.

TaskDetailSideSheet đã có thứ tự requirement/evidence/action, capability projection, full-screen mobile và hỗ trợ focus. Không mô tả các phần này như chưa tồn tại.

Lịch đã tách menu tạo việc và tạo sự kiện; giữ cơ chế ICT đã có cho meeting.

Có canonical query state, attention resolver, capability engine và ActionInboxService. Không thêm phiên bản thứ hai của chúng.

4. Danh mục phát hiện có địa chỉ source

Các số dòng là tại baseline, dùng làm điểm bắt đầu và phải tìm lại symbol sau mỗi thay đổi.

F01 — Dashboard dùng các tập dữ liệu khác nhau — P1

Bằng chứng: src/hooks/use-task-filters.ts:434–508.

scopedBaseTasks áp dụng scope/đơn vị; monthScopedBaseTasks áp dụng tháng lên tập đó. displayedStats dùng tập này. Nhưng monthFilteredSchoolTasks lọc tháng trực tiếp từ tasks; executiveStats, departmentHealth và executiveActionItems dùng nhánh này. Vai trò executive còn giữ nguyên khi scope chuyển về cá nhân/đơn vị.

Hệ quả: các khối cùng trang có thể nói về phạm vi khác nhau. dashboard-zone.tsx:84–88 tìm item hàng đợi trong baseTasks đã thu hẹp, nên item ngoài phạm vi có thể không mở được.

Sửa: một tập visible tasks được server cho phép, sau đó scope/đơn vị. Tách rõ tập báo cáo trong kỳ và tập hành động còn mở xuyên kỳ. Mỗi khối có nhãn, tổng và danh sách drill-down cùng hợp đồng. Không dùng role để thay cho dataset scope.

F02 — Quy tắc “chờ duyệt” chưa theo người có quyền duyệt — P1

Bằng chứng: src/lib/executive-matrix-aggregator.ts:359–419, 597–733.

extractExecutiveActionItems(tasks, referenceDate) không nhận actor. Điều kiện gồm progressPercent === 100, subtask requiresReview, NEEDS_REVIEW; các task đang làm cũng thành nhóm STRATEGIC. Sắp xếp cuối chỉ theo loại nhóm. ExecutiveActionCenter nhận hideCards = true, nên điều khiển lọc đang nằm trong phần bị ẩn; queue ALL trở thành tập lớn với CTA “Phê duyệt ngay”.

Sửa: nối presentation vào nguồn hành động/capability hiện có; trạng thái chờ duyệt không tự chứng minh đang chờ người đăng nhập. Cờ “cần nghiệm thu” không chứng minh đã nộp. Đặt nhóm hành động gọn độc lập với metric cards. Hàng thường mở yêu cầu, quyết định ở detail sau nội dung/minh chứng. Không coi mọi IN_PROGRESS là chiến lược hoặc cần can thiệp.

Owner cần tái sử dụng: src/domain/tasks/attention-resolver.ts có canUserReviewTask; src/server/services/action-inbox-service.ts có inbox theo actor; detail dùng capability matrix. Trước khi nối inbox server phải kiểm tra phân trang (take:20 ở từng query), loại tài nguyên và quy tắc quyền; không dùng độ dài trang lấy về làm tổng toàn bộ. Không chỉ chuyển một boolean capability cấp actor sang mọi task rồi coi là đủ.

F03 — Tổng quá hạn có thể đếm hai lần; rỗng có thể bị coi là ổn — P1

Bằng chứng: src/components/dashboard/dashboard-situation-strip.tsx:20–43, 72–80; src/lib/dashboard-aggregator.ts:26–132; src/lib/executive-matrix-aggregator.ts:359–419.

Strip cộng stats.overdueTasksCount + executiveStats.overdueTasksCount. Hai aggregator đều đếm nhiệm vụ quá hạn nên một task đang làm đã quá hạn có thể đóng góp vào cả hai số. deriveSituationState coi executiveStats != null là có dữ liệu, dù object toàn số 0. countUnitsNeedingAttention đánh dấu mọi đơn vị có tiến độ <60%.

Sửa: một nguồn đếm hoặc union theo entity ID, không cộng hai summary cùng ý nghĩa. Dùng metadata đã tải/tổng entity thật để tách lỗi/rỗng/không có hành động. Đơn vị cần chú ý phải có lý do cụ thể; bỏ ngưỡng 60% vô điều kiện.

F04 — Danh mục đơn vị phân mảnh và suy đoán chủ trì — P1

Bằng chứng: dashboard-zone.tsx:25,36–41 dùng QCET_DEPARTMENTS; scope-switcher.tsx:23,44–62 và resolveDepartment; executive-matrix-aggregator.ts:90–356,421–593 dựng QCET_DEPARTMENT_DEFINITIONS gồm 11 nhóm, tìm theo alias/tên nhân sự/category và fallback BGH.

Hệ quả: header có 16 đơn vị trực thuộc nhưng ma trận có 11 nhóm tĩnh; bộ đếm ma trận luôn theo danh sách cố định. Alias có chồng lấn, ví dụ mã trung tâm xuất hiện trong nhóm CNTT. Không thể lấy danh mục này thay cho quan hệ tổ chức trong DB.

Sửa: dùng ID quan hệ và danh mục được trả từ server đã có. src/lib/server/dashboard-service.ts đã có prisma.department.findMany ở vùng dòng 106, cần truy tiếp mapping DTO để dùng chung. Không tạo thêm hằng số danh mục mới. Thiếu quan hệ ghi “Chưa xác định đơn vị”; không tự gán BGH hay suy diễn từ tên. Xác định rõ có/không gồm BGH, đơn vị đang hoạt động, đơn vị có nhiệm vụ trong kỳ.

F05 — Ma trận chiếm chỗ, màu rủi ro sai và thao tác không nối — P1 UI

Bằng chứng: dashboard-zone.tsx:119–120 truyền toàn bộ departmentHealth, defaultViewMode="ranking"; department-progress-matrix.tsx:24–26,58–67,142–164,340–351.

Tiến độ dưới 50% tô đỏ, 50–79% tô hổ phách bất kể hạn/vướng.

onSelectDepartment mặc định no-op; navigateToTasks mặc định false; DashboardZone không truyền hai props này. Vì vậy click hàng/Lọc trên đường này không làm như người dùng mong đợi; link Nhiệm vụ riêng vẫn có thể chạy.

getDepartmentTasksUrl chỉ tạo scope=school&dept=..., mất kỳ và loại chỉ số.

Sửa: dashboard hiển thị tối đa 5 đơn vị cần chú ý với một bảng, danh sách đầy đủ mở sang /tasks hoặc trang đơn vị đã tồn tại. Bỏ huy chương/xếp hạng và toggle ba layout tại dashboard. Link/hàng đều thực hiện một tác vụ rõ, giữ bộ lọc; bỏ CTA no-op.

F06 — /tasks mặc định Kanban và bỏ qua view trên URL — P1

Bằng chứng: src/components/tasks/task-management-workspace.tsx:53–74; src/components/workspace/unified-adaptive-workspace.tsx:407–417, 509–538.

Facade mặc định initialViewMode="kanban" rồi luôn truyền xuống. Workspace chỉ nhận queryState.view nếu !initialViewMode. Chỉ đổi chuỗi mặc định sang table vẫn để lại lỗi bỏ qua URL.

Sửa: tách controlled view với initial fallback; khi không controlled, view hợp lệ trên URL thắng default, sau đó mới fallback bảng. Không phá Saved Views và các embed cố ý control. Kiểm tra tải thẳng, reload, Back/Forward, đổi layout và chọn Saved View.

F07 — Advanced form thu dữ liệu nhưng không đưa vào payload — P1

Bằng chứng: create-task-modal.tsx:97–104,1580–1700; src/lib/adapters/create-task-mapper.ts:171–219.

UI có category/VTVL/internalDueDate/requiredDeliverables/requiresReview; mapper chỉ gửi title/dueDate/scope/description/priority/departmentId/assigneeId/collaboratorIds/parentTaskId. Không được đánh đồng toàn bộ advanced đều mất: collaborators và parentTaskId đã được ánh xạ.

Sửa: lập field matrix UI → schema → command → DB → readback. Đợt này ẩn/loại trường chưa được lưu khỏi flow thường, bỏ validation yêu cầu nhập trường sau đó bị bỏ. Giữ trường thật sự được hỗ trợ; nếu trường nghiệp vụ bắt buộc thì hoàn thiện một luồng lưu/readback trước khi bật, không chỉ xóa lời cảnh báo.

F08 — Chọn người theo tên chưa đảm bảo đúng danh tính — P1

Bằng chứng: create-task-modal.tsx:242–302 dùng directory.find(p => normalizedName...); phần lựa chọn ở 650–742 cũng lấy theo tên. Mapper có name index.

Sửa: form giữ assigneeId, tên là nhãn; payload dùng ID được chọn. Danh sách cho thấy tên + đơn vị + email/chức danh khi trùng tên. Không sửa dữ liệu người dùng hoặc dùng heuristic chọn người đầu tiên. Giữ một DRI và loại DRI khỏi collaborator theo ID.

F09 — Draft reset khi mở lại; chọn nhanh ngày bị âm thầm đổi — P1/P2

Bằng chứng: create-task-modal.tsx:773–820 reset form, lỗi, idempotencyKey khi mở; ESC gọi onClose; :918–988 giữ draft/key trong cùng lần mở khi unknown; :991–1017 clamp ngày chọn nhanh về hạn cha bằng chuỗi ngày, có dùng toISOString().

Sửa: bảo vệ draft khi đóng/rời form; quy định rõ lúc hủy chủ động, lúc giữ nháp và lúc chưa biết server đã tạo hay chưa. Không tạo key mới cho retry cùng yêu cầu unknown. Preset không được mang nhãn “+1 tuần” nhưng chọn một ngày đã qua vì clamp; disable kèm lý do hoặc trình bày ngày thực sẽ chọn. Dùng helper ngày ICT hiện có. Không cấm hồi tố toàn hệ thống bằng quy tắc mới khi chưa có căn cứ nghiệp vụ.

F10 — Hồ sơ lưu cục bộ nhưng báo thành công — P1

Bằng chứng: user-profile-modal.tsx:57–80; src/lib/auth-context.tsx:612–658 không gọi API, chỉ state/localStorage/registered users. src/app/api/auth/me/route.ts:8–79 đang chỉ GET dữ liệu từ DB. Onboarding PATCH chỉ lưu onboardingData, không phải endpoint lưu name/title/phone.

Sửa: hoàn thiện self-profile command qua endpoint phù hợp sau inventory; đề xuất mở rộng handler /api/auth/me nếu chưa có command chính thức khác. Schema whitelist tên/điện thoại/chức danh theo chính sách; cấm role, departmentId, isActive và ID tài khoản tùy ý. Await server → nhận DTO → cập nhật client → báo thành công. Lỗi giữ form; reload/phiên đăng nhập mới đọc lại đúng. Vai trò và đơn vị xác nhận chỉ đọc.

F11 — Chi tiết đã có thứ tự mới nhưng vẫn lặp metadata và khối rỗng — P2

Bằng chứng: task-detail-side-sheet.tsx:950–1008 header status; :1117–1159 thêm status/deadline; :1164 metadata card; :1900–1940 khối rỗng việc con; :2050–2130 audit history và derived milestones.

Sửa: chỉ một status/deadline, metadata thành dòng thuộc tính gọn; ID kỹ thuật không chiếm tiêu đề; việc con rỗng là một dòng. Giữ thật sự khác nhau giữa audit server và mốc suy ra: thu gọn mốc suy ra hoặc đưa vào thuộc tính, không trộn thành lịch sử giả. Panel desktop giảm backdrop/blur để nhận biết danh sách; mobile giữ full-screen, nút quay lại và action cuối.

F12 — Hạn chót 7 ngày tới không được ràng buộc ở thành phần nhận — P2

Bằng chứng: dashboard-zone.tsx:123–124 đưa roleUpcoming.slice(0,5) vào widget; use-task-filters.ts:550–559 lọc upcoming theo role; upcoming-deadlines-widget.tsx:97–130 render trực tiếp và đặt tiêu đề “Hạn chót 7 ngày tới”, không tự lọc khoảng 0–7 ngày. Ảnh cho thấy item quá hạn trong khối này.

Sửa: kiểm tra nguồn tạo upcoming, sau đó đặt một selector dùng chung cho khoảng ngày; tách quá hạn khỏi sắp đến hạn. Truyền callback mở task đã có; giữ phạm vi và minh bạch tập kỳ. Không sửa bằng cách đổi tiêu đề nếu sản phẩm cần đúng danh sách sắp đến hạn.

F13 — Kiểm thử chưa chạm đúng UI được render — P1 cho gate

Bằng chứng: tests/dashboard-composition-invariants.test.ts:153–191 kiểm tra prohibited markers trên dashboardSource, không trên actionCenterSource dù component con có marker đó. Giới hạn 5 đơn vị được kiểm bằng helper getDepartmentDashboardSummary tự định nghĩa trong test, không được gọi ở DashboardZone. tests/profile-rbac-invariants.test.ts chỉ tìm các chuỗi nút role và nhãn chỉ đọc, không kiểm chứng lưu server.

Sửa: test cây production đã mount hoặc production selector thực sự được component sử dụng. Thêm journey kiểm chứng lưu/readback và query navigation. Không thay test để hợp thức hóa lỗi, nhưng bỏ assertion bám layout cũ khi quyết định UX đã đổi có ghi nhận.

F14 — Script chụp ảnh không phải kiểm chứng visual regression — P2

Bằng chứng: scripts/verify-ui-ux-visual-regressions.sh:25–78 trỏ localhost:3001, chụp ?zone=*, chỉ kiểm tra file ảnh tồn tại, không xác nhận phiên đăng nhập, trang cuối, dữ liệu hoặc tương tác. Cỡ “fold” 1440×1200 không đại diện laptop 900 px cao.

Sửa: sửa script hiện có hoặc bổ sung vào hạ tầng capture đã có; không dựng framework mới. Phải xác nhận route canonical, người dùng/fixture hợp lệ, readiness selector và screenshot trước/sau cùng viewport. File tồn tại không tương đương UI đúng. Không tạo cookie admin production để chụp ảnh.

5. Hình dạng UI đích

Giữ doctrine Linear đã chốt và bố cục ACTION → SITUATION → CONTEXT trong plan repo để không tạo thêm thứ tự cạnh tranh. Khác biệt với mockup trước: ma trận dashboard chỉ tối đa 5 đơn vị có lý do cần chú ý; danh sách đầy đủ ở màn hình phù hợp. Không dùng mẫu 4 đơn vị giả để thay dữ liệu sản phẩm.

Vùng

Quyết định cụ thể

Shell

Một sidebar trung tính; một topbar ổn định; dùng DESIGN.md/token hiện có, font Be Vietnam Pro; không đổi toàn bộ spacing chỉ vì screenshot được phóng lớn

Header dashboard

“Bàn làm việc”; bỏ badge lặp vai trò; một hàng Phạm vi + Kỳ vận hành; thêm CTA tạo việc nếu capability cho phép, làm mới là secondary

Hàng đợi

Tab/nhóm hành động gọn độc lập với metric cards; 3–5 hàng; loại yêu cầu và lý do cần bạn xử lý; không expand 300 hàng ngay trong dashboard

Situation

Một dòng tổng, mẫu số rõ; không cộng số cùng nghĩa; thiếu dữ liệu không hiện xanh

Đơn vị

Tối đa 5 dòng cần chú ý; tên, số quá hạn/vướng/chờ duyệt và tiến độ được định nghĩa; mỗi số mở đúng tập nhiệm vụ

Scope

Một bộ chọn; Toàn trường/Đơn vị/Của tôi khác nhau rõ; danh mục từ cùng server; bỏ quản trị phân quyền khỏi menu đổi tập dữ liệu

Kỳ

Nhãn “Kỳ vận hành T9 · 25/08–24/09”; popover ngắn, nhóm kỳ theo năm học, giữ 25–24 và query contract; bỏ số đếm nếu không phục vụ thao tác

/tasks

Bảng mặc định nhưng tôn trọng URL/Saved View; một search danh sách; Filter/Display gom cấu hình; không thêm toolbar thứ hai

Chi tiết

Tên → trạng thái/hạn → chủ trì → yêu cầu → minh chứng → quyết định → việc con → lịch sử; một surface và một nguồn capability

Giao việc

Nội dung → người chủ trì/đơn vị/hạn → thông tin bổ sung có lưu thật → submit; ngữ cảnh cha kế thừa, không ép người dùng hiểu phân loại nội bộ

Hồ sơ

Thông tin cá nhân chỉnh sửa tách khỏi quyền/đơn vị chỉ đọc; lưu có pending/error/server success

Mobile

Cùng dataset/selector và hành động với desktop, chỉ khác bố cục; giữ full-screen detail, focus, bàn phím và một owner cho safe-area

Nguyên tắc thị giác: chữ chính 14 px, chữ phụ tối thiểu 12 px theo rule; hàng 44–56 px tùy nội dung; touch target khoảng 44 px; icon stroke 1.5; một CTA chính mỗi flow; semantic tokens light-only. Không dùng màu đỏ chỉ từ tỷ lệ % thấp.

6. Kế hoạch thực thi theo gói công việc

Mỗi gói kết thúc bằng diff gọn, targeted checks có ý nghĩa và bằng chứng màn hình nếu thay UI. Các file ghi “đề xuất mới” chưa phải file tồn tại. Không mở rộng phạm vi chỉ để chia được thêm agent.

R0 — Khóa baseline và thống nhất tiêu chí

Phụ thuộc: không. Đầu ra: một ghi nhận baseline và danh mục test liên quan.

Đọc lại hướng dẫn repo, git status, HEAD; nếu source đã khác 65f99561, rà lại các symbol trong mục 4.

Chốt kế hoạch này là delta cho các flow đang mount; V3/V5.1 dùng làm context, không chạy lại mọi task cũ.

Sửa điểm mâu thuẫn tài liệu đúng phạm vi: status lifecycle khác attention; requiresReview là cấu hình; overdue không đồng nghĩa blocked; không coi 100% tiến độ là phê duyệt. Chưa đổi enum/quyền.

Chụp baseline /, /tasks, một task detail, form tạo, profile ở 1440×900 và 390×844 với cùng dữ liệu. Kiểm tra thêm 320 px cho tràn ngang.

Chạy các test liên quan một lần; ghi lỗi đã có. Chọn DB test được xác nhận vì scripts/run-tests.mjs bật DB tests và chỉ rewrite tên DB khớp mẫu qcet_eoffice.

Nghiệm thu: biết app đang chạy đúng commit/route và ai đăng nhập; không gọi ảnh login/empty là baseline dashboard.

R1 — Sửa tập dữ liệu, trạng thái chú ý và chỉ số

Phụ thuộc: R0. File chính: src/hooks/use-task-filters.ts, src/lib/dashboard-aggregator.ts, src/lib/executive-matrix-aggregator.ts, src/components/dashboard/dashboard-situation-strip.tsx.

Tách pipeline visible → scoped → reportingPeriod, và scoped → unresolvedActions. Giữ authorization ở server.

Truy vết các consumer cần parent/subtask; ghi rõ entity type và ID dedup. Không tạo tổng trộn tầng không có nhãn.

Thay inference progress/flag bằng lifecycle/attention canonical đã có; kiểm tra maker/checker và explicit server denial.

Một nguồn quá hạn; blocker là chiều riêng; sửa empty stats object không đủ chứng minh có dữ liệu.

Truyền referenceDate thống nhất thay sử dụng TODAY_ISO ở thời điểm import cho một số hàm và ngày runtime ở hàm khác.

Test tái hiện bắt buộc: một task đang làm quá hạn xuất hiện trong hai aggregator vẫn hiển thị 1; task chờ duyệt đồng thời quá hạn không bị mất chiều quá hạn; chưa nộp nhưng requiresReview không thành yêu cầu duyệt; actor không có quyền không có CTA; scope đơn vị không có item đơn vị khác; đổi tháng không che backlog; empty/loading/error phân biệt.

Test hiện có cần mở rộng: tests/dashboard-scope-invariants.test.ts, tests/dashboard-aggregator-consistency.test.ts, tests/executive-action-items-extractor.test.ts, tests/action-queue-authority.test.ts. Chỉ thêm file khi các suite này không phù hợp.

R2 — Chuẩn hóa đơn vị cho đúng luồng dashboard

Phụ thuộc: hợp đồng R1. File chính: executive-matrix-aggregator.ts, src/lib/server/dashboard-service.ts, src/types/dashboard.ts, scope-switcher.tsx, dashboard-zone.tsx.

Theo mapping server đang có để cung cấp cùng danh mục đơn vị cho header/scope/matrix.

Dùng quan hệ ID làm key; chuyển alias vào lớp tương thích duy nhất nếu dữ liệu lịch sử bắt buộc. Loại fallback theo tên người/category/BGH khỏi aggregate đang chạy.

Dùng tổng đơn vị hợp lệ, tổng đơn vị có task và tổng đơn vị cần chú ý với tên riêng. Không hard-code 11 hoặc 16.

Không sửa hàng loạt database trong đợt UX. Nếu tìm thấy bản ghi thiếu quan hệ, báo số lượng và cần quy trình dữ liệu riêng.

Nghiệm thu: thêm một đơn vị hợp lệ trong fixture server thì tất cả surface nhìn thấy nhất quán; tên hiển thị thay đổi không đổi attribution; task thiếu đơn vị không cộng sang BGH. Unit không có nhiệm vụ không bị đánh dấu nguy hiểm chỉ vì 0%.

Tests: tests/department-resolution-consistency.test.ts, tests/executive-matrix-aggregator.test.ts, tests/dashboard-zone-dynamic-units.test.ts.

R3 — Làm lại dashboard trên composition hiện hữu

Phụ thuộc: R1/R2. File chính: dashboard-zone.tsx, executive-action-center.tsx, department-progress-matrix.tsx, dashboard-situation-strip.tsx, upcoming-deadlines-widget.tsx, workbench-mobile-feed.tsx.

Xóa badge/đoạn mô tả lặp ở đầu. Giữ một header ngữ cảnh, CTA theo capability.

Đổi shell hàng đợi thành section phẳng; đưa nhóm lọc ra khỏi nhánh !hideCards. Xóa tiêu đề phụ bị lặp hai lần. Giới hạn 3–5 mục; “Xem tất cả” chuyển sang tập đã lọc.

Ma trận summary compact, tối đa 5 hàng sau lọc/sort theo vấn đề; đặt view mặc định và giới hạn tại component production hoặc selector được thực sự gọi. Không chỉ thêm helper vào test.

Dòng và số dẫn đúng /tasks với scope, đơn vị, period, attention; loại button không có effect; tránh lồng link trong vùng click hàng gây xung đột.

Giữ một situation strip, hoạt động gần đây thu gọn. Upcoming chỉ chứa ngày trong khoảng cần công bố; quá hạn ở nhóm riêng.

Mobile nhận cùng mô hình dữ liệu đã xử lý; không viết rule urgency thứ hai trong mobile feed.

Nghiệm thu hình ảnh: màn hình đầu 1440×900 có item hành động đầu và phần tình hình/đơn vị; không cần cuộn qua 5 thẻ lớn; không có hàng loạt progress đỏ; nhãn scope/kỳ đọc được; 390 px dùng được bằng chạm. Tên dài không che hạn/nút.

Tests: tests/dashboard-composition-invariants.test.ts, tests/department-progress-matrix-view-mode.test.ts, tests/executive-department-drilldown.test.ts. Test render phải kiểm tra text/component con thật.

R4 — Gọn scope và kỳ, giữ hợp đồng URL

Phụ thuộc: R2; UI skeleton có thể chuẩn bị sau R0. File: src/components/layout/scope-switcher.tsx, global-month-selector.tsx, src/hooks/use-workspace-query.ts và consumer thực sự liên quan.

Một trigger ngắn, một nhóm scope chính, danh sách đơn vị có tìm không dấu như hiện có. Chuyển quản trị ủy quyền về vị trí quản trị hiện hữu; giữ entry point có quyền nếu cần.

Sửa nhãn “tháng” thành “kỳ vận hành” tại phần dùng 25–24; không thay tháng lịch dương ở calendar.

Popover dùng danh sách gọn; không nhân bản 12 card đếm số. Giữ current/selected khác nhau và năm học chính xác.

Đổi một context không xóa search/filter/view vô cớ; Back/Forward phục hồi; loading không hiện dữ liệu scope cũ dưới nhãn scope mới.

Tests: tests/scope-switcher-combobox.test.ts, tests/scope-switcher-mobile.test.ts, tests/academic-period-selector-unification.test.ts, tests/workspace-query.test.ts.

R5 — Sửa view mặc định và khôi phục trạng thái /tasks

Phụ thuộc: R0, query contract ổn định. File: src/components/tasks/task-management-workspace.tsx, src/components/workspace/unified-adaptive-workspace.tsx, src/components/dashboard/unified-task-toolbar.tsx.

Bỏ ép Kanban từ facade. Xác lập controlled prop → URL hợp lệ → initial fallback → bảng, hoặc quy tắc tương đương được test rõ.

Không để initial prop được hiểu như controlled prop suốt vòng đời.

Một toolbar: scope/search/filter/display/create; period trong ngữ cảnh phù hợp; density/layout/grouping vào Display; giữ Saved Views hiện có.

Rà nhánh sync chỉ set khi query có giá trị: xóa q/dept/status bằng Back/Forward cũng phải xóa filter nội bộ, không chỉ xử lý lúc query được thêm.

Click task → đóng → quay lại giữ tập dữ liệu, vị trí cuộn và selection theo hợp đồng; không ép mọi thay đổi sang replace nếu người dùng cần lịch sử navigation.

Nghiệm thu: /tasks default table; /tasks?view=table và ?view=kanban đúng sau reload; Saved View có layout riêng đúng; xóa query bằng Back không để lọc ma; chip và hàng khớp.

Tests: tests/workspace-query.test.ts; bổ sung test integration entry-point/forwarding cho lỗi precedence nếu suite hiện có chưa chạm đường mount. Không chỉ test engine độc lập không có facade.

R6 — Sửa giao việc theo field contract thật

Phụ thuộc: R0; không cần chờ ma trận UI. File: create-task-modal.tsx, src/lib/adapters/create-task-mapper.ts, src/contracts/tasks.ts, tests create.

Lập field matrix và bỏ trường không lưu khỏi form thường; giữ collaborators/parent linkage đã được hỗ trợ.

Chuyển selected assignee sang ID ngay tại control; tra tên/đơn vị chỉ để hiển thị; test hai người trùng tên.

Title có label thực; form cơ bản ngắn; parent context dùng tên và hạn gọn; không lộ ID dài hay lời giải thích “hợp đồng tạo nhiệm vụ”.

Preset ngày hiển thị đúng ngày thật sẽ chọn, không silent clamp; dùng helper ICT. Cha quá hạn có hướng xử lý hợp lệ, không tự gia hạn.

Tách state draft khỏi mounted modal nếu cần giữ qua đóng/mở; key unknown đi cùng draft. Discard chủ động phải rõ hậu quả với request chưa xác định.

Giữ nguyên cơ chế performCreateTaskSubmission và adapter một đường; lỗi không xóa form; request chưa xác định không báo thất bại chắc chắn.

Nghiệm thu: tạo → reload vẫn có toàn bộ trường UI nhận; chọn đúng người trùng tên; retry không tạo bản ghi thứ hai; đóng rồi mở không mất draft ngoài hành vi discard đã công bố; label preset khớp ngày chọn.

Tests: tests/create-task-modal-validation.test.ts, tests/create-task-modal.test.ts; thêm integration create/readback vào suite adapters/API hiện có được tìm bằng rg trước khi sửa. Không tắt idempotency test để làm form đơn giản hơn.

R7 — Hoàn thiện lưu hồ sơ rồi mới tinh gọn modal

Phụ thuộc: R0, whitelist schema. File: user-profile-modal.tsx, src/lib/auth-context.tsx, src/contracts/users.ts, src/app/api/auth/me/route.ts nếu chọn mở rộng route hiện hữu; service theo cấu trúc repo sau inventory.

Xác minh không có self-profile command khác; tái sử dụng nếu có. Không dùng onboarding PATCH như chỗ lưu mọi thuộc tính user.

Lưu tên/điện thoại/chức danh được phép; session identity quyết định tài khoản; cấm trường quyền/đơn vị đã xác nhận bằng schema strict và policy server.

updateProfile có kết quả async; chỉ sync state/cache từ DTO server sau success. Await, loading, field error, dirty state.

Modal đổi thành hồ sơ cá nhân gọn; role/đơn vị read-only thành dòng. Dùng primitive dialog/focus sẵn có khi thích hợp, không dựng modal framework mới.

Nghiệm thu: request bị từ chối không hiện success; reload/tab khác/đăng nhập mới đọc đúng DB; không tự đổi role/đơn vị qua body PATCH; đóng modal trả focus.

Tests: giữ tests/profile-rbac-invariants.test.ts; bổ sung API integration self-profile persistence (file mới nếu chưa có). Test chỉ tìm text “chỉ đọc” không đủ.

R8 — Tinh gọn chi tiết và thống nhất hành động

Phụ thuộc: hợp đồng R1, submit/create R6. File: task-detail-side-sheet.tsx, dashboard-modals-host.tsx, capability/command adapters chỉ khi có defect chứng minh.

Giữ một status/deadline; topbar dành cho back/close và thông tin nhận diện ngắn.

Thu metadata grid, bỏ empty card không có thông tin. Giữ requirement/evidence/action đã có thay vì tái viết.

Audit thật giữ nguồn; derived facts thu vào chi tiết phụ, không đóng vai lịch sử.

Mọi entry point dùng cùng capability và server command. Rà callback handleExecutiveClose/onStatusChange để chắc chắn thông báo thành công đi sau kết quả server, không suy từ việc callback đã được gọi.

Khi mở create child, điều phối một flow có back/draft; tránh hai modal cùng giữ scroll lock/focus. Giữ deep link và mobile full-screen.

Tests: tests/tasks/task-detail-action-capability.test.ts, tests/task-detail-side-sheet.test.ts, tests/task-detail-sheet.test.ts; screenshot task không có con, chờ duyệt có minh chứng, denied và title dài.

R9 — Lịch, shell và mobile kiểm tra liên thông

Phụ thuộc: R4/R6/R8. File: src/app/calendar/page.tsx, src/components/calendar/calendar-day-sheet.tsx, src/components/layout/app-shell.tsx, topbar/sidebar nơi cần chỉnh.

Đây là gói kiểm chứng liên thông, mức rà soát hiện tại thấp hơn dashboard; không gán sẵn mọi lỗi của ảnh cũ cho source lịch mới.

Giữ menu Tạo công việc/Tạo sự kiện đã có và prefill ngày được chọn; kiểm tra save meeting đúng API và timezone.

Kiểm tra nhãn tháng dương/kỳ vận hành và phạm vi giữa lịch → task detail → create → back.

Giảm chrome dùng chung khi có ảnh trước/sau cho thấy lợi ích. Không đồng loạt đổi sidebar width mà không xử lý main offset (hiện 248 px trong AppShell).

Kiểm tra 640/768 px: dashboard dùng sm, shell/nav dùng md; không mất control trong khoảng breakpoint.

Một nguồn padding safe-area; CTA không bị bàn phím/bottom nav che; không thêm PWA popup mới.

Tests: tests/calendar-route-integration.test.ts, tests/calendar-task-interaction.test.ts, tests/calendar-presentation.test.ts, tests/app-layout.test.ts và nav suite liên quan sau inventory.

R10 — Gate cuối có khả năng phát hiện lỗi người dùng thấy

Phụ thuộc: từng gói khi hoàn thành, chốt sau R9.

Sửa test composition kiểm tra component con đang render; row limit dùng production code. Xóa helper chỉ tồn tại để chứng minh một điều UI không thực thi.

Chụp đúng route, session, dataset, cùng viewport trước/sau. Mở cả overlay/empty/error, không chỉ chụp trang gốc.

Lưu kết quả thực tế cùng commit; một bảng requirements → bằng chứng. Không gọi “verified” chỉ vì PNG tồn tại.

Chạy verify/build toàn hệ thống một lần ở integration ổn định; chạy lại rộng chỉ khi lỗi còn lại đòi hỏi. Không chạy toàn bộ suite sau mỗi thay đổi bo góc.

7. Thứ tự ghép và phạm vi công việc

R0 baseline và hợp đồng.

R1/R2 dữ liệu và tổ chức; R5 query/view; R7 profile có thể làm thành commit độc lập khi không sửa chung owner.

R3/R4 dashboard và điều khiển; đây là mốc phải cho người dùng thấy ảnh khác biệt rõ.

R6/R8 create/detail, bảo vệ các cải tiến submit đã có.

R9 liên thông; R10 nghiệm thu tổng.

Nếu Claude Code dùng các reviewer/worker theo hướng dẫn riêng của repo, phân ownership rõ: data không cùng lúc sửa layout dashboard-zone; create và detail tách file nhưng thống nhất callback qua dashboard-modals-host; query owner giữ use-workspace-query/workspace. Không có yêu cầu phải dùng multi-agent để đạt kết quả; không tái tạo executor đã nghỉ.

Điểm dừng scope: không refactor backend toàn bộ, đổi mô hình tổ chức, đổi enum, tách microservice, viết lại task engine, làm lại calendar hoặc bổ sung tính năng nâng cao chưa được yêu cầu chỉ để hoàn thành UI.

8. Lệnh và bằng chứng nghiệm thu

Lệnh hiện có đã xác minh từ package.json và scripts; chạy trên máy có repository. Đây là hướng dẫn, chưa phải lệnh đã chạy trong lượt rà soát.

git status --short
git rev-parse HEAD
npx tsx --test tests/dashboard-composition-invariants.test.ts tests/dashboard-scope-invariants.test.ts tests/executive-action-items-extractor.test.ts
npx tsx --test tests/create-task-modal-validation.test.ts tests/create-task-modal.test.ts tests/tasks/task-detail-action-capability.test.ts
npx tsx --test tests/workspace-query.test.ts tests/academic-period-selector-unification.test.ts
npm run typecheck
npm run lint
npm test
npm run build

Không in env/secrets. Trước npm test, kiểm chứng DB đích là môi trường test riêng: runner chỉ thay tên DB theo regex cụ thể, không bảo đảm mọi DATABASE_URL tùy chỉnh đều an toàn. Dùng thông tin kết nối đã thiết lập cho test theo quy trình repo, không bịa URL.

Tình huống

Kết quả bắt buộc

Bằng chứng

Chọn 2 scope liên tiếp

Hàng đợi/bảng/summary đúng scope, không có item bấm không mở

Integration và screenshot

Cùng task quá hạn ở hai aggregate

Tổng quá hạn chỉ một entity tương ứng

Fixture deterministic

Chờ duyệt + quá hạn

Hai chiều đúng; không cộng đôi tổng distinct

Selector/API test

Chuyển kỳ

Report đổi; backlog vẫn có nhãn xuyên kỳ

Journey

Thêm đơn vị server

Header/menu/matrix cùng danh mục và quy tắc count

Contract test

/tasks?view=table

Đúng bảng sau load/reload/Back

Browser journey

Click số quá hạn của đơn vị

Đúng đơn vị + attention + kỳ; số khớp danh sách

Query integration

Hai người trùng tên

ID payload là người được chọn

Form/adapter test

Tạo việc mất phản hồi

Draft giữ, retry key giữ, một bản ghi

Mutation integration

Preset vượt hạn cha

Không âm thầm chọn ngày khác nhãn

Form interaction

Lưu hồ sơ lỗi

Không có success; form giữ dữ liệu

API/UI test

Lưu hồ sơ thành công

Reload từ DB đúng, quyền không đổi

Readback test

Dashboard >5 đơn vị

Chỉ tối đa 5 dòng summary, link tới phần đầy đủ

Render production tree

Empty/denied/loading

Không gắn “healthy” hoặc “Verified Clear” từ thiếu dữ liệu

Render state matrix

Mobile 390/320 px

Không tràn toàn trang; thao tác chính không bị che

Screenshot + keyboard/touch

Mục tiêu trải nghiệm đề xuất, chưa đo: người mới nhận ra việc cần mình quyết định trong khoảng 10 giây; nhận ra đơn vị đang vướng trong khoảng 10 giây; từ chỉ số đi tới danh sách nguyên nhân trong một thao tác. Đo lại với cùng dữ liệu thay vì tuyên bố đạt bằng nhận xét chủ quan.

9. Giao cho agent triển khai

Đọc kế hoạch này cùng hướng dẫn repository và kiểm tra lại HEAD. Thực hiện R0 rồi triển khai các gói theo phụ thuộc. Với mỗi finding, xác nhận nó còn tồn tại bằng code/interaction hiện tại; phần đã sửa thì ghi evidence và bỏ qua, không làm lại. Dùng canonical owners đã nêu, giữ thay đổi ngoài phạm vi, không khôi phục QCET executor. Kiểm thử nhắm vào hành vi hỏng trước; sau đó sửa; cuối cùng kiểm tra ảnh thật trên route đang mount. Báo cáo gồm file đã đổi, hành vi trước/sau, lệnh đã chạy và kết quả, ảnh trước/sau, hạn chế chưa xác minh. Không kết luận hoàn tất chỉ dựa vào test chuỗi, số file sửa hoặc ảnh chưa đăng nhập.

10. Tài liệu tham khảo thiết kế

Linear — A calmer interface for a product in motion: hierarchy, điều hướng nhẹ và cấu trúc ít nhiễu.

Linear — How we redesigned the Linear UI: bố cục, mật độ, consistency và kiểm tra nhiều loại view.

Linear — Create issues: hành vi draft khi tạo việc bị gián đoạn.

Các nguyên tắc này đã được kiểm tra ở lượt thiết kế trước. Phát hiện kỹ thuật trong tài liệu hiện tại dựa trên source c2c, không phải suy ra từ Linear hoặc từ bản mockup.
9. Giao cho agent triển khai

Đọc kế hoạch này cùng hướng dẫn repository và kiểm tra lại HEAD. Thực hiện R0 rồi triển khai các gói theo phụ thuộc. Với mỗi finding, xác nhận nó còn tồn tại bằng code/interaction hiện tại; phần đã sửa thì ghi evidence và bỏ qua, không làm lại. Dùng canonical owners đã nêu, giữ thay đổi ngoài phạm vi, không khôi phục QCET executor. Kiểm thử nhắm vào hành vi hỏng trước; sau đó sửa; cuối cùng kiểm tra ảnh thật trên route đang mount. Báo cáo gồm file đã đổi, hành vi trước/sau, lệnh đã chạy và kết quả, ảnh trước/sau, hạn chế chưa xác minh. Không kết luận hoàn tất chỉ dựa vào test chuỗi, số file sửa hoặc ảnh chưa đăng nhập.

10. Tài liệu tham khảo thiết kế

Linear — A calmer interface for a product in motion: hierarchy, điều hướng nhẹ và cấu trúc ít nhiễu.

Linear — How we redesigned the Linear UI: bố cục, mật độ, consistency và kiểm tra nhiều loại view.

Linear — Create issues: hành vi draft khi tạo việc bị gián đoạn.

Các nguyên tắc này đã được kiểm tra ở lượt thiết kế trước. Phát hiện kỹ thuật trong tài liệu hiện tại dựa trên source c2c, không phải suy ra từ Linear hoặc từ bản mockup.