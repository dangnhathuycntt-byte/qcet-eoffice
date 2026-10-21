/**
 * Menu "/" của editor khối (21/10/2026): gõ để lọc, mục khớp tên đứng trước, có từ khóa tiếng Anh như Notion/Linear,
 * phím tắt chỉ ghi phím markdown editor đổi được thật.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { rankSlashOptions } from "@/components/tasks/detail/slash-menu-search";
import { MENU_OPTIONS } from "@/components/tasks/detail/task-block-editor";

const titles = (query: string) => rankSlashOptions(MENU_OPTIONS, query).map((option) => option.title);

describe("menu '/': lọc và xếp hạng", () => {
  it("ô trống giữ nguyên thứ tự và đủ mục", () => {
    assert.deepEqual(titles(""), MENU_OPTIONS.map((option) => option.title));
    assert.deepEqual(titles("   "), MENU_OPTIONS.map((option) => option.title));
  });

  it("gõ không dấu khớp tên có dấu; khớp đầu một từ đứng trước khớp giữa từ", () => {
    assert.equal(titles("anh")[0], "Hình ảnh");
    assert.deepEqual(titles("tieu de").slice(0, 3), ["Tiêu đề 1", "Tiêu đề 2", "Tiêu đề 3"]);
    assert.equal(titles("bang")[0], "Bảng biểu");
  });

  it("từ khóa tiếng Anh và phím tắt markdown tìm ra đúng khối", () => {
    assert.equal(titles("h2")[0], "Tiêu đề 2");
    assert.equal(titles("todo")[0], "Checklist");
    assert.equal(titles("image")[0], "Hình ảnh");
    assert.equal(titles("file")[0], "Tệp đính kèm");
    assert.equal(titles("##")[0], "Tiêu đề 2");
  });

  it("không khớp gì thì rỗng (ô nhập sẽ cho Space trả chữ về văn bản thường)", () => {
    assert.deepEqual(titles("qqq"), []);
  });
});

describe("menu '/': phím tắt chỉ là phím markdown thật", () => {
  it("không còn gợi ý lặp lại tên lệnh như 'text', '/table'", () => {
    for (const option of MENU_OPTIONS) {
      if (!option.shortcut) continue;
      assert.match(option.shortcut, /^(#{1,3}|-|1\.|\[\]|>|---)$/, `${option.title}: ${option.shortcut}`);
    }
  });
});
