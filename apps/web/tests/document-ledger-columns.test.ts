import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildColumnTemplate,
  getLedgerEmptyCopy,
  buildCompactColumnTemplate,
  DEFAULT_LEDGER_COLUMNS,
  DocumentLedgerTable,
  DocumentLedgerToolbar,
  type LedgerColumnVisibility,
} from "../src/components/documents/registry/document-ledger";
import type { OfficialDocument } from "@qcet/contracts/types/document";
import { todayInVietnam } from "@qcet/shared/lib/documents/document-ledger-format";

const ALL_OFF: LedgerColumnVisibility = {
  documentNumber: false,
  urgency: false,
  issuingAuthority: false,
  leadUnit: false,
  dueDate: false,
  issuedDate: false,
  status: false,
};

describe("document-ledger column template", () => {
  it("mặc định ở màn hình rộng có đủ 8 ô: chọn, văn bản, khẩn, cơ quan, chủ trì, hạn, ngày ban hành, trạng thái", () => {
    const tracks = buildColumnTemplate(DEFAULT_LEDGER_COLUMNS, true).split(" ");
    assert.equal(tracks.length, 8);
    assert.equal(tracks[0], "24px");
    assert.equal(tracks[1], "minmax(0,1fr)");
  });

  it("mức vừa bỏ hai cột chỉ hiện ở mức rộng (cơ quan, chủ trì), nên số track khớp số ô hiển thị", () => {
    const narrow = buildColumnTemplate(DEFAULT_LEDGER_COLUMNS, false).split(" ");
    assert.deepEqual(narrow, ["24px", "minmax(0,1fr)", "28px", "104px", "88px", "112px"]);
  });

  it("mức vừa chỉ hiện icon mức khẩn (28px); mức rộng đủ chỗ cho nhãn Thượng khẩn kèm icon (104px)", () => {
    const medium = buildColumnTemplate({ ...ALL_OFF, urgency: true }, false).split(" ");
    const wide = buildColumnTemplate({ ...ALL_OFF, urgency: true }, true).split(" ");
    assert.equal(medium[2], "28px");
    assert.equal(wide[2], "104px");
  });

  it("cột người dùng tắt bị bỏ khỏi mẫu, giữ đúng thứ tự cột còn lại", () => {
    const visible = { ...DEFAULT_LEDGER_COLUMNS, issuingAuthority: false, status: false };
    const wide = buildColumnTemplate(visible, true).split(" ");
    assert.deepEqual(wide, ["24px", "minmax(0,1fr)", "104px", "minmax(144px,0.4fr)", "104px", "88px"]);
  });

  it("chỉ còn ô chọn và văn bản khi tắt mọi cột tùy chọn", () => {
    assert.equal(buildColumnTemplate(ALL_OFF, true), "24px minmax(0,1fr)");
    assert.equal(buildColumnTemplate(ALL_OFF, false), "24px minmax(0,1fr)");
  });

  it("cột chỉ-xl bật lên không làm lệch mẫu hẹp", () => {
    const onlyWide = { ...ALL_OFF, leadUnit: true };
    assert.equal(buildColumnTemplate(onlyWide, false), "24px minmax(0,1fr)");
    assert.equal(buildColumnTemplate(onlyWide, true), "24px minmax(0,1fr) minmax(144px,0.4fr)");
  });

  it("bảng hẹp (Quick View mở) chỉ giữ chọn, văn bản, hạn xử lý và trạng thái", () => {
    assert.deepEqual(buildCompactColumnTemplate(DEFAULT_LEDGER_COLUMNS).split(" "), ["24px", "minmax(0,1fr)", "104px", "112px"]);
    assert.equal(buildCompactColumnTemplate({ ...DEFAULT_LEDGER_COLUMNS, dueDate: false, status: false }), "24px minmax(0,1fr)");
  });

  // SPEC §17.4B: gap 8px; đệm ngang 8px mỗi bên (16px), từ md đệm trái 24px + phải 20px (44px). Track `minmax(Npx,…)` tính
  // theo cận dưới N: bảng chật thì các cột đó co về đúng N, phần còn lại mới là của ô văn bản.
  const textWidth = (template: string, tableWidth: number, padding = 16) => {
    const tracks = template.split(" ");
    const fixed = tracks.reduce((sum, track) => {
      const min = /^minmax\((\d+)px,/.exec(track)?.[1] ?? (track.endsWith("px") ? track : "0");
      return sum + parseInt(min, 10);
    }, 0);
    return tableWidth - padding - (tracks.length - 1) * 8 - fixed;
  };

  it("mức hẹp tại 480px còn 200px cho ô văn bản (480 − 16 − 24 − 24 − 104 − 112)", () => {
    assert.equal(textWidth(buildCompactColumnTemplate(DEFAULT_LEDGER_COLUMNS), 480), 200);
  });

  it("mức vừa tại 720px và mức rộng tại 1100px (đệm 44px của md) vẫn để ô văn bản ≥ 200px", () => {
    assert.ok(textWidth(buildColumnTemplate(DEFAULT_LEDGER_COLUMNS, false), 720, 44) >= 200);
    assert.ok(textWidth(buildColumnTemplate(DEFAULT_LEDGER_COLUMNS, true), 1100, 44) >= 200);
  });
});

const doc = (id: string, extra: Partial<OfficialDocument> = {}): OfficialDocument => ({
  id,
  type: "inbox",
  documentNumber: `${id}/UBND`,
  registrationNumber: 11,
  issuedDate: "2026-10-09",
  dueDate: "2026-10-20",
  issuingAuthority: "Sở Giáo dục và Đào tạo",
  summary: `Trích yếu ${id}`,
  urgency: "normal",
  status: "processing",
  leadDepartment: "Phòng Đào tạo",
  signatory: "",
  ...extra,
});

const renderTable = (props: Partial<React.ComponentProps<typeof DocumentLedgerTable>> = {}) =>
  renderToStaticMarkup(
    React.createElement(DocumentLedgerTable, {
      documents: [doc("a"), doc("b", { urgency: "flash", dueDate: undefined, leadDepartment: "Chưa phân công" })],
      selectedIds: new Set<string>(),
      numberHeader: "Số đến",
      visibleColumns: DEFAULT_LEDGER_COLUMNS,
      onOpen: () => {},
      onToggleSelect: () => {},
      onSelectAll: () => {},
      ...props,
    }),
  );

const rowTag = (html: string, id: string) => html.match(new RegExp(`<div[^>]*data-doc-id="${id}"[^>]*>`))?.[0] ?? "";

describe("hàng sổ văn bản (SPEC §17.4)", () => {
  it("đang xem (aria-current) tách khỏi đã chọn (aria-selected): mở A không tick A", () => {
    const html = renderTable({ selectedDocumentId: "a", selectedIds: new Set(["b"]) });
    assert.ok(rowTag(html, "a").includes('aria-current="true"'));
    assert.ok(rowTag(html, "a").includes('aria-selected="false"'));
    assert.ok(rowTag(html, "b").includes('aria-selected="true"'));
    assert.ok(!rowTag(html, "b").includes("aria-current"));
  });

  it("hàng hai dòng 48px khi có số, ký hiệu, tắt thì một dòng 40px; trích yếu cắt cuối, cơ quan/chủ trì xuống dòng thay vì ghi tắt", () => {
    const html = renderTable();
    const desktop48 = /[\s"]min-h-12[\s"]/;
    assert.ok(desktop48.test(rowTag(html, "a")));
    const oneLine = rowTag(renderTable({ visibleColumns: { ...DEFAULT_LEDGER_COLUMNS, documentNumber: false } }), "a");
    assert.ok(oneLine.includes("min-h-10") && !desktop48.test(oneLine));
    assert.ok(rowTag(html, "a").includes("max-md:min-h-12"), "điện thoại: hàng 48px như danh sách nhiệm vụ");
    assert.ok(html.includes("truncate text-compact font-medium"));
    assert.ok(html.includes("break-words text-xs leading-5 text-muted-foreground line-clamp-2"));
    // line-clamp (display: -webkit-box) không được nằm cùng thẻ với `hidden` của ô chỉ-hiện-khi-rộng
    for (const cell of html.match(/<span role="cell"[^>]*>/g) ?? []) assert.ok(!(cell.includes("hidden") && cell.includes("line-clamp")), cell);
  });

  it("ngày độc lập có năm; chỉ rút gọn khi đang lọc đúng năm đó", () => {
    assert.ok(renderTable().includes(">20/10/2026<"));
    const filtered = renderTable({ filterYear: 2026 });
    assert.ok(filtered.includes(">20/10<") && !filtered.includes(">20/10/2026<"));
  });

  it("giá trị rỗng hiện — kèm tên truy cập, không thành trạng thái nghiệp vụ", () => {
    const html = renderTable();
    assert.ok(html.includes("Chưa có hạn xử lý"));
    assert.ok(html.includes("Chưa có đơn vị chủ trì"));
  });

  it("mỗi mức khẩn có tên truy cập riêng; chọn tất cả nói rõ phạm vi trang", () => {
    const html = renderTable();
    assert.ok(html.includes('aria-label="Mức khẩn: Hỏa tốc"'));
    assert.ok(html.includes('aria-label="Mức khẩn: Thường"'));
    assert.ok(html.includes('aria-label="Chọn tất cả văn bản trên trang này"'));
  });

  it("văn bản thường không có chữ \"Thường\" hay cột tín hiệu: chỉ ba gạch mờ, tên truy cập vẫn đủ; văn bản khẩn giữ nhãn", () => {
    const html = renderTable();
    assert.ok(!/>Thường</.test(html), "không in chữ Thường trên hàng");
    assert.ok(html.includes('aria-label="Mức khẩn: Thường"'));
    assert.ok(html.includes('aria-label="Độ ưu tiên: Không ưu tiên"') === false, "nhãn truy cập nói mức khẩn, không nói độ ưu tiên");
    assert.ok(/>Hỏa tốc</.test(html), "văn bản khẩn vẫn có nhãn ở mức rộng");
  });

  it("số, ký hiệu nằm dòng dưới trích yếu ở mọi mức bảng, không chen sau trích yếu bằng chữ mono bị cắt", () => {
    const html = renderTable();
    const number = html.match(/<span data-slot="document-number" class="([^"]+)"[^>]*>a\/UBND<\/span>/);
    assert.ok(number, "có dòng số, ký hiệu");
    assert.ok(!number[1].includes("hidden"), "không chỉ hiện ở mức rộng");
    assert.ok(!html.includes("font-mono"), "không còn chữ mono trong bảng");
    assert.ok(!html.includes("shrink-[2]"));
    const off = renderTable({ visibleColumns: { ...DEFAULT_LEDGER_COLUMNS, documentNumber: false } });
    assert.ok(!off.includes('data-slot="document-number"'), "tắt trong Hiển thị thì không còn dòng số");
  });

  it("ngày ban hành không có icon (như cột Ngày tạo của bảng Nhiệm vụ)", () => {
    const html = renderTable();
    const cell = html.match(/<span[^>]*title="Ban hành 09\/10\/2026"[^>]*>.*?<\/span>/)?.[0] ?? "";
    assert.ok(cell, "có ô ngày ban hành");
    assert.ok(!cell.includes("<svg"), cell);
  });

  it("chữ hạn xử lý mang màu theo độ gấp như bảng Nhiệm vụ, không tô đậm màu chữ thường", () => {
    const shift = (days: number) => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + days);
      return todayInVietnam(d);
    };
    const html = renderTable({
      documents: [doc("late", { dueDate: shift(-3) }), doc("soon", { dueDate: shift(1) }), doc("far", { dueDate: shift(10) })],
    });
    const dueText = (id: string) => {
      const row = html.slice(html.indexOf(`data-doc-id="${id}"`));
      return row.match(/<span class="truncate ([^"]+)">\d{2}\/\d{2}/)?.[1] ?? "";
    };
    assert.equal(dueText("late"), "text-destructive");
    assert.equal(dueText("soon"), "text-warning");
    assert.equal(dueText("far"), "text-muted-foreground");
    assert.ok(!/<span class="truncate font-medium[^"]*">\d{2}\/\d{2}/.test(html), "chữ hạn không tô đậm");
  });

  it("đang tải: khối aria-busy với hàng giữ chỗ theo cột (Skeleton), không phải một vạch dài mỗi hàng", () => {
    const html = renderTable({ isLoading: true });
    assert.ok(html.includes('aria-busy="true"'));
    const rows = html.match(/<div aria-hidden="true" class="grid /g) ?? [];
    assert.equal(rows.length, 10);
    assert.ok((html.match(/data-slot="skeleton"/g) ?? []).length >= 10 * 5, "mỗi hàng có ô giữ chỗ cho từng cột");
    assert.ok(!html.includes("animate-pulse"));
  });

  it("dòng đang xem có lối tắt → sang Quick View khi có xử lý", () => {
    const html = renderTable({ selectedDocumentId: "a", onFocusDetail: () => {} });
    assert.ok(rowTag(html, "a").includes('aria-keyshortcuts="ArrowRight"'));
    assert.ok(!rowTag(html, "b").includes("aria-keyshortcuts"));
  });
});

describe("trạng thái rỗng theo ngữ cảnh", () => {
  it("nhóm ở sidebar (Đã xử lý) không bị báo là không khớp bộ lọc", () => {
    const copy = getLedgerEmptyCopy({ isResultFiltered: false, type: "inbox", bucket: "done" });
    assert.equal(copy.title, "Chưa có văn bản đến đã xử lý");
    assert.ok(!copy.title.includes("bộ lọc") && !copy.description.includes("bộ lọc"));
    assert.equal(getLedgerEmptyCopy({ isResultFiltered: false, type: "outbox", bucket: "issued" }).title, "Chưa có văn bản đi đã phát hành");
  });

  it("có từ khóa thì nêu từ khóa; chỉ có bộ lọc thì nói không khớp bộ lọc; sổ trống theo loại sổ", () => {
    assert.equal(getLedgerEmptyCopy({ isResultFiltered: true, search: " 5491 " }).title, 'Không tìm thấy văn bản với từ khóa "5491"');
    assert.equal(getLedgerEmptyCopy({ isResultFiltered: true, type: "inbox", bucket: "done" }).title, "Không có văn bản khớp bộ lọc");
    assert.equal(getLedgerEmptyCopy({ isResultFiltered: false, type: "inbox" }).title, "Chưa có văn bản đến");
    assert.equal(getLedgerEmptyCopy({ isResultFiltered: false }).title, "Chưa có văn bản nào");
    // Tranh chỉ cho sổ chưa có dữ liệu; lọc rỗng dùng icon. Nhóm chờ xử lý trống = đã xử lý hết.
    assert.equal(getLedgerEmptyCopy({ isResultFiltered: true, type: "inbox" }).illustration, undefined);
    assert.equal(getLedgerEmptyCopy({ isResultFiltered: false, type: "inbox" }).illustration, "doc-in");
    assert.equal(getLedgerEmptyCopy({ isResultFiltered: false, type: "outbox", bucket: "issued" }).illustration, "doc-out");
    assert.equal(getLedgerEmptyCopy({ isResultFiltered: false, type: "outbox", bucket: "pending" }).illustration, "all-done");
    assert.equal(getLedgerEmptyCopy({ isResultFiltered: false, type: "submission" }).illustration, "submission");
  });
});

describe("thanh công cụ sổ văn bản", () => {
  const renderToolbar = (count: number | null) =>
    renderToStaticMarkup(
      React.createElement(DocumentLedgerToolbar, {
        title: "Văn bản đến",
        count,
        searchValue: "",
        onSearchChange: () => {},
        urgency: "ALL",
        onUrgencyChange: () => {},
        status: "ALL",
        onStatusChange: () => {},
        onYearChange: () => {},
        leadUnitId: "",
        leadUnitOptions: [],
        onLeadUnitChange: () => {},
        onClearFilters: () => {},
        visibleColumns: DEFAULT_LEDGER_COLUMNS,
        onVisibleColumnsChange: () => {},
      }),
    );

  it("số văn bản nằm cạnh tiêu đề; không có số (đang tải, lỗi, hàng lọc đã hiện số) thì không in số cũ", () => {
    assert.ok(/data-slot="document-ledger-count"[^>]*>37<span class="sr-only"> văn bản<\/span>/.test(renderToolbar(37)));
    assert.ok(!renderToolbar(null).includes("document-ledger-count"));
  });
});
