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
  type LedgerColumnVisibility,
} from "../src/components/documents/registry/document-ledger";
import type { OfficialDocument } from "../src/types/document";

const ALL_OFF: LedgerColumnVisibility = {
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

  it("màn hình hẹp bỏ hai cột chỉ hiện từ xl, nên số track khớp số ô hiển thị", () => {
    const narrow = buildColumnTemplate(DEFAULT_LEDGER_COLUMNS, false).split(" ");
    assert.equal(narrow.length, 6);
    assert.ok(!narrow.includes("minmax(144px,0.4fr)"), "cơ quan và chủ trì không được có trong mẫu vừa");
  });

  it("mức vừa chỉ hiện icon mức khẩn (28px); mức rộng đủ chỗ cho nhãn (112px)", () => {
    const medium = buildColumnTemplate({ ...ALL_OFF, urgency: true }, false).split(" ");
    const wide = buildColumnTemplate({ ...ALL_OFF, urgency: true }, true).split(" ");
    assert.equal(medium[2], "28px");
    assert.equal(wide[2], "112px");
  });

  it("cột người dùng tắt bị bỏ khỏi mẫu, giữ đúng thứ tự cột còn lại", () => {
    const visible = { ...DEFAULT_LEDGER_COLUMNS, issuingAuthority: false, status: false };
    const wide = buildColumnTemplate(visible, true).split(" ");
    assert.deepEqual(wide, ["24px", "minmax(0,1fr)", "112px", "minmax(144px,0.4fr)", "96px", "96px"]);
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
    assert.deepEqual(buildCompactColumnTemplate(DEFAULT_LEDGER_COLUMNS).split(" "), ["24px", "minmax(0,1fr)", "96px", "112px"]);
    assert.equal(buildCompactColumnTemplate({ ...DEFAULT_LEDGER_COLUMNS, dueDate: false, status: false }), "24px minmax(0,1fr)");
  });

  // SPEC §17.4B: gap 8px, padding ngang 8px mỗi bên; ô văn bản còn đủ chỗ ở cận dưới của từng mức
  const textWidth = (template: string, tableWidth: number) => {
    const tracks = template.split(" ");
    const fixed = tracks.filter((track) => track.endsWith("px")).reduce((sum, track) => sum + parseInt(track, 10), 0);
    return tableWidth - 16 - (tracks.length - 1) * 8 - fixed;
  };

  it("mức hẹp tại 480px còn 208px cho ô văn bản (480 − 16 − 24 − 24 − 96 − 112)", () => {
    assert.equal(textWidth(buildCompactColumnTemplate(DEFAULT_LEDGER_COLUMNS), 480), 208);
  });

  it("mức vừa tại 720px và mức rộng tại 1100px vẫn để ô văn bản ≥ 200px", () => {
    assert.ok(textWidth(buildColumnTemplate(DEFAULT_LEDGER_COLUMNS, false), 720) >= 200);
    assert.ok(textWidth(buildColumnTemplate(DEFAULT_LEDGER_COLUMNS, true), 1100) >= 200);
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

  it("hàng tối thiểu 40px (Carbon medium); trích yếu cắt cuối, cơ quan/chủ trì xuống dòng thay vì ghi tắt", () => {
    const html = renderTable();
    assert.ok(rowTag(html, "a").includes("min-h-10"));
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
