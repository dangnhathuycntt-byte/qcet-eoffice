QCET Work — UI/UX Post-Implementation Review

Đánh giá thành phẩm sau qcet-source-uiux-remediation-plan-65f99561.md

Ngày đánh giá: 13/09/2026
Màn hình: / — Bàn làm việc
Nguồn đối chiếu: ảnh thành phẩm hiện tại + qcet-source-uiux-remediation-plan-65f99561.md

1. Kết luận

Thành phẩm đã cải thiện rõ rệt so với phiên bản cũ:

Sidebar nhẹ hơn, ít nhiễu hơn.

Dashboard bớt card lớn và bớt màu cảnh báo giả.

Hàng đợi điều hành đã compact hơn.

Khu vực đơn vị cần chú ý có empty state sạch.

Deadline và recent activity đã được gom thành danh sách thay vì dashboard card nặng.

Tuy nhiên, nếu coi đây là bản đã hoàn tất theo remediation plan thì chưa đạt.

Đánh giá riêng phần UI nhìn thấy trong screenshot: khoảng 7/10 so với đích của plan.

Vấn đề chính không còn nằm ở bo góc, màu sắc hay typography. Vấn đề còn lại là:

Information hierarchy vẫn mang mental model “dashboard gồm các widget/card xếp dọc”, thay vì một action-first workspace theo hướng Linear.

Ưu tiên tiếp theo không phải thêm Framer Motion. Cần tiếp tục:

Đưa Action lên vị trí quan trọng nhất.

Flatten composition.

Giảm metadata và badge noise.

Sửa header/scope/kỳ.

Làm deadline/activity giống một work surface liên tục hơn là các widget độc lập.

2. Đối chiếu với UI target trong remediation plan

Plan đã chốt thứ tự:

ACTION → SITUATION → CONTEXT

Cấu trúc đang render hiện tại gần như:

Header
Scope / Tháng
Progress strip
Hàng đợi điều hành
Đơn vị cần chú ý
Deadline
Hoạt động gần đây

Cấu trúc nên chuyển thành:

Header + Primary Action
Scope / Kỳ vận hành

Cần bạn xử lý
Tình hình trong kỳ
Đơn vị cần chú ý
Sắp đến hạn
Hoạt động gần đây

3. Đánh giá từng khu vực

Khu vực

Trạng thái

Đánh giá

Sidebar

Tốt

Đã nhẹ và sạch hơn

Topbar

Khá

Search ổn nhưng tổng thể còn nhiều khoảng chết

Header dashboard

Chưa đạt

Không có primary action

Scope

Khá

Gọn nhưng interaction hierarchy chưa mạnh

Kỳ vận hành

Chưa đạt

Vẫn dùng nhãn “Tháng”

Situation strip

Khá

Gọn nhưng đang xuất hiện trước action

Action queue

Khá tốt

Đúng hướng nhưng copy/hierarchy còn kiểu báo cáo

Đơn vị cần chú ý

Tốt

Empty state sạch

Upcoming deadlines

Khá

Metadata trùng và row còn cao

Recent activity

Trung bình

Có nhiều thông tin không giúp ra quyết định

Overall composition

Chưa đạt

Vẫn còn “card stack dashboard”

4. P0 — Đưa Action trở thành trọng tâm

Vấn đề

Ngay sau scope/kỳ hiện tại là:

37% tiến độ · 117 nhiệm vụ

Sau đó mới đến:

Hàng đợi điều hành

Điều này khiến dashboard ưu tiên metric trước hành động.

Người dùng mở Bàn làm việc trước hết phải trả lời được:

“Có gì cần tôi xử lý ngay?”

Target

Sau header và context controls:

Cần bạn xử lý
────────────────────────────────────────
[Item cần duyệt / xử lý]

Sau đó mới:

Tình hình
37% hoàn thành · 117 nhiệm vụ · ...

Acceptance

Action queue xuất hiện trước situation strip.

Item đầu tiên nhìn thấy được trong màn hình laptop 1440×900.

Không phải cuộn mới thấy action quan trọng.

Nếu không có action:

hiển thị empty state ngắn;

không dựng một card lớn rỗng.

5. P0 — Sửa “Tháng” thành “Kỳ vận hành”

Hiện tại

Tháng 9 (25/08 - 24/09)

Đây không phải tháng lịch thông thường.

Target

Kỳ vận hành T9 · 25/08–24/09

Có thể rút gọn trigger:

Kỳ T9 · 25/08–24/09

Popover mới hiển thị:

Năm học 2026–2027
Kỳ T9
25/08/2026 – 24/09/2026

Không được làm

Không đổi tháng lịch trong /calendar.

Không gọi cùng một khái niệm lúc là “tháng”, lúc là “kỳ”.

Không nhân bản selector mới.

6. P0 — Header phải có primary action

Hiện tại

Header:

Bàn làm việc

Primary action rõ nhất trong vùng trên cùng lại là:

Làm mới dữ liệu

Refresh không phải business action chính.

Target

Bàn làm việc                              + Tạo nhiệm vụ

Nếu actor có capability tạo nhiệm vụ.

Secondary controls:

[Toàn trường ▼] [Kỳ T9 ▼]             [↻]

Quy tắc

+ Tạo nhiệm vụ chỉ hiện nếu capability cho phép.

Refresh chuyển thành icon button hoặc overflow.

Không làm refresh nổi hơn create/action.

Không thêm CTA thứ hai cạnh Create nếu không thật sự cần.

7. P0 — Đổi “Hàng đợi điều hành” thành action-oriented section

Hiện tại

Hàng đợi điều hành
Tất cả 1
Hồ sơ chờ xem xét 1
Vướng mắc & Trễ hạn 0

Tên này mang ngôn ngữ hệ thống hơn ngôn ngữ người dùng.

Đề xuất

Cần bạn xử lý

Tabs có thể giữ nhưng giảm emphasis:

Tất cả 1   Chờ xem xét 1   Vướng mắc 0

Một item nên ưu tiên:

[Chờ xem xét]

Kiểm tra công tác chuẩn bị cơ sở vật chất...
Phòng Đào tạo · Hạn 19/09

                                      Xem xét →

Metadata

Hiện tại item đang chứa quá nhiều thông tin tuyến tính:

Phòng Đào tạo (Cũ) · Chủ trì ... · Hạn ... · Hồ sơ chờ xem xét

Nên chuyển thành:

reason → object → context → action

Không phải:

object → metadata dump → reason

8. P1 — Flatten dashboard composition

Vấn đề

Dashboard vẫn cho cảm giác:

[card]
[card]
[card]
[card]

Dù các card đã nhẹ hơn.

Target

Chỉ dùng surface/border khi thực sự có:

selection;

interaction boundary;

scroll container;

group cần semantic separation mạnh.

Các khu vực đơn giản nên trở thành section phẳng.

Đề xuất

Có thể flat

Cần bạn xử lý

Tình hình

Đơn vị cần chú ý

Một surface lớn

Có thể gom:

Sắp đến hạn
────────────────────────────
rows

Hoạt động gần đây
────────────────────────────
rows

thành một work surface chung.

Mục tiêu

Giảm khoảng 40–50% card chrome còn lại.

Không được giảm bằng cách:

xóa divider cần thiết;

nén chữ quá mức;

biến mọi thứ thành table vô cảm.

9. P1 — Situation strip nên nhỏ và đứng sau Action

Hiện tại

37% tiến độ · 117 nhiệm vụ

Target

Tình hình trong kỳ

37% hoàn thành
117 nhiệm vụ
0 quá hạn
0 vướng mắc

Có thể cùng một dòng trên desktop:

37% hoàn thành · 117 nhiệm vụ · 0 quá hạn · 0 vướng mắc

Quy tắc

Không tạo 4 metric cards.

Không có màu đỏ nếu chỉ vì % thấp.

Metric click được nếu có drill-down thật.

Không dùng metric nếu sample/data semantics chưa đáng tin.

10. P1 — Deadline list cần giảm metadata trùng

Hiện tại

Một row có:

[Trường] [Ngày mai]
Task name
CC Chưa phân công
                           14/09/2026

Ngày mai và 14/09/2026 đang diễn đạt cùng một trục thời gian.

Target

Kiểm tra toàn vẹn quan hệ TaskActor
Toàn trường · Chưa phân công                         Ngày mai

Ngày chính xác có thể:

tooltip;

detail;

secondary display khi > 2–3 ngày.

Row density

Target desktop:

44–56 px / row

Không nên để một row quá cao nếu chỉ có 2 dòng thông tin.

11. P1 — Loại bỏ noise kiểu “Top 5 / 20”

Hiện tại

Top 5 / 20
Xem tất cả
20

Đây là thông tin implementation hơn là UX.

Target

Sắp đến hạn                                 20 nhiệm vụ
                                            Xem tất cả →

Hoặc:

Sắp đến hạn
5 nhiệm vụ gần nhất                         Xem tất cả 20 →

Chỉ dùng biến thể thứ hai nếu việc nói “5 gần nhất” thực sự giúp hiểu dữ liệu.

Recent activity

Bỏ:

Top 3 / 4
KHÁC

nếu classification đó không giúp người dùng:

ưu tiên;

lọc;

điều tra;

hành động.

12. P1 — Scope selector cần rõ semantic hơn

Hiện tại selector gọn nhưng vẫn giống dropdown filter thông thường.

Scope là context cấp cao của toàn workspace.

Target desktop

Ưu tiên:

[ Toàn trường ▼ ]   [ Kỳ T9 ▼ ]

Nếu product muốn mental model mạnh hơn, có thể dùng segmented context:

Toàn trường | Đơn vị | Của tôi

sau đó dropdown đơn vị chỉ xuất hiện khi cần.

Tuy nhiên không được tạo selector thứ hai nếu canonical scope owner hiện tại đã giải quyết được.

Acceptance

Đổi scope phải làm:

action queue đổi;

situation đổi;

unit/context đổi;

drill-down giữ scope;

loading không show data scope cũ dưới label scope mới.

13. P1 — Recent Activity phải là secondary

Recent Activity không nên cạnh tranh visual weight với action/deadline.

Đề xuất

Đặt cuối page.

Có thể:

Hoạt động gần đây                           Xem tất cả

với 3 item.

Không cần card riêng quá nặng.

Nếu analytics chứng minh ít được dùng có thể collapse mặc định trên desktop nhỏ/mobile.

14. Layout đích đề xuất

┌─────────────────────────────────────────────────────────────────────┐
│ Bàn làm việc                                      + Tạo nhiệm vụ   │
│                                                                     │
│ [ Toàn trường ▼ ] [ Kỳ T9 · 25/08–24/09 ▼ ]              [↻]     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ Cần bạn xử lý                                      Xem tất cả →   │
│ ─────────────────────────────────────────────────────────────────   │
│ CHỜ XEM XÉT                                                         │
│ Kiểm tra công tác chuẩn bị cơ sở vật chất...                        │
│ Phòng Đào tạo · Hạn 19/09                           Xem xét →      │
│                                                                     │
│ Tình hình trong kỳ                                                   │
│ 37% hoàn thành · 117 nhiệm vụ · 0 quá hạn · 0 vướng mắc            │
│                                                                     │
│ Đơn vị cần chú ý                                                     │
│ Không có đơn vị có việc quá hạn hoặc bị chặn.                       │
│                                                                     │
│ Sắp đến hạn                                      20 nhiệm vụ        │
│ ─────────────────────────────────────────────────────────────────   │
│ Kiểm tra toàn vẹn quan hệ TaskActor   Toàn trường      Ngày mai     │
│ Updated Title V2                    Toàn trường      Ngày mai        │
│ First Valid Update                  Toàn trường      Ngày mai        │
│ Helper Updated Title                Toàn trường      Ngày mai        │
│ Updated via Options                 Toàn trường      Ngày mai        │
│                                                   Xem tất cả →       │
│                                                                     │
│ Hoạt động gần đây                                  Xem tất cả →     │
│ ─────────────────────────────────────────────────────────────────   │
│ ...                                                                 │
└─────────────────────────────────────────────────────────────────────┘

15. Những thứ KHÔNG nên làm ở vòng tiếp theo

Không nên:

thêm animation chỉ để tạo cảm giác đã redesign;

đổi toàn bộ màu;

thêm gradient;

thêm glassmorphism;

thêm metric cards;

tạo dashboard V2;

tạo scope engine mới;

tạo attention engine mới;

thêm một toolbar khác;

tăng radius/shadow để “premium” hơn;

rewrite toàn bộ page.

Framer Motion / animated Lucide chỉ nên dùng sau khi hierarchy ổn định.

16. Motion nếu sử dụng

Chỉ dùng motion ở interaction có giá trị:

open/close detail sheet;

dropdown/popover;

expanding inline section;

list item insert/remove;

tab underline;

subtle hover/pressed feedback.

Không dùng:

animate toàn dashboard khi load;

fade từng card tuần tự;

spring mạnh trên business UI;

icon looping;

decorative motion.

Thời lượng gợi ý:

micro feedback: 100–160ms
popover/sheet: 160–220ms
layout transition: 180–240ms

Luôn hỗ trợ:

prefers-reduced-motion

17. Acceptance Criteria — UI round tiếp theo

Desktop 1440×900

Phải nhìn thấy mà không cuộn:

Bàn làm việc;

scope;

kỳ;

primary CTA;

ít nhất item đầu của Cần bạn xử lý;

situation;

bắt đầu phần context tiếp theo.

Laptop-height

Không để whitespace/header/card chrome đẩy action xuống dưới fold.

Mobile 390×844

Không tràn ngang.

Primary action không che content.

Scope/kỳ thao tác bằng touch dễ.

Không giữ layout desktop bằng scale nhỏ.

Deadline row đọc được.

Không duplicate bottom safe-area.

Empty state

Nếu:

0 action
0 unit attention

không được tạo hai card trắng lớn liên tiếp.

Long title

Task title 2 dòng không được:

đẩy CTA lệch;

che deadline;

làm row vỡ.

18. Acceptance Criteria — Không thể nghiệm thu chỉ bằng screenshot

Ảnh hiện tại chỉ xác nhận presentation.

Vẫn phải verify các mục logic trong remediation plan:

scope dataset đồng nhất;

pending review theo actor/capability;

không double-count overdue;

department attribution dùng server relationship;

unit fallback không tự gán BGH;

/tasks?view= phục hồi đúng;

Back/Forward không tạo ghost filters;

profile save persist server;

create/readback field contract;

duplicate-name assignee chọn theo ID;

visual test chạy đúng route/session/data.

Không được đóng remediation plan chỉ vì UI trông sạch hơn.

19. Thứ tự thực thi đề xuất

Round A — Visual hierarchy

Header + Create CTA.

Đổi Tháng → Kỳ.

Action trước Situation.

Đổi Hàng đợi điều hành → Cần bạn xử lý.

Flatten Action/Situation/Unit sections.

Round B — Density

Compact deadline rows.

Bỏ Top x/y.

Bỏ badge KHÁC không hữu ích.

Thu gọn recent activity.

Giảm card chrome.

Round C — Interaction

Verify drill-down query.

Verify scope change.

Verify period persistence.

Verify row click/detail/back.

Verify mobile.

Round D — Polish

Motion nhẹ nếu cần.

Animated icon chỉ ở interactive state.

Fine tune typography/spacing sau cùng.

20. Prompt giao cho Claude Code

Thực thi vòng UI/UX refinement tiếp theo trên source QCET Work hiện tại.

Đọc AGENTS.md, CLAUDE.md, các UI/domain rules của repository và
qcet-source-uiux-remediation-plan-65f99561.md trước khi sửa. Đối chiếu runtime hiện tại với
ảnh thành phẩm mới nhất và không làm lại những phần đã hoàn thành.

Mục tiêu của vòng này là đưa dashboard `/` từ “clean card dashboard” thành
action-first workspace theo hierarchy ACTION → SITUATION → CONTEXT.

Ưu tiên theo thứ tự:

1. Dashboard header:
   - Giữ “Bàn làm việc”.
   - Nếu actor có capability, đưa `+ Tạo nhiệm vụ` thành primary action.
   - `Làm mới dữ liệu` trở thành secondary icon/overflow.
   - Không thêm CTA nếu capability không cho phép.

2. Context:
   - Giữ một canonical scope selector.
   - Đổi nhãn 25–24 từ “Tháng” thành “Kỳ vận hành”.
   - Trigger target: `Kỳ T9 · 25/08–24/09` hoặc tương đương gọn.
   - Không đổi month semantics của `/calendar`.
   - Không phá URL/query contract.

3. Composition:
   - Thứ tự mới:
     Header
     Context
     Cần bạn xử lý
     Tình hình trong kỳ
     Đơn vị cần chú ý
     Sắp đến hạn
     Hoạt động gần đây
   - Action queue phải xuất hiện trước situation metrics.
   - Không tạo dashboard V2 hoặc component tree song song.

4. Action queue:
   - Đổi presentation “Hàng đợi điều hành” sang copy action-oriented như “Cần bạn xử lý”.
   - Giữ tối đa 3–5 item.
   - Ưu tiên reason → task → context → action.
   - Giảm metadata dump.
   - Không thay đổi canonical capability/attention logic nếu không có defect cụ thể.

5. Flatten visual hierarchy:
   - Giảm card chrome đáng kể.
   - Action/Situation/Unit có thể là section phẳng.
   - Chỉ giữ container khi nó tạo interaction/grouping boundary thật.
   - Không thêm gradient/glassmorphism/metric cards.

6. Upcoming deadlines:
   - Compact row về khoảng 44–56 px khi nội dung cho phép.
   - Không hiển thị đồng thời “Ngày mai” và exact date nếu gây lặp.
   - Giữ semantic 7-day window đúng dữ liệu.
   - Bỏ UI noise như `Top 5 / 20` nếu không phục vụ quyết định.
   - Giữ `Xem tất cả` dẫn tới đúng dataset/filter.

7. Recent activity:
   - Secondary visual weight.
   - Bỏ `Top 3 / 4`, badge `KHÁC` hoặc metadata không giúp hành động nếu không có product requirement.
   - Giữ tối đa vài activity gần nhất.

8. Responsive:
   - 1440×900: action đầu + situation/context phải nằm trong fold hợp lý.
   - 390×844 và 320 px: không tràn ngang; touch target đủ; safe-area đúng.
   - Không tạo logic data riêng cho mobile.

9. Motion:
   - Không thêm Framer Motion để che hierarchy chưa ổn.
   - Chỉ dùng nếu source đã có/đã được chấp thuận và chỉ cho interaction có ý nghĩa.
   - Tuân thủ prefers-reduced-motion.

Trước khi sửa:
- xác định exact production mount path;
- git status / HEAD;
- đọc component hiện tại;
- xác nhận finding còn tồn tại;
- ghi baseline screenshot.

Sau khi sửa:
- chạy targeted tests liên quan dashboard/scope/query;
- typecheck;
- lint cần thiết;
- browser verification trên đúng authenticated fixture;
- screenshot 1440×900 và 390×844.

Không được tuyên bố hoàn tất remediation plan chỉ dựa vào screenshot.
Báo cáo cuối:
- files changed;
- before/after behavior;
- tests/commands;
- screenshots;
- remaining gaps;
- bất kỳ requirement nào chưa verify được.

Không rewrite.
Không tạo dashboard V2.
Không tạo engine thứ hai.
Không thay đổi backend/domain semantics ngoài defect được chứng minh.

21. Definition of Done cho vòng này

Vòng refinement này hoàn thành khi:

dashboard mở ra cho thấy ngay việc cần xử lý;

primary action đúng capability;

không còn gọi kỳ 25–24 là Tháng;

visual card stacking giảm rõ rệt;

deadline list compact hơn;

metadata noise giảm;

screenshot trước/sau cho thấy thay đổi hierarchy rõ ràng;

mobile không regress;

logic canonical của remediation plan vẫn được giữ;

targeted behavior tests pass.

Nếu ảnh sau vòng này chỉ khác border/radius/spacing nhưng thứ tự thông tin không thay đổi, coi như chưa đạt mục tiêu.