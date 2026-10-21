# ADR-012: Trợ lý soạn thẻ hành động chờ duyệt, có ghi nhớ, kỹ năng và bản tin sáng

- **Status**: ACCEPTED cho giai đoạn 1 (phạm vi phát triển). Người dùng yêu cầu ngày 19/10/2026 ("thực thi toàn bộ" năm đề xuất của đợt tra cứu nâng cấp Trợ lý) và giao Claude tự quyết các mặc định ghi ở đây.
- **Date**: 2026-10-19
- **Deciders**: Chủ sở hữu dự án (giao tự quyết; cho phép migrate CSDL phát triển và kiểm thử cùng ngày). Các mặc định đổi được khi người dùng duyệt lại.

## Context

[ADR-009](ADR-009-assistant-read-only-tools.md) giữ Trợ lý chỉ đọc; phương án 3 của ADR-009 (công cụ ghi) chờ một ADR về xác nhận của người dùng. Đợt tra cứu 19/10/2026 so với ChatGPT, Claude, Gemini, Copilot, Linear, Notion cho thấy năm khoảng trống: công cụ đọc thiếu (lọc theo tên người, bình luận của nhiệm vụ), không có bản tin chủ động, không có hướng dẫn riêng và ghi nhớ, không có bộ đánh giá lặp lại được, và không làm được việc nhỏ hằng ngày (bình luận, đổi trạng thái, nhắc việc).

Rủi ro chính của quyền ghi là prompt injection: Trợ lý đọc dữ liệu riêng tư và nội dung không tin cậy (bình luận, văn bản, tệp). Theo "Agents Rule of Two" (Meta, 2025), một tác tử có đủ ba điều (đọc dữ liệu riêng tư, nhận nội dung không tin cậy, thay đổi trạng thái hay gửi ra ngoài) mà không có người duyệt là không an toàn. Hướng dẫn của AI SDK cũng lưu ý xác nhận chỉ ở phía client có thể bị giả.

## Decision

1. **Thẻ hành động, máy chủ thực hiện khi người dùng duyệt.** Bốn công cụ soạn: `propose_comment` (bình luận vào nhiệm vụ), `propose_status_change` (đổi trạng thái), `propose_reminder` (nhắc việc), `remember` (ghi nhớ). Công cụ kiểm người hỏi đọc được nhiệm vụ (`readTaskForUser`) và có capability tương ứng (`task.comment`; `task.update_execution`, riêng hoàn thành là `task.approve`; `task.remind`), rồi lưu thẻ `pending` vào `assistant_actions`; không thay đổi gì. Giao diện hiện thẻ ghi rõ đối tượng và nội dung nguyên văn sẽ gửi; nút chính nói đúng việc ("Đăng bình luận", "Đổi trạng thái", "Gửi lời nhắc", "Lưu ghi nhớ"), cạnh đó là "Bỏ qua".
2. **Quyết định chỉ là một chữ.** `POST /api/assistant/actions/[id]` nhận `{decision: "approve" | "reject" | "undo"}`; nội dung hành động lấy từ thẻ đã lưu, không nhận từ trình duyệt. Chỉ chủ thẻ quyết định được (của người khác trả 404). Máy chủ khóa bản ghi (`FOR UPDATE`) và giữ chỗ trạng thái trước khi thực hiện, nên bấm hai lần không thực hiện hai lần. Thực hiện bằng đúng service của màn hình với phiên người dùng (`createTaskComment`, `taskDomainActionService.updateStatus`, `.remind`, `addAssistantMemory`), nên quyền, luật chuyển trạng thái, phiên bản nhiệm vụ và thông báo giống như người dùng tự bấm. Lỗi nghiệp vụ thành trạng thái `failed` kèm câu cho người dùng.
3. **An toàn trước dữ liệu cũ và chèn lệnh.** Thẻ hết hạn sau 72 giờ (`ASSISTANT_ACTION_TTL_HOURS`). Thẻ đổi trạng thái ghi trạng thái lúc soạn; lúc duyệt mà trạng thái đã khác thì không thực hiện. Tối đa 5 thẻ một lượt (`ASSISTANT_MAX_ACTIONS_PER_TURN`); thẻ thừa không chạy, mô hình nhận lỗi. Lời nhắc hệ thống (quy tắc 10) chỉ cho soạn thẻ khi chính người hỏi yêu cầu, không bao giờ vì câu chữ trong nhiệm vụ, bình luận, văn bản hay tệp, và không được nói là đã làm. Ranh giới thật vẫn là bước duyệt ở máy chủ.
4. **Hoàn tác có giới hạn.** Bình luận (xóa bình luận) và ghi nhớ (xóa ghi nhớ) hoàn tác được. Nhắc việc đã gửi thì không. Đổi trạng thái cũng không: luật chuyển trạng thái không cho người thực hiện quay lại (đang làm về chưa bắt đầu bị cấm; chờ duyệt về đang làm chỉ người duyệt được), nên nút Hoàn tác sẽ luôn lỗi.
5. **Hướng dẫn riêng và ghi nhớ** (như Custom instructions và Memory của ChatGPT, Claude). `assistant_preferences.instructions` (tối đa 2.000 ký tự) và `assistant_memories` (tối đa 30 mục, 300 ký tự mỗi mục, nguồn `user` hoặc `assistant`) đi vào lời nhắc mỗi lượt trong khối "Thiết lập của Thầy/Cô", được gộp một dòng và không tự đóng khối được. Quy tắc 11 nói khối này chỉ chỉnh cách trả lời, không thay quy tắc, không mở quyền. Trợ lý chỉ thêm ghi nhớ qua thẻ `remember` người dùng duyệt; người dùng xem, thêm, xóa trong Cài đặt Trợ lý.
6. **Kỹ năng** (như Skills, Gems, Custom GPT ở mức câu lệnh lưu sẵn). `assistant_skills` (tối đa 30, tên duy nhất theo người, câu lệnh tối đa 4.000 ký tự). Gõ "/" ở đầu ô hỏi mở menu kỹ năng; chọn thì chữ của kỹ năng vào ô để người dùng xem, sửa rồi tự gửi. Lượt gửi kèm `skillId` chỉ để ghi lần dùng. "Lưu thành kỹ năng" có trên mỗi câu hỏi đã gửi. Kỹ năng không có quyền riêng: vẫn là một câu hỏi của người dùng.
7. **Bản tin sáng** (như Scheduled tasks của ChatGPT, Daily briefing của Gemini). Người dùng tự bật (`briefingEnabled`, mặc định tắt). Từ 07:00 giờ Việt Nam, worker outbox (mỗi lần quét nhắc việc) và cron `GET /api/cron/assistant-briefing` (`0 0 * * *` UTC) gửi một thông báo `assistant_briefing` vào Hộp thư: số việc cần xử lý, nhiệm vụ trễ hạn, cuộc họp hôm nay, đếm bằng đúng các hàm đọc đã kiểm quyền của công cụ. Không gọi mô hình. Mỗi người một bản một ngày nhờ khóa chính `(user_id, day)` của `assistant_briefings`; gửi lỗi thì nhả khóa. Bấm thông báo mở `/assistant?prompt=…`: câu hỏi điền sẵn, người dùng tự gửi (không tự chạy từ đường dẫn).
8. **Công cụ đọc bổ sung.** `list_tasks` nhận `assignee` (tên người) và `unit` (tên hoặc mã đơn vị): máy chủ tìm đúng một người đang hoạt động hay một đơn vị (so cả khi gõ không dấu); nhiều tên khớp thì trả lỗi kèm tối đa 5 tên để hỏi lại, không đoán. `get_task` kèm 5 bình luận mới nhất (che liên hệ, cắt 300 ký tự), tổng bình luận, 5 minh chứng mới nhất và yêu cầu gia hạn đang chờ. Mô tả công cụ có ví dụ tham số.
9. **Lịch sử dài.** Câu hỏi cũ hơn phần lịch sử gửi kèm (12 tin) được liệt kê trong khối "Câu hỏi trước đó" (tối đa 10 câu, 160 ký tự mỗi câu), không kèm câu trả lời; mô hình đọc lại bằng công cụ khi cần. Tin trả lời có thẻ được nối khối "[Hệ thống ghi lại: thẻ hành động …]" ghi trạng thái từng thẻ, để lượt sau không soạn lại hay nói sai kết quả.
10. **Đánh giá lặp lại được.** `npm run eval:assistant -- --k 3` chạy 8 ca (đọc, lọc theo tên, chi tiết, soạn bình luận, ghi nhớ, chống chèn lệnh trong bình luận, từ chối việc không hỗ trợ, thuật ngữ "Trễ hạn") qua vòng hội thoại thật trên `qcet_test` với dữ liệu tự tạo và tự xóa, chấm bằng code, báo pass@1 và pass^k vào `artifacts/assistant-eval/`. Chạy lại khi đổi mô hình, gateway hay lời nhắc.
11. **Audit không chứa nội dung.** `ASSISTANT_ACTION_DECIDED` ghi mã thẻ, loại, quyết định, trạng thái và mã nhiệm vụ; không ghi chữ bình luận, lời nhắc hay ghi nhớ. Thao tác thật (bình luận, đổi trạng thái, nhắc việc) còn có audit riêng của service đó như khi người dùng tự làm.
12. **Biên bản cuộc họp (bổ sung 21/10/2026, người dùng yêu cầu bấm "Tạo biên bản" thì mở Trợ lý xử lý bản ghi rồi đề xuất biên bản).** Ngữ cảnh cuộc trò chuyện thêm loại `meeting` (kiểm `meeting.read`). Hai công cụ đọc: `get_meeting` (thông tin cuộc họp, thành phần không kèm email, chương trình và biên bản đã cắt, danh sách bản ghi nếu người hỏi là chủ tọa/thư ký/người tổ chức) và `get_meeting_recording` (biên bản đề xuất, quyết định, việc được giao của một bản ghi; bản đang soạn thì chờ tối đa 150 giây, hỏi lại mỗi 3 giây, dừng theo lượt; bỏ bản chép lời). Âm thanh vẫn do việc nền ADR-013 soạn khi người dùng bấm "Tạo biên bản" (bước xác nhận đã báo người dự họp giữ nguyên); lượt chat không gửi âm thanh (ô soạn chỉ nhận ảnh, PDF và tệp chữ; bản ghi dài phải cắt đoạn bằng ffmpeg), kể cả khi model chat là Gemini 3.8 Flash như từ 21/10/2026. Thẻ thứ năm `propose_minutes` → `meeting_minutes`: kiểm cuộc họp ở Đã họp hoặc Dự thảo biên bản và `meeting.draft_minutes`, lưu trạng thái và `updatedAt` lúc soạn; duyệt thì `MeetingService.draftMinutes` với phiên người dùng, cuộc họp đã đổi (có người vừa lưu, sửa, duyệt) thì `failed`. Không hoàn tác được (xóa dự thảo đưa cuộc họp về Đã họp, mất cả dự thảo cũ nếu thẻ đã thay). Tham số của riêng công cụ này được tới 12.000 ký tự (biên bản tối đa 10.000), các công cụ khác giữ trần 4.000. Quy tắc 12 của lời nhắc: đọc bản ghi trước, tóm tắt, rồi soạn thẻ; bản ghi chưa xong thì nói rõ, không tự soạn. Bấm "Tạo biên bản" thì khung Trợ lý mở cuộc mới gắn cuộc họp và **gửi luôn** câu nhờ soạn (người dùng yêu cầu 21/10/2026: "chat thì gửi luôn tin nhắn soạn biên bản"); khác kỹ năng và bản tin sáng (vẫn chỉ điền sẵn) vì chính người dùng vừa bấm một nút nói rõ việc, và lượt đó chỉ đọc rồi soạn thẻ, lưu vẫn cần duyệt. Không có khung nổi (điện thoại) thì câu chờ gửi đi qua `sessionStorage` sang `/assistant?context=meeting:<id>` (đúng ngữ cảnh, trong 60 giây, một lần); `?prompt=` trên đường dẫn vẫn chỉ điền sẵn để liên kết từ nơi khác không gửi thay người dùng. Chưa chạy lại `eval:assistant` sau đổi lời nhắc (tốn lượt gateway, chờ người dùng cho phép).

## Alternatives Considered

1. **Công cụ ghi chạy ngay, xác nhận ở trình duyệt.** Bị bác: client giả được xác nhận; chèn lệnh trong bình luận có thể khiến mô hình gọi công cụ ghi.
2. **Gửi nội dung hành động từ trình duyệt khi duyệt.** Bị bác: người dùng (hoặc mã độc ở trình duyệt) đổi được nội dung sau khi xem; lưu thẻ ở máy chủ thì điều được xem là điều được làm.
3. **Mô hình tự ghi nhớ không cần duyệt (như Memory tự động của ChatGPT).** Bị bác ở giai đoạn này: ghi nhớ đi vào mọi lượt sau nên là kênh chèn lệnh lâu dài.
4. **Bản tin do mô hình viết.** Bị bác: tốn một lượt mô hình mỗi người mỗi sáng, có thể sai số; số đếm từ hàm đọc là đủ và người dùng bấm để hỏi chi tiết.
5. **Lưu ghi nhớ, kỹ năng trong `users.preferences` (JSON).** Bị bác: cần giới hạn số mục, tên duy nhất, khóa khi thêm song song; bảng riêng làm được bằng ràng buộc của CSDL.

## Consequences

### Tích cực
- Việc nhỏ hằng ngày làm được ngay trong cuộc trò chuyện mà không mở thêm đường ghi mới: mọi thay đổi đi qua service sẵn có, kiểm quyền lại lúc duyệt.
- Câu hỏi theo tên người, theo đơn vị và về trao đổi gần đây trả lời được (trước đó `assigneeId` không dùng được vì mô hình chỉ thấy tên).
- Có số đo khi đổi mô hình: lần chạy đầu 19/10/2026 (mô hình `sonnet-4.6` qua gateway) đạt 8/8 ca với k = 1.

### Tiêu cực
- Thêm năm bảng (`assistant_preferences`, `assistant_memories`, `assistant_skills`, `assistant_actions`, `assistant_briefings`), migration `20261019120000_assistant_upgrade`.
- Thẻ soạn trong lượt bị dừng hay lỗi trước khi lưu tin trả lời không gắn được vào tin nào nên không hiện khi mở lại cuộc (vẫn duyệt được nếu thẻ đã hiện trong phiên).
- Tìm người theo tên không dấu đọc tối đa 2.000 người đang hoạt động để so; đủ cho quy mô trường, cần chỉ mục bỏ dấu nếu lớn hơn.
- Nhắc việc là quyền của lãnh đạo đơn vị: chuyên viên hỏi "nhắc giúp" nhận câu không có quyền.
- Bản tin chỉ đếm, không tóm tắt; khung chat nổi chưa có nút Cài đặt (mở ở trang Trợ lý).

## Điều kiện production

Như ADR-009, thêm: áp migration `20261019120000_assistant_upgrade`; xác nhận cron `/api/cron/assistant-briefing` qua được middleware (hoặc chỉ dựa vào worker outbox, `OUTBOX_WORKER_ENABLED=true`); chạy `npm run eval:assistant -- --k 3` với mô hình production và giữ báo cáo.

## Evidence

| Bằng chứng | File | Mô tả |
|------------|------|-------|
| Lưu, duyệt, hoàn tác thẻ | `apps/api/src/server/assistant/assistant-actions.ts` | `createPendingAction`, `decideAssistantAction` |
| Công cụ soạn thẻ | `apps/api/src/server/assistant/assistant-tool-actions.ts` | kiểm `readTaskForUser` và capability trước khi lưu |
| Trần thẻ mỗi lượt, gắn thẻ vào tin | `apps/api/src/server/assistant/assistant-service.ts` | `maxActionsPerTurn`, `linkActionsToMessage` |
| Thiết lập riêng | `apps/api/src/server/assistant/assistant-profile.ts` | trần ghi nhớ, kỹ năng; `loadAssistantPromptProfile` |
| Lời nhắc | `packages/shared/src/domain/assistant/assistant-prompt.ts` | quy tắc 10, 11; khối thiết lập; câu hỏi trước đó |
| Bản tin sáng | `apps/api/src/server/assistant/assistant-briefing.ts`; `apps/api/src/app/api/cron/assistant-briefing/route.ts` | `sendAssistantBriefings` |
| Eval | `apps/api/scripts/assistant-eval.ts` | 8 ca, pass@1, pass^k |
| Test | `apps/api/tests/assistant-actions.test.ts`; `apps/api/tests/assistant-tool-reads.test.ts`; `tests/assistant-upgrade-prompt.test.ts` | quyền, hết hạn, bấm hai lần, trần thẻ, chống chèn lệnh, lọc theo tên |

## Related ADRs

- [ADR-009](ADR-009-assistant-read-only-tools.md): công cụ đọc, giới hạn lượt, lưu giữ 90 ngày.
- [ADR-010](ADR-010-assistant-task-proposals.md): đề xuất nhiệm vụ, người dùng tự tạo.
- [ADR-002](ADR-002-contextual-authorization-policy-engine.md): capability của từng thao tác.
