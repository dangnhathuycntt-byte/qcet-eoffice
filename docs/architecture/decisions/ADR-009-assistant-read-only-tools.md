# ADR-009: Trợ lý chỉ đọc bằng công cụ chạy với quyền của người hỏi

- **Status**: ACCEPTED cho giai đoạn 1 (phạm vi phát triển); chưa đủ điều kiện đưa lên production
- **Date**: 2026-10-17
- **Deciders**: Chủ sở hữu dự án (đã chốt: không gửi văn bản hạn chế cho mô hình, lưu lịch sử 90 ngày, nhãn "Trợ lý"; còn mở: ai được dùng và phân loại rủi ro, xem mục Điều kiện production)

## Context

Trợ lý QCET (`/assistant`) trả lời về nhiệm vụ, văn bản, lịch họp và việc cần xử lý của người đang đăng nhập. Mô hình được gọi qua gateway chuẩn OpenAI dùng chung với Agent soạn nhiệm vụ (`TASK_AGENT_*`). Gateway chạy được `tools` cả khi trả thường lẫn khi stream, qua nhiều vòng (thử ngày 17/10/2026 với gemini-3.8-flash). Vì vậy Trợ lý đọc dữ liệu bằng tool calling, không nạp sẵn dữ liệu vào prompt.

Rủi ro cần chặn: mô hình đọc dữ liệu vượt quyền người hỏi; dữ liệu mật hoặc hạn chế lọt vào câu trả lời; nội dung tài liệu ra lệnh cho mô hình làm thay đổi dữ liệu; lịch sử chat giữ bản sao dữ liệu quá lâu.

## Decision

1. **Quyền lấy từ phiên, không từ mô hình.** Route nạp `AuthorizationContext` từ phiên bằng `loadCachedAuthorizationContext`. Tool nhận ngữ cảnh từ server. Tham số của mô hình được kiểm bằng zod `.strict()`, nên `userId` hay tham số lạ bị từ chối.
2. **Bọc service đã kiểm quyền, không viết truy vấn quyền mới.** Nhiệm vụ qua `taskQueryService.queryTasks` và `readTaskForUser`; văn bản qua `listDocuments` với `buildDocumentReadWhere` và `canReadDocument`; hộp việc qua `ActionInboxService`; lịch họp qua `MeetingService.listMeetings(query, authz)`. Các ngoại lệ có chủ đích, đều sau khi đã qua kiểm quyền: đọc người tham gia nhiệm vụ (`taskActor`); đọc `securityLevel`/`notes` theo id để lọc hộp việc; từ 19/10/2026 ([ADR-012](ADR-012-assistant-approved-actions-memory-skills.md)) đọc bình luận, minh chứng và yêu cầu gia hạn đang chờ của nhiệm vụ đã đọc được, và tra tên người đang hoạt động hay tên đơn vị để đổi tên thành mã cho bộ lọc (chỉ trả tên, như danh bạ). Không tiết lộ việc bản ghi có tồn tại hay không: không tìm thấy và không có quyền trả cùng một câu. Email và số điện thoại trong mọi trường chữ tự do (mô tả, trích yếu, tiêu đề nhiệm vụ, số/ký hiệu và cơ quan ban hành văn bản, địa điểm họp, tên tệp, tiêu đề nguồn) được che trước khi đưa cho mô hình hoặc lưu nguồn (`redactContact`). Regex giới hạn độ dài để không quay lui bậc hai, và bỏ qua ngày giờ dạng `01.02.2026 08:00`. Mã nhiệm vụ không đổi.
3. **Chỉ văn bản THUONG không hạn chế.** Văn bản bị loại khi `securityLevel` khác THUONG, khi ghi chú chứa `restricted`, `giới hạn` hoặc `gioi_han`, hoặc khi phân loại ứng dụng là RESTRICTED hay PERSONAL_DATA (`isRestrictedDocument`). Quy tắc áp dụng cả khi người hỏi có quan hệ trực tiếp với văn bản. Danh sách trả `excludedRestricted`; mở chi tiết văn bản bị loại trả câu riêng. Phần ghi chú và mức mật dùng chung với giao diện (`src/domain/assistant/assistant-document-eligibility.ts`): menu "Hỏi Trợ lý" của văn bản chỉ hiện khi văn bản qua được quy tắc này. Mở cuộc mới với ngữ cảnh là văn bản người hỏi đọc được nhưng bị loại thì nhận câu riêng, không phải câu "không có quyền".
4. **Không lưu kết quả công cụ.** Lưu: chữ câu hỏi và câu trả lời, trạng thái, nguồn (loại, id, mã, tiêu đề, đường dẫn), các bước (tên công cụ, nhãn, số đếm, ok), và thẻ đề xuất nhiệm vụ kèm trạng thái của thẻ ([ADR-010](ADR-010-assistant-task-proposals.md)). Không lưu payload công cụ, suy nghĩ của mô hình hay `thought_signature`. Lượt sau chỉ gửi lại chữ; mô hình gọi lại công cụ nếu cần dữ liệu mới.
5. **Ngữ cảnh mở từ nhiệm vụ hoặc văn bản phải đọc được.** `context` chỉ được nhận khi tạo cuộc mới, và server đọc lại bằng cùng hàm mô tả. Không đọc được thì không tạo cuộc. Cuộc có sẵn mô tả lại ở mỗi lượt; mất quyền thì bỏ ngữ cảnh.
6. **Chỉ đọc, có giới hạn cứng.** Không có công cụ ghi, gửi hay gọi ra ngoài. Từ 19/10/2026 có công cụ soạn thẻ hành động (bình luận, đổi trạng thái, nhắc việc, ghi nhớ): công cụ chỉ lưu thẻ, máy chủ thực hiện khi người dùng bấm Duyệt và kiểm quyền lại lúc đó ([ADR-012](ADR-012-assistant-approved-actions-memory-skills.md)); mô hình vẫn không tự thay đổi dữ liệu. Thẻ "Tạo nhiệm vụ" ở màn đầu chỉ mở hộp tạo nhiệm vụ chuẩn của app: người dùng tự điền và bấm Tạo, máy chủ kiểm quyền `task.create` như mọi nơi khác; Trợ lý không tham gia. Từ 18/10/2026 có thêm `propose_task`: công cụ chỉ soạn đề xuất để mở hộp đó đã điền sẵn, không ghi gì ([ADR-010](ADR-010-assistant-task-proposals.md)). Kết quả công cụ và ngữ cảnh được prompt coi là dữ liệu, không phải chỉ dẫn. Đây là biện pháp mềm; ranh giới thật là không công cụ nào đổi dữ liệu. Giới hạn (`ASSISTANT_LIMITS`):

   | Mục | Giá trị |
   |---|---|
   | Vòng gọi mô hình mỗi lượt | 6; vòng cuối không kèm công cụ và gửi lịch sử dạng chữ thuần (`toTextOnlyMessages`) để buộc trả lời |
   | Công cụ mỗi vòng | 4; lệnh thừa bị từ chối bằng thông báo |
   | Ký tự công cụ mỗi lượt / mỗi kết quả | 24.000 / 6.000 (cắt phần tử cuối, không cắt giữa JSON); kiểm theo từng kết quả, kết quả vượt phần còn lại được thay bằng thông báo |
   | Thời gian mỗi vòng / mỗi lượt | 180 giây / 300 giây; mỗi công cụ cũng dừng ở hạn của lượt (truy vấn treo không giữ cả lượt) |
   | Lịch sử gửi lại mô hình | 12 tin, tối đa 16.000 ký tự |
   | Câu hỏi / thân yêu cầu | 4.000 ký tự / 32 KB |
   | Tệp người hỏi gửi kèm mỗi lượt | 5 tệp, 10 MB (multipart tối đa 11 MB); loại và cỡ từng tệp như Agent tạo nhiệm vụ |
   | Tần suất | 6 lượt mỗi phút mỗi người dùng (`AI_CHAT`) |
   | Đề xuất nhiệm vụ mỗi lượt | 3 (ADR-010) |
   | Đặt tên cuộc mới | 1 lời gọi gateway, tối đa 15 giây; chờ thêm sau khi trả lời xong tối đa 2,5 giây |

   Gateway chặn (HTTP 502, `tool_contract_error`) khi mô hình gọi công cụ chưa khai báo. Việc này xảy ra cả khi lịch sử còn tool call mà vòng không gửi `tools`, và mô hình bỏ qua `tool_choice: "none"` (thử 17/10/2026). Vì vậy vòng cuối gom kết quả công cụ thành tin có rào `<ket_qua_cong_cu>`. Nếu gateway chặn ở vòng giữa (mã `AGENT_TOOL_CONTRACT`), lượt chuyển ngay sang vòng chữ thuần đó thay vì báo lỗi.

   Câu trả lời bị cắt (`finish_reason: length`) giữ phần chữ nhưng lưu trạng thái lỗi (`AGENT_TRUNCATED`); khúc `error` giữa luồng SSE thành lỗi gateway thay vì chữ cụt. Câu hỏi có trả lời lỗi không được gửi lại mô hình ở lượt sau. Client ngắt trước khi tạo cuộc, hoặc trước khi ghi tin vào cuộc có sẵn, thì không ghi gì.

7. **Lịch sử giữ 90 ngày.** Mốc tính là `lastMessageAt`. Cuộc quá hạn bị lọc khỏi mọi truy vấn của người dùng. Danh sách phân trang bằng con trỏ mờ mang `(lastMessageAt, id)`, không tra lại bản ghi con trỏ, nên cuộc làm mốc bị xóa hay vừa có tin mới cũng không làm trùng hay sót trang. Cron `GET /api/cron/assistant-retention` xóa hẳn, lịch `30 19 * * *` UTC (02:30 giờ Việt Nam). Xóa cuộc thì tin nhắn xóa theo.
8. **Audit không chứa nội dung.** `ASSISTANT_TURN` ghi trạng thái, số vòng, thời gian, mô hình đã dùng, công cụ (tên, ok, số đếm), tham chiếu `{type, id}` của nguồn đã đọc, và loại cùng dung lượng của tệp gửi kèm. Không ghi câu hỏi, câu trả lời, tiêu đề, tên tệp hay dữ liệu công cụ. `ASSISTANT_CONVERSATION_DELETED` chỉ ghi số tin nhắn. Lỗi ghi audit chỉ được log, không làm hỏng lượt.
9. **Model và tệp do người hỏi chọn** (người dùng yêu cầu 17/10/2026). Ô soạn chọn được model trong `TASK_AGENT_MODELS`; `TASK_AGENT_MODEL` luôn là mặc định. Danh sách này dùng chung với Agent tạo nhiệm vụ, và máy chủ từ chối mã ngoài danh sách (400 `MODEL_NOT_ALLOWED`). Ảnh và tệp gửi kèm được kiểm nội dung (magic bytes) trước khi trả luồng; tệp hỏng là 400 và không tạo cuộc. Ảnh, PDF gửi nguyên; DOCX, XLSX, TXT, CSV trích chữ ở máy chủ và bọc dấu "[Tệp đính kèm …]". Prompt coi tệp là dữ liệu, không phải chỉ dẫn. Từ 19/10/2026 (người dùng báo tải lại trang thì mất tệp kế hoạch vừa gửi) tệp được lưu: mỗi tệp là một `FileObject` gắn với cuộc và câu hỏi qua `metadata` (`assistantConversationId`, `assistantMessageIds`), không thêm bảng hay cột. Chỉ chủ cuộc tải được; lượt sau gửi lại tệp của các câu hỏi còn trong lịch sử gửi mô hình (tối đa 5 tệp, 10MB mỗi lượt), "Thử lại" gửi mã tệp thay cho tệp; xóa cuộc hay quá hạn lưu giữ thì xóa tệp qua outbox (`FILE_OBJECT_PURGE_REQUESTED`). Vẫn không ghi tên hay nội dung tệp vào log hay audit (audit chỉ có loại và dung lượng). Mã ở `server/assistant/assistant-attachments.ts`.
10. **Tên cuộc mới do mô hình đặt** (người dùng yêu cầu 18/10/2026, như ChatGPT). Cuộc tạo với tên lấy từ câu hỏi (`deriveConversationTitle`). Song song với lượt đầu, máy chủ gọi gateway thêm một lần (`generateConversationTitle`): cùng model của lượt, không công cụ, không suy nghĩ, chờ tối đa 15 giây. Lời gọi chỉ nhận câu hỏi đầu (1.000 ký tự đầu), nhãn mục đang hỏi và nhãn bước của tệp; không nhận nội dung tệp. Tên được làm sạch (`cleanGeneratedTitle`) rồi ghi khi người dùng chưa tự đổi tên (`titleEdited = false`). Máy chủ báo sự kiện `title` trước `done`. Trả lời xong mà tên chưa có thì chờ thêm tối đa 2,5 giây (`titleGraceMs`); quá thời gian thì không báo trong lượt, nhưng tên vẫn được ghi khi có và danh sách tải lại sẽ thấy. Lỗi đặt tên chỉ log tên lỗi, giữ tên cũ. Lượt sau không đặt lại tên.

## Alternatives Considered

1. **Nạp sẵn dữ liệu liên quan vào prompt.** Bị bác: gửi nhiều dữ liệu hơn câu hỏi cần, tốn token, và khó giữ giới hạn ký tự theo từng câu.
2. **Công cụ nhận `userId`, hoặc chạy bằng quyền hệ thống.** Bị bác: mô hình có thể bị dẫn dụ đổi danh tính. Quyền phải lấy từ phiên.
3. **Công cụ ghi (giao việc, đổi trạng thái) ngay ở giai đoạn 1.** Ngoài phạm vi; cần ADR riêng về xác nhận của người dùng và kiểm soát ghi. Đã có từ 19/10/2026 dưới dạng thẻ chờ duyệt ([ADR-012](ADR-012-assistant-approved-actions-memory-skills.md)). Tạo nhiệm vụ đi theo hướng đề xuất, người dùng tự tạo ([ADR-010](ADR-010-assistant-task-proposals.md)), không phải công cụ ghi.
4. **Lưu kết quả công cụ để lượt sau không gọi lại.** Bị bác: thành bản sao dữ liệu nghiệp vụ, và lịch sử lệch với quyền hiện tại.

## Consequences

### Tích cực
- Trợ lý không thấy nhiều hơn màn hình: cùng service, cùng bộ lọc quyền.
- Không có đường ghi dữ liệu, nên lỗi của mô hình không làm đổi nghiệp vụ.
- Audit đủ để truy vết ai đã đọc nguồn nào mà không giữ nội dung.

### Tiêu cực
- Lịch sử vẫn hiện câu trả lời cũ cho chủ nhân sau khi họ mất quyền với mục đó. Chấp nhận, vì chỉ chủ nhân xem và có hạn 90 ngày.
- Lọc văn bản mật một phần dựa vào ghi chú dạng chuỗi. Ghi chú chứa cụm "giới hạn" thì văn bản bị loại dù không thực sự hạn chế. Sai theo hướng an toàn hơn.
- Mỗi câu hỏi trung bình 3,3 vòng gọi mô hình. Đo 17/10/2026 trên 30 câu hỏi có dữ liệu mẫu (gemini-3.8-flash, ngân sách suy nghĩ 65536): p50 khoảng 19 giây, p95 khoảng 40 giây.
- Câu trả lời có thể sai. Giao diện ghi rõ điều này và yêu cầu kiểm tra ở nguồn, nhưng chỉ ở chân trang màn đầu của trang Trợ lý. Khung chat nổi không có câu này vì người dùng yêu cầu bỏ cho gọn (17/10/2026), nên người chỉ dùng khung nổi không thấy cảnh báo. Giữ theo yêu cầu đó; ghi nhận đánh đổi ngày 18/10/2026.
- Không đọc nội dung tệp đính kèm của nhiệm vụ, văn bản trong hệ thống; chỉ đọc tệp người hỏi gửi kèm lượt hỏi.
- Tệp người hỏi gửi chỉ có ở lượt đó. Lượt sau hỏi tiếp chi tiết trong tệp thì phải gửi lại; prompt dặn mô hình đề nghị gửi lại, không đoán.

## Điều kiện production (chưa đáp ứng)

- **Ai được dùng.** Bật cờ `assistant` (biến `FEATURE_ASSISTANT`) cho môi trường phát triển trước, sau đó cho nhóm thử nghiệm. Danh sách nhóm chưa chốt.
- **Phân loại rủi ro và chuyển dữ liệu.** Đơn vị hoặc pháp chế quyết định cách phân loại theo Luật AI 134/2025 Điều 10, và quyết định việc chuyển dữ liệu ra nước ngoài khi mô hình là Gemini.
- **Gateway truy cập được từ máy chủ production.** `localhost:8000` chỉ có trên máy phát triển.
- **Thời gian chờ của host cho route chat đủ 330 giây.** Route khai báo `maxDuration` 330 giây (`src/app/api/assistant/chat/route.ts`), lớn hơn `turnTimeoutMs` 300 giây để kịp lưu tin và ghi audit. Host và proxy đứng trước phải cho phép đúng thời gian đó. Vercel chỉ cho quá 300 giây khi bật Fluid compute.
- **Một tiến trình API.** Từ 19/10/2026 lượt chạy tiếp khi trình duyệt rời trang hay tải lại; mở lại cuộc thì nối lại (`GET /api/assistant/conversations/[id]/stream`), chỉ nút Dừng (`POST /api/assistant/runs/[id]/stop`) mới hủy lượt. Sổ lượt nằm trong bộ nhớ của tiến trình (`src/server/assistant/assistant-runs.ts`), đúng với một container `qcet-api` hiện có. Chạy nhiều bản API thì phải chuyển sổ lượt sang Redis. Khởi động lại API giữa lượt thì lượt mất; câu hỏi hiện "bị gián đoạn" để thử lại.
- **Cron.** Đọc từ mã nguồn, chưa kiểm ở runtime: danh sách công khai của `src/middleware.ts` (dòng 174–184) không có `/api/cron`, và matcher `/api/:path*` (dòng 302) yêu cầu phiên trước khi `isCronAuthorized` chạy. Lời gọi cron không có phiên có thể bị 401. Hai cron cũ có cùng đường đi. Cần xác nhận trước khi tin lịch xóa hằng ngày đang chạy.
- **Migration** `20261017120000_assistant_conversations` được áp lên production trước khi bật cờ.
- **Ngân sách suy nghĩ.** Từ 23/10/2026 Trợ lý nghĩ thấp theo mặc định (`ASSISTANT_THINKING_BUDGET` trống): một lượt nối 2–3 vòng gọi mô hình, mỗi vòng nghĩ cao mất ~10 giây dù chỉ chọn công cụ. Bộ eval 8 ca cùng đạt 100% ở hai mức, 11,5 giây/ca so với 21,6 giây/ca. `max_tokens` của Trợ lý đặt riêng (12.000), nên câu trả lời dài không bị cắt ở mức nghĩ thấp. Đặt `ASSISTANT_THINKING_BUDGET` (≥ 1024) để nghĩ cao lại (bắt buộc nếu bật lại bộ chọn model với Sonnet/Opus: qua gateway chúng chỉ trả phần suy nghĩ khi có `thinking`); `TASK_AGENT_THINKING_BUDGET` chỉ còn cho Agent soạn nhiệm vụ (không đặt thì `max_tokens` 1.200 và câu dài bị cắt).
- **Đánh giá với mô hình thật** đã chạy trên dữ liệu mẫu ở DB test (17/10/2026, 30 câu hỏi về quyền, văn bản mật/hạn chế, số điện thoại, prompt injection). Cần chạy lại khi đổi mô hình hoặc gateway.

## Evidence

| Bằng chứng | File | Mô tả |
|------------|-----------|-------|
| Quyền lấy từ phiên | `src/app/api/assistant/chat/route.ts` | `loadCachedAuthorizationContext(authUser.id)` |
| Giới hạn một lượt | `src/server/assistant/assistant-service.ts` | `ASSISTANT_LIMITS` |
| Công cụ đọc qua service | `src/server/assistant/assistant-tool-tasks.ts`; `src/server/assistant/assistant-tool-agenda.ts` | `queryTasks`, `readTaskForUser`, `getActionInbox`, `listMeetings` |
| Lọc văn bản | `src/server/assistant/assistant-tool-documents.ts` | `isRestrictedDocument`, `canReadDocument` |
| Câu lỗi chung | `src/server/assistant/assistant-tool-shared.ts` | `NOT_FOUND_MESSAGE` |
| Che email, số điện thoại | `src/server/assistant/assistant-tool-shared.ts` | `redactContact` |
| Giới hạn tần suất | `src/server/security/rate-limit.ts` | `AI_CHAT`, 6 lượt mỗi phút |
| Lưu giữ 90 ngày | `src/contracts/assistant.ts`; `src/server/assistant/assistant-conversations.ts` | `ASSISTANT_RETENTION_DAYS`, `visibleScope`, `purgeExpiredConversations` |
| Lịch cron | `vercel.json` | `/api/cron/assistant-retention` lúc `30 19 * * *` |
| Chặn cron của middleware | `src/middleware.ts` | Cần kiểm ở runtime |
| Thời gian chờ route | `src/app/api/assistant/chat/route.ts` | `maxDuration = 330`, lớn hơn `turnTimeoutMs` 300 giây |
| Lượt độc lập với kết nối | `src/server/assistant/assistant-runs.ts`; `src/app/api/assistant/conversations/[id]/stream/route.ts`; `src/app/api/assistant/runs/[id]/stop/route.ts` | `startAssistantRun`, `findConversationRun`, `stopAssistantRun` |
| Tên do mô hình đặt | `src/server/assistant/assistant-title.ts`; `src/domain/assistant/assistant-history.ts`; `src/server/assistant/assistant-conversations.ts` | `generateConversationTitle`, `cleanGeneratedTitle`, `applyGeneratedTitle` |

## Related ADRs

- [ADR-002](ADR-002-contextual-authorization-policy-engine.md): mọi công cụ chạy dưới `AuthorizationContext`.
- [ADR-007](ADR-007-rest-api-standard-rfc9457.md): lỗi của route Trợ lý theo RFC 9457.
- [RFC-08](RFC-08-user-directory-policy.md): số điện thoại cá nhân được bảo vệ mặc định, nên không đưa cho mô hình.
