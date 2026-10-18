/**
 * Giao việc văn bản đến có tạo nhiệm vụ khi hạn xử lý đã qua: ngày bắt đầu nhiệm vụ kẹp về hạn
 * (min(now, dueDate)) như createTask, không vi phạm ràng buộc dueDate >= startDate (trước đây lỗi 500).
 * Chạy trên qcet_test, chỉ xóa bản ghi do test tạo.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  AssignmentStatus,
  DocumentType,
  IncomingDocumentStatus,
  JobCatalogGroup,
  UnitType,
  UserRole,
} from "@prisma/client";
import { prisma } from "@qcet/db/prisma";
import { assignUnitWork } from "../src/server/documents/incoming-document-service";

const runId = `incstart${Date.now()}${Math.floor(Math.random() * 1000)}`;
const users: Record<"head" | "dri", { id: string; email: string; name: string; role: UserRole }> = {} as never;
let unitId = "";
let documentId = "";
let positionDefinitionId = "";
let createdPositionDefinition = false;

describe("assignUnitWork: hạn xử lý đã qua khi tạo nhiệm vụ", () => {
  before(async () => {
    const unit = await prisma.organizationalUnit.create({
      data: { code: `${runId}_A`.slice(0, 50), name: `Đơn vị ${runId}`, type: UnitType.DEPARTMENT },
    });
    unitId = unit.id;

    for (const [key, role] of [["head", UserRole.TRUONG_PHONG], ["dri", UserRole.CHUYEN_VIEN]] as const) {
      const created = await prisma.user.create({
        data: { email: `${runId}_${key}@qcet.edu.vn`, name: `${runId} ${key}`, role },
      });
      users[key] = { id: created.id, email: created.email, name: created.name, role };
    }

    // Mã chức vụ chuẩn để hệ phân quyền nhận ra trưởng đơn vị; dùng lại nếu đã có, chỉ xóa khi test tự tạo.
    let position = await prisma.positionDefinition.findUnique({ where: { code: "TRUONG_PHONG" } });
    if (!position) {
      position = await prisma.positionDefinition.create({
        data: { code: "TRUONG_PHONG", title: "Trưởng phòng", group: JobCatalogGroup.LDPU, isLeadership: true },
      });
      createdPositionDefinition = true;
    }
    positionDefinitionId = position.id;
    await prisma.positionAssignment.create({
      data: {
        userId: users.head.id,
        positionDefinitionId,
        unitId,
        type: "PRIMARY",
        status: AssignmentStatus.ACTIVE,
        effectiveFrom: new Date(Date.now() - 86_400_000),
      },
    });

    const seq = 900_000_000 + Math.floor(Math.random() * 90_000_000);
    const doc = await prisma.document.create({
      data: {
        type: DocumentType.VAN_BAN_DEN,
        registrationNumber: seq,
        documentYear: new Date().getFullYear(),
        originalNumber: `${runId}/${seq}`,
        issuedDate: new Date(Date.now() - 10 * 86_400_000),
        issuingAuthority: "Sở Giáo dục và Đào tạo",
        category: "Công văn",
        summary: `Công văn kiểm thử hạn đã qua ${runId}`,
        registeredById: users.head.id,
        incomingWorkflow: {
          create: { status: IncomingDocumentStatus.ASSIGNED_TO_LEAD_UNIT, leadUnitId: unitId },
        },
      },
    });
    documentId = doc.id;
  });

  after(async () => {
    const userIds = Object.values(users).map((u) => u.id);
    const doc = documentId
      ? await prisma.document.findUnique({ where: { id: documentId }, select: { linkedTaskId: true } })
      : null;
    const entityIds = [documentId, doc?.linkedTaskId].filter((id): id is string => Boolean(id));
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: entityIds } } });
    await prisma.auditEvent.deleteMany({ where: { entityId: { in: entityIds } } });
    await prisma.unitWorkAssignment.deleteMany({ where: { workflow: { documentId } } });
    await prisma.document.deleteMany({ where: { id: documentId } });
    if (doc?.linkedTaskId) await prisma.task.deleteMany({ where: { id: doc.linkedTaskId } });
    await prisma.positionAssignment.deleteMany({ where: { userId: { in: userIds } } });
    if (createdPositionDefinition) await prisma.positionDefinition.deleteMany({ where: { id: positionDefinitionId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    if (unitId) await prisma.organizationalUnit.deleteMany({ where: { id: unitId } });
  });

  it("tạo được nhiệm vụ, ngày bắt đầu kẹp về hạn xử lý", async () => {
    const deadline = new Date(Date.now() - 2 * 86_400_000);
    const result = await assignUnitWork(
      {
        documentId,
        driUserId: users.dri.id,
        instruction: "Xử lý bổ sung văn bản đã quá hạn.",
        deadline,
        createTask: true,
      },
      users.head,
      `req-${runId}`
    );
    assert.equal(result.workflow.status, IncomingDocumentStatus.IN_PROGRESS);

    const { linkedTaskId } = await prisma.document.findUniqueOrThrow({ where: { id: documentId }, select: { linkedTaskId: true } });
    assert.ok(linkedTaskId, "văn bản phải liên kết nhiệm vụ vừa tạo");
    const task = await prisma.task.findUniqueOrThrow({ where: { id: linkedTaskId } });
    assert.equal(task.dueDate.getTime(), deadline.getTime());
    assert.equal(task.startDate.getTime(), deadline.getTime(), "ngày bắt đầu = min(now, hạn)");
  });
});
