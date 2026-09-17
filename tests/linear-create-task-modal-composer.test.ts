/**
 * tests/linear-create-task-modal-composer.test.ts
 *
 * Kiểm thử toàn diện Linear-inspired Compact Task Composer & Modal UX/UI Redesign (v2):
 * 1. Modal layout hierarchy: Breadcrumb -> Title -> Summary -> Property Chips -> Description -> Subtasks -> Footer
 * 2. Visual density & restraint: No redundant sections, compact properties bar (wrap max 2 rows)
 * 3. Progressive disclosure: Subtasks section only displays "+ Thêm đầu việc" when empty
 * 4. Header action: "Tạo cùng Agent" auxiliary action in top right
 * 5. Footer contract: Sticky footer with Cancel + "Tạo nhiệm vụ" action & shortcut hint
 * 6. Shortcut contract: 'C' key opens create modal when not typing in interactive input
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LinearCreateTaskModal } from "../src/components/tasks/create/linear-create-task-modal";
import { isInteractiveInput, shouldIgnoreShortcut } from "../src/lib/shortcuts/guards";
import { createTaskSequenceListener } from "../src/lib/shortcuts/task-shortcuts";

describe("Linear Compact Composer Modal - Layout & Structure", () => {
  test("Renders modal with correct Linear hierarchy & accessible dialog attributes", () => {
    const html = renderToStaticMarkup(
      React.createElement(LinearCreateTaskModal, {
        isOpen: true,
        onClose: () => {},
        initialDepartmentCode: "P_QLDT",
        initialTitle: "Hoàn thiện hệ thống khảo thí trực tuyến",
      })
    );

    // 1. Accessibility & Role
    assert.ok(html.includes('role="dialog"'), "Modal must have role='dialog'");
    assert.ok(html.includes('aria-modal="true"'), "Modal must have aria-modal='true'");
    assert.ok(html.includes('id="create-task-modal-title"'), "Must have accessible modal title");

    // 2. Header & Breadcrumb
    assert.ok(html.includes("Phòng Quản lý Đào tạo"), "Must show current department name in breadcrumb");
    assert.ok(html.includes("Tạo nhiệm vụ"), "Must show 'Tạo nhiệm vụ' in breadcrumb");
    assert.ok(html.includes("Tạo cùng Agent"), "Must have 'Tạo cùng Agent' action in header");

    // 3. Title & Summary Inputs
    assert.ok(html.includes('placeholder="Tên nhiệm vụ... *"'), "Must have prominent title input with required placeholder");
    assert.ok(html.includes('placeholder="Thêm mô tả ngắn hoặc kết quả kỳ vọng..."'), "Must have short summary input directly beneath title");

    // 4. Compact Property Chips (Status, Priority, DRI, Collaborators, StartDate, DueDate, Category)
    assert.ok(html.includes("Đang thực hiện") || html.includes("Mới"), "Must render Status property chip");
    assert.ok(html.includes("Bình thường") || html.includes("Khẩn cấp") || html.includes("Cao"), "Must render Priority property chip");
    assert.ok(html.includes("Chủ trì"), "Must render DRI (Chủ trì) property chip");
    assert.ok(html.includes("+ Phối hợp") || html.includes("Phối hợp"), "Must render Collaborators property chip");
    assert.ok(html.includes("Bắt đầu:"), "Must render Start date property chip");
    assert.ok(html.includes("Hạn:"), "Must render Due date property chip");
    assert.ok(html.includes("Chuyển đổi số") || html.includes("Lĩnh vực"), "Must render Category property chip");

    // 5. Description Canvas
    assert.ok(
      html.includes('placeholder="Mô tả nội dung chỉ đạo, căn cứ pháp lý, yêu cầu kỹ thuật hoặc tiêu chí nghiệm thu..."'),
      "Must render borderless description textarea canvas"
    );

    // 6. Progressive Subtasks: when empty, only "+ Thêm đầu việc" button is shown
    assert.ok(html.includes("Thêm đầu việc"), "Must render lightweight 'Thêm đầu việc' affordance");

    // 7. Footer: Sticky bottom with Cancel + Submit and shortcut hint
    assert.ok(html.includes("Hủy"), "Must render Cancel button");
    assert.ok(html.includes("Tạo nhiệm vụ"), "Must render primary submit button labeled 'Tạo nhiệm vụ'");
    assert.ok(html.includes("Enter"), "Must render shortcut hint in footer");
  });

  test("When closed (isOpen=false), modal renders nothing (null)", () => {
    const html = renderToStaticMarkup(
      React.createElement(LinearCreateTaskModal, {
        isOpen: false,
        onClose: () => {},
      })
    );

    assert.equal(html, "", "Closed modal must render empty output");
  });
});

describe("Keyboard Shortcuts & Input Isolation", () => {
  test("Single key 'c' triggers task creation when focus is not inside input", () => {
    let triggered = false;
    const listener = createTaskSequenceListener({
      enabled: true,
      onCreateTask: () => {
        triggered = true;
      },
    });

    const mockEvent = {
      key: "c",
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      preventDefault: () => {},
      target: { tagName: "BODY", getAttribute: () => null } as unknown as HTMLElement,
    } as unknown as KeyboardEvent;

    listener.handleKeyDown(mockEvent);
    assert.equal(triggered, true, "Pressing 'c' outside inputs must trigger onCreateTask");
  });

  test("Single key 'c' is safely ignored when typing inside input or textarea", () => {
    let triggered = false;
    const listener = createTaskSequenceListener({
      enabled: true,
      onCreateTask: () => {
        triggered = true;
      },
    });

    const mockInputEvent = {
      key: "c",
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      preventDefault: () => {},
      target: { tagName: "INPUT", getAttribute: () => null } as unknown as HTMLElement,
    } as unknown as KeyboardEvent;

    listener.handleKeyDown(mockInputEvent);
    assert.equal(triggered, false, "Pressing 'c' inside <input> must not trigger modal");

    const mockTextareaEvent = {
      key: "c",
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      preventDefault: () => {},
      target: { tagName: "TEXTAREA", getAttribute: () => null } as unknown as HTMLElement,
    } as unknown as KeyboardEvent;

    listener.handleKeyDown(mockTextareaEvent);
    assert.equal(triggered, false, "Pressing 'c' inside <textarea> must not trigger modal");
  });

  test("isInteractiveInput correctly identifies editable and textbox roles", () => {
    const regularDiv = { tagName: "DIV", getAttribute: () => null } as unknown as HTMLElement;
    assert.equal(isInteractiveInput(regularDiv), false);

    const editableDiv = {
      tagName: "DIV",
      isContentEditable: true,
      getAttribute: () => null,
    } as unknown as HTMLElement;
    assert.equal(isInteractiveInput(editableDiv), true);

    const roleTextbox = {
      tagName: "DIV",
      getAttribute: (attr: string) => (attr === "role" ? "textbox" : null),
    } as unknown as HTMLElement;
    assert.equal(isInteractiveInput(roleTextbox), true);
  });
});
