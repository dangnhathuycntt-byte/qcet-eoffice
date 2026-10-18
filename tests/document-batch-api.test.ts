import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { prisma } from "@qcet/db/prisma";
import { POST as batchRoute } from "../src/app/api/documents/batch/route";
import { signSessionToken, SESSION_COOKIE_NAME } from "../src/lib/jwt-session";
import {
  DocumentType,
  DocumentStatus,
  DocumentUrgency,
  DocumentSecurityLevel,
  DossierStatus,
  IncomingDocumentStatus,
  OutgoingDocumentStatus,
  UnitType,
  UserRole,
} from "@prisma/client";
import { AuditAction } from "@qcet/db/audit";
import { BatchDocumentRequestSchema } from "@qcet/contracts/documents";
import {
  mapIncomingWorkflowStatusToDocumentStatus,
  mapOutgoingWorkflowStatusToDocumentStatus,
} from "../src/server/documents/state-machine";

/**
 * POST /api/documents/batch: mỗi văn bản đi qua đúng command đơn lẻ (máy trạng thái,
 * phân quyền theo văn bản, ánh xạ ADR-004); lỗi từng dòng mang `code` như thao tác đơn lẻ.
 * Fixture riêng theo runId (người dùng, đơn vị, văn bản, hồ sơ) và được dọn trong after().
 */
describe("Document Batch Operations API (NĐ 30/2020)", () => {
  const runId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const userIds: string[] = [];
  const unitIds: string[] = [];
  const createdDocumentIds: string[] = [];
  const createdDossierIds: string[] = [];

  let clerkToken: string;
  let bghToken: string;
  let staffToken: string;
  let clerkId: string;
  let bghId: string;
  let unitAId: string;
  let unitBId: string;

  async function createUser(key: string, role: UserRole, title: string) {
    const user = await prisma.user.create({
      data: {
        id: `user-${key}-${runId}`,
        email: `${key}.${runId}@cdktcnqn.edu.vn`,
        name: `${title} kiểm thử lô ${runId}`,
        role,
        title,
      },
    });
    userIds.push(user.id);
    return {
      id: user.id,
      token: signSessionToken({ id: user.id, email: user.email, name: user.name, role: user.role }),
    };
  }

  before(async () => {
    for (const key of ["A", "B"]) {
      const unit = await prisma.organizationalUnit.create({
        data: {
          id: `unit-${key}-${runId}`,
          code: `BATCH_${key}_${runId}`.slice(0, 50),
          name: `Đơn vị kiểm thử lô ${key} ${runId}`,
          type: UnitType.DEPARTMENT,
        },
      });
      unitIds.push(unit.id);
    }
    [unitAId, unitBId] = unitIds;

    const clerk = await createUser("clerk", UserRole.VAN_THU, "Văn thư");
    clerkId = clerk.id;
    clerkToken = clerk.token;
    const bgh = await createUser("bgh", UserRole.BAN_GIAM_HIEU, "Hiệu trưởng");
    bghId = bgh.id;
    bghToken = bgh.token;
    staffToken = (await createUser("staff", UserRole.CHUYEN_VIEN, "Chuyên viên")).token;
  });

  after(async () => {
    const dossierItemIds = (
      await prisma.dossierItem.findMany({
        where: {
          OR: [{ itemId: { in: createdDocumentIds } }, { dossierId: { in: createdDossierIds } }],
        },
        select: { id: true },
      })
    ).map((item) => item.id);
    await prisma.dossierItem.deleteMany({ where: { id: { in: dossierItemIds } } });
    await prisma.documentIncomingWorkflow.deleteMany({ where: { documentId: { in: createdDocumentIds } } });
    await prisma.documentOutgoingWorkflow.deleteMany({ where: { documentId: { in: createdDocumentIds } } });
    await prisma.document.deleteMany({ where: { id: { in: createdDocumentIds } } });
    await prisma.workDossier.deleteMany({ where: { id: { in: createdDossierIds } } });
    const entityIds = [...createdDocumentIds, ...createdDossierIds, ...dossierItemIds];
    await prisma.auditEvent.deleteMany({
      where: { OR: [{ entityId: { in: entityIds } }, { actorId: { in: userIds } }] },
    });
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: entityIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.organizationalUnit.deleteMany({ where: { id: { in: unitIds } } });
  });

  async function createDocument(
    options: {
      type?: DocumentType;
      incoming?: IncomingDocumentStatus;
      outgoing?: OutgoingDocumentStatus;
      incomingDossierId?: string;
      summary?: string;
    } = {}
  ) {
    const type = options.type ?? DocumentType.VAN_BAN_DEN;
    const incoming = options.incoming ?? (type === DocumentType.VAN_BAN_DEN ? IncomingDocumentStatus.REGISTERED : undefined);
    const status = incoming
      ? mapIncomingWorkflowStatusToDocumentStatus(incoming)
      : options.outgoing
        ? mapOutgoingWorkflowStatusToDocumentStatus(options.outgoing)
        : DocumentStatus.CHO_PHE_DUYET;
    const regNum = Math.floor(100_000_000 + Math.random() * 1_900_000_000);
    const doc = await prisma.document.create({
      data: {
        type,
        registrationNumber: regNum,
        documentYear: new Date().getFullYear(),
        originalNumber: `TEST-BATCH-${regNum}`,
        issuedDate: new Date(),
        issuingAuthority: "Bộ Giáo dục và Đào tạo",
        category: "Quyết định",
        summary: options.summary ?? `Văn bản kiểm thử thao tác hàng loạt ${runId} số ${regNum}`,
        urgency: DocumentUrgency.THUONG,
        securityLevel: DocumentSecurityLevel.THUONG,
        status,
        registeredById: clerkId,
        incomingWorkflow: incoming
          ? { create: { status: incoming, dossierId: options.incomingDossierId } }
          : undefined,
        outgoingWorkflow: options.outgoing ? { create: { status: options.outgoing } } : undefined,
      },
    });
    createdDocumentIds.push(doc.id);
    return doc;
  }

  async function createDossier(status: DossierStatus, responsiblePersonId = clerkId) {
    const dossier = await prisma.workDossier.create({
      data: {
        code: `HS-BATCH-${runId}-${createdDossierIds.length + 1}`,
        title: `Hồ sơ công việc kiểm thử lô ${runId}`,
        owningUnitId: unitAId,
        responsiblePersonId,
        status,
      },
    });
    createdDossierIds.push(dossier.id);
    return dossier;
  }

  async function postBatch(token: string, body: Record<string, unknown>) {
    const req = new NextRequest("http://localhost:3000/api/documents/batch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${SESSION_COOKIE_NAME}=${token}`,
        origin: "http://localhost:3000",
        "x-requested-with": "XMLHttpRequest",
      },
      body: JSON.stringify(body),
    });
    const res = await batchRoute(req);
    return { status: res.status, body: await res.json() };
  }

  async function loadDocument(id: string) {
    return prisma.document.findUniqueOrThrow({
      where: { id },
      include: { incomingWorkflow: true, outgoingWorkflow: true },
    });
  }

  function failureFor(body: any, documentId: string) {
    const row = body.data.failed.find((item: any) => item.documentId === documentId);
    assert.ok(row, `Thiếu dòng lỗi cho văn bản ${documentId}`);
    assert.equal(row.success, false);
    return row;
  }

  test("Zod Contract: BatchDocumentRequestSchema validation", () => {
    const validAssign = BatchDocumentRequestSchema.parse({
      action: "ASSIGN_LEAD_UNIT",
      documentIds: ["doc-1"],
      leadUnitId: "unit-123",
      leadershipInstruction: "Khẩn trương xử lý theo đúng hạn",
    });
    assert.equal(validAssign.action, "ASSIGN_LEAD_UNIT");
    assert.equal(validAssign.leadUnitId, "unit-123");

    const validFile = BatchDocumentRequestSchema.parse({ action: "FILE_DOCUMENTS", documentIds: ["doc-1", "doc-2"] });
    assert.equal(validFile.documentIds.length, 2);

    // Giao đơn vị bắt buộc đơn vị chủ trì và ý kiến chỉ đạo như thao tác bút phê đơn lẻ
    assert.throws(() => BatchDocumentRequestSchema.parse({ action: "ASSIGN_LEAD_UNIT", documentIds: ["doc-1"], leadershipInstruction: "Xử lý" }));
    assert.throws(() => BatchDocumentRequestSchema.parse({ action: "ASSIGN_LEAD_UNIT", documentIds: ["doc-1"], leadUnitId: "unit-123" }));
    // Hoàn tất hàng loạt đã bỏ khỏi API: payload chỉ có action + documentIds để lỗi nằm đúng ở action
    const markResolved = BatchDocumentRequestSchema.safeParse({ action: "MARK_RESOLVED", documentIds: ["doc-1"] });
    assert.equal(markResolved.success, false);
    assert.ok(markResolved.error?.issues.some((issue) => issue.path[0] === "action"));
    assert.throws(() => BatchDocumentRequestSchema.parse({ action: "FILE_DOCUMENTS", documentIds: [] }));
  });

  test("RBAC: Staff cannot perform batch operations (403 Forbidden)", async () => {
    const doc = await createDocument({ incoming: IncomingDocumentStatus.RESOLVED });
    const { status, body } = await postBatch(staffToken, { action: "FILE_DOCUMENTS", documentIds: [doc.id] });
    assert.equal(status, 403);
    assert.equal(body.success, false);
    assert.equal((await loadDocument(doc.id)).incomingWorkflow?.status, IncomingDocumentStatus.RESOLVED);
  });

  test("MARK_RESOLVED is rejected with 400 and leaves documents untouched", async () => {
    const doc = await createDocument({ incoming: IncomingDocumentStatus.IN_PROGRESS });
    const { status, body } = await postBatch(bghToken, { action: "MARK_RESOLVED", documentIds: [doc.id] });
    assert.equal(status, 400);
    assert.equal(body.success, false);
    assert.equal(body.code, "VALIDATION_ERROR");
    assert.ok(body.fieldErrors?.action, "Lỗi validation phải nằm ở trường action");
    const after = await loadDocument(doc.id);
    assert.equal(after.status, DocumentStatus.DANG_XU_LY);
    assert.equal(after.incomingWorkflow?.status, IncomingDocumentStatus.IN_PROGRESS);
    assert.equal(after.incomingWorkflow?.resolvedAt, null);
  });

  test("ASSIGN_LEAD_UNIT without leadership instruction is rejected for the whole batch (400)", async () => {
    const doc = await createDocument();
    const { status, body } = await postBatch(bghToken, { action: "ASSIGN_LEAD_UNIT", documentIds: [doc.id], leadUnitId: unitBId });
    assert.equal(status, 400);
    assert.equal(body.success, false);
    assert.equal((await loadDocument(doc.id)).incomingWorkflow?.status, IncomingDocumentStatus.REGISTERED);
  });

  test("ASSIGN_LEAD_UNIT by leadership goes through directDocument (ASSIGNED_TO_LEAD_UNIT ↔ CHO_PHAN_CONG)", async () => {
    const doc1 = await createDocument({ incoming: IncomingDocumentStatus.REGISTERED });
    const doc2 = await createDocument({ incoming: IncomingDocumentStatus.PRESENTED });
    const deadline = new Date(Date.now() + 7 * 86_400_000).toISOString();

    const { status, body } = await postBatch(bghToken, {
      action: "ASSIGN_LEAD_UNIT",
      documentIds: [doc1.id, doc2.id],
      leadUnitId: `BATCH_B_${runId}`.slice(0, 50),
      leadershipInstruction: "Đề nghị đơn vị chủ trì báo cáo kết quả đúng hạn",
      deadline,
    });

    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.action, "ASSIGN_LEAD_UNIT");
    assert.equal(body.data.successCount, 2);
    assert.equal(body.data.failureCount, 0);

    for (const id of [doc1.id, doc2.id]) {
      const updated = await loadDocument(id);
      assert.equal(updated.status, DocumentStatus.CHO_PHAN_CONG);
      assert.equal(updated.incomingWorkflow?.status, IncomingDocumentStatus.ASSIGNED_TO_LEAD_UNIT);
      assert.equal(updated.incomingWorkflow?.leadUnitId, unitBId);
      assert.equal(updated.incomingWorkflow?.leadershipInstruction, "Đề nghị đơn vị chủ trì báo cáo kết quả đúng hạn");
      assert.equal(updated.incomingWorkflow?.deadline?.toISOString(), deadline);
    }

    const auditEvents = await prisma.auditEvent.count({
      where: { entityId: doc1.id, action: AuditAction.DOCUMENT_DIRECTED },
    });
    assert.equal(auditEvents, 1, "Mỗi văn bản giao đơn vị ghi đúng một audit DOCUMENT_DIRECTED");
  });

  test("ASSIGN_LEAD_UNIT rejects per row: invalid transitions and non-incoming document types", async () => {
    const resolved = await createDocument({ incoming: IncomingDocumentStatus.RESOLVED });
    const filed = await createDocument({ incoming: IncomingDocumentStatus.FILED });
    const outgoing = await createDocument({ type: DocumentType.VAN_BAN_DI, outgoing: OutgoingDocumentStatus.DRAFT });
    const submission = await createDocument({ type: DocumentType.TO_TRINH_NOI_BO });

    const { status, body } = await postBatch(bghToken, {
      action: "ASSIGN_LEAD_UNIT",
      documentIds: [resolved.id, filed.id, outgoing.id, submission.id],
      leadUnitId: unitBId,
      leadershipInstruction: "Giao đơn vị chủ trì",
    });

    assert.equal(status, 200);
    assert.equal(body.data.successCount, 0);
    assert.equal(body.data.failureCount, 4);
    for (const id of [resolved.id, filed.id]) {
      const row = failureFor(body, id);
      assert.equal(row.code, "INVALID_TRANSITION");
      assert.equal(row.httpStatus, 409);
    }
    for (const id of [outgoing.id, submission.id]) {
      const row = failureFor(body, id);
      assert.equal(row.code, "UNSUPPORTED_DOCUMENT_TYPE");
      assert.equal(row.httpStatus, 400);
    }

    assert.equal((await loadDocument(resolved.id)).incomingWorkflow?.status, IncomingDocumentStatus.RESOLVED);
    assert.equal((await loadDocument(filed.id)).incomingWorkflow?.status, IncomingDocumentStatus.FILED);
    const outgoingAfter = await loadDocument(outgoing.id);
    assert.equal(outgoingAfter.incomingWorkflow, null, "Văn bản đi không được sinh quy trình văn bản đến");
    assert.equal(outgoingAfter.status, DocumentStatus.DANG_XU_LY);
    assert.equal(outgoingAfter.outgoingWorkflow?.status, OutgoingDocumentStatus.DRAFT);
    const submissionAfter = await loadDocument(submission.id);
    assert.equal(submissionAfter.incomingWorkflow, null);
    assert.equal(submissionAfter.status, DocumentStatus.CHO_PHE_DUYET);
  });

  test("ASSIGN_LEAD_UNIT by Văn thư is denied per row with 403 INSUFFICIENT_CAPABILITY", async () => {
    const doc = await createDocument({ incoming: IncomingDocumentStatus.REGISTERED });
    const { status, body } = await postBatch(clerkToken, {
      action: "ASSIGN_LEAD_UNIT",
      documentIds: [doc.id],
      leadUnitId: unitBId,
      leadershipInstruction: "Giao đơn vị chủ trì",
    });

    assert.equal(status, 200);
    assert.equal(body.data.successCount, 0);
    const row = failureFor(body, doc.id);
    assert.equal(row.code, "INSUFFICIENT_CAPABILITY");
    assert.equal(row.httpStatus, 403);
    const after = await loadDocument(doc.id);
    assert.equal(after.incomingWorkflow?.status, IncomingDocumentStatus.REGISTERED);
    assert.equal(after.incomingWorkflow?.leadUnitId, null);
  });

  test("FILE_DOCUMENTS files only RESOLVED incoming documents; others fail with INVALID_TRANSITION", async () => {
    const resolved = await createDocument({ incoming: IncomingDocumentStatus.RESOLVED });
    const registered = await createDocument({ incoming: IncomingDocumentStatus.REGISTERED });
    const archived = await createDocument({ incoming: IncomingDocumentStatus.ARCHIVED });

    const { status, body } = await postBatch(clerkToken, {
      action: "FILE_DOCUMENTS",
      documentIds: [resolved.id, registered.id, archived.id],
      filingNotes: "Lưu hồ sơ theo lô",
    });

    assert.equal(status, 200);
    assert.equal(body.data.successCount, 1);
    assert.equal(body.data.failureCount, 2);
    assert.equal(body.data.successful[0].documentId, resolved.id);
    for (const id of [registered.id, archived.id]) {
      const row = failureFor(body, id);
      assert.equal(row.code, "INVALID_TRANSITION");
      assert.equal(row.httpStatus, 409);
      assert.ok(row.error && !/prisma|invalid `/i.test(row.error), "Thông báo lỗi từng dòng không lộ lỗi hệ thống");
    }

    const resolvedAfter = await loadDocument(resolved.id);
    assert.equal(resolvedAfter.status, DocumentStatus.LUU_THEO_DOI);
    assert.equal(resolvedAfter.incomingWorkflow?.status, IncomingDocumentStatus.FILED);
    const registeredAfter = await loadDocument(registered.id);
    assert.equal(registeredAfter.status, DocumentStatus.CHO_PHAN_CONG);
    assert.equal(registeredAfter.incomingWorkflow?.status, IncomingDocumentStatus.REGISTERED);
    assert.equal(registeredAfter.incomingWorkflow?.filedAt, null);
    assert.equal((await loadDocument(archived.id)).incomingWorkflow?.status, IncomingDocumentStatus.ARCHIVED);
    const auditOnFailed = await prisma.auditEvent.count({
      where: { entityId: { in: [registered.id, archived.id] }, action: AuditAction.DOCUMENT_FILED },
    });
    assert.equal(auditOnFailed, 0, "Dòng bị từ chối không ghi audit lưu hồ sơ");
  });

  test("FILE_DOCUMENTS routes outgoing documents through fileOutgoingDocument and rejects internal submissions", async () => {
    const issued = await createDocument({ type: DocumentType.VAN_BAN_DI, outgoing: OutgoingDocumentStatus.ISSUED });
    const draft = await createDocument({ type: DocumentType.VAN_BAN_DI, outgoing: OutgoingDocumentStatus.DRAFT });
    const recalled = await createDocument({ type: DocumentType.VAN_BAN_DI, outgoing: OutgoingDocumentStatus.RECALLED });
    const submission = await createDocument({ type: DocumentType.TO_TRINH_NOI_BO });

    const { status, body } = await postBatch(clerkToken, {
      action: "FILE_DOCUMENTS",
      documentIds: [issued.id, draft.id, recalled.id, submission.id],
    });

    assert.equal(status, 200);
    assert.equal(body.data.successCount, 1);
    assert.equal(body.data.successful[0].documentId, issued.id);
    assert.equal(failureFor(body, draft.id).code, "INVALID_TRANSITION");
    assert.equal(failureFor(body, recalled.id).code, "INVALID_TRANSITION");
    assert.equal(failureFor(body, submission.id).code, "UNSUPPORTED_DOCUMENT_TYPE");

    assert.equal((await loadDocument(issued.id)).outgoingWorkflow?.status, OutgoingDocumentStatus.FILED);
    assert.equal((await loadDocument(draft.id)).outgoingWorkflow?.status, OutgoingDocumentStatus.DRAFT);
    assert.equal((await loadDocument(recalled.id)).outgoingWorkflow?.status, OutgoingDocumentStatus.RECALLED);
    const submissionAfter = await loadDocument(submission.id);
    assert.equal(submissionAfter.status, DocumentStatus.CHO_PHE_DUYET);
    assert.equal(submissionAfter.incomingWorkflow, null);
  });

  test("FILE_DOCUMENTS on already FILED documents is rejected per row with ALREADY_FILED (no overwrite, no audit/outbox)", async () => {
    const filedAt = new Date(Date.now() - 30 * 86_400_000);
    const incoming = await createDocument({ incoming: IncomingDocumentStatus.FILED });
    const outgoing = await createDocument({ type: DocumentType.VAN_BAN_DI, outgoing: OutgoingDocumentStatus.FILED });
    await prisma.documentIncomingWorkflow.update({
      where: { documentId: incoming.id },
      data: { filedAt, filedById: clerkId, filingNotes: "Ghi chú lưu ban đầu", dossierId: `HS-FILED-${runId}` },
    });
    await prisma.documentOutgoingWorkflow.update({ where: { documentId: outgoing.id }, data: { filedAt, filedById: clerkId } });
    for (const id of [incoming.id, outgoing.id]) {
      await prisma.document.update({ where: { id }, data: { archiveReason: "Lý do lưu ban đầu" } });
    }

    const { status, body } = await postBatch(clerkToken, {
      action: "FILE_DOCUMENTS",
      documentIds: [incoming.id, outgoing.id],
      filingNotes: "Ghi chú mới",
    });

    assert.equal(status, 200);
    assert.equal(body.data.successCount, 0);
    assert.equal(body.data.failureCount, 2);
    for (const id of [incoming.id, outgoing.id]) {
      const row = failureFor(body, id);
      assert.equal(row.code, "ALREADY_FILED");
      assert.equal(row.httpStatus, 409);
    }

    const incomingAfter = await loadDocument(incoming.id);
    assert.equal(incomingAfter.incomingWorkflow?.status, IncomingDocumentStatus.FILED);
    assert.equal(incomingAfter.incomingWorkflow?.filedAt?.toISOString(), filedAt.toISOString());
    assert.equal(incomingAfter.incomingWorkflow?.filingNotes, "Ghi chú lưu ban đầu");
    assert.equal(incomingAfter.incomingWorkflow?.dossierId, `HS-FILED-${runId}`);
    assert.equal(incomingAfter.archiveReason, "Lý do lưu ban đầu");
    const outgoingAfter = await loadDocument(outgoing.id);
    assert.equal(outgoingAfter.outgoingWorkflow?.status, OutgoingDocumentStatus.FILED);
    assert.equal(outgoingAfter.outgoingWorkflow?.filedAt?.toISOString(), filedAt.toISOString());
    assert.equal(outgoingAfter.archiveReason, "Lý do lưu ban đầu");

    assert.equal(
      await prisma.auditEvent.count({
        where: {
          entityId: { in: [incoming.id, outgoing.id] },
          action: { in: [AuditAction.DOCUMENT_FILED, "OUTGOING_DOCUMENT_FILED"] },
        },
      }),
      0,
      "Văn bản đã lưu không ghi thêm audit lưu hồ sơ"
    );
    assert.equal(await prisma.outboxEvent.count({ where: { aggregateId: { in: [incoming.id, outgoing.id] } } }), 0);
  });

  test("ASSIGN_LEAD_UNIT on an already assigned document is rejected per row with ALREADY_ASSIGNED (direction kept)", async () => {
    const deadline = new Date(Date.now() + 10 * 86_400_000);
    const directedAt = new Date(Date.now() - 2 * 86_400_000);
    const doc = await createDocument({ incoming: IncomingDocumentStatus.ASSIGNED_TO_LEAD_UNIT });
    await prisma.documentIncomingWorkflow.update({
      where: { documentId: doc.id },
      data: { leadUnitId: unitAId, leaderId: bghId, directedAt, leadershipInstruction: "Ý kiến chỉ đạo ban đầu", deadline },
    });

    const { status, body } = await postBatch(bghToken, {
      action: "ASSIGN_LEAD_UNIT",
      documentIds: [doc.id],
      leadUnitId: unitBId,
      leadershipInstruction: "Ý kiến chỉ đạo mới",
    });

    assert.equal(status, 200);
    assert.equal(body.data.successCount, 0);
    const row = failureFor(body, doc.id);
    assert.equal(row.code, "ALREADY_ASSIGNED");
    assert.equal(row.httpStatus, 409);

    const after = await loadDocument(doc.id);
    assert.equal(after.incomingWorkflow?.status, IncomingDocumentStatus.ASSIGNED_TO_LEAD_UNIT);
    assert.equal(after.incomingWorkflow?.leadUnitId, unitAId);
    assert.equal(after.incomingWorkflow?.leadershipInstruction, "Ý kiến chỉ đạo ban đầu");
    assert.equal(after.incomingWorkflow?.deadline?.toISOString(), deadline.toISOString(), "Không được xóa hạn đã giao");
    assert.equal(after.incomingWorkflow?.directedAt?.toISOString(), directedAt.toISOString());
    assert.equal(
      await prisma.auditEvent.count({ where: { entityId: doc.id, action: AuditAction.DOCUMENT_DIRECTED } }),
      0,
      "Văn bản đã giao không ghi thêm audit bút phê"
    );
    assert.equal(await prisma.outboxEvent.count({ where: { aggregateId: doc.id } }), 0, "Không gửi lại thông báo chỉ đạo");
  });

  test("FILE_DOCUMENTS links documents into an open work dossier via DossierService", async () => {
    const doc1 = await createDocument({ incoming: IncomingDocumentStatus.RESOLVED });
    const doc2 = await createDocument({ incoming: IncomingDocumentStatus.RESOLVED });
    const dossier = await createDossier(DossierStatus.OPEN);

    const { status, body } = await postBatch(clerkToken, {
      action: "FILE_DOCUMENTS",
      documentIds: [doc1.id, doc2.id],
      dossierId: dossier.id,
      storageLocation: "Tủ hồ sơ A2, Tầng 3",
      filingNotes: "Đưa vào hồ sơ chuyên đề kiểm định",
    });

    assert.equal(status, 200);
    assert.equal(body.data.action, "FILE_DOCUMENTS");
    assert.equal(body.data.successCount, 2);

    for (const id of [doc1.id, doc2.id]) {
      const updated = await loadDocument(id);
      assert.equal(updated.status, DocumentStatus.LUU_THEO_DOI);
      assert.equal(updated.incomingWorkflow?.status, IncomingDocumentStatus.FILED);
      assert.equal(updated.incomingWorkflow?.dossierId, dossier.id);
    }
    const dossierItems = await prisma.dossierItem.findMany({ where: { dossierId: dossier.id } });
    assert.equal(dossierItems.length, 2, "Hồ sơ phải chứa 2 văn bản đã gắn");
    const dossierAfter = await prisma.workDossier.findUniqueOrThrow({ where: { id: dossier.id } });
    assert.equal(dossierAfter.status, DossierStatus.ACTIVE, "Gắn tài liệu đầu tiên chuyển hồ sơ OPEN → ACTIVE");
  });

  test("FILE_DOCUMENTS into an ARCHIVED dossier is rejected per row and leaves documents unchanged", async () => {
    const doc = await createDocument({ incoming: IncomingDocumentStatus.RESOLVED });
    const dossier = await createDossier(DossierStatus.ARCHIVED);

    const { status, body } = await postBatch(clerkToken, {
      action: "FILE_DOCUMENTS",
      documentIds: [doc.id],
      dossierId: dossier.code,
    });

    assert.equal(status, 200);
    assert.equal(body.data.successCount, 0);
    const row = failureFor(body, doc.id);
    assert.equal(row.code, "INVALID_TRANSITION");
    const after = await loadDocument(doc.id);
    assert.equal(after.status, DocumentStatus.DA_HOAN_THANH);
    assert.equal(after.incomingWorkflow?.status, IncomingDocumentStatus.RESOLVED);
    assert.equal(after.incomingWorkflow?.dossierId, null);
    assert.equal(await prisma.dossierItem.count({ where: { dossierId: dossier.id } }), 0);
  });

  test("FILE_DOCUMENTS with dossierId: a row denied filing is not linked into the dossier (no partial write)", async () => {
    // Hiệu trưởng phụ trách hồ sơ nên có dossier.add_item, nhưng không có quyền lưu văn bản đi (document.outgoing.issue)
    const issued = await createDocument({ type: DocumentType.VAN_BAN_DI, outgoing: OutgoingDocumentStatus.ISSUED });
    const dossier = await createDossier(DossierStatus.OPEN, bghId);

    const { status, body } = await postBatch(bghToken, {
      action: "FILE_DOCUMENTS",
      documentIds: [issued.id],
      dossierId: dossier.id,
    });

    assert.equal(status, 200);
    assert.equal(body.data.successCount, 0);
    const row = failureFor(body, issued.id);
    assert.equal(row.code, "INSUFFICIENT_CAPABILITY");
    assert.equal(row.httpStatus, 403);
    assert.equal((await loadDocument(issued.id)).outgoingWorkflow?.status, OutgoingDocumentStatus.ISSUED);
    assert.equal(await prisma.dossierItem.count({ where: { dossierId: dossier.id } }), 0, "Dòng bị từ chối không được gắn vào hồ sơ");
    const dossierAfter = await prisma.workDossier.findUniqueOrThrow({ where: { id: dossier.id } });
    assert.equal(dossierAfter.status, DossierStatus.OPEN);
    assert.equal(
      await prisma.auditEvent.count({ where: { actorId: bghId, action: AuditAction.DOSSIER_ITEM_ADDED } }),
      0,
      "Không ghi audit thêm tài liệu cho dòng bị từ chối"
    );
  });

  test("FILE_DOCUMENTS with dossierId: a user without dossier.add_item does not get documents filed", async () => {
    // Trưởng phòng (không thuộc đơn vị sở hữu hồ sơ) lưu được văn bản đến nhưng không được thêm tài liệu vào hồ sơ này
    const headToken = (await createUser("head", UserRole.TRUONG_PHONG, "Trưởng phòng")).token;
    const doc = await createDocument({ incoming: IncomingDocumentStatus.RESOLVED });
    const dossier = await createDossier(DossierStatus.OPEN);

    const { status, body } = await postBatch(headToken, { action: "FILE_DOCUMENTS", documentIds: [doc.id], dossierId: dossier.id });

    assert.equal(status, 200);
    assert.equal(body.data.successCount, 0);
    const row = failureFor(body, doc.id);
    assert.equal(row.code, "UNIT_SCOPE_DENIED");
    assert.equal(row.httpStatus, 403);
    const after = await loadDocument(doc.id);
    assert.equal(after.incomingWorkflow?.status, IncomingDocumentStatus.RESOLVED);
    assert.equal(after.incomingWorkflow?.dossierId, null);
    assert.equal(await prisma.dossierItem.count({ where: { dossierId: dossier.id } }), 0);
    assert.equal((await prisma.workDossier.findUniqueOrThrow({ where: { id: dossier.id } })).status, DossierStatus.OPEN);
  });

  test("FILE_DOCUMENTS with dossierId: a document already linked to another dossier is rejected before filing", async () => {
    const other = await createDossier(DossierStatus.OPEN);
    const target = await createDossier(DossierStatus.OPEN);
    const doc = await createDocument({ incoming: IncomingDocumentStatus.RESOLVED, incomingDossierId: other.id });

    const { status, body } = await postBatch(clerkToken, { action: "FILE_DOCUMENTS", documentIds: [doc.id], dossierId: target.id });

    assert.equal(status, 200);
    const row = failureFor(body, doc.id);
    assert.equal(row.code, "INCOMING_DOCUMENT_DOSSIER_ALREADY_LINKED");
    assert.equal(row.httpStatus, 409);
    const after = await loadDocument(doc.id);
    assert.equal(after.incomingWorkflow?.status, IncomingDocumentStatus.RESOLVED);
    assert.equal(after.incomingWorkflow?.dossierId, other.id);
    assert.equal(await prisma.dossierItem.count({ where: { dossierId: target.id } }), 0);
  });

  test("FILE_DOCUMENTS reports DOSSIER_LINK_FAILED when the document was filed but linking it failed", async () => {
    // Trích yếu rỗng làm bước gắn hồ sơ bị từ chối sau khi văn bản đã lưu
    const doc = await createDocument({ incoming: IncomingDocumentStatus.RESOLVED, summary: "   " });
    const dossier = await createDossier(DossierStatus.OPEN);

    const { status, body } = await postBatch(clerkToken, { action: "FILE_DOCUMENTS", documentIds: [doc.id], dossierId: dossier.id });

    assert.equal(status, 200);
    assert.equal(body.data.successCount, 0);
    const row = failureFor(body, doc.id);
    assert.equal(row.code, "DOSSIER_LINK_FAILED");
    assert.equal(row.httpStatus, 400);
    assert.equal(row.status, IncomingDocumentStatus.FILED);
    assert.match(row.error, /^Văn bản đã lưu nhưng chưa gắn được vào hồ sơ/);
    assert.equal((await loadDocument(doc.id)).incomingWorkflow?.status, IncomingDocumentStatus.FILED);
    assert.equal(await prisma.dossierItem.count({ where: { dossierId: dossier.id } }), 0);
  });

  test("FILE_DOCUMENTS into a disposed (đã hủy) dossier is rejected per row with NOT_FOUND", async () => {
    const dossier = await createDossier(DossierStatus.ARCHIVED);
    const doc = await createDocument({ incoming: IncomingDocumentStatus.RESOLVED, incomingDossierId: dossier.id });
    await prisma.dossierItem.create({
      data: { dossierId: dossier.id, itemType: "DOCUMENT", itemId: doc.id, title: doc.summary, addedById: clerkId },
    });
    await prisma.workDossier.update({ where: { id: dossier.id }, data: { disposedAt: new Date(), disposedById: clerkId } });

    const { status, body } = await postBatch(clerkToken, { action: "FILE_DOCUMENTS", documentIds: [doc.id], dossierId: dossier.id });

    assert.equal(status, 200);
    assert.equal(body.data.successCount, 0);
    const row = failureFor(body, doc.id);
    assert.equal(row.code, "NOT_FOUND");
    assert.equal(row.httpStatus, 404);
    const after = await loadDocument(doc.id);
    assert.equal(after.incomingWorkflow?.status, IncomingDocumentStatus.RESOLVED);
    assert.equal(after.incomingWorkflow?.dossierId, dossier.id);
  });

  test("FILE_DOCUMENTS keeps an existing dossier membership (no duplicate item, no relinking)", async () => {
    const dossier = await createDossier(DossierStatus.READY_FOR_ARCHIVE);
    const doc = await createDocument({ incoming: IncomingDocumentStatus.RESOLVED, incomingDossierId: dossier.id });
    await prisma.dossierItem.create({
      data: { dossierId: dossier.id, itemType: "DOCUMENT", itemId: doc.id, title: doc.summary, addedById: clerkId },
    });
    const legacyLinked = await createDocument({
      incoming: IncomingDocumentStatus.RESOLVED,
      incomingDossierId: `HS-LEGACY-${runId}`,
    });

    const linked = await postBatch(clerkToken, { action: "FILE_DOCUMENTS", documentIds: [doc.id], dossierId: dossier.code });
    assert.equal(linked.status, 200);
    assert.equal(linked.body.data.successCount, 1);
    assert.equal((await loadDocument(doc.id)).incomingWorkflow?.status, IncomingDocumentStatus.FILED);
    assert.equal(await prisma.dossierItem.count({ where: { dossierId: dossier.id } }), 1);

    // Không chọn hồ sơ: giữ liên kết hồ sơ sẵn có thay vì ghi đè bằng mã tự sinh
    const plain = await postBatch(clerkToken, { action: "FILE_DOCUMENTS", documentIds: [legacyLinked.id] });
    assert.equal(plain.body.data.successCount, 1);
    const legacyAfter = await loadDocument(legacyLinked.id);
    assert.equal(legacyAfter.incomingWorkflow?.status, IncomingDocumentStatus.FILED);
    assert.equal(legacyAfter.incomingWorkflow?.dossierId, `HS-LEGACY-${runId}`);
  });

  test("Batch API rejects direct ARCHIVE_DOCUMENTS operations", async () => {
    const doc = await createDocument();
    const { status, body } = await postBatch(clerkToken, {
      action: "ARCHIVE_DOCUMENTS",
      documentIds: [doc.id],
      archiveReason: "Hết thời hạn sử dụng hiện hành, chuyển lưu trữ vĩnh viễn",
    });

    assert.equal(status, 400);
    assert.equal(body.success, false);
    const after = await loadDocument(doc.id);
    assert.equal(after.status, DocumentStatus.CHO_PHAN_CONG);
    assert.equal(after.incomingWorkflow?.status, IncomingDocumentStatus.REGISTERED);
    assert.equal(after.archivedAt, null);
  });

  test("Non-existent document IDs fail per row with NOT_FOUND while the rest is processed", async () => {
    const doc = await createDocument({ incoming: IncomingDocumentStatus.RESOLVED });
    const fakeId = `non-existent-doc-${runId}`;

    const { status, body } = await postBatch(clerkToken, { action: "FILE_DOCUMENTS", documentIds: [doc.id, fakeId] });

    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.total, 2);
    assert.equal(body.data.successCount, 1);
    assert.equal(body.data.failureCount, 1);
    const row = failureFor(body, fakeId);
    assert.equal(row.code, "NOT_FOUND");
    assert.equal(row.httpStatus, 404);
  });
});
