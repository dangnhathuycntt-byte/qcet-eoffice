# Nguyên tắc UI/UX của Linear và Asana

Nghiên cứu web ngày 22/10/2026. **Nguồn của quy tắc UI/UX**: người dùng duyệt ngày 22/10/2026 cho mục 4 (bài học chung) và phần giao diện, tương tác của mục 1.2–1.3 thành quy tắc, đã rút gọn thành mục "Nguyên tắc UI/UX rút từ Linear và Asana" trong [AGENTS.md](../../AGENTS.md); bản ở AGENTS.md là bản phải theo. Phần còn lại (triết lý, quy trình làm sản phẩm, AI của Asana, so sánh) là bối cảnh giải thích, không tạo thêm việc. Số đo và quyết định giao diện của QCET nằm ở [DESIGN.md](../../DESIGN.md); nguyên lý UX chung (Fitts, Hick, Gestalt…) ở [WORLD_CLASS_UI_UX_PRINCIPLES.md](WORLD_CLASS_UI_UX_PRINCIPLES.md). Số đo cụ thể của Linear (màu, chữ, bo góc, khoảng cách, bóng, chuyển động) và bảng đối chiếu QCET ở [LINEAR_DESIGN_TOKENS.md](LINEAR_DESIGN_TOKENS.md).

**Cách đọc nguồn**

- Mặc định mỗi ý dẫn về **nguồn chính thức**: trang của công ty (linear.app, asana.com, help.asana.com), blog thiết kế của công ty, hoặc bài/phát biểu của người sáng lập và nhân viên đăng dưới tên công ty.
- Mục có nhãn **Phân tích bên ngoài** là diễn giải của bên thứ ba (reverse-engineering, blog, portfolio cựu nhân viên). Dùng để hiểu thêm, không coi là lời của Linear/Asana.
- Ngày ghi trong ngoặc là ngày đăng. Nguyên tắc cũ (Asana 2013, 2015) vẫn là nền tảng được trích lại nhiều, nhưng giao diện hiện tại có thể đã khác.

## Mục lục

1. [Linear](#1-linear)
2. [Asana](#2-asana)
3. [So sánh nhanh](#3-so-sánh-nhanh)
4. [Bài học rút ra chung](#4-bài-học-rút-ra-chung)
5. [Nguồn](#5-nguồn)

---

## 1. Linear

### 1.1. Triết lý sản phẩm (Linear Method)

Linear công bố bộ nguyên tắc nền tảng trong [Linear Method – Principles & Practices](https://linear.app/method/introduction). Các nguyên tắc ảnh hưởng trực tiếp tới UI/UX:

| Nguyên tắc | Ý chính |
|---|---|
| **Build for the creators** | Thiết kế cho người trực tiếp làm việc; giữ cá nhân làm việc hiệu quả quan trọng hơn sinh báo cáo hoàn hảo. |
| **Purpose-built** | Phần mềm năng suất phải được thiết kế cho một mục đích. Phần mềm linh hoạt để ai cũng tự chế quy trình "cuối cùng gây hỗn loạn khi đội lớn lên". |
| **Aim for clarity** | Không tự bịa thuật ngữ; "Projects should be called projects". |
| **Say no to busy work** | Công cụ không được bắt người dùng thành người thiết kế và bảo trì nó; loại bỏ hoặc tự động hóa "work around work". |
| **Simple first, then powerful** | Dễ bắt đầu, mạnh dần lên khi đội lớn lên. |
| **Decide and move on** | Không phải lúc nào cũng có đáp án tốt nhất; quan trọng là quyết rồi đi tiếp. |

Trang [README](https://linear.app/readme) gọi tên "kẻ thù" của phần mềm hiện đại: **Noise & Distraction** (thông báo, cảnh báo khiến ta tốn thời gian điều phối hơn làm việc) và **Uniform sameness** (sản phẩm thiếu cá tính, "mọi công ty đều thuê cùng một họa sĩ minh họa?"). Mục tiêu: công cụ "nhanh nhất trong loại của nó", "cực kỳ dễ dùng nhưng mạnh dần lên sau mỗi lần tương tác".

Trang chủ hiện tại nêu ba trụ cột: **Purpose-built**, **Powered by agents** ("Designed for workflows shared by humans and agents") và **Designed for speed** ("Reduces noise and restores momentum") ([linear.app](https://linear.app/)).

**Phần mềm có chính kiến (opinionated)**: theo phỏng vấn đồng sáng lập Jori Lallo trên [Figma Blog (29/5/2024)](https://www.figma.com/blog/the-linear-method-opinionated-software/):

- "Chúng tôi thiết kế để có **một cách thật tốt** để làm việc". Có thể không có một cách đúng duy nhất, nhưng luôn có **cách mặc định**.
- Không cần sổ tay hướng dẫn để bắt đầu dùng; dùng đơn vị công việc phổ quát (project, team) thay vì thuật ngữ riêng.
- Có chính kiến mạnh ở **cấp nguyên tử** (ví dụ chọn label và due date làm thuộc tính của issue); càng lên khái niệm lớn (project) càng lắng nghe phản hồi khách hàng nhiều hơn.
- Chủ động chấp nhận **product debt** ở chỗ ít ảnh hưởng trải nghiệm (Settings, display options, favorites) để dồn chất lượng cho phần cốt lõi.
- Không ngại thay đổi hay bỏ tính năng; khi đổi thì cho người dùng thông tin và công cụ để hiểu thay đổi.

### 1.2. Nguyên tắc thị giác: hai đợt làm lại giao diện

#### Đợt 2024: "A design reset"

**Vì sao làm lại** ([A design reset (part I), 27/3/2024](https://karrisaarinen.com/posts/a-design-reset/), Karri Saarinen, đăng gốc trên Linear):

- **Design debt là có thật.** Ship thay đổi nhỏ mỗi ngày thì sản phẩm mất cân bằng: mỗi năng lực mới đè thêm lên bề mặt vốn không được thiết kế cho nó. Sản phẩm phát triển nhanh nên trả nợ này mỗi 2–3 năm.
- **Trả nợ thiết kế theo đợt lớn**, khác với code (vốn tránh viết lại toàn bộ). Trải nghiệm là tổng thể và thị giác; sửa từng view một làm trải nghiệm rời rạc, và chỉ khi xét mọi nhu cầu cùng lúc mới cân lại được toàn bộ.
- Cần CEO đứng sau; bắt đầu bằng "concept car" (bản ý tưởng) để mọi người dễ nói "có" thay vì phản bác.

**Đã làm gì** ([How we redesigned the Linear UI (part II), 28/3/2024](https://www.linear.app/now/how-we-redesigned-the-linear-ui); [changelog](https://linear.app/changelog/2024-03-20-new-linear-ui)):

- Chỉnh sidebar, tabs, headers, panels để **giảm nhiễu thị giác, giữ thẳng hàng, tăng thứ bậc và mật độ** của phần điều hướng.
- **Căn thẳng nhãn, icon, nút theo cả chiều dọc và ngang** trong sidebar và tab: "không thấy ngay nhưng cảm được sau vài phút dùng".
- Khám phá bằng **độ mờ của đen và trắng** (opacity) để xác định quan hệ cao độ (elevation) và thứ bậc trước khi chọn màu.
- Bám chuẩn Apple để có cảm giác app native; điều hướng (back/forward, history, tabs) phải bỏ được khi chạy trong trình duyệt.
- **Hệ màu sinh từ LCH thay vì HSL**: trong LCH, đỏ và vàng cùng độ sáng 50 trông sáng ngang nhau với mắt người, nên theme sinh ra đều đẹp bất kể màu gốc. Mỗi theme từ **98 biến tay xuống 3 biến: base color, accent color, contrast**.
- **Contrast là một biến đầu vào**: tự sinh theme tương phản rất cao cho người cần (lý do accessibility).
- Giảm lượng "chrome" xanh trong phép tính màu để có vẻ **trung tính, bền theo thời gian**; chữ và icon trung tính đậm hơn ở light mode, sáng hơn ở dark mode để nội dung nổi hơn khung.
- Bố cục có cấu trúc: header phụ chứa filter và display options, side panel chứa thuộc tính, các chế độ hiển thị list, board, timeline, split, fullscreen.
- Quy trình: stress test hướng mới trên các view chính (Inbox, Triage, My Issues, Project, Cycles, Roadmap, Search) → **viết định nghĩa hành vi** cho sidebar, tabs, app header, view header → bật bằng feature flag nội bộ → private beta → mở dần theo % workspace mỗi ngày → GA.

#### Đợt 2026: "A calmer interface for a product in motion"

Theo [bài viết 12/3/2026](https://linear.app/now/behind-the-latest-design-refresh) và [changelog](https://linear.app/changelog/2026-03-12-ui-refresh). Đợt này mới hơn và thay thế đợt 2024 về bảng màu mặc định.

- **Vấn đề**: phần mềm hiếm khi tệ đi một lúc; nó méo dần qua từng tính năng hữu ích (thêm control, thêm trạng thái, thêm ngoại lệ). Ví dụ: các thao tác Share, Copy link, Open PR trên header không còn nằm ở chỗ đoán trước được. Việc chính là **tỉa gọn các cạnh của sản phẩm**.
- **Mục tiêu**: giữ mật độ thông tin dày mà không làm giao diện ngợp; trải nghiệm phải "familiar and fluid".

Hai nguyên tắc được đặt tên:

1. **"Don't compete for attention you haven't earned"** (Đừng tranh sự chú ý mà mình chưa xứng có). Không phải phần tử nào cũng nặng ngang nhau: phần phục vụ nhiệm vụ chính giữ tiêu điểm, phần định hướng và điều hướng lùi lại.
   - Sidebar **tối đi vài nấc** để vùng nội dung chính nổi lên.
   - Tab trên desktop gọn hơn, không trải hết bề ngang, bo góc, icon và chữ nhỏ hơn, có tab chỉ icon.
   - **Giảm số icon, thu nhỏ icon**, bỏ xử lý thừa như nền màu sau icon team.
2. **"Structure should be felt not seen"** (Cấu trúc nên được cảm nhận, không phải nhìn thấy). Đường viền và vạch chia đã sinh sôi "không rõ lý do"; đợt này **bớt vạch chia, bo cạnh, giảm tương phản viền**.

Thay đổi khác:

- Header, điều hướng, view controls **thống nhất** giữa projects, issues, reviews, documents.
- Bảng màu mặc định chuyển từ xám xanh lạnh sang **xám ấm hơn, ít bão hòa nhưng vẫn sắc**; ấm quá thì "đục".
- Công cụ: dev toolbar bật/tắt feature flag để so bản cũ/mới bằng một cú bấm; công cụ màu chỉnh hue/chroma/lightness từng design token, xuất JSON nhập thẳng vào Figma để thiết kế và code cùng một nguồn.
- Thước đo thành công: "Nếu phần lớn người dùng không nhận ra ngay điều gì đã đổi, có lẽ đó là dấu hiệu tốt". Phần lớn điều làm phần mềm dễ chịu là thứ người dùng không thấy: lỗi không gặp, vết xước nhỏ đã được làm phẳng, hiệu năng không bao giờ chậm.

### 1.3. Tương tác: tốc độ, bàn phím, chi tiết vô hình

**Bàn phím là đường chính, chuột vẫn đầy đủ** ([Tips for joining your team](https://linear.app/docs/joining-your-team-on-linear); [Intro to Linear](https://linear.app/learn/intro-to-linear)):

- Phím tắt điều khiển mọi chức năng phổ biến và phần lớn chức năng ít dùng. Ví dụ: `?` mở trợ giúp, `/` tìm kiếm, `C` tạo issue, `Cmd/Ctrl+/` xem danh sách phím tắt.
- **`Cmd/Ctrl+K` (command menu) là phím quan trọng nhất**: "Nếu muốn làm gì mà không biết cách, hãy tìm trong command menu."
- **Peek**: rê chuột lên issue/project trong list hoặc board rồi nhấn `Space` để xem nhanh chi tiết.
- Editor: gõ hoặc dán Markdown tự chuyển thành rich text; bôi chữ hiện toolbar định dạng; `/` mở slash command ([Editor](https://linear.app/docs/editor)).

**"Invisible details": menu ngữ cảnh** ([Linear Now, 17/9/2020](https://www.linear.app/now/invisible-details)):

- Menu chuột phải cho phép làm **gần như mọi thao tác** trên issue (status, priority, assignee, estimate, cycle, project, copy git branch, archive).
- **Menu ngữ cảnh dạy phím tắt**: mỗi mục hiện phím tắt tương ứng, nên người dùng chuột học dần cách dùng bàn phím.
- **Safe triangle cho submenu**: vẽ vùng tam giác an toàn giữa con trỏ và submenu để di chuột chéo (đường ngắn nhất) mà submenu không đóng. Lý do: chỉ chậm 1–2 giây mỗi lần, nhưng có người thao tác hàng trăm lần mỗi ngày, cộng thêm bực bội khi menu biến mất.
- Tinh thần: chi tiết người dùng "không thấy, không nghĩ tới, nhưng cảm được".

#### Phân tích bên ngoài (không phải lời Linear)

- Tốc độ của Linear đến từ kiến trúc **sync engine local-first**: dữ liệu nằm trong IndexedDB của trình duyệt, thay đổi áp dụng ngay vào bộ nhớ (optimistic), server chỉ xác nhận; mỗi thuộc tính là một observable nên cập nhật chỉ vẽ lại đúng ô bị đổi. Hệ quả UX: gần như không có spinner khi thao tác ([performance.dev](https://performance.dev/how-is-linear-so-fast-a-technical-breakdown); [Rubén Sospedra](https://sospedra.me/papers/server-is-a-cache), tổng hợp từ các bài nói công khai của Tuomas Artman).
- Cùng nguồn performance.dev nhận định animation chạy trên GPU, thời lượng dưới ngưỡng nhân quả 100ms, không animate thuộc tính gây layout. Token trong bundle app lại là 100/250/350ms, tô sáng hiện 0s và mờ 150ms ([LINEAR_DESIGN_TOKENS.md](LINEAR_DESIGN_TOKENS.md#6-chuyển-động-b)), nên "dưới 100ms" chỉ đúng với phản hồi tô sáng, không đúng với mọi chuyển động.
- Các bài tổng hợp như [Blake Crosley](https://blakecrosley.com/guides/design/linear) và [frontenddesignbasics](https://frontenddesignbasics.vercel.app/docs/cases/linear-redesign) nêu thêm "dark mode là trải nghiệm chính", "Inter Display cho tiêu đề, Inter cho phần còn lại", phím tắt dễ nhớ (S = Status, P = Priority).
  - Phím tắt `S`, `P` khớp với menu đo được.
  - CSS hiện tại chỉ khai báo `Inter Variable` kèm `"opsz" auto`, nên dáng Display ở cỡ lớn đến từ trục optical size, không phải một font riêng.
  - "Dark là trải nghiệm chính" chưa có căn cứ: website mặc định tối, nhưng app mặc định theo hệ điều hành (chế độ `system`); tài khoản dùng để đo đang để Light.

### 1.4. Chất lượng như một quy trình

- **"Quality is our first principle"**: mọi số đo và quyết định khác đi sau ([First Round Review, phỏng vấn Karri Saarinen](https://review.firstround.com/linears-path-to-product-market-fit/)).
- **Quality Wednesdays** ([Tuomas Artman, 13/8/2025](https://linear.app/now/quality-wednesdays)): bắt nguồn từ một bài tập năm 2023 khi không ai trong đội nhận ra lỗi tương tác hover của ba nút. Rút ra:
  - **Chất lượng không phải môn thể thao cá nhân**: khó thấy lỗi nhỏ trên UI mình tự làm; mỗi người nhận ra một lỗi khác nhau.
  - Mỗi kỹ sư sửa **một lỗi chất lượng nhỏ mỗi tuần**, thường ≤ 30 phút, không quá khoảng 1 giờ, để duy trì được như thói quen.
  - Chỗ hay tìm ra lỗi: menu Preferences, điều hướng bằng bàn phím, accessibility, và **thu hẹp cửa sổ trình duyệt để xem control nào vỡ**.
  - Hơn 1.000 lỗi nhỏ đã sửa trong hai năm ([Designing remote work at Linear, 29/10/2025](https://karrisaarinen.com/posts/designing-remote-work-at-linear/)).
- **Cách Linear giữ chất lượng** ([Why is quality so rare?, 27/5/2025](https://linear.app/now/why-is-quality-so-rare)):
  - Hỏi "điều này có tăng chất lượng không?" chứ không chỉ "có ship nhanh hơn không?".
  - Trực giác và khách hàng hơn số liệu.
  - Đội nhỏ 3–5 người tự phán đoán.
  - **Không bàn giao kiểu dây chuyền**: cả đội cùng lặp tới khi đúng.
  - **MVP chỉ dùng nội bộ**, không ship trải nghiệm dở cho khách.
  - **Zero bugs policy**: lỗi sửa trong 7 ngày.
- **10 quy tắc của Karri Saarinen** ([Figma Blog, 18/3/2025](https://www.figma.com/blog/karri-saarinens-10-rules-for-crafting-products-that-stand-out/)), những ý liên quan UI/UX:
  - Spec là **mức tối thiểu, không phải đích**.
  - Chất lượng không phải hoàn hảo: được thô ở bản nội bộ, nhưng không cho khách thấy trước khi qua ngưỡng chất lượng.
  - **Thiết kế tốt nhất là có chính kiến**: thiết kế cho một người cụ thể; sản phẩm cho mọi người thì không giỏi việc gì.
  - **Cách đơn giản nhất để tăng chất lượng là giảm phạm vi**: làm một phần thật tốt thay vì làm hết một cách tạm bợ.
  - Dữ liệu có thể là cái nạng: Linear không quyết bằng A/B test; phải luyện và tin trực giác.
- **Thiết kế trong quy trình** ([Manage design projects](https://linear.app/method/manage-design-projects)):
  - Việc thiết kế đầu tiên là **xác minh vấn đề**: người dùng xin "tính năng X" dựa trên cách họ hiểu vấn đề Y.
  - Giai đoạn khám phá tự do, chưa phán xét tính khả thi.
  - Xin góp ý sớm và nói rõ cần góp ý loại nào (tổng thể hay chi tiết).
  - Kỹ sư tham gia từ trước khi chốt hướng.
- **Giải quyết vấn đề, không phải tính năng** ([Build with users](https://linear.app/method/build-with-users)): khi người dùng xin tính năng, hỏi lại use case và vấn đề thật. Viết issue ngắn bằng ngôn ngữ thường thay vì user story; thảo luận trải nghiệm ở cấp sản phẩm, không ở cấp task ([Write issues not user stories](https://linear.app/method/write-issues-not-user-stories)).

---

## 2. Asana

### 2.1. Sáu nguyên tắc thiết kế (2013)

Bộ nguyên tắc chính thức đầu tiên ([Developing Design Principles, 3/10/2013](https://asana.com/inside-asana/design-principles)). Mục tiêu khi viết: đủ cụ thể để phân biệt Asana với sản phẩm khác và giúp ra quyết định, đủ rộng để áp dụng cho cả sản phẩm.

| # | Nguyên tắc | Diễn giải chính thức |
|---|---|---|
| 1 | **Allow users to focus on their work without interference** | Người dùng làm chủ sự tập trung; chỉ làm phân tâm bằng thay đổi liên quan trực tiếp đến họ. |
| 2 | **Increase confidence through clarity** | Trong ứng dụng và trong đội, việc gì đang xảy ra và vì sao phải rõ ràng, không mơ hồ. |
| 3 | **Foster productive and emotionally satisfying interpersonal dynamics** | Người dùng thấy mình là một phần của đội, tin nhau làm phần việc của mình và cùng tiến về một mục tiêu. |
| 4 | **Design for fast, effortless, and intentional interactions** | Việc đơn giản, thường gặp phải trơn tru và hiển nhiên; việc phức tạp phải hiệu quả và dễ chịu. **Nhưng tốc độ không được dẫn tới sai sót.** |
| 5 | **Empower everyone through progressive discoverability** | Ở mọi mức kinh nghiệm, ai cũng thấy mình biết dùng sản phẩm, bất kể dùng bao nhiêu tính năng. |
| 6 | **Be consistent and standard, and innovate when it's worth it** | Asana phải vừa quen thuộc vừa hiện đại. |

Năm 2020 đội Product Design đăng thêm một "North Star" ([Asana Design, 18/9/2020](https://medium.com/asana-design/asana-product-designs-north-star-c6c65fee6119)), nhưng nội dung là ảnh poster nên chưa trích được.

### 2.2. "Clarity & Energy": ngôn ngữ thị giác (2015)

Đợt làm lại sản phẩm và nhận diện năm 2015 ([Teamwork is beautiful](https://asana.com/inside-asana/teamwork-is-beautiful-introducing-asanas-new-look); [The new Asana](https://asana.com/inside-asana/the-new-asana); [Learnings from redesigning Asana, 9/10/2015](https://medium.com/building-asana/finding-clarity-and-energy-de61d3df0cef); [Circling Ourselves, 1/10/2015](https://medium.com/building-asana/circling-ourselves-the-story-behind-asana-s-rebrand-e8247516705a)):

- **"Clarity punctuated by energy"**:
  - *Clarity*: cảm giác nắm được việc, biết chính xác cần làm gì; một **nền trắng sạch** cho công việc.
  - *Energy*: cảm giác tiến lên. Màu và chuyển động **chỉ bùng lên ở khoảnh khắc hành động và hoàn thành**, "không bao giờ làm gián đoạn sự tập trung".
- **Màu có ngữ nghĩa**: coral cho tạo mới, xanh dương cho hành động, xanh lá cho hoàn thành. Màu được dành cho thao tác chính và những khoảnh khắc đáng nhấn.
- Phương án "Daily Flow" (nền đổi màu theo giờ trong ngày) bị loại: màu bão hòa lấn át màu có ý nghĩa trong sản phẩm nên **làm giảm độ rõ ràng**. Mỗi phương án được kiểm lại theo bốn thuộc tính thương hiệu: Approachable, Quirky, Empowering, Purposeful.
- **Kỳ lân ăn mừng có bằng chứng**: bật mặc định cho một nhóm workspace mới thì nhiều người dùng Asana và cộng tác với đồng đội hơn. Niềm vui được dùng có chủ đích như động lực, không phải trang trí. Hiện nay đây là tùy chọn trong Display settings ([Cause for celebration, 20/7/2023](https://medium.com/asana-design/cause-for-celebration-dd4cfbb01fa0)).
- **Nội dung tập trung**: tăng khoảng trắng để đọc và viết dễ chịu dù trang nhiều nội dung; hệ chữ mới tăng tương phản giữa các cấp tiêu đề. **Empty state** trở thành lúc hướng dẫn và tạo thiện cảm, không để trống.
- **Điều hướng và bố cục**:
  - Top bar luôn hiện; nút tạo nhanh (Quick Add) ở cấp cao nhất để ghi ý tưởng từ bất cứ đâu.
  - Header full-width với tab làm khung mở rộng được cho các view (list, calendar, conversations…).
  - **Tính năng nâng cao chỉ mở ra dần khi cần.**
- **Cách làm**:
  - Đặt chỉ số thành công từ đầu (chỉ số cộng tác như số bình luận).
  - Ra mắt thay đổi cấu trúc từng bước, nhưng ra mắt hệ thị giác (font, màu) một lần vì "tổng thể lớn hơn tổng các phần".
  - **Chốt từng style vào style guide** để tránh vòng lặp vô tận; gom designer các mảng ngồi chung để nhất quán.
- **Biến đối tượng thành "vật"**: task, danh sách, cuộc trò chuyện thành thẻ giống tờ giấy để người dùng thấy ranh giới từng đối tượng. Thiết kế flat quá thì thiếu gợi ý tương tác; cần cân bằng ([Warcos, 24/11/2016](https://medium.com/building-asana/the-simple-beautiful-thing-that-inspired-asana-to-be-more-attractive-bb4031a47909)).

### 2.3. Bài học điều hướng

- **Ba ngăn** ([The new collapsible left pane](https://asana.com/inside-asana/leftpane)):
  - Bố cục: trái điều hướng, giữa danh sách task, phải chi tiết task.
  - Người mới: ẩn ngăn phải để tập trung nhập danh sách.
  - `Tab+X` chỉ hiện ngăn task để tập trung từng việc.
  - Màn hình nhỏ: tự thu gọn ngăn trái.
- **Bấm thay vì rê chuột** (cùng nguồn): bản đầu mở ngăn trái khi rê chuột, nhưng cú rê vô tình làm ngăn trượt ra, gây khó chịu. Bản sau phải bấm mới mở. Asana "không coi nhẹ việc bắt người dùng bấm thêm", nên bù bằng cách giảm số lần phải chuyển chế độ. Animation được làm prototype bằng CSS/JS trước khi tốn công kỹ sư.
- **Luôn có đường lui**: một lần đổi sidebar (tự thu gọn, sắp project theo tần suất dùng) bị phản hồi xấu. Asana thêm liên kết quay lại bản cũ và thừa nhận bản mới "không đáp ứng nhu cầu của mọi người" ([A better way to access projects and teams](https://asana.com/inside-asana/more-navigation-improvements)).
- **Đợt 2023** ([Asana Forum, 10/2/2023](https://forum.asana.com/t/coming-soon-asana-redesign-to-help-you-find-what-you-need-quickly-and-easily/335710)): xuất phát từ phản hồi "Asana lộn xộn, khó điều hướng khi việc nhiều lên".
  - Sidebar kéo thả, gắn sao, đổi rộng được.
  - Ô tìm kiếm đưa lên giữa top bar, có quick filter.
  - Sắp xếp và lọc nhiều tiêu chí; theme sáng/tối.
- **Đợt thử 2025–2026** ([Asana Forum, 27/10/2025, cập nhật 11/8/2026](https://forum.asana.com/t/asanas-new-navigation-experience/1104749)): sidebar chia theo **chế độ làm việc** (Work, Plan, Workflow, Company) để mỗi tính năng có chỗ và giảm phân tâm. Người dùng phản hồi chữ nhỏ hơn, thừa khoảng trống, muốn thu gọn linh hoạt hơn. Thiết kế cuối chưa chốt.
- **Khả năng khám phá** ([Designing Timeline, 18/12/2018](https://medium.com/asana-design/designing-timeline-lessons-learned-from-our-journey-beyond-gantt-charts-645e80177aaa)): bản beta cho thấy người dùng không phát hiện được thao tác kéo mép task để đổi hạn. Trước ngày ra mắt, đội ưu tiên làm cho UI dễ hiểu, dễ dùng hơn là thêm tính năng phân loại.

### 2.4. Bàn phím

Theo [Asana keyboard shortcuts](https://help.asana.com/s/article/keyboard-shortcuts) và [Save time in Asana](https://help.asana.com/s/article/save-time-in-asana):

- Asana được thiết kế để "làm việc thay vì làm **work about work**", cùng tinh thần với "Say no to busy work" của Linear.
- **Mô hình `Tab` + chữ cái**, chữ gợi đúng tính năng: `Tab+Q` tạo nhanh, `Tab+M` giao cho tôi, `Tab+D` hạn, `Tab+S` subtask, `Tab+X` chế độ tập trung, `Tab+/` tìm kiếm.
- Trong danh sách:
  - `Enter` tạo task mới ngay dưới, `Shift+Enter` tạo phía trên.
  - `Cmd/Ctrl+Enter` hoàn thành task.
  - `Cmd/Ctrl+↑/↓` di chuyển task.
  - **Dán nhiều dòng thành nhiều task.**
- Inbox: `J/K` lên/xuống, `E`/`I` lưu trữ.
- `Esc` đóng chi tiết; `Cmd/Ctrl+/` mở danh sách phím tắt ("phím tắt cho phím tắt").

### 2.5. Accessibility và hệ token

- **Cam kết accessibility** ([Asana Accessibility](https://asana.com/accessibility)):
  - Lộ trình nhiều năm hướng tới **WCAG 2.2 AA**.
  - **Color-blind mode** ánh xạ lại bảng màu và **in đậm ngày trễ hạn**, nên trạng thái không chỉ dựa vào màu.
  - Có dark mode, zoom chữ không mất chức năng, **chỉnh được thời lượng thông báo tạm** (toast), link "Skip to main content".
  - Hỗ trợ đầy đủ NVDA trên Chrome; thử nghiệm với người dùng công nghệ hỗ trợ thật (JAWS, NVDA, VoiceOver, phóng to màn hình) qua Fable.
  - Phần lớn tính năng cơ bản dùng được chỉ bằng bàn phím.
- **Dark mode bằng design token** ([Schema 2021, đội Design Systems Asana](https://www.youtube.com/watch?v=ylDed18OVdY)):
  - Đảo ngược 7 mức xám của light mode thì thất bại, vì tương phản giữa nền và banner, chữ và nền quá gắt.
  - Cách sửa: tăng lên 9 mức và **tách riêng bảng light và dark**.
  - Bước nhảy tương phản cho trạng thái hover/active **phụ thuộc độ sáng của màu**: màu tối (xanh dương, xanh lá, xám) cần bước nhảy lớn hơn màu sáng (hồng, cam) để mắt thấy khác biệt như nhau.
  - Token là nguồn sự thật duy nhất cho cả design và code; đội design system có số designer và kỹ sư gần bằng nhau.

### 2.6. AI (2023–2026)

**Năm nguyên tắc AI lấy con người làm trung tâm** ([Asana AI Principles](https://asana.com/ai-principles), công bố 6/2023):

1. **AI giúp con người đạt mục tiêu.** "Con người luôn chọn đích đến; AI giúp đi tới đó."
2. **Thiết kế cho đội người + AI.**
3. **Con người chịu trách nhiệm về quyết định.** AI hỗ trợ ra quyết định; người dùng có quyền chọn và kiểm soát vai trò của AI.
4. **An toàn trong ngắn hạn và dài hạn.**
5. **Minh bạch trong cách làm và trong sản phẩm.** AI và con người cùng phơi bày suy nghĩ và giả định để xây niềm tin.

**AI Teammates: trách nhiệm ở cấp hành động** ([AI Agents Built for Teams](https://asana.com/inside-asana/ai-agents-built-for-teams-context-transparency/)):

- **Năng lực của AI khớp với một người dùng**: được giao task, đọc và viết bình luận, xuất hiện trong cùng activity feed.
- **Quyền truy cập bị chặn bởi quyền của người kích hoạt**: cộng tác với AI không bao giờ nâng quyền ai.
- Có chỉ báo thời gian thực khi AI đang làm và **nhật ký hành động** (task tạo, bình luận, tìm kiếm, đối tượng bị sửa).
- **Phải được người dùng duyệt rõ ràng trước thao tác nhạy cảm về quyền riêng tư.**
- Kết quả hiện cho cả đội có quyền, không chỉ người gọi AI.
- Asana cho rằng trách nhiệm cụ thể (hành động nhìn thấy được, bộ nhớ kiểm tra được, cổng duyệt) có giá trị hơn lời hứa chung chung về "giải thích được".

#### Phân tích bên ngoài (portfolio cựu nhân viên)

- Ngôn ngữ thiết kế 2014–15: tài liệu hóa pattern giúp feedback chuyển từ sở thích cá nhân sang luồng và trải nghiệm. Nhiều việc rút từ vài ngày xuống vài giờ; kỹ sư không cần redline cho từng màn ([Stephanie Hornung](https://dehfne.com/work/design-language.html)).
- Đội design system: audit component, ưu tiên theo tác động, làm lại hệ màu cho accessibility, quy trình cân giữa nhất quán và tốc độ của đội tính năng ([Renée Padgham](https://www.reneepadgham.com/projects/asana-design-system)).
- List view 2019 thiết kế để "lấy phần tốt nhất của bảng tính mà vẫn dễ dùng như danh sách việc"; Task details 2019 thống nhất tương tác và module hoán đổi được; refresh thị giác 2022; dark mode bằng token 2021 ([Paul Velleux](https://read.cv/velleux)).

---

## 3. So sánh nhanh

| Khía cạnh | Linear | Asana |
|---|---|---|
| Người dùng chính | Đội làm sản phẩm phần mềm; "build for the creators" | Mọi đội trong tổ chức, nhiều mức kinh nghiệm |
| Độ linh hoạt | Có chính kiến, một cách mặc định tốt; tránh để mỗi đội tự chế quy trình | Nhiều view (list, board, timeline, calendar); khám phá dần |
| Mật độ | Dày nhưng "không ngợp"; phần điều hướng lùi lại cho nội dung | Nền trắng, khoảng trắng rộng hơn cho đọc/viết; thu gọn ngăn khi cần |
| Màu | Trung tính, ít chrome; theme sinh từ LCH với 3 biến; 2026 chuyển sang xám ấm | Nền trắng + màu có ngữ nghĩa (coral/xanh dương/xanh lá) chỉ ở khoảnh khắc hành động |
| Cấu trúc thị giác | "Structure should be felt not seen": ít viền, căn thẳng hàng | Thẻ như "vật" để rõ ranh giới; header full-width + tab |
| Bàn phím | `Cmd+K` là cửa vào mọi thao tác; phím một chữ; menu chuột phải dạy phím tắt | `Tab` + chữ cái; `Cmd+/` xem phím tắt |
| Niềm vui | Cảm giác nhanh, mượt; chi tiết "vô hình" | Sinh vật ăn mừng (có thử nghiệm chứng minh), có thể tắt |
| Accessibility | Biến contrast sinh theme tương phản cao; Quality Wednesdays rà bàn phím, a11y | Cam kết WCAG 2.2 AA, color-blind mode, test với người dùng công nghệ hỗ trợ |
| Ra quyết định | Trực giác + khách hàng; không A/B test, không OKR | Chỉ số thành công đặt từ đầu (chỉ số cộng tác); thử nghiệm (kỳ lân, điều hướng) |
| Thay đổi lớn | Trả design debt theo đợt lớn mỗi 2–3 năm; feature flag → beta → mở dần | Cấu trúc ra từng bước, hệ thị giác ra một lần; giữ đường lui khi phản hồi xấu |
| AI | Agents là "teammates" trong workflow chung | 5 nguyên tắc AI; AI hành xử như một thành viên, bị chặn quyền, có nhật ký và cổng duyệt |

## 4. Bài học rút ra chung

Phần tổng hợp chung của hai bên. Đã thành quy tắc QCET (duyệt 22/10/2026) ở mục "Nguyên tắc UI/UX rút từ Linear và Asana" của [AGENTS.md](../../AGENTS.md); mục 9 (quy trình chất lượng) giữ làm bối cảnh.

1. **Tiêu điểm thuộc về nội dung.** Linear làm tối sidebar để "không tranh sự chú ý chưa xứng"; Asana chỉ làm phân tâm bằng thay đổi liên quan tới người dùng. Phần điều hướng và khung phải lùi lại.
2. **Màu và chuyển động là tín hiệu, không phải trang trí.** Asana dành màu cho tạo/hành động/hoàn thành; Linear giảm chrome xanh, bớt icon và nền màu.
3. **Cấu trúc bằng căn hàng và khoảng cách trước, đường kẻ sau.** Viền và vạch chia dễ sinh sôi "không rõ lý do".
4. **Nhanh nhưng không sai.** Linear coi tốc độ là trụ cột; Asana nhấn "speed should not lead to inaccuracies".
5. **Bàn phím cho người thạo, chuột vẫn đủ cho người mới, và giao diện dạy dần phím tắt** (menu chuột phải, tooltip, `Cmd+/`).
6. **Khám phá dần.** "Simple first, then powerful" (Linear) và "progressive discoverability" (Asana): dễ bắt đầu, sâu dần khi cần.
7. **Rê chuột là tín hiệu yếu.** Linear dùng safe triangle cho submenu; Asana bỏ mở ngăn bằng rê chuột vì cú rê vô tình.
8. **Không tự chế thuật ngữ; nhất quán vị trí thao tác.** Lý do của đợt 2026 là thao tác trên header không còn nằm ở chỗ đoán trước được.
9. **Chất lượng là thói quen của cả đội**: sửa lỗi nhỏ hằng tuần, zero-bug, thu hẹp trình duyệt để tìm control vỡ, giảm phạm vi để giữ chất lượng.
10. **AI phải nhìn thấy được và chịu trách nhiệm được**: con người quyết, AI không vượt quyền người gọi, có nhật ký và cổng duyệt trước thao tác nhạy cảm.

Liên hệ QCET: AGENTS.md và DESIGN.md đã chốt thang kích thước "kiểu Linear" (chữ 13px, hàng bảng Nhiệm vụ 48px, control 28px…) và quy tắc hành vi menu, hộp thoại. Tài liệu này giải thích nguyên tắc gốc đằng sau các lựa chọn đó và quy tắc trong AGENTS.md; khi khác nhau, AGENTS.md và DESIGN.md thắng.

---

## 5. Nguồn

### Linear (chính thức)

- [Linear Method – Practices for building](https://linear.app/method)
- [Principles & Practices](https://linear.app/method/introduction)
- [Write issues not user stories](https://linear.app/method/write-issues-not-user-stories)
- [Manage design projects](https://linear.app/method/manage-design-projects)
- [Build with users](https://linear.app/method/build-with-users)
- [README](https://linear.app/readme)
- [Linear homepage](https://linear.app/)
- [A design reset (part I), 27/3/2024](https://karrisaarinen.com/posts/a-design-reset/)
- [How we redesigned the Linear UI (part II), 28/3/2024](https://www.linear.app/now/how-we-redesigned-the-linear-ui)
- [Welcome to the new Linear (changelog), 27/3/2024](https://linear.app/changelog/2024-03-20-new-linear-ui)
- [A calmer interface for a product in motion, 12/3/2026](https://linear.app/now/behind-the-latest-design-refresh)
- [UI refresh (changelog), 12/3/2026](https://linear.app/changelog/2026-03-12-ui-refresh)
- [Invisible details – Building contextual menus, 17/9/2020](https://www.linear.app/now/invisible-details)
- [Tips for joining your team on Linear](https://linear.app/docs/joining-your-team-on-linear)
- [Intro to Linear](https://linear.app/learn/intro-to-linear)
- [Editor](https://linear.app/docs/editor)
- [Quality Wednesdays, 13/8/2025](https://linear.app/now/quality-wednesdays)
- [Why is quality so rare?, 27/5/2025](https://linear.app/now/why-is-quality-so-rare)
- [Designing remote work at Linear, 29/10/2025](https://karrisaarinen.com/posts/designing-remote-work-at-linear/)

### Linear (phỏng vấn, bài của người sáng lập trên trang khác)

- [Karri Saarinen's 10 rules for crafting products that stand out, Figma Blog, 18/3/2025](https://www.figma.com/blog/karri-saarinens-10-rules-for-crafting-products-that-stand-out/)
- [The Linear Method: Opinionated Software, Figma Blog, 29/5/2024](https://www.figma.com/blog/the-linear-method-opinionated-software/)
- [Linear's Path to Product-Market Fit, First Round Review](https://review.firstround.com/linears-path-to-product-market-fit/)

### Linear (phân tích bên ngoài)

- [How's Linear so fast? A technical breakdown, performance.dev](https://performance.dev/how-is-linear-so-fast-a-technical-breakdown)
- [The server is just a cache, Rubén Sospedra](https://sospedra.me/papers/server-is-a-cache)
- [Linear: The New Standard for Software Design, Blake Crosley](https://blakecrosley.com/guides/design/linear)
- [Linear: redesigning a dense dark UI, frontenddesignbasics](https://frontenddesignbasics.vercel.app/docs/cases/linear-redesign)

### Asana (chính thức)

- [Developing Design Principles, 3/10/2013](https://asana.com/inside-asana/design-principles)
- [Teamwork is beautiful: Introducing Asana's new look](https://asana.com/inside-asana/teamwork-is-beautiful-introducing-asanas-new-look)
- [The new Asana](https://asana.com/inside-asana/the-new-asana)
- [Learnings from redesigning Asana, 9/10/2015](https://medium.com/building-asana/finding-clarity-and-energy-de61d3df0cef)
- [Circling Ourselves: The Story Behind Asana's Rebrand, 1/10/2015](https://medium.com/building-asana/circling-ourselves-the-story-behind-asana-s-rebrand-e8247516705a)
- [The simple beautiful thing that inspired Asana to be more attractive, 24/11/2016](https://medium.com/building-asana/the-simple-beautiful-thing-that-inspired-asana-to-be-more-attractive-bb4031a47909)
- [Designing Timeline, 18/12/2018](https://medium.com/asana-design/designing-timeline-lessons-learned-from-our-journey-beyond-gantt-charts-645e80177aaa)
- [Asana Product Design's North Star, 18/9/2020](https://medium.com/asana-design/asana-product-designs-north-star-c6c65fee6119)
- [Cause for celebration, 20/7/2023](https://medium.com/asana-design/cause-for-celebration-dd4cfbb01fa0)
- [The new collapsible left pane](https://asana.com/inside-asana/leftpane)
- [A better way to access projects and teams](https://asana.com/inside-asana/more-navigation-improvements)
- [Coming soon: Asana redesign (Forum), 10/2/2023](https://forum.asana.com/t/coming-soon-asana-redesign-to-help-you-find-what-you-need-quickly-and-easily/335710)
- [Asana's new navigation experience (Forum), 27/10/2025](https://forum.asana.com/t/asanas-new-navigation-experience/1104749)
- [Public Commitment to Accessibility](https://asana.com/accessibility)
- [Asana keyboard shortcuts](https://help.asana.com/s/article/keyboard-shortcuts)
- [Save time in Asana](https://help.asana.com/s/article/save-time-in-asana)
- [Design Tokens on Asana's Design Systems Team, Schema 2021](https://www.youtube.com/watch?v=ylDed18OVdY)
- [Asana AI Principles](https://asana.com/ai-principles)
- [AI Agents Built for Teams](https://asana.com/inside-asana/ai-agents-built-for-teams-context-transparency/)

### Asana (portfolio cựu nhân viên)

- [Asana design language, Stephanie Hornung](https://dehfne.com/work/design-language.html)
- [Asana Design System, Renée Padgham](https://www.reneepadgham.com/projects/asana-design-system)
- [Paul Velleux, read.cv](https://read.cv/velleux)
