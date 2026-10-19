/**
 * Lối vào "Hỏi Trợ lý" từ menu nhiệm vụ và menu Thao tác khác của văn bản (W3-CTX): hợp đồng mã nguồn.
 * Hàng chỉ hiện khi cờ `assistant` bật; đường dẫn đúng dạng `/assistant?context=<loại>:<id>` mà trang Trợ lý đọc.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import {
  ASSISTANT_ASK_EVENT,
  askAssistantInDock,
  parseAssistantContextParam,
  type AssistantAskEventDetail,
} from "../src/components/assistant/assistant-model";
import { isAssistantEligibleDocument } from "@qcet/shared/domain/assistant/assistant-document-eligibility";

const ROOT = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

describe("Hỏi Trợ lý từ nhiệm vụ", () => {
  const src = read("src/components/tasks/table/task-context-menu.tsx");

  test("hàng nằm trong nhóm thao tác, sau Xem chi tiết và trước Xóa nhiệm vụ", () => {
    const view = src.indexOf('label="Xem chi tiết"');
    const ask = src.indexOf('label="Hỏi Trợ lý"');
    const remove = src.indexOf('label="Xóa nhiệm vụ"');
    assert.ok(view > 0 && ask > view && remove > ask);
  });

  test("chỉ hiện khi cờ assistant bật, đọc qua hook dùng chung và chỉ tải khi menu mở", () => {
    assert.ok(src.includes('import { useRuntimeFeature } from "@/lib/runtime-features"'));
    assert.ok(src.includes('const assistantOn = useRuntimeFeature("assistant", isOpen)'));
    assert.ok(/\{assistantOn \? \([\s\S]*?label="Hỏi Trợ lý"[\s\S]*?\) : null\}/.test(src));
  });

  test("bấm đóng menu rồi mở /assistant với ngữ cảnh task:<id>", () => {
    assert.ok(
      src.includes(
        "const handleAskAssistant = () => {\n    onClose();\n    router?.push(`/assistant?context=task:${encodeURIComponent(task.id)}`);\n  };",
      ),
    );
  });

  test("hàng dùng AgentIcon cùng cỡ icon các hàng khác", () => {
    assert.ok(src.includes('import { AgentIcon } from "@/components/icons/agent-icon"'));
    assert.ok(src.includes('<AgentIcon className="size-4 text-muted-foreground" />'));
  });
});

describe("Hỏi Trợ lý từ nhiệm vụ mở khung nổi tại chỗ (19/10/2026)", () => {
  test("khung nổi nhận thì không chuyển trang; không có khung (điện thoại) thì trả false để mở trang Trợ lý", () => {
    const target = new EventTarget();
    const g = globalThis as { window?: unknown };
    g.window = target;
    try {
      assert.equal(askAssistantInDock({ type: "task", id: "t-1" }), false);
      const asked: unknown[] = [];
      target.addEventListener(ASSISTANT_ASK_EVENT, (event) => {
        const detail = (event as CustomEvent<AssistantAskEventDetail>).detail;
        asked.push(detail.context);
        detail.handled = true;
      });
      assert.equal(askAssistantInDock({ type: "task", id: "t-1" }), true);
      assert.deepEqual(asked, [{ type: "task", id: "t-1" }]);
    } finally {
      delete g.window;
    }
  });

  test("menu nhiệm vụ hỏi qua khung nổi, khung mở cuộc mới với nhiệm vụ làm ngữ cảnh và chip ở ô soạn", () => {
    const menu = read("src/components/tasks/table/task-context-menu.tsx");
    assert.ok(menu.includes('if (!askAssistantInDock({ type: "task", id: task.id })) return handleAskAssistant();'));
    assert.ok(menu.includes('label="Hỏi Trợ lý" onClick={askInDock} />'));
    const dock = read("src/components/assistant/assistant-dock.tsx");
    assert.ok(dock.includes("window.addEventListener(ASSISTANT_ASK_EVENT, onAsk)"));
    assert.ok(dock.includes('if (hidden || !window.matchMedia("(min-width: 768px)").matches) return;'), "điện thoại và trang Trợ lý không nhận");
    assert.ok(dock.includes("chat.setPendingContext(detail.context);"));
    assert.ok(read("src/components/assistant/assistant-dock-panel.tsx").includes("context={composerContext}"));
  });
});

describe("Hỏi Trợ lý từ văn bản", () => {
  const src = read("src/components/documents/workspace/document-quick-view.tsx");

  test("MoreActionsMenu nhận đường dẫn và hiện hàng Hỏi Trợ lý bằng Link", () => {
    assert.ok(src.includes("askAssistantHref?: string"));
    assert.ok(
      src.includes(
        '<MenuActionItem leading={<AgentIcon className="size-4" />} render={<Link href={askAssistantHref} />}>',
      ),
    );
  });

  test("hàng nằm đầu menu, trước Sửa thông tin và In phiếu văn bản", () => {
    const ask = src.indexOf("Hỏi Trợ lý");
    const edit = src.indexOf("Sửa thông tin");
    const print = src.indexOf("In phiếu văn bản");
    assert.ok(ask > 0 && ask < edit && ask < print);
  });

  test("chỉ truyền đường dẫn khi cờ assistant bật và văn bản đủ điều kiện Trợ lý, dạng /assistant?context=document:<id>", () => {
    assert.ok(src.includes('import { useRuntimeFeature } from "@/lib/runtime-features"'));
    assert.ok(src.includes('const assistantOn = useRuntimeFeature("assistant")'));
    // Trợ lý không đọc văn bản mật (D1) hay văn bản Thường có ghi chú hạn chế: không mở lối vào dẫn tới câu từ chối
    assert.ok(src.includes('import { isAssistantEligibleDocument } from "@qcet/shared/domain/assistant/assistant-document-eligibility"'));
    assert.ok(src.includes("const canAskAssistant = assistantOn && item !== null && isAssistantEligibleDocument(item)"));
    assert.ok(
      src.includes(
        "askAssistantHref={canAskAssistant ? `/assistant?context=document:${encodeURIComponent(docId)}` : undefined}",
      ),
    );
  });
});

describe("Đường dẫn lối vào khớp bộ đọc ngữ cảnh của trang Trợ lý", () => {
  test("query của cả hai dạng đọc lại đúng loại và mã", () => {
    const taskQuery = new URL("/assistant?context=task:cuid-123", "http://localhost").searchParams.get("context");
    const docQuery = new URL("/assistant?context=document:doc-9", "http://localhost").searchParams.get("context");
    assert.deepEqual(parseAssistantContextParam(taskQuery), { type: "task", id: "cuid-123" });
    assert.deepEqual(parseAssistantContextParam(docQuery), { type: "document", id: "doc-9" });
  });
});

describe("Điều kiện văn bản Trợ lý đọc, dùng chung cho menu và server", () => {
  test("văn bản Thường không có ghi chú hạn chế được đọc", () => {
    assert.equal(isAssistantEligibleDocument({ securityLevel: "THUONG", notes: null }), true);
    assert.equal(isAssistantEligibleDocument({ securityLevel: "THUONG", notes: "Ghi chú thường" }), true);
  });

  test("văn bản mật bị loại, kể cả khi ghi chú không có mẫu hạn chế", () => {
    assert.equal(isAssistantEligibleDocument({ securityLevel: "MAT", notes: null }), false);
    assert.equal(isAssistantEligibleDocument({ securityLevel: "TOI_MAT", notes: "Ghi chú thường" }), false);
  });

  test("văn bản Thường có ghi chú hạn chế bị loại, không phân biệt hoa thường và dạng Unicode", () => {
    assert.equal(isAssistantEligibleDocument({ securityLevel: "THUONG", notes: "Giới hạn phổ biến" }), false);
    assert.equal(isAssistantEligibleDocument({ securityLevel: "THUONG", notes: "GIỚI HẠN" }), false);
    assert.equal(isAssistantEligibleDocument({ securityLevel: "THUONG", notes: "Giới hạn phổ biến".normalize("NFD") }), false);
    assert.equal(isAssistantEligibleDocument({ securityLevel: "THUONG", notes: "gioi_han" }), false);
    assert.equal(isAssistantEligibleDocument({ securityLevel: "THUONG", notes: "RESTRICTED" }), false);
  });

  test("ký tự chỉ khớp khi viết hoa (ſ dài, ı không chấm) cũng bị loại, như bộ phân loại ở server", () => {
    assert.equal(isAssistantEligibleDocument({ securityLevel: "THUONG", notes: "reſtricted" }), false);
    assert.equal(isAssistantEligibleDocument({ securityLevel: "THUONG", notes: "restrıcted" }), false);
    assert.equal(isAssistantEligibleDocument({ securityLevel: "THUONG", notes: "gıoı_han" }), false);
  });
});
