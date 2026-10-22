# ADR-014: Nhiều người cùng sửa mô tả nhiệm vụ trực tiếp (Yjs + Hocuspocus)

- **Status**: PROPOSED. Người dùng chọn "sửa trực tiếp kiểu Google Docs" ngày 21/10/2026 và giao Claude tự quyết phần còn lại. Context ghi số đo của spike cùng ngày (code spike đã gỡ); mục "Kết quả MVP" ghi số đo của bản MVP sau cờ `taskCollab` (mặc định tắt). Chưa triển khai production; chờ chủ sở hữu duyệt để chuyển ACCEPTED.
- **Date**: 2026-10-21
- **Deciders**: Chủ sở hữu dự án (chọn hướng, giao tự quyết chi tiết). Các mặc định đổi được khi người dùng duyệt lại.

## Context

Mô tả nhiệm vụ (và việc con, cũng là `Task` có `parentTaskId`) soạn bằng editor khối Plate 53 nhưng lưu ở `Task.description` theo định dạng QCET JSON v1 (`qcetBlocks: true`), không lưu giá trị Plate trực tiếp: `parseToPlateValue` và `plateToBlocks` + `serializeBlocksToContent` ở [plate-block-codec](../../../packages/shared/src/lib/tasks/plate-block-codec.ts) chuyển qua lại; khối còn URL `blob:` (đang tải lên) bị bỏ khi lưu. Editor tự lưu qua `PATCH /api/tasks/{id}` (chờ 800 ms), kèm `expectedVersion`. Hai người mở cùng nhiệm vụ thì người lưu sau nhận 409 hoặc ghi đè phần của người kia. Chỉ một đường ghi mô tả của việc đã có: `PATCH /api/tasks/{id}` → `taskCommandService.updateTask` (tăng `Task.version`); web không gửi `expectedUpdatedAt`.

Hướng đã chọn: CRDT Yjs, máy chủ Hocuspocus, plugin `@platejs/yjs` của Plate. Phiên bản: `@hocuspocus/server` và `@hocuspocus/provider` 3.4.4 (không lên v4 vì `@platejs/yjs` 53.2.0 đòi peer `@hocuspocus/provider ^3.4.0`), `yjs` 13.6.33, `y-protocols` 1.0.7, `@slate-yjs/core` 1.0.2. `@platejs/yjs` import tĩnh `y-webrtc` 10.3.0 (kéo `simple-peer`) và `y-indexeddb` 9.0.12 nên cả hai vào bundle của web dù không dùng.

Spike 21/10/2026 (next dev 15.5.27 Turbopack, Node 22.23.2) đo bốn câu hỏi:

1. **Một bản `yjs` trong process api.** Không cấu hình gì thì bundle của route handler và bundle của instrumentation mỗi bên một bản: "Yjs was already imported" rồi "Type with the name content has already been defined with a different constructor" khi route đọc tài liệu của máy chủ. Thêm `serverExternalPackages: ["yjs", "y-protocols", "lib0", "@slate-yjs/core", "@hocuspocus/server", "ws"]` ở `apps/api/next.config.ts` thì cùng một bản, `instanceof Y.Doc` đúng.
2. **Máy chủ chạy trong instrumentation, route handler thấy được.** Hocuspocus khởi động trong `register()` của instrumentation, giữ singleton trên `globalThis`. Route handler chạy cùng pid, gọi được `openDirectConnection` + `transact`. Tài liệu được gỡ khỏi bộ nhớ khi hết kết nối, `onStoreDocument` chạy khi transact và khi gỡ. Lớp `Server` dựng sẵn của Hocuspocus có hai chỗ không dùng được: `listen` truyền `address` cho `http.Server.listen` (Node bỏ qua, phải là `host`) nên máy chủ nghe mọi giao diện (`*:3101`); `stopOnSignals` mặc định gọi `process.exit(0)` khi nhận SIGTERM, cắt ngang tắt máy êm (`registerGracefulShutdown`).
3. **WebSocket qua rewrite của web.** Rewrite `/collab/:path*` → `http://127.0.0.1:3101/:path*` của `next dev` chuyển được upgrade: có cookie phiên thì nhận 101, hai `HocuspocusProvider` đồng bộ qua cổng 3001 (13 ms). Máy chủ nhận được cookie, `origin` và `x-forwarded-host`. Không có cookie thì middleware của web chặn và upgrade treo, không trả 101 hay 401.
4. **Turbopack và trang dùng YjsPlugin.** Trang có `YjsPlugin` + provider Hocuspocus biên dịch trong 673 ms và chạy được. Hai tab Playwright cùng gõ thì nội dung hội tụ. Nội dung ban đầu seed ở máy chủ, client gọi `init({ value: null })`. StrictMode chạy effect hai lần (init → destroy → init) sinh "Error: already connected", "[yjs] Tried to remove event handler that doesn't exist" và "WebSocket is closed before the connection is established".

## Decision

1. **Máy chủ cộng tác chạy trong qcet-api, cổng riêng.** Khi cờ `taskCollab` bật, instrumentation khởi động một máy chủ: `http.createServer` + `WebSocketServer` (`ws`, `noServer`, `maxPayload` 12 MB, bằng giới hạn thân yêu cầu của middleware) + `new Hocuspocus(config)`. Máy chủ nghe `COLLAB_PORT` (mặc định 3101) trên `COLLAB_HOST` (mặc định `127.0.0.1`; container đặt `0.0.0.0`, không publish cổng). Không dùng lớp `Server` của Hocuspocus (Context, mục 2). Singleton nằm trên `globalThis`. Tắt máy êm qua `registerGracefulShutdown`: lưu ngay mọi tài liệu đang mở rồi đóng kết nối. Các gói Yjs vào `serverExternalPackages` (Context, mục 1). Chỉ apps/api chạm CSDL và giữ máy chủ này, đúng ADR-011.
2. **Phạm vi MVP: mô tả nhiệm vụ và việc con.** Tên tài liệu `task:<taskId>`, máy chủ kiểm định dạng trước khi tra CSDL. Biên bản cuộc họp, ghi chú cá nhân và bình luận chưa nằm trong phạm vi.
3. **Đường đi của kết nối.** Trình duyệt mở `wss://<cùng tên miền>/collab` (cookie phiên tự đi kèm). Production: cloudflared thêm luật `path: ^/collab(/|$)` → `http://qcet-api:3101` cho từng hostname, đặt trước luật của web như luật `/api`. Dev và khi gọi thẳng web: rewrite `/collab/:path*` tới cùng máy với `API_INTERNAL_URL` nhưng cổng `COLLAB_PORT` (`COLLAB_INTERNAL_URL` ghi đè). Matcher của middleware web bỏ `/collab` để việc xác thực nằm trong máy chủ cộng tác (Context, mục 3: middleware làm upgrade treo thay vì trả lỗi).
4. **Xác thực và phân quyền ở `onAuthenticate`.**
   - Phiên: đọc cookie từ header của yêu cầu upgrade bằng `getSessionFromRequest`, cùng JWT và kiểm thu hồi như REST.
   - `Origin` phải thuộc danh sách cho phép: `NEXT_PUBLIC_APP_URL`; dev thêm `localhost`/`127.0.0.1`.
   - Không đọc được nhiệm vụ thì từ chối kết nối.
   - Đọc được nhưng không có `task.update_metadata`, hoặc nhiệm vụ đã lưu trữ, thì đặt `connectionConfig.readOnly = true`: thấy người khác gõ nhưng không gửi thay đổi được.
   - MVP chỉ kiểm quyền lúc kết nối. Bị thu quyền giữa chừng thì phải tới lần kết nối lại mới có hiệu lực.
5. **Lưu trạng thái riêng, mô tả là bản chiếu.**
   - Bảng mới `task_collab_documents (task_id PK → tasks ON DELETE CASCADE, state BYTEA, updated_at, updated_by_id)`, migration chỉ cộng thêm.
   - `onLoadDocument`: có `state` thì nạp. Chưa có thì seed từ `Task.description`: giải mã bằng `parseToPlateValue` của codec chung rồi `slateNodesToInsertDelta` vào `Y.XmlText` tên `content`, đúng chỗ `@platejs/yjs` đọc. Chỉ máy chủ seed; client luôn `init({ value: null })`, nên không có chuyện hai client seed trùng.
   - `onStoreDocument` (chờ 2 s, tối đa 10 s, mặc định của Hocuspocus) ghi `state`, rồi chuyển Yjs → giá trị Plate (`yTextToSlateElement(content).children`) → `plateToBlocks` → `serializeBlocksToContent`, bỏ khối `blob:` như editor hiện nay, ghi vào `Task.description`. Không tự viết bộ mã hóa riêng: lệch định dạng là hỏng mô tả của mọi nhiệm vụ đã mở. Danh sách, tìm kiếm, Trợ lý và xuất tệp vẫn đọc mô tả như cũ, chỉ trễ tối đa ~10 s.
   - Bước ghi này **không tăng `Task.version`**, để người đang sửa tên hay hạn không bị 409 chỉ vì có người gõ mô tả. `updatedAt` vẫn đổi như mọi lần ghi.
6. **Đường ghi mô tả cũ vẫn đúng khi cờ bật.** Sau khi cập nhật thành công, `PATCH /api/tasks/{id}` có `description` sẽ:
   - nếu tài liệu đang mở trong bộ nhớ: thay nội dung qua `openDirectConnection` (người đang mở thấy ngay);
   - nếu không: xóa dòng `task_collab_documents` để lần mở sau seed lại từ mô tả mới.

   Editor cộng tác không gửi `description` qua PATCH. Các trường khác của PATCH giữ nguyên `expectedVersion`.
7. **Client sau cờ, mặc định tắt.**
   - Cờ `taskCollab` (`FEATURE_FLAG_TASK_COLLAB`, `isPublic`) đi tới web qua `/api/runtime-config`. Cờ tắt thì editor giữ nguyên đường PATCH + tự lưu 800 ms hiện nay.
   - Cờ bật: editor của trang chi tiết nhiệm vụ (`task-detail-page.tsx`) và ngăn chi tiết việc con (`subtask-detail-drawer.tsx`) dùng `YjsPlugin` với provider Hocuspocus, `cursors` lấy tên và màu của người dùng. `@platejs/yjs` tự gắn `withYHistory` (hoàn tác chỉ gỡ thay đổi của chính mình), nên history riêng của Plate không được bật cùng.
   - Trước lần đồng bộ đầu, editor hiện mô tả lấy từ REST ở chế độ chỉ đọc. Quá 10 s chưa đồng bộ được thì giữ chỉ đọc, hiện `InlineAlert` có nút thử lại. Không để người dùng gõ vào tài liệu rỗng chưa đồng bộ: `init` của Plate thôi chờ sau 5 s rồi vẫn cho gõ.
   - Hộp tạo việc (chưa có `taskId`) không cộng tác.
   - Khởi tạo provider được chặn để không chạy hai lần trong StrictMode (Context, mục 4): `init` hoãn một nhịp, lần gỡ đầu hủy trước khi có provider. Khi gỡ editor, hủy hẳn provider Hocuspocus bên dưới: `destroy` của `@platejs/yjs` chỉ ngắt provider đã kết nối xong, kết nối đang mở dở sẽ còn lại.
   - Provider tạo với `autoConnect: false`: `init` của Plate tự gọi `connect`, mà `connect` khi đang nối dở sẽ hủy socket đó và mở socket mới ("WebSocket is closed before the connection is established").
   - Ở chế độ cộng tác, `NodeIdPlugin` chạy với `priority: 50` (`collab-node-id.ts`), dưới `YjsPlugin` (100). Plate xếp plugin theo `priority` giảm dần rồi bọc lần lượt, nên với độ ưu tiên mặc định `withYjs` nằm trong `withNodeId`: Yjs ghi thao tác tách khối (Enter) trước khi NodeId đổi `id` của khối mới. Kết quả là tài liệu có hai khối trùng `id` và mỗi máy tự gán một `id` khác cho khối đó. Không đẩy `YjsPlugin` lên cao hơn được, vì khi đó `HistoryPlugin` sẽ đè hoàn tác của Yjs.
   - MVP hiện danh sách người đang mở (awareness) cạnh editor. Con trỏ của người khác trong chữ cần thêm `@slate-yjs/react`, để bước sau.
8. **Kiểm thử.**
   - `node:test`: dựng máy chủ ở cổng 0 cùng hai provider thật (Node, `ws`), kiểm đồng bộ, chỉ đọc khi thiếu quyền, từ chối khi sai `Origin` hoặc không có phiên, seed từ mô tả, bản chiếu về `Task.description` không tăng `version`, PATCH thay nội dung tài liệu đang mở.
   - Thử trên trình duyệt bằng hai tab. Không sửa nhiệm vụ thật; cần nhiệm vụ thử thì hỏi người dùng.

## Kết quả MVP (21/10/2026)

Đo trên một bộ dev riêng: api 3200, web 3201, máy chủ cộng tác 3202, CSDL `qcet_test`, `FEATURE_FLAG_TASK_COLLAB=true`. Nhiệm vụ và người dùng là dữ liệu thử tạo riêng, không đụng nhiệm vụ thật. Mỗi phiên Playwright đăng nhập một người dùng.

- **Hai người cùng sửa.** Chữ của hai bên hội tụ. Hàng "Đang cùng sửa" có avatar của người kia (cao 20 px, chữ 12 px, avatar 16 px) và tự tắt khi người kia rời trang. Người cuối rời đi thì mô tả được chiếu về `Task.description`, `version` vẫn là 1. Mỗi trang mở đúng một WebSocket, console không có lỗi hay cảnh báo.
- **Tách khối.** Trước khi sửa thứ tự plugin (Decision 7), `id` bị trùng và hai máy lệch nhau. Sau khi sửa, `id` giống nhau ở mọi máy và không trùng. Test hồi quy: `apps/web/tests/collab-node-id.test.ts`.
- **Người chỉ có quyền xem.** Editor có `contenteditable="false"`; chữ người đó gõ không tới ai, nhưng chữ người khác gõ hiện ngay. Phía máy chủ thì `apps/api/tests/collab-server.test.ts` kiểm scope `readonly`.
- **Không nối được máy chủ** (chặn `/collab` bằng `routeWebSocket`). Trong lúc chờ, trang hiện mô tả đã lưu ở chế độ chỉ xem. Cảnh báo hiện sau khoảng 10 s kể từ khi editor gắn (11,5 s tính từ lúc điều hướng). Đưa tiêu điểm vào "Thử lại" rồi Enter thì mở socket mới và cho sửa. Ở 390 px, cảnh báo xuống hai dòng (cao 36 px) và trang không cuộn ngang.
- **Lưu ý khi viết kịch bản thử.** Playwright gõ phím chưa tới 1 ms sau cú click, trước khi trình duyệt phát `selectionchange`. Khi đó slate-react coi vùng đích của `beforeinput` là chỗ "người dùng chưa chọn": chèn ký tự đầu vào đó rồi trả con trỏ về vị trí cũ, nên các ký tự sau rơi vào chỗ cũ. Editor thường (hộp tạo việc) bị y hệt, nên đây không phải lỗi cộng tác. Người dùng thật không gặp, vì khoảng cách giữa click và phím luôn dài hơn nhiều. Kịch bản nên chờ ≥ 100 ms sau click rồi mới gõ.

## Alternatives Considered

1. **Khóa mềm "đang có người sửa".** Không chọn: người dùng chọn sửa trực tiếp.
2. **y-webrtc (ngang hàng).** Bị bác: cần máy chủ báo hiệu, không có chỗ kiểm quyền hay lưu trạng thái, và dữ liệu đi giữa các máy người dùng.
3. **Dịch vụ cộng tác tách container riêng.** Để sau: thêm một dịch vụ phải vận hành, trong khi qcet-api đã có CSDL, phiên và phân quyền. Mã đặt trong một thư mục riêng (`apps/api/src/server/collab/`) để tách ra được khi cần.
4. **Custom server cho Next để dùng chung cổng 3000.** Bị bác: thay `next start` của bản standalone, rủi ro với cách build và deploy hiện tại; một cổng nội bộ cộng một luật cloudflared đơn giản hơn.
5. **Dịch vụ cộng tác có sẵn (Liveblocks…).** Bị bác: nội dung chỉ đạo rời khỏi hạ tầng của trường.
6. **Hocuspocus v4.** Chưa được: `@platejs/yjs` 53.2.0 đòi `@hocuspocus/provider ^3.4.0`.
7. **Client seed nội dung ban đầu (`init({ value })`, trạng thái tất định của Plate).** Bị bác: hai client có bản mô tả khác nhau (một tab cũ) sẽ seed ra hai bản khác nhau và nội dung bị nhân đôi; seed ở máy chủ thì chỉ có một nguồn.

## Consequences

### Tích cực
- Nhiều người cùng sửa một mô tả mà không mất chữ của nhau, không còn 409 giữa những người đang gõ.
- Không thêm dịch vụ; quyền và phiên dùng lại của REST.
- Cờ tắt thì hành vi y như cũ; bật hay tắt không cần migration ngược.

### Tiêu cực / giới hạn đã biết
- Tài liệu đang mở nằm trong bộ nhớ của một process: chạy nhiều bản qcet-api phải thêm `@hocuspocus/extension-redis`. Hiện production chạy một container.
- `@platejs/yjs` kéo theo `y-webrtc`, `simple-peer`, `y-indexeddb` dù không dùng. Từ 22/10/2026 phần này nằm trong `task-collab-runtime.ts`, chỉ tải khi cờ bật (trước đó vào bundle của mọi trang có hộp tạo việc, ~1MB bản dev).
- Cờ `taskCollab` từ 22/10/2026 đi cùng trang: layout gốc đọc `getRuntimeConfig()` ở server và đưa xuống qua `RuntimeFeaturesProvider`, nên trang chi tiết không còn dựng editor thường rồi đổi sang cộng tác. Tối thiểu vẫn dựng hai editor theo thiết kế: bản chỉ xem tới lần đồng bộ đầu, rồi bản cộng tác. Server không đọc được cờ thì client tự tải như trước và editor có thể đổi chế độ một lần.
- Hệ quả của bản chỉ xem: phím gõ trước lần đồng bộ đầu bị bỏ. Đo 22/10/2026 trên bộ thử qcet_test (dev): tải lại trang chi tiết, bấm vào mô tả rồi gõ "/" thì 2/2 lần mất ký tự, menu "/" không mở; tắt cờ thì 6/6 lần giữ. Trước khi bật cờ cho người dùng: đệm phím gõ sớm rồi phát lại sau đồng bộ, hoặc báo "Đang kết nối" và chưa nhận con trỏ.
- Đo 22/10/2026 trên bản dev: cả khối `task-detail-main` của trang chi tiết bị React vẽ lại phía client lúc hydrate (khối stream `S:2` không được hydrate), kể cả khi cờ tắt, làm editor dựng thêm một lần. Nguyên nhân không nằm ở cộng tác: React 19.2 hiện khung trang stream theo đợt (~300ms, mốc `$~`), và provider ở shell đổi context trong lúc đó (phiên `/api/auth/me` về sau hydrate, `LazyMotion` tải lười, `isMounted`). Đã sửa cùng ngày: phiên đọc ở server truyền vào `AuthProvider`, motion nạp đồng bộ, bỏ state lúc mount; đo lại 8/8 lần hydrate đúng (`apps/web/tests/shell-hydration-stability.test.ts`).
- Trong `next dev`, sửa mã máy chủ cộng tác phải khởi động lại dev server: instrumentation chỉ chạy một lần.
- Quyền chỉ kiểm lúc kết nối; mất mạng khi đang gõ thì thay đổi giữ trong bộ nhớ tab, kết nối lại thì gộp, nhưng đóng tab lúc mất mạng thì mất (MVP chưa dùng IndexedDB).
- Production cần thêm luật `/collab` trong `cloudflared.yml` (đặt trước luật web, cho từng hostname), mở `COLLAB_PORT` trong mạng compose và đặt `COLLAB_HOST=0.0.0.0` cho container api; deploy api trước hoặc cùng web.
- Ảnh đang tải lên nằm trong tài liệu với URL `blob:` tới khi tải xong; người khác thấy ô ảnh lỗi trong vài giây đó (bản chiếu về mô tả bỏ khối này).
- Chưa có lịch sử phiên bản hay xem ai sửa đoạn nào; audit chỉ biết lần ghi mô tả cuối (`updated_by_id` của bảng mới).
