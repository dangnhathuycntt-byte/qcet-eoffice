/**
 * V-05a và V-05 (spec task-document-gap-spec.md): nơi nhận có định danh, ghi nhận tiếp nhận, thu hồi
 * và văn bản thay thế. Chạy trên qcet_test và chỉ xóa bản ghi do test tạo.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { AssignmentStatus, DocumentType, JobCatalogGroup, OutgoingDocumentStatus, UnitType, UserRole } from '@prisma/client';
import { ZodError } from 'zod';
import { prisma } from '../src/lib/prisma';
import { OutgoingDocumentService } from '../src/lib/services/outgoing-document-service';
import { confirmReceipt, getRecipientsState, recallOutgoing } from '../src/server/documents/outgoing-recipients';
import { ApiError, ConflictError } from '../src/server/api/errors';
import { evaluateRecall, evaluateReplacementTarget } from '../src/domain/documents/recall-rules';

const runId = `v05_${Date.now()}`;
const u: Record<string, string> = {};
const docs: string[] = [];
let unitId = '';
let seq = 0;
const createdPositions: string[] = [];

const session = (key: string) => ({ id: u[key], email: `${key}@x`, name: key, role: 'CHUYEN_VIEN' });
const forbidden = (err: unknown) => err instanceof ApiError && err.statusCode === 403;
const conflict = (code: string) => (err: unknown) => err instanceof ConflictError && err.code === code;

async function ensurePosition(code: string, group: JobCatalogGroup) {
  const existing = await prisma.positionDefinition.findUnique({ where: { code } });
  if (existing) return existing.id;
  const created = await prisma.positionDefinition.create({ data: { code, title: code, group, isLeadership: group === JobCatalogGroup.LDPU } });
  createdPositions.push(created.id);
  return created.id;
}

async function makeDoc(key: string, status: OutgoingDocumentStatus, opts: { recipients?: Array<{ name: string; receivedAt?: Date }> } = {}) {
  seq += 1;
  const doc = await prisma.document.create({
    data: {
      type: DocumentType.VAN_BAN_DI,
      registrationNumber: -(Math.floor(Math.random() * 2_000_000_000) + 1),
      documentYear: 2026,
      originalNumber: `${runId}-${key}`,
      issuedDate: new Date('2026-10-01'),
      issuingAuthority: 'QCET',
      category: 'Công văn',
      summary: `Văn bản đi ${key} ${runId}`,
      registeredById: u.owner,
      outgoingWorkflow: { create: { status, outgoingNumber: 900000 + seq, outgoingNumberStr: `${900000 + seq}/QCET`, issuedAt: new Date('2026-10-02') } },
      outgoingRecipients: opts.recipients
        ? { create: opts.recipients.map((r) => ({ kind: 'EXTERNAL' as const, name: r.name, receivedAt: r.receivedAt ?? null })) }
        : undefined,
    },
    include: { outgoingRecipients: true },
  });
  docs.push(doc.id);
  return doc;
}

describe('V-05 thu hồi văn bản đi', () => {
  before(async () => {
    for (const [key, role] of [['owner', 'CHUYEN_VIEN'], ['clerk', 'VAN_THU'], ['rector', 'BAN_GIAM_HIEU'], ['staff', 'CHUYEN_VIEN']] as const) {
      const user = await prisma.user.create({ data: { email: `${runId}_${key}@cdktcnqn.edu.vn`, name: `${runId} ${key}`, role: role as UserRole } });
      u[key] = user.id;
    }
    unitId = (await prisma.organizationalUnit.create({ data: { code: `${runId}_U`.slice(0, 50), name: `Đơn vị nhận ${runId}`, type: UnitType.DEPARTMENT } })).id;
    const clerkPos = await ensurePosition('VAN_THU', JobCatalogGroup.HTPV);
    const rectorPos = await ensurePosition('HIEU_TRUONG', JobCatalogGroup.LDPU);
    const from = new Date('2020-01-01T00:00:00Z');
    await prisma.positionAssignment.create({ data: { userId: u.clerk, positionDefinitionId: clerkPos, unitId, status: AssignmentStatus.ACTIVE, effectiveFrom: from } });
    await prisma.positionAssignment.create({ data: { userId: u.rector, positionDefinitionId: rectorPos, unitId, status: AssignmentStatus.ACTIVE, effectiveFrom: from } });
  });

  after(async () => {
    const ids = Object.values(u);
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: docs } } });
    await prisma.auditEvent.deleteMany({ where: { entityId: { in: docs } } });
    await prisma.documentOutgoingWorkflow.deleteMany({ where: { documentId: { in: docs } } });
    await prisma.document.deleteMany({ where: { id: { in: docs } } });
    await prisma.positionAssignment.deleteMany({ where: { userId: { in: ids } } });
    if (createdPositions.length) await prisma.positionDefinition.deleteMany({ where: { id: { in: createdPositions } } });
    await prisma.organizationalUnit.delete({ where: { id: unitId } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });

  test('quy tắc thuần túy: thu hồi và văn bản thay thế', () => {
    assert.equal(evaluateRecall('ISSUED', []).ok, true);
    assert.equal(evaluateRecall('DELIVERED', [{ receivedAt: null }]).ok, true);
    assert.equal((evaluateRecall('ISSUED', [{ receivedAt: new Date() }]) as { code: string }).code, 'RECALL_AFTER_RECEIPT');
    assert.equal((evaluateRecall('FILED', []) as { code: string }).code, 'OUTGOING_NOT_RECALLABLE');
    assert.equal((evaluateRecall('RECALLED', []) as { code: string }).code, 'OUTGOING_NOT_RECALLABLE');
    assert.equal(evaluateReplacementTarget('RECALLED', []).ok, true);
    assert.equal(evaluateReplacementTarget('ISSUED', [{ receivedAt: new Date() }]).ok, true);
    assert.equal((evaluateReplacementTarget('ISSUED', [{ receivedAt: null }]) as { code: string }).code, 'REPLACEMENT_NOT_ALLOWED');
    assert.equal(evaluateReplacementTarget('DRAFT', []).ok, false);
  });

  test('phát hành với nơi nhận có định danh: dòng nơi nhận và danh sách văn bản được dựng', async () => {
    const doc = await makeDoc('issue', OutgoingDocumentStatus.ORGANIZATION_SIGNED);
    const res = await OutgoingDocumentService.issueDocument(
      { documentId: doc.id, recipients: [{ unitId }, { name: 'Sở Giáo dục' }, { name: 'sở giáo dục' }, { unitId }] },
      { id: u.clerk, email: 'clerk@x', name: 'clerk', role: 'VAN_THU' } as never
    );
    assert.equal(res.status, OutgoingDocumentStatus.ISSUED);
    const rows = await prisma.outgoingDocumentRecipient.findMany({ where: { documentId: doc.id } });
    assert.equal(rows.length, 2, 'trùng đơn vị hoặc tên bị gộp');
    assert.ok(rows.some((r) => r.kind === 'INTERNAL_UNIT' && r.unitId === unitId && r.name.includes('Đơn vị nhận')));
    assert.ok(rows.some((r) => r.kind === 'EXTERNAL' && r.name === 'Sở Giáo dục'));
    assert.match(res.recipientList ?? '', /Sở Giáo dục/);
  });

  test('chỉ Văn thư thu hồi; lý do bắt buộc; thu hồi xong giữ số và trạng thái đã thu hồi (AC-V05-2)', async () => {
    const doc = await makeDoc('recall', OutgoingDocumentStatus.ISSUED, { recipients: [{ name: 'Sở A' }, { name: 'Sở B' }] });
    for (const key of ['staff', 'owner', 'rector']) {
      await assert.rejects(recallOutgoing(session(key), doc.id, { reason: 'Sai nơi nhận' }), forbidden, key);
    }
    await assert.rejects(recallOutgoing(session('clerk'), doc.id, { reason: '' }), ZodError);

    const res = await recallOutgoing(session('clerk'), doc.id, { reason: 'Gửi nhầm nơi nhận' });
    assert.equal(res.status, OutgoingDocumentStatus.RECALLED);
    const wf = await prisma.documentOutgoingWorkflow.findUniqueOrThrow({ where: { documentId: doc.id } });
    assert.equal(wf.status, OutgoingDocumentStatus.RECALLED);
    assert.equal(wf.recallReason, 'Gửi nhầm nơi nhận');
    assert.equal(wf.recalledById, u.clerk);
    assert.equal(wf.outgoingNumber, 900000 + seq, 'số đã cấp giữ nguyên, không tái sử dụng');
    assert.ok(await prisma.auditEvent.findFirst({ where: { entityId: doc.id, action: 'OUTGOING_DOCUMENT_RECALLED' } }));

    await assert.rejects(recallOutgoing(session('clerk'), doc.id, { reason: 'Thu hồi lần hai' }), conflict('OUTGOING_NOT_RECALLABLE'));
    // Trạng thái cuối: không đi tiếp được.
    await assert.rejects(
      OutgoingDocumentService.issueDocument({ documentId: doc.id }, { id: u.clerk, email: 'clerk@x', name: 'clerk', role: 'VAN_THU' } as never)
    );
  });

  test('đã có nơi nhận tiếp nhận thì thu hồi trả 409 (AC-V05-1)', async () => {
    const doc = await makeDoc('received', OutgoingDocumentStatus.ISSUED, { recipients: [{ name: 'Sở C' }, { name: 'Sở D' }] });
    const [first] = doc.outgoingRecipients;
    const confirmed = await confirmReceipt(session('clerk'), doc.id, { recipientId: first.id });
    assert.equal(confirmed.changed, true);
    const again = await confirmReceipt(session('clerk'), doc.id, { recipientId: first.id });
    assert.equal(again.changed, false, 'ghi nhận lại không đổi');

    await assert.rejects(recallOutgoing(session('clerk'), doc.id, { reason: 'Muốn thu hồi' }), conflict('RECALL_AFTER_RECEIPT'));
    assert.equal((await prisma.documentOutgoingWorkflow.findUniqueOrThrow({ where: { documentId: doc.id } })).status, OutgoingDocumentStatus.ISSUED);
  });

  test('chỉ Văn thư ghi nhận tiếp nhận, và chỉ khi văn bản đang phát hành', async () => {
    const doc = await makeDoc('confirm', OutgoingDocumentStatus.ISSUED, { recipients: [{ name: 'Sở E' }] });
    const recipientId = doc.outgoingRecipients[0].id;
    for (const key of ['staff', 'owner', 'rector']) {
      await assert.rejects(confirmReceipt(session(key), doc.id, { recipientId }), forbidden, key);
    }
    await assert.rejects(confirmReceipt(session('clerk'), doc.id, { recipientId: 'khong-ton-tai' }), ApiError);

    await recallOutgoing(session('clerk'), doc.id, { reason: 'Thu hồi trước khi ai nhận' });
    await assert.rejects(confirmReceipt(session('clerk'), doc.id, { recipientId }), conflict('OUTGOING_NOT_ISSUED'));
  });

  test('văn bản thay thế: chỉ thay văn bản đã thu hồi hoặc đã có nơi nhận tiếp nhận, số mới ghi "thay thế số"', async () => {
    const clerk = { id: u.clerk, email: 'clerk@x', name: 'clerk', role: 'VAN_THU' } as never;
    const recalled = await makeDoc('old-recalled', OutgoingDocumentStatus.ISSUED, { recipients: [{ name: 'Sở F' }] });
    await recallOutgoing(session('clerk'), recalled.id, { reason: 'Sai nội dung' });
    const untouched = await makeDoc('old-live', OutgoingDocumentStatus.ISSUED, { recipients: [{ name: 'Sở G' }] });
    const received = await makeDoc('old-received', OutgoingDocumentStatus.ISSUED, { recipients: [{ name: 'Sở H' }] });
    await confirmReceipt(session('clerk'), received.id, { recipientId: received.outgoingRecipients[0].id });

    const fresh = await makeDoc('new-1', OutgoingDocumentStatus.ORGANIZATION_SIGNED);
    // Văn bản còn hiệu lực và chưa ai nhận: phải thu hồi trước.
    await assert.rejects(OutgoingDocumentService.issueDocument({ documentId: fresh.id, replacesDocumentId: untouched.id }, clerk), conflict('REPLACEMENT_NOT_ALLOWED'));
    await assert.rejects(OutgoingDocumentService.issueDocument({ documentId: fresh.id, replacesDocumentId: fresh.id }, clerk), ApiError);
    assert.equal((await prisma.documentOutgoingWorkflow.findUniqueOrThrow({ where: { documentId: fresh.id } })).status, OutgoingDocumentStatus.ORGANIZATION_SIGNED, 'phát hành lỗi không đổi trạng thái');

    await OutgoingDocumentService.issueDocument({ documentId: fresh.id, replacesDocumentId: received.id }, clerk);
    const audit = await prisma.auditEvent.findFirstOrThrow({ where: { entityId: fresh.id, action: 'OUTGOING_DOCUMENT_ISSUED' } });
    const receivedNumber = (await prisma.documentOutgoingWorkflow.findUniqueOrThrow({ where: { documentId: received.id } })).outgoingNumberStr;
    assert.ok(receivedNumber);
    assert.equal((audit.afterData as { replacesNumberStr: string }).replacesNumberStr, receivedNumber, 'nhật ký ghi "thay thế số …"');

    // Một văn bản chỉ có một văn bản thay thế.
    const second = await makeDoc('new-2', OutgoingDocumentStatus.ORGANIZATION_SIGNED);
    await assert.rejects(OutgoingDocumentService.issueDocument({ documentId: second.id, replacesDocumentId: received.id }, clerk), conflict('DOCUMENT_ALREADY_REPLACED'));

    const third = await makeDoc('new-3', OutgoingDocumentStatus.ORGANIZATION_SIGNED);
    await OutgoingDocumentService.issueDocument({ documentId: third.id, replacesDocumentId: recalled.id }, clerk);

    const state = await getRecipientsState(session('clerk'), received.id);
    assert.equal(state.replacedBy?.documentId, fresh.id);
    const newState = await getRecipientsState(session('clerk'), fresh.id);
    assert.equal(newState.replaces?.documentId, received.id);
  });

  test('trạng thái cho giao diện: quyền, lý do chưa thu hồi được, người ngoài không đọc được văn bản mật', async () => {
    const live = await makeDoc('state-live', OutgoingDocumentStatus.ISSUED, { recipients: [{ name: 'Sở I' }] });
    const asClerk = await getRecipientsState(session('clerk'), live.id);
    assert.equal(asClerk.canRecall, true);
    assert.equal(asClerk.canConfirmReceipt, true);
    assert.equal(asClerk.recallBlockedReason, null);

    const asRector = await getRecipientsState(session('rector'), live.id);
    assert.equal(asRector.canRecall, false, 'lãnh đạo không thu hồi');

    await confirmReceipt(session('clerk'), live.id, { recipientId: live.outgoingRecipients[0].id });
    const afterReceipt = await getRecipientsState(session('clerk'), live.id);
    assert.equal(afterReceipt.canRecall, false);
    assert.match(afterReceipt.recallBlockedReason ?? '', /văn bản thay thế/);

    await assert.rejects(getRecipientsState(session('staff'), live.id), ApiError, 'người không liên quan không đọc được');
  });

  test('thu hồi và ghi nhận song song: đúng một bên thắng, không để vừa thu hồi vừa có nơi nhận tiếp nhận', async () => {
    const doc = await makeDoc('race', OutgoingDocumentStatus.ISSUED, { recipients: [{ name: 'Sở K' }] });
    const recipientId = doc.outgoingRecipients[0].id;
    const results = await Promise.allSettled([
      recallOutgoing(session('clerk'), doc.id, { reason: 'Thu hồi song song' }),
      confirmReceipt(session('clerk'), doc.id, { recipientId }),
    ]);
    const wf = await prisma.documentOutgoingWorkflow.findUniqueOrThrow({ where: { documentId: doc.id } });
    const receipt = await prisma.outgoingDocumentRecipient.findUniqueOrThrow({ where: { id: recipientId } });
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.ok(!(wf.status === OutgoingDocumentStatus.RECALLED && receipt.receivedAt), 'không được cùng lúc đã thu hồi và đã tiếp nhận');
  });
});
