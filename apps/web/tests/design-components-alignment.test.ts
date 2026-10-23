import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StandardDialog } from "../src/components/ui/dialog";
import { Textarea, CharacterCountTextarea } from "../src/components/ui/textarea";
import { InlineAlert } from "../src/components/ui/inline-alert";
import { QcetIcon, qcetOutlinePaths } from "../src/components/icons";

describe("Design Components & Foundation Alignment Suite", () => {
  describe("1. StandardDialog Geometry & Modal Positioning (Modal.dc.html)", () => {
    it("positions dialog at top-[10%] instead of vertical center to prevent jump on dynamic content", () => {
      const source = fs.readFileSync(path.resolve(__dirname, "../src/components/ui/dialog.tsx"), "utf-8");

      assert.ok(source.includes("top-[10%]"), "Dialog popup must align top-[10%]");
      assert.ok(source.includes("-translate-x-1/2"), "Dialog popup must center horizontally with -translate-x-1/2");
      assert.ok(source.includes("max-h-[85dvh]"), "Dialog popup max height must be 85dvh");
      // Nền phủ là token `bg-overlay` (đen 25% như Linear, đo 22/10/2026); trước đây test này khớp chữ "bg-black/40" trong chú thích
      assert.match(source, /BaseDialog\.Backdrop[^>]*className="[^"]*\bbg-overlay\b/, "Dialog backdrop must use the bg-overlay token");
      const css = fs.readFileSync(path.resolve(__dirname, "../src/app/globals.css"), "utf-8");
      assert.match(css, /--overlay:\s*rgba\(0,\s*0,\s*0,\s*0\.25\)/, "Overlay token is 25% black (Linear)");
    });

    it("supports design-specified modal sizes (sm: 400px, md: 560px, lg: 720px)", () => {
      const source = fs.readFileSync(path.resolve(__dirname, "../src/components/ui/dialog.tsx"), "utf-8");

      assert.ok(source.includes("max-w-[400px]"), "Small modal must be 400px");
      assert.ok(source.includes("max-w-[560px]"), "Medium modal must be 560px");
      assert.ok(source.includes("max-w-[720px]"), "Large modal must be 720px");
    });
  });

  describe("2. Textarea & Character Count (Components5.dc.html)", () => {
    it("renders textarea with autoResize and counter when maxLength is provided", () => {
      const html = renderToStaticMarkup(
        React.createElement(CharacterCountTextarea, {
          defaultValue: "Nội dung giải trình",
          maxCharacters: 500,
          showCount: true,
        })
      );

      assert.ok(html.includes('data-slot="textarea"'), "Renders textarea element");
      assert.ok(html.includes("19 / 500"), "Displays character counter formatted as current / max");
      assert.ok(html.includes("rounded-control") || html.includes("rounded-xl"), "Textarea has rounded-control / 12px radius");
    });

    it("highlights counter in red when remaining characters is <= 20", () => {
      const text485 = "a".repeat(485); // 15 characters remaining out of 500
      const html = renderToStaticMarkup(
        React.createElement(Textarea, {
          value: text485,
          maxCharacters: 500,
          showCount: true,
        })
      );

      assert.ok(html.includes("text-destructive"), "Warning color text-destructive must be applied when < 20 chars");
      assert.ok(html.includes("Còn 15 ký tự nữa là hết chỗ"), "Displays warning message for remaining characters");
    });

    it("giữ cùng cấu trúc cây khi bộ đếm ẩn (countOnlyNearLimit) hay hiện, nên ô đang gõ không bị remount", () => {
      const render = (value: string) =>
        renderToStaticMarkup(React.createElement(Textarea, { value, maxLength: 100, countOnlyNearLimit: true, onChange: () => {} }));
      const far = render("a".repeat(50));
      const near = render("a".repeat(90));
      for (const html of [far, near]) {
        assert.ok(html.startsWith("<div"), "gốc luôn là lớp bọc");
        assert.ok(html.includes("<textarea"), "ô luôn nằm trong lớp bọc");
      }
      assert.equal(far.includes("Còn "), false, "chưa gần giới hạn thì không có dòng đếm");
      assert.ok(near.includes("Còn 10 ký tự nữa là hết chỗ"), "gần giới hạn thì hiện dòng đếm");
      // Lớp bọc giống hệt ở hai trạng thái: không `contents` (làm mất margin space-y-* của thẻ cha), không nhảy bố cục
      assert.equal(far.match(/<div[^>]*>/)?.[0], near.match(/<div[^>]*>/)?.[0]);
      assert.equal(far.includes('class="contents"'), false);
    });
  });

  describe("4. InlineAlert Component (Components2.dc.html)", () => {
    it("renders text with icon and optional action button without card borders", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          InlineAlert,
          {
            variant: "error",
            actionLabel: "Thử lại",
            onAction: () => {},
          },
          "Không thể tải danh sách tài liệu. Dữ liệu chưa bị ảnh hưởng."
        )
      );

      assert.ok(html.includes('data-slot="inline-alert"'));
      assert.ok(html.includes('role="alert"'));
      assert.ok(html.includes("Không thể tải danh sách tài liệu."));
      assert.ok(html.includes("Thử lại"), "Action button label must be rendered");
    });
  });

  describe("7. QCET Outline Icon Suite Integration", () => {
    it("renders valid SVG for canonical QCET navigation icons", () => {
      const canonicalIcons = [
        "dashboard",
        "inbox",
        "tasks",
        "calendar",
        "documents",
        "organization",
        "settings",
        "notification",
      ] as const;

      for (const iconName of canonicalIcons) {
        assert.ok(iconName in qcetOutlinePaths, `Icon '${iconName}' must exist in qcetOutlinePaths`);

        const html = renderToStaticMarkup(
          React.createElement(QcetIcon, { name: iconName, size: 20 })
        );
        assert.ok(html.includes("<svg"), `QcetIcon '${iconName}' must render an svg`);
        assert.ok(html.includes('viewBox="0 0 24 24"'), `QcetIcon '${iconName}' must have 24px grid viewBox`);
      }
    });
  });

  describe("8. PrioritySignalBars Component (qcet-nhiem-vu.html)", () => {
    it("renders 3 bars with appropriate active count for priority levels", () => {
      const { PrioritySignalBars } = require("../src/components/tasks/priority-signal-bars");

      const htmlLow = renderToStaticMarkup(React.createElement(PrioritySignalBars, { priority: "LOW" }));
      assert.ok(htmlLow.includes("Độ ưu tiên: Thấp"));

      const htmlNormal = renderToStaticMarkup(React.createElement(PrioritySignalBars, { priority: "NORMAL" }));
      assert.ok(htmlNormal.includes("Độ ưu tiên: Bình thường"));

      const htmlHigh = renderToStaticMarkup(React.createElement(PrioritySignalBars, { priority: "HIGH" }));
      assert.ok(htmlHigh.includes("Độ ưu tiên: Cao"));

      const htmlUrgent = renderToStaticMarkup(React.createElement(PrioritySignalBars, { priority: "URGENT" }));
      assert.ok(htmlUrgent.includes("Độ ưu tiên: Khẩn cấp"));
      assert.ok(htmlUrgent.includes("text-destructive"), "Urgent priority must use the destructive (red) token");
    });
  });

  describe("9. TaskStatusCircle Component (qcet-nhiem-vu.html)", () => {
    it("renders distinct geometric status circles without color reliance", () => {
      const { TaskStatusCircle } = require("../src/components/tasks/task-status-circle");

      const htmlNew = renderToStaticMarkup(React.createElement(TaskStatusCircle, { status: "NEW" }));
      assert.ok(htmlNew.includes("stroke-dasharray"), "New/Not started must have dashed circle");

      const htmlDoing = renderToStaticMarkup(React.createElement(TaskStatusCircle, { status: "IN_PROGRESS" }));
      assert.ok(htmlDoing.includes("M7 3.5A3.5 3.5 0 0 1 7 10.5Z"), "Doing/In progress must have the inner half-circle");

      const htmlReview = renderToStaticMarkup(React.createElement(TaskStatusCircle, { status: "WAITING_APPROVAL" }));
      assert.ok(htmlReview.includes("M7 7V3.5A3.5 3.5 0 1 1 3.5 7Z"), "Waiting approval must have the three-quarter fill");

      const htmlDone = renderToStaticMarkup(React.createElement(TaskStatusCircle, { status: "COMPLETED" }));
      assert.ok(htmlDone.includes('fill-rule="evenodd"') && htmlDone.includes("L6.2 9.3Z"), "Done must be a solid disc with a cut-out checkmark");
    });
  });

  describe("10. UserAvatar placeholder khi chưa có ảnh", () => {
    it("hiện hình người xám (avatar khung trống) thay cho chữ viết tắt, vẫn giữ tên cho trình đọc màn hình", () => {
      const { UserAvatar } = require("../src/components/ui/user-avatar");

      const htmlAvatar = renderToStaticMarkup(React.createElement(UserAvatar, { name: "Đặng Nhật Huy" }));
      assert.ok(htmlAvatar.includes('data-slot="avatar-placeholder"'), "Fallback is the silhouette placeholder");
      assert.ok(htmlAvatar.includes("bg-muted"), "Placeholder uses the neutral muted surface");
      assert.ok(!htmlAvatar.includes("ĐH"), "Fallback no longer shows initials");
      assert.ok(htmlAvatar.includes('aria-label="Đặng Nhật Huy"') && htmlAvatar.includes('title="Đặng Nhật Huy"'), "Name stays accessible");
    });
  });
});
