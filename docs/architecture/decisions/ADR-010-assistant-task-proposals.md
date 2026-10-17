# ADR-010: Trợ lý soạn đề xuất nhiệm vụ, người dùng tự tạo trong hộp tạo nhiệm vụ

- **Status**: ACCEPTED cho giai đoạn 1 (phạm vi phát triển). Người dùng yêu cầu ngày 18/10/2026 và giao Claude tự quyết các mặc định ghi ở đây ("tự quyết giải quyết toàn bộ").
- **Date**: 2026-10-18
- **Deciders**: Chủ sở hữu dự án (giao tự quyết); các mặc định dưới đây đổi được khi người dùng duyệt lại.

## Context

Người dùng muốn Trợ lý "tạo nhiệm vụ các kiểu". ADR-009 giữ Trợ lý chỉ đọc. Phương án 3 của ADR-009 (công cụ ghi) cần một ADR riêng về xác nhận của người dùng và kiểm soát ghi. Hộp tạo nhiệm vụ của app đã có Agent soạn nháp ("Tạo với Agent"). Hộp này cũng đã có toàn bộ kiểm tra của form: đơn vị, người chủ trì trong đơn vị, hạn việc con không sau hạn nhiệm vụ, tối đa 20 việc con. `POST /api/tasks` kiểm quyền `task.create` ở máy chủ.

## Decision

1. **Đề xuất, không ghi.** Có thêm công cụ `propose_task`. Công cụ không đọc dữ liệu, không ghi gì và không gọi ra ngoài; nó chỉ trả đề xuất đã làm sạch. Mô hình nhận `created: false` cùng lời dặn không nói là đã tạo hay đã giao. Giao diện hiện thẻ "Đề xuất nhiệm vụ" (nhãn "Chưa tạo") dưới câu trả lời. Nút "Xem lại và tạo" mở hộp chuẩn của app, đã điền sẵn. Người dùng xem lại, sửa và tự bấm Tạo; máy chủ kiểm quyền như mọi nơi khác. Mục 6 của ADR-009 (không công cụ nào đổi dữ liệu) vẫn đúng.
2. **Phạm vi: nhiệm vụ và việc con.** Đề xuất gồm tiêu đề, mô tả, ưu tiên, ngày bắt đầu, hạn, người chủ trì và tối đa 20 việc con (tiêu đề, mô tả, người nhận, hạn). Sửa, giao lại, xóa, phê duyệt, tạo văn bản hay lịch họp vẫn ngoài phạm vi; prompt dặn mô hình chỉ màn hình để người dùng tự làm.
3. **Mô hình không thấy danh sách nhân sự.** Tham số chỉ có tên người hỏi nêu (`leadAssigneeName`, `assigneeName`), không có id. Hộp tạo nhiệm vụ khớp tên với nhân sự của đơn vị đang chọn, ngay ở trình duyệt (`matchPersonByName`). Có hai cách khớp: trùng cả họ tên, hoặc khớp phần cuối họ tên ("Lan", "Thị Lan") với đúng một người. Danh xưng, học vị và chức vụ trong ngoặc bị bỏ trước khi so; dấu thì giữ nguyên ("Lân" khác "Lan"). Không chắc thì để trống, người dùng tự chọn.
4. **Không tự đặt hạn hay người.** Hạn, ngày bắt đầu, người chủ trì, người nhận việc con chỉ điền khi người hỏi nêu rõ. Thiếu thì vẫn soạn; thẻ chỉ hiện trường có giá trị và nhắc một lần hai trường bắt buộc còn thiếu (hạn, chủ trì), kèm lối nhắn thêm để Trợ lý soạn lại.
5. **Làm sạch ở máy chủ, kiểm lại ở hộp.** Tham số kiểm bằng zod `.strict()`, ngày phải có thật. `normalizeTaskProposal` làm tiêu đề thành một dòng. Hàm này bỏ ngày bắt đầu sau hạn, bỏ hạn việc con sau hạn nhiệm vụ, bỏ việc con trùng tên và giữ tối đa 20 việc con. Hộp áp đề xuất qua cùng đường với nháp của Agent (`applyAgentDraft`), nên người chủ trì ngoài đơn vị hoặc hạn việc con sai đều bị bỏ. Đề xuất không kiểm quyền tạo trước; quyền kiểm lúc bấm Tạo.
6. **Chỉ trong phiên.** Sự kiện `proposal` không lưu cùng tin trả lời. Mở lại cuộc từ lịch sử thì không còn thẻ; tải lại đúng cuộc đang mở thì thẻ vẫn giữ theo mã tin, như tệp gửi kèm. Tạo xong từ thẻ thì thẻ thu gọn thành "Đã tạo nhiệm vụ <mã>" kèm lối mở (cũng chỉ trong phiên, thay cho toast), không còn nút để khỏi tạo trùng. Người dùng không cần đề xuất thì bấm "Bỏ qua": thẻ thu gọn thành "Đã bỏ qua đề xuất" kèm "Hoàn tác", không gửi gì cho máy chủ, cũng chỉ trong phiên. Audit ghi bước `propose_task` (tên, ok), không ghi tiêu đề hay nội dung đề xuất.
7. **Giới hạn.** Tối đa 3 đề xuất mỗi lượt (`ASSISTANT_LIMITS.maxProposalsPerTurn`). Đề xuất thứ tư nhận lỗi giới hạn và không hiện thẻ. Tham số nằm trong trần 4.000 ký tự của mọi công cụ, mô tả tối đa 3.000 ký tự. Trần này tính cả JSON tham số, nên đề xuất có nhiều việc con kèm mô tả sẽ bị từ chối ("nội dung quá dài") trước khi tới 20 việc con. Chạy thật mới thử tới 3 việc con không mô tả.
8. **Không thêm cờ.** Đề xuất đi theo cờ `assistant`; không thêm biến môi trường. Thẻ không gắn nhãn "AI" riêng vì chân trang đã ghi Trợ lý có thể sai. Thẻ mở hộp ở trang Trợ lý và ở khung chat nổi (khung chat nổi gắn lại `useCreateTaskLauncher`).

## Alternatives Considered

1. **Công cụ ghi có bước xác nhận (D1).** Bị bác ở giai đoạn này. Muốn làm thì mô hình phải giữ id người, và cần thêm luồng xác nhận, idempotency và audit ghi riêng. Hộp tạo nhiệm vụ đã làm đủ những việc này.
2. **Gửi danh sách nhân sự cho mô hình để chọn id (như Agent trong hộp).** Bị bác cho Trợ lý: lộ thêm dữ liệu nhân sự vào mọi lượt, trong khi tên do người hỏi nêu là đủ để hộp khớp.
3. **Chuyển sang trang `/tasks/new` kèm tham số URL.** Bị bác: nội dung đề xuất (mô tả, việc con) đi vào URL và lịch sử trình duyệt, và người dùng phải rời cuộc trò chuyện.

## Consequences

### Tích cực
- Người dùng tạo nhiệm vụ từ câu nói tự nhiên mà không mở đường ghi mới; lỗi của mô hình chỉ thành một bản nháp sai.
- Dùng lại hộp tạo nhiệm vụ, kiểm tra của form và quyền máy chủ có sẵn.

### Tiêu cực
- Tên trùng (hai người tên Lan) hoặc tên viết khác trong danh bạ thì để trống, người dùng phải tự chọn.
- Người cùng tên ở đơn vị khác đơn vị đang chọn không khớp; đổi đơn vị trong hộp không khớp lại tên.
- Thẻ mất khi mở lại cuộc từ lịch sử; câu trả lời vẫn còn chữ mô tả đề xuất.
- Mô hình đôi khi nói một câu dẫn trước khi gọi công cụ ("Tôi sẽ soạn…"), như với các công cụ đọc. Prompt đã dặn không viết, nhưng sonnet-4.6 vẫn viết ở 2/3 câu thử ngày 18/10/2026; gemini-3.8-flash thì không.
- Quyền tạo chỉ kiểm lúc bấm Tạo. Người không có quyền tạo ở đơn vị đang chọn vẫn thấy thẻ và hộp điền sẵn, rồi mới nhận lỗi của `POST /api/tasks` trong hộp.

### Phát hiện có sẵn, ngoài phạm vi
- `taskCommandService.createTask` vẫn đọc `creatorId` và `code` từ input thô (`src/server/tasks/task-command-service.ts`, dòng 482–487, 566, 652). `POST /api/tasks` ánh xạ trường tường minh, không truyền hai trường này, nên hiện không khai thác được. Nơi gọi mới phải giữ nguyên cách ánh xạ đó.

## Evidence

| Bằng chứng | File | Mô tả |
|------------|------|-------|
| Công cụ đề xuất | `src/server/assistant/assistant-tool-proposal.ts` | `ProposeTaskArgs`, `proposeTask`, lời dặn `created: false` |
| Làm sạch, khớp tên | `src/domain/assistant/assistant-task-proposal.ts` | `normalizeTaskProposal`, `matchPersonByName`, `proposalToTaskDraft` |
| Phát sự kiện, giới hạn | `src/server/assistant/assistant-service.ts` | `maxProposalsPerTurn`, sự kiện `proposal` |
| Prompt | `src/domain/assistant/assistant-prompt.ts` | Quy tắc 3 |
| Thẻ và hộp | `src/components/assistant/assistant-task-proposal-card.tsx`; `src/components/tasks/create/create-task-modal.tsx` | `AssistantTaskProposalCard`; `initialProposal` |
| Kiểm thử | `tests/assistant-task-proposal.test.ts`; `tests/assistant-service.test.ts`; `tests/assistant-ui.test.ts` | Làm sạch, khớp tên, công cụ, giới hạn 3 thẻ, thẻ hiện khi xong |
| Chạy thật | Gateway localhost:8000, `sonnet-4.6`, DB test, 18/10/2026 | 3 câu: gọi `propose_task` đúng tham số, không tự đặt hạn hay người, câu trả lời ngắn; hai đề xuất trong một lượt chạy được |

## Related ADRs

- [ADR-009](ADR-009-assistant-read-only-tools.md): Trợ lý chỉ đọc; ADR này không thêm công cụ ghi.
- [ADR-002](ADR-002-contextual-authorization-policy-engine.md): quyền tạo nhiệm vụ kiểm ở máy chủ lúc bấm Tạo.
