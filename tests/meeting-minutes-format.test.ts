import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { minutesToReplyMarkup } from "@qcet/shared/domain/meetings/minutes-format";
import { agentReplyToPlainText, parseAgentReply } from "@qcet/shared/domain/tasks/agent-reply-format";

/** Biên bản cuộc họp hiện thành khối chữ có "-"/"+" gõ tay (người dùng gửi ảnh 21/10/2026): nay dựng thành mục và danh sách. */
describe("minutesToReplyMarkup: biên bản chữ thuần thành mục và danh sách", () => {
  // Đúng dạng biên bản Agent soạn trong ảnh người dùng gửi
  const minutes = [
    "Nội dung thảo luận:",
    "- Rà soát vị trí việc làm và nhân sự: đơn vị hiện có 8 người phụ trách 6 vị trí việc làm.",
    "- Các vị trí còn khuyết nhân sự chuyên trách:",
    "  + Vị trí dạy học số chưa có nhân sự.",
    "  + Vị trí thống kê (vị trí số 6) chưa có nhân sự.",
    "- Đánh giá chung: nêu rõ quan điểm thẳng thắn.",
    "",
    "Kết luận:",
    "- Xác định đơn vị đang thiếu nhân sự.",
  ].join("\n");

  it("dòng mục đứng riêng thành tiêu đề (bỏ dấu hai chấm), ý con \"+\" thành mục con", () => {
    const blocks = parseAgentReply(minutesToReplyMarkup(minutes));
    assert.deepEqual(
      blocks.map((block) => block.type),
      ["heading", "list", "heading", "list"]
    );
    assert.equal(blocks[0].type === "heading" && blocks[0].inline[0].text, "Nội dung thảo luận");
    assert.equal(blocks[2].type === "heading" && blocks[2].inline[0].text, "Kết luận");
    const list = blocks[1];
    assert.ok(list.type === "list");
    assert.equal(list.items.length, 5);
    assert.deepEqual(list.depths, [0, 0, 1, 1, 0]);
    // Ý kết thúc bằng dấu hai chấm vẫn là một ý (có ý con), không thành tiêu đề
    assert.equal(list.items[1][0].text, "Các vị trí còn khuyết nhân sự chuyên trách:");
  });

  it("Agent bỏ dấu hai chấm: dòng ngắn ngay trên một ý vẫn là tiêu đề; câu có dấu chấm thì không", () => {
    assert.equal(minutesToReplyMarkup("Kết luận\n- Đồng ý"), "### Kết luận\n- Đồng ý");
    assert.equal(minutesToReplyMarkup("Đã thống nhất.\n- Đồng ý"), "Đã thống nhất.\n- Đồng ý");
  });

  it("chỉ dòng đứng riêng mới là tiêu đề: dòng nối tiếp đoạn, câu dài hay dòng có chữ sau dấu hai chấm giữ nguyên", () => {
    assert.equal(minutesToReplyMarkup("Hội đồng họp lúc 8 giờ\nThành phần:"), "Hội đồng họp lúc 8 giờ\nThành phần:");
    const long = "Sau khi thảo luận, hội đồng thống nhất thông qua các nội dung sau đây:";
    assert.equal(minutesToReplyMarkup(long), long);
    assert.equal(minutesToReplyMarkup("Kết luận: đồng ý phương án 2."), "Kết luận: đồng ý phương án 2.");
  });

  it("gõ tay không có dòng trống: \"Kết luận:\" sát dưới ý cuối vẫn là tiêu đề; dòng không dấu hai chấm sát dưới ý thì không", () => {
    assert.equal(minutesToReplyMarkup("- Ý cuối\nKết luận:\n- Đồng ý"), "- Ý cuối\n### Kết luận\n- Đồng ý");
    assert.equal(minutesToReplyMarkup("- Rà soát vị trí\nviệc làm\n- Ý sau"), "- Rà soát vị trí\nviệc làm\n- Ý sau");
  });

  it("chữ thường không có dấu hiệu định dạng giữ nguyên từng ký tự", () => {
    const plain = "Cuộc họp tạm để kiểm thử ghi âm; sẽ xóa sau khi kiểm.";
    assert.equal(minutesToReplyMarkup(plain), plain);
  });
});

describe("parseAgentReply: mục con thụt lề", () => {
  it("danh sách phẳng giữ đúng dạng cũ (không có depths)", () => {
    const [list] = parseAgentReply("- Một\n- Hai");
    assert.deepEqual(list, { type: "list", ordered: false, items: [[{ text: "Một", bold: false }], [{ text: "Hai", bold: false }]] });
  });

  it("thụt từ 2 dấu cách sau một danh sách là mục con, kể cả dưới danh sách đánh số; sao chép giữ thụt", () => {
    const reply = "1. Bước một\n   - Chi tiết a\n   - Chi tiết b\n2. Bước hai";
    const [list] = parseAgentReply(reply);
    assert.ok(list.type === "list");
    assert.equal(list.ordered, true);
    assert.deepEqual(list.depths, [0, 1, 1, 0]);
    assert.equal(agentReplyToPlainText(reply), "1. Bước một\n  - Chi tiết a\n  - Chi tiết b\n2. Bước hai");
  });

  it("dòng thụt lề không đứng sau danh sách thì là mục thường", () => {
    const [list] = parseAgentReply("  - Mục lẻ");
    assert.deepEqual(list, { type: "list", ordered: false, items: [[{ text: "Mục lẻ", bold: false }]] });
  });
});
