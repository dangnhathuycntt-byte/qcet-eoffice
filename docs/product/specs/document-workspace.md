# SPEC — Document Workspace (Quick View + Full Page + Multi-file Viewer)

> Trạng thái: **v4 — kiến trúc đã duyệt; C1 (phân quyền) đã sửa và kiểm thử, chưa commit; WS0 đã ghi baseline; tiếp theo WS-E2E** (2026-10-09). Chưa triển khai WS1–WS6.
> Quy trình: Codex review kế hoạch và quyết định ("bộ não"); Claude thực thi và kiểm thử.
> Ký hiệu: **[ĐÃ KIỂM]** = đọc trực tiếp từ code; **[GIẢ THUYẾT]** = chưa kiểm chứng, cần đo/kiểm ở WS0; **[v2]** = thêm/sửa theo phản hồi duyệt lần 1; **[v3]** = thêm/sửa theo phản hồi duyệt lần 2.

## Lịch sử thay đổi

| Phiên bản | Ngày | Nội dung |
|---|---|---|
| v1 | 2026-10-09 | Bản audit + đề xuất đầu tiên. |
| v2 | 2026-10-09 | Duyệt định hướng Hybrid Quick View + Full Page. Chốt D1–D13 (§14). Bổ sung: độ rộng tối thiểu danh sách và breakpoint theo không gian workspace (§6.1, §10); tách trích xuất chữ khỏi dựng trang để tìm kiếm toàn văn bản khi đã ảo hóa trang (§7.2); placeholder theo kích thước từng trang (§7.3); danh sách tệp thu gọn ở Quick View, rail + bộ chọn tệp ở Full Page (§7.1); máy trạng thái lịch sử (§6.3); E2E Playwright (§12.2, WS-E2E); điều kiện xóa code cũ ở WS6; checkpoint working tree trước WS0 (§15). Chuyển file từ `docs/specs/` sang `docs/product/specs/`. |
| v3 | 2026-10-09 | Duyệt kiến trúc, đồng ý D1–D14. Sửa §6.3/E4: lịch sử trình duyệt theo hành vi chuẩn (Back đóng pane, Forward có thể mở lại, không yêu cầu xóa forward entry; deep link đóng bằng replace; kiểm URL + focus thực tế). D15: danh sách tệp Quick View mở khi ≤ 5 tệp, thu gọn khi > 5, nhớ lựa chọn của người dùng. WS6 thêm production build + Docker (§11, §13, D16). Playwright: DB test riêng, fixture xác định, auth state không commit, không tuyên bố pass khi chưa chạy được (§12.2). Kết quả rà checkpoint và review bảo mật C1 (§15). |
| v4 | 2026-10-09 | D16: ưu tiên Node 24 (đã xác minh `npm ci`, typecheck, `next build` trên 24.18; Docker không thực hiện theo chỉ đạo). D17: nhiệm vụ `SCHOOL` và người tạo nhiệm vụ **không** cấp quyền đọc; chỉ đơn vị chủ trì nhiệm vụ liên kết (đơn vị xử lý) được tính; bộ lọc danh sách thu hẹp theo. S-1: kiểm quyền + nhật ký khi đổi `linkedTaskId`, trong transaction có khóa. Sửa nhận định sai ở v3 về phạm vi phủ của `getDocumentById`. §15 viết lại theo kết quả; §15.7 baseline WS0. |

## Context

Phân hệ Văn bản đang có 3 cách xem chi tiết khác nhau (drawer văn bản đến/tờ trình, drawer văn bản đi, 2 trang full page) và thêm 1 overlay PDF toàn màn hình. Mỗi nơi tự dựng metadata, danh sách tệp và trình xem PDF. Drawer là modal nên danh sách bị khóa; deep link chỉ chạy khi văn bản nằm trong trang hiện tại; full page chưa dùng rail và trình xem nhiều tệp mới. Mục tiêu: một bộ component dùng chung cho Quick View (non-modal, resize, duyệt nhanh) và Full Page (ưu tiên PDF, deep link), trình xem nhiều tệp đáng tin cậy, không đổi nghiệp vụ/API/DB. Phong cách bám Task Detail hiện tại (Quiet Minimal); không redesign phần đang tốt.

**Lưu ý hiện trạng repo:** working tree có ~89 file chưa commit, phần lớn thuộc phân hệ Văn bản (rail, file viewer, pdf canvas, `react-pdf` mới thêm). SPEC audit trên working tree đó; trước WS0 cần checkpoint (§15).

---

## 1. Audit hiện trạng (dẫn chứng code)

### 1.1 Danh sách và trạng thái
| Hạng mục | Hiện trạng [ĐÃ KIỂM] | Đánh giá |
|---|---|---|
| Trang | `src/app/documents/page.tsx` → `DocumentRegistryView` (client) | Giữ |
| Fetch danh sách | `document-registry-view.tsx:120-170` fetch `/api/documents` khi `filters` đổi, có AbortController | Giữ |
| Filter/URL | `src/hooks/use-document-url-filters.ts`: filter trên URL, `replace` + `scroll:false`, `preserveOtherParams` | Giữ, dùng lại cho `docId`/`file` |
| Chọn nhiều | `selectedIds` cục bộ, reset theo `listKey` | Giữ |
| Deep link `?docId=` | `registry-view:173-179` chỉ tìm trong **trang đang tải**, khớp mờ cả `documentNumber.includes`/`summary.includes`; không ghi `docId` lên URL | **Sửa**: khớp đúng id, fetch trực tiếp khi không có trong trang, ghi/xóa param khi mở/đóng |
| Nguồn `docId` | `src/lib/notification-triage.ts:451-567` sinh `/documents?docId=…` | Giữ tương thích |
| Cột bảng | **[v2]** `registry/document-ledger.tsx:473-562` ẩn/hiện cột theo **viewport** (`hidden xl:block`, `lg:inline`) | **Sửa**: chuyển sang container query, nếu không bảng sẽ chật khi pane mở trên màn rộng |
| Lưu scroll khi rời trang | Không có. Danh sách fetch phía client nên scroll restoration của Next không có dữ liệu để bám [GIẢ THUYẾT: mất vị trí khi back từ full page] | **Bổ sung** |
| Code không dùng | `document-split-view.tsx` (622 dòng) chỉ được `tests/document-split-view.test.ts` import; `document-workspace.tsx` không ai dùng; `react-resizable-panels` có trong deps nhưng `src/` không import | Xử lý ở WS6 theo điều kiện |

### 1.2 Quick View hiện tại (drawer)
| Hạng mục | Hiện trạng [ĐÃ KIỂM] |
|---|---|
| Văn bản đến / tờ trình | `document-detail-dialog.tsx`: Vaul drawer **modal có overlay**, `resizable` 440–1200, mặc định 840. Dữ liệu là **dòng danh sách đã map** (`OfficialDocument`), không fetch chi tiết |
| Văn bản đi | `document-outgoing-detail-view.tsx`: drawer gần như sao chép, nhưng **có fetch** `/api/documents/[id]` trong registry (`registry-view:221-242`) |
| Resize | `src/components/ui/drawer.tsx:96-140`: kéo chuột, **không có bàn phím**, độ rộng **không nhớ** |
| Focus/Escape | `use-drawer-focus.ts` (trả focus), `popover-escape-guard.ts` (Escape đóng popover trước drawer). Giữ ý tưởng |
| Vào Full Page | **Không có** nút |
| Toàn màn hình | Rail gọi `onFullscreen` → **đóng drawer**, mở overlay riêng trong registry (`registry-view:376-402`) dùng layout `fill` cũ, **chỉ 1 tệp**, mất trạng thái |
| Phần dùng chung | `document-detail-parts.tsx`: `DocumentTitleBlock`, `MetaInline`, `DetailsPopover`, `LinkedTaskSection/Row`, `CollapsibleSection`, `AttachmentRow`, `DocumentDrawerBody` (`@container/doc`) |

### 1.3 Full Page hiện tại
| Hạng mục | Hiện trạng [ĐÃ KIỂM] |
|---|---|
| Route | `/documents/incoming/[id]`, `/documents/outgoing/[id]` (server, `force-dynamic`, auth + `authorize('document.read')` + `canReadDocument`; không có quyền → `notFound()`) |
| Tờ trình | **Không có** route full page |
| Liên kết tới | `action-inbox-service.ts:218-302`, `global-search-view.tsx:659` |
| Layout | `DocumentDetailLayout` (main + inspector 288px), `AttachmentRow` + `FilePreview` (layout `fill`, khung cố định `min(72dvh,880px)`). **Không dùng** `DocumentFileViewer`/rail; PDF nằm dưới metadata |
| Thao tác | Văn bản đến: `executeAction` + `window.confirm/alert`, chọn nút theo role phía client; route action ở server vẫn kiểm quyền. Văn bản đi: `OutgoingActionPanel` |
| Loading/error | `loading.tsx`, `error.tsx` từng route; `DocumentLoadError` dùng chung |

### 1.4 Trình xem PDF
| Hạng mục | Hiện trạng [ĐÃ KIỂM] | Đánh giá |
|---|---|---|
| Render | `pdf-document-canvas.tsx`: `react-pdf@11` (canvas, fetch cùng origin + cookie; tránh `X-Frame-Options: DENY` của route tệp) | Giữ |
| Trang | Dựng **toàn bộ trang** cùng lúc; placeholder dùng chung tỉ lệ A4 `aspect-[1/1.414]` | **Sửa**: ảo hóa + kích thước theo từng trang |
| Tìm kiếm | Đã độc lập với việc dựng: duyệt `pdf.getPage(i).getTextContent()` mọi trang, tô sáng qua `customTextRenderer`, cuộn tới `<mark>` — chỉ chạy được vì mọi trang đều đã dựng | **Sửa**: giữ chỉ mục chữ riêng, điều hướng tới trang chưa dựng |
| Lỗi | `describeLoadError`: 401/403, 404, PDF hỏng | Giữ, thêm hành động |
| Zoom | 50–200%, bước 15, 100% = vừa chiều rộng | Giữ |
| Điều hướng trang | **Không có** | **Bổ sung** |
| Wrapper | `document-pdf-viewer.tsx`: layout `fill` (toolbar ngang) và `flow` (rail dọc) | Hợp nhất về rail |
| Nhiều tệp | `document-file-viewer.tsx`: chỉ dựng 1 tệp, nhớ zoom + vị trí cuộn từng tệp (đo trong `[data-slot=document-drawer-body]`, thử lại mỗi 50ms), số trang biết sau khi mở | Giữ logic, bỏ phụ thuộc selector drawer |
| Rail | `document-viewer-rail.tsx`: `w-11` (44px), sticky, tooltip trái; nhóm tệp dạng vạch (thẻ hover tên/dung lượng/số trang, ↑↓) | Giữ; thêm nhóm Trang, nút "Tệp N" |
| Ảnh / loại khác | Ảnh có zoom; loại khác → "Tải về để xem" | Giữ |
| Cache | Route tệp trả `Cache-Control: private, no-cache, no-store` (`src/lib/storage.ts:28`); canvas keyed theo URL nên đổi tệp là tải lại. Comment "pdf.js cache tài liệu đã mở" [GIẢ THUYẾT: không đúng] | Đo ở WS0; không đổi header (D6) |

### 1.5 API, quyền, dữ liệu
- `GET /api/documents/[id]` [ĐÃ KIỂM]: trả `data` (DocumentItem: `attachments`, `directives`, `linkedTask`, `incomingWorkflow`, `outgoingWorkflow`, `signatures`) + `availableActions`; không có quyền → 403, không tồn tại → 404. Đủ cho Quick View cả 3 loại, **không cần API mới**.
- Khác biệt ghi nhận, không sửa: API dùng `canReadDocument(authUser, …)`, page dùng `canReadDocument(authContext, …)`; API trả 403, page trả 404.
- `DocumentAttachment` không lưu số trang → số trang chỉ biết khi mở tệp (không đổi DB).
- Route tệp `/api/files/[...path]`: kiểm quyền theo attachment, hỗ trợ Range, `X-Frame-Options: DENY`.
- Lịch sử: `GET /api/documents/[id]/audit-logs` + `DocumentAuditTimeline` (chỉ tải khi mở section).
- **[v4]** WIP ban đầu có **mở rộng quyền đọc** văn bản qua nhiệm vụ liên kết (`SCHOOL`, người tạo, đơn vị chủ trì). Theo D17, chỉ giữ "đơn vị chủ trì nhiệm vụ liên kết" như một đơn vị xử lý văn bản; xem §15.3.

### 1.6 Task Detail / Subtask Peek (chuẩn tham chiếu)
- `task-detail-page.tsx` + `task-detail-page.module.css:29-60`: desktop ≥1024px peek là **cột grid thứ 2, non-modal**, rộng `min(75vw, var(--subtask-peek-width))`; <1024px là overlay `fixed inset-0` + `aria-modal`.
- Resize: handle có **bàn phím** (←/→ 20px, Home đặt lại), double-click đặt lại, lưu `localStorage` (`qcet_subtask_peek_width`), clamp ở `subtask-peek-layout.ts`.
- URL `?subtaskId=` + nghe `popstate`.
- `SubtaskOutlineRail`: nguồn kiểu "vạch" mà rail tệp mô phỏng.

### 1.7 Kiểm thử
- Runner `node:test` + `tsx`, render bằng `renderToStaticMarkup`; **chưa có** Playwright, Testing Library, jsdom.
- Test liên quan: `document-split-view`, `use-document-url-filters`, `document-filter-url-updates`, `use-document-drawer-focus`, `served-file-url`, `document-api-routes`, `file-streaming-security`, `document-registry-subcomponents`, `document-ledger-columns`, `document-classification-linked-task`.
- Chưa có test cho `DocumentFileViewer`, rail, chuyển tệp.
- **[v2]** Hạ tầng cho E2E: có `prisma/seed.ts` (văn bản seed dùng đường dẫn tệp `.doc` cũ, không có bộ PDF nhiều tệp), DB test `qcet_test` tách khỏi dev, workflow `ci.yml`. Cần fixture riêng (§12.2).

---

## 2. Vấn đề UX cần giải quyết
1. Drawer modal khóa danh sách → duyệt nhiều văn bản phải đóng/mở liên tục.
2. Năm bề mặt xem chi tiết khác nhau; metadata văn bản đến trong drawer lấy từ dòng danh sách, văn bản đi thì fetch.
3. Không có lối từ Quick View sang Full Page; tờ trình không có Full Page.
4. Full Page đặt PDF dưới metadata trong khung cố định → diện tích đọc nhỏ.
5. Toàn màn hình mất danh sách tệp và trạng thái đọc.
6. Deep link không đáng tin (chỉ trang hiện tại, khớp mờ có thể mở nhầm).
7. Không có điều hướng trang; PDF dài dựng hết trang [GIẢ THUYẾT: tốn bộ nhớ, đo ở WS0].
8. Độ rộng drawer không nhớ, resize không dùng được bằng bàn phím.

---

## 3. User flows và tương tác

**F1 — Duyệt nhanh (chế độ pane, xem §6.1):** click dòng → pane Quick View mở bên phải, danh sách co lại nhưng vẫn cuộn/click/chọn được; dòng đang mở tô nền + `aria-current`. Click dòng khác → pane đổi nội dung, không đóng/mở lại. `j/k` hoặc ↑/↓ khi focus trong danh sách chuyển dòng; Enter mở vào pane. `Esc` (focus trong pane, không có popover mở) đóng pane và trả focus về dòng.
**F2 — Mở rộng:** nút "Mở trang đầy đủ" ở header pane → `/documents/<loại>/<id>?file=<attId>`, giữ tệp đang xem. Là `<Link>` thật nên Cmd/Ctrl-click mở tab mới.
**F3 — Quay lại:** Back từ Full Page → `/documents?…filters&docId=…` → khôi phục filter (URL), vị trí cuộn (sessionStorage), pane mở lại đúng văn bản.
**F4 — Deep link:** `/documents?docId=X` → pane mở văn bản X kể cả khi không thuộc trang hiện tại (fetch theo id); 403/404 hiện lỗi trong pane, không bao giờ mở văn bản khác.
**F5 — Đổi tệp:** Quick View: danh sách tệp thu gọn phía trên viewer, hoặc rail ("Tệp N", vạch). Full Page: rail + bộ chọn tệp. Chọn → viewer chuyển ngay, `file=` cập nhật (replace), khôi phục zoom/trang/vị trí của tệp đó.
**F6 — Toàn màn hình:** Fullscreen API trên chính phần tử viewer (không remount, giữ tệp/zoom/trang); thoát bằng Esc hoặc nút → về đúng vị trí đang đọc. Thiết bị không hỗ trợ (iPhone Safari) → điều hướng Full Page với `?file=`.
**F7 — Chế độ overlay (workspace hẹp, §6.1):** Quick View là overlay toàn khung (modal, Vaul như hiện tại); Full Page xếp dọc.

---

## 4. Wireframe cấu trúc

**Quick View (chế độ pane, non-modal):**
```
┌ sidebar ┬──── danh sách (≥ LIST_MIN, co giãn) ────┬┃┬────── Quick View (PANE_MIN–PANE_MAX, nhớ) ─────┐
│         │ toolbar + filter (giữ nguyên)             │┃│ Văn bản đến · Số đến 0028          [⤢][🖨][✕]  │ h-11
│         │ ▌dòng đang mở (bg-muted)                  │┃│ Trích yếu (text-xl)                             │
│         │  dòng… (cột ẩn theo container query)      │┃│ ● Đang xử lý · Khẩn · Hạn 12/10 · 123/BLĐ · Chi tiết ▾
│         │  dòng…                                    │┃│ [thao tác chính theo loại]                      │
│         │  phân trang                               │┃│ Nhiệm vụ liên kết (hàng gọn)                    │
│         │                                           │┃│ ▸ Luân chuyển và lịch sử                        │
│         │                                           │┃│ ▾ Tệp đính kèm 5            (thu gọn được) [v2] │
│         │                                           │┃│   • to-trinh.pdf · 12 trang · 2,4 MB  ✓         │
│         │                                           │┃│   • phu-luc-a.pdf · 1,1 MB                       │
│         │                                           │┃│ ┌────────── PDF (flow) ──────────┐ ┌──────┐      │
│         │                                           │┃│ │                                 │ │ rail │ 44px │
└─────────┴───────────────────────────────────────────┴┃┴─────────────────────────────────────┴──────┴──────┘
                                           resize handle (chuột + bàn phím)
```

**Full Page (≥1024px khả dụng, ưu tiên PDF):**
```
┌ breadcrumb: Văn bản đến › Số đến 0028/2026                                                       ┐
│ Trích yếu (text-xl) · meta 1 dòng · Chi tiết ▾ | thao tác chính                                  │
├──────────────────────────── viewer (cuộn riêng, chiếm phần còn lại) ───────────┬ rail ┬ panel ──┤
│ to-trinh.pdf ▾ (bộ chọn tệp) · 12 trang · 2,4 MB                         [v2]  │ 44px │ 320px   │
│                                                                                  │ công │ (ẩn/hiện│
│                       PDF                                                        │ cụ   │  qua    │
│                                                                                  │ ───  │  rail)  │
│                                                                                  │ Tệp N│ Thuộc   │
│                                                                                  │ ───  │ tính /  │
│                                                                                  │ ⓘ ⛓ ⟲│ NV / LS │
└──────────────────────────────────────────────────────────────────────────────────┴──────┴─────────┘
```
- **[v2]** Full Page không có danh sách tệp dạng khối; tên tệp ở đầu viewer là bộ chọn (mở cùng menu với "Tệp N").
- Rail Full Page có nhóm "Thông tin" (ⓘ Thuộc tính, ⛓ Nhiệm vụ liên kết, ⟲ Luân chuyển/lịch sử) mở **một** side panel 320px (non-modal, đóng bằng Esc/nút). Mặc định đóng; nhớ trạng thái mở trong `localStorage`.
- Hẹp hơn: header → meta → viewer (flow) → các section thu gọn.

---

## 5. Kiến trúc component và tái sử dụng

```
src/components/documents/workspace/            (mới, chỉ file cần thiết)
  use-document-detail.ts        fetch /api/documents/[id], abort, refresh(), trạng thái loading/error/403/404
  document-view-model.ts        map DocumentItem | IncomingDocumentDetail | OutgoingWorkflowDetail → DocumentViewModel (thuần, có test)
  document-pane-history.ts      [v2] hàm thuần quyết định push/replace/back (§6.3)
  document-pane-layout.ts       [v2] hàm thuần chọn chế độ pane/overlay + clamp độ rộng (§6.1)
  document-header.tsx           TitleBlock + MetaInline + DetailsPopover theo loại
  document-sections.tsx         phần theo loại: incoming (chỉ đạo, luân chuyển), outgoing (ActionPanel, stepper), linked task, audit
  document-quick-view.tsx       shell: header bar (loại·số, mở trang đầy đủ, in, đóng) + body; thay 2 drawer
  document-quick-view-pane.tsx  chế độ pane (cột grid + resize) / chế độ overlay (Vaul)
  document-full-page.tsx        shell Full Page, dùng chung header/sections/viewer
src/components/documents/pdf/                 [v2]
  pdf-text-index.ts             chỉ mục chữ theo trang, tách khỏi dựng trang (§7.2)
  pdf-page-geometry.ts          kích thước từng trang + tính cửa sổ/offset (§7.3)
```
Sửa tại chỗ, không viết lại:
- `document-file-viewer.tsx`: nhận scroll container (ref) thay cho selector cố định; `activeFileId`/`onActiveFileChange` điều khiển từ URL; `onPageChange`; prop `fileList: "collapsible" | "selector"` **[v2]** cho Quick View/Full Page.
- `pdf-document-canvas.tsx`: dựng trang theo cửa sổ dùng `pdf-page-geometry`, tìm kiếm dùng `pdf-text-index`, báo trang hiện tại, `scrollToPage(n)`.
- `document-viewer-rail.tsx`: thêm nhóm Trang, nút "Tệp N" + popover, roving focus; giữ vạch.
- `document-pdf-viewer.tsx`: bỏ layout `fill` sau khi Full Page/overlay chuyển sang rail.
- `document-detail-parts.tsx`: giữ; `AttachmentRow` dùng cho danh sách tệp thu gọn của Quick View **[v2]**; `FilePreview` bỏ khi hết nơi dùng.
- `registry/document-ledger.tsx`: **[v2]** đổi `hidden xl:block`/`lg:inline` sang container query trên vùng danh sách; không đổi cột hay thứ tự.
- `use-drawer-focus.ts`, `popover-escape-guard.ts`: dùng cho pane/overlay.
- Resize: tách logic handle của `subtask-detail-drawer.tsx:390-410` thành `src/components/ui/pane-resize-handle.tsx` (chuột, bàn phím, double-click, clamp, persist). Chỉ dùng cho Văn bản trong dự án này; **không** sửa task peek (D4).

Thay thế khi workstream tương ứng xong (xóa theo điều kiện WS6): `DocumentDetailDialog`, `DocumentOutgoingDetailView` (drawer), overlay toàn màn hình trong registry, thân trang `IncomingDocumentDetailView`/`OutgoingDocumentDetailView` (phần thao tác chuyển vào `document-sections`, giữ hành vi).

---

## 6. Routing, state, dữ liệu, quyền

### 6.1 Chế độ pane và độ rộng tối thiểu danh sách — [v2]
Chọn chế độ theo **độ rộng thực của vùng workspace** (phần tử bao danh sách + pane, đo bằng `ResizeObserver`), không theo viewport. Sidebar mở/thu gọn, kéo rộng sidebar, cửa sổ trình duyệt hẹp đều được tính.

Hằng số (giá trị đầu, chốt sau đo ở WS0 với bảng hiện tại):
| Tên | Giá trị | Căn cứ |
|---|---|---|
| `LIST_MIN` | 480px | Đủ cho cột chọn + trích yếu 2 dòng + trạng thái + hạn khi các cột phụ đã ẩn bằng container query [GIẢ THUYẾT, đo ở WS0] |
| `PANE_MIN` | 440px | Bằng `minWidth` drawer hiện tại |
| `PANE_DEFAULT` | 640px | Ngắn hơn drawer 840px vì danh sách vẫn hiện |
| `PANE_MAX` | 1100px | Gần `maxWidth` drawer hiện tại |

Quy tắc (hàm thuần `resolvePaneLayout(workspaceWidth, preferredWidth)`):
1. Nếu `workspaceWidth ≥ LIST_MIN + PANE_MIN` → chế độ **pane**; độ rộng pane = `clamp(preferred, PANE_MIN, min(PANE_MAX, workspaceWidth − LIST_MIN))`.
2. Ngược lại → chế độ **overlay** (modal, như drawer hiện tại).
3. Kéo resize không bao giờ làm danh sách < `LIST_MIN`; độ rộng người dùng chọn được lưu nguyên, chỉ phần hiển thị bị clamp (mở lại trên màn rộng thì có lại độ rộng cũ).
4. Đổi chế độ khi đang mở (thu gọn sidebar, đổi kích thước cửa sổ) không đóng pane, không mất văn bản/tệp đang xem; có hysteresis 24px để tránh nhảy qua lại ở ngưỡng.
5. Trong pane, cột phụ của bảng ẩn theo container query của vùng danh sách.

### 6.2 Routing
- Quick View: search param trên `/documents`: `docId=<id>` (giữ tên vì thông báo đang dùng) + `file=<attachmentId>` tùy chọn, ghi qua `useDocumentUrlFilters().updateUrl` (đã `preserveOtherParams`).
- Full Page: giữ `/documents/incoming/[id]`, `/documents/outgoing/[id]`. Thêm `/documents/[id]/page.tsx`: server kiểm quyền rồi `redirect` sang route theo loại; tờ trình (`TO_TRINH_NOI_BO`) hiển thị Full Page chung tại đây. Static segment `incoming|outgoing` thắng dynamic `[id]`. `?file=` chọn tệp ban đầu.
- **Không dùng Parallel/Intercepting Routes**: danh sách fetch client-side theo filter trên URL, full page là server component kiểm quyền bằng Prisma; intercept sẽ buộc pane đi qua server render, mất cơ chế đổi văn bản tức thì bằng `replace`, phải tách nhánh route cho 3 loại và xử lý soft/hard navigation khác nhau. Search param giữ state danh sách tự nhiên và đúng mẫu `?subtaskId=` đã có.

### 6.3 Lịch sử trình duyệt, URL và focus — [v3, thay bản v2]
Nguyên tắc: hành vi chuẩn của trình duyệt. **Back đóng Quick View; Forward có thể mở lại.** Không yêu cầu, không cố xóa forward entry, không chặn Back. Mỗi trạng thái có URL riêng sao chép/làm mới được.

Entry do pane tạo được đánh dấu bằng `history.state.__qcetDocPane = true` (giữ nguyên state của Next khi ghi; WS3 kiểm cách Next 15 merge `history.state`; phương án dự phòng: cờ trong `sessionStorage` keyed theo URL). Dấu chỉ dùng để phân biệt "vào từ danh sách" với "vào thẳng bằng deep link", không dùng để xóa lịch sử.

| Sự kiện | Hành động | URL sau | Focus sau |
|---|---|---|---|
| Mở từ danh sách (click dòng / Enter), pane đóng | **push** + đánh dấu | `…&docId=A` | nút Đóng trong pane (`use-drawer-focus`); nhớ dòng đã mở |
| Đổi văn bản (click dòng khác, j/k) | **replace** | `…&docId=B` (bỏ `file`) | giữ ở danh sách (dòng mới) khi đổi bằng bàn phím trong danh sách; về nút Đóng nếu đổi bằng chuột |
| Đổi tệp | **replace** | `…&docId=B&file=F` | giữ nguyên điều khiển vừa dùng |
| Đóng (✕ / Esc) khi entry hiện tại có dấu | **`history.back()`** | URL trước khi mở (danh sách không `docId`) | dòng đã mở nếu còn trong DOM, nếu không thì vùng danh sách |
| Đóng khi vào thẳng bằng deep link / thông báo / không có dấu | **replace** bỏ `docId`/`file` | `/documents?…filters` | dòng của văn bản vừa xem nếu có trong trang, nếu không thì vùng danh sách; **không** thoát khỏi app |
| **Back** (trình duyệt) khi pane mở | theo lịch sử → pane đóng | URL trước | như hàng "Đóng" |
| **Forward** (trình duyệt) | theo lịch sử → pane mở lại | `…&docId=A[&file=F]` | nút Đóng trong pane |
| Đổi filter/trang khi pane mở | **replace** (như hiện tại), **giữ** `docId` | đổi query | giữ nguyên |
| Mở trang đầy đủ (`<Link>`) | push (điều hướng thường) | `/documents/<loại>/<id>?file=F` | tiêu đề trang |
| Back từ Full Page | theo lịch sử | `/documents?…&docId=A&file=F` → pane mở lại | nút Đóng trong pane |
| Mở lại cùng văn bản đang mở | không làm gì | — | — |

Ghi chú:
- Sau `history.back()` để lại forward entry là **hợp lệ**; Forward mở lại đúng văn bản/tệp đó.
- Hàm thuần `planPaneHistory(event, { hasPaneMark })` trả về `{ op: "push" | "replace" | "back", url }`; không gọi `history` trực tiếp trong logic.
- `popstate` luôn đọc lại URL làm nguồn sự thật (đóng/mở pane, chọn tệp), không suy từ state cục bộ.

Kiểm chứng (bắt buộc, thực tế): unit test `planPaneHistory`; E2E E4 kiểm URL, `history.length`, chuỗi Back/Forward và vị trí focus; kiểm lại trên Chrome thật ở WS3 (§12.2).

### 6.4 State (nguồn duy nhất)
| State | Chủ sở hữu |
|---|---|
| filters, page, docId, file | URL (`useDocumentUrlFilters`) |
| dữ liệu chi tiết | `useDocumentDetail(docId)` (một instance, trong pane) |
| chọn nhiều | registry (như hiện tại) |
| zoom/trang/vị trí từng tệp | `DocumentFileViewer` trong phiên; Full Page lưu `sessionStorage` theo `docId:fileId` (D7) |
| chỉ mục chữ, kích thước trang | theo tệp đang mở, giải phóng khi đổi tệp (§7.2, §7.3) |
| độ rộng pane | `localStorage` `qcet_document_pane_width` |
| danh sách tệp Quick View mở/thu gọn | `localStorage` `qcet_document_files_pref` = `"open"` \| `"collapsed"`; **chưa có giá trị** thì theo mặc định theo số tệp (§7.1) |
| scroll danh sách | `sessionStorage` keyed theo query string (bỏ `docId`/`file`), khôi phục sau lần tải đầu |

### 6.5 Dữ liệu và race
- `useDocumentDetail`: AbortController mỗi lần `docId` đổi; chỉ commit kết quả khớp `docId` hiện tại; header hiện ngay từ dòng danh sách (nếu có) trong lúc tải.
- Sau thao tác workflow: `refresh()` chi tiết + refetch danh sách (như `onWorkflowUpdate` hiện tại).
- Đổi tệp nhanh: canvas keyed theo URL; số trang, kích thước trang, kết quả tìm chỉ ghi khi tệp còn active (token theo `fileId`).
- Không thêm API, không đổi DTO, không đổi header cache.

### 6.6 Quyền
- Quick View dựa hoàn toàn vào `GET /api/documents/[id]` (server authorize). 403 → "Bạn không có quyền xem văn bản này"; 404 → "Văn bản không tồn tại hoặc đã bị xóa". Không suy quyền dữ liệu từ role phía client.
- Thao tác: Quick View dùng `availableActions` từ API khi có. Văn bản đến Full Page **giữ nguyên** cách chọn nút theo role phía client (D13). **[v2]** WS0 xác minh mọi route `/api/documents/[id]/actions/*` mà Full Page gọi đều kiểm quyền ở server, ghi kết quả vào bảng baseline; route nào thiếu thì báo, không tự sửa trong dự án này.
- Tệp: lỗi 401/403/404 từ route tệp đã map sẵn.

---

## 7. Hành vi nhiều tệp PDF

### 7.1 Danh sách và bộ chọn tệp — [v2]
- 0 tệp: "Chưa có tệp đính kèm"; không dựng viewer/rail. Full Page: trạng thái rỗng ở vùng viewer.
- 1 tệp: không có danh sách tệp, không có nhóm tệp trên rail; tên + số trang + dung lượng một dòng trên viewer.
- ≥2 tệp: thứ tự từ một hàm sort duy nhất trong view model (`isOriginal` trước, rồi `createdAt`). Không gắn nhãn "công văn/phụ lục".
- **Quick View:** khối "Tệp đính kèm N" thu gọn được (`CollapsibleSection` + `AttachmentRow`) ngay trên viewer. **[v3]** Mặc định **mở** khi N ≤ 5, **thu gọn** khi N > 5 (khi thu gọn, dòng tiêu đề vẫn hiện tên tệp đang xem). Khi người dùng tự mở/thu gọn, lựa chọn được **ghi nhớ** (toàn cục, `localStorage`, bọc `try/catch`) và áp dụng cho mọi văn bản về sau, thay cho mặc định theo số tệp; `localStorage` không dùng được thì rơi về mặc định. Hàng ≤ 32px, tệp đang xem `aria-current` + nền nhẹ, tải về hiện khi hover. Rail vẫn có "Tệp N" để đổi tệp khi đã cuộn sâu.
- **Full Page:** không có khối danh sách; tên tệp ở đầu viewer là bộ chọn, cùng popover với nút "Tệp N" trên rail.
- Popover "Tệp N": rộng 256px, hàng ≤ 32px, tên truncate + `title` đầy đủ, dòng phụ `số trang · dung lượng`, ✓ tệp đang xem; ↑/↓/Enter/Esc; cao tối đa ~60vh có cuộn.
- Vạch tệp trên rail: giữ khi 2 ≤ N ≤ 8; N > 8 chỉ còn nút "Tệp N" (D1).
- Tệp không phải PDF/ảnh → "Không xem trước được loại tệp này" + Tải về. Ảnh → zoom.
- Trạng thái: đang tải trình xem / đang tải tệp / không có quyền / không tìm thấy / PDF hỏng / URL không an toàn, mỗi trạng thái có hành động (Thử lại, Tải về) khi hợp lý.
- **Bất biến:** tên tệp hiển thị, `aria-current` trong danh sách/menu, `?file=` và nội dung canvas luôn cùng `attachmentId`.

### 7.2 Tìm kiếm khi đã ảo hóa trang — [v2]
- **Tách hai luồng:** dựng trang (canvas + text layer) chỉ cho trang trong cửa sổ; **trích xuất chữ** chạy riêng trên `PDFDocumentProxy` (`getPage(i).getTextContent()`), không phụ thuộc trang đã dựng.
- `pdf-text-index.ts`: chỉ mục theo trang `{ page, items: normalizedString[] }`, xây **lười** ở lần tìm đầu tiên, tuần tự từng trang, nhường luồng chính giữa các trang (`setTimeout 0`), có token hủy khi đổi tệp/đóng viewer. Lưu theo tệp đang mở; đổi tệp thì bỏ chỉ mục cũ.
- Kết quả: danh sách hit `{ page, item, nth }` tính từ chỉ mục, cập nhật dần; ô tìm hiện "Đang tìm… trang x/y" cho tới khi xong, tổng số kết quả là số cuối cùng.
- Đến hit ở trang chưa dựng: `scrollToPage(page)` theo offset tính từ kích thước trang (§7.3) → trang vào cửa sổ và được dựng → text layer vẽ xong → `customTextRenderer` tô sáng → cuộn `<mark data-active>` vào giữa. Hit đang chọn giữ được khi đổi zoom.
- Giữ giới hạn hiện có: không bắt cụm từ bị tách qua hai đoạn chữ; tìm không phân biệt hoa thường, chuẩn hóa NFC. Tệp scan không có lớp chữ → "Không thấy kết quả trong lớp chữ của tệp" (như hiện tại).
- Test: hit ở trang 40/50 khi cửa sổ đang ở trang 1; đổi tệp giữa lúc đang xây chỉ mục không làm lẫn kết quả.

### 7.3 Kích thước placeholder theo từng trang — [v2]
- Sau `onLoadSuccess`, `pdf-page-geometry.ts` lấy kích thước **từng trang** qua `getPage(i).getViewport({ scale: 1, rotation })` (đã tính `/Rotate` của trang; chỉ đọc page dictionary, không vẽ). Đọc theo lô, ưu tiên các trang quanh vị trí hiện tại; trang chưa đo tạm dùng tỉ lệ của trang gần nhất đã đo (trang 1 nếu chưa có).
- Chiều cao trang i = `pageWidth × (hᵢ / wᵢ)`, với `pageWidth = containerWidth × zoom`; trang ngang và trang dọc cao khác nhau, trang khổ khác (A3, A5) giữ đúng tỉ lệ. Chiều rộng các trang bằng nhau (vừa khung) như hiện tại.
- Offset cộng dồn (prefix sum) dùng cho: cửa sổ dựng (trang hiện tại ± 2), `scrollToPage`, chỉ báo trang hiện tại, khôi phục vị trí.
- Khi một trang đo xong làm đổi chiều cao: giữ **neo cuộn** (trang đang đọc + phần trăm bên trong trang) để nội dung không nhảy.
- Vị trí đọc lưu dạng `{ page, offsetRatio }` thay vì pixel, nên khôi phục đúng sau khi đổi zoom hoặc độ rộng pane.
- Test thuần: bộ trang hỗn hợp (dọc A4, ngang A4, A3, trang xoay 90°) → chiều cao, offset, trang tại vị trí cuộn, khôi phục sau đổi zoom.

## 8. Rail công cụ (44px, trong vùng viewer, không che PDF)
Nhóm theo thứ tự: **Xem** (Phóng to, %, Thu nhỏ, Vừa chiều rộng) — **Trang** (trang/tổng, trước/sau; bấm số mở ô nhập) — **Tìm** — **Khung** (Toàn màn hình, Tải về; "Mở tab mới" nằm trong menu của nút Tải về — D11) — **Tệp N** — (Full Page) **Thông tin**. Divider mảnh giữa nhóm. Nút `size-8`, icon 16px nét 1,5, tooltip trái, `role=toolbar` dọc, ↑↓ di chuyển giữa nút (roving tabindex). Popover đóng bằng Esc/click ngoài, không đóng pane (đã có guard). Vùng viewer < 520px: ẩn nhóm Trang (số trang vẫn ở dòng tên tệp).

## 9. Design (Quiet Minimal)
- Bám Task Detail hiện tại và thang trong `AGENTS.md`/`DESIGN.md`: nội dung `text-compact`, phụ `text-xs`, control `h-7`, hàng ≤ 32px, popover 224–256px, icon 1,5px; trích yếu giữ `text-xl` như drawer hiện tại.
- Pane: nền `bg-card`, ngăn với danh sách bằng một border `border-border/60`; **không shadow nặng, không overlay** ở chế độ pane.
- Full Page: bỏ khung `rounded-xl border` lồng trong main card; viewer nền `bg-muted/50`, trang giấy `shadow-xs`.
- Không thêm badge/màu mới; trạng thái dùng `TaskStatusCircle`. Không đổi giao diện các phần đang ổn (toolbar sổ, bảng, bulk toolbar, form vào sổ/soạn, ký số).

## 10. Responsive, a11y, hiệu năng
- Chế độ pane/overlay theo không gian workspace (§6.1), không theo viewport.
- Container query: `@container/doc` cho nội dung pane (đã có), thêm cho vùng danh sách và rail.
- A11y: pane `role="region"` + `aria-label="Chi tiết văn bản …"` (non-modal, không trap focus); overlay `role=dialog aria-modal`. Resize handle `role=separator` có `aria-valuenow/min/max`, bàn phím. Live region thông báo đổi tệp/trang/số kết quả tìm. Dòng đang mở `aria-current`.
- Hiệu năng: dựng trang theo cửa sổ; `react-pdf` dynamic import (`ssr:false`); không tải trước tệp khác; chỉ mục chữ lười. Đo heap khi đổi 5 tệp × 5 vòng (mục tiêu: heap sau GC quay về ±20% mức ban đầu — [GIẢ THUYẾT], chốt sau WS0).

---

## 11. Workstreams (thứ tự, phụ thuộc)

| WS | Nội dung | Phụ thuộc | Rủi ro | Acceptance |
|---|---|---|---|---|
| **WS-1** Checkpoint **[v2]** | Theo §15: rà diff, đề xuất nhóm commit, chờ xác nhận; không tự commit | — | Commit nhầm, gộp thay đổi phân quyền với UI | Người dùng xác nhận checkpoint |
| **WS0** Baseline | `npm run typecheck`, `npm run lint`, test liên quan (§1.7) → ghi pass/fail/skip. Chụp hiện trạng drawer/full page. Đo request + heap khi đổi tệp; đo `LIST_MIN` thực tế; xác minh giả thuyết cache/scroll; xác minh quyền server của các action route (§6.6) | WS-1 | Baseline đỏ do WIP | Bảng baseline trong SPEC; lỗi có sẵn được liệt kê |
| **WS-E2E** Hạ tầng E2E **[v2]** | Thêm `@playwright/test` (devDependency) + `playwright.config.ts`; script fixture xác định trên **DB test riêng** (quy tắc §12.2) các văn bản 0/1/5/6/12 tệp và bộ PDF sinh sẵn (trang ngang/dọc/khổ khác, có lớp chữ, ≥50 trang cho một tệp), người dùng có/không có quyền; đăng nhập bằng tài khoản fixture; smoke test hiện trạng (mở danh sách, mở drawer) để chứng minh hạ tầng chạy. Chưa đổi CI (D12) | WS0 | Cần DB test + dev server cổng 3001; tải trình duyệt Playwright | `npx playwright test` chạy xanh smoke hiện trạng trên máy local |
| **WS1** Viewer core | `pdf-page-geometry` + ảo hóa trang + trang hiện tại/nhảy trang; `pdf-text-index` + tìm ở trang chưa dựng; `DocumentFileViewer` nhận scroll container + `activeFileId` điều khiển; danh sách tệp thu gọn / bộ chọn; rail: nhóm Trang, "Tệp N", roving focus; Fullscreen API | WS0 | Neo cuộn khi trang đo xong; Vaul transform ảnh hưởng fullscreen ở overlay | Test thuần §7.2/§7.3; bất biến file↔preview; N=0/1/5/12; drawer hiện tại vẫn chạy |
| **WS2** View model + hook | `document-view-model.ts` (3 nguồn → 1 model, sort tệp), `use-document-detail.ts` (abort, 403/404) | WS0 | Lệch field giữa DocumentItem và DTO trang | Test mapper 3 loại; hook bỏ kết quả cũ khi đổi id |
| **WS3** Quick View | `DocumentQuickView` + `document-pane-layout` (§6.1) + `pane-resize-handle`; container query cho bảng; URL `docId/file` theo `document-pane-history` (§6.3); deep link fetch theo id; nút Mở trang đầy đủ; ↑↓/j/k; gỡ đường dẫn tới 2 drawer + overlay toàn màn hình (chưa xóa file) | WS1, WS2 | `/documents` phải thành chiều cao cố định để danh sách/pane cuộn riêng (nhánh class trong `app-shell.tsx`, giống `isInbox`) | Danh sách ≥ `LIST_MIN` và tương tác được; đổi văn bản không remount pane; độ rộng nhớ; deep link ngoài trang mở đúng; 403/404; history đúng bảng §6.3; chọn nhiều/filter không đổi; E2E nhóm Quick View xanh |
| **WS4** Full Page | `DocumentFullPage` dùng chung header/sections/viewer; rail Thông tin + side panel; bộ chọn tệp; `/documents/[id]` redirect + tờ trình; đọc `?file=`; `loading.tsx` theo bố cục mới | WS1, WS2 | Thao tác văn bản đến (role client) phải giữ nguyên | Direct URL/refresh/back-forward; tệp theo `?file=`; nút workflow hiện đúng như trước theo role; E2E nhóm Full Page xanh |
| **WS5** Trả về danh sách | Lưu/khôi phục scroll danh sách, focus lại dòng `docId` | WS3 | Khôi phục trước khi dữ liệu về | Back từ Full Page giữ filter, scroll, pane (E2E) |
| **WS6** Dọn, build và tài liệu **[v3]** | (1) Xóa implementation/test cũ **chỉ khi** đủ điều kiện dưới đây. (2) Cập nhật `DESIGN.md` mục Văn bản. (3) Chạy regression checklist. (4) **Production build và đóng gói** theo "Xác minh phát hành" bên dưới | WS3–5, WS-E2E | Test cũ import file bị xóa; mất coverage; build/Docker lỗi do `pdfjs-dist` (D16) | typecheck/lint/test/E2E xanh so với baseline; build Next.js thành công; image Docker build + chạy được trang xem PDF |

**[v2] Điều kiện xóa ở WS6** — với từng file/test cũ (`document-split-view.tsx` + test, `document-workspace.tsx`, `DocumentDetailDialog`, `DocumentOutgoingDetailView` drawer, layout `fill`, `FilePreview`, overlay toàn màn hình):
1. `rg` trên `src/` và `tests/` không còn import/tham chiếu (kể cả import động `dynamic(() => import(...))`, re-export ở `index.ts`, chuỗi tên file trong test).
2. Mỗi assertion có ý nghĩa của test cũ đã có test tương đương trên implementation mới (liệt kê ánh xạ test cũ → test mới trong báo cáo WS6); assertion chỉ kiểm chi tiết của implementation cũ thì ghi rõ lý do bỏ.
3. `npm run typecheck`, `npm run lint`, test liên quan và E2E xanh sau khi xóa.
4. Không đạt cả ba → giữ file, ghi lại để xử lý sau.

**[v3] Xác minh phát hành (WS6, trước release)** — người dùng đã yêu cầu trực tiếp chạy build ở bước này (ngoại lệ có chủ đích so với quy ước "không dùng `next build` để verify" trong `AGENTS.md`; chỉ áp dụng cho WS6):
1. `npm run build` (Next.js production) thành công, **trên đúng phiên bản Node dùng khi phát hành** (xem D16: `.nvmrc` 20.18.0 và `Dockerfile` `node:20-alpine`, trong khi `pdfjs-dist@6.3.289` khai báo `engines.node >=22.13.0 || >=24`). Ghi cảnh báo `EBADENGINE`/lỗi nếu có.
2. Chỉ dùng thư mục build riêng (không xóa `.next/` đang dùng bởi dev server; ví dụ build ở worktree/bản sao tạm hoặc `distDir` riêng nếu repo hỗ trợ).
3. ~~Docker~~ **[v4]** Không thực hiện build/deploy Docker theo chỉ đạo của chủ dự án. Image đã build thử cục bộ trong worktree tạm không được dùng cho phát hành.
4. Kiểm tra kích thước bundle: `react-pdf`/`pdfjs-dist` chỉ nằm trong chunk tải theo yêu cầu (dynamic import), không vào bundle của `/documents` ban đầu; so với `docs/architecture/PERFORMANCE_BUDGETS.md`.
5. Kiểm trình duyệt mục tiêu: `pdfjs-dist` 6.x yêu cầu tính năng JS mới [GIẢ THUYẾT: Safari/iOS cũ có thể lỗi]; xác minh trên danh sách trình duyệt hỗ trợ của dự án, nếu thiếu thì dùng bản `legacy` của `pdfjs-dist` hoặc ghi giới hạn.
6. Nếu không có Docker hoặc không build được trên môi trường hiện tại: báo **"chưa xác minh"**, không coi là pass.

Sau mỗi WS: typecheck + lint + test liên quan (+ E2E khi đã có), kiểm trên trình duyệt, báo cáo ngắn rồi mới sang WS tiếp.

## 12. Kiểm chứng và regression checklist

### 12.1 Unit/component (node:test, có sẵn)
View model; sort tệp; chọn tệp/khôi phục; `pdf-page-geometry` (trang hỗn hợp, xoay, prefix sum, neo cuộn, khôi phục sau đổi zoom); `pdf-text-index` (hit trang xa, hủy khi đổi tệp); `resolvePaneLayout` (ngưỡng, clamp, hysteresis); `planPaneHistory` (mọi dòng bảng §6.3); parse/ghi `docId`/`file`; SSR markup rail (aria, nút theo N=0/1/5/12), pane (region/dialog theo chế độ).

### 12.2 E2E Playwright (smoke quan trọng) — [v2, bổ sung v3]
| # | Kịch bản | Kiểm |
|---|---|---|
| E1 | Deep link `?docId=<id ngoài trang 1>` | Pane mở đúng văn bản (so id/trích yếu); id gần giống/id là chuỗi con của trích yếu không mở nhầm |
| E2 | Deep link văn bản không có quyền / id không tồn tại | Pane hiện thông báo 403/404, danh sách vẫn dùng được; Full Page tương ứng trả trang 404 |
| E3 | Mở / đổi / đóng pane | Danh sách vẫn click được khi pane mở; đổi văn bản không remount pane; ✕ và Esc đóng, focus về dòng |
| E4 | Back/Forward, URL, focus **[v3]** | Từ danh sách: mở A (+1 history entry) → đổi B (replace, `history.length` không đổi) → đổi tệp F (replace). Back → pane đóng, URL về danh sách không `docId`; Forward → pane mở lại đúng B + F. Đóng bằng ✕/Esc khi mở từ danh sách → URL về danh sách (forward entry còn lại là hợp lệ, không bị kiểm là phải xóa). Deep link trực tiếp → đóng bằng replace, vẫn ở `/documents` (không thoát app, Back sau đó rời khỏi trang đúng như trước khi vào). Kiểm tại mỗi bước: URL, `history.length`, `document.activeElement` (nút Đóng khi mở/Forward; dòng đã mở khi đóng/Back), refresh giữ nguyên pane |
| E5 | Resize | Kéo và phím ←/→/Home đổi độ rộng; danh sách không < `LIST_MIN`; reload giữ độ rộng; thu hẹp cửa sổ chuyển sang overlay không mất văn bản đang xem |
| E6 | Bàn phím | ↑/↓/j/k chuyển dòng, Enter mở; Tab qua rail; ↑↓ trong rail và menu tệp; Esc đóng popover trước rồi mới đóng pane |
| E7 | Chuyển 5 PDF | Lần lượt và nhanh liên tiếp: tên tệp, `aria-current`, `?file=` và nội dung canvas (text layer trang 1) khớp; không lỗi console |
| E8 | Khôi phục trạng thái đọc | Tệp A zoom 130% + trang 7 → sang B → về A: zoom và trang khôi phục; Full Page qua reload (sessionStorage) |
| E9 | Toàn màn hình | Vào/thoát fullscreen giữ tệp, zoom, trang; bị chặn Fullscreen API thì điều hướng Full Page với `?file=` |
| E10 | Tìm ở trang chưa dựng | Tìm từ chỉ có ở trang ≥40 → tổng kết quả đúng, nhảy tới và tô sáng |
| E11 | Full Page | Direct URL, refresh, `?file=` chọn đúng tệp, Back về danh sách giữ filter + scroll + pane |
| E12 | 0 / 1 / 12 tệp | 0: không viewer; 1: không có nhóm tệp; 12: không vạch, có "Tệp 12", menu cuộn được |
| E13 | Danh sách tệp Quick View **[v3]** | 5 tệp: mở sẵn; 6 tệp: thu gọn sẵn; người dùng đổi trạng thái → mở văn bản khác (kể cả khác số tệp) và reload vẫn giữ lựa chọn; xóa `localStorage` → quay về mặc định theo số tệp |

**Quy tắc môi trường E2E [v3] (bắt buộc):**
1. **DB riêng:** E2E chạy trên `qcet_test` (cách runner hiện có suy ra từ `DATABASE_URL`, `scripts/run-tests.mjs:276`), **không bao giờ** trên `qcet_eoffice` (dev) hay dữ liệu vận hành. `global-setup` từ chối chạy nếu tên DB không phải `qcet_test`/`qcet_ci` hoặc `NODE_ENV=production`. Cần dev server riêng trỏ vào DB đó (cổng 3001 sau khi kiểm tra cổng; không kill server đang chạy, không xóa `.next/`).
2. **Fixture xác định:** script seed riêng cho E2E (không dùng `prisma/seed.ts`), id cố định, tạo lại từ đầu mỗi lần chạy: người dùng theo vai (có quyền / không quyền / thuộc đơn vị khác / chỉ liên kết nhiệm vụ), văn bản đến/đi/tờ trình với 0/1/5/6/12 tệp, bộ PDF sinh bằng script (trang dọc/ngang/khổ khác/xoay, có lớp chữ, một tệp ≥ 50 trang, một tệp hỏng, một tệp scan không lớp chữ), tệp ghi vào thư mục upload riêng của môi trường test. Không dùng `TRUNCATE ... CASCADE` trên bảng chung (đã từng xóa sạch bảng `users` khi FK cũ còn sót); dọn bằng xóa theo id fixture.
3. **Auth state không commit:** `storageState` ghi vào `playwright/.auth/` (cùng `test-results/`, `playwright-report/`, `blob-report/`) và thêm vào `.gitignore` trong cùng thay đổi WS-E2E; không để token/cookie/secret trong repo hay trong log. Tài khoản fixture dùng mật khẩu sinh từ biến môi trường, không hard-code mật khẩu thật.
4. **Không tuyên bố pass khi chưa chạy được:** nếu thiếu DB test, dev server, trình duyệt Playwright hoặc fixture, báo "E2E **chưa chạy**" và nêu thiếu gì. Trong báo cáo ghi số test đã chạy / pass / fail / skip; skip hoặc 0 test không được coi là pass (cùng nguyên tắc với runner hiện tại).
5. **Ổn định:** không `waitForTimeout` cố định; chờ theo trạng thái (role, `aria-current`, request hoàn tất); `retries: 0` khi phát triển để thấy flaky; trace/ảnh chụp chỉ lưu khi lỗi và nằm trong thư mục bị ignore.

Kết hợp **Chrome visual verification** (claude-in-chrome): pane 440/640/1100px, workspace hẹp (overlay), Full Page 1280/1440/390px, trang ngang/dọc lẫn lộn, so với Task Detail về cỡ chữ/khoảng cách.

### 12.3 Khác
- Integration: chạy lại `document-api-routes`, `file-streaming-security`, `document-classification-linked-task`; route `/documents/[id]` redirect theo loại + 404/không quyền.
- Hiệu năng/bộ nhớ: heap snapshot trước/sau đổi tệp liên tục; số request khi quay lại tệp cũ.
- Regression: filter/URL/phân trang; bulk toolbar; vào sổ/soạn văn bản/ký số; thao tác văn bản đi trong Quick View; thao tác văn bản đến ở Full Page; link từ Hộp việc và Tìm kiếm; card list di động; in.

## 13. Rủi ro và đánh đổi
- `/documents` chuyển sang chiều cao cố định ảnh hưởng toolbar/phân trang/feature guide → kiểm kỹ di động.
- Ảo hóa trang + neo cuộn là phần phức tạp nhất; khôi phục vị trí phải dựa vào hình học trang, không đo DOM.
- Chỉ mục chữ cho PDF rất dài (hàng trăm trang) tốn thời gian; chấp nhận vì lười + có tiến độ + hủy được.
- Bỏ Vaul ở chế độ pane: mất animation drawer; dùng transition độ rộng nhẹ, tôn trọng `prefers-reduced-motion`.
- Không cache tệp → quay lại tệp cũ phải tải lại; chấp nhận để không đổi chính sách bảo mật tệp.
- **[v2]** Playwright cần DB test có fixture và dev server; nếu môi trường không sẵn, E2E không chạy được và phải báo rõ, không coi là pass.
- **[v2]** Next 15 quản lý `history.state`; ghi cờ riêng có thể bị ghi đè → WS3 kiểm trước, có phương án dự phòng (§6.3).
- **[v2]** `pdfjs-dist` kéo theo `@napi-rs/canvas` (optional, native) trong lockfile; kiểm image Docker build không lỗi khi triển khai (không chạy build để verify trong dự án này).

- **[v3]** `pdfjs-dist@6.3.289` khai báo `engines.node >=22.13.0 || >=24`, trong khi `.nvmrc` = 20.18.0, `Dockerfile` dùng `node:20-alpine` (cả `deps` lẫn `builder`), `package.json` `engines >=20.9.0`. `npm ci` trên Node 20 sẽ cảnh báo `EBADENGINE` (không có `engine-strict` trong `.npmrc`); build có thể vẫn chạy nhưng chưa được kiểm chứng. Máy dev hiện là Node 22.23.2 nên không phát hiện được. Xem D16 và "Xác minh phát hành".
- **[v3]** Phần tử gây vỡ khi build: `new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url)` trong `pdf-document-canvas.tsx` phụ thuộc bundler; chỉ xác minh được ở WS6 (build + Docker), không kiểm bằng SSR.
- **[v3]** `src/components/ui/dialog.tsx` (WIP) đổi z-index của **mọi** dialog từ `z-40` lên `z-50` — ảnh hưởng toàn app, không chỉ Văn bản. Cần review riêng trong C2.
- **[v3]** Lịch sử trình duyệt: Next 15 có thể ghi đè `history.state`; E4 kiểm trực tiếp, có phương án dự phòng (§6.3).

## 14. Quyết định
| # | Quyết định | Trạng thái v2 |
|---|---|---|
| D1 | Điều hướng tệp: "Tệp N" + menu, giữ vạch khi N ≤ 8 | **Đã duyệt** (bổ sung §7.1: Quick View có danh sách thu gọn, Full Page có bộ chọn) |
| D2 | Giữ 2 route theo loại + thêm `/documents/[id]` (redirect, trang cho tờ trình) | **Đã duyệt** |
| D3 | Lịch sử: mở = push, đổi = replace; Back đóng pane, Forward mở lại; deep link đóng = replace | **Đã duyệt (v3)**, chi tiết ở §6.3 |
| D4 | Tách resize handle dùng chung, không chuyển task peek | **Đã duyệt** |
| D5 | Full Page: thông tin trong side panel mở từ rail, mặc định đóng | **Đã duyệt** |
| D6 | Không đổi header cache route tệp | **Đã duyệt** |
| D7 | Full Page nhớ zoom/trang theo tệp trong `sessionStorage` | **Đã duyệt** |
| D8 | Xóa code cũ sau khi thay thế | **Đã duyệt có điều kiện** (§11, điều kiện WS6) |
| D9 | Checkpoint working tree trước WS0, không tự commit | **Đã duyệt**; WS-1 đã rà xong, kết quả và nhóm commit ở §15, chờ xác nhận |
| D10 | Đặt SPEC ở `docs/product/specs/` | **Đã thực hiện** |
| D11 | Gộp "Mở tab mới" vào menu Tải về | **Đã duyệt** |
| D12 | `@playwright/test` cho E2E smoke + Chrome visual verification | **Đã duyệt** — chạy local, DB test riêng, fixture xác định, auth state không commit (§12.2); thêm job CI là quyết định riêng |
| D13 | Giữ cách chọn nút theo role ở Full Page văn bản đến; quyền kiểm ở server | **Đã duyệt**, WS0 xác minh (§6.6) |
| D14 | Hằng số `LIST_MIN` 480px, `PANE_MIN` 440px (§6.1) | **Đã duyệt làm giá trị ban đầu**; hiệu chỉnh theo đo đạc WS0 |
| D15 | Danh sách tệp Quick View: mở khi N ≤ 5, thu gọn khi N > 5; ghi nhớ lựa chọn người dùng; Full Page dùng bộ chọn tệp + rail | **Đã duyệt (v3)** |
| D16 | Runtime: ưu tiên **Node 24 LTS**; nếu không tương thích thì Node 22 LTS | **Đã duyệt**; Node 24.18 + npm 11: `npm ci`, `prisma generate`, `tsc`, `next build` đều OK trong worktree tạm. Chưa đổi `.nvmrc`/`Dockerfile`/`engines` (việc riêng, cần xác nhận khi thực hiện). Docker: không làm |
| D17 | Quyền đọc qua nhiệm vụ liên kết | **Đã chốt (v4):** `Task.scope = SCHOOL` và người tạo nhiệm vụ KHÔNG cấp quyền đọc văn bản/tệp/nhật ký; chỉ thành viên đơn vị chủ trì nhiệm vụ liên kết (đơn vị xử lý) được tính. Danh sách thu hẹp theo chi tiết, không mở rộng chi tiết để khớp danh sách |
| S-1 | Kiểm quyền khi đổi `linkedTaskId` | **Đã triển khai (v4):** phải đọc được nhiệm vụ đích, nhiệm vụ chưa gắn văn bản khác, ghi `DOCUMENT_LINKED_TASK_CHANGED`, tất cả trong transaction có khóa |

## 15. Checkpoint working tree (WS-1) và baseline WS0 — [v3, cập nhật v4]

Rà ngày 2026-10-09, **chỉ đọc**: không commit, không sửa code, không chạy baseline typecheck/lint/toàn bộ test (đó là WS0, sau khi checkpoint được xác nhận). Đã chạy 5 file test liên quan C1 (49 test: 49 pass, 0 fail, 0 skip) và một script kiểm tra tạm không đụng DB (đã xóa).

### 15.1 Phạm vi và vệ sinh
- 72 file sửa (+3.103/−3.702 dòng) và 19 file mới; cộng 2 file tài liệu của SPEC này.
- Không có file nhị phân, `.env`, secret, `console.log`, `debugger`, TODO/FIXME trong diff và file mới.
- `src/components/layout/app-shell.tsx`: chỉ thêm `/documents` vào điều kiện ẩn breadcrumb desktop.
- `DESIGN.md` (+34 dòng): ghi nhận hiện trạng trang nhiệm vụ và các khác biệt chưa chốt. Là mô tả hiện trạng, không phải quyết định đã duyệt.

### 15.2 Dependency
| Mục | Kết quả |
|---|---|
| Thêm vào `package.json` | Chỉ `react-pdf@^11.0.0`. `pdfjs-dist@6.3.289` (Apache-2.0) vào **gián tiếp**; `pdf-document-canvas.tsx` có `import type { PDFDocumentProxy } from "pdfjs-dist"` (chỉ kiểu, bị xóa khi biên dịch) |
| `package-lock.json` | +367 dòng, **không xóa dòng nào**. Thêm `react-pdf`, `pdfjs-dist`, `@napi-rs/canvas` (MIT, optional, kèm 12 gói native theo nền tảng), `es-toolkit`, `make-cancellable-promise`, `make-event-props`, `merge-refs`, `loose-envify`, `js-tokens`... `npm ls` sạch, không xung đột |
| **Node** | `pdfjs-dist@6.3.289` yêu cầu `node >=22.13.0 \|\| >=24`; `.nvmrc` = 20.18.0, `Dockerfile` = `node:20-alpine`, `engines` = `>=20.9.0`. **[v4]** Theo D16 ưu tiên Node 24: trong worktree tạm, Node 24.18.0 + npm 11.16 cho `npm ci` (có cảnh báo `allow-scripts` của npm 11 về script cài đặt của prisma/esbuild/fsevents, chưa chặn), `prisma generate`, `tsc --noEmit` và `next build` đều thành công. Chưa đổi `.nvmrc`/`Dockerfile`/`engines`; chưa chạy test suite dưới Node 24 |
| Dùng `@napi-rs/canvas` | Chỉ là phụ thuộc tùy chọn của `pdfjs-dist` cho Node; ứng dụng chạy trong trình duyệt nên không dùng. Cần xem `npm ci` trên Alpine/musl ở WS6 |
| Giấy phép | MIT / Apache-2.0, không có giấy phép hạn chế |
| Playwright | Chưa cài; WS-E2E thêm sau, chỉ `devDependency` |

### 15.3 Phân quyền C1 — kết quả sau khi sửa (v4)
**Thay đổi so với WIP ban đầu (theo D17, S-1 và 3 vòng review của Codex):**
1. `canAccessClassification` (INTERNAL): bỏ nhánh `scope = SCHOOL` và nhánh "người tạo nhiệm vụ". Đơn vị chủ trì nhiệm vụ liên kết được tính cùng nhóm đơn vị xử lý (`extractDocumentUnitIds`). Mọi cổng trước đó (tài khoản hoạt động, bí mật nhà nước, tách quyền `SYSTEM_ADMIN`, văn bản giới hạn/dữ liệu cá nhân) giữ nguyên.
2. `buildDocumentReadWhere` (danh sách): bỏ điều kiện `scope = SCHOOL` và `createdById` của nhiệm vụ. **Hệ quả:** người trước đây thấy văn bản trong sổ chỉ nhờ hai điều kiện đó sẽ không còn thấy. Test mới khẳng định danh sách không rộng hơn chi tiết.
3. Mapper `mapPrismaDocumentToItem` nay mang `linkedTask.leadUnitId` (v3 nhận định sai rằng `getDocumentById` đã phủ; thực tế mapper làm mất trường này nên `GET /api/documents/[id]` không áp dụng được quy tắc).
4. `GET /api/documents/[id]`, `audit-logs`, `/api/files` dùng `AuthorizationContext` đầy đủ (đơn vị kiêm nhiệm có hiệu lực được tính). `/api/files` nạp context không cache và giữ thêm cổng `authUser` để không làm mất quyền của tài khoản chỉ có vai trò (văn thư chưa có phân công).
5. `request-context`: phân công PRIMARY chỉ tính khi đang hiệu lực (`effectiveFrom <= now`, `effectiveTo` rỗng hoặc chưa qua). Trước đây không lọc thời hạn.
6. S-1: `PATCH /api/documents/[id]` khi body có `linkedTaskId`: transaction → khóa workflow đến rồi văn bản (cùng thứ tự với `assignUnitWork`/`deleteTask`) → đọc lại → kiểm lại bất biến + quyền sửa → so sánh liên kết trên dữ liệu vừa đọc → `assertCanLinkTask` (nhiệm vụ tồn tại, đọc được theo `buildTaskReadWhere`, chưa gắn văn bản khác) → ghi → audit. P2002 → 409, P2003 → 404.

**Kiểm chứng:**
- `tests/document-classification-linked-task.test.ts`: 15 test đơn vị (SCHOOL, người tạo, người được giao, Mật/Tối mật/Tuyệt mật, giới hạn/cá nhân, SYSTEM_ADMIN, tài khoản khóa, đơn vị phụ, không cấp thêm quyền xử lý, danh sách ⊆ chi tiết).
- `tests/document-linked-task-access.test.ts` (DB test): 22 test tích hợp — quyền đọc ở ba nơi, S-1, tranh chấp đồng thời (gắn/gỡ, hai văn bản cùng nhiệm vụ, không bế tắc với tác vụ khóa workflow trước), đơn vị kiêm nhiệm (hiệu lực/hết hạn/chưa hiệu lực/nghỉ/kết thúc), văn bản giới hạn, văn thư chỉ có vai trò, PATCH chờ khóa rồi bất biến, văn bản không workflow, phân công chính hết hạn. Đã xác nhận các test kiêm nhiệm và phân công hết hạn **fail trên mã cũ**.
- 306 test liên quan phân quyền/tệp/văn bản: 306 pass, 0 fail, 0 skip. `tsc --noEmit` sạch.
- Codex review: vòng 1 phát hiện 2 P2 (race PATCH; cổng đọc bỏ sót đơn vị kiêm nhiệm); vòng 2 phát hiện 3 P2 (VAN_THU chỉ vai trò; cache; nhiệm vụ bị xóa) + P3 test; vòng 3 phát hiện P2 (PRIMARY không lọc thời hạn). Tất cả đã xử lý; chưa chạy vòng xác nhận cuối.

**Còn mở (không chặn commit C1):**
- Các route chưa nhận `linkedTask`: `incoming/[id]`, `outgoing/[id]`, `[id]/workflow`, `download`, `file-objects/[id]` vẫn từ chối người chỉ có quyền qua đơn vị chủ trì nhiệm vụ (đóng mặc định, không rò rỉ).
- Danh sách chỉ xét một đơn vị (`primaryUnitIds[0]`), chi tiết xét mọi đơn vị có hiệu lực: danh sách có thể hẹp hơn chi tiết (chấp nhận được).
- Danh sách vs chi tiết còn lệch ở vai trò ADMIN/văn bản Mật (danh sách rộng hơn chi tiết) — **ngoài phạm vi**, cần quyết định nghiệp vụ riêng.
- `tests/sprint7-legacy-data-cutover.test.ts` đếm toàn cục `TaskActor`, nên chập chờn khi chạy song song với test tích hợp tạo nhiệm vụ (kể cả test mới). Nên cô lập fixture của test đó.

### 15.4 Nhóm commit đề xuất (điều chỉnh từ v2)
Phân tích import giữa các nhóm cho thấy **C3 (trình xem) và C4 (sổ/chi tiết) phụ thuộc vòng** (`document-file-viewer.tsx` ↔ `document-detail-parts.tsx` ↔ `document-pdf-viewer.tsx`), và C4 dùng các thành phần nhiệm vụ đã sửa (C5) và UI chung (C2). Vì vậy tách lại để mỗi commit tự biên dịch được:

| Thứ tự | Nhóm | File | Ghi chú |
|---|---|---|---|
| 1 | **C1** Quyền đọc qua nhiệm vụ liên kết + S-1 | `src/server/authorization/document-classification.ts`, `src/server/policies/document-policy.ts`, `src/server/api/request-context.ts`, `src/app/api/documents/[id]/route.ts`, `src/app/api/documents/[id]/audit-logs/route.ts`, `src/app/api/files/[...path]/route.ts`, `src/lib/documents/document-service.ts`, `src/lib/documents/linked-task-link.ts` (mới), `src/lib/db/audit.ts`, `src/types/document.ts` (chỉ trường `leadUnitId`), `src/app/documents/outgoing/[id]/page.tsx`; `src/app/documents/incoming/[id]/page.tsx` **chỉ các hunk phân quyền** (`git add -p`); tests: `document-classification-linked-task`, `document-linked-task-access` (mới), `document-task-two-way-traceability` | Độc lập với C2–C5. `src/types/document.ts` và `incoming/[id]/page.tsx` trộn C1 với C4 → `git add -p`. Điều kiện §15.3 đã đáp ứng; chờ xác nhận để commit |
| 2 | **C2** UI dùng chung (11) | `src/components/ui/{dialog,drawer,empty-state,input,property-row,select,textarea,vietnamese-date-picker}.tsx`, `list-toolbar.tsx`, `property-toggle-chip.tsx`, `tests/vietnamese-date-picker.test.ts` | Các prop mới đều tùy chọn (mặc định giữ nguyên) trừ **z-index `dialog` 40→50 áp dụng cho mọi dialog** → review riêng |
| 3 | **C5** Nhiệm vụ + `DESIGN.md` (20) | `src/components/tasks/**` (kanban, bảng, hàng, toolbar, thẻ di động, `task-status-circle`, `priority-signal-bars`), `src/components/dashboard/{task-filter-icons,unified-task-toolbar}.tsx`, `src/lib/icons/task-icons.tsx`, `DESIGN.md`, 3 test nhiệm vụ | Cần C2 trước (`list-toolbar`, `property-toggle-chip`). C4 dùng `TaskStatusCircle`, `PrioritySignalBars`, `task-icons`, `TaskPaginationBar` |
| 4 | **C3** Phụ thuộc + tiện ích URL tệp (4) | `package.json`, `package-lock.json`, `src/lib/url-utils.ts`, `tests/served-file-url.test.ts` | Độc lập. Đặt trước C4 để `react-pdf` có sẵn; D16 cần quyết định trước release, không chặn commit |
| 5 | **C4** Sổ văn bản, chi tiết, trình xem PDF (≈53) | toàn bộ `src/components/documents/**` (gồm `pdf-document-canvas`, `document-viewer-rail`, `document-file-viewer`, `document-pdf-viewer`, `popover-escape-guard`, `document-detail-parts`, `use-drawer-focus`...), `src/app/documents/**` (trừ phần C1), `src/hooks/use-document-url-filters.ts`, `src/lib/documents/audit-timeline-client.ts`, `src/types/document*.ts`, `src/components/layout/app-shell.tsx`, các test `document-*` và `use-document-drawer-focus` | Lớn nhất; sẽ bị thay thế một phần bởi WS3–WS4 nên chỉ cần "xanh", không cần hoàn thiện thêm |
| 6 | **C6** Tài liệu (2) | `docs/product/specs/document-workspace.md`, `docs/Index.md` | |

Cách kiểm "mỗi commit tự biên dịch": sau khi được phép, tạo `git worktree` tạm ngoài repo (liên kết `node_modules`), áp từng commit rồi `tsc --noEmit` + test của nhóm; xóa worktree khi xong. Không dùng `git stash` hay thay đổi cây làm việc hiện tại.

### 15.5 Rủi ro regression theo nhóm
| Nhóm | Rủi ro | Giảm thiểu |
|---|---|---|
| C1 | Thay đổi phân quyền đọc; phủ chưa đều giữa các route (§15.3.6) | Review riêng, thêm test 1–6, không gộp với UI |
| C2 | Component dùng khắp app; z-index dialog 40→50 có thể đổi thứ tự chồng lớp với drawer (`z-40`), toast, menu mobile | Chụp so sánh các dialog hiện có; mọi prop mới mặc định giữ nguyên |
| C5 | 20 file nhiệm vụ không thuộc dự án này; bảng/kanban/thẻ di động đổi giao diện | Review theo `DESIGN.md`; chạy test nhiệm vụ; không thuộc phạm vi WS |
| C3 | Lockfile; Node engine (D16) | `npm ci` trên Node 20.18 và 22 ở WS0; build + Docker ở WS6 |
| C4 | 44+ file, xóa ~3.700 dòng; nhiều file bị thay ở WS3–WS4 | Baseline WS0; E2E trước khi thay thế |
| Toàn bộ | **Chưa biết trạng thái xanh/đỏ của working tree** (chưa chạy typecheck/lint/test toàn bộ) | WS0 ghi baseline; lỗi có sẵn được tách khỏi lỗi mới |

### 15.6 Việc còn lại trước khi commit (v4)
1. Chủ dự án xác nhận cách chia nhóm commit ở §15.4 (đã đồng ý nguyên tắc; C2 cần review riêng z-index `dialog` 40→50).
2. C2/C5 có test và lint đỏ do WIP (xem §15.7); cần sửa hoặc chấp nhận trước khi commit các nhóm đó. C1 không phụ thuộc.
3. Không commit/push/merge khi chưa có xác nhận.

### 15.7 Baseline WS0 (2026-10-09)
Môi trường: Node 22.23.2, npm 10.9.8; DB test `qcet_test` (runner suy ra từ `DATABASE_URL`). Baseline = cây làm việc hiện tại (WIP + C1 + S-1). HEAD đo ở worktree sạch.

| Hạng mục | HEAD | Cây hiện tại |
|---|---|---|
| `tsc --noEmit` | chưa đo | sạch (Node 22.23.2 và Node 24.18) |
| `npm run lint` | 107 lỗi (`feature-guide` 88, `login/page` 17, `app-sidebar` 1, `google-login-button` 1) | 111 lỗi: thêm 4 do WIP (`list-toolbar` strokeWidth 2; `task-icons` strokeWidth 1.8 ×2; `document-viewer-rail` no-icon-box) |
| Test (toàn bộ) | 5.692 test, 4 fail, 1 skip, ~37 s | 5.759 test, 10 fail (9 suite), 1 skip, ~44 s |
| `next build` (Node 24) | chưa đo | thành công; `/documents` 182 kB trang, 463 kB First Load JS; `/documents/incoming/[id]` 5,94 kB; `/documents/outgoing/[id]` 13,2 kB |

**Test fail ổn định (lặp lại qua nhiều lần chạy):**
| Test | Nguồn |
|---|---|
| Login Specification (Boards Login & Login2) | có sẵn ở HEAD |
| Bộ icon thao tác nhiệm vụ (`xuất đủ 48 icon`, thực tế 50) | có sẵn ở HEAD |
| Space không bật/tắt panel khi Ctrl+I | có sẵn ở HEAD |
| `DocumentPdfViewer` còn khẳng định iframe/object (`tests/document-split-view.test.ts`) | WIP: trình xem đã chuyển sang canvas; xử lý ở WS1/WS6 |
| Base UI popup (`list-toolbar.tsx`: lớp phủ phải nằm ở Positioner) | WIP C2 |
| Mobile Workbench (thẻ nhiệm vụ không hiện % tiến độ) | WIP C5 |
| TaskSubtasksSidebarSection (màu icon IN_PROGRESS) | WIP C5 |
| Task Table (`areTaskRowPropsEqual` khi đổi `progressPercent`) | WIP C5 |

**Test chập chờn (đổi chỗ giữa các lần chạy, phụ thuộc dữ liệu chung của DB test):** `Document Registry API`, `GET /api/documents/stats`, `Live Dashboard Service`, `dashboard/overview`, `Sprint 7 Legacy Data Cutover` (đếm toàn cục `TaskActor`). Mỗi test này dùng `prisma.user.findFirst()` hoặc đếm toàn bảng nên bị ảnh hưởng khi test khác chạy song song.

**Chưa đo / chưa chạy:** E2E (chưa có hạ tầng), Docker (không thực hiện), test suite dưới Node 24, hiệu năng/bộ nhớ trình xem PDF (WS1), `LIST_MIN` thực tế (WS3).

### 15.8 Hạ tầng WS-E2E (đã dựng, 2026-10-09)
- `@playwright/test@1.64.0` (devDependency), `playwright.config.ts`, thư mục `e2e/`, script `npm run test:e2e`; dùng Chrome cài sẵn (`channel: "chrome"`).
- Server riêng: `next dev -p 3101` với `NEXT_DIST_DIR=.next-e2e` (`next.config.ts` đọc biến này, mặc định `.next`), không đụng dev server cổng 3001 và `.next/`.
- An toàn dữ liệu: `e2e/env.ts` chỉ chấp nhận DB `qcet_test`/`qcet_ci` (suy từ `DATABASE_URL` hoặc `E2E_DATABASE_URL`), ngược lại dừng; `AUTH_SECRET` cố định cho E2E; tệp tạm ở `e2e/.tmp/uploads`.
- Fixture xác định (`e2e/global-setup.ts`, tiền tố `e2e_`, tạo lại mỗi lần chạy): văn bản có 0/1/5/6/12 tệp, 1 tệp 60 trang, bộ tệp đa dạng (A4, ngang, khổ lạ, xoay 90°, scan không text, PDF hỏng). PDF sinh bằng `e2e/support/pdf.ts`, không thêm dependency.
- Phiên đăng nhập: cookie JWT ghi vào `playwright/.auth/user.json` (đã ignore, không vào Git).
- Đã chạy `e2e/smoke.spec.ts`: 2/2 pass (danh sách thấy văn bản fixture; route tệp trả 200). Chưa có kịch bản nào cho Quick View/viewer — viết cùng WS1/WS3.

## 16. Kết quả triển khai (2026-10-09, cây làm việc chưa commit)

Đã làm theo thứ tự WS-E2E → WS1 → WS2 → WS3 → WS4 → WS5 → WS6. Mọi số liệu dưới đây là kết quả chạy thật trên máy dev (Node 22.23.2; build kiểm trên Node 24.18.0).

| WS | Nội dung đã có | Bằng chứng |
|---|---|---|
| WS-E2E | Playwright 1.64 + Chrome, server riêng cổng 3101 (`NEXT_DIST_DIR=.next-e2e`), DB `qcet_test`, fixture xác định (§15.8) | 33 test E2E pass (smoke 2, viewer 8, Quick View 14, Full Page 9) |
| WS1 | `pdf-layout` (hình học từng trang, cửa sổ dựng, trang hiện tại), `pdf-text-index` (tìm trên mọi trang), `file-viewer-state`; canvas dựng theo cửa sổ, nhảy trang, khôi phục vị trí; rail nhóm Xem/Trang/Tìm/Khung/Tệp; "Tệp N" + vạch 2–8 tệp; Fullscreen API; lỗi PDF có Thử lại/Tải về | 8 test rail, 22 test thuần; E2E: 60 trang chỉ dựng ≤ 8 trang, nhảy trang, tìm trang 55 khi chưa dựng, 5/12 tệp, PDF hỏng, khổ lạ, toàn màn hình |
| WS2 | `document-view-model` (3 nguồn → 1 model), `document-detail-client` + `useDocumentDetail` (hủy yêu cầu cũ, không hiển thị nhầm văn bản) | 9 + 8 test |
| WS3 | Quick View pane không modal / overlay theo độ rộng workspace, `PaneResizeHandle` (chuột + bàn phím), URL `docId`/`file` qua `planPaneHistory`, deep link ngoài trang, 403/404, j/k/↑/↓, nút Mở trang đầy đủ, ký số, cột bảng theo container query (3 mức), `/documents` cao cố định ở desktop | 6 + 7 + 9 test; 14 E2E Quick View |
| WS4 | `DocumentFullPage` PDF-first dùng chung cho văn bản đến/đi và tờ trình, panel thông tin 320px, `?file=`, sessionStorage zoom/trang, `/documents/[id]` (chuyển hướng + tờ trình), loading/error mới | 9 E2E Full Page (gồm 390px) |
| WS5 | Nhớ vị trí cuộn danh sách theo bộ lọc, khôi phục sau lần tải đầu, giữ dòng văn bản đang mở trong tầm nhìn; danh sách không tải lại khi chỉ mở/đóng pane | 3 test + 1 E2E |
| WS6 | Xóa drawer chi tiết đến/tờ trình và văn bản đi, overlay toàn màn hình, `document-split-view`, `document-workspace`, `use-drawer-focus`, layout `fill`, `FilePreview`, `DocumentDetailLayout`; tách `document-badges.ts`; cập nhật `DESIGN.md`, baseline lint | `npm run build` thành công trên Node 24.18.0: `/documents` 172 kB trang, 446 kB First Load (baseline 182/463); không Docker |

**Điều kiện xóa code cũ (§11 WS6):** mỗi thành phần bị xóa đều có coverage thay thế (view model, SSR Quick View, E2E Quick View cho đến/đi/tờ trình, Full Page). Test chỉ kiểm component đã xóa (`document-split-view`, `use-document-drawer-focus`) bị bỏ; phần còn nghĩa của `document-split-view.test.ts` chuyển sang `documents-page-and-pdf-viewer.test.ts`. Bản sao hai file chưa theo dõi bởi git nằm ở thư mục tạm của phiên.

**Kết quả kiểm tra cuối:** `tsc --noEmit` sạch; lint 110 lỗi (HEAD 107; 3 lỗi thêm đều thuộc WIP ngoài phạm vi văn bản: `list-toolbar` strokeWidth, `task-icons` ×2; không còn lỗi `no-icon-box` ở rail); toàn bộ test 5.831, 9 suite fail — không suite nào thuộc phân hệ văn bản: 3 có sẵn ở HEAD (Login, bộ icon 48/50, Space/Ctrl+I), 4 do WIP C2/C5 (Mobile Workbench, Base UI popup `z-[60]` ở `list-toolbar`, Subtasks sidebar, Task Table), 2 chập chờn do dữ liệu DB chung (Dashboard API ×2).

**Phát hiện khi làm (đã xử lý):**
- Next 15 coi `history.state.__NA` là lời gọi nội bộ: không được chép `__NA` khi `pushState`/`replaceState`, nếu không `useSearchParams` không cập nhật (`use-document-pane.ts`).
- `overflow-x: auto` làm `overflow-y` tính ra `auto`: khung xem đánh dấu `data-pdf-no-scroll` và canvas bỏ qua `body/html` khi tìm vùng cuộn dọc, nếu không cả PDF bị dựng hết.
- Popover bên trong drawer modal (Vaul/Radix) không bấm/gõ được vì body `pointer-events: none` và focus trap; Quick View desktop không modal nên hết lỗi, overlay hẹp tự dựng không dùng Radix.
- Trang có `loading.tsx` stream trước khi `notFound()` nên mã HTTP là 200 (nội dung 404 vẫn đúng); các trang chi tiết cũ có cùng hành vi.

**Chưa kiểm chứng / còn lại:**
- Chưa so với bảng thiết kế gốc (chưa có bộ thiết kế duyệt cho phân hệ Văn bản); kích thước kiểm qua ảnh chụp Chrome ở 1440/1000/390px.
- Chưa đo heap khi đổi 10 tệp × 5 vòng và số request khi quay lại tệp cũ (mục WS0 hiệu năng); chưa kiểm Safari/iOS (Fullscreen API dự phòng sang Full Page chưa chạy trên thiết bị thật).
- Chưa đổi `.nvmrc`/`Dockerfile`/`engines` sang Node 24 (D16); chưa chạy test suite dưới Node 24; không làm Docker.
- Chưa commit/push/merge: C1 đã staged (15 file), phần còn lại ở working tree theo nhóm C2, C5, C3, C4, C6 (§15.4); `package.json`/`package-lock.json` có thêm `@playwright/test`, `next.config.ts` thêm `distDir` theo `NEXT_DIST_DIR`.
