import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StandardDialog } from "../src/components/ui/dialog";
import { Textarea, CharacterCountTextarea } from "../src/components/ui/textarea";
import { TopBanner } from "../src/components/ui/top-banner";
import { InlineAlert } from "../src/components/ui/inline-alert";
import { CompletionState } from "../src/components/ui/completion-state";
import { InlineExplanation } from "../src/components/ui/inline-explanation";
import { QcetIcon, qcetOutlinePaths } from "../src/components/icons";

describe("Design Components & Foundation Alignment Suite", () => {
  describe("1. StandardDialog Geometry & Modal Positioning (Modal.dc.html)", () => {
    it("positions dialog at top-[10%] instead of vertical center to prevent jump on dynamic content", () => {
      const source = fs.readFileSync(path.resolve(__dirname, "../src/components/ui/dialog.tsx"), "utf-8");

      assert.ok(source.includes("top-[10%]"), "Dialog popup must align top-[10%]");
      assert.ok(source.includes("-translate-x-1/2"), "Dialog popup must center horizontally with -translate-x-1/2");
      assert.ok(source.includes("max-h-[85vh]"), "Dialog popup max height must be 85vh");
      assert.ok(source.includes("bg-black/40"), "Dialog backdrop must use 40% black overlay");
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
      assert.ok(html.includes("rounded-xl"), "Textarea has rounded-xl (12px radius)");
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
  });

  describe("3. TopBanner Announcement (Components4.dc.html)", () => {
    it("renders single-line top banner with status role and dismiss button", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          TopBanner,
          {
            variant: "warning",
            onDismiss: () => {},
          },
          "Hệ thống bảo trì lúc 22:00 hôm nay, khoảng 30 phút."
        )
      );

      assert.ok(html.includes('data-slot="top-banner"'));
      assert.ok(html.includes('role="status"'));
      assert.ok(html.includes("Hệ thống bảo trì lúc 22:00 hôm nay, khoảng 30 phút."));
      assert.ok(html.includes('aria-label="Ẩn thông báo"'));
    });

    it("renders destructive variant with alert role", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          TopBanner,
          { variant: "destructive" },
          "Lỗi mất kết nối máy chủ dữ liệu."
        )
      );

      assert.ok(html.includes('role="alert"'));
      assert.ok(html.includes("bg-danger-soft"));
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

  describe("5. CompletionState Component (Components5.dc.html)", () => {
    it("renders calm institutional completion state without exclamation marks", () => {
      const html = renderToStaticMarkup(
        React.createElement(CompletionState, {
          title: "Đã nộp kết quả",
          description: "Nguyễn Ngọc Vinh sẽ nhận được thông báo. Bạn có thể theo dõi trạng thái tại trang nhiệm vụ.",
          primaryAction: { label: "Về nhiệm vụ", href: "/tasks" },
          secondaryAction: { label: "Xem việc tiếp theo", href: "/tasks/next" },
        })
      );

      assert.ok(html.includes('data-slot="completion-state"'));
      assert.ok(html.includes("Đã nộp kết quả"));
      assert.ok(html.includes("Nguyễn Ngọc Vinh sẽ nhận được thông báo"));
      assert.ok(html.includes("Về nhiệm vụ"));
      assert.ok(html.includes("Xem việc tiếp theo"));
      assert.ok(!html.includes("!"), "Zero exclamation marks in completion state");
    });
  });

  describe("6. InlineExplanation Component (Components4.dc.html)", () => {
    it("renders dotted underline trigger text", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          InlineExplanation,
          { triggerText: "Vì sao trễ?" },
          "Hạn việc con là 31/08, sớm hơn ngày bắt đầu việc cha (27/09)."
        )
      );

      assert.ok(html.includes("border-dotted"), "Trigger must have border-dotted underline");
      assert.ok(html.includes("Vì sao trễ?"), "Trigger text must be displayed");
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
});
