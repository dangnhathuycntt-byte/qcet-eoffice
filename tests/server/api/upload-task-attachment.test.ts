/**
 * Test đặc tả (characterization) mức route cho POST /api/upload kèm taskId: người đọc được nhiệm vụ tải lên
 * và tệp gắn đúng nhiệm vụ (metadata.taskId), người không có quyền / nhiệm vụ không tồn tại / quản trị hệ thống
 * bị từ chối mà không lưu tệp, taskId rỗng coi như không gắn nhiệm vụ.
 * Luồng tải lên không kèm nhiệm vụ (dedupe, 413, nội dung giả đuôi) nằm ở tests/server/api/file-routes.test.ts.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { JobCatalogGroup, TaskActorRole, TaskPriority, TaskScope, TaskStatus, UnitType, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { signSessionToken } from "@/lib/jwt-session";
import { POST as upload } from "@/app/api/upload/route";
import { GET as getFileObject } from "@/app/api/file-objects/[id]/route";

type Role = "dri" | "outsider" | "member" | "leader" | "admin";

const DAY = 24 * 3600 * 1000;

describe("POST /api/upload kèm taskId", () => {
  const runId = `${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
  const tag = runId.replace(/[^0-9a-z]/gi, "").slice(-12);
  const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), "qcet-upload-task-"));
  const previousUploadsDir = process.env.UPLOADS_DIR;

  const users = {} as Record<Role, { id: string; token: string }>;
  let unitId = "";
  let taskId = "";
  /** Nhiệm vụ do chính quản trị hệ thống tạo và làm người thực hiện: 403 chỉ có thể đến từ nhánh chặn SYSTEM_ADMIN. */
  let adminTaskId = "";
  const positionDefinitionIds: string[] = [];
  const contentHashes: string[] = [];

  /** Nội dung riêng cho từng ca (kèm runId) để không trùng tệp CLEAN nào khác và không bị dedupe. */
  function makeBytes(label: string) {
    const bytes = Buffer.from(`QCET upload-task ${label} ${runId}\n`, "utf8");
    const hash = crypto.createHash("sha256").update(bytes).digest("hex");
    contentHashes.push(hash);
    return { bytes, hash };
  }

  function uploadReq(fields: { bytes?: Buffer; fileName?: string; taskId?: string }, role?: Role) {
    const form = new FormData();
    if (fields.bytes) {
      form.append("file", new File([new Uint8Array(fields.bytes)], fields.fileName ?? `tep-${tag}.txt`, { type: "text/plain" }));
    }
    if (fields.taskId !== undefined) form.append("taskId", fields.taskId);
    return new NextRequest("http://localhost:3000/api/upload", {
      method: "POST",
      headers: role ? { Authorization: `Bearer ${users[role].token}` } : {},
      body: form,
    });
  }

  function download(id: string, role: Role) {
    return getFileObject(
      new NextRequest(`http://localhost:3000/api/file-objects/${id}`, {
        headers: { Authorization: `Bearer ${users[role].token}` },
      }),
      { params: Promise.resolve({ id }) }
    );
  }

  async function assertRejectedWithoutStoring(res: Response, status: number, code: string, hash: string) {
    assert.equal(res.status, status);
    const body = await res.json();
    assert.equal(body.code, code);
    assert.equal(body.success, false);
    assert.equal(body.fileId, undefined);
    assert.equal(await prisma.fileObject.count({ where: { contentHash: hash } }), 0, "không tạo FileObject");
    const storageDir = path.join(uploadsDir, hash.slice(0, 2), hash.slice(2, 4));
    const written = fs.existsSync(storageDir) ? fs.readdirSync(storageDir).filter((name) => name.startsWith(hash)) : [];
    assert.deepEqual(written, [], "không ghi tệp lên đĩa");
  }

  before(async () => {
    process.env.UPLOADS_DIR = uploadsDir;

    unitId = (await prisma.organizationalUnit.create({
      data: { code: `UPT_${tag}`, name: `Don vi chu tri ${runId}`, type: UnitType.DEPARTMENT },
    })).id;

    const roles: Array<[Role, UserRole]> = [
      ["dri", UserRole.CHUYEN_VIEN],
      ["outsider", UserRole.CHUYEN_VIEN],
      ["member", UserRole.CHUYEN_VIEN],
      ["leader", UserRole.TRUONG_PHONG],
      ["admin", UserRole.ADMIN],
    ];
    for (const [role, userRole] of roles) {
      const user = await prisma.user.create({
        data: { email: `upt-${role}-${runId}@qcet.edu.vn`, name: `UPT ${role} ${runId}`, role: userRole },
      });
      users[role] = { id: user.id, token: signSessionToken({ id: user.id, email: user.email, name: user.name, role: user.role }) };
    }

    // Thành viên thường và trưởng đơn vị chủ trì: cùng đơn vị, khác ở chức danh lãnh đạo.
    for (const [role, isLeadership] of [["member", false], ["leader", true]] as const) {
      const definition = await prisma.positionDefinition.create({
        data: {
          code: `PD_UPT_${role.toUpperCase()}_${tag}`,
          title: `${role} ${runId}`,
          group: isLeadership ? JobCatalogGroup.LDPU : JobCatalogGroup.VCDC,
          isLeadership,
        },
      });
      positionDefinitionIds.push(definition.id);
      await prisma.positionAssignment.create({
        data: {
          userId: users[role].id,
          unitId,
          positionDefinitionId: definition.id,
          type: "PRIMARY",
          status: "ACTIVE",
          effectiveFrom: new Date(Date.now() - 30 * DAY),
        },
      });
    }

    taskId = (await prisma.task.create({
      data: {
        code: `UPT-${tag}`,
        title: `Nhiem vu tai tep ${runId}`,
        scope: TaskScope.DEPARTMENT,
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.NORMAL,
        academicMonth: 10,
        academicYear: "2026-2027",
        startDate: new Date(Date.now() - 2 * DAY),
        dueDate: new Date(Date.now() + 10 * DAY),
        // Người tạo là người thực hiện, để trưởng đơn vị chỉ đọc được nhiệm vụ qua quyền lãnh đạo đơn vị chủ trì.
        createdById: users.dri.id,
        leadUnitId: unitId,
        actors: { create: [{ userId: users.dri.id, role: TaskActorRole.DRI, isPrimaryDRI: true }] },
      },
    })).id;

    // Cùng quan hệ trực tiếp như người thực hiện ở nhiệm vụ trên (người tạo + DRI), chỉ khác vai trò ADMIN.
    adminTaskId = (await prisma.task.create({
      data: {
        code: `UPT-ADM-${tag}`,
        title: `Nhiem vu cua quan tri ${runId}`,
        scope: TaskScope.DEPARTMENT,
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.NORMAL,
        academicMonth: 10,
        academicYear: "2026-2027",
        startDate: new Date(Date.now() - 2 * DAY),
        dueDate: new Date(Date.now() + 10 * DAY),
        createdById: users.admin.id,
        leadUnitId: unitId,
        actors: { create: [{ userId: users.admin.id, role: TaskActorRole.DRI, isPrimaryDRI: true }] },
      },
    })).id;
  });

  after(async () => {
    if (previousUploadsDir === undefined) delete process.env.UPLOADS_DIR;
    else process.env.UPLOADS_DIR = previousUploadsDir;
    fs.rmSync(uploadsDir, { recursive: true, force: true });

    const userIds = Object.values(users).map((u) => u.id).filter(Boolean);
    try {
      if (contentHashes.length > 0) {
        // Chỉ xóa FileObject do chính user fixture tải lên với nội dung riêng của lần chạy này.
        await prisma.fileObject.deleteMany({
          where: { contentHash: { in: contentHashes }, uploadedById: { in: userIds } },
        });
      }
      const taskIds = [taskId, adminTaskId].filter(Boolean);
      if (taskIds.length > 0) {
        await prisma.taskActor.deleteMany({ where: { taskId: { in: taskIds } } });
        await prisma.task.deleteMany({ where: { id: { in: taskIds } } });
      }
      if (userIds.length > 0) {
        await prisma.auditEvent.deleteMany({ where: { actorId: { in: userIds } } });
        await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
        await prisma.positionAssignment.deleteMany({ where: { userId: { in: userIds } } });
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      }
      if (positionDefinitionIds.length > 0) {
        await prisma.positionDefinition.deleteMany({ where: { id: { in: positionDefinitionIds } } });
      }
      if (unitId) await prisma.organizationalUnit.deleteMany({ where: { id: unitId } });
    } catch (error) {
      console.error("Dọn fixture upload-task-attachment lỗi:", error);
    }
  });

  test("chưa đăng nhập: 401 AUTH_REQUIRED, không lưu tệp", async () => {
    const { bytes, hash } = makeBytes("unauthenticated");
    const res = await upload(uploadReq({ bytes, taskId }));
    await assertRejectedWithoutStoring(res, 401, "AUTH_REQUIRED", hash);
  });

  test("người thực hiện nhiệm vụ: 200, FileObject gắn metadata.taskId, tệp nằm trên đĩa, tải về qua quyền nhiệm vụ", async () => {
    const { bytes, hash } = makeBytes("dri");
    const fileName = `bao-cao-${tag}.txt`;
    const res = await upload(uploadReq({ bytes, fileName, taskId }, "dri"));
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /application\/json/);
    const body = await res.json();
    assert.match(body.fileId, /^[0-9a-f-]{36}$/i);
    assert.equal(body.fileUrl, `/api/file-objects/${body.fileId}`);
    assert.equal(body.fileName, fileName);
    assert.equal(body.fileSize, bytes.length);
    assert.equal(body.mimeType, "text/plain; charset=utf-8");
    assert.equal(body.contentHash, hash);
    assert.equal(body.scanStatus, "PENDING");
    assert.equal(body.deduplicated, false);

    const stored = await prisma.fileObject.findUniqueOrThrow({ where: { id: body.fileId } });
    assert.equal(stored.uploadedById, users.dri.id);
    assert.deepEqual(stored.metadata, { declaredMimeType: "text/plain", taskId });
    assert.ok(fs.readFileSync(path.join(uploadsDir, stored.storageKey)).equals(bytes), "tệp ghi dưới UPLOADS_DIR");

    // metadata.taskId cấp quyền tải: người thực hiện qua được kiểm quyền rồi mới vướng trạng thái quét (môi trường test để PENDING).
    const pending = await download(body.fileId, "dri");
    assert.equal(pending.status, 409);
    assert.equal((await pending.json()).code, "FILE_SCAN_PENDING");
    const denied = await download(body.fileId, "outsider");
    assert.equal(denied.status, 403);
    assert.equal((await denied.json()).code, "FORBIDDEN");
  });

  test("taskId có khoảng trắng hai đầu: được trim trước khi kiểm quyền và lưu", async () => {
    const { bytes } = makeBytes("trimmed");
    const res = await upload(uploadReq({ bytes, taskId: `  ${taskId}  ` }, "dri"));
    assert.equal(res.status, 200);
    const body = await res.json();
    const stored = await prisma.fileObject.findUniqueOrThrow({ where: { id: body.fileId } });
    assert.equal((stored.metadata as Record<string, unknown>).taskId, taskId);
  });

  test("trưởng đơn vị chủ trì (không phải người thực hiện): 200, tệp gắn nhiệm vụ", async () => {
    const { bytes } = makeBytes("leader");
    const res = await upload(uploadReq({ bytes, taskId }, "leader"));
    assert.equal(res.status, 200);
    const body = await res.json();
    const stored = await prisma.fileObject.findUniqueOrThrow({ where: { id: body.fileId } });
    assert.equal(stored.uploadedById, users.leader.id);
    assert.equal((stored.metadata as Record<string, unknown>).taskId, taskId);
  });

  test("thành viên thường của đơn vị chủ trì không tham gia nhiệm vụ: 403 FORBIDDEN, không lưu tệp", async () => {
    const { bytes, hash } = makeBytes("member");
    const res = await upload(uploadReq({ bytes, taskId }, "member"));
    await assertRejectedWithoutStoring(res, 403, "FORBIDDEN", hash);
  });

  test("người ngoài nhiệm vụ: 403 FORBIDDEN, không lưu tệp", async () => {
    const { bytes, hash } = makeBytes("outsider");
    const res = await upload(uploadReq({ bytes, taskId }, "outsider"));
    await assertRejectedWithoutStoring(res, 403, "FORBIDDEN", hash);
  });

  test("taskId không tồn tại: 403 FORBIDDEN như không có quyền (không lộ sự tồn tại), không lưu tệp", async () => {
    const { bytes, hash } = makeBytes("missing-task");
    const res = await upload(uploadReq({ bytes, taskId: `missing-${tag}` }, "dri"));
    await assertRejectedWithoutStoring(res, 403, "FORBIDDEN", hash);
  });

  test("quản trị hệ thống (ADMIN) là người tạo và người thực hiện nhiệm vụ: vẫn 403 FORBIDDEN (tách quyền), không lưu tệp", async () => {
    // Tiền điều kiện: quan hệ trực tiếp đủ để người dùng thường đọc được nhiệm vụ (như ca người thực hiện ở trên).
    const adminTask = await prisma.task.findUniqueOrThrow({
      where: { id: adminTaskId },
      select: { createdById: true, actors: { select: { userId: true, role: true } } },
    });
    assert.equal(adminTask.createdById, users.admin.id);
    assert.deepEqual(adminTask.actors, [{ userId: users.admin.id, role: TaskActorRole.DRI }]);

    const { bytes, hash } = makeBytes("admin");
    const res = await upload(uploadReq({ bytes, taskId: adminTaskId }, "admin"));
    await assertRejectedWithoutStoring(res, 403, "FORBIDDEN", hash);
  });

  test("taskId chỉ gồm khoảng trắng: coi như không gắn nhiệm vụ, 200 và metadata không có taskId", async () => {
    const { bytes } = makeBytes("blank-task");
    const res = await upload(uploadReq({ bytes, taskId: "   " }, "outsider"));
    assert.equal(res.status, 200);
    const body = await res.json();
    const stored = await prisma.fileObject.findUniqueOrThrow({ where: { id: body.fileId } });
    assert.equal(stored.uploadedById, users.outsider.id);
    assert.deepEqual(stored.metadata, { declaredMimeType: "text/plain" });
  });

  test("thiếu trường file: 400 VALIDATION_ERROR (trước là 500)", async () => {
    const res = await upload(uploadReq({ taskId }, "dri"));
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.code, "VALIDATION_ERROR");
    assert.equal(body.success, false);
  });

  test("tệp quá 10MB: 413 PAYLOAD_TOO_LARGE (trước là 500), không lưu tệp", async () => {
    const bytes = Buffer.alloc(10 * 1024 * 1024 + 1, 0x61);
    const hash = crypto.createHash("sha256").update(bytes).digest("hex");
    const res = await upload(uploadReq({ bytes, fileName: `qua-lon-${tag}.txt` }, "dri"));
    await assertRejectedWithoutStoring(res, 413, "PAYLOAD_TOO_LARGE", hash);
  });

  describe("dùng lại tệp trùng nội dung (dedupe)", () => {
    const { bytes, hash } = makeBytes("dedupe");
    let originalId = "";

    before(async () => {
      const res = await upload(uploadReq({ bytes, fileName: `goc-${tag}.txt`, taskId }, "dri"));
      assert.equal(res.status, 200);
      originalId = (await res.json()).fileId;
      // Môi trường test để tệp mới PENDING; chỉ bản CLEAN mới được dùng lại.
      await prisma.fileObject.update({ where: { id: originalId }, data: { scanStatus: "CLEAN" } });
    });

    test("cùng người, cùng nhiệm vụ: dùng lại đúng bản cũ", async () => {
      const res = await upload(uploadReq({ bytes, fileName: `goc-${tag}.txt`, taskId }, "dri"));
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.deduplicated, true);
      assert.equal(body.fileId, originalId);
    });

    test("người khác cùng nội dung: bản mới của chính họ, không lộ id và tên tệp của người kia", async () => {
      const fileName = `cua-toi-${tag}.txt`;
      const res = await upload(uploadReq({ bytes, fileName }, "outsider"));
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.deduplicated, false);
      assert.notEqual(body.fileId, originalId);
      assert.equal(body.fileName, fileName);
      const stored = await prisma.fileObject.findUniqueOrThrow({ where: { id: body.fileId } });
      assert.equal(stored.uploadedById, users.outsider.id);
      assert.equal(stored.contentHash, hash);
    });

    test("cùng người, không gắn nhiệm vụ: bản mới, không mang taskId của bản cũ", async () => {
      const res = await upload(uploadReq({ bytes, fileName: `goc-${tag}.txt` }, "dri"));
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.deduplicated, false);
      assert.notEqual(body.fileId, originalId);
      const stored = await prisma.fileObject.findUniqueOrThrow({ where: { id: body.fileId } });
      assert.deepEqual(stored.metadata, { declaredMimeType: "text/plain" });
    });
  });
});
