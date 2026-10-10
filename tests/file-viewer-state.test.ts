import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_FILE_STATE,
  MAX_FILES_AS_TICKS,
  clampZoom,
  describeFileFormat,
  findPreviewableAlternative,
  formatPageDetail,
  getFileFamily,
  getPreviewKind,
  getFileState,
  patchFileState,
  resolveActiveFileId,
  sortDocumentFiles,
} from "../src/lib/documents/file-viewer-state";
import { isAllowedDocxHref } from "../src/lib/documents/docx-links";

const files = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `f${i + 1}` }));

describe("Trạng thái trình xem nhiều tệp", () => {
  for (const count of [0, 1, 5, 12]) {
    test(`${count} tệp: id yêu cầu hợp lệ được giữ, sai/thiếu thì về tệp đầu (${count ? "f1" : "rỗng"})`, () => {
      const list = files(count);
      assert.equal(resolveActiveFileId(list, undefined), count ? "f1" : "");
      assert.equal(resolveActiveFileId(list, "khong-co"), count ? "f1" : "");
      if (count >= 5) assert.equal(resolveActiveFileId(list, "f5"), "f5");
    });
  }

  test("không yêu cầu tệp: bản đầu không xem trước được thì mở tệp PDF/ảnh đầu tiên, không có thì vẫn tệp đầu", () => {
    // .doc (Word nhị phân cũ) không xem trước được; .docx thì được
    const docx = { id: "goc", name: "Kế hoạch.doc", mimeType: "application/msword" };
    const pdf = { id: "scan", name: "ban-scan.pdf", mimeType: "application/pdf" };
    const png = { id: "anh", name: "anh.PNG", mimeType: null };
    assert.equal(resolveActiveFileId([docx, pdf, png], null), "scan");
    assert.equal(resolveActiveFileId([docx, png], null), "anh");
    assert.equal(resolveActiveFileId([pdf, docx], null), "scan");
    assert.equal(resolveActiveFileId([docx, { ...docx, id: "x", name: "b.xlsx" }], null), "goc");
    // Người dùng chọn rõ tệp (?file=) thì giữ đúng tệp đó dù không xem trước được
    assert.equal(resolveActiveFileId([docx, pdf], "goc"), "goc");
    const modern = { id: "moi", name: "Kế hoạch.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
    assert.equal(resolveActiveFileId([modern, pdf], null), "moi");
  });

  test("gợi ý tệp xem được khác tệp đang xem; tên định dạng cho thông báo", () => {
    const list = [{ id: "a", name: "a.xlsx" }, { id: "b", name: "b.pdf" }, { id: "c", name: "c.zip" }];
    assert.equal(findPreviewableAlternative(list, "a")?.id, "b");
    assert.equal(findPreviewableAlternative(list, "b"), undefined);
    assert.equal(describeFileFormat("Kế hoạch.DOCX"), "Tệp Word (.docx)");
    assert.equal(describeFileFormat("bang.xlsx"), "Tệp Excel (.xlsx)");
    assert.equal(describeFileFormat("goi.zip"), "Tệp .zip");
    assert.equal(describeFileFormat("khong-duoi"), "Tệp");
  });

  test("xem trước: PDF, ảnh, Word mới (.docx); .doc, Excel, tệp nén thì không", () => {
    assert.equal(getPreviewKind("application/pdf", "x"), "pdf");
    assert.equal(getPreviewKind(null, "anh.JPG"), "image");
    assert.equal(getPreviewKind(null, "ke-hoach.DOCX"), "docx");
    assert.equal(getPreviewKind("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "khong-duoi"), "docx");
    assert.equal(getPreviewKind("application/msword", "cu.doc"), "other");
    assert.equal(getPreviewKind(null, "bang.xlsx"), "other");
  });

  test("liên kết trong tệp Word: chỉ giữ web, thư điện tử và mục nội bộ", () => {
    for (const ok of ["https://qcet.edu.vn", "HTTP://a.b", "mailto:vt@qcet.edu.vn", "#_Toc1"]) assert.ok(isAllowedDocxHref(ok), ok);
    for (const bad of ["javascript:alert(1)", " JavaScript:x", "file:///C:/a", "data:text/html,x", "vbscript:x", "", null]) assert.ok(!isAllowedDocxHref(bad), String(bad));
  });

  test("nhóm định dạng cho icon loại tệp: theo đuôi, thiếu đuôi thì theo MIME", () => {
    assert.equal(getFileFamily("5491_SGDĐT-QLCLGDCN-signed_01.PDF"), "pdf");
    assert.equal(getFileFamily("27.8 đẩy nhanh tiến độ_final.docx"), "word");
    assert.equal(getFileFamily("24.GiaLai-BC CSDL_2025-2026.xlsx"), "excel");
    assert.equal(getFileFamily("bao-cao.pptx"), "slide");
    assert.equal(getFileFamily("anh-chup.jpg"), "image");
    assert.equal(getFileFamily("ho-so.rar"), "archive");
    assert.equal(getFileFamily("khong-duoi", "application/pdf"), "pdf");
    assert.equal(getFileFamily("khong-duoi", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"), "excel");
    assert.equal(getFileFamily("ghi-chu.txt"), "other");
  });

  test("khôi phục đúng zoom/trang của từng tệp, tệp mới có giá trị mặc định", () => {
    let states = patchFileState({}, "a", { zoom: 150, page: 4, ratio: 0.3 });
    states = patchFileState(states, "b", { zoom: 80 });
    assert.deepEqual(getFileState(states, "a"), { zoom: 150, page: 4, ratio: 0.3 });
    assert.deepEqual(getFileState(states, "b"), { ...DEFAULT_FILE_STATE, zoom: 80 });
    assert.deepEqual(getFileState(states, "c"), DEFAULT_FILE_STATE);
  });

  test("patch không đổi giá trị thì giữ nguyên tham chiếu (tránh render thừa)", () => {
    const states = patchFileState({}, "a", { zoom: 120 });
    assert.equal(patchFileState(states, "a", { zoom: 120 }), states);
  });

  test("zoom bị chặn 50–200", () => {
    assert.equal(clampZoom(10), 50);
    assert.equal(clampZoom(999), 200);
    assert.equal(clampZoom(115.4), 115);
  });

  test("bản gốc đứng đầu, còn lại giữ nguyên thứ tự", () => {
    const sorted = sortDocumentFiles([
      { id: "1", isOriginal: false },
      { id: "2", isOriginal: true },
      { id: "3", isOriginal: false },
    ]);
    assert.deepEqual(sorted.map((f) => f.id), ["2", "1", "3"]);
  });

  test("dòng phụ gồm số trang và dung lượng khi có", () => {
    assert.equal(formatPageDetail(3, "2,4 MB"), "3 trang · 2,4 MB");
    assert.equal(formatPageDetail(undefined, "10 KB"), "10 KB");
    assert.equal(formatPageDetail(undefined, ""), "");
  });

  test("ngưỡng vạch trên rail là 8 tệp", () => {
    assert.equal(MAX_FILES_AS_TICKS, 8);
  });
});
