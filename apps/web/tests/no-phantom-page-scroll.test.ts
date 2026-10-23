/**
 * Trang Nhiệm vụ hiện thanh cuộn của cả cửa sổ (người dùng báo "thanh scroll to" 23/10/2026): `Dialog.Description className="sr-only"`
 * của hộp Tạo nhiệm vụ nằm SAU `Dialog.Portal` nên dựng ngay trong nội dung trang. `sr-only` là `position: absolute`; vùng cuộn của
 * khung trang không định vị (static) nên không cắt nó, khối chứa là tổ tiên bên ngoài, và phần tử 1px nằm cuối nội dung làm
 * `body` cuộn thêm ~370px (đo 1000×650: body scrollHeight 1021 > 650, bỏ phần tử đó thì 650). Mô tả của hộp phải nằm trong `Popup`.
 * Kiểm trên trình duyệt: `document.body.scrollHeight - clientHeight` bằng 0 ở /tasks, /meetings, /inbox, /notes, /org, /assistant.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx$/.test(name) ? [path] : [];
  });
}

test("không có Dialog.Description sr-only đặt sau Dialog.Portal (rơi ra ngoài khung hộp, vào luồng trang)", () => {
  const offenders: string[] = [];
  for (const file of sourceFiles("src")) {
    const source = readFileSync(file, "utf8");
    const portalEnd = source.lastIndexOf("</Dialog.Portal>");
    if (portalEnd < 0) continue;
    const after = source.slice(portalEnd);
    if (/Dialog\.Description[^>]*sr-only/.test(after)) offenders.push(file);
  }
  assert.deepEqual(offenders, [], "mô tả `sr-only` phải nằm trong Dialog.Popup, kẻo làm cả trang cuộn");
});

test("hộp Tạo nhiệm vụ: mô tả nằm trong Popup", () => {
  const source = readFileSync("src/components/tasks/create/create-task-modal.tsx", "utf8");
  const popupStart = source.indexOf("<Dialog.Popup");
  const popupEnd = source.indexOf("</Dialog.Popup>");
  const description = source.indexOf("<Dialog.Description");
  assert.ok(popupStart > 0 && description > popupStart && description < popupEnd);
});

test("main của khung ứng dụng là khối chứa (relative) cho phần tử absolute không có tổ tiên định vị", () => {
  // Quét 19 trang × 3 cỡ (1000×650, 1440×900, 390×800) với dữ liệu thử: /documents cuộn cả cửa sổ thêm 389px/139px vì các `span.sr-only`
  // trong hàng sổ văn bản có khối chứa là khung ngoài cùng, `overflow-hidden` của main không cắt được. `relative` ở main sửa cả lớp lỗi.
  const shell = readFileSync("src/components/layout/app-shell.tsx", "utf8");
  const mainClasses = [...shell.matchAll(/"(relative )?(flex[^"]*overflow-hidden)"/g)].filter((m) => m[2].includes("min-w-0") || m[2].includes("md:ml-2"));
  assert.ok(mainClasses.length >= 3, "ba nhánh className của <main> (workspace, full-height, trang thường)");
  for (const match of mainClasses) assert.equal(match[1], "relative ", `thiếu relative: ${match[2].slice(0, 60)}`);
});
