import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DRAFT_FILE_MAX_BYTES, describeDraftRejections, partitionDraftFiles } from "../src/lib/documents/draft-files";

const fileOf = (name: string, size = 1024) => new File([new Uint8Array(size)], name);

describe("Tệp dự thảo văn bản đi: kiểm loại và cỡ khi chọn hoặc kéo thả", () => {
  it("nhận PDF và Word (không phân biệt hoa thường), từ chối loại khác dù kéo thả qua được `accept`", () => {
    const { accepted, rejected } = partitionDraftFiles([fileOf("a.PDF"), fileOf("b.docx"), fileOf("c.doc"), fileOf("d.png"), fileOf("e.xlsx"), fileOf("khong-duoi")]);
    assert.deepEqual(accepted.map((f) => f.name), ["a.PDF", "b.docx", "c.doc"]);
    assert.deepEqual(rejected.map((r) => [r.file.name, r.reason]), [["d.png", "type"], ["e.xlsx", "type"], ["khong-duoi", "type"]]);
  });

  it("từ chối tệp quá 10MB, đúng 10MB vẫn nhận", () => {
    const { accepted, rejected } = partitionDraftFiles([fileOf("vua.pdf", DRAFT_FILE_MAX_BYTES), fileOf("qua.pdf", DRAFT_FILE_MAX_BYTES + 1)]);
    assert.deepEqual(accepted.map((f) => f.name), ["vua.pdf"]);
    assert.deepEqual(rejected.map((r) => [r.file.name, r.reason]), [["qua.pdf", "size"]]);
  });

  it("tệp trùng tên và cỡ với tệp đã có hoặc trong cùng lượt bị bỏ qua, không tính là lỗi", () => {
    const existing = [fileOf("a.pdf", 10)];
    const { accepted, rejected } = partitionDraftFiles([fileOf("a.pdf", 10), fileOf("b.pdf", 10), fileOf("b.pdf", 10), fileOf("a.pdf", 11)], existing);
    assert.deepEqual(accepted.map((f) => [f.name, f.size]), [["b.pdf", 10], ["a.pdf", 11]]);
    assert.equal(rejected.length, 0);
  });

  it("câu báo lỗi nêu tối đa hai tên mỗi loại và gộp phần còn lại; không lỗi thì không có câu", () => {
    assert.equal(describeDraftRejections([]), undefined);
    const { rejected } = partitionDraftFiles([fileOf("1.png"), fileOf("2.png"), fileOf("3.png"), fileOf("lon.pdf", DRAFT_FILE_MAX_BYTES + 1)]);
    assert.equal(describeDraftRejections(rejected), '"1.png", "2.png" và 1 tệp khác không phải PDF hoặc Word. "lon.pdf" vượt quá 10MB.');
  });
});
