import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  getTextOffsetInContainer,
  getCaretFromPoint,
} from "@/components/tasks/detail/direct-inline-editor";
import { formatAssigneeNameWithTitle } from "@/lib/format/personnel";

describe("Direct Inline Editor UX — Exact Caret Placement & IME Suite", () => {
  // Mock DOM Node types
  const TEXT_NODE = 3;
  const ELEMENT_NODE = 1;

  it("calculates exact caret offset at beginning, middle, and end of single-line text", () => {
    const text = "Soạn thảo kế hoạch kiểm định chất lượng giáo dục";
    const textNode = {
      nodeType: TEXT_NODE,
      textContent: text,
      childNodes: [],
    } as unknown as Node;

    const container = {
      nodeType: ELEMENT_NODE,
      childNodes: [textNode],
      contains: (node: Node) => node === textNode,
    } as unknown as Node;

    // 1. Đầu đoạn (Beginning - index 0)
    const startOffset = getTextOffsetInContainer(container, textNode, 0);
    assert.equal(startOffset, 0);

    // 2. Giữa đoạn (Middle - e.g. at "kế hoạch" around index 10)
    const middleIndex = text.indexOf("kế hoạch");
    assert.ok(middleIndex > 0);
    const middleOffset = getTextOffsetInContainer(container, textNode, middleIndex);
    assert.equal(middleOffset, middleIndex);

    // 3. Cuối đoạn (End - index = text.length)
    const endOffset = getTextOffsetInContainer(container, textNode, text.length);
    assert.equal(endOffset, text.length);
  });

  it("calculates exact caret offset in multi-line text with newline breaks and multiple nodes", () => {
    const line1 = "Dòng 1: Triển khai kế hoạch năm học";
    const line2 = "Dòng 2: Phân công giảng viên hướng dẫn đồ án";
    const line3 = "Dòng 3: Hoàn thành báo cáo tổng kết";

    const node1 = { nodeType: TEXT_NODE, textContent: line1, childNodes: [] } as unknown as Node;
    const br1 = { nodeType: ELEMENT_NODE, nodeName: "BR", childNodes: [] } as unknown as Node;
    const node2 = { nodeType: TEXT_NODE, textContent: line2, childNodes: [] } as unknown as Node;
    const br2 = { nodeType: ELEMENT_NODE, nodeName: "BR", childNodes: [] } as unknown as Node;
    const node3 = { nodeType: TEXT_NODE, textContent: line3, childNodes: [] } as unknown as Node;

    const container = {
      nodeType: ELEMENT_NODE,
      childNodes: [node1, br1, node2, br2, node3],
    } as unknown as Node;

    // Đầu dòng 2
    const startLine2 = getTextOffsetInContainer(container, node2, 0);
    assert.equal(startLine2, line1.length + 1); // line1 + 1 (BR)

    // Giữa dòng 2 (tại chữ "giảng viên")
    const gvIndex = line2.indexOf("giảng viên");
    const middleLine2 = getTextOffsetInContainer(container, node2, gvIndex);
    assert.equal(middleLine2, line1.length + 1 + gvIndex);

    // Cuối dòng 3
    const endLine3 = getTextOffsetInContainer(container, node3, line3.length);
    assert.equal(endLine3, line1.length + 1 + line2.length + 1 + line3.length);
  });

  it("supports Vietnamese UTF-8 multi-byte characters without offset corruption", () => {
    // Văn bản tiếng Việt có đầy đủ dấu thanh và nguyên âm đặc thù: ă, â, đ, ê, ô, ơ, ư
    const viText = "Đề tài nghiên cứu khoa học: Ứng dụng Trí tuệ Nhân tạo tại Trường CĐ Kỹ thuật";
    const textNode = { nodeType: TEXT_NODE, textContent: viText, childNodes: [] } as unknown as Node;
    const container = { nodeType: ELEMENT_NODE, childNodes: [textNode] } as unknown as Node;

    const targetWords = ["nghiên cứu", "Ứng dụng", "Trí tuệ", "Trường CĐ"];
    for (const word of targetWords) {
      const idx = viText.indexOf(word);
      assert.ok(idx >= 0, `Word "${word}" must exist in text`);
      const offset = getTextOffsetInContainer(container, textNode, idx);
      assert.equal(offset, idx);
      assert.equal(viText.slice(offset, offset + word.length), word);
    }
  });

  it("handles getCaretFromPoint safely when browser APIs are available or mocked", () => {
    const text = "Nhiệm vụ cấp Trường";
    const textNode = { nodeType: TEXT_NODE, textContent: text, childNodes: [] } as unknown as Node;
    const containerEl = {
      nodeType: ELEMENT_NODE,
      childNodes: [textNode],
      contains: (node: Node) => node === textNode,
    } as unknown as HTMLElement;

    // Test with mock document.caretRangeFromPoint (WebKit/Blink)
    (globalThis as any).document = {
      caretRangeFromPoint: (x: number, y: number) => ({
        startContainer: textNode,
        startOffset: 8,
      }),
    };

    const caretWebKit = getCaretFromPoint(100, 50, containerEl);
    assert.equal(caretWebKit, 8);

    // Test with mock document.caretPositionFromPoint (W3C standard)
    (globalThis as any).document = {
      caretPositionFromPoint: (x: number, y: number) => ({
        offsetNode: textNode,
        offset: 12,
      }),
    };

    const caretW3C = getCaretFromPoint(100, 50, containerEl);
    assert.equal(caretW3C, 12);

    // Cleanup global mock
    delete (globalThis as any).document;
  });

  it("ensures source files adhere to UX rules: no select-none on edit text, IME handling, and autosave", () => {
    const editorSourcePath = path.join(
      process.cwd(),
      "src/components/tasks/detail/direct-inline-editor.tsx"
    );
    const identityBlockPath = path.join(
      process.cwd(),
      "src/components/tasks/detail/task-identity-block.tsx"
    );
    const detailPagePath = path.join(process.cwd(), "src/components/tasks/task-detail-page.tsx");

    const editorContent = fs.readFileSync(editorSourcePath, "utf-8");
    const identityContent = fs.readFileSync(identityBlockPath, "utf-8");
    const detailContent = fs.readFileSync(detailPagePath, "utf-8");

    // 1. Must handle IME composition (compositionstart & compositionend)
    assert.ok(
      editorContent.includes("onCompositionStart") && editorContent.includes("onCompositionEnd"),
      "DirectInlineEditor must handle IME composition events for Vietnamese typing"
    );

    // 2. Must not contain forced selection reset to end (e.g. setSelectionRange(titleDraft.length, titleDraft.length))
    assert.ok(
      !identityContent.includes("titleDraft.length, titleDraft.length"),
      "TaskIdentityBlock must not force caret to end of title string"
    );

    // 3. TaskIdentityBlock must not have select-none on root container
    assert.ok(
      !identityContent.includes('section data-slot="task-identity-block" className={cn("space-y-4 select-none'),
      "TaskIdentityBlock must not have select-none on root section, allowing text selection and double-click"
    );

    // 4. Must support debounced autosave without losing focus
    assert.ok(
      editorContent.includes("scheduleAutosave") && editorContent.includes("autoSaveDebounceMs"),
      "DirectInlineEditor must include debounced autosave capability"
    );

    // 5. Must support click-to-edit with exact caret/selection synchronization
    assert.ok(
      editorContent.includes("pendingSelectionRef") && editorContent.includes("setSelectionRange"),
      "DirectInlineEditor must synchronize exact click caret / selection range"
    );

    // 6. Both TaskIdentityBlock and TaskDetailPage must use DirectInlineEditor
    assert.ok(
      identityContent.includes("DirectInlineEditor"),
      "TaskIdentityBlock must use DirectInlineEditor for task title"
    );
    assert.ok(
      detailContent.includes("DirectInlineEditor"),
      "TaskDetailPage must use DirectInlineEditor for task description"
    );
  });

  it("formatAssigneeNameWithTitle strips parenthesized roles and resolves academic titles from personnel directory", () => {
    // 1. Chuỗi có chức vụ trong ngoặc và đã có học vị -> giữ học vị + họ tên, bỏ chức vụ
    const res1 = formatAssigneeNameWithTitle("ThS. Phạm Văn Tường (Phó Hiệu trưởng)");
    assert.equal(res1, "ThS. Phạm Văn Tường");

    // 2. Chuỗi có chức vụ viết tắt trong ngoặc [PHT] -> giữ học vị + họ tên
    const res2 = formatAssigneeNameWithTitle("ThS. Phạm Văn Tường [PHT]");
    assert.equal(res2, "ThS. Phạm Văn Tường");

    // 3. Chuỗi chưa có học vị nhưng có trong danh bạ QCET -> tra cứu lấy title "ThS. Phạm Văn Tường"
    const res3 = formatAssigneeNameWithTitle("Phạm Văn Tường (Phó Hiệu trưởng)");
    assert.equal(res3, "ThS. Phạm Văn Tường");

    const res4 = formatAssigneeNameWithTitle("Phạm Văn Tường");
    assert.equal(res4, "ThS. Phạm Văn Tường");

    // 4. Các nhân sự lãnh đạo khác trong trường
    const res5 = formatAssigneeNameWithTitle("Đặng Nhật Huy (Hiệu trưởng)");
    assert.equal(res5, "ThS. Đặng Nhật Huy");

    const res6 = formatAssigneeNameWithTitle("Lê Văn Thí (Trưởng phòng QLĐT)");
    assert.equal(res6, "ThS. Lê Văn Thí");

    // 5. Nhân sự có học vị TS.
    const res7 = formatAssigneeNameWithTitle("TS. Trần Minh Quang (Trưởng khoa)");
    assert.equal(res7, "TS. Trần Minh Quang");

    // 6. Trường hợp rỗng hoặc chưa phân công
    assert.equal(formatAssigneeNameWithTitle(""), "Chưa phân công");
    assert.equal(formatAssigneeNameWithTitle(null), "Chưa phân công");
    assert.equal(formatAssigneeNameWithTitle("Chưa phân công"), "Chưa phân công");
  });

  it("TaskIdentityBlock Properties line excludes department pill and more-options dots, while including start date picker", () => {
    const identityBlockPath = path.join(
      process.cwd(),
      "src/components/tasks/detail/task-identity-block.tsx"
    );
    const content = fs.readFileSync(identityBlockPath, "utf-8");

    // Must NOT contain department name pill in Properties line
    assert.ok(
      !content.includes('{/* Team / Department */}'),
      "Properties line must eliminate department pill (Ban Giám hiệu)"
    );

    // Must NOT contain More options dots in Properties line
    assert.ok(
      !content.includes('{/* More options dots */}'),
      "Properties line must eliminate more options dots (...)"
    );

    // Must have start date picker support with 'Chọn ngày bắt đầu' placeholder
    assert.ok(
      content.includes('placeholder="Chọn ngày bắt đầu"'),
      "Properties line must allow picking start date with 'Chọn ngày bắt đầu'"
    );

    // Must have due date picker support with 'Chọn hạn chót' placeholder
    assert.ok(
      content.includes('placeholder="Chọn hạn chót"'),
      "Properties line must allow picking due date with 'Chọn hạn chót'"
    );

    // Must support onStartDateChange
    assert.ok(
      content.includes("onStartDateChange"),
      "TaskIdentityBlock must support onStartDateChange callback"
    );
  });

  it("TaskDetailHeaderNav eliminates trailing '...' dropdown and correctly exposes Space shortcut on inspector toggle", () => {
    const headerPath = path.join(
      process.cwd(),
      "src/components/tasks/detail/task-detail-header-nav.tsx"
    );
    const detailPagePath = path.join(process.cwd(), "src/components/tasks/task-detail-page.tsx");

    const headerContent = fs.readFileSync(headerPath, "utf-8");
    const detailContent = fs.readFileSync(detailPagePath, "utf-8");

    // 1. Elimination of '...' more actions button and its dropdown
    assert.ok(
      !headerContent.includes("MoreHorizontal"),
      "Header must eliminate MoreHorizontal icon"
    );
    assert.ok(
      !headerContent.includes("showMoreMenu"),
      "Header must eliminate showMoreMenu dropdown state"
    );
    assert.ok(
      !headerContent.includes("Làm mới dữ liệu"),
      "Header must eliminate 'Làm mới dữ liệu' menu item"
    );
    assert.ok(
      !headerContent.includes("Chia sẻ nhiệm vụ"),
      "Header must eliminate 'Chia sẻ nhiệm vụ' menu item"
    );
    assert.ok(
      !headerContent.includes("In thông tin"),
      "Header must eliminate 'In thông tin' menu item"
    );

    // 2. Inspector toggle button tooltip and accessibility
    assert.ok(
      headerContent.includes('title="Ẩn/Hiện thuộc tính (Space)"'),
      "Inspector toggle button must have tooltip 'Ẩn/Hiện thuộc tính (Space)'"
    );
    assert.ok(
      headerContent.includes("aria-expanded={showInspector}"),
      "Inspector toggle button must bind aria-expanded accurately"
    );
    assert.match(
      headerContent,
      />\s*Space\s*</,
      "Inspector toggle button must display Space kbd hint"
    );

    // 3. TaskDetailPage Space keyboard shortcut logic
    assert.ok(
      detailContent.includes('e.code === "Space" || e.key === " "'),
      "TaskDetailPage must listen to Space key"
    );
    assert.ok(
      detailContent.includes("if (e.repeat) return;"),
      "TaskDetailPage must ignore key repeat on Space"
    );
    assert.ok(
      detailContent.includes("isEditable(target)"),
      "TaskDetailPage must ignore Space when editing text/inputs"
    );
    assert.ok(
      detailContent.includes("isInteractiveControl(target)"),
      "TaskDetailPage must ignore Space when focus is on another interactive control"
    );
    assert.ok(
      detailContent.includes("isDialogOpen()"),
      "TaskDetailPage must ignore Space when dialog/popover is open"
    );
    assert.ok(
      detailContent.includes("e.preventDefault();\n        handleToggleInspector();"),
      "TaskDetailPage must only call preventDefault when actively handling the Space shortcut"
    );
  });
});
