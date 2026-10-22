/**
 * Vị trí nút "⋯" (người dùng yêu cầu 21/10/2026 "toàn bộ icon … luôn nằm bên phải cuối cùng"): trong hàng nút ở đầu khung,
 * "⋯" là nút cuối cùng bên phải; Đóng/Thu nhỏ/Mở toàn trang của khung nằm ở mép trái. Quy tắc ở DESIGN.md "Vị trí nút ⋯".
 * Thêm đầu khung mới có "⋯" thì thêm vào danh sách này.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

interface HeaderCase {
  file: string;
  /** Đoạn mã của hàng đầu khung: từ `from` tới `to`. */
  from: string;
  to: string;
  /** Mở đầu và kết thúc của nút "⋯" (kèm menu của nó). */
  overflow: string;
  overflowEnd: string;
  /** Các nút phải đứng trước "⋯". */
  before: string[];
  /** Nút được phép đứng sau "⋯" vì nằm hàng khác (điện thoại) hoặc ẩn ở màn rộng. */
  allowAfter?: string;
}

const HEADERS: HeaderCase[] = [
  {
    file: "src/components/documents/workspace/document-quick-view.tsx",
    from: "const header = (",
    to: "</header>",
    overflow: "<MoreActionsMenu",
    overflowEnd: "/>",
    before: ['aria-label="Đóng"', 'aria-label="Quay lại danh sách văn bản"', 'aria-label="Sao chép liên kết"'],
  },
  {
    file: "src/components/meetings/meeting-detail-view.tsx",
    from: 'data-slot="meeting-detail-header"',
    to: "</header>",
    overflow: "<MeetingMoreMenu",
    overflowEnd: "/>",
    before: ['aria-label="Sao chép liên kết"'],
    // Nút Thuộc tính chỉ có dưới 1024px và nằm hàng thứ hai
    allowAfter: "Hiện thuộc tính",
  },
  {
    file: "src/components/inbox/inbox-view.tsx",
    from: "<PaneSearchHeader",
    to: '{(readFilter !== "all" || category !== "all") && (',
    overflow: 'aria-label="Tùy chọn hộp thư"',
    overflowEnd: "</MenuRoot>",
    before: ['searchLabel="Tìm kiếm thông báo"', 'aria-label="Lọc thông báo"'],
  },
  {
    file: "src/components/inbox/inbox-panel.tsx",
    from: ">Hộp thư</h2>",
    to: "<Tabs ",
    overflow: 'aria-label="Tùy chọn hộp thư"',
    overflowEnd: "</MenuRoot>",
    before: ["Lọc theo loại"],
  },
  {
    file: "src/components/assistant/assistant-header.tsx",
    from: '<div className="ml-auto flex shrink-0 items-center gap-0.5">',
    to: "</header>",
    overflow: 'aria-label="Thao tác với cuộc trò chuyện"',
    overflowEnd: "</MenuRoot>",
    before: ['aria-label="Cuộc trò chuyện mới"', "<AssistantSettingsButton", "Ẩn cột bên"],
  },
  {
    file: "src/components/assistant/assistant-dock-panel.tsx",
    from: 'data-slot="assistant-dock-panel"',
    to: "{start ? (",
    overflow: 'aria-label="Thao tác với cuộc trò chuyện"',
    overflowEnd: "</MenuRoot>",
    before: ['label="Đóng"', 'label="Thu nhỏ"', "Mở trong trang Trợ lý", "<h2"],
  },
];

test("đầu khung có ô tìm (PaneSearchHeader) đặt nút tìm trước actions, nên \"⋯\" truyền qua actions vẫn là nút cuối", () => {
  const source = readFileSync("src/components/workspace/pane-search-header.tsx", "utf8");
  const right = source.slice(source.indexOf('<div className="ml-auto'));
  assert.ok(right.lastIndexOf("</Button>") >= 0 && right.indexOf("{actions}") > right.lastIndexOf("</Button>"));
});

for (const c of HEADERS) {
  test(`"⋯" là nút cuối bên phải ở ${c.file}`, () => {
    const source = readFileSync(c.file, "utf8");
    const start = source.indexOf(c.from);
    assert.ok(start >= 0, `không thấy đầu khung (${c.from})`);
    const end = source.indexOf(c.to, start);
    assert.ok(end > start, `không thấy cuối đầu khung (${c.to})`);
    const header = source.slice(start, end);

    const at = header.indexOf(c.overflow);
    assert.ok(at >= 0, `không thấy nút "⋯" (${c.overflow})`);
    for (const label of c.before) {
      const i = header.indexOf(label);
      assert.ok(i >= 0, `không thấy ${label}`);
      assert.ok(i < at, `${label} phải đứng trước "⋯"`);
    }

    const after = header.slice(header.indexOf(c.overflowEnd, at) + c.overflowEnd.length);
    const allowed = c.allowAfter ? after.indexOf(c.allowAfter) : -1;
    const rest = allowed >= 0 ? after.slice(0, Math.max(0, after.lastIndexOf("<Button", allowed))) : after;
    assert.ok(!/<(Button|HeaderButton|MenuRoot)\b/.test(rest), `còn nút đứng sau "⋯"`);
  });
}
