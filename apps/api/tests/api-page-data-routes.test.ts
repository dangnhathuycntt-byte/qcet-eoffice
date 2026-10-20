/**
 * GET /api/page-data/* (D5): dữ liệu ban đầu của năm trang web. Mỗi endpoint xác thực ở server (401), dùng lại
 * kiểm quyền của service (404/403), khớp schema @qcet/contracts/page-data, và dữ liệu trước khi tuần tự hóa không
 * còn Date/Map/Set/BigInt ngoài các trường đã đối chiếu — trang nhận qua JSON cùng giá trị như khi còn gọi service
 * trực tiếp (RSC giữ Date).
 */
import { test, describe, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@qcet/db/prisma";
import { DossierStatus, TaskActorRole, UnitType, UserRole } from "@prisma/client";
import { signSessionToken, SESSION_COOKIE_NAME } from "../src/lib/jwt-session";
import {
  DossierDetailPageDataSchema,
  MeetingDetailPageDataSchema,
  TaskDetailPageDataSchema,
  TasksPageDataSchema,
} from "@qcet/contracts/page-data";
import { GET as getTasksPageData } from "../src/app/api/page-data/tasks/route";
import { GET as getTaskDetailPageData } from "../src/app/api/page-data/tasks/[id]/route";
import { GET as getMeetingPageData } from "../src/app/api/page-data/meetings/[id]/route";
import { GET as getDossierPageData } from "../src/app/api/page-data/dossiers/[id]/route";
import { taskQueryService } from "../src/server/tasks";
import { loadAuthorizationContext } from "../src/server/authorization/authorization-context-service";
import { buildTaskResource, computeAvailableActions } from "../src/server/authorization/available-actions";

const DAY_MS = 86_400_000;
const BASE = "http://localhost:3000";

/**
 * Date còn lại trong dữ liệu (qua JSON thành chuỗi ISO) đã đối chiếu với nơi dùng, cho cùng kết quả:
 * - `actors[].appointedAt`: adapter truyền nguyên quan hệ actors; giao diện chỉ đọc `actors[].userId`.
 */
const EQUIVALENT_DATE_PATHS = [
  /\.actors\[\d+\]\.appointedAt: Date$/,
];
const unexpectedNonJson = (value: unknown) =>
  nonJsonValues(value).filter((entry) => !EQUIVALENT_DATE_PATHS.some((pattern) => pattern.test(entry)));

/** Đường dẫn tới mọi giá trị JSON không biểu diễn được như RSC (Date, Map, Set, BigInt, hàm). */
function nonJsonValues(value: unknown, at = "$", out: string[] = []): string[] {
  if (value instanceof Date || value instanceof Map || value instanceof Set) out.push(`${at}: ${value.constructor.name}`);
  else if (typeof value === "bigint" || typeof value === "function") out.push(`${at}: ${typeof value}`);
  else if (Array.isArray(value)) value.forEach((item, i) => nonJsonValues(item, `${at}[${i}]`, out));
  else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) nonJsonValues(v, `${at}.${k}`, out);
  return out;
}

describe("GET /api/page-data/*", () => {
  const runId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const users: Record<"owner" | "outsider", { id: string; email: string; name: string; role: UserRole }> = {} as never;
  const tokens: Record<string, string> = {};
  let unitId = "";
  let parentTaskId = "";
  let childTaskId = "";
  let meetingId = "";
  let dossierId = "";

  /** Body JSON mà route đưa vào NextResponse.json, trước khi tuần tự hóa. */
  const captured: unknown[] = [];
  const originalJson = NextResponse.json.bind(NextResponse);

  const request = (path: string, who?: keyof typeof users) =>
    new NextRequest(`${BASE}${path}`, who ? { headers: { cookie: `${SESSION_COOKIE_NAME}=${tokens[who]}` } } : {});
  const params = (id: string) => ({ params: Promise.resolve({ id }) });

  before(async () => {
    mock.method(NextResponse, "json", (body: unknown, init?: ResponseInit) => {
      captured.push(body);
      return originalJson(body, init);
    });

    unitId = (await prisma.organizationalUnit.create({
      data: { code: `OU_PD_${runId}`, name: `Đơn vị trang ${runId}`, type: UnitType.DEPARTMENT },
    })).id;
    for (const key of ["owner", "outsider"] as const) {
      const user = await prisma.user.create({
        data: { email: `pd_${key}_${runId}@qnc.edu.vn`, name: `Người ${key} ${runId}`, role: UserRole.CHUYEN_VIEN, isActive: true },
      });
      users[key] = user;
      tokens[key] = await signSessionToken({ id: user.id, email: user.email, role: user.role, name: user.name });
    }

    const taskBase = {
      createdById: users.owner.id,
      leadUnitId: unitId,
      academicMonth: 9,
      academicYear: "2026-2027",
      dueDate: new Date(Date.now() + 7 * DAY_MS),
    };
    parentTaskId = (await prisma.task.create({ data: { ...taskBase, code: `PD-${runId}`, title: `Nhiệm vụ trang ${runId}` } })).id;
    childTaskId = (await prisma.task.create({
      data: { ...taskBase, code: `PD-${runId}-1`, title: `Việc con ${runId}`, parentTaskId },
    })).id;
    await prisma.taskActor.createMany({
      data: [parentTaskId, childTaskId].map((taskId) => ({ taskId, userId: users.owner.id, role: TaskActorRole.DRI, isPrimaryDRI: true })),
    });

    // Bắt đầu lúc này: nằm trong tháng học hiện tại mà trang Lịch tải sẵn
    meetingId = (await prisma.meeting.create({
      data: { code: `MT_PD_${runId}`, title: `Họp trang ${runId}`, unitId, organizerId: users.owner.id, startTime: new Date() },
    })).id;

    dossierId = (await prisma.workDossier.create({
      data: { code: `${runId}_HS`, title: `Hồ sơ trang ${runId}`, owningUnitId: unitId, responsiblePersonId: users.owner.id, status: DossierStatus.OPEN },
    })).id;
    await prisma.dossierItem.create({
      data: { dossierId, itemType: "ATTACHMENT", title: "Tờ trình", addedById: users.owner.id, sequence: 1, documentDate: new Date() },
    });
  });

  after(async () => {
    mock.restoreAll();
    const userIds = Object.values(users).map((u) => u.id);
    if (dossierId) {
      await prisma.dossierItem.deleteMany({ where: { dossierId } });
      await prisma.workDossier.deleteMany({ where: { id: dossierId } });
    }
    if (meetingId) await prisma.meeting.deleteMany({ where: { id: meetingId } });
    const taskIds = [childTaskId, parentTaskId].filter(Boolean);
    if (taskIds.length) {
      await prisma.taskActor.deleteMany({ where: { taskId: { in: taskIds } } });
      await prisma.task.deleteMany({ where: { id: childTaskId } });
      await prisma.task.deleteMany({ where: { id: parentTaskId } });
    }
    await prisma.auditEvent.deleteMany({ where: { actorId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    if (unitId) await prisma.organizationalUnit.deleteMany({ where: { id: unitId } });
  });

  test("chưa đăng nhập: cả bốn endpoint trả 401", async () => {
    const responses = await Promise.all([
      getTasksPageData(request("/api/page-data/tasks")),
      getTaskDetailPageData(request(`/api/page-data/tasks/${parentTaskId}`), params(parentTaskId)),
      getMeetingPageData(request(`/api/page-data/meetings/${meetingId}`), params(meetingId)),
      getDossierPageData(request(`/api/page-data/dossiers/${dossierId}`), params(dossierId)),
    ]);
    assert.deepEqual(responses.map((r) => r.status), [401, 401, 401, 401]);
  });

  test("tasks: nhiệm vụ gốc kèm thao tác, khớp tính toán của trang cũ, không có Date", async () => {
    captured.length = 0;
    const response = await getTasksPageData(request("/api/page-data/tasks?view=related", "owner"));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    const body = TasksPageDataSchema.parse(await response.json());
    const parent = body.tasks.find((t) => t.id === parentTaskId);
    assert.ok(parent, "nhiệm vụ gốc của người dùng có trong danh sách");
    assert.ok(Array.isArray((parent as { availableActions?: unknown }).availableActions));
    assert.ok(!body.tasks.some((t) => t.id === childTaskId), "việc con không nằm ở danh sách gốc");
    assert.deepEqual(nonJsonValues(captured[0]), []);

    // Cùng phép tính trang /tasks từng chạy trong tiến trình, qua JSON
    const ctx = await loadAuthorizationContext(users.owner.id);
    const { tasks } = await taskQueryService.queryTasks(ctx, { all: true, parentTaskId: "root", view: "related" });
    const expected = tasks.map((task) => ({ ...task, availableActions: computeAvailableActions(ctx, buildTaskResource(task)) }));
    assert.deepEqual(nonJsonValues(expected), []);
    assert.deepEqual(body.tasks, JSON.parse(JSON.stringify(expected)));
  });

  test("tasks: góc nhìn sai trả 400", async () => {
    const response = await getTasksPageData(request("/api/page-data/tasks?view=everything", "owner"));
    assert.equal(response.status, 400);
  });

  test("tasks/[id]: nhiệm vụ đọc được trả dữ liệu vẽ trang, không có Date", async () => {
    captured.length = 0;
    const response = await getTaskDetailPageData(request(`/api/page-data/tasks/${parentTaskId}`, "owner"), params(parentTaskId));
    assert.equal(response.status, 200);
    const body = TaskDetailPageDataSchema.parse(await response.json());
    assert.equal(body.outcome, "render");
    if (body.outcome !== "render") return;
    assert.equal(body.task.id, parentTaskId);
    assert.equal(typeof body.canEdit, "boolean");
    assert.ok(Array.isArray(body.auditEvents));
    assert.equal(body.currentUser.id, users.owner.id);
    assert.equal(body.currentUser.name, users.owner.name);
    assert.deepEqual(unexpectedNonJson(captured[0]), []);
  });

  test("tasks/[id]: việc con chuyển về trang nhiệm vụ gốc", async () => {
    const response = await getTaskDetailPageData(request(`/api/page-data/tasks/${childTaskId}`, "owner"), params(childTaskId));
    assert.equal(response.status, 200);
    const body = TaskDetailPageDataSchema.parse(await response.json());
    assert.equal(body.outcome, "redirect");
    if (body.outcome === "redirect") assert.ok(body.redirectTo.startsWith(`/tasks/${parentTaskId}`), body.redirectTo);
  });

  test("tasks/[id]: người không liên quan và id không có đều nhận 404", async () => {
    const outsider = await getTaskDetailPageData(request(`/api/page-data/tasks/${parentTaskId}`, "outsider"), params(parentTaskId));
    assert.equal(outsider.status, 404);
    const missing = await getTaskDetailPageData(request(`/api/page-data/tasks/missing_${runId}`, "owner"), params(`missing_${runId}`));
    assert.equal(missing.status, 404);
  });

  test("meetings/[id]: người tổ chức đọc được; người ngoài và id không có nhận 404", async () => {
    captured.length = 0;
    const response = await getMeetingPageData(request(`/api/page-data/meetings/${meetingId}`, "owner"), params(meetingId));
    assert.equal(response.status, 200);
    const body = MeetingDetailPageDataSchema.parse(await response.json());
    assert.equal(body.meeting.id, meetingId);
    assert.deepEqual(body.currentUser, { id: users.owner.id, name: users.owner.name, role: "CHUYEN_VIEN" });
    assert.deepEqual(nonJsonValues(captured[0]), []);

    const outsider = await getMeetingPageData(request(`/api/page-data/meetings/${meetingId}`, "outsider"), params(meetingId));
    assert.equal(outsider.status, 404);
    const missing = await getMeetingPageData(request(`/api/page-data/meetings/missing_${runId}`, "owner"), params(`missing_${runId}`));
    assert.equal(missing.status, 404);
  });

  test("dossiers/[id]: người phụ trách đọc được; người ngoài bị chặn, id không có nhận 404", async () => {
    captured.length = 0;
    const response = await getDossierPageData(request(`/api/page-data/dossiers/${dossierId}`, "owner"), params(dossierId));
    assert.equal(response.status, 200);
    const body = DossierDetailPageDataSchema.parse(await response.json());
    assert.equal(body.dossier.id, dossierId);
    assert.equal(body.dossier.itemCount, 1);
    assert.equal(body.dossier.items[0].title, "Tờ trình");
    assert.deepEqual(nonJsonValues(captured[0]), []);

    const outsider = await getDossierPageData(request(`/api/page-data/dossiers/${dossierId}`, "outsider"), params(dossierId));
    assert.ok([403, 404].includes(outsider.status), `người ngoài nhận ${outsider.status}`);
    const missing = await getDossierPageData(request(`/api/page-data/dossiers/missing_${runId}`, "owner"), params(`missing_${runId}`));
    assert.equal(missing.status, 404);
  });
});
