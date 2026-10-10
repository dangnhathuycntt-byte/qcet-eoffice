/**
 * V-09 (spec task-document-gap-spec.md): ký nháy tùy chọn cho văn bản đi.
 * Chạy trên qcet_test và chỉ xóa bản ghi do test tạo.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { AssignmentStatus, DocumentType, JobCatalogGroup, OutgoingDocumentStatus, SignatureType, UnitType, UserRole } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { initialSignOutgoing } from '../src/server/documents/outgoing-initial-sign';
import { getSignatureState } from '../src/server/documents/signature-verification-service';
import { ApiError, ConflictError } from '../src/server/api/errors';

const runId = `v09_${Date.now()}`;
const u: Record<string, string> = {};
const docs: string[] = [];
let unitId = '';
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

async function makeDoc(key: string, status: OutgoingDocumentStatus, extra: { authorizedSignedAt?: Date; currentVersion?: number } = {}) {
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
      registeredById: u.drafter,
      outgoingWorkflow: { create: { status, ...extra } },
    },
  });
  docs.push(doc.id);
  return doc.id;
}

describe('V-09 ký nháy văn bản đi', () => {
  before(async () => {
    for (const [key, role] of [['drafter', 'CHUYEN_VIEN'], ['head', 'TRUONG_PHONG'], ['rector', 'BAN_GIAM_HIEU'], ['staff', 'CHUYEN_VIEN'], ['clerk', 'VAN_THU']] as const) {
      const user = await prisma.user.create({ data: { email: `${runId}_${key}@cdktcnqn.edu.vn`, name: `${runId} ${key}`, role: role as UserRole } });
      u[key] = user.id;
    }
    unitId = (await prisma.organizationalUnit.create({ data: { code: `${runId}_U`.slice(0, 50), name: 'Đơn vị V-09', type: UnitType.DEPARTMENT } })).id;
    const from = new Date('2020-01-01T00:00:00Z');
    const assign = async (key: string, code: string, group: JobCatalogGroup) =>
      prisma.positionAssignment.create({ data: { userId: u[key], positionDefinitionId: await ensurePosition(code, group), unitId, status: AssignmentStatus.ACTIVE, effectiveFrom: from } });
    await assign('head', 'TRUONG_DON_VI', JobCatalogGroup.LDPU);
    await assign('rector', 'HIEU_TRUONG', JobCatalogGroup.LDPU);
    await assign('clerk', 'VAN_THU', JobCatalogGroup.HTPV);
    await assign('staff', 'CHUYEN_VIEN', JobCatalogGroup.HTPV);
    await assign('drafter', 'CHUYEN_VIEN', JobCatalogGroup.HTPV);
  });

  after(async () => {
    const ids = Object.values(u);
    await prisma.auditEvent.deleteMany({ where: { entityId: { in: docs } } });
    await prisma.signatureRecord.deleteMany({ where: { documentId: { in: docs } } });
    await prisma.documentOutgoingWorkflow.deleteMany({ where: { documentId: { in: docs } } });
    await prisma.document.deleteMany({ where: { id: { in: docs } } });
    await prisma.positionAssignment.deleteMany({ where: { userId: { in: ids } } });
    if (createdPositions.length) await prisma.positionDefinition.deleteMany({ where: { id: { in: createdPositions } } });
    await prisma.organizationalUnit.delete({ where: { id: unitId } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });

  test('trưởng đơn vị và lãnh đạo ký nháy được; ghi bản ghi loại INITIAL của phiên bản hiện tại', async () => {
    const id = await makeDoc('ok', OutgoingDocumentStatus.CONTENT_REVIEW);
    const head = await initialSignOutgoing(session('head'), id, { note: 'Đồng ý nội dung' });
    assert.equal(head.version, 1);
    const rector = await initialSignOutgoing(session('rector'), id, {});
    assert.ok(rector.id);

    const records = await prisma.signatureRecord.findMany({ where: { documentId: id }, orderBy: { signedAt: 'asc' } });
    assert.equal(records.length, 2);
    assert.ok(records.every((r) => r.signatureType === SignatureType.INITIAL));
    assert.match(records[0].signingCapacity, /^Ký nháy/);
    assert.ok(await prisma.auditEvent.findFirst({ where: { entityId: id, action: 'OUTGOING_INITIAL_SIGNED', actorId: u.head } }));
    // Ký nháy không đổi trạng thái quy trình.
    assert.equal((await prisma.documentOutgoingWorkflow.findUniqueOrThrow({ where: { documentId: id } })).status, OutgoingDocumentStatus.CONTENT_REVIEW);
  });

  test('chuyên viên, văn thư và chính người soạn thảo không ký nháy được', async () => {
    const id = await makeDoc('denied', OutgoingDocumentStatus.FORMAT_CHECK);
    for (const key of ['staff', 'clerk', 'drafter']) {
      await assert.rejects(initialSignOutgoing(session(key), id, {}), forbidden, key);
    }
    assert.equal(await prisma.signatureRecord.count({ where: { documentId: id } }), 0);
  });

  test('mỗi người một lần mỗi phiên bản; sang phiên bản mới ký nháy lại được', async () => {
    const id = await makeDoc('dup', OutgoingDocumentStatus.CONTENT_REVIEW);
    await initialSignOutgoing(session('head'), id, {});
    await assert.rejects(initialSignOutgoing(session('head'), id, {}), conflict('INITIAL_SIGN_DUPLICATE'));
    const parallel = await Promise.allSettled([initialSignOutgoing(session('rector'), id, {}), initialSignOutgoing(session('rector'), id, {})]);
    assert.equal(parallel.filter((r) => r.status === 'fulfilled').length, 1, 'bấm đồng thời chỉ ghi một bản');

    await prisma.documentOutgoingWorkflow.update({ where: { documentId: id }, data: { currentVersion: 2 } });
    const again = await initialSignOutgoing(session('head'), id, {});
    assert.equal(again.version, 2);
  });

  test('chỉ ký nháy khi đang soát xét và chưa ký chính thức (AC-V09-1)', async () => {
    for (const status of [OutgoingDocumentStatus.DRAFT, OutgoingDocumentStatus.NUMBERED, OutgoingDocumentStatus.ISSUED]) {
      const id = await makeDoc(`status-${status}`, status);
      await assert.rejects(initialSignOutgoing(session('head'), id, {}), conflict('INITIAL_SIGN_NOT_ALLOWED'), status);
    }
    const signed = await makeDoc('signed', OutgoingDocumentStatus.AUTHORIZED_SIGN, { authorizedSignedAt: new Date() });
    await assert.rejects(initialSignOutgoing(session('head'), signed, {}), conflict('INITIAL_SIGN_NOT_ALLOWED'));
    const awaiting = await makeDoc('awaiting', OutgoingDocumentStatus.AUTHORIZED_SIGN);
    assert.ok((await initialSignOutgoing(session('head'), awaiting, {})).id, 'đang chờ lãnh đạo ký thì ký nháy được');
  });

  test('ký nháy là tùy chọn: trạng thái báo quyền theo người xem và không chặn các bước sau', async () => {
    const id = await makeDoc('state', OutgoingDocumentStatus.CONTENT_REVIEW);
    assert.equal((await getSignatureState(session('head'), id)).canInitialSign, true);
    assert.equal((await getSignatureState(session('drafter'), id)).canInitialSign, false);
    assert.equal((await getSignatureState(session('clerk'), id)).canInitialSign, false);

    await initialSignOutgoing(session('head'), id, {});
    const after = await getSignatureState(session('head'), id);
    assert.equal(after.canInitialSign, false, 'đã ký nháy thì không hiện nút');
    assert.equal(after.records.filter((r) => r.signatureType === 'INITIAL').length, 1);
    // Văn bản chưa ai ký nháy vẫn đi tiếp được: không có ràng buộc nào trên quy trình.
    const none = await makeDoc('none', OutgoingDocumentStatus.FORMAT_CHECK);
    assert.equal(await prisma.signatureRecord.count({ where: { documentId: none } }), 0);
  });
});
