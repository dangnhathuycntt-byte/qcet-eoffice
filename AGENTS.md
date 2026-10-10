# QCET · hướng dẫn làm việc

Đây là điểm vào duy nhất cho hướng dẫn agent trong repo. Làm theo yêu cầu hiện tại của người dùng; chỉ đọc tài liệu liên quan qua `docs/Index.md`. Tài liệu tham khảo, đề xuất, audit và ví dụ thiết kế không tự tạo thêm công việc hay quyền triển khai. Code và test phản ánh hiện trạng, không tự chứng minh hành vi đó là yêu cầu đúng.

## Bắt đầu và thực hiện
- Xác định kết quả cần đạt, phạm vi sửa và cách kiểm chứng từ yêu cầu. Việc rõ thì làm ngay; chỉ hỏi khi thiếu thông tin ảnh hưởng đến nghiệp vụ, dữ liệu hoặc quyết định khó đảo ngược. Tiếp tục phần độc lập trong lúc chờ.
- Đọc `git status --short` và diff của file sắp sửa để phân biệt thay đổi có sẵn. Tìm bằng `rg`; bắt đầu từ route/component đang được dùng và test liên quan, không đọc toàn bộ docs hoặc quét hết repo theo thói quen.
- Việc phức tạp: lập kế hoạch ngắn trong chat, kiểm tra giả định và trường hợp biên rồi thực hiện đến khi đủ tiêu chí. Việc nhỏ sửa trực tiếp. Chỉ tạo tài liệu kế hoạch khi cần bàn giao hoặc người dùng yêu cầu.
- Ưu tiên một agent hoàn thành xuyên suốt. Khi người dùng yêu cầu làm song song, giao từng phần độc lập với phạm vi file và tiêu chí rõ; tránh hai agent cùng sửa một file, kiểm chứng lại kết quả tích hợp.
- Dùng skill đúng tác vụ, chỉ đọc phần cần thiết. Khi cần web search, ưu tiên tài liệu chính thức; đối chiếu phiên bản trong `package.json`/lockfile trước khi áp dụng API.

## Tìm đúng chỗ
| Công việc | Điểm vào |
|---|---|
| Trang và API | `src/app/`, `src/app/api/` |
| Giao diện dùng chung | `src/components/ui/`, `src/components/workspace/` |
| Nhiệm vụ | `src/components/tasks/`, `src/domain/tasks/` |
| Nghiệp vụ, tiện ích | `src/domain/`, `src/lib/` |
| Phân quyền và dịch vụ | `src/server/authorization/`, `src/server/services/` |
| Schema và kiểm thử | `prisma/schema.prisma`, `tests/` |

## Phạm vi và cách làm
- Giữ các thay đổi đang làm dở. Không tự commit, push, merge hoặc deploy nếu người dùng chưa yêu cầu.
- Sửa nguyên nhân trong phạm vi yêu cầu; tránh refactor, dependency hay abstraction không cần thiết. Giải thích lý do khi thay đổi kiến trúc.
- Tái sử dụng component, dependency và helper chung. Không tạo workspace, bảng, toolbar hoặc định nghĩa metric song song.
- Không bịa dữ liệu nghiệp vụ, số đếm hay metadata. Dùng thuật ngữ tiếng Việt hiện có; ngày nghiệp vụ dùng `src/lib/academic-calendar.ts`, múi giờ `Asia/Ho_Chi_Minh`. Logic domain phải deterministic, không có side effect ẩn.

## Nghiệp vụ và phân quyền
- Role quyết định quyền, scope lọc tập dữ liệu. Giữ ngữ nghĩa nhiệm vụ cha/con và đồng bộ filter, counter, view, URL.
- API được bảo vệ phải xác thực và phân quyền ở server, validate input; không tin role do client gửi và không thêm bypass production. Giữ format lỗi và HTTP status nhất quán.
- Tra cứu nghiệp vụ và quyết định đã duyệt khi sửa hành vi; RFC/đề xuất chưa được duyệt không phải quyết định. Khi tài liệu mâu thuẫn, không tự chọn bản mới hơn làm chuẩn.

## Thiết kế
- Giữ các quyết định UI đã được người dùng duyệt cho phạm vi cụ thể; không tự áp dụng lại trang đã revert.
- `DESIGN.md` chỉ dẫn nguồn thiết kế, token hiện tại và khác biệt chưa chốt. Chỉ đọc khi sửa UI; không coi hiện trạng code là bằng chứng thiết kế đã được duyệt.
- Khi cần bảng gốc, tra `INDEX.md`, `project/`, `shots/` trong đúng bộ thiết kế. Bám token, font, khoảng cách, ảnh và trạng thái tương ứng; không tự thêm biến thể hoặc suy nghiệp vụ từ ví dụ.
- Đối chiếu ở viewport phù hợp, kiểm tra bàn phím, responsive, loading/error khi sửa phần liên quan.
- Không tự dựng lại control đã có. Trước khi viết `<button>`, `<input>`, màu hay cỡ chữ riêng, tra bảng sau; thiếu biến thể thì thêm vào component trong `src/components/ui/` (cva), không chép class sang màn hình:

  | Cần | Dùng |
  |---|---|
  | Nút có kiểu (chính, phụ, ghost, icon) | `Button` (`ui/button`), `size` `sm`/`xs`/`icon-sm` trong hàng và toolbar |
  | Vùng bấm tùy biến: hàng, ô lịch, thẻ, tab/mục tự dựng | `Pressable` (`ui/pressable`) |
  | Ô nhập, nhiều dòng, chọn, tích | `Input`, `Textarea`, `Select`, `Checkbox` |
  | Ngày; người nhận việc | `VietnameseDatePicker`; `TaskAssigneePicker` (`tasks/detail/task-property-controls`) |
  | Toolbar, ô tìm, hàng bộ lọc trang danh sách | `list-toolbar` (`ListToolbarSearch`…), `ActiveFilterBar` |
  | Hộp thoại; xác nhận xóa; popover, menu | `Dialog`; `DestructiveConfirmDialog`; `Popover`, `Menu` |
  | Rỗng; thông báo trong trang; avatar; tooltip | `EmptyState`; `InlineAlert`; `UserAvatar`; `Tooltip` |
  | Màu tín hiệu | `text-destructive`, `bg-danger-soft`, `bg-destructive/10`; `text-warning`, `bg-warning/10` |
  | Cỡ chữ | `text-xs`, `text-compact`, `text-sm`… (thang ở `DESIGN.md`) |

- `npm run lint` chặn vi phạm mới (`<button>`/`<input>` tự viết ngoài `ui/`, `rose-*`/`amber-*`, `text-[…px]`, palette xám thô…); debt cũ nằm ở `scripts/design-lint-baseline.json`. Sửa dòng cũ thì làm sạch luôn dòng đó, không thêm vào baseline. Ngoại lệ có lý do: `design-lint-ignore <rule-id>: <lý do>` trên cùng dòng hoặc dòng trước. Hook Claude Code trong `.claude/settings.json` chạy lint trên mỗi file vừa sửa.
- Kích thước UI chuẩn (nhỏ gọn, kiểu Linear): chữ nội dung `text-compact` 13px, nhãn/dòng phụ/popover/tab `text-xs` 12px, không dùng cỡ lẻ (kể cả `text-[12px]`, `text-[13px]`: dùng `text-xs`, `text-compact`); hàng bảng danh sách một dòng 40px, hai dòng 48px, tiêu đề cột cao bằng hàng; tiêu đề chính của hàng một dòng cắt cuối kèm tooltip, tên cơ quan/đơn vị không ghi tắt "…" mà xuống tối đa 2 dòng; thuộc tính trong panel chi tiết là lưới nhãn–giá trị căn thẳng cột, không xếp thành dòng metadata không nhãn; icon loại tệp dùng `FileTypeIcon` và token `--file-*`; đường chia kéo giãn có grip luôn hiện (`ResizeGrip`) và vùng kéo 24px không bị `overflow-hidden` cắt; item popover/menu ≤ 32px (`py-1`); màu tín hiệu dùng token `text-destructive` (trễ hạn, khẩn) và `text-warning` (sắp tới hạn), không dùng `rose-*`/`amber-*`; control `h-7` (28px, `--control-height-sm`), avatar `size="sm"` (20px) trong hàng, `md` (24px) chỉ ở nơi cần nhận diện; popover rộng 224–256px; nét icon 1,5px. Khi không chắc, chọn cỡ nhỏ hơn một bậc và so với phần tử cạnh nó (sidebar, bảng). Chi tiết ở `DESIGN.md`.
- Mọi thay đổi UI phải tự kiểm lại kích thước trước khi báo xong: đối chiếu với thang trên và với phần tử lân cận, rà `text-sm`/`text-base`/`py-2+`/`size-8+` mới thêm, xem lại ảnh người dùng gửi (chụp màn Retina nên nhìn to hơn thực tế). Chưa xem được trên trình duyệt thì nói rõ chưa kiểm.


## Kiểm tra
- Dùng npm theo `package-lock.json`. Tận dụng dev server hiện có; nếu cần khởi chạy, dùng `npm run dev -- -p 3001` sau khi kiểm tra cổng. Server treo (không phản hồi) thì kill tiến trình của repo này và khởi động lại, không chờ thêm. Không xóa `.next/` để verify.
- Không dùng `next build` / `npm run build` để verify; chỉ chạy production build khi người dùng yêu cầu trực tiếp.
- Thay đổi TypeScript/logic: chạy `npm run typecheck`, `npm run lint` và test liên quan. Sửa docs: kiểm tra link/path và `git diff --check`; không cần chạy toàn bộ suite. `npm run verify` gồm typecheck + lint + toàn bộ test, dùng khi phạm vi thực sự cần.
- Chạy test cụ thể: `node scripts/run-tests.mjs --files tests/<file>.test.ts`. Thay placeholder bằng file tồn tại; đọc số test đã chạy và số skip. Runner hiện bỏ qua đường dẫn không tồn tại và có thể thoát 0 khi không chọn được test; đó không phải bằng chứng pass. Thiếu `--files` có thể chạy toàn bộ suite.
- Bug/hành vi mới cần regression test phù hợp; test yêu cầu thực và ranh giới quyền/scope, cố định thời gian khi cần. Không nới assertion hoặc cập nhật lint baseline để che lỗi. Không thêm test chỉ lặp lại implementation cho chỉnh sửa nhỏ, dễ đảo ngược.
- Test cần DB dùng môi trường test được repo hỗ trợ; không dùng dữ liệu vận hành để thử nghiệm. Thiếu môi trường thì báo phần chưa kiểm chứng. Không gọi lỗi là có sẵn nếu chưa có bằng chứng baseline.

## Hoàn thành
- Đối chiếu diff với phạm vi, chạy kiểm tra phù hợp và xử lý lỗi do thay đổi gây ra. Sau khi đạt, chỉ kiểm tra rộng hơn khi còn rủi ro cụ thể; không lặp lại cùng kiểm tra nếu không có thay đổi mới.
- Báo ngắn: kết quả, file chính, kiểm tra thực tế và phần còn thiếu. Với UI, phân biệt kiểm tra source/SSR với kiểm tra trình duyệt; chưa xem trên trình duyệt thì nói rõ.
- Giữ cây repo gọn: cập nhật tài liệu hiện có khi cần, không tạo thêm file quy tắc/checkpoint trùng lặp. Artifact tạm đặt ở thư mục tạm hoặc `artifacts/` đã được ignore.
