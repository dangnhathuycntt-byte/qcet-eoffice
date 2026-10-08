import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mapPrismaTaskToSchoolTask, mapPrismaTaskToStaffTask } from "../src/lib/adapters/task-db-adapter";

const dri = (id: string, name: string, avatarUrl: string | null = null) => ({
  userId: id,
  role: "DRI",
  isPrimaryDRI: true,
  user: { id, name, avatarUrl },
});

const parent = (scope: "SCHOOL" | "DEPARTMENT"): any => ({
  id: "t-parent",
  code: "NV-2026-09-129",
  title: "Tổng hợp báo cáo",
  description: "",
  scope,
  status: "IN_PROGRESS",
  priority: "NORMAL",
  progressPercent: 0,
  startDate: new Date("2026-09-27T00:00:00+07:00"),
  dueDate: new Date("2026-09-28T17:00:00+07:00"),
  leadUnit: { id: "u1", name: "Trung tâm Số", code: "TTS" },
  actors: [dri("u-huy", "Đặng Nhật Huy")],
  subTasks: [
    { id: "s1", status: "NOT_STARTED", archivedAt: null, actors: [dri("u-huy", "Đặng Nhật Huy")] },
    { id: "s2", status: "NOT_STARTED", archivedAt: null, actors: [dri("u-huy", "Đặng Nhật Huy")] },
    { id: "s3", status: "IN_PROGRESS", archivedAt: null, actors: [dri("u-khue", "Ngô Lê Minh Khuê", "/a/khue.png")] },
    { id: "s4", status: "CANCELLED", archivedAt: null, actors: [dri("u-x", "Người đã hủy")] },
  ],
  deliverables: [],
});

describe("Phối hợp của nhiệm vụ cha = người phụ trách các nhiệm vụ con (đang hoạt động)", () => {
  test("nhiệm vụ cấp trường: ghi cả người phụ trách chính khi họ làm việc con, loại việc con đã hủy", () => {
    const t: any = mapPrismaTaskToSchoolTask(parent("SCHOOL"));
    assert.deepEqual(t.coAssignees, ["Đặng Nhật Huy", "Ngô Lê Minh Khuê"]);
  });

  test("nhiệm vụ cấp đơn vị cũng có Phối hợp như danh sách (trước đây luôn rỗng)", () => {
    const t: any = mapPrismaTaskToStaffTask(parent("DEPARTMENT"));
    assert.deepEqual(t.coAssignees, ["Đặng Nhật Huy", "Ngô Lê Minh Khuê"]);
    assert.equal(t.collaborators.length, 2);
    assert.equal(t.collaborators[1].id, "u-khue");
    assert.equal(t.collaborators[1].name, "Ngô Lê Minh Khuê");
    assert.equal(t.collaborators[1].avatarUrl, "/a/khue.png");
  });

  test("nhiệm vụ không có việc con thì Phối hợp rỗng", () => {
    const raw = parent("DEPARTMENT");
    raw.subTasks = [];
    const t: any = mapPrismaTaskToStaffTask(raw);
    assert.deepEqual(t.collaborators, []);
  });
});

describe("Nhiệm vụ cấp đơn vị giữ đúng độ ưu tiên và trạng thái từ DB", () => {
  test("độ ưu tiên LOW không bị hiển thị thành Bình thường", () => {
    const raw = parent("DEPARTMENT");
    raw.priority = "LOW";
    const t: any = mapPrismaTaskToStaffTask(raw);
    assert.equal(t.priority, "LOW");
    for (const p of ["URGENT", "HIGH", "NORMAL"]) {
      raw.priority = p;
      assert.equal((mapPrismaTaskToStaffTask(raw) as any).priority, p);
    }
  });

  test("trạng thái Chờ duyệt (WAITING_APPROVAL) không bị đổi thành NEEDS_REVIEW", () => {
    const raw = parent("DEPARTMENT");
    raw.status = "WAITING_APPROVAL";
    assert.equal((mapPrismaTaskToStaffTask(raw) as any).status, "WAITING_APPROVAL");
    raw.status = "NEEDS_REVIEW";
    assert.equal((mapPrismaTaskToStaffTask(raw) as any).status, "NEEDS_REVIEW");
  });
});

describe("Phối hợp chỉ gồm người phụ trách nhiệm vụ con (không lấy người gán trực tiếp)", () => {
  test("bỏ qua actors COLLABORATOR và ASSIGNER của nhiệm vụ cha", () => {
    for (const scope of ["SCHOOL", "DEPARTMENT"] as const) {
      const raw = parent(scope);
      raw.actors = [
        dri("u-huy", "Đặng Nhật Huy"),
        { userId: "u-oanh", role: "COLLABORATOR", isPrimaryDRI: false, user: { id: "u-oanh", name: "Lê Phương Thúy Oanh", avatarUrl: null } },
        { userId: "u-ass", role: "ASSIGNER", isPrimaryDRI: false, user: { id: "u-ass", name: "Người giao việc", avatarUrl: null } },
      ];
      const t: any = scope === "SCHOOL" ? mapPrismaTaskToSchoolTask(raw) : mapPrismaTaskToStaffTask(raw);
      assert.deepEqual(t.coAssignees, ["Đặng Nhật Huy", "Ngô Lê Minh Khuê"], `phạm vi ${scope}`);
    }
  });
});

describe("Nhóm avatar Phối hợp dùng ảnh đại diện thật", () => {
  test("nhiệm vụ cấp trường trả kèm ảnh đại diện của từng người phối hợp", () => {
    const t: any = mapPrismaTaskToSchoolTask(parent("SCHOOL"));
    assert.deepEqual(
      t.coAssigneeUsers.map((u: any) => [u.name, u.avatarUrl ?? null]),
      [["Đặng Nhật Huy", null], ["Ngô Lê Minh Khuê", "/a/khue.png"]]
    );
  });

  test("bảng truyền avatarUrl vào UserAvatar thay vì chỉ truyền tên", () => {
    const row = readFileSync("src/components/tasks/table/components/task-row.tsx", "utf8");
    assert.ok(row.includes("coAssigneeUsers") && row.includes("avatarUrl={entry.avatarUrl}"));
  });
});
