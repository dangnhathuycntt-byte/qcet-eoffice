# Inbox: rà soát và đặc tả cải thiện UI/UX

Ngày: 2026-10-09 (cập nhật sau ảnh 23.32). Trạng thái: **đã duyệt và triển khai theo hướng Linear** (xem §10); các mục 1–9 giữ làm bối cảnh rà soát.

Phạm vi: `/inbox`, danh sách thông báo, khung xem và hợp đồng dữ liệu trực tiếp phục vụ màn hình. Tài liệu này không cho phép tự triển khai. Không thay đổi sidebar, quy trình nhiệm vụ/văn bản, phân quyền, hoặc hợp nhất với Action Inbox ở `/api/me/inbox`.

## 1. Kết luận và bằng chứng

Giữ mô hình danh sách–chi tiết. Cải thiện khả năng nhận biết thông báo, tìm/lọc và trạng thái tương tác; sửa độ tin cậy dữ liệu trước khi tinh chỉnh hình thức.

Nguồn rà soát:

- Ảnh người dùng gửi: `Screenshot 2026-10-09 at 23.27.07.png` (chưa chọn thông báo) và `Screenshot 2026-10-09 at 23.32.12.png` (đang chọn “EEE”). Đã xem ảnh; chưa tương tác trên trình duyệt. Không quy đổi pixel ảnh Retina thành CSS pixel.
- Route thực tế: [page.tsx](../../../src/app/inbox/page.tsx), [InboxView](../../../src/components/inbox/inbox-view.tsx).
- [DESIGN.md](../../../DESIGN.md), [từ vựng QCET](../../ux/QCET_UI_VOCABULARY.md), quy ước compact trong AGENTS.md.
- Source/API được đọc tại thời điểm rà soát; các lỗi dưới đây là phát hiện tĩnh, chưa phải kết quả tái hiện trên môi trường chạy.
- Không có bảng Inbox được duyệt trong các nguồn đã đọc. Bố cục/kích thước đề xuất dưới đây không được coi là quyết định thiết kế có sẵn.

### 1.1. Phát hiện theo mức ưu tiên

P0: dữ liệu/hành động có thể sai. P1: ảnh hưởng hoàn thành thao tác và khả năng quét. P2: tinh chỉnh sau khi luồng chính ổn định.

| Mức | Phát hiện và căn cứ | Hệ quả | Yêu cầu |
|---|---|---|---|
| P0 | DTO trả `message`, `link`; `mapDbNotification` đọc `body`, `linkHref`. DTO không trả `actorName`, `category` dù schema có. Xem [DTO](../../../src/server/dto/notification-dto.ts), [mapper](../../../src/lib/notification-triage.ts). | Mất nội dung/người gửi, liên kết rơi về `/`; không thể chỉ sửa câu chữ để giải quyết. | Chuẩn hóa DTO → view model; thiếu dữ liệu thì thể hiện trung thực, không dựng metadata. |
| P0 | `markAllAsRead` gọi `PATCH /api/notifications/read-all`; [route](../../../src/app/api/notifications/read-all/route.ts) chỉ export POST. Cả mutation đơn lẻ và tất cả không kiểm tra `response.ok`. | HTTP 4xx/5xx không vào catch; UI có thể báo đã đọc dù server từ chối. | Dùng đúng method, kiểm tra response, rollback và báo lỗi. |
| P0 | GET mặc định 20 bản ghi; UI không tải tiếp, đếm unread từ mảng đã tải; API `total` là độ dài trang. Xem [GET](../../../src/app/api/notifications/route.ts), [pagination](../../../src/contracts/common.ts). | Badge có thể thấp hơn thực tế; tìm/lọc bỏ sót thông báo cũ; số tổng không đáng tin. | Count từ server, truy vấn toàn bộ tập được phép, phân trang rõ ràng. |
| P1 | Ảnh: nhiều hàng có dòng “vừa giao nhiệm vụ” giống nhau, nhiều tiêu đề bị cắt. Source: hàng hai dòng `py-2`, avatar 24px. | Tốn chiều cao nhưng ít thông tin phân biệt; chưa đạt hàng compact ≤32px. | Hàng một dòng 32px; ưu tiên tên đối tượng, loại sự kiện, thời gian; đầy đủ nội dung trong pane. |
| P1 | Ảnh: “Chưa đọc” nằm trong menu; tìm kiếm chỉ mở qua icon. | Khó nhận biết bộ lọc hiện tại, thêm bước cho thao tác thường gặp. | Hiện sẵn tìm kiếm và chuyển “Tất cả / Chưa đọc”. |
| P1 | Source: selected dùng `bg-accent`, hover dùng biến thể cùng token; tất cả option `tabIndex=0`. | Chọn/focus/hover khó phân biệt; Tab đi qua từng hàng. | `bg-selected`, focus ring riêng; roving tabindex theo APG. |
| P1 | URL chỉ đồng bộ `id` khi có giá trị; `filter` chỉ khởi tạo state, category/query ở local. ID ngoài trang đã tải không được resolve riêng. | Back/Forward, tải lại và deep link không bảo toàn đầy đủ trạng thái. | Hợp đồng URL và tải theo ID độc lập với trang danh sách. |
| P1 | Source: mọi kết quả rỗng dùng “Hộp thư trống” hoặc “Không có thông báo chưa đọc”. | Không phân biệt không có dữ liệu với tìm/lọc không khớp. | Ma trận trạng thái và nút khôi phục đúng nguyên nhân. |
| P1 | Source: đổi lựa chọn chưa xóa ngay taskContext cũ; CTA mọi liên kết đều là “Mở nhiệm vụ”. | Có thể hiện chi tiết của mục trước trong lúc tải; nhãn hành động sai loại đối tượng. | Reset/cache theo entity ID; CTA theo đích đã xác thực. |
| P0 | Ảnh 23.32: mục “EEE” vẫn có nút “Mở nhiệm vụ” nhưng pane không có chip trạng thái/hạn/người phụ trách. Source: `mapDbNotification` gán `linkHref: raw.linkHref \|\| "/"`, DTO chỉ có `link` nên mọi thông báo nhận `"/"`; CTA hiện khi `linkHref` truthy và regex tìm `taskId` không khớp `"/"`. | CTA xuất hiện trên mọi thông báo và dẫn về Tổng quan thay vì đối tượng; context nhiệm vụ không bao giờ tải. | Gộp vào sửa DTO/adapter ở dòng P0 đầu; thêm AC cho CTA ẩn khi không có đích hợp lệ. |
| P1 | Ảnh 23.32: hàng ghi “EEE”, header và tiêu đề detail ghi “[GIAO VIỆC] EEE”. Source: list dùng `formatNotificationContent(...).targetTitle` (đã bỏ tiền tố), detail dùng `selectedTitle` từ `targetTitle` thô; tiêu đề lặp ở header và `h2 text-xl`. | Cùng một thông báo có hai tên; người dùng khó đối chiếu list ↔ detail; `text-xl` lệch thang compact. | Một hàm tạo tiêu đề hiển thị dùng chung list/detail; loại sự kiện thể hiện bằng nhãn riêng, không nằm trong tiêu đề. |
| P1 | Ảnh 23.32: khối “Hoạt động” ghi “Hệ thống QCET vừa giao nhiệm vụ · 2 giờ trước”; mọi hàng có dòng phụ “vừa giao nhiệm vụ”. Source: actor fallback `"Hệ thống QCET"` vì DTO không có actor; `action` đọc `raw.body` trong khi DTO trả `message`, nên chỉ còn câu mặc định theo type. | Nội dung thật của thông báo không hiển thị; quy người giao là “Hệ thống” là metadata dựng, sai nguyên tắc không bịa dữ liệu. | Theo §5.2; khi thiếu actor ghi trung thực, không gán hệ thống. |
| P1 | Ảnh: list dùng “1g”, “2g”, “1n”, “4n”; detail dùng “2 giờ trước”. Source: `formatShortTime` (list) khác `formatRelativeTime` (detail). | “n” mơ hồ giữa ngày/năm; hai định dạng cho cùng một mốc; trình đọc màn hình đọc ký hiệu viết tắt sai nghĩa (Primer ghi nhận “1m” bị đọc thành “1 meter”). | Một formatter dùng chung theo §4.3; thời gian tuyệt đối có thể truy cập không chỉ bằng hover. |
| P2 | Ảnh: pane chưa chọn rộng, chỉ có icon và một câu; source có header trống. | Chưa hướng dẫn bước tiếp theo, cảm giác vùng làm việc bỏ trống. | Empty state nhỏ gọn có chỉ dẫn; không tự đánh dấu đã đọc để lấp chỗ trống. |

Số 8 cạnh Hộp thư trong ảnh chưa đủ chứng minh badge sai. Rủi ro count được kết luận từ đường dữ liệu, không từ việc đếm các chấm xanh nhìn thấy trong ảnh.

## 2. Nghiên cứu web và cách áp dụng

Tra cứu ngày 2026-10-09. Đây là căn cứ tham khảo, không thay thế quy chuẩn hay nghiệp vụ QCET.

| Nguồn | Điều nguồn hỗ trợ | Áp dụng đề xuất |
|---|---|---|
| [Linear — Inbox](https://linear.app/docs/inbox) | Inbox có xem ngữ cảnh, tìm nhanh, điều hướng bàn phím, thao tác đọc/chưa đọc. | Giữ luồng chọn → hiểu sự kiện → mở đối tượng. Không sao chép Priority Inbox, snooze, delete, giới hạn lưu trữ hoặc shortcut của Linear thành yêu cầu QCET. |
| [NN/g — Designing Empty States in Complex Applications](https://www.nngroup.com/articles/empty-state-interface-design/) | Trạng thái trống cần giải thích tình trạng hệ thống và đưa đường đi tiếp phù hợp. | Tách chưa chọn, chưa có dữ liệu, không khớp bộ lọc, lỗi tải và đã đọc hết. |
| [W3C — Listbox Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/) | Focus và selection là hai khái niệm; listbox cần mô hình bàn phím nhất quán, không phù hợp với nút tương tác lồng trong option. | Arrow chỉ di chuyển focus; Enter/Space chọn. Thao tác đọc/chưa đọc đặt ở toolbar pane, không chèn nút vào option. |
| [GitHub Docs — Managing notifications from your inbox](https://docs.github.com/en/subscriptions-and-notifications/how-tos/viewing-and-triaging-notifications/managing-notifications-from-your-inbox) | Mặc định hiện cả đã đọc/chưa đọc, có lối chuyển nhanh sang Unread; cho xem trước chi tiết trước khi chọn thao tác; có thể nhóm theo ngày hoặc repository. | Củng cố “Tất cả / Chưa đọc” hiển thị sẵn và luồng xem trước → mở đối tượng. Nhóm theo ngày chỉ là phương án cần duyệt (§9), không phải yêu cầu. Done/Save/Unsubscribe nằm ngoài phạm vi. |
| [GitLab Pajamas — Date and time](https://design.gitlab.com/content/date-and-time/), [Cloudscape — Timestamps](https://cloudscape.design/patterns/general/timestamps/), [HPE — Date and time](https://design-system.hpe.design/foundation/date-and-time) | Thời gian tương đối phù hợp feed/thông báo; khi dùng tương đối phải có thời gian tuyệt đối; sự kiện quá khoảng một tuần nên dùng ngày tuyệt đối; dùng thẻ `time` với `datetime`. | Áp dụng ngưỡng ở §4.3: phút → giờ → ngày trong 7 ngày, sau đó hiện ngày/tháng. Thời gian tuyệt đối có múi giờ ICT hiển thị trong detail. |
| [Primer — RelativeTime](https://primer.style/product/components/relative-time/guidelines) | Không khuyến khích dạng siêu ngắn (“2mo”) ở vùng hẹp vì khó hiểu, không dịch được và gây lỗi với công nghệ hỗ trợ. | Bỏ “g/n”; chữ hiển thị dùng “2 giờ”, “3 ngày”. Nếu cột thời gian quá hẹp thì chuyển sang ngày tuyệt đối thay vì viết tắt. |
| [Accessible Data Interfaces — time element and relative timestamps](https://www.accessible-data-interfaces.com/core-aria-keyboard-navigation-for-data-uis/accessible-date-and-time-data/time-element-and-relative-timestamps/) | `title` tooltip không đến được bàn phím/cảm ứng/trình đọc màn hình; thời gian tương đối tự cập nhật không được announce. | Thời gian tuyệt đối đưa vào mô tả accessible của hàng và vào detail; `title` chỉ là bản sao. Không đặt thời gian trong live region. |
| [W3C — Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) | WCAG 2.2 AA quy định mục tiêu trỏ tối thiểu 24×24 CSS px, có ngoại lệ về khoảng cách và một số ngữ cảnh. | Control desktop 28×28 đáp ứng kích thước tối thiểu; icon nhỏ không được là toàn bộ hit target. Không suy ra mọi control phải cao 44px. |

Các con số bố cục 32/440/480/920px dưới đây là lựa chọn thiết kế đề xuất cho QCET; không phải số đo hoặc khuyến nghị lấy từ các nguồn web.

## 3. Mục tiêu và giới hạn

Người dùng cần trả lời được: có cập nhật nào chưa đọc, cập nhật liên quan đối tượng nào, nội dung gì thay đổi và mở nơi xử lý ở đâu.

- “Chưa đọc” là trạng thái tiếp nhận thông báo, không phải nhiệm vụ chưa hoàn thành.
- “Việc cần làm / Chờ phê duyệt / Nhắc hạn” trong Inbox là nhóm sự kiện; không khẳng định quyền hay trạng thái xử lý hiện tại của đối tượng.
- Giữ thứ tự mới nhất trước, tie-break theo ID ổn định. Không tự xếp lại theo mức ưu tiên nghiệp vụ.
- Không gộp nhiều sự kiện thành một notification trong đợt này; tránh làm mất trạng thái đọc riêng.
- Không thêm archive, snooze, xóa, chọn hàng loạt, phê duyệt trực tiếp, KPI, biểu đồ hoặc metadata suy từ tên/chuỗi ID.

## 4. Đặc tả bố cục và hình thức

### 4.1. Khung desktop

Đo theo chiều rộng thực tế vùng Inbox sau sidebar, không theo chiều rộng màn hình:

- Khi workspace ≥920px: hai pane; danh sách mặc định 440px, detail tối thiểu 480px. Hai vùng cuộn độc lập, header cố định. Chưa thêm resize trong đợt này.
- Khi workspace <920px: một pane; mở thông báo thì thay danh sách bằng detail và có nút “Quay lại hộp thư”. Quay lại giữ từ khóa, lọc, trang đã tải và vị trí cuộn.
- Chuyển breakpoint không làm mất lựa chọn hay phát sinh mutation đọc lần nữa.
- Giữ app shell hiện có. Nội dung pane dùng `min-h-0`, cuộn bên trong; không tự tính thêm chiều cao viewport chồng lên shell.
- Header hai pane cao 40px; control cao 28px. Viền phân cách mảnh, không shadow giữa pane.

Sơ đồ bố cục (các nhãn trong ngoặc là dữ liệu thực, không phải số liệu mẫu):

```text
Hộp thư                   [Làm mới] […] | [Loại đối tượng]        [Mở đối tượng]
[Tìm trong hộp thư...................] | [Tiêu đề đầy đủ]
Tất cả  Chưa đọc [số server]  [Lọc]   | [Sự kiện • Người gửi nếu có • Thời gian]
[bộ lọc đang áp dụng, nếu có]          | Nội dung thông báo
• [icon] [Tiêu đề] [Loại sự kiện] [Giờ]| Thuộc tính đối tượng được phép xem
  [icon] [Tiêu đề] [Loại sự kiện] [Giờ]| [Đánh dấu đã đọc / chưa đọc]
[Tải thêm, nếu còn]                   |
```

### 4.2. Thanh công cụ

- Tìm kiếm luôn hiển thị, cao 28px, chữ 12px; nhãn accessible “Tìm kiếm thông báo”. Có nút xóa từ khóa với vùng bấm 28px.
- “Tất cả / Chưa đọc” là lựa chọn loại trừ nhau, cao 28px, chữ 12px. Dùng control chung có semantics tương ứng; nếu dùng tabs phải có tablist/tab/tabpanel đúng chuẩn.
- Số bên “Chưa đọc” là tổng chưa đọc của người dùng từ server, không thay đổi theo query/category. Accessible label nói rõ “N thông báo chưa đọc trong hộp thư”. Không hiển thị một con số ở hai nơi cạnh nhau mà không thêm ý nghĩa.
- Lọc mở popover 224–256px, item ≤32px, chữ 12px. Giữ nhóm hiện có; hiển thị nhãn nhóm đang chọn ra ngoài menu, có “Xóa bộ lọc”.
- Nút làm mới ở header. “Đánh dấu tất cả thông báo đã đọc” chuyển vào menu có nhãn đầy đủ, giảm nguy cơ bấm nhầm icon; thêm mô tả “Áp dụng cho toàn bộ hộp thư, kể cả ngoài bộ lọc”.
- Disabled khi mutation đang chạy hoặc server xác nhận không còn unread. Không đổi kích thước toolbar khi count về 0. Không cung cấp Undo cho read-all nếu chưa có mutation hoàn tác tương ứng.

### 4.3. Hàng thông báo compact

| Thành phần | Đặc tả |
|---|---|
| Hàng | Cao 32px ở zoom 100%, một dòng, padding ngang 8px, khoảng cách 8px; dùng token/utility hiện có. |
| Chưa đọc | Cột chấm cố định 8px, chấm 6px; giữ chỗ cả khi đã đọc để tiêu đề không nhảy. Accessible name có “Chưa đọc”. |
| Biểu tượng | 16px, nét 1,5; avatar thật dùng `size="sm"` 20px khi có actor được API cung cấp. Không render avatar tên người suy đoán. |
| Tiêu đề | `text-compact` 13px, flex chiếm phần còn lại, một dòng ellipsis; có full text khi focus/hover và trong pane. Không cắt chuỗi dữ liệu trước render. |
| Sự kiện | `text-xs` 12px: nhãn ngắn như “Giao nhiệm vụ”, “Nhắc hạn”, theo type đã chuẩn hóa. Ẩn phần này ở container dưới 400px; vẫn có trong accessible name/detail. |
| Thời gian | 12px, tabular, căn phải, không co. Một formatter dùng chung list/detail, nhận `now` từ ngoài: <1 phút “Vừa xong”; <60 phút “N phút”; <24 giờ “N giờ”; <7 ngày “N ngày”; từ 7 ngày “dd/MM”; khác năm “dd/MM/yyyy”. Không dùng viết tắt “p/g/n”. Bọc `<time datetime>`; thời gian tuyệt đối ICT có trong mô tả accessible, tooltip chỉ bổ sung. Timestamp lỗi/tương lai không hiển thị “Vừa xong”. |
| Đã đọc | Weight thường; không làm mờ cả hàng. Tiêu đề vẫn có tương phản đủ đọc. |
| Đang chọn | `bg-selected`; không dùng token hover thay selected. Chưa đọc và đang chọn là hai trục độc lập. |
| Focus/hover | Hover `bg-accent`; focus ring rõ, nhìn được trên nền selected. Không chỉ dùng màu để báo unread/focus. |

Đổi từ hai dòng sang một dòng là đánh đổi có chủ đích để đạt chuẩn compact; tên người gửi/nội dung đầy đủ chuyển sang detail. Không nhét hai dòng 13/12px vào hàng 32px. Nếu cần giữ hai dòng thì phải duyệt ngoại lệ mật độ riêng, không tự tăng lên 48–56px.

### 4.4. Pane nội dung

- Khi chưa chọn: icon trung tính 24px, “Chọn một thông báo để xem”, dòng phụ “Dùng ↑ ↓ để di chuyển, Enter để mở”. Có nút “Xem thông báo chưa đọc đầu tiên” khi server xác nhận còn unread; nút này là lựa chọn chủ động của người dùng.
- Không tự chọn mục đầu khi mở `/inbox`; tránh tự đổi trạng thái đọc chỉ vì truy cập trang.
- Khi đã chọn: tiêu đề đầy đủ 13px semibold, cho xuống dòng; metadata 12px; nội dung 13px. Nội dung rộng tối đa 768px, padding 16px, không dùng tiêu đề `text-xl`.
- Sự kiện gốc (nội dung, người gửi nếu có, thời điểm) xuất hiện trước thuộc tính hiện tại của nhiệm vụ/văn bản. Không dùng description nhiệm vụ thay thế hoàn toàn body thông báo.
- Tiêu đề hiển thị lấy từ cùng hàm với hàng list; header pane chỉ chứa loại đối tượng/mã và thao tác, không lặp nguyên tiêu đề đã có ở thân pane.
- Metadata sự kiện ghi thời gian tuyệt đối kèm tương đối, dạng “dd/MM/yyyy HH:mm · N giờ trước”, dùng formatter ở §4.3.
- Đổi tên khối chỉ chứa một thông báo từ “Hoạt động” thành “Nội dung thông báo”; không tạo cảm giác đây là toàn bộ lịch sử đối tượng.
- CTA: “Mở nhiệm vụ”, “Mở văn bản”, hoặc “Mở chi tiết” theo đích hợp lệ. Không có liên kết thì không dựng CTA về `/` hay `/tasks`.
- Thuộc tính là dữ liệu hiện tại từ API có phân quyền; không suy ra từ text thông báo. Tái sử dụng component trạng thái/ưu tiên của phân hệ, tránh thêm bản biểu diễn cạnh tranh.
- Đang tải entity B phải bỏ dữ liệu entity A ngay; giữ nội dung thông báo B và skeleton phần context. 403/404 hiển thị “Không thể xem đối tượng liên quan”, không lộ thêm thuộc tính.

### 4.5. Responsive và accessibility

- Kiểm tra 1440×900, 1280×800, 1024×768, 768×1024 và 390×844 CSS px, thêm 320px để kiểm tra reflow. Trạng thái hai pane phụ thuộc container 920px, không ép theo `md`.
- Mặc định hàng desktop vẫn 32px. Trên thiết bị trỏ thô, đề xuất ngoại lệ vùng chạm 44px cho hàng/control; glyph/chữ giữ cùng thang compact. Ngoại lệ này cần duyệt cùng spec, không lặng lẽ thay quy chuẩn ≤32px.
- Zoom 200%/chữ phóng lớn: cho chiều cao tăng khi nội dung cần, không clip; ưu tiên đọc được thay vì cưỡng ép 32px ở mọi mức zoom.
- Giữ listbox đơn chọn nếu không có nút lồng trong hàng: một điểm Tab vào list, Arrow/Home/End di chuyển focus, Enter/Space chọn. Di chuyển focus không tự mark-read. Tab tiếp theo ra khỏi list đến vùng thao tác.
- Escape đóng popover trước. Ở chế độ một pane, khi không có popup đang mở, Escape quay lại list; trả focus về hàng cũ hoặc hàng gần nhất còn tồn tại.
- Focus không bị mất khi kết quả refresh. Thông báo kết quả/lỗi qua live region phù hợp; không đọc lại toàn bộ danh sách sau mỗi mutation.
- Tooltip hoạt động cả hover và focus, có thể đóng; không phụ thuộc tooltip để biết hành động. Kiểm tra tương phản chữ thường ≥4,5:1 và chỉ báo focus/điều khiển theo WCAG liên quan.

## 5. Hợp đồng tương tác và dữ liệu

### 5.1. URL, lựa chọn và lịch sử

Đề xuất URL: `/inbox?id=<notificationId>&filter=unread&category=approvals&q=<query>`; bỏ tham số mặc định/rỗng. `category` là nhóm triage đã định nghĩa, cần ánh xạ rõ khi gọi API, không đồng nhất trực tiếp với cột category trong DB.

- URL là nguồn trạng thái query/filter/category/id, đồng bộ cả khi tham số bị xóa; validate giá trị lạ về mặc định.
- Từ list chưa chọn → mở mục: push. Đổi mục khi đã mở: replace. Gõ tìm kiếm (debounce 250ms), đổi lọc: replace, reset trang danh sách.
- Back/Forward khôi phục URL và UI tương ứng. Nút quay lại đóng entry do Inbox mở; với deep link trực tiếp thì replace bỏ `id`, không back ra website khác.
- Chọn notification ngoài trang đầu phải resolve theo ID bằng endpoint được bảo vệ; không coi “không có trong mảng đã tải” là “không tồn tại”. Loading/error của chi tiết độc lập với danh sách.
- Thay filter/query: giữ mục đang mở và hiển thị “Thông báo này nằm ngoài bộ lọc hiện tại” nếu không khớp. Không chọn một mục mới thay người dùng.
- Trong tab Chưa đọc, giữ riêng mục đang mở sau khi đọc để tránh biến mất đột ngột; khi chuyển mục khác hoặc rời tab thì mục đã đọc rời list. Không giữ toàn bộ lịch sử ID đã đọc trong session như hiện tại.
- ID không hợp lệ/không được phép: thông báo trung tính và nút quay lại; không render trạng thái “chưa chọn”.

### 5.2. DTO và phân trang

- Giữ các field public `message`, `link`; adapter đọc đúng DTO, không truyền raw Prisma object ra client. Bổ sung `actorName` nullable và `category` đã chuẩn hóa nếu cần cho màn hình, qua whitelist DTO và test.
- DTO thiếu actor: ghi “Không có thông tin người gửi” trong detail; không quy mọi actor thiếu thành “Hệ thống QCET”. Chỉ ghi hệ thống khi dữ liệu xác nhận.
- Liên kết phải được kiểm tra cùng origin/route được hỗ trợ; không suy đối tượng từ tiêu đề, không dùng UUID làm mã nghiệp vụ. Đối tượng đích tiếp tục tự phân quyền ở server.
- GET nhận query tìm kiếm và nhóm triage đã validate, lọc ở server trên toàn bộ tập của người dùng; title/message/actor có dữ liệu là phạm vi tìm. Trim query, không phân biệt hoa thường; tìm không dấu chưa thuộc phạm vi cam kết.
- Dùng một hàm phân loại deterministic chung cho server/client; loại bỏ suy đoán nhóm nhắc hạn chỉ vì nội dung chứa chữ “hạn”. Type chưa biết vẫn hiện trong Tất cả với nhãn trung tính.
- Kết quả cần `items`, `unreadCount` toàn hộp thư, `filteredTotal`, và thông tin trang/`hasMore` nhất quán. Không đổi ý nghĩa field legacy mà chưa rà consumer; có thể bổ sung field mới tương thích trước.
- Tận dụng phân trang sẵn có để triển khai “Tải thêm”; thứ tự `createdAt desc, id desc`, dedupe theo ID. Nếu giữ offset, cố định mốc snapshot khi tải chuỗi trang để thông báo mới không làm trôi trang; refresh chủ động tạo snapshot mới. Cursor là phương án thay thế nếu chứng minh cần, không thêm schema chỉ để đổi UI.
- Query thay đổi hủy/loại response cũ. Refresh thất bại giữ dữ liệu đang xem, có banner lỗi; không đổi thành màn trống. Count chưa tải/lỗi là unknown, không tự gán 0.

### 5.3. Đọc/chưa đọc và đồng bộ

- Chọn chủ động bằng click/Enter/Space đánh dấu đã đọc sau khi tải được nội dung notification; không chờ API đối tượng liên quan. Deep link đánh dấu khi nội dung notification đã render và document đang hiển thị.
- `PATCH /api/notifications/:id/read` với trạng thái đích. Read-all dùng `POST /api/notifications/read-all` theo route hiện có, áp dụng toàn bộ thông báo của người dùng tại thời điểm server xử lý.
- Kiểm tra cả HTTP status và envelope thành công. Pending khóa thao tác trùng trên cùng mục; read-all không chạy chồng mutation đơn lẻ. Rollback không được ghi đè cập nhật mới hơn.
- Dùng lại `beginOptimisticRead`/`settleOptimisticRead` trong [notification-triage.ts](../../../src/lib/notification-triage.ts) khi phù hợp; bổ sung trạng thái đích unread/concurrency nếu helper chưa hỗ trợ. Không coi test helper là bằng chứng Inbox đã tích hợp đúng.
- Badge/sidebar/tab nhận số authoritative từ server sau mutation/refetch. Delta tạm tính chỉ khi trạng thái thực sự chuyển; không trừ count lần nữa khi chọn lại mục đã đọc. Thông báo mới đến trong lúc read-all không được ép local count bằng 0 vĩnh viễn.
- Lỗi: “Không thể cập nhật trạng thái đã đọc. Vui lòng thử lại.” Khôi phục chấm unread/count và giữ lựa chọn. Lỗi 401 chuyển đăng nhập; 403 không vòng lặp đăng nhập hay biến thành empty.
- Mọi request giữ auth, CSRF, rate limit, quyền sở hữu notification và quyền đọc đối tượng. Không dùng role/scope client để mở rộng tập dữ liệu.

## 6. Ma trận trạng thái

| Điều kiện | Hiển thị | Thao tác |
|---|---|---|
| Tải lần đầu | Skeleton cùng bố cục thật; chưa hiển thị count 0/empty. | Chờ; không cho mark-read. |
| Có dữ liệu, chưa chọn | Danh sách + hướng dẫn chọn nhỏ gọn ở detail. | Chọn hàng / xem unread đầu tiên. |
| Server xác nhận hộp thư chưa có dữ liệu | “Chưa có thông báo”; “Thông báo liên quan đến công việc sẽ xuất hiện tại đây.” | Làm mới. |
| Tab Chưa đọc, không query/category, unread = 0 | “Bạn đã đọc hết thông báo”. | “Xem tất cả”. Không nói đã hoàn thành công việc. |
| Query/category không có kết quả | “Không có thông báo phù hợp”; giữ điều kiện đang áp dụng. | “Xóa tìm kiếm và bộ lọc”. Không tự bỏ điều kiện. |
| Không tải được danh sách | Lỗi có hướng dẫn; nếu đã có dữ liệu thì giữ dữ liệu cũ và báo chưa cập nhật. | Thử lại. |
| Đang resolve deep link | Skeleton chi tiết, không dùng “Chưa chọn”. | Quay lại. |
| Notification không truy cập được | “Không thể mở thông báo này”. | Quay lại hộp thư. |
| Đối tượng liên quan không truy cập được | Giữ phần notification được phép xem, lỗi trong khu vực context. | Thử lại khi là lỗi tạm thời; không lộ dữ liệu cũ. |
| Đang tải thêm / tải thêm lỗi | Giữ list/scroll, trạng thái ở cuối danh sách. | Thử lại tải thêm. |
| Đang lưu / lưu lỗi | Pending tại nút, sau lỗi rollback và live message. | Thử lại. |

## 7. Kiến trúc triển khai đề xuất

Không tạo workspace hay notification store thứ hai. `InboxView` vẫn là điểm tích hợp; tách trình bày list/row/detail chỉ khi cần để kiểm thử và quản lý trạng thái rõ ràng.

| Phạm vi | Điểm sửa chính | Lý do |
|---|---|---|
| DTO/adapter | `src/server/dto/notification-dto.ts`, `src/lib/notification-triage.ts` | Một hợp đồng dữ liệu dùng chung, tránh vá từng label/CTA. |
| Query/count | `src/contracts/notifications.ts`, `src/app/api/notifications/route.ts` | Server biết toàn bộ dữ liệu và quyền; client không thể đếm/tìm toàn cục từ một trang. |
| Deep link | GET notification theo ID được bảo vệ, bổ sung khi triển khai | Độc lập với pagination; không tải hết Inbox để tìm ID. |
| Interaction/visual | `src/components/inbox/inbox-view.tsx` và component con nếu cần | Đồng bộ URL, pending/error, bố cục và bàn phím tại một luồng. |
| Component chung | `src/components/ui/`, `src/components/workspace/` | Tái sử dụng token, menu, avatar, loading; đọc diff hiện có trước khi sửa file chung. |
| Ngày giờ | `src/lib/academic-calendar.ts` và formatter chung phù hợp | Múi giờ Asia/Ho_Chi_Minh; truyền `now` vào logic phân loại/format để test deterministic. |

Các file app shell/workspace đang có thay đổi dở tại thời điểm lập spec. Không lấy việc sửa Inbox làm lý do ghi đè hoặc chuẩn hóa lại các thay đổi đó. Rà consumer notification popover/center/mobile khi đổi mapper/DTO để tránh regression ngoài màn hình này.

## 8. Thứ tự triển khai và nghiệm thu

### Giai đoạn A — độ tin cậy (P0)

Sửa DTO/adapter, method/read reconciliation, count/query/pagination và deep link. Dùng fixture có hơn 20 thông báo, unread nằm ngoài trang đầu, notification thiếu actor/link, task/document/system và type lạ.

### Giai đoạn B — giao diện và tương tác (P1)

Áp bố cục compact, tìm/lọc hiển thị rõ, các trạng thái selected/focus/empty/error; hoàn thiện history và responsive. Không lấy giao diện đẹp ở happy path làm tiêu chí đủ.

### Giai đoạn C — kiểm chứng sử dụng (P2)

Đối chiếu ảnh trình duyệt cùng viewport với hiện trạng; thử tìm thông báo cũ, đọc chưa đọc, mở đúng đối tượng, quay lại list và phục hồi khi lỗi. Đánh giá khả năng nhận diện khi tiêu đề dài/trùng; chỉ điều chỉnh mật độ sau bằng chứng này.

### Tiêu chí nghiệm thu bắt buộc

| ID | Kịch bản | Kết quả mong đợi |
|---|---|---|
| AC01 | Notification DTO có message/link/actor | Đúng nội dung/người gửi/đích; không fallback `/` giả. |
| AC02 | Read đơn lẻ/read-all trả 403/405/429/500 hoặc mất mạng | Không giữ trạng thái thành công giả; count và unread phục hồi, lỗi hiển thị. |
| AC03 | Hơn 20 thông báo, unread và từ khóa chỉ có ở trang sau | Badge đúng toàn cục; query tìm ra; tải thêm không trùng/bỏ sót trong snapshot. |
| AC04 | Mở ID ngoài trang đầu, ID không tồn tại, ID của người khác | Resolve đúng hoặc lỗi trung tính; không rò rỉ dữ liệu. |
| AC05 | Chuyển A → B nhanh, response A về muộn | Detail chỉ thuộc B, không lẫn title/context/action của A. |
| AC06 | Đánh dấu unread/read liên tiếp, bấm lặp hoặc read-all đang chạy | Không âm count, không mutation chồng gây sai; hội tụ về server. |
| AC07 | Read-all khi filter/query đang bật | Nhãn nói rõ phạm vi toàn hộp thư; hành vi đúng phạm vi đó. |
| AC08 | Back/Forward, reload, xóa id khỏi URL | URL, lựa chọn, query/filter và chế độ pane khớp; quay lại không tự mở lại mục. |
| AC09 | Chỉ dùng bàn phím | Một điểm Tab vào list, Arrow không mark-read, Enter chọn, focus nhìn rõ và được phục hồi. |
| AC10 | Unread tab: mở mục, chuyển mục, đổi bộ lọc | Không biến mất khi đang đọc; mục đã đọc rời list theo quy tắc ở §5.1, count đúng. |
| AC11 | Empty thật, search empty, filtered empty, loading, error | Đúng thông điệp/CTA riêng, không báo “đã đọc hết” trong lỗi tải. |
| AC12 | Desktop ở zoom 100% | Hàng 32px, chữ 13/12, control 28px, avatar 20px, popover 224–256px, stroke 1,5. |
| AC13 | Viewport hẹp, zoom 200%, bàn phím ảo | Không cuộn ngang toàn trang, không cắt nội dung/control, quay lại giữ list state. |
| AC14 | Qua 00:00 ICT, khác năm, timestamp thiếu/lỗi/tương lai | Ngày giờ rõ, không bịa “Vừa xong” cho timestamp lỗi; list và detail cùng formatter, không còn “g/n”; test cố định now. |
| AC17 | Thông báo không có link, link không hỗ trợ, link nhiệm vụ hợp lệ | Chỉ hiện CTA khi có đích hợp lệ, nhãn đúng loại; không điều hướng về `/`. |
| AC18 | Tiêu đề có tiền tố “[GIAO VIỆC]” | List, header và detail hiển thị cùng một tiêu đề; loại sự kiện ở nhãn riêng. |
| AC15 | Mất quyền đọc task/document sau khi notification được tạo | API đích từ chối đúng quyền, không hiện context cache cũ. |
| AC16 | Refresh lỗi rồi thử lại; thông báo mới xuất hiện khi read-all | Giữ dữ liệu khi lỗi, refetch xác nhận count; không xóa cập nhật mới bằng snapshot cũ. |

Khi triển khai TypeScript/logic: chạy `npm run typecheck`, `npm run lint`, test liên quan thực sự và browser E2E cho tương tác. Các test có sẵn cần rà/tận dụng: [notification-read-reconciliation](../../../tests/notifications/notification-read-reconciliation.test.ts), [notifications-error-vs-empty](../../../tests/notifications/notifications-error-vs-empty.test.ts), [notification-contract](../../../tests/notification-contract.test.ts), [inbox-workspace](../../../tests/inbox-workspace.test.ts), [notification-controlled-vocabulary](../../../tests/domain/notification-controlled-vocabulary.test.ts). Bổ sung regression ở đường tích hợp đang chạy, không chỉ assertion chuỗi source hay helper đơn lẻ. Test quyền cần DB test được repo hỗ trợ.

Không chạy production build để verify. Tận dụng server đang có; khi cần khởi chạy thì kiểm tra cổng và dùng `npm run dev -- -p 3001`. Với lần lập spec này chỉ kiểm tra link/path và diff; không tuyên bố các AC đã pass.

## 9. Các quyết định cần duyệt cùng spec

1. Chọn hàng một dòng 32px, đưa người gửi/nội dung dài vào detail. Đây là phương án khuyến nghị để tuân thủ compact.
2. Chọn list 440px và chuyển một pane khi workspace dưới 920px. Chưa thêm thanh kéo.
3. Giữ mặc định Tất cả, không auto-select; tab Chưa đọc hiện trực tiếp. Giữ riêng mục đang đọc trong tab đến khi chuyển lựa chọn.
4. Duyệt ngoại lệ vùng chạm 44px cho coarse pointer; desktop vẫn 28px control/32px row.
5. Duyệt phần server cần thiết: chuẩn hóa DTO, tìm/lọc toàn cục, count/phân trang và resolve ID. Nếu chỉ duyệt CSS thì không thể coi P0 và tìm kiếm toàn bộ hộp thư đã được xử lý.
6. Có nhóm danh sách theo ngày (“Hôm nay / Hôm qua / Trước đó”, nhãn dính khi cuộn) hay giữ danh sách phẳng. Khuyến nghị: chưa nhóm trong đợt này; formatter thời gian mới đã giúp quét mốc thời gian, và nhãn nhóm làm giảm số hàng nhìn thấy. Đánh giá lại sau Giai đoạn C.

Sau khi duyệt, ghi quyết định ngay tại mục này; không suy ra phê duyệt từ việc file spec đã được tạo.

## 10. Quyết định đã duyệt (2026-10-09)

Người dùng chọn tham chiếu Linear Inbox: sạch, tối giản, chỉ chứa việc của mình. Khi khác với các mục trên, mục này là chuẩn.

- **Nguồn thông báo.**
  - “Giao nhiệm vụ” chỉ gửi cho người thực hiện (TaskActor `DRI`, `COLLABORATOR` và `assigneeId` được truyền), loại người vừa thao tác. Người giao, theo dõi, quan sát, duyệt không nhận.
  - `POST /api/notifications/push/test` (thử chuông, nút “Đôn đốc”) chỉ gửi push, không ghi vào Hộp thư.
  - Ý kiến chỉ đạo và quét hạn văn bản giữ nguyên.
- **Một hàng mỗi đối tượng.** Thông báo cùng nhiệm vụ/văn bản được gom một hàng, hiện sự kiện mới nhất. Mở hàng thì đánh dấu đã đọc mọi thông báo của đối tượng đó. Detail liệt kê “Cập nhật trước đó”.
- **Hàng hai dòng kiểu Linear** (tiêu đề 13px; sự kiện · người gửi · thời gian 12px; khoảng 46px). Đây là ngoại lệ có chủ đích so với hàng ≤32px của §4.3.
- **Header tối giản:** “Hộp thư ···” (đánh dấu tất cả đã đọc, làm mới) và hai icon Tìm, Lọc. Bộ lọc gồm Chỉ chưa đọc, Việc cần làm, Nhắc hạn; bỏ “Chờ phê duyệt” vì chưa có nguồn tạo. Bộ lọc đang bật hiện thành chip.
- **Detail:** header gồm loại đối tượng · mã, nút đọc/chưa đọc và CTA theo đích hợp lệ. Thân gồm tiêu đề, dòng meta, thuộc tính nhiệm vụ hiện tại và nội dung. Bỏ khối “Hoạt động”.
- **Dữ liệu cũ:** không xóa. Các thông báo tự giao trước thay đổi vẫn hiển thị cho đến khi người dùng đánh dấu đã đọc hoặc có quyết định dọn dữ liệu riêng.

