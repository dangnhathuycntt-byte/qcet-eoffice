import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { agentReplyToPlainText, parseAgentReply } from "@qcet/shared/domain/tasks/agent-reply-format";

/** Bảng trong câu trả lời của Trợ lý (người dùng gửi ảnh 19/10/2026: bảng hiện thành dòng chữ có dấu `|`). */
describe("parseAgentReply: bảng kiểu GFM", () => {
  const reply = "**Tổng kết**\n| | Số lượng |\n|---|---|\n| Nhiệm vụ chính | **12** |\n| Việc con | 48 |\n\nThầy muốn tôi bắt đầu?";

  it("dòng tiêu đề + dòng ngăn + các dòng dữ liệu thành một khối bảng; ô giữ chữ đậm", () => {
    const blocks = parseAgentReply(reply);
    assert.deepEqual(
      blocks.map((block) => block.type),
      ["paragraph", "table", "paragraph"],
    );
    const table = blocks[1];
    assert.ok(table.type === "table");
    assert.deepEqual(table.header, [[], [{ text: "Số lượng", bold: false }]]);
    assert.deepEqual(table.rows, [
      [[{ text: "Nhiệm vụ chính", bold: false }], [{ text: "12", bold: true }]],
      [[{ text: "Việc con", bold: false }], [{ text: "48", bold: false }]],
    ]);
  });

  it("dòng thiếu ô thì thêm ô rỗng, thừa ô thì bỏ, theo số ô của dòng tiêu đề", () => {
    const [table] = parseAgentReply("| A | B |\n|:--|--:|\n| 1 |\n| 2 | 3 | 4 |");
    assert.ok(table.type === "table");
    assert.deepEqual(
      table.rows.map((row) => row.map((cell) => cell.map((part) => part.text).join(""))),
      [
        ["1", ""],
        ["2", "3"],
      ],
    );
  });

  it("chưa có dòng ngăn (đang chạy dần) thì vẫn là đoạn văn", () => {
    assert.deepEqual(
      parseAgentReply("| A | B |\n| 1 | 2 |").map((block) => block.type),
      ["paragraph"],
    );
  });

  it("sao chép bảng thành các dòng cách nhau bằng Tab", () => {
    assert.equal(agentReplyToPlainText(reply), "Tổng kết\n\n\tSố lượng\nNhiệm vụ chính\t12\nViệc con\t48\n\nThầy muốn tôi bắt đầu?");
  });
});

/** Trích dẫn `>` (Trợ lý dùng cho "Lưu ý"; thử công văn thật 19/10/2026 thấy dấu `>` hiện nguyên). */
describe("parseAgentReply: trích dẫn", () => {
  it("dòng `>` liền nhau thành một khối, bỏ dấu `>`, giữ chữ đậm và xuống dòng", () => {
    const blocks = parseAgentReply("Nội dung chính.\n\n> **Lưu ý:** hạn đã qua.\n> Thầy/Cô xem lại.\n\nCâu cuối");
    assert.deepEqual(
      blocks.map((block) => block.type),
      ["paragraph", "quote", "paragraph"],
    );
    const quote = blocks[1];
    assert.ok(quote.type === "quote");
    assert.deepEqual(quote.inline, [
      { text: "Lưu ý:", bold: true },
      { text: " hạn đã qua.\nThầy/Cô xem lại.", bold: false },
    ]);
    assert.equal(agentReplyToPlainText("> **Lưu ý:** hạn đã qua."), "Lưu ý: hạn đã qua.");
  });
});

describe("parseAgentReply: đường kẻ", () => {
  it("dòng chỉ có ---, *** hay ___ thành đường kẻ, không hiện thô; danh sách và bảng không bị nhầm", () => {
    const blocks = parseAgentReply("Phần một.\n\n---\n\nPhần hai.\n* * *\n- Mục\n\n| A |\n|---|\n| 1 |");
    assert.deepEqual(
      blocks.map((block) => block.type),
      ["paragraph", "divider", "paragraph", "divider", "list", "table"],
    );
    assert.equal(agentReplyToPlainText("Phần một.\n\n---\n\nPhần hai."), "Phần một.\n\nPhần hai.");
  });
});
