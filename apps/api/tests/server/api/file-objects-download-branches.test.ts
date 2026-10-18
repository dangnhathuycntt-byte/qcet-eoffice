/**
 * Test đặc tả (characterization) mức route cho GET /api/file-objects/[id] với tệp KHÔNG phải đính kèm văn bản:
 * sản phẩm nhiệm vụ (fileObjectId), tệp gắn nhiệm vụ qua metadata.taskId, tệp nhúng trong mô tả nhiệm vụ,
 * tài liệu cuộc họp, mục hồ sơ, tệp mồ côi; cùng các nhánh lỗi (401/400/404, tệp lưu trữ, thiếu trên đĩa,
 * lệch kích thước, nhiễm mã độc) và header của phản hồi tải tệp.
 * Phần đính kèm văn bản nằm ở tests/server/api/file-routes.test.ts; hồ sơ đã hủy ở tests/file-access-dossier-disposed.test.ts.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { FileScanStatus, TaskActorRole, TaskPriority, TaskScope, TaskStatus, UnitType, UserRole } from "@prisma/client";
import { prisma } from "@qcet/db/prisma";
import { signSessionToken } from "@/lib/jwt-session";
import { GET as getFileObject } from "@/app/api/file-objects/[id]/route";

type Role = "dri" | "outsider" | "dossierOwner" | "contributor" | "otherContributor" | "participant";
type FixtureFile = { id: string; bytes: Buffer; storageKey: string };

const DAY = 24 * 3600 * 1000;
const FILE_CACHE_CONTROL = "private, no-cache, no-store, must-revalidate";

describe("GET /api/file-objects/[id]: tệp ngoài đính kèm văn bản", () => {
  const runId = `${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
  const tag = runId.replace(/[^0-9a-z]/gi, "").slice(-12);
  const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), "qcet-file-object-branches-"));
  const previousUploadsDir = process.env.UPLOADS_DIR;

  const users = {} as Record<Role, { id: string; token: string }>;
  const files = {} as Record<
    | "deliverable"
    | "metadata"
    | "description"
    | "foreignDescription"
    | "dossier"
    | "meeting"
    | "orphan"
    | "archived"
    | "missingOnDisk"
    | "sizeMismatch"
    | "infected",
    FixtureFile
  >;
  let unitId = "";
  let taskId = "";
  let dossierId = "";
  let meetingId = "";

  async function createFile(
    key: keyof typeof files,
    options: {
      name: string;
      mimeType: string;
      uploadedBy: Role;
      writeToDisk?: boolean;
      byteSizeDelta?: number;
      scanStatus?: FileScanStatus;
      isArchived?: boolean;
      metadata?: Record<string, string>;
    }
  ) {
    const extension = path.extname(options.name);
    const bytes = Buffer.from(
      extension === ".pdf" ? `%PDF-1.4\n% QCET ${key} ${runId}\n%%EOF\n` : `QCET ${key} ${runId}\n`
    );
    const storageKey = `fo-${runId}/${key}${extension}`;
    if (options.writeToDisk !== false) {
      fs.mkdirSync(path.join(uploadsDir, `fo-${runId}`), { recursive: true });
      fs.writeFileSync(path.join(uploadsDir, storageKey), bytes);
    }
    const record = await prisma.fileObject.create({
      data: {
        storageKey,
        originalName: options.name,
        mimeType: options.mimeType,
        extension,
        byteSize: BigInt(bytes.length + (options.byteSizeDelta ?? 0)),
        contentHash: crypto.createHash("sha256").update(bytes).digest("hex"),
        scanStatus: options.scanStatus ?? FileScanStatus.CLEAN,
        isArchived: options.isArchived ?? false,
        uploadedById: users[options.uploadedBy].id,
        ...(options.metadata ? { metadata: options.metadata } : {}),
      },
    });
    files[key] = { id: record.id, bytes, storageKey };
    return record.id;
  }

  function download(id: string, role?: Role, headers: Record<string, string> = {}) {
    return getFileObject(
      new NextRequest(`http://localhost:3000/api/file-objects/${id}`, {
        headers: { ...(role ? { Authorization: `Bearer ${users[role].token}` } : {}), ...headers },
      }),
      { params: Promise.resolve({ id }) }
    );
  }

  async function assertDenied(res: Response, status: number, code: string, fixture?: FixtureFile) {
    assert.equal(res.status, status);
    assert.equal(res.headers.get("cache-control"), "private, no-store");
    assert.equal(res.headers.get("content-disposition"), null, "phản hồi lỗi không kèm tệp");
    const text = await res.text();
    const body = JSON.parse(text);
    assert.equal(body.code, code);
    assert.equal(body.success, false);
    if (fixture) assert.ok(!text.includes(fixture.bytes.toString()), "không lộ nội dung tệp");
  }

  async function assertDownloaded(res: Response, fixture: FixtureFile) {
    assert.equal(res.status, 200);
    const body = Buffer.from(await res.arrayBuffer());
    assert.ok(body.equals(fixture.bytes), "nội dung trả về đúng tệp trên đĩa");
  }

  before(async () => {
    process.env.UPLOADS_DIR = uploadsDir;

    unitId = (await prisma.organizationalUnit.create({
      data: { code: `FOB_${tag}`, name: `Don vi tep ${runId}`, type: UnitType.DEPARTMENT },
    })).id;

    for (const role of ["dri", "outsider", "dossierOwner", "contributor", "otherContributor", "participant"] as const) {
      const user = await prisma.user.create({
        data: { email: `fob-${role.toLowerCase()}-${runId}@qcet.edu.vn`, name: `FOB ${role} ${runId}`, role: UserRole.CHUYEN_VIEN },
      });
      users[role] = { id: user.id, token: signSessionToken({ id: user.id, email: user.email, name: user.name, role: user.role }) };
    }

    await createFile("deliverable", { name: "Báo cáo tiến độ.pdf", mimeType: "application/pdf", uploadedBy: "dri" });
    // DB ghi "text/plain" (không charset) khác giá trị suy từ đuôi .txt, để thấy route dùng mimeType đã kiểm kê.
    await createFile("metadata", { name: "ke-hoach.txt", mimeType: "text/plain", uploadedBy: "dri" });
    await createFile("description", { name: "hinh-mo-ta.pdf", mimeType: "application/pdf", uploadedBy: "dri" });
    // Tệp của người khác bị dán UUID vào mô tả nhiệm vụ do dri tạo.
    await createFile("foreignDescription", { name: "tep-nguoi-khac.pdf", mimeType: "application/pdf", uploadedBy: "outsider" });
    await createFile("dossier", { name: "bien-ban.pdf", mimeType: "application/pdf", uploadedBy: "contributor" });
    await createFile("meeting", { name: "tai-lieu-hop.pdf", mimeType: "application/pdf", uploadedBy: "dossierOwner" });
    await createFile("orphan", { name: "mo-coi.pdf", mimeType: "application/pdf", uploadedBy: "outsider" });
    await createFile("archived", { name: "da-luu.pdf", mimeType: "application/pdf", uploadedBy: "dri", isArchived: true });
    await createFile("missingOnDisk", { name: "mat-tep.pdf", mimeType: "application/pdf", uploadedBy: "dri", writeToDisk: false });
    await createFile("sizeMismatch", { name: "lech-co.pdf", mimeType: "application/pdf", uploadedBy: "dri", byteSizeDelta: 5 });
    await createFile("infected", { name: "nhiem.pdf", mimeType: "application/pdf", uploadedBy: "dri", scanStatus: FileScanStatus.INFECTED });

    const task = await prisma.task.create({
      data: {
        code: `FOB-${tag}`,
        title: `Nhiem vu tep ${runId}`,
        description: `Xem hình minh họa: /api/file-objects/${files.description.id} và /api/file-objects/${files.foreignDescription.id}`,
        scope: TaskScope.DEPARTMENT,
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.NORMAL,
        academicMonth: 10,
        academicYear: "2026-2027",
        startDate: new Date(Date.now() - 2 * DAY),
        dueDate: new Date(Date.now() + 7 * DAY),
        createdById: users.dri.id,
        leadUnitId: unitId,
        actors: {
          create: [
            { userId: users.dri.id, role: TaskActorRole.DRI, isPrimaryDRI: true },
            // Người phối hợp đọc được nhiệm vụ nhưng không tải tệp nào lên.
            { userId: users.participant.id, role: TaskActorRole.COLLABORATOR },
          ],
        },
      },
    });
    taskId = task.id;
    await prisma.fileObject.update({ where: { id: files.metadata.id }, data: { metadata: { taskId } } });

    for (const key of ["deliverable", "archived", "missingOnDisk", "sizeMismatch", "infected"] as const) {
      await prisma.taskDeliverable.create({
        data: {
          taskId,
          title: `San pham ${key} ${runId}`,
          fileUrl: `/api/file-objects/${files[key].id}`,
          fileObjectId: files[key].id,
          uploadedById: users.dri.id,
        },
      });
    }

    dossierId = (await prisma.workDossier.create({
      data: {
        code: `HS-FOB-${runId}`,
        title: `Ho so tep ${runId}`,
        owningUnitId: unitId,
        responsiblePersonId: users.dossierOwner.id,
      },
    })).id;
    await prisma.dossierItem.createMany({
      data: [
        { dossierId, itemType: "ATTACHMENT", title: `Bien ban ${runId}`, addedById: users.contributor.id, sequence: 1, fileObjectId: files.dossier.id },
        { dossierId, itemType: "RESULT", title: `Muc khac ${runId}`, addedById: users.otherContributor.id, sequence: 2 },
      ],
    });

    meetingId = (await prisma.meeting.create({
      data: {
        title: `Cuoc hop tep ${runId}`,
        organizerId: users.dossierOwner.id,
        startTime: new Date(Date.now() + DAY),
        materialsFileObjectId: files.meeting.id,
        participants: { create: [{ userId: users.participant.id }] },
      },
    })).id;
  });

  after(async () => {
    if (previousUploadsDir === undefined) delete process.env.UPLOADS_DIR;
    else process.env.UPLOADS_DIR = previousUploadsDir;
    fs.rmSync(uploadsDir, { recursive: true, force: true });

    const userIds = Object.values(users).map((u) => u.id).filter(Boolean);
    const fileIds = Object.values(files).map((f) => f.id).filter(Boolean);
    try {
      if (meetingId) await prisma.meeting.deleteMany({ where: { id: meetingId } });
      if (dossierId) {
        await prisma.dossierItem.deleteMany({ where: { dossierId } });
        await prisma.workDossier.deleteMany({ where: { id: dossierId } });
      }
      if (taskId) {
        await prisma.taskDeliverable.deleteMany({ where: { taskId } });
        await prisma.taskActor.deleteMany({ where: { taskId } });
        await prisma.task.deleteMany({ where: { id: taskId } });
      }
      if (fileIds.length > 0) await prisma.fileObject.deleteMany({ where: { id: { in: fileIds } } });
      if (userIds.length > 0) {
        await prisma.auditEvent.deleteMany({ where: { actorId: { in: userIds } } });
        await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      }
      if (unitId) await prisma.organizationalUnit.deleteMany({ where: { id: unitId } });
    } catch (error) {
      console.error("Dọn fixture file-objects-download-branches lỗi:", error);
    }
  });

  describe("xác thực và tham số", () => {
    test("chưa đăng nhập: 401 AUTH_REQUIRED, không trả tệp", async () => {
      await assertDenied(await download(files.deliverable.id), 401, "AUTH_REQUIRED", files.deliverable);
    });

    test("mã tệp không phải UUID: 400 VALIDATION_ERROR", async () => {
      const res = await download(`cuid-${tag}`, "dri");
      await assertDenied(res, 400, "VALIDATION_ERROR");
    });

    test("UUID không tồn tại: 404 NOT_FOUND", async () => {
      await assertDenied(await download(crypto.randomUUID(), "dri"), 404, "NOT_FOUND");
    });
  });

  describe("sản phẩm nhiệm vụ gắn fileObjectId", () => {
    test("người thực hiện nhiệm vụ: 200, Content-Type theo kiểm kê, Content-Disposition inline tên UTF-8, header an toàn", async () => {
      const res = await download(files.deliverable.id, "dri");
      assert.equal(res.headers.get("content-type"), "application/pdf");
      assert.equal(
        res.headers.get("content-disposition"),
        `inline; filename="Bao cao tien _o.pdf"; filename*=UTF-8''B%C3%A1o%20c%C3%A1o%20ti%E1%BA%BFn%20%C4%91%E1%BB%99.pdf`
      );
      assert.equal(res.headers.get("content-length"), String(files.deliverable.bytes.length));
      assert.equal(res.headers.get("accept-ranges"), "bytes");
      assert.equal(res.headers.get("x-content-type-options"), "nosniff");
      assert.equal(res.headers.get("x-frame-options"), "DENY");
      assert.equal(res.headers.get("cache-control"), FILE_CACHE_CONTROL);
      assert.ok(res.headers.get("x-request-id"), "có x-request-id");
      await assertDownloaded(res, files.deliverable);
    });

    test("người thực hiện nhiệm vụ gửi Range: 206 đúng đoạn byte", async () => {
      const res = await download(files.deliverable.id, "dri", { range: "bytes=0-7" });
      assert.equal(res.status, 206);
      assert.equal(res.headers.get("content-range"), `bytes 0-7/${files.deliverable.bytes.length}`);
      assert.equal(res.headers.get("content-type"), "application/pdf");
      const body = Buffer.from(await res.arrayBuffer());
      assert.ok(body.equals(files.deliverable.bytes.subarray(0, 8)));
    });

    test("người ngoài nhiệm vụ: 403 FORBIDDEN, không trả tệp", async () => {
      await assertDenied(await download(files.deliverable.id, "outsider"), 403, "FORBIDDEN", files.deliverable);
    });
  });

  describe("tệp gắn nhiệm vụ qua metadata.taskId", () => {
    test("người thực hiện nhiệm vụ: 200, Content-Type lấy từ bản ghi kiểm kê (không suy từ đuôi tệp)", async () => {
      const res = await download(files.metadata.id, "dri");
      assert.equal(res.headers.get("content-type"), "text/plain");
      assert.equal(
        res.headers.get("content-disposition"),
        `inline; filename="ke-hoach.txt"; filename*=UTF-8''ke-hoach.txt`
      );
      await assertDownloaded(res, files.metadata);
    });

    test("người ngoài nhiệm vụ: 403 FORBIDDEN", async () => {
      await assertDenied(await download(files.metadata.id, "outsider"), 403, "FORBIDDEN", files.metadata);
    });
  });

  describe("tệp nhúng trong mô tả nhiệm vụ", () => {
    test("người thực hiện nhiệm vụ (cũng là người tải tệp lên): 200", async () => {
      await assertDownloaded(await download(files.description.id, "dri"), files.description);
    });

    test("người phối hợp (không tải tệp lên) đọc được ảnh người tạo nhúng: 200", async () => {
      await assertDownloaded(await download(files.description.id, "participant"), files.description);
    });

    test("người ngoài nhiệm vụ: 403 FORBIDDEN", async () => {
      await assertDenied(await download(files.description.id, "outsider"), 403, "FORBIDDEN", files.description);
    });

    test("tệp của người khác dán vào mô tả: người đọc nhiệm vụ nhận 403 (người tải lên không tạo nhiệm vụ)", async () => {
      // Quyền đọc nhiệm vụ không đủ: cả người tạo (dri) lẫn người phối hợp đều bị từ chối.
      await assertDenied(await download(files.foreignDescription.id, "dri"), 403, "FORBIDDEN", files.foreignDescription);
      await assertDenied(await download(files.foreignDescription.id, "participant"), 403, "FORBIDDEN", files.foreignDescription);
    });
  });

  describe("tệp của mục hồ sơ", () => {
    test("người phụ trách hồ sơ: 200", async () => {
      await assertDownloaded(await download(files.dossier.id, "dossierOwner"), files.dossier);
    });

    test("người đóng góp mục khác trong cùng hồ sơ: 403 FORBIDDEN (chỉ đọc được mục của mình)", async () => {
      await assertDenied(await download(files.dossier.id, "otherContributor"), 403, "FORBIDDEN", files.dossier);
    });

    test("người ngoài hồ sơ: 403 FORBIDDEN", async () => {
      await assertDenied(await download(files.dossier.id, "outsider"), 403, "FORBIDDEN", files.dossier);
    });
  });

  describe("tài liệu cuộc họp", () => {
    test("người được mời họp: 200", async () => {
      await assertDownloaded(await download(files.meeting.id, "participant"), files.meeting);
    });

    test("người ngoài cuộc họp: 403 FORBIDDEN", async () => {
      await assertDenied(await download(files.meeting.id, "outsider"), 403, "FORBIDDEN", files.meeting);
    });
  });

  describe("tệp mồ côi và trạng thái tệp", () => {
    test("tệp không liên kết tài nguyên nào: chính người tải lên cũng nhận 403 FORBIDDEN", async () => {
      await assertDenied(await download(files.orphan.id, "outsider"), 403, "FORBIDDEN", files.orphan);
    });

    test("tệp đã lưu trữ (isArchived): 404 NOT_FOUND kể cả với người thực hiện nhiệm vụ", async () => {
      await assertDenied(await download(files.archived.id, "dri"), 404, "NOT_FOUND", files.archived);
    });

    test("bản ghi còn nhưng tệp không có trên đĩa: 404 NOT_FOUND", async () => {
      await assertDenied(await download(files.missingOnDisk.id, "dri"), 404, "NOT_FOUND");
    });

    test("kích thước trên đĩa lệch bản ghi kiểm kê: 409 FILE_SIZE_MISMATCH", async () => {
      await assertDenied(await download(files.sizeMismatch.id, "dri"), 409, "FILE_SIZE_MISMATCH", files.sizeMismatch);
    });

    test("tệp nhiễm mã độc: 409 FILE_QUARANTINED với người có quyền", async () => {
      await assertDenied(await download(files.infected.id, "dri"), 409, "FILE_QUARANTINED", files.infected);
    });

    test("tệp nhiễm mã độc với người không có quyền: 403 FORBIDDEN (kiểm quyền trước trạng thái quét)", async () => {
      await assertDenied(await download(files.infected.id, "outsider"), 403, "FORBIDDEN", files.infected);
    });
  });
});
