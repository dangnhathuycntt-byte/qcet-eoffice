/**
 * Mọi sự kiện outbox của văn bản và hồ sơ được phát ra phải có handler thật, hoặc nằm ở `SILENT_OUTBOX_EVENTS` kèm lý do
 * (được đăng ký thành handler chỉ xác nhận).
 * `processOutboxBatch` bỏ qua sự kiện không có handler và để nó PENDING mãi (rà soát 23/10/2026: 147 sự kiện văn bản
 * kẹt trên DB dev), nên thêm một sự kiện mới mà quên handler sẽ làm test này đỏ.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { OUTBOX_HANDLERS, SILENT_OUTBOX_EVENTS } from "../src/server/outbox/outbox-worker";
import { TASK_NOTIFICATION_HANDLERS } from "../src/server/outbox/task-notification-handlers";
import { DOCUMENT_NOTIFICATION_HANDLERS } from "../src/server/outbox/document-notification-handlers";
import { OUTGOING_NOTIFICATION_HANDLERS } from "../src/server/outbox/outgoing-notification-handlers";
import { DOSSIER_NOTIFICATION_HANDLERS } from "../src/server/outbox/dossier-notification-handlers";

const REAL_HANDLERS = {
  ...TASK_NOTIFICATION_HANDLERS,
  ...DOCUMENT_NOTIFICATION_HANDLERS,
  ...OUTGOING_NOTIFICATION_HANDLERS,
  ...DOSSIER_NOTIFICATION_HANDLERS,
};

const SRC = path.resolve(__dirname, "../src");
const PREFIX = "(?:DOCUMENT|DOSSIER)_[A-Z_]+";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(name) ? [full] : [];
  });
}

/** Loại sự kiện văn bản/hồ sơ mà mã nguồn phát ra: `eventType: "X"`, `eventType: OutboxEventType.X` hoặc hằng được chọn ngoài thư mục outbox. */
function publishedEventTypes(): Set<string> {
  const found = new Set<string>();
  const literal = new RegExp(`eventType:\\s*['"](${PREFIX})['"]`, "g");
  const constant = new RegExp(`OutboxEventType\\.(${PREFIX})`, "g");
  for (const file of sourceFiles(SRC)) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(literal)) found.add(m[1]);
    // Thư mục outbox chỉ đăng ký handler (khóa bảng handler), không phát sự kiện.
    if (file.includes(`${path.sep}server${path.sep}outbox${path.sep}`)) continue;
    for (const m of text.matchAll(constant)) found.add(m[1]);
  }
  return found;
}

describe("Outbox: sự kiện văn bản và hồ sơ", () => {
  const published = publishedEventTypes();

  it("bộ quét thấy các sự kiện đã biết (tránh test xanh vì regex không khớp gì)", () => {
    for (const known of [
      "DOCUMENT_CONTENT_REVIEW_REQUESTED",
      "DOCUMENT_ISSUED_NOTIFICATION",
      "DOCUMENT_OVERDUE_NOTIFICATION",
      "DOSSIER_DISPOSAL_PROPOSED_NOTIFICATION",
    ]) {
      assert.ok(published.has(known), `bộ quét không thấy ${known}`);
    }
  });

  it("mỗi sự kiện được phát ra có handler hoặc được ghi là cố ý im lặng", () => {
    const orphaned = [...published].filter((type) => !(type in REAL_HANDLERS) && !(type in SILENT_OUTBOX_EVENTS));
    assert.deepEqual(orphaned, [], `Sự kiện không ai xử lý, nằm PENDING mãi: ${orphaned.join(", ")}`);
  });

  it("danh sách im lặng không có mục thừa: đã có handler, không còn được phát hoặc thiếu lý do", () => {
    for (const [type, reason] of Object.entries(SILENT_OUTBOX_EVENTS)) {
      assert.ok(!(type in REAL_HANDLERS), `${type} đã có handler thật, bỏ khỏi SILENT_OUTBOX_EVENTS`);
      assert.ok(published.has(type), `${type} không còn được phát ra, bỏ khỏi SILENT_OUTBOX_EVENTS`);
      assert.ok(reason.trim().length > 0, `${type} thiếu lý do`);
    }
  });

  it("worker đăng ký handler cho mọi sự kiện đã phát (kể cả sự kiện im lặng, để chúng không kẹt PENDING)", () => {
    const unregistered = [...published].filter((type) => !(type in OUTBOX_HANDLERS));
    assert.deepEqual(unregistered, []);
  });
});
