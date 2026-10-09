import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_FILE_STATE,
  MAX_FILES_AS_TICKS,
  clampZoom,
  formatPageDetail,
  getFileState,
  patchFileState,
  parseFilesListPreference,
  resolveActiveFileId,
  resolveFilesListOpen,
  sortDocumentFiles,
} from "../src/lib/documents/file-viewer-state";

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

describe("Danh sách tệp ở Quick View (D15)", () => {
  test("không có lựa chọn: mở khi ≤ 5 tệp, thu gọn khi > 5", () => {
    for (const n of [1, 5]) assert.equal(resolveFilesListOpen(n, null), true);
    for (const n of [6, 12]) assert.equal(resolveFilesListOpen(n, null), false);
  });

  test("lựa chọn của người dùng thắng mặc định theo số tệp", () => {
    assert.equal(resolveFilesListOpen(12, "open"), true);
    assert.equal(resolveFilesListOpen(2, "closed"), false);
  });

  test("giá trị lưu không hợp lệ bị bỏ qua", () => {
    assert.equal(parseFilesListPreference("open"), "open");
    assert.equal(parseFilesListPreference("closed"), "closed");
    assert.equal(parseFilesListPreference("x"), null);
    assert.equal(parseFilesListPreference(null), null);
  });
});
