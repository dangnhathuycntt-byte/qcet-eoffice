/**
 * Chuyển động thêm/bỏ mục của danh sách (23/10/2026, người dùng: "thêm animated kể cả xóa list trong bảng… ưu tiên hiệu năng và
 * mượt"). Cơ chế ở `lib/motion/list-motion.ts` chạy bằng Web Animations API, chỉ `transform` và `opacity` (compositor), không
 * animate `height`/`top`/`margin` và không kéo thêm gói `motion/domMax`. Đo trên trình duyệt (Chromium và WebKit: dòng bị xóa mờ
 * 100ms rồi các dòng sau trượt lên đúng bằng chiều cao dòng, đơn điệu; thêm thì dòng mới hiện dần và các dòng sau trượt xuống;
 * xóa 5 dòng một lượt hoặc đổi chỗ thì tức thì; giảm chuyển động thì tắt hẳn) nằm ở `.playwright-mcp/list-motion-verify.mjs`; test
 * này giữ các bất biến đọc được từ mã nguồn.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const motion = readFileSync("src/lib/motion/list-motion.ts", "utf8");
const table = readFileSync("src/components/ui/table.tsx", "utf8");
const ledger = readFileSync("src/components/documents/registry/document-ledger.tsx", "utf8");
const tasksTable = readFileSync("src/components/tasks/table/modular-cascading-task-table.tsx", "utf8");

/** Mọi lời gọi `.animate(` trong tệp: phần keyframe (mảng đầu tiên). */
function keyframeBlocks(source: string): string[] {
  const blocks: string[] = [];
  for (const match of source.matchAll(/\.animate\(\s*\[/g)) {
    const start = (match.index ?? 0) + match[0].length - 1;
    let depth = 0;
    for (let i = start; i < source.length; i++) {
      if (source[i] === "[") depth++;
      if (source[i] === "]" && --depth === 0) {
        blocks.push(source.slice(start, i + 1));
        break;
      }
    }
  }
  return blocks;
}

test("chỉ animate transform và opacity, không thuộc tính gây layout", () => {
  const blocks = keyframeBlocks(motion);
  assert.ok(blocks.length >= 3, "phải có các keyframe: trượt, hiện dần, mờ dần");
  for (const block of blocks) {
    const props = [...block.matchAll(/(?:^|[{,\s])([a-zA-Z-]+)\s*:/g)].map((m) => m[1]);
    for (const prop of props) assert.ok(["transform", "opacity"].includes(prop), `keyframe animate "${prop}": ${block.slice(0, 80)}`);
  }
  assert.ok(!/from "motion/.test(motion), "không phụ thuộc gói motion (layout cần domMax, +14kb)");
});

test("bỏ qua khi giảm chuyển động, tab ẩn, đổi nhiều mục một lượt, đổi chỗ và mục ngoài khung nhìn", () => {
  assert.match(motion, /prefers-reduced-motion: reduce/, "WAAPI không qua MotionConfig nên phải tự kiểm giảm chuyển động");
  assert.match(motion, /document\.hidden/);
  assert.match(motion, /changes > MAX_CHANGES/, "lọc, sắp xếp, đổi trang đổi nhiều mục: tức thì");
  assert.match(motion, /removedAll\.has\(node\)/, "React đổi chỗ bằng insertBefore: không tính là thêm");
  assert.match(motion, /rect\.bottom < 0 \|\| rect\.top > window\.innerHeight/, "mục ngoài khung nhìn không cần chuyển động");
});

test("trượt bằng FLIP cộng dồn để xóa liên tiếp không nhảy; thời lượng lấy từ token", () => {
  assert.match(motion, /composite: "add"/);
  assert.match(motion, /motionDuration\.micro/);
  assert.match(motion, /motionDuration\.normal/);
  assert.match(motion, /motionEase\.enter/);
  assert.match(motion, /motionEase\.exit/);
  assert.ok(!/duration:\s*\d/.test(motion), "không ghi thời lượng cứng");
});

test("bóng của dòng bị xóa chỉ để nhìn: không nhận tương tác và không có định danh trùng", () => {
  for (const needle of ['removeAttribute("id")', 'setAttribute("inert", "")', 'setAttribute("aria-hidden", "true")', 'pointerEvents = "none"', 'startsWith("data-")']) {
    assert.ok(motion.includes(needle), `thiếu ${needle}`);
  }
  assert.match(motion, /hasAttribute\(GHOST_ATTR\)/, "observer bỏ qua bóng do chính nó chèn và gỡ");
});

test("bảng dùng chung, bảng Nhiệm vụ và sổ văn bản đều gắn cơ chế", () => {
  assert.match(table, /useListMotion<HTMLTableSectionElement>\(\{ item: isTableRow \}\)/, "TableBody gắn cho cả chín nơi dùng");
  assert.match(tasksTable, /<TableBody>/, "bảng Nhiệm vụ dùng TableBody thay <tbody> trần");
  assert.match(ledger, /useListMotion<HTMLDivElement>\(\{ item: isLedgerRow \}\)/);
  assert.match(ledger, /ref=\{rowsMotionRef\} role="table"/, "ref gắn vào khung bảng đã tải, không gắn vào khung chờ");
});

test("danh sách người dùng thêm/xóa từng mục đều dùng MotionUl/MotionDiv", () => {
  const consumers = [
    "src/components/tasks/detail/task-comments.tsx",
    "src/components/tasks/detail/task-deliverables.tsx",
    "src/components/tasks/detail/task-evidence-section.tsx",
    "src/components/tasks/unit-request-inbox.tsx",
    "src/components/meetings/meeting-recording-panel.tsx",
    "src/components/assistant/assistant-settings-dialog.tsx",
    "src/components/assistant/assistant-composer.tsx",
    "src/components/documents/compose-outgoing-dialog.tsx",
    "src/components/tasks/create/create-task-subtasks.tsx",
    "src/components/inbox/inbox-view.tsx",
    "src/components/workspace/components/active-filter-breadcrumb.tsx",
  ];
  for (const file of consumers) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /from "@\/components\/motion\/motion-list"/, `${file} chưa dùng MotionUl/MotionDiv`);
    assert.match(source, /<Motion(Ul|Div)\b/, `${file} import nhưng không dựng`);
  }
  const notes = readFileSync("src/components/notes/note-masonry.tsx", "utf8");
  assert.match(notes, /useListMotion<HTMLUListElement>\(\{ flip: false \}\)/, "lưới so le tự FLIP nên tắt trượt");
});
