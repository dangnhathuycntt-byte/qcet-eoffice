import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { SchoolTask } from "@qcet/contracts/types/dashboard";
import {
  collectCollaboratorOptions,
  collectLeadOptions,
  getPersonFilterLabel,
  matchesLeadFilter,
  resolveViewerUnitId,
  withRoster,
} from "@qcet/shared/domain/tasks/task-filter-facets";
import { computeFilterFacets, filterDisplayedTasks } from "../src/components/workspace/unified-adaptive-workspace";

const viewer = { id: "u-me", name: "Đặng Nhật Huy" } as any;
const task = (id: string, extra: Partial<SchoolTask>) =>
  ({ id, title: id, status: "IN_PROGRESS", dueDate: "2026-10-31", subTasks: [], coAssignees: [], leadAssigneeName: "", ...extra }) as SchoolTask;

const tasks = [
  task("a", { leadAssigneeId: "u-me", leadAssigneeName: "Đặng Nhật Huy", priority: "HIGH" as any }),
  task("b", { leadAssigneeId: "u-2", leadAssigneeName: "Trần Văn B", coAssignees: ["Lê Thị C"] }),
  task("c", { leadAssigneeName: "Chưa phân công", coAssignees: ["Lê Thị C", "Đặng Nhật Huy"] }),
  task("d", { leadAssigneeId: "u-2", leadAssigneeName: "Trần Văn B", status: "COMPLETED" as any }),
];

describe("Bộ lọc theo người", () => {
  test("Người chủ trì: Tôi, chưa có, theo người; nhiều người = HOẶC", () => {
    const ids = (lead: string) => filterDisplayedTasks({ tasks, lead, user: viewer }).map((t) => t.id);
    assert.deepEqual(ids("me"), ["a"]);
    assert.deepEqual(ids("none"), ["c"]);
    assert.deepEqual(ids("u-2"), ["b", "d"]);
    assert.deepEqual(ids("me,none"), ["a", "c"]);
  });

  test("Người phối hợp: theo tên, Tôi, không có", () => {
    const ids = (collaborator: string) => filterDisplayedTasks({ tasks, collaborator, user: viewer }).map((t) => t.id);
    assert.deepEqual(ids("name:Lê Thị C"), ["b", "c"]);
    assert.deepEqual(ids("me"), ["c"]);
    assert.deepEqual(ids("none"), ["a", "d"]);
  });

  test("Danh sách người bỏ chính người xem và tên giữ chỗ, xếp theo tên", () => {
    assert.deepEqual(collectLeadOptions(tasks, viewer).map((p) => p.key), ["u-2"]);
    assert.deepEqual(collectCollaboratorOptions(tasks, viewer).map((p) => p.name), ["Lê Thị C"]);
    assert.equal(matchesLeadFilter(tasks[2], ["none"], viewer), true);
  });

  test("Gộp cán bộ đơn vị (kể cả chưa có việc), bỏ người xem và người trùng", () => {
    const roster = [
      { id: "u-me", name: "Đặng Nhật Huy" },
      { id: "u-2", name: "Trần Văn B" },
      { id: "u-9", name: "Phạm Thị D" },
    ];
    const lead = withRoster(collectLeadOptions(tasks, viewer), roster, (p) => p.id, viewer);
    assert.deepEqual(lead.map((p) => p.key), ["u-9", "u-2"]);
    const unitTasks = [task("x", { departmentName: "Trung tâm Số", leadDepartmentId: "unit-1" } as any)];
    assert.equal(resolveViewerUnitId(unitTasks, "Trung tâm Số"), "unit-1");
    assert.equal(resolveViewerUnitId(unitTasks, "Phòng khác"), undefined);
  });

  test("Nhãn chip tra tên người", () => {
    const people = collectLeadOptions(tasks, viewer);
    assert.equal(getPersonFilterLabel("me,u-2", people, "Chưa có người chủ trì"), "Tôi, Trần Văn B");
    assert.equal(getPersonFilterLabel(null, people, "x"), null);
  });
});

describe("Số đếm trong menu lọc khớp số dòng bảng", () => {
  test("mỗi số = số dòng khi nhóm đó chỉ chọn lựa chọn ấy, các nhóm khác giữ nguyên", () => {
    const options = { tasks, user: viewer, taskTab: "active" as const, priority: "HIGH" };
    const facets = computeFilterFacets(options);
    for (const [lead, n] of Object.entries(facets.counts.lead)) {
      assert.equal(n, filterDisplayedTasks({ ...options, lead }).length, lead);
    }
    // Tab Đang thực hiện + Ưu tiên Cao: chỉ "a" (Tôi chủ trì)
    assert.equal(facets.counts.lead.me, 1);
    assert.equal(facets.counts.lead["u-2"], 0);
    // Đếm Ưu tiên bỏ chính lựa chọn ưu tiên đang áp
    assert.equal(facets.counts.priority.HIGH, 1);
    assert.equal(facets.counts.priority.NORMAL, 0);
  });
});
