/**
 * Thư chào mừng: ảnh động cài ứng dụng cuối thư đang tạm ẩn; lối vào hộp Cài ứng dụng và dòng hỗ trợ vẫn giữ; không còn nhắc hộp Hướng dẫn sử dụng đã bỏ.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";

const read = (rel: string) => fs.readFileSync(path.join(__dirname, "..", rel), "utf-8");

describe("WelcomeNotification", () => {
  test("tạm ẩn ảnh động cài ứng dụng, vẫn còn mục mở hộp Cài ứng dụng và dòng hỗ trợ, không nhắc Trợ giúp & Hướng dẫn", () => {
    const source = read("src/components/inbox/welcome-notification.tsx");
    assert.match(source, /const INSTALL_DEMO_ENABLED = false;/);
    assert.match(source, /\{INSTALL_DEMO_ENABLED \? <WelcomeInstallDemo \/> : null\}/);
    assert.match(source, /event: "qcet:open-install-modal"/);
    assert.doesNotMatch(source, /qcet:open-help-guide|WelcomeHelpDemo|Trợ giúp &amp; Hướng dẫn/);
    assert.match(source, /href=\{`mailto:\$\{SUPPORT_EMAIL\}`\}/);
  });
});
