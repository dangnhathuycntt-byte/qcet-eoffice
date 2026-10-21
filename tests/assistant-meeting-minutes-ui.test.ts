import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { AssistantActionView } from "@qcet/contracts/assistant";
import { assistantDateFrame, buildAssistantSystemPrompt } from "@qcet/shared/domain/assistant/assistant-prompt";
import { actionHistoryNote, describeAssistantAction } from "@qcet/shared/domain/assistant/assistant-actions";
import {
  ASSISTANT_ASK_EVENT,
  askAssistantInDock,
  contextTypeLabel,
  describeContextTarget,
  parseAssistantContextParam,
  parseQueuedAutoSend,
  queueAssistantAutoSend,
  takeAssistantAutoSend,
  type AssistantAskEventDetail,
} from "../apps/web/src/components/assistant/assistant-model";

/** Trợ lý soạn biên bản cuộc họp (người dùng yêu cầu 21/10/2026): lời nhắc, ngữ cảnh "cuộc họp" và thẻ biên bản. */
describe("Trợ lý soạn biên bản: lời nhắc, ngữ cảnh cuộc họp, thẻ", () => {
  const prompt = buildAssistantSystemPrompt({ today: "2026-10-21", ...assistantDateFrame("2026-10-21"), userName: "Nguyễn Văn An", positions: [], context: null });

  it("quy tắc 10 có propose_minutes; quy tắc 12 bắt đọc bản ghi trước, không tự soạn khi bản ghi chưa xong", () => {
    assert.match(prompt, /propose_minutes \(lưu dự thảo biên bản một cuộc họp/);
    assert.match(prompt, /12\. Soạn biên bản cuộc họp: gọi get_meeting_recording/);
    // Chép lại cả biên bản vào tham số mất hơn một phút (người dùng hỏi 21/10/2026): lấy thẳng từ bản ghi bằng recordingId
    assert.match(prompt, /propose_minutes với recordingId của bản đó, không chép lại biên bản/);
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

/** Người dùng 21/10/2026: bấm "Tạo biên bản" thì chat gửi luôn câu nhờ soạn biên bản, không bắt bấm gửi lần nữa. */
describe("\"Tạo biên bản\" gửi luôn câu hỏi cho Trợ lý", () => {
  const meeting = { type: "meeting", id: "cmv123" } as const;
  const prompt = 'Soạn biên bản cuộc họp này từ bản ghi "a.m4a" (ghi lúc 09:25 21/10/2026).';

  it("khung nổi nhận câu hỏi kèm cờ gửi luôn; không có cờ thì vẫn chỉ điền sẵn", () => {
    const target = new EventTarget();
    const g = globalThis as { window?: unknown };
    g.window = target;
    const asked: AssistantAskEventDetail[] = [];
    target.addEventListener(ASSISTANT_ASK_EVENT, (event) => {
      const detail = (event as CustomEvent<AssistantAskEventDetail>).detail;
      asked.push({ ...detail });
      detail.handled = true;
    });
    try {
      assert.equal(askAssistantInDock(meeting, { prompt, send: true }), true);
      assert.equal(askAssistantInDock({ type: "task", id: "t-1" }), true);
      assert.deepEqual(asked.map(({ context, prompt: text, send }) => ({ context, text, send })), [
        { context: meeting, text: prompt, send: true },
        { context: { type: "task", id: "t-1" }, text: undefined, send: undefined },
      ]);
    } finally {
      delete g.window;
    }
  });

  it("trang Trợ lý (điện thoại) chỉ gửi câu chờ của đúng cuộc họp, còn mới (60 giây), và chỉ một lần", () => {
    const now = Date.parse("2026-10-21T02:25:00.000Z");
    const raw = (value: object) => JSON.stringify({ ...meeting, prompt, at: now, ...value });
    assert.equal(parseQueuedAutoSend(raw({}), meeting, now + 5_000), prompt);
    assert.equal(parseQueuedAutoSend(raw({ id: "khac" }), meeting, now), null, "cuộc họp khác");
    assert.equal(parseQueuedAutoSend(raw({ type: "task" }), meeting, now), null, "loại ngữ cảnh khác");
    assert.equal(parseQueuedAutoSend(raw({}), meeting, now + 61_000), null, "quá cũ");
    assert.equal(parseQueuedAutoSend(raw({ at: now + 10_000 }), meeting, now), null, "giờ trong tương lai");
    assert.equal(parseQueuedAutoSend(raw({ prompt: "   " }), meeting, now), null, "câu rỗng");
    assert.equal(parseQueuedAutoSend("{hỏng", meeting, now), null);
    assert.equal(parseQueuedAutoSend(null, meeting, now), null);

    const store = new Map<string, string>();
    const g = globalThis as { window?: unknown };
    g.window = {
      sessionStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key),
      },
    };
    try {
      queueAssistantAutoSend(meeting, prompt, now);
      assert.equal(takeAssistantAutoSend({ type: "meeting", id: "khac" }, now), null, "sai cuộc họp thì không gửi và câu bị bỏ");
      queueAssistantAutoSend(meeting, prompt, now);
      assert.equal(takeAssistantAutoSend(meeting, now + 1_000), prompt);
      assert.equal(takeAssistantAutoSend(meeting, now + 2_000), null, "tải lại trang không gửi lần hai");
    } finally {
      delete g.window;
    }
  });
});
