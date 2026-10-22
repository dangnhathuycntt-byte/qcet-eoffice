/**
 * Menu nổi đặt bằng Floating UI không được chuyển động vị trí. Floating UI dựng menu ở (0,0) rồi mới đặt vào chỗ neo; lớp
 * `duration-*` không kèm `transition-[…]` chuyển mọi thuộc tính (mặc định `all`), nên menu trượt từ góc trên trái màn hình tới
 * chỗ neo (người dùng quay màn hình menu "/" ở ô ghi nhanh /notes ngày 21/10/2026). Hiệu ứng mở dùng `FLOATING_ENTER_CLASS`
 * (chỉ `opacity` và `scale`) cùng `transform: false`, không dùng `animate-in`/`zoom-in-*` (keyframe ghi `transform`).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx$/.test(name) ? [path] : [];
  });
}

test("phần tử đặt bằng floatingStyles không chuyển động vị trí", () => {
  const elements: string[] = [];
  const offenders: string[] = [];
  for (const file of sourceFiles("src")) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/style=\{[^}]*floatingStyles/g)) {
      const start = match.index ?? 0;
      // Thẻ mở của phần tử: tới dòng chỉ có ">" (các menu viết thuộc tính mỗi dòng một cái)
      const end = source.slice(start).search(/\n\s*>\n/);
      const tag = source.slice(start, end < 0 ? start + 600 : start + end);
      const where = `${relative("src", file)}:${source.slice(0, start).split("\n").length}`;
      elements.push(where);
      if (/animate-in|transition-all|\bduration-|\btransition\b(?!-)/.test(tag)) offenders.push(where);
    }
  }
  assert.ok(elements.length >= 3, `phải tìm thấy các menu nổi của editor, chỉ thấy: ${elements.join(", ")}`);
  assert.deepEqual(offenders, [], "dùng FLOATING_ENTER_CLASS (chỉ opacity, scale) thay cho duration-*/animate-in trên menu nổi");
});

test("useFloating đặt vị trí bằng top/left để `scale` không kéo menu trượt", () => {
  const calls: string[] = [];
  const offenders: string[] = [];
  for (const file of sourceFiles("src")) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/useFloating\(\{/g)) {
      const start = match.index ?? 0;
      const options = source.slice(start, source.indexOf("\n  });", start));
      const where = `${relative("src", file)}:${source.slice(0, start).split("\n").length}`;
      calls.push(where);
      if (!/\btransform:\s*false\b/.test(options)) offenders.push(where);
    }
  }
  assert.ok(calls.length >= 3, `chỉ thấy: ${calls.join(", ")}`);
  assert.deepEqual(offenders, []);
});

test("FLOATING_ENTER_CLASS chỉ chuyển opacity và scale", () => {
  const source = readFileSync("src/components/tasks/detail/task-block-editor.tsx", "utf8");
  const value = source.match(/const FLOATING_ENTER_CLASS =\s*"([^"]+)"/)?.[1];
  assert.ok(value, "không tìm thấy FLOATING_ENTER_CLASS");
  assert.match(value, /(^|\s)transition-\[opacity,scale\](\s|$)/);
  assert.doesNotMatch(value, /transition-all|transform|translate|left|top/);
});

// Menu có ô tìm và danh sách cao cố định: khung cao tối đa bằng chỗ trống (MENU_POPUP_FIT_CLASS), danh sách co lại. Danh sách
// tự trừ chiều cao phần phía trên (`calc(var(--available-height)-48px)`) thì thêm một hàng là menu cao hơn chỗ trống: nút nằm
// thấp (hàng chip dưới thân hộp tạo) thì menu lật lên và ô tìm ra ngoài mép trên màn hình (22/10/2026)
test("menu chọn người/văn bản vừa chỗ trống cạnh nút", () => {
  const fit = readFileSync("src/components/ui/menu.tsx", "utf8").match(/export const MENU_POPUP_FIT_CLASS = "([^"]+)"/)?.[1];
  assert.equal(fit, "md:flex md:max-h-[var(--available-height)] md:flex-col");
  for (const file of [
    "src/components/meetings/participants-picker.tsx",
    "src/components/tasks/create/person-pill-picker.tsx",
    "src/components/tasks/create/source-document-chip.tsx",
    "src/components/tasks/detail/task-property-controls.tsx",
  ]) {
    const source = readFileSync(file, "utf8");
    assert.ok(source.includes("MENU_POPUP_FIT_CLASS"), `${file}: khung menu phải gắn MENU_POPUP_FIT_CLASS`);
    assert.match(source, /max-h-(56|60|64|\[420px\]) min-h-0 overflow-y-auto/, `${file}: danh sách phải co lại được (min-h-0)`);
  }
  const offenders = sourceFiles("src")
    .filter((file) => /calc\(var\(--available-height\)-\d+px\)/.test(readFileSync(file, "utf8")))
    .map((file) => relative("src", file));
  assert.deepEqual(offenders, [], "không tự trừ chiều cao phần phía trên khỏi --available-height");
});
