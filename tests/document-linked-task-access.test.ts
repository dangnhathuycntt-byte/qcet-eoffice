import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import {
  DocumentSecurityLevel,
  DocumentStatus,
  DocumentType,
  DocumentUrgency,
  TaskActorRole,
  TaskPriority,
  TaskScope,
  TaskStatus,
  UnitStatus,
  UnitType,
  UserRole,
} from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { signSessionToken } from "../src/lib/jwt-session";
import { GET as getDocument, PATCH as patchDocument } from "../src/app/api/documents/[id]/route";
import { GET as getAuditLogs } from "../src/app/api/documents/[id]/audit-logs/route";
import { GET as getFile } from "../src/app/api/files/[...path]/route";
import { toLinkedTaskConflict } from "../src/lib/documents/linked-task-link";

/**
 * Kiểm thử tích hợp (DB test `qcet_test` do runner đặt): quyền đọc văn bản qua nhiệm vụ liên kết (D17)
 * và kiểm tra quyền + nhật ký khi gắn/gỡ `linkedTaskId` (S-1).
 */
describe("Văn bản và nhiệm vụ liên kết: quyền đọc, tệp, nhật ký, gắn/gỡ liên kết", { concurrency: 1 }, () => {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), "qcet-linked-access-"));
  const previousUploadsDir = process.env.UPLOADS_DIR;
  const fileRel = `documents/2026/linked-${stamp}.pdf`;

  const unitIds: Record<"doc" | "task" | "other", string> = { doc: "", task: "", other: "" };
  const users = {} as Record<string, { id: string; token: string }>;
  const createdUserIds: string[] = [];
  const createdAssignmentIds: string[] = [];
  const createdTaskIds: string[] = [];
  const createdDocIds: string[] = [];
  let docId = "";
  let secondDocId = "";
  let taskOtherUnit = "";
  let taskOwnUnit = "";

  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const get = (url: string, token: string) => new NextRequest(`http://localhost:3000${url}`, { headers: auth(token) });
  const patch = (id: string, token: string, body: unknown) =>
    new NextRequest(`http://localhost:3000/api/documents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...auth(token) },
      body: JSON.stringify(body),
    });
  const fileCtx = { params: Promise.resolve({ path: fileRel.split("/") }) };
  const linkEvents = (id: string) =>
    prisma.auditEvent.findMany({
      where: { entityType: "Document", entityId: id, action: "DOCUMENT_LINKED_TASK_CHANGED" },
      orderBy: { createdAt: "asc" },
    });

  type Assignment = {
    unitId: string;
    type?: "PRIMARY" | "CONCURRENT" | "ACTING";
    status?: "ACTIVE" | "ON_LEAVE" | "TERMINATED" | "SUPERSEDED";
    effectiveFrom?: Date;
    effectiveTo?: Date | null;
  };

  async function makeUser(key: string, unitId: string | Assignment[]) {
    const user = await prisma.user.create({
      data: { email: `${key}_${stamp}@qcet.edu.vn`, name: `Kiểm thử ${key}`, role: UserRole.CHUYEN_VIEN },
    });
    createdUserIds.push(user.id);
    const def = await prisma.positionDefinition.upsert({
      where: { code: "CHUYEN_VIEN" },
      update: {},
      create: { code: "CHUYEN_VIEN", title: "Chuyên viên", group: "VCDC" },
    });
    const list: Assignment[] = typeof unitId === "string" ? [{ unitId }] : unitId;
    for (const a of list) {
      const assignment = await prisma.positionAssignment.create({
        data: {
          userId: user.id,
          positionDefinitionId: def.id,
          unitId: a.unitId,
          type: a.type ?? "PRIMARY",
          status: a.status ?? "ACTIVE",
          ...(a.effectiveFrom ? { effectiveFrom: a.effectiveFrom } : {}),
          ...(a.effectiveTo !== undefined ? { effectiveTo: a.effectiveTo } : {}),
        },
      });
      createdAssignmentIds.push(assignment.id);
    }
    users[key] = {
      id: user.id,
      token: signSessionToken({ id: user.id, email: user.email, name: user.name, role: user.role }),
    };
  }

  async function makeTask(createdById: string, leadUnitId: string, scope: TaskScope, actorId?: string) {
    const task = await prisma.task.create({
      data: {
        code: `NV-LT-${stamp}-${createdTaskIds.length}`,
        title: `Nhiệm vụ kiểm thử liên kết ${stamp}-${createdTaskIds.length}`,
        priority: TaskPriority.HIGH,
        scope,
        createdById,
        leadUnitId,
        dueDate: new Date(Date.now() + 7 * 86400000),
        academicMonth: 9,
        academicYear: "2026-2027",
        status: TaskStatus.IN_PROGRESS,
        progressPercent: 0,
        version: 1,
        ...(actorId
          ? { actors: { create: [{ userId: actorId, role: TaskActorRole.DRI, isPrimaryDRI: true, appointedAt: new Date() }] } }
          : {}),
      },
    });
    createdTaskIds.push(task.id);
    return task;
  }

  async function makeDocument(registeredById: string, leadUnitId: string, withFile = false, notes?: string, withWorkflow = true) {
    const doc = await prisma.document.create({
      data: {
        registrationNumber: Math.floor(Math.random() * 900000) + 100000,
        originalNumber: `LT-${stamp}-${createdDocIds.length}`,
        issuedDate: new Date(),
        issuingAuthority: "Sở GD&ĐT",
        category: "CONG_VAN",
        summary: `Văn bản kiểm thử liên kết nhiệm vụ ${stamp}-${createdDocIds.length}`,
        type: DocumentType.VAN_BAN_DEN,
        documentYear: 2026,
        registeredDate: new Date(),
        securityLevel: DocumentSecurityLevel.THUONG,
        urgency: DocumentUrgency.THUONG,
        status: DocumentStatus.CHO_PHAN_CONG,
        registeredById,
        ...(notes ? { notes } : {}),
        ...(withWorkflow ? { incomingWorkflow: { create: { leadUnitId } } } : {}),
        ...(withFile
          ? { attachments: { create: [{ fileName: "kiem-thu.pdf", fileUrl: fileRel, fileSize: 40, mimeType: "application/pdf" }] } }
          : {}),
      },
    });
    createdDocIds.push(doc.id);
    return doc;
  }

  before(async () => {
    process.env.UPLOADS_DIR = uploadsDir;
    fs.mkdirSync(path.join(uploadsDir, "documents/2026"), { recursive: true });
    fs.writeFileSync(path.join(uploadsDir, fileRel), "%PDF-1.4 QCET linked task access test");

    for (const key of ["doc", "task", "other"] as const) {
      const id = `unit_lt_${key}_${stamp}`;
      await prisma.organizationalUnit.create({
        data: { id, code: id, name: `Đơn vị kiểm thử ${key}`, type: UnitType.DEPARTMENT, status: UnitStatus.ACTIVE },
      });
      unitIds[key] = id;
    }
    await makeUser("registrar", unitIds.doc);
    await makeUser("memberDoc", unitIds.doc);
    await makeUser("memberTask", unitIds.task);
    await makeUser("memberOther", unitIds.other);

    // Văn bản do `registrar` vào sổ, đơn vị chủ trì = đơn vị "doc"
    docId = (await makeDocument(users.registrar.id, unitIds.doc, true)).id;
    secondDocId = (await makeDocument(users.registrar.id, unitIds.doc)).id;

    // Nhiệm vụ phạm vi SCHOOL do memberOther tạo và là người phụ trách, đơn vị chủ trì = "task"
    taskOtherUnit = (await makeTask(users.memberOther.id, unitIds.task, TaskScope.SCHOOL, users.memberOther.id)).id;
    // Nhiệm vụ của chính đơn vị "doc", do registrar tạo
    taskOwnUnit = (await makeTask(users.registrar.id, unitIds.doc, TaskScope.DEPARTMENT, users.registrar.id)).id;
  });

  after(async () => {
    if (previousUploadsDir === undefined) delete process.env.UPLOADS_DIR;
    else process.env.UPLOADS_DIR = previousUploadsDir;
    fs.rmSync(uploadsDir, { recursive: true, force: true });

    if (createdDocIds.length > 0) {
      await prisma.auditEvent.deleteMany({ where: { entityType: "Document", entityId: { in: createdDocIds } } }).catch(() => undefined);
      await prisma.document.updateMany({ where: { id: { in: createdDocIds } }, data: { linkedTaskId: null } });
      await prisma.documentAttachment.deleteMany({ where: { documentId: { in: createdDocIds } } });
      await prisma.documentIncomingWorkflow.deleteMany({ where: { documentId: { in: createdDocIds } } });
      await prisma.document.deleteMany({ where: { id: { in: createdDocIds } } });
    }
    if (createdTaskIds.length > 0) {
      await prisma.taskActor.deleteMany({ where: { taskId: { in: createdTaskIds } } });
      await prisma.task.deleteMany({ where: { id: { in: createdTaskIds } } });
    }
    await prisma.positionAssignment.deleteMany({ where: { id: { in: createdAssignmentIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.organizationalUnit.deleteMany({ where: { id: { in: Object.values(unitIds).filter(Boolean) } } });
  });

  describe("quyền đọc (6): văn bản, nhật ký, tệp", () => {
    test("đơn vị chủ trì văn bản đọc được; đơn vị khác chưa liên quan thì bị 403 ở cả ba nơi", async () => {
      assert.equal((await getDocument(get(`/api/documents/${docId}`, users.memberDoc.token), ctx(docId))).status, 200);
      for (const member of [users.memberTask, users.memberOther]) {
        assert.equal((await getDocument(get(`/api/documents/${docId}`, member.token), ctx(docId))).status, 403);
        assert.equal((await getAuditLogs(get(`/api/documents/${docId}/audit-logs`, member.token), ctx(docId))).status, 403);
        assert.equal((await getFile(get(`/api/files/${fileRel}`, member.token), fileCtx)).status, 403);
      }
    });

    test("nhiệm vụ SCHOOL do người khác đơn vị tạo/phụ trách KHÔNG cấp quyền đọc văn bản, nhật ký, tệp", async () => {
      await prisma.document.update({ where: { id: docId }, data: { linkedTaskId: taskOtherUnit } });
      // memberOther vừa là người tạo vừa là người phụ trách nhiệm vụ SCHOOL, nhưng không thuộc đơn vị chủ trì
      const member = users.memberOther;
      assert.equal((await getDocument(get(`/api/documents/${docId}`, member.token), ctx(docId))).status, 403);
      assert.equal((await getAuditLogs(get(`/api/documents/${docId}/audit-logs`, member.token), ctx(docId))).status, 403);
      assert.equal((await getFile(get(`/api/files/${fileRel}`, member.token), fileCtx)).status, 403);
    });

    test("thành viên đơn vị chủ trì của nhiệm vụ liên kết đọc được văn bản, nhật ký, tệp; gỡ liên kết thì mất quyền", async () => {
      const member = users.memberTask;
      assert.equal((await getDocument(get(`/api/documents/${docId}`, member.token), ctx(docId))).status, 200);
      assert.equal((await getAuditLogs(get(`/api/documents/${docId}/audit-logs`, member.token), ctx(docId))).status, 200);
      assert.equal((await getFile(get(`/api/files/${fileRel}`, member.token), fileCtx)).status, 200);

      await prisma.document.update({ where: { id: docId }, data: { linkedTaskId: null } });
      assert.equal((await getDocument(get(`/api/documents/${docId}`, member.token), ctx(docId))).status, 403);
      assert.equal((await getAuditLogs(get(`/api/documents/${docId}/audit-logs`, member.token), ctx(docId))).status, 403);
      assert.equal((await getFile(get(`/api/files/${fileRel}`, member.token), fileCtx)).status, 403);
    });
  });

  describe("S-1: kiểm quyền và nhật ký khi gắn/gỡ nhiệm vụ liên kết", () => {
    test("không gắn được nhiệm vụ mà người thao tác không đọc được (403), văn bản và nhật ký không đổi", async () => {
      const res = await patchDocument(patch(docId, users.registrar.token, { linkedTaskId: taskOtherUnit }), ctx(docId));
      assert.equal(res.status, 403);
      const body = await res.json();
      assert.equal(body.error?.code ?? body.code, "LINKED_TASK_FORBIDDEN");
      assert.equal((await prisma.document.findUnique({ where: { id: docId } }))?.linkedTaskId, null);
      assert.equal((await linkEvents(docId)).length, 0);
    });

    test("nhiệm vụ không tồn tại -> 404", async () => {
      const res = await patchDocument(patch(docId, users.registrar.token, { linkedTaskId: "khong-ton-tai" }), ctx(docId));
      assert.equal(res.status, 404);
    });

    test("gắn nhiệm vụ đọc được -> 200 và ghi nhật ký (người thao tác, trước/sau, phạm vi và đơn vị nhiệm vụ)", async () => {
      const res = await patchDocument(patch(docId, users.registrar.token, { linkedTaskId: taskOwnUnit }), ctx(docId));
      assert.equal(res.status, 200);
      assert.equal((await prisma.document.findUnique({ where: { id: docId } }))?.linkedTaskId, taskOwnUnit);
      const events = await linkEvents(docId);
      assert.equal(events.length, 1);
      assert.equal(events[0].actorId, users.registrar.id);
      assert.deepEqual(events[0].beforeData, { linkedTaskId: null });
      assert.deepEqual(events[0].afterData, { linkedTaskId: taskOwnUnit });
      assert.deepEqual(events[0].metadata, { taskScope: "DEPARTMENT", taskLeadUnitId: unitIds.doc });
    });

    test("gửi lại cùng giá trị không tạo thêm nhật ký", async () => {
      const res = await patchDocument(patch(docId, users.registrar.token, { linkedTaskId: taskOwnUnit }), ctx(docId));
      assert.equal(res.status, 200);
      assert.equal((await linkEvents(docId)).length, 1);
    });

    test("nhiệm vụ đã gắn với văn bản khác -> 409", async () => {
      const res = await patchDocument(patch(secondDocId, users.registrar.token, { linkedTaskId: taskOwnUnit }), ctx(secondDocId));
      assert.equal(res.status, 409);
      assert.equal((await linkEvents(secondDocId)).length, 0);
    });

    test("gỡ liên kết -> 200 và ghi nhật ký", async () => {
      const res = await patchDocument(patch(docId, users.registrar.token, { linkedTaskId: null }), ctx(docId));
      assert.equal(res.status, 200);
      assert.equal((await prisma.document.findUnique({ where: { id: docId } }))?.linkedTaskId, null);
      const events = await linkEvents(docId);
      assert.equal(events.length, 2);
      assert.deepEqual(events[1].beforeData, { linkedTaskId: taskOwnUnit });
      assert.deepEqual(events[1].afterData, { linkedTaskId: null });
    });

    test("người không có quyền sửa văn bản không đổi được liên kết", async () => {
      const res = await patchDocument(patch(docId, users.memberOther.token, { linkedTaskId: taskOtherUnit }), ctx(docId));
      assert.ok([403, 404].includes(res.status), `status ${res.status}`);
      assert.equal((await prisma.document.findUnique({ where: { id: docId } }))?.linkedTaskId, null);
    });
  });
  describe("hồi quy từ review Codex: tranh chấp đồng thời và đơn vị kiêm nhiệm", () => {
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    test("hai PATCH gắn/gỡ đồng thời: chuỗi nhật ký liền mạch và trạng thái cuối khớp nhật ký", async () => {
      for (let i = 0; i < 10; i++) {
        const doc = await makeDocument(users.registrar.id, unitIds.doc);
        const results = await Promise.all([
          patchDocument(patch(doc.id, users.registrar.token, { linkedTaskId: taskOwnUnit }), ctx(doc.id)),
          patchDocument(patch(doc.id, users.registrar.token, { linkedTaskId: null }), ctx(doc.id)),
        ]);
        assert.deepEqual(results.map((r) => r.status), [200, 200], `vòng ${i}`);
        const events = await linkEvents(doc.id);
        assert.ok(events.length >= 1 && events.length <= 2, `vòng ${i}: ${events.length} nhật ký`);
        let previous: unknown = null;
        for (const event of events) {
          assert.deepEqual((event.beforeData as any).linkedTaskId, previous, `vòng ${i}: before phải bằng after trước đó`);
          previous = (event.afterData as any).linkedTaskId;
        }
        const final = (await prisma.document.findUnique({ where: { id: doc.id } }))?.linkedTaskId ?? null;
        assert.equal(final, previous, `vòng ${i}: trạng thái cuối phải khớp nhật ký`);
        await prisma.document.update({ where: { id: doc.id }, data: { linkedTaskId: null } });
      }
    });

    test("hai văn bản tranh cùng một nhiệm vụ: một thành công, một 409, đúng một nhật ký", async () => {
      const [a, b] = [await makeDocument(users.registrar.id, unitIds.doc), await makeDocument(users.registrar.id, unitIds.doc)];
      const statuses = (
        await Promise.all([
          patchDocument(patch(a.id, users.registrar.token, { linkedTaskId: taskOwnUnit }), ctx(a.id)),
          patchDocument(patch(b.id, users.registrar.token, { linkedTaskId: taskOwnUnit }), ctx(b.id)),
        ])
      )
        .map((r) => r.status)
        .sort();
      assert.deepEqual(statuses, [200, 409]);
      assert.equal((await linkEvents(a.id)).length + (await linkEvents(b.id)).length, 1);
      await prisma.document.updateMany({ where: { id: { in: [a.id, b.id] } }, data: { linkedTaskId: null } });
    });

    test("không bế tắc với tác vụ khóa workflow trước rồi mới ghi văn bản (như assignUnitWork)", async () => {
      const doc = await makeDocument(users.registrar.id, unitIds.doc);
      const workflowFirst = prisma.$transaction(async (tx) => {
        await tx.documentIncomingWorkflow.update({ where: { documentId: doc.id }, data: { presenterNotes: "giữ khóa workflow" } });
        await sleep(300);
        await tx.document.update({ where: { id: doc.id }, data: { notes: "ghi sau khi giữ workflow" } });
      });
      await sleep(80);
      const res = await patchDocument(
        patch(doc.id, users.registrar.token, { linkedTaskId: taskOwnUnit, leadUnitId: unitIds.doc }),
        ctx(doc.id)
      );
      await workflowFirst;
      assert.equal(res.status, 200);
      await prisma.document.update({ where: { id: doc.id }, data: { linkedTaskId: null } });
    });

    test("đơn vị kiêm nhiệm (CONCURRENT, còn hiệu lực) trùng đơn vị chủ trì nhiệm vụ đọc được ở cả ba nơi", async () => {
      await makeUser("multi", [{ unitId: unitIds.other }, { unitId: unitIds.task, type: "CONCURRENT" }]);
      await prisma.document.update({ where: { id: docId }, data: { linkedTaskId: taskOtherUnit } });
      const t = users.multi.token;
      assert.equal((await getDocument(get(`/api/documents/${docId}`, t), ctx(docId))).status, 200);
      assert.equal((await getAuditLogs(get(`/api/documents/${docId}/audit-logs`, t), ctx(docId))).status, 200);
      assert.equal((await getFile(get(`/api/files/${fileRel}`, t), fileCtx)).status, 200);
    });

    test("phân công kiêm nhiệm không đủ điều kiện (hết hạn, chưa hiệu lực, không ACTIVE) không cấp quyền", async () => {
      const day = 86400000;
      const cases: Array<[string, Assignment]> = [
        ["hetHan", { unitId: unitIds.task, type: "CONCURRENT", effectiveFrom: new Date(Date.now() - 30 * day), effectiveTo: new Date(Date.now() - day) }],
        ["chuaHieuLuc", { unitId: unitIds.task, type: "CONCURRENT", effectiveFrom: new Date(Date.now() + day) }],
        ["nghiPhep", { unitId: unitIds.task, type: "CONCURRENT", status: "ON_LEAVE" }],
        ["daKetThuc", { unitId: unitIds.task, type: "CONCURRENT", status: "TERMINATED" }],
      ];
      for (const [key, assignment] of cases) {
        await makeUser(`multi_${key}`, [{ unitId: unitIds.other }, assignment]);
        const t = users[`multi_${key}`].token;
        assert.equal((await getDocument(get(`/api/documents/${docId}`, t), ctx(docId))).status, 403, key);
        assert.equal((await getAuditLogs(get(`/api/documents/${docId}/audit-logs`, t), ctx(docId))).status, 403, key);
        assert.equal((await getFile(get(`/api/files/${fileRel}`, t), fileCtx)).status, 403, key);
      }
    });

    test("đơn vị kiêm nhiệm không mở được văn bản giới hạn dù trùng đơn vị chủ trì nhiệm vụ", async () => {
      const restricted = await makeDocument(users.registrar.id, unitIds.doc, false, "RESTRICTED");
      await prisma.document.update({ where: { id: restricted.id }, data: { linkedTaskId: null } });
      await prisma.document.update({ where: { id: docId }, data: { linkedTaskId: null } });
      await prisma.document.update({ where: { id: restricted.id }, data: { linkedTaskId: taskOtherUnit } });
      const t = users.multi.token;
      assert.equal((await getDocument(get(`/api/documents/${restricted.id}`, t), ctx(restricted.id))).status, 403);
      assert.equal((await getAuditLogs(get(`/api/documents/${restricted.id}/audit-logs`, t), ctx(restricted.id))).status, 403);
      await prisma.document.update({ where: { id: restricted.id }, data: { linkedTaskId: null } });
    });
    test("văn thư chỉ có vai trò (chưa có phân công chức danh) vẫn tải được tệp văn bản nội bộ như trước", async () => {
      const user = await prisma.user.create({
        data: { email: `clerk_role_only_${stamp}@qcet.edu.vn`, name: "Văn thư chỉ có vai trò", role: UserRole.VAN_THU },
      });
      createdUserIds.push(user.id);
      const token = signSessionToken({ id: user.id, email: user.email, name: user.name, role: user.role });
      assert.equal((await getFile(get(`/api/files/${fileRel}`, token), fileCtx)).status, 200);
    });

    test("phân công kiêm nhiệm hết hạn giữa hai lần tải: lần sau bị 403 (không dùng ngữ cảnh cache)", async () => {
      await prisma.document.update({ where: { id: docId }, data: { linkedTaskId: taskOtherUnit } });
      await makeUser("expiring", [
        { unitId: unitIds.other },
        { unitId: unitIds.task, type: "CONCURRENT", effectiveFrom: new Date(Date.now() - 60000), effectiveTo: new Date(Date.now() + 1500) },
      ]);
      const t = users.expiring.token;
      assert.equal((await getFile(get(`/api/files/${fileRel}`, t), fileCtx)).status, 200);
      await sleep(2000);
      assert.equal((await getFile(get(`/api/files/${fileRel}`, t), fileCtx)).status, 403);
      await prisma.document.update({ where: { id: docId }, data: { linkedTaskId: null } });
    });

    test("PATCH chờ khóa: văn bản trở thành bất biến trong lúc chờ thì bị từ chối, liên kết không đổi", async () => {
      const doc = await makeDocument(users.registrar.id, unitIds.doc);
      const holder = prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM documents WHERE id = ${doc.id} FOR UPDATE`;
        await sleep(600);
        await tx.document.update({ where: { id: doc.id }, data: { status: DocumentStatus.DA_HOAN_THANH } });
      });
      await sleep(150);
      const res = await patchDocument(patch(doc.id, users.registrar.token, { linkedTaskId: taskOwnUnit }), ctx(doc.id));
      await holder;
      assert.equal(res.status, 400);
      assert.equal((await prisma.document.findUnique({ where: { id: doc.id } }))?.linkedTaskId, null);
      assert.equal((await linkEvents(doc.id)).length, 0);
    });

    test("văn bản không có workflow đến vẫn gắn/gỡ liên kết được", async () => {
      const doc = await makeDocument(users.registrar.id, unitIds.doc, false, undefined, false);
      assert.equal((await patchDocument(patch(doc.id, users.registrar.token, { linkedTaskId: taskOwnUnit }), ctx(doc.id))).status, 200);
      assert.equal((await patchDocument(patch(doc.id, users.registrar.token, { linkedTaskId: null }), ctx(doc.id))).status, 200);
      assert.equal((await linkEvents(doc.id)).length, 2);
    });

    test("lỗi ràng buộc DB được chuyển thành 409 (UNIQUE) và 404 (nhiệm vụ bị xóa)", () => {
      const unique = toLinkedTaskConflict({ code: "P2002", meta: { target: ["linked_task_id"] } }) as any;
      const missing = toLinkedTaskConflict({ code: "P2003", meta: { field_name: "documents_linked_task_id_fkey (index)" } }) as any;
      const other = new Error("khác");
      assert.equal(unique.statusCode, 409);
      assert.equal(missing.statusCode, 404);
      assert.equal(toLinkedTaskConflict(other), other);
    });
    test("phân công chính hết hạn/chưa hiệu lực không cấp quyền đọc theo đơn vị chủ trì văn bản", async () => {
      const day = 86400000;
      const cases: Array<[string, Assignment]> = [
        ["chinhHetHan", { unitId: unitIds.doc, effectiveFrom: new Date(Date.now() - 30 * day), effectiveTo: new Date(Date.now() - day) }],
        ["chinhChuaHieuLuc", { unitId: unitIds.doc, effectiveFrom: new Date(Date.now() + day) }],
      ];
      for (const [key, assignment] of cases) {
        await makeUser(key, [assignment]);
        const t = users[key].token;
        assert.equal((await getFile(get(`/api/files/${fileRel}`, t), fileCtx)).status, 403, key);
        assert.equal((await getDocument(get(`/api/documents/${docId}`, t), ctx(docId))).status, 403, key);
      }
      // đối chứng: phân công chính còn hiệu lực cùng đơn vị đọc được
      assert.equal((await getFile(get(`/api/files/${fileRel}`, users.memberDoc.token), fileCtx)).status, 200);
    });
  });
});
