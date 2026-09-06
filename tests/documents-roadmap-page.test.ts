import * as React from "react";
import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import DocumentsPage, { metadata } from "@/app/documents/page";

describe("Documents Roadmap Placeholder Page Test Suite", () => {
  const pagePath = path.join(process.cwd(), "src/app/documents/page.tsx");

  test("src/app/documents/page.tsx exists on disk", () => {
    assert.ok(fs.existsSync(pagePath), "src/app/documents/page.tsx must exist");
  });

  test("Metadata title and description match QCET specification", () => {
    assert.ok(metadata, "Metadata must be exported from page");
    assert.strictEqual(
      metadata.title,
      "Văn bản & Công văn - QCET E-Office",
      "Page title must be 'Văn bản & Công văn - QCET E-Office'"
    );
    assert.ok(
      typeof metadata.description === "string" && metadata.description.length > 0,
      "Page description must be non-empty"
    );
  });

  test("DocumentsPage component is a valid callable function", () => {
    assert.strictEqual(typeof DocumentsPage, "function");
    const element = DocumentsPage();
    assert.ok(element, "DocumentsPage must return JSX element");
  });

  describe("File Content & Anti-Slop Audit", () => {
    const fileContent = fs.readFileSync(pagePath, "utf-8");

    test("Contains zero decorative emojis (100% Lucide icons)", () => {
      const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
      assert.strictEqual(
        emojiRegex.test(fileContent),
        false,
        "Page must not contain any decorative emojis"
      );
    });

    test("Header contains breadcrumb linking to Trang chủ and showing Văn bản & Công văn", () => {
      assert.ok(
        fileContent.includes('href="/"'),
        "Must contain Link to '/'"
      );
      assert.ok(
        fileContent.includes("Trang chủ"),
        "Must contain 'Trang chủ' text"
      );
      assert.ok(
        fileContent.includes("Văn bản &amp; Công văn") || fileContent.includes("Văn bản & Công văn"),
        "Must contain 'Văn bản & Công văn' text"
      );
    });

    test("Header displays title and in-development badge", () => {
      assert.ok(
        fileContent.includes("Phân hệ Văn bản &amp; Quản lý Công văn") ||
          fileContent.includes("Phân hệ Văn bản & Quản lý Công văn"),
        "Must display 'Phân hệ Văn bản & Quản lý Công văn'"
      );
      assert.ok(
        fileContent.includes("Đang phát triển - Lộ trình Năm học 2025-2026"),
        "Must display in-development badge 'Đang phát triển - Lộ trình Năm học 2025-2026'"
      );
    });

    test("Central feature card contains heading and descriptive text", () => {
      assert.ok(
        fileContent.includes("Tính năng đang trong lộ trình phát triển"),
        "Must have heading 'Tính năng đang trong lộ trình phát triển'"
      );
      assert.ok(
        fileContent.includes("Hệ thống đang tập trung nguồn lực tối ưu hóa phân hệ Quản lý công việc &amp; Bàn làm việc số") ||
          fileContent.includes("Hệ thống đang tập trung nguồn lực tối ưu hóa phân hệ Quản lý công việc & Bàn làm việc số"),
        "Must contain description regarding task management prioritization"
      );
      assert.ok(
        fileContent.includes("Phân hệ Quản lý Công văn, Tờ trình và Ký số điện tử đang được hoàn thiện kỹ thuật và sẽ sớm ra mắt"),
        "Must contain description regarding documents module roadmap"
      );
    });

    test("Includes 3 planned feature preview cards with exact requirements", () => {
      // 1. Sổ công văn điện tử
      assert.ok(
        fileContent.includes("Sổ công văn điện tử"),
        "Must include 'Sổ công văn điện tử'"
      );
      assert.ok(
        fileContent.includes("Tiếp nhận, số hóa và lưu trữ công văn đến/đi từ các cơ quan cấp trên"),
        "Must include description for 'Sổ công văn điện tử'"
      );

      // 2. Tờ trình & Bút phê số
      assert.ok(
        fileContent.includes("Tờ trình &amp; Bút phê số") || fileContent.includes("Tờ trình & Bút phê số"),
        "Must include 'Tờ trình & Bút phê số'"
      );
      assert.ok(
        fileContent.includes("Trình duyệt tờ trình điện tử liên phòng khoa, hỗ trợ ký số lãnh đạo"),
        "Must include description for 'Tờ trình & Bút phê số'"
      );

      // 3. Tự động giao việc từ công văn
      assert.ok(
        fileContent.includes("Tự động giao việc từ công văn"),
        "Must include 'Tự động giao việc từ công văn'"
      );
      assert.ok(
        fileContent.includes("Liên thông trực tiếp văn bản vào Kho nhiệm vụ của từng đơn vị"),
        "Must include description for 'Tự động giao việc từ công văn'"
      );
    });

    test("Action buttons link to '/' and '/tasks' with proper icons and labels", () => {
      // Primary button
      assert.ok(
        fileContent.includes("Quay về Bàn làm việc"),
        "Must have button 'Quay về Bàn làm việc'"
      );
      assert.ok(
        fileContent.includes("ArrowLeft"),
        "Primary button must use ArrowLeft icon"
      );

      // Secondary button
      assert.ok(
        fileContent.includes("/tasks"),
        "Must link to '/tasks'"
      );
      assert.ok(
        fileContent.includes("Xem Kho 304 nhiệm vụ"),
        "Must have button 'Xem Kho 304 nhiệm vụ'"
      );
      assert.ok(
        fileContent.includes("CheckSquare"),
        "Secondary button must use CheckSquare icon"
      );
    });
  });
});
