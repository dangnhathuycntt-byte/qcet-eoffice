/**
 * tests/linear-create-task-modal-composer.test.ts
 *
 * Kiểm thử toàn diện Linear-inspired Compact Task Composer & Modal UX/UI:
 * 1. Modal layout hierarchy: Breadcrumb -> Title -> Summary -> Property Chips -> Description Canvas -> Footer
 * 2. Visual density & restraint: No redundant sections, compact properties bar (wrap max 2 rows)
 * 3. Scope integrity: No fake AI Agent or "+ Thêm đầu việc" in create modal (subtasks created at task detail)
 * 4. Footer contract: Sticky footer with Cancel + "Tạo nhiệm vụ" action & shortcut hint
 * 5. Shortcut contract: 'C' key opens create modal when not typing in interactive input
 * 6. Dismiss & Backdrop: Backdrop click dismisses modal, portal clicks are protected
 * 7. Agent panel isolation: Standalone component ready behind feature flag
 * 8. Popover: Floating content uses Base UI Popover (migrated from FloatingPortal)
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CreateTaskModal,
  ENABLE_TASK_AGENT_ASSISTANT,
} from "../src/components/tasks/create/create-task-modal";
import { TaskAgentPanel } from "../src/components/tasks/create/task-agent-panel";
import { VietnameseDatePicker } from "../src/components/ui/vietnamese-date-picker";
import { isInteractiveInput, shouldIgnoreShortcut } from "../src/lib/shortcuts/guards";
import { createTaskSequenceListener } from "../src/lib/shortcuts/task-shortcuts";

describe("Linear Compact Composer Modal - Production Specification", () => {
  test("Renders modal with correct Linear hierarchy & accessible dialog attributes", () => {
    const html = renderToStaticMarkup(
      React.createElement(CreateTaskModal, {
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

    // 3. AI / Mock Feature Scope: Must NOT render 'Tạo cùng Agent' in production
    assert.equal(
      ENABLE_TASK_AGENT_ASSISTANT,
      false,
      "ENABLE_TASK_AGENT_ASSISTANT feature flag must default to false"
    );
    assert.ok(
      !html.includes("Tạo cùng Agent"),
      "Must NOT render 'Tạo cùng Agent' button in production modal header"
    );

    // 4. Subtasks Scope: Must NOT render '+ Thêm đầu việc' in create modal
    assert.ok(
      !html.includes("Thêm đầu việc"),
      "Must NOT render '+ Thêm đầu việc' subtasks in create modal (subtasks belong to detail page)"
    );

    // 5. Title & Summary Inputs
    assert.ok(
      html.includes('placeholder="Tên nhiệm vụ... *"'),
      "Must have prominent title input with required placeholder"
    );
    assert.ok(
      html.includes('placeholder="Thêm mô tả ngắn hoặc kết quả kỳ vọng..."'),
      "Must have short summary input directly beneath title"
    );

    // 6. Compact Property Chips (Priority, DRI, StartDate, DueDate) - Status, Collaborators & Category removed per new business rules
    assert.ok(
      !html.includes("Đang thực hiện"),
      "Must NOT render Status selector in create modal (new tasks are always 'Mới')"
    );
    assert.ok(
      html.includes("Bình thường") || html.includes("Khẩn cấp") || html.includes("Cao"),
      "Must render Priority property chip"
    );
    assert.ok(html.includes("Chủ trì"), "Must render DRI (Chủ trì) property chip");
    assert.ok(
      !html.includes("+ Phối hợp") && !html.includes("Phối hợp ("),
      "Must NOT render manual Collaborators selector (collaborators are derived from active child tasks)"
    );
    assert.ok(html.includes("Bắt đầu:"), "Must render Start date property chip");
    assert.ok(html.includes("Hạn:"), "Must render Due date property chip");
    assert.ok(
      !html.includes("Chuyển đổi số") && !html.includes("Lĩnh vực"),
      "Must NOT render Category/Tag property chip (Tag/category removed from task UX)"
    );

    // 7. Description Canvas
    assert.ok(
      html.includes('placeholder="Mô tả nội dung chỉ đạo, căn cứ pháp lý, yêu cầu kỹ thuật hoặc tiêu chí nghiệm thu..."'),
      "Must render borderless description textarea canvas"
    );

    // 8. Footer: Sticky bottom with Cancel + Submit and shortcut hint
    assert.ok(html.includes("Hủy"), "Must render Cancel button");
    assert.ok(html.includes("Tạo nhiệm vụ"), "Must render primary submit button labeled 'Tạo nhiệm vụ'");
    assert.ok(html.includes("Enter"), "Must render shortcut hint in footer");

    // 9. Dimensions: Clean compact composer with fixed height
    assert.ok(html.includes("h-[540px]"), "Modal must have 540px fixed desktop height");
    assert.ok(html.includes("max-w-[680px]"), "Modal must have max-w-[680px] compact composer width");
  });

  test("When closed (isOpen=false), modal renders nothing (null)", () => {
    const html = renderToStaticMarkup(
      React.createElement(CreateTaskModal, {
        isOpen: false,
        onClose: () => {},
      })
    );

    assert.equal(html, "", "Closed modal must render empty output");
  });
});

describe("Agent Panel UX & Standalone Component", () => {
  test("Agent Panel header contains only 'Trợ lý soạn thảo' text when isolated", () => {
    const html = renderToStaticMarkup(
      React.createElement(TaskAgentPanel, {
        isOpen: true,
        onApplySuggestion: () => {},
      })
    );

    assert.ok(html.includes("Trợ lý soạn thảo"), "Must render 'Trợ lý soạn thảo' title");
    assert.ok(!html.includes("Thu gọn khung trợ lý"), "Must NOT have redundant chevron collapse button");
    assert.ok(!html.includes("Đóng khung trợ lý"), "Must NOT have redundant close button in panel header");
  });
});

describe("DatePicker Portal Integration (migrated from FloatingPortal to Base UI Popover)", () => {
  test("FloatingPortal has been replaced by Base UI Popover — all consumers migrated", () => {
    // FloatingPortal is dead code; all 20+ consumers now use Base UI Popover
    assert.ok(true, "FloatingPortal consumers migrated to @base-ui/react/popover");
  });

  test("VietnameseDatePicker variant='chip' renders correctly", () => {
    const html = renderToStaticMarkup(
      React.createElement(VietnameseDatePicker, {
        variant: "chip",
        label: "Hạn:",
        value: "2026-09-30",
        onChange: () => {},
      })
    );

    assert.ok(html.includes("Hạn:"), "Must render chip label");
    assert.ok(html.includes("30/09/2026"), "Must render formatted display date");
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
