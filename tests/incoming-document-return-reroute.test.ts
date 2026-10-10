/**
 * V-01 (spec task-document-gap-spec.md): trả lại và chuyển lại văn bản đến cho đơn vị khác.
 * Chạy trên qcet_test và chỉ xóa bản ghi do test tạo.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  AssignmentStatus,
  DocumentType,
  IncomingDocumentStatus,
  JobCatalogGroup,
  UnitStatus,
  UnitType,
} from '@prisma/client';
import { ZodError } from 'zod';
import { prisma } from '../src/lib/prisma';
import {
  listDocumentReturns,
  rerouteIncomingDocument,
  returnIncomingDocument,
} from '../src/lib/services/incoming-document-routing-service';
import { runOutboxCycle } from '../src/server/outbox/outbox-worker';
import { ApiError, ConflictError, ValidationError } from '../src/server/api/errors';

const runId = `v01_${Date.now()}`;
const u: Record<string, string> = {};
const unit: Record<string, string> = {};
const docs: string[] = [];
let positionId = '';
let createdPosition = false;
let regSeq = 700000 + Math.floor(Math.random() * 90000);

const session = (key: string, role: string, departmentId?: string) => ({
  id: u[key],
  email: `${key}@x`,
  name: key,
  role,
  departmentId,
});
const clerk = () => session('clerk', 'VAN_THU');
const headA = () => session('headA', 'TRUONG_PHONG', unit.A);
const headB = () => session('headB', 'TRUONG_PHONG', unit.B);
const staff = () => session('staff', 'CHUYEN_VIEN', unit.A);
const forbidden = (err: unknown) =>
  err instanceof Error && (err as { statusCode?: number }).statusCode === 403;

async function makeDoc(status: IncomingDocumentStatus, leadUnitId: string | null = unit.A) {
  const doc = await prisma.document.create({
    data: {
      type: DocumentType.VAN_BAN_DEN,
      registrationNumber: regSeq++,
      documentYear: 2026,
      originalNumber: `${runId}/${regSeq}`,
      issuedDate: new Date('2026-10-01'),
      issuingAuthority: 'Sở Giáo dục',
      category: 'Công văn',
      summary: 'Kế hoạch tuyển sinh năm 2026',
      registeredById: u.clerk,
      incomingWorkflow: { create: { status, leadUnitId, leaderId: u.leader } },
    },
    include: { incomingWorkflow: true },
  });
  docs.push(doc.id);
  return doc;
}

const workflowOf = (documentId: string) =>
  prisma.documentIncomingWorkflow.findUniqueOrThrow({ where: { documentId } });

describe('V-01 trả lại và chuyển lại văn bản đến', () => {
  before(async () => {
    for (const key of ['clerk', 'headA', 'headB', 'staff', 'leader']) {
      const user = await prisma.user.create({
        data: { email: `${runId}_${key}@cdktcnqn.edu.vn`, name: `${runId} ${key}` },
      });
      u[key] = user.id;
    }
    for (const key of ['A', 'B']) {
      const created = await prisma.organizationalUnit.create({
        data: { code: `${runId}_${key}`.slice(0, 50), name: `Đơn vị ${key}`, type: UnitType.DEPARTMENT },
      });
      unit[key] = created.id;
    }
    const suspended = await prisma.organizationalUnit.create({
      data: { code: `${runId}_S`.slice(0, 50), name: 'Đơn vị tạm dừng', type: UnitType.DEPARTMENT, status: UnitStatus.SUSPENDED },
    });
    unit.S = suspended.id;

    // Trưởng đơn vị B có phân công hiệu lực để nhận thông báo khi được chuyển văn bản.
    // Mã chức vụ phải là mã chuẩn để hệ phân quyền nhận ra trưởng đơn vị; dùng lại nếu đã có.
    let position = await prisma.positionDefinition.findUnique({ where: { code: 'TRUONG_DON_VI' } });
    if (!position) {
      position = await prisma.positionDefinition.create({
        data: { code: 'TRUONG_DON_VI', title: 'Trưởng đơn vị', group: JobCatalogGroup.LDPU, isLeadership: true },
      });
      createdPosition = true;
    }
    positionId = position.id;
    await prisma.positionAssignment.create({
      data: { userId: u.headB, positionDefinitionId: position.id, unitId: unit.B, status: AssignmentStatus.ACTIVE },
    });
  });

  after(async () => {
    const ids = Object.values(u);
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: docs } } });
    await prisma.auditEvent.deleteMany({ where: { entityId: { in: docs } } });
    await prisma.documentUnitReturn.deleteMany({ where: { documentId: { in: docs } } });
    await prisma.unitWorkAssignment.deleteMany({ where: { workflow: { documentId: { in: docs } } } });
    await prisma.document.deleteMany({ where: { id: { in: docs } } });
    await prisma.positionAssignment.deleteMany({ where: { userId: u.headB } });
    if (positionId && createdPosition) await prisma.positionDefinition.delete({ where: { id: positionId } });
    await prisma.organizationalUnit.deleteMany({ where: { id: { in: Object.values(unit) } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });

  test('chuyên viên và trưởng đơn vị khác không trả lại được (AC-V01-1)', async () => {
    const doc = await makeDoc(IncomingDocumentStatus.ASSIGNED_TO_LEAD_UNIT);
    await assert.rejects(returnIncomingDocument(doc.id, { reason: 'Không thuộc đơn vị' }, staff()), forbidden);
    await assert.rejects(returnIncomingDocument(doc.id, { reason: 'Không thuộc đơn vị' }, headB()), forbidden);
    assert.equal((await workflowOf(doc.id)).status, IncomingDocumentStatus.ASSIGNED_TO_LEAD_UNIT);
  });

  test('lý do bắt buộc, tối thiểu 3 ký tự', async () => {
    const doc = await makeDoc(IncomingDocumentStatus.ASSIGNED_TO_LEAD_UNIT);
    await assert.rejects(returnIncomingDocument(doc.id, { reason: '  ' }, headA()), ZodError);
    await assert.rejects(returnIncomingDocument(doc.id, { reason: 'ừ' }, headA()), ZodError);
  });

  test('trưởng đơn vị chủ trì trả lại: về DIRECTED, bỏ đơn vị chủ trì, ghi lịch sử, audit, outbox', async () => {
    const doc = await makeDoc(IncomingDocumentStatus.ASSIGNED_TO_LEAD_UNIT);
    const res = await returnIncomingDocument(doc.id, { reason: 'Thuộc thẩm quyền Phòng Đào tạo' }, headA());
    assert.equal(res.status, IncomingDocumentStatus.DIRECTED);

    const wf = await workflowOf(doc.id);
    assert.equal(wf.status, IncomingDocumentStatus.DIRECTED);
    assert.equal(wf.leadUnitId, null);
    const rows = await listDocumentReturns(doc.id);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].fromUnit.id, unit.A);
    assert.equal(rows[0].reason, 'Thuộc thẩm quyền Phòng Đào tạo');
    assert.equal(rows[0].resolvedAt, null);
    assert.ok(await prisma.auditEvent.findFirst({ where: { entityId: doc.id, action: 'DOCUMENT_RETURNED' } }));

    const ev = await prisma.outboxEvent.findFirstOrThrow({ where: { aggregateId: doc.id, eventType: 'DOCUMENT_RETURNED_NOTIFICATION' } });
    await runOutboxCycle(prisma, { ids: [ev.id] });
    const notices = await prisma.notification.findMany({ where: { userId: u.clerk, type: 'document_returned' } });
    assert.ok(notices.length >= 1, 'Văn thư được báo');
    assert.match(notices[notices.length - 1].body, /Thuộc thẩm quyền Phòng Đào tạo/);
  });

  test('không trả lại lần hai khi văn bản đã ở DIRECTED', async () => {
    const doc = await makeDoc(IncomingDocumentStatus.ASSIGNED_TO_LEAD_UNIT);
    await returnIncomingDocument(doc.id, { reason: 'Chuyển nhầm đơn vị' }, headA());
    await assert.rejects(
      returnIncomingDocument(doc.id, { reason: 'Trả thêm lần nữa' }, headA()),
      (err: unknown) => err instanceof ValidationError || err instanceof ConflictError
    );
  });

  test('đã sinh nhiệm vụ liên kết thì không trả lại được', async () => {
    const doc = await makeDoc(IncomingDocumentStatus.UNIT_ASSIGNED_PERSON);
    const task = await prisma.task.create({
      data: {
        code: `${runId}_t`.slice(0, 50),
        title: 'Nhiệm vụ liên kết',
        academicMonth: 10,
        academicYear: '2026-2027',
        dueDate: new Date('2026-10-30'),
        createdById: u.leader,
      },
    });
    try {
      await prisma.document.update({ where: { id: doc.id }, data: { linkedTaskId: task.id } });
      await assert.rejects(
        returnIncomingDocument(doc.id, { reason: 'Đã có nhiệm vụ' }, headA()),
        (err: unknown) => err instanceof ConflictError && err.code === 'DOCUMENT_RETURN_TASK_EXISTS'
      );
    } finally {
      await prisma.document.update({ where: { id: doc.id }, data: { linkedTaskId: null } });
      await prisma.task.delete({ where: { id: task.id } });
    }
  });

  test('đã giao người thụ lý: trả lại hủy phân công đang mở nhưng giữ bản ghi', async () => {
    const doc = await makeDoc(IncomingDocumentStatus.UNIT_ASSIGNED_PERSON);
    const wf = await workflowOf(doc.id);
    const assignment = await prisma.unitWorkAssignment.create({
      data: { workflowId: wf.id, unitId: unit.A, assignedById: u.headA, driUserId: u.staff, status: 'ASSIGNED' },
    });
    await prisma.document.update({ where: { id: doc.id }, data: { leadUserId: u.staff } });

    const res = await returnIncomingDocument(doc.id, { reason: 'Không đúng thẩm quyền' }, headA());
    assert.equal(res.cancelledAssignments, 1);
    const after = await prisma.unitWorkAssignment.findUniqueOrThrow({ where: { id: assignment.id } });
    assert.equal(after.status, 'CANCELLED');
    assert.equal((await prisma.document.findUniqueOrThrow({ where: { id: doc.id } })).leadUserId, null);
  });

  test('chỉ Văn thư chuyển lại; không chuyển lại cho đơn vị vừa trả hoặc đơn vị không hoạt động', async () => {
    const doc = await makeDoc(IncomingDocumentStatus.ASSIGNED_TO_LEAD_UNIT);
    await returnIncomingDocument(doc.id, { reason: 'Chuyển nhầm đơn vị' }, headA());

    await assert.rejects(rerouteIncomingDocument(doc.id, { leadUnitId: unit.B }, headA()), forbidden);
    await assert.rejects(rerouteIncomingDocument(doc.id, { leadUnitId: unit.B }, staff()), forbidden);
    await assert.rejects(rerouteIncomingDocument(doc.id, { leadUnitId: unit.A }, clerk()), ValidationError);
    await assert.rejects(rerouteIncomingDocument(doc.id, { leadUnitId: unit.S }, clerk()), ValidationError);
    await assert.rejects(rerouteIncomingDocument(doc.id, { leadUnitId: 'khong-ton-tai' }, clerk()), ApiError);
    assert.equal((await workflowOf(doc.id)).status, IncomingDocumentStatus.DIRECTED);
  });

  test('Văn thư chuyển lại: đơn vị mới nhận, đóng bản ghi trả lại, giữ lịch sử, báo trưởng đơn vị nhận', async () => {
    const doc = await makeDoc(IncomingDocumentStatus.ASSIGNED_TO_LEAD_UNIT);
    await returnIncomingDocument(doc.id, { reason: 'Chuyển nhầm đơn vị' }, headA());

    const res = await rerouteIncomingDocument(doc.id, { leadUnitId: unit.B, note: 'Đúng chức năng Phòng B' }, clerk());
    assert.equal(res.status, IncomingDocumentStatus.ASSIGNED_TO_LEAD_UNIT);

    const wf = await workflowOf(doc.id);
    assert.equal(wf.status, IncomingDocumentStatus.ASSIGNED_TO_LEAD_UNIT);
    assert.equal(wf.leadUnitId, unit.B);

    const history = await listDocumentReturns(doc.id);
    assert.equal(history.length, 1, 'lịch sử không bị xóa');
    assert.equal(history[0].toUnit?.id, unit.B);
    assert.ok(history[0].resolvedAt);
    assert.equal(history[0].rerouteNote, 'Đúng chức năng Phòng B');
    assert.ok(await prisma.auditEvent.findFirst({ where: { entityId: doc.id, action: 'DOCUMENT_REROUTED' } }));

    const ev = await prisma.outboxEvent.findFirstOrThrow({ where: { aggregateId: doc.id, eventType: 'DOCUMENT_REROUTED_NOTIFICATION' } });
    await runOutboxCycle(prisma, { ids: [ev.id] });
    assert.equal((await prisma.notification.count({ where: { userId: u.headB, type: 'document_rerouted' } })), 1);

    await assert.rejects(
      rerouteIncomingDocument(doc.id, { leadUnitId: unit.B }, clerk()),
      (err: unknown) => err instanceof ConflictError && err.code === 'DOCUMENT_NOT_AWAITING_REROUTE'
    );
  });

  test('đơn vị mới trả lại tiếp: lịch sử có hai bản ghi theo thứ tự', async () => {
    const doc = await makeDoc(IncomingDocumentStatus.ASSIGNED_TO_LEAD_UNIT);
    await returnIncomingDocument(doc.id, { reason: 'Lần trả thứ nhất' }, headA());
    await rerouteIncomingDocument(doc.id, { leadUnitId: unit.B }, clerk());
    await returnIncomingDocument(doc.id, { reason: 'Lần trả thứ hai' }, headB());
    const history = await listDocumentReturns(doc.id);
    assert.deepEqual(history.map((h) => h.reason), ['Lần trả thứ hai', 'Lần trả thứ nhất']);
    assert.equal(history[0].fromUnit.id, unit.B);
  });
});
