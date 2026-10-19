import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  TASK_AGENT_FALLBACK_REPLY,
  TASK_AGENT_SUBTASKS_MAX,
  TASK_AGENT_TITLE_MAX,
  buildTaskAgentSystemPrompt,
  parseTaskAgentOutput,
  sanitizeTaskAgentDraft,
} from "@qcet/shared/domain/tasks/task-agent-draft";

const personnel = [
  { id: "u1", name: "Lê Văn Thí", position: "Trưởng phòng" },
  { id: "u2", name: "Hồ Lê Nam Bình", position: "Chuyên viên" },
];
const ids = new Set(personnel.map((p) => p.id));

describe("Agent soạn nhiệm vụ: đọc kết quả mô hình", () => {
  test("đọc JSON bọc ```json", () => {
    const raw = '```json\n{"reply":"Đã điền.","draft":{"title":"Chuẩn bị hội nghị viên chức","priority":"URGENT","leadAssigneeId":"u1","dueDate":"2026-10-25"}}\n```';
    assert.deepEqual(parseTaskAgentOutput(raw, personnel), {
      reply: "Đã điền.",
      draft: { title: "Chuẩn bị hội nghị viên chức", priority: "URGENT", leadAssigneeId: "u1", dueDate: "2026-10-25" },
    });
  });

  test("đọc JSON có câu dẫn phía trước", () => {
    const result = parseTaskAgentOutput('Đây là nháp: {"reply":"Xong","draft":{"priority":"LOW"}} — hết.', personnel);
    assert.deepEqual(result, { reply: "Xong", draft: { priority: "LOW" } });
  });

  test("không đọc được JSON thì trả câu mặc định và nháp rỗng, không ném lỗi", () => {
    assert.deepEqual(parseTaskAgentOutput("Xin lỗi, tôi không hiểu.", personnel), {
      reply: TASK_AGENT_FALLBACK_REPLY,
      draft: {},
    });
  });

  test("bỏ người chủ trì không có trong danh sách nhân sự", () => {
    assert.deepEqual(sanitizeTaskAgentDraft({ leadAssigneeId: "u-bia", title: "Họp giao ban" }, ids), { title: "Họp giao ban" });
  });

  test("bỏ ngày không có thật hoặc sai dạng", () => {
    assert.deepEqual(sanitizeTaskAgentDraft({ dueDate: "2026-02-30", startDate: "25/10/2026" }, ids), {});
    assert.deepEqual(sanitizeTaskAgentDraft({ dueDate: "2028-02-29" }, ids), { dueDate: "2028-02-29" });
  });

  test("bỏ ngày bắt đầu nếu sau hạn", () => {
    assert.deepEqual(sanitizeTaskAgentDraft({ startDate: "2026-10-30", dueDate: "2026-10-25" }, ids), { dueDate: "2026-10-25" });
  });

  test("gộp xuống dòng trong tên và cắt đúng giới hạn", () => {
    const draft = sanitizeTaskAgentDraft({ title: `Chuẩn bị\n  hội nghị\n${"x".repeat(400)}` }, ids);
    assert.equal(draft.title?.startsWith("Chuẩn bị hội nghị "), true);
    assert.equal(draft.title?.length, TASK_AGENT_TITLE_MAX);
  });

  test("chỉ nhận mức ưu tiên của form (MEDIUM), không nhận NORMAL của bảng", () => {
    assert.deepEqual(sanitizeTaskAgentDraft({ priority: "NORMAL" }, ids), {});
    assert.deepEqual(sanitizeTaskAgentDraft({ priority: "MEDIUM" }, ids), { priority: "MEDIUM" });
  });

  test("prompt có ngày hôm nay kèm thứ và danh sách nhân sự", () => {
    const prompt = buildTaskAgentSystemPrompt({ today: "2026-10-16", departmentName: "Phòng Quản lý Đào tạo", personnel, draft: {} });
    assert.match(prompt, /Thứ Sáu, 2026-10-16/);
    assert.match(prompt, /"id":"u1","name":"Lê Văn Thí"/);
  });
});

describe("Agent soạn nhiệm vụ: việc con", () => {
  test("giữ việc con hợp lệ, bỏ tên quá ngắn, bỏ người ngoài danh sách và ngày sai", () => {
    const draft = sanitizeTaskAgentDraft(
      {
        subtasks: [
          { title: "Thu thập số liệu\nquý III", assigneeId: "u2", dueDate: "2026-10-20" },
          { title: "ab" },
          { title: "Tổng hợp báo cáo", assigneeId: "x9", dueDate: "2026-02-30" },
          "không phải object",
        ],
      },
      ids,
    );
    assert.deepEqual(draft.subtasks, [
      { title: "Thu thập số liệu quý III", assigneeId: "u2", dueDate: "2026-10-20" },
      { title: "Tổng hợp báo cáo" },
    ]);
  });

  test("hạn việc con sau hạn nhiệm vụ (hạn mới hoặc hạn đang có) thì bỏ hạn, vẫn giữ việc", () => {
    const withCurrent = sanitizeTaskAgentDraft({ subtasks: [{ title: "Rà soát hồ sơ", dueDate: "2026-11-05" }] }, ids, { parentDueDate: "2026-10-31" });
    assert.deepEqual(withCurrent.subtasks, [{ title: "Rà soát hồ sơ" }]);
    const withNew = sanitizeTaskAgentDraft({ dueDate: "2026-11-10", subtasks: [{ title: "Rà soát hồ sơ", dueDate: "2026-11-05" }] }, ids, { parentDueDate: "2026-10-31" });
    assert.deepEqual(withNew.subtasks, [{ title: "Rà soát hồ sơ", dueDate: "2026-11-05" }]);
  });

  test("đang giao việc con thì không nhận subtasks; tối đa 20 việc", () => {
    assert.equal(sanitizeTaskAgentDraft({ subtasks: [{ title: "Rà soát hồ sơ" }] }, ids, { allowSubtasks: false }).subtasks, undefined);
    const many = Array.from({ length: 25 }, (_, i) => ({ title: `Việc số ${i + 1}` }));
    assert.equal(sanitizeTaskAgentDraft({ subtasks: many }, ids).subtasks?.length, TASK_AGENT_SUBTASKS_MAX);
  });

  test("prompt dặn chỉ thêm việc con mới; đang giao việc con thì không có subtasks", () => {
    const base = { today: "2026-10-16", departmentName: "Phòng Quản lý Đào tạo", personnel, draft: {} };
    assert.match(buildTaskAgentSystemPrompt(base), /chỉ gồm việc con MỚI/);
    assert.match(buildTaskAgentSystemPrompt({ ...base, parentTaskTitle: "Tổ chức hội nghị" }), /không có subtasks/);
  });
});
