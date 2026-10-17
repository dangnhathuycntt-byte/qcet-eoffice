import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  describeCreateTaskFailure,
  isCreateTaskFormDirty,
  restoreCreateTaskDraft,
  validateCreateTaskForm,
  type CreateTaskFormData,
} from "../src/hooks/use-create-task-form";

const blank: CreateTaskFormData = {
  title: "",
  summary: "",
  description: "",
  // Form mới mở mặc định Không ưu tiên (như Linear), không phải Bình thường
  priority: "NONE",
  level: "DON_VI",
  selectedDeptCode: "CNTT",
  leadAssigneeId: "",
  startDate: "",
  dueDate: "",
  category: "CHUYEN_DOI_SO",
  subtasks: [],
};

const valid: CreateTaskFormData = {
  ...blank,
  title: "Rà soát đề cương môn học",
  leadAssigneeId: "u-hung",
  dueDate: "2026-10-30",
};

describe("validateCreateTaskForm — trường bắt buộc", () => {
  test("form đủ tên, người phụ trách, thời hạn thì không lỗi", () => {
    assert.deepEqual(validateCreateTaskForm(valid), {});
  });

  test("thiếu tên, người phụ trách, thời hạn báo đúng từng trường", () => {
    const errors = validateCreateTaskForm(blank);
    assert.equal(errors.title, "Vui lòng nhập tên nhiệm vụ.");
    assert.equal(errors.lead, "Vui lòng chọn người phụ trách.");
    assert.equal(errors.dueDate, "Vui lòng chọn thời hạn.");
  });

  test("tên chỉ có khoảng trắng hoặc dưới 3 ký tự bị chặn", () => {
    assert.equal(validateCreateTaskForm({ ...valid, title: "   " }).title, "Vui lòng nhập tên nhiệm vụ.");
    assert.equal(validateCreateTaskForm({ ...valid, title: " ab " }).title, "Tên nhiệm vụ phải có ít nhất 3 ký tự.");
  });

  test("không có nhiệm vụ cha thì không kiểm hạn nhiệm vụ con", () => {
    assert.equal(validateCreateTaskForm({ ...valid, dueDate: "2030-01-01" }).dueDate, undefined);
  });
});

describe("isCreateTaskFormDirty — hỏi trước khi đóng", () => {
  test("form trống chưa sửa thì không dirty", () => {
    assert.equal(isCreateTaskFormDirty(blank, blank), false);
  });

  test("điền tên, mô tả, thời hạn, người phụ trách hoặc đổi ưu tiên thì dirty", () => {
    assert.equal(isCreateTaskFormDirty({ ...blank, title: "Họp giao ban" }, blank), true);
    assert.equal(isCreateTaskFormDirty({ ...blank, description: "Nội dung" }, blank), true);
    assert.equal(isCreateTaskFormDirty({ ...blank, dueDate: "2026-10-30" }, blank), true);
    assert.equal(isCreateTaskFormDirty({ ...blank, leadAssigneeId: "u-hung" }, blank), true);
    assert.equal(isCreateTaskFormDirty({ ...blank, priority: "HIGH" }, blank), true);
    assert.equal(isCreateTaskFormDirty({ ...blank, priority: "MEDIUM" }, blank), true, "chọn Bình thường cũng là thay đổi so với Không ưu tiên");
  });

  test("chỉ thêm khoảng trắng hoặc sửa rồi hoàn tác thì không dirty", () => {
    assert.equal(isCreateTaskFormDirty({ ...blank, title: "   " }, blank), false);
    const edited = { ...blank, title: "Họp" };
    assert.equal(isCreateTaskFormDirty({ ...edited, title: "" }, blank), false);
  });

  test("giá trị điền sẵn khi mở form (tên, người phụ trách, hạn) không tính là thay đổi", () => {
    const prefilled = { ...blank, title: "Nhiệm vụ từ văn bản", leadAssigneeId: "u-hung", dueDate: "2026-10-30" };
    assert.equal(isCreateTaskFormDirty(prefilled, prefilled), false);
    assert.equal(isCreateTaskFormDirty({ ...prefilled, title: "Nhiệm vụ đã sửa" }, prefilled), true);
  });
});

describe("validateCreateTaskForm — cặp ngày", () => {
  test("ngày bắt đầu sau hạn chót là lỗi, cùng ngày hoặc trước thì hợp lệ", () => {
    assert.equal(
      validateCreateTaskForm({ ...valid, startDate: "2026-11-01", dueDate: "2026-10-30" }).startDate,
      "Ngày bắt đầu không được sau hạn chót.",
    );
    assert.equal(validateCreateTaskForm({ ...valid, startDate: "2026-10-30" }).startDate, undefined);
    assert.equal(validateCreateTaskForm({ ...valid, startDate: "2026-10-01" }).startDate, undefined);
  });

  test("không có ngày bắt đầu hoặc chuỗi lạ thì không báo lỗi cặp ngày", () => {
    assert.equal(validateCreateTaskForm({ ...valid, startDate: "" }).startDate, undefined);
    assert.equal(validateCreateTaskForm({ ...valid, startDate: "không phải ngày" }).startDate, undefined);
  });
});

describe("restoreCreateTaskDraft — nháp từ sessionStorage", () => {
  const fresh: CreateTaskFormData = { ...blank, selectedDeptCode: "CNTT", parentTaskId: "cha-1" };

  test("nháp hợp lệ cùng ngữ cảnh được khôi phục, trường thiếu lấy từ form mới", () => {
    const restored = restoreCreateTaskDraft(
      { title: "Soạn kế hoạch", parentTaskId: "cha-1", priority: "HIGH", dueDate: "2026-10-30" },
      fresh,
      "cha-1",
    );
    assert.equal(restored?.title, "Soạn kế hoạch");
    assert.equal(restored?.priority, "HIGH");
    assert.equal(restoreCreateTaskDraft({ title: "Họp", priority: "NONE" }, { ...blank, priority: "MEDIUM" })?.priority, "NONE", "nháp Không ưu tiên giữ nguyên");
    assert.equal(restored?.dueDate, "2026-10-30");
    assert.equal(restored?.description, "");
    assert.equal(restored?.parentTaskId, "cha-1");
  });

  test("nháp của ngữ cảnh khác bị bỏ: không gắn nhầm nhiệm vụ cha, không biến việc con thành nhiệm vụ gốc", () => {
    const subtaskDraft = { title: "Việc con dở dang", parentTaskId: "cha-1" };
    assert.equal(restoreCreateTaskDraft(subtaskDraft, { ...blank }, undefined), null);
    assert.equal(restoreCreateTaskDraft({ title: "Nhiệm vụ gốc dở dang" }, fresh, "cha-1"), null);
    assert.equal(restoreCreateTaskDraft(subtaskDraft, { ...fresh, parentTaskId: "cha-2" }, "cha-2"), null);
  });

  test("dữ liệu hỏng hoặc sai kiểu không làm sập form", () => {
    assert.equal(restoreCreateTaskDraft(null, blank), null);
    assert.equal(restoreCreateTaskDraft("chuỗi", blank), null);
    assert.equal(restoreCreateTaskDraft({ title: 42 }, blank), null);
    assert.equal(restoreCreateTaskDraft({ title: "" }, blank), null);
    const restored = restoreCreateTaskDraft(
      { title: "Họp giao ban", description: 7, priority: "KHẨN", level: "ADMIN", leadAssigneeId: null },
      blank,
    );
    assert.equal(restored?.description, "", "trường sai kiểu quay về giá trị mới, không phải undefined/số");
    assert.equal(restored?.priority, "NONE", "ưu tiên lạ quay về mặc định của form mới (Không ưu tiên)");
    assert.equal(restored?.level, "DON_VI");
    assert.equal(restored?.leadAssigneeId, "");
  });
});

describe("Việc con tạo kèm — nháp, dirty, hạn", () => {
  const item = { id: "s1", title: "Chuẩn bị số liệu", description: "", assigneeId: "", dueDate: "" };

  test("thêm việc con là đã sửa form (hỏi trước khi đóng)", () => {
    assert.equal(isCreateTaskFormDirty({ ...blank, subtasks: [item] }, blank), true);
  });

  test("hạn việc con sau hạn nhiệm vụ bị chặn trước khi gửi (hạn cha có thể bị dời sớm hơn sau khi thêm)", () => {
    const late = { ...valid, subtasks: [{ ...item, dueDate: "2026-11-02" }] };
    assert.match(validateCreateTaskForm(late).subtasks ?? "", /Chuẩn bị số liệu.*30\/10\/2026/);
    assert.equal(validateCreateTaskForm({ ...valid, subtasks: [{ ...item, dueDate: "2026-10-30" }] }).subtasks, undefined);
    assert.equal(validateCreateTaskForm({ ...valid, subtasks: [item] }).subtasks, undefined, "để trống thì theo hạn nhiệm vụ");
  });

  test("nháp giữ việc con đúng dạng, bỏ mục hỏng thay vì làm sập form", () => {
    const restored = restoreCreateTaskDraft(
      { title: "Soạn kế hoạch", subtasks: [item, null, "chuỗi", { title: "   " }, { title: 7 }, { title: "Viết báo cáo", dueDate: 5 }] },
      blank,
    );
    assert.deepEqual(restored?.subtasks.map((s) => s.title), ["Chuẩn bị số liệu", "Viết báo cáo"]);
    assert.equal(restored?.subtasks[1].dueDate, "", "trường sai kiểu thành chuỗi rỗng");
    assert.deepEqual(restoreCreateTaskDraft({ title: "Soạn kế hoạch", subtasks: "không phải mảng" }, blank)?.subtasks, []);
  });
});

describe("describeCreateTaskFailure — thông báo lỗi tiếng Việt", () => {
  test("lỗi tiếng Anh của máy chủ được thay bằng câu tiếng Việt theo mã trạng thái", () => {
    const cases: Array<[number, RegExp]> = [
      [401, /đăng nhập/],
      [403, /không có quyền/],
      [404, /Không tìm thấy/],
      [409, /đã được ghi nhận|đang xử lý/],
      [429, /quá nhanh/],
      [500, /Máy chủ gặp lỗi/],
      [400, /chưa hợp lệ/],
    ];
    for (const [status, pattern] of cases) {
      const message = describeCreateTaskFailure({ reason: "rejected", status, error: "Validation failed" });
      assert.match(message, pattern, `status ${status}`);
      assert.doesNotMatch(message, /Validation failed|status \d+/);
    }
  });

  test("lỗi nghiệp vụ đã là tiếng Việt được giữ nguyên", () => {
    const error = "Hạn nhiệm vụ con không được vượt quá hạn nhiệm vụ cha.";
    assert.equal(describeCreateTaskFailure({ reason: "rejected", status: 400, error }), error);
  });

  test("lỗi kiểm tra cục bộ của adapter (không có status) và lỗi lạ không lộ tiếng Anh", () => {
    assert.match(
      describeCreateTaskFailure({ reason: "validation", error: "CreateTaskDraft.dueDate is required to create a task." }),
      /chưa hợp lệ/,
    );
    assert.equal(
      describeCreateTaskFailure({ reason: "rejected", status: 418, error: "I'm a teapot" }),
      "Máy chủ từ chối tạo nhiệm vụ.",
    );
  });
});
