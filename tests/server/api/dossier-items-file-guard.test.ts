/**
 * POST /api/dossiers/[id]/items: mục hồ sơ cấp quyền tải tệp cho người đọc hồ sơ, nên chỉ gắn được tệp do chính
 * người thao tác tải lên; mục văn bản chỉ gắn được văn bản người thao tác đọc được (như GET /api/documents/[id]).
 * Trước đây: tệp của người khác được gắn rồi tải qua mục hồ sơ; UUID không tồn tại trả 500 (vi phạm khóa ngoại);
 * văn bản ngoài phạm vi vẫn bị ghi liên kết hồ sơ vào quy trình văn bản đến.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { NextRequest } from "next/server";
import {
  DocumentSecurityLevel,
  DocumentType,
  FileScanStatus,
  IncomingDocumentStatus,
  JobCatalogGroup,
  UnitType,
  UserRole,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { signSessionToken } from "@/lib/jwt-session";
import { POST as addItem } from "@/app/api/dossiers/[id]/items/route";
import { GET as downloadFileObject } from "@/app/api/file-objects/[id]/route";

type Role = "owner" | "member" | "victim";

const BASE = "http://localhost:3000";

describe("POST /api/dossiers/[id]/items: chỉ gắn tệp của chính mình và văn bản đọc được", () => {
  const runId = `${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
  const tag = runId.replace(/[^0-9a-z]/gi, "").slice(-12);
  const users = {} as Record<Role, { id: string; token: string }>;
  const unitIds: string[] = [];
  const fileIds: Record<"own" | "victim" | "infected", string> = { own: "", victim: "", infected: "" };
  const docIds: Record<"readable" | "hidden", string> = { readable: "", hidden: "" };
  let positionDefinitionId = "";
  let dossierId = "";

  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
  const auth = (role: Role) => ({ Authorization: `Bearer ${users[role].token}` });

  function postItem(body: Record<string, unknown>) {
    return addItem(
      new NextRequest(`${BASE}/api/dossiers/${dossierId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth("owner") },
        body: JSON.stringify(body),
      }),
      ctx(dossierId)
    );
  }

  async function createFile(key: keyof typeof fileIds, uploadedById: string, scanStatus: FileScanStatus) {
    const file = await prisma.fileObject.create({
      data: {
        storageKey: `test/dossier-file-guard/${runId}-${key}.txt`,
        originalName: `${key}-${runId}.txt`,
        mimeType: "text/plain",
        extension: ".txt",
        byteSize: BigInt(16),
        contentHash: crypto.createHash("sha256").update(`${runId}-${key}`).digest("hex"),
        uploadedById,
        scanStatus,
      },
    });
    fileIds[key] = file.id;
  }

  async function createIncomingDocument(key: keyof typeof docIds, registeredById: string, leadUnitId: string) {
    const doc = await prisma.document.create({
      data: {
        type: DocumentType.VAN_BAN_DEN,
        registrationNumber: -(100_000_000 + crypto.randomInt(0, 800_000_000)),
        documentYear: new Date().getFullYear(),
        originalNumber: `${runId}/${key}`,
        issuedDate: new Date(Date.now() - 2 * 86_400_000),
        issuingAuthority: "Sở Giáo dục và Đào tạo",
        category: "Công văn",
        summary: `Văn bản kiểm thử gắn hồ sơ ${runId} ${key}`,
        securityLevel: DocumentSecurityLevel.THUONG,
        registeredById,
        incomingWorkflow: { create: { status: IncomingDocumentStatus.ASSIGNED_TO_LEAD_UNIT, leadUnitId } },
      },
    });
    docIds[key] = doc.id;
  }

  async function itemCount() {
    return prisma.dossierItem.count({ where: { dossierId } });
  }

  before(async () => {
    for (const suffix of ["A", "B"]) {
      const unit = await prisma.organizationalUnit.create({
        data: { code: `DFG${suffix}_${tag}`, name: `Đơn vị ${suffix} ${runId}`, type: UnitType.DEPARTMENT },
      });
      unitIds.push(unit.id);
    }
    for (const role of ["owner", "member", "victim"] as const) {
      const user = await prisma.user.create({
        data: { email: `dfg-${role}-${runId}@qcet.edu.vn`, name: `DFG ${role} ${runId}`, role: UserRole.CHUYEN_VIEN },
      });
      users[role] = {
        id: user.id,
        token: signSessionToken({ id: user.id, email: user.email, name: user.name, role: user.role }),
      };
    }
    // Thành viên đơn vị sở hữu đọc được hồ sơ (và tệp qua mục hồ sơ nếu mục được tạo).
    const positionDefinition = await prisma.positionDefinition.create({
      data: { code: `PD_DFG_${tag}`, title: `Chuyên viên ${runId}`, group: JobCatalogGroup.VCDC, isLeadership: false },
    });
    positionDefinitionId = positionDefinition.id;
    await prisma.positionAssignment.create({
      data: {
        userId: users.member.id,
        unitId: unitIds[0],
        positionDefinitionId,
        type: "PRIMARY",
        status: "ACTIVE",
        effectiveFrom: new Date(Date.now() - 30 * 86_400_000),
      },
    });

    const dossier = await prisma.workDossier.create({
      data: {
        code: `HS-DFG-${runId}`,
        title: `Hồ sơ kiểm thử gắn tệp ${runId}`,
        owningUnitId: unitIds[0],
        responsiblePersonId: users.owner.id,
      },
    });
    dossierId = dossier.id;

    await createFile("own", users.owner.id, FileScanStatus.CLEAN);
    await createFile("victim", users.victim.id, FileScanStatus.CLEAN);
    await createFile("infected", users.owner.id, FileScanStatus.INFECTED);
    // Người phụ trách hồ sơ vào sổ văn bản này nên đọc được; văn bản kia của người khác, thuộc đơn vị B.
    await createIncomingDocument("readable", users.owner.id, unitIds[0]);
    await createIncomingDocument("hidden", users.victim.id, unitIds[1]);
  });

  after(async () => {
    const userIds = Object.values(users).map((u) => u.id);
    const itemIds = (await prisma.dossierItem.findMany({ where: { dossierId }, select: { id: true } })).map((i) => i.id);
    await prisma.auditEvent.deleteMany({ where: { entityId: { in: [dossierId, ...itemIds] } } });
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: [dossierId, ...itemIds] } } });
    await prisma.dossierItem.deleteMany({ where: { dossierId } });
    await prisma.workDossier.deleteMany({ where: { id: dossierId } });
    await prisma.document.deleteMany({ where: { id: { in: Object.values(docIds).filter(Boolean) } } });
    await prisma.fileObject.deleteMany({ where: { id: { in: Object.values(fileIds).filter(Boolean) } } });
    await prisma.positionAssignment.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.positionDefinition.deleteMany({ where: { id: positionDefinitionId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.organizationalUnit.deleteMany({ where: { id: { in: unitIds } } });
  });

  test("tệp của người khác: 404 FILE_NOT_FOUND, không tạo mục, người đọc hồ sơ vẫn không tải được tệp", async () => {
    const before = await itemCount();
    const res = await postItem({ itemType: "ATTACHMENT", title: `Tệp người khác ${runId}`, fileUrl: `/api/file-objects/${fileIds.victim}` });
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.code, "FILE_NOT_FOUND");
    assert.equal(await itemCount(), before);

    const download = await downloadFileObject(
      new NextRequest(`${BASE}/api/file-objects/${fileIds.victim}`, { headers: auth("member") }),
      ctx(fileIds.victim)
    );
    assert.equal(download.status, 403);
  });

  test("UUID tệp không tồn tại: 404 FILE_NOT_FOUND (trước là 500), không tạo mục", async () => {
    const before = await itemCount();
    const res = await postItem({ itemType: "ATTACHMENT", title: `Tệp không có ${runId}`, fileUrl: `/api/file-objects/${crypto.randomUUID()}` });
    assert.equal(res.status, 404);
    assert.equal((await res.json()).code, "FILE_NOT_FOUND");
    assert.equal(await itemCount(), before);
  });

  test("tệp nhiễm mã độc của chính mình: 400 FILE_INFECTED, không tạo mục", async () => {
    const before = await itemCount();
    const res = await postItem({ itemType: "ATTACHMENT", title: `Tệp nhiễm ${runId}`, fileUrl: `/api/file-objects/${fileIds.infected}` });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).code, "FILE_INFECTED");
    assert.equal(await itemCount(), before);
  });

  test("tệp của chính mình: 201, mục mang fileObjectId của tệp", async () => {
    const res = await postItem({ itemType: "ATTACHMENT", title: `Tệp của mình ${runId}`, fileUrl: `/api/file-objects/${fileIds.own}` });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.fileObjectId, fileIds.own);
  });

  test("văn bản ngoài phạm vi đọc: 404, không tạo mục, liên kết hồ sơ của văn bản không đổi", async () => {
    const before = await itemCount();
    const res = await postItem({ itemType: "DOCUMENT", documentId: docIds.hidden, title: `Văn bản người khác ${runId}` });
    assert.equal(res.status, 404);
    assert.equal((await res.json()).code, "NOT_FOUND");
    assert.equal(await itemCount(), before);
    const workflow = await prisma.documentIncomingWorkflow.findUniqueOrThrow({ where: { documentId: docIds.hidden } });
    assert.equal(workflow.dossierId, null);
  });

  test("id văn bản không tồn tại: cùng 404 NOT_FOUND như văn bản ngoài phạm vi", async () => {
    const res = await postItem({ itemType: "DOCUMENT", documentId: `missing_${runId}`, title: `Văn bản không có ${runId}` });
    assert.equal(res.status, 404);
    assert.equal((await res.json()).code, "NOT_FOUND");
  });

  test("văn bản đọc được: 201 và quy trình văn bản đến trỏ về hồ sơ", async () => {
    const res = await postItem({ itemType: "DOCUMENT", documentId: docIds.readable, title: `Văn bản của mình ${runId}` });
    assert.equal(res.status, 201);
    const workflow = await prisma.documentIncomingWorkflow.findUniqueOrThrow({ where: { documentId: docIds.readable } });
    assert.equal(workflow.dossierId, dossierId);
  });
});
