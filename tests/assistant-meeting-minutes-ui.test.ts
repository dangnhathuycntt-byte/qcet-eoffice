import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { AssistantActionView } from "@qcet/contracts/assistant";
import { assistantDateFrame, buildAssistantSystemPrompt } from "@qcet/shared/domain/assistant/assistant-prompt";
import { actionHistoryNote, describeAssistantAction } from "@qcet/shared/domain/assistant/assistant-actions";
import { contextTypeLabel, describeContextTarget, parseAssistantContextParam } from "../apps/web/src/components/assistant/assistant-model";

/** Trợ lý soạn biên bản cuộc họp (người dùng yêu cầu 21/10/2026): lời nhắc, ngữ cảnh "cuộc họp" và thẻ biên bản. */
describe("Trợ lý soạn biên bản: lời nhắc, ngữ cảnh cuộc họp, thẻ", () => {
  const prompt = buildAssistantSystemPrompt({ today: "2026-10-21", ...assistantDateFrame("2026-10-21"), userName: "Nguyễn Văn An", positions: [], context: null });

  it("quy tắc 10 có propose_minutes; quy tắc 12 bắt đọc bản ghi trước, không tự soạn khi bản ghi chưa xong", () => {
    assert.match(prompt, /propose_minutes \(lưu dự thảo biên bản một cuộc họp/);
    assert.match(prompt, /12\. Soạn biên bản cuộc họp: gọi get_meeting/);
    assert.match(prompt, /get_meeting_recording/);
    assert.match(prompt, /không tự soạn biên bản khi chưa có nội dung/);
  });

  it("?context=meeting:<id> mở cuộc trò chuyện gắn cuộc họp; nhãn là tên cuộc họp lấy từ chi tiết cuộc họp", () => {
    assert.deepEqual(parseAssistantContextParam("meeting:cmv123"), { type: "meeting", id: "cmv123" });
    assert.equal(describeContextTarget("meeting", { title: "Họp giao ban tháng 11", status: "HELD" }), "Họp giao ban tháng 11");
    assert.equal(contextTypeLabel("meeting"), "cuộc họp");
  });

  it("thẻ biên bản: tên nói rõ lưu hay thay dự thảo; khối ghi lại cho mô hình có trích biên bản", () => {
    const view: AssistantActionView = {
      kind: "meeting_minutes",
      meeting: { id: "m1", title: "Họp giao ban tháng 11" },
      from: "HELD",
      minutes: "Kết luận:\n- Giao phòng Đào tạo lập kế hoạch",
      replaces: false,
      baseUpdatedAt: "2026-10-21T01:00:00.000Z",
    };
    assert.equal(describeAssistantAction(view), 'Lưu dự thảo biên bản "Họp giao ban tháng 11"');
    assert.equal(describeAssistantAction({ ...view, replaces: true }), 'Thay dự thảo biên bản "Họp giao ban tháng 11"');
    const note = actionHistoryNote([
      { id: "a1", status: "done", view, undoable: false, error: null, createdAt: "2026-10-21T01:00:00.000Z", decidedAt: "2026-10-21T01:01:00.000Z" },
    ]);
    assert.match(note, /Lưu dự thảo biên bản/);
    assert.match(note, /Giao phòng Đào tạo/);
  });
});
