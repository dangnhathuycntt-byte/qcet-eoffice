/**
 * V-03 (spec task-document-gap-spec.md): kiểm chữ ký số văn bản đến qua giao diện SignatureVerifier.
 * Chạy trên qcet_test và chỉ xóa bản ghi do test tạo.
 */
import { test, describe, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { AssignmentStatus, JobCatalogGroup, SignatureVerificationStatus, UnitType, UserRole } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { registerIncomingDocument } from '../src/lib/services/incoming-document-service';
import {
  UnverifiedSignatureVerifier,
  isSignatureFlagged,
  resetSignatureVerifier,
  setSignatureVerifier,
  verifySignatureSafely,
  type SignatureVerifier,
} from '../src/server/documents/signature-verifier';
import { getSignatureState, recheckIncomingSignature } from '../src/server/documents/signature-verification-service';
import { ApiError } from '../src/server/api/errors';

const runId = `v03_${Date.now()}`;
const u: Record<string, string> = {};
const docs: string[] = [];
let unitId = '';
let seq = 0;
const createdPositions: string[] = [];

const session = (key: string) => ({ id: u[key], email: `${key}@x`, name: key, role: 'VAN_THU' });
const forbidden = (err: unknown) => err instanceof ApiError && err.statusCode === 403;

async function ensurePosition(code: string, group: JobCatalogGroup) {
  const existing = await prisma.positionDefinition.findUnique({ where: { code } });
  if (existing) return existing.id;
  const created = await prisma.positionDefinition.create({ data: { code, title: code, group } });
  createdPositions.push(created.id);
  return created.id;
}

async function register(withFile: boolean) {
  seq += 1;
  const { document, workflow } = await registerIncomingDocument(
    {
      summary: `Văn bản đến ${runId} ${seq}`,
      issuingAuthority: 'Sở Giáo dục',
      originalNumber: `${runId}/${seq}`,
      ...(withFile ? { fileUrl: '/api/files/test.pdf', fileName: 'test.pdf', fileType: 'application/pdf', fileSize: 10 } : {}),
    } as never,
    { id: u.clerk, email: 'clerk@x', name: 'clerk', role: 'VAN_THU' } as never
  );
  docs.push(document.id);
  return { document, workflow };
}

describe('V-03 kiểm chữ ký số văn bản đến', () => {
  before(async () => {
    for (const [key, role] of [['clerk', 'VAN_THU'], ['staff', 'CHUYEN_VIEN']] as const) {
      const user = await prisma.user.create({ data: { email: `${runId}_${key}@cdktcnqn.edu.vn`, name: `${runId} ${key}`, role: role as UserRole } });
      u[key] = user.id;
    }
    unitId = (await prisma.organizationalUnit.create({ data: { code: `${runId}_U`.slice(0, 50), name: 'Đơn vị V-03', type: UnitType.DEPARTMENT } })).id;
    const clerkPos = await ensurePosition('VAN_THU', JobCatalogGroup.HTPV);
    await prisma.positionAssignment.create({ data: { userId: u.clerk, positionDefinitionId: clerkPos, unitId, status: AssignmentStatus.ACTIVE, effectiveFrom: new Date('2020-01-01T00:00:00Z') } });
  });

  afterEach(() => resetSignatureVerifier());

  after(async () => {
    const ids = Object.values(u);
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: docs } } });
    await prisma.auditEvent.deleteMany({ where: { entityId: { in: docs } } });
    await prisma.documentIncomingWorkflow.deleteMany({ where: { documentId: { in: docs } } });
    await prisma.documentAttachment.deleteMany({ where: { documentId: { in: docs } } });
    await prisma.document.deleteMany({ where: { id: { in: docs } } });
    await prisma.positionAssignment.deleteMany({ where: { userId: { in: ids } } });
    if (createdPositions.length) await prisma.positionDefinition.deleteMany({ where: { id: { in: createdPositions } } });
    await prisma.organizationalUnit.delete({ where: { id: unitId } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });

  test('bản mặc định không bao giờ trả VALID; UNVERIFIED bị gắn cờ', async () => {
    const verifier = new UnverifiedSignatureVerifier();
    for (const fileUrl of ['/api/files/a.pdf', null]) {
      const result = await verifier.verify({ fileUrl });
      assert.equal(result.status, SignatureVerificationStatus.UNVERIFIED);
      assert.ok(result.detail);
    }
    assert.equal(isSignatureFlagged(SignatureVerificationStatus.UNVERIFIED), true);
    assert.equal(isSignatureFlagged(SignatureVerificationStatus.INVALID), true);
    assert.equal(isSignatureFlagged(SignatureVerificationStatus.REVOKED), true);
    assert.equal(isSignatureFlagged(SignatureVerificationStatus.VALID), false);
  });

  test('văn bản đến được kiểm khi nhận và ghi trạng thái chưa xác thực (AC-V03-1)', async () => {
    const { workflow } = await register(true);
    assert.equal(workflow.signatureStatus, SignatureVerificationStatus.UNVERIFIED);
    assert.ok(workflow.signatureCheckedAt);
    assert.match(workflow.signatureDetail ?? '', /Chưa tích hợp/);

    const noFile = await register(false);
    assert.equal(noFile.workflow.signatureStatus, SignatureVerificationStatus.UNVERIFIED);
    assert.match(noFile.workflow.signatureDetail ?? '', /Không có tệp/);
  });

  test('nhà cung cấp trả INVALID thì ghi nhận; nhà cung cấp lỗi thì UNVERIFIED và vẫn nhận được văn bản', async () => {
    const invalid: SignatureVerifier = { name: 'fake-invalid', verify: async () => ({ status: SignatureVerificationStatus.INVALID, detail: 'Chữ ký không khớp nội dung' }) };
    setSignatureVerifier(invalid);
    const bad = await register(true);
    assert.equal(bad.workflow.signatureStatus, SignatureVerificationStatus.INVALID);

    const broken: SignatureVerifier = { name: 'fake-broken', verify: async () => { throw new Error('timeout'); } };
    setSignatureVerifier(broken);
    assert.equal((await verifySignatureSafely({ fileUrl: 'x' })).status, SignatureVerificationStatus.UNVERIFIED);
    const survived = await register(true);
    assert.equal(survived.workflow.signatureStatus, SignatureVerificationStatus.UNVERIFIED);
    assert.match(survived.workflow.signatureDetail ?? '', /không phản hồi/);
  });

  test('Văn thư kiểm lại được khi có nhà cung cấp mới; người khác thì không; có nhật ký', async () => {
    const { document } = await register(true);
    await assert.rejects(recheckIncomingSignature(session('staff'), document.id), forbidden);

    const valid: SignatureVerifier = { name: 'fake-valid', verify: async () => ({ status: SignatureVerificationStatus.VALID, detail: null }) };
    setSignatureVerifier(valid);
    const result = await recheckIncomingSignature(session('clerk'), document.id);
    assert.equal(result.status, 'VALID');
    assert.equal(result.flagged, false);
    const wf = await prisma.documentIncomingWorkflow.findUniqueOrThrow({ where: { documentId: document.id } });
    assert.equal(wf.signatureStatus, SignatureVerificationStatus.VALID);
    assert.ok(await prisma.auditEvent.findFirst({ where: { entityId: document.id, action: 'DOCUMENT_SIGNATURE_VERIFIED' } }));
    await assert.rejects(recheckIncomingSignature(session('clerk'), 'khong-ton-tai'), ApiError);
  });

  test('trạng thái đọc được qua GET: cờ, quyền kiểm lại; người ngoài không đọc được văn bản mật', async () => {
    const { document } = await register(true);
    const state = await getSignatureState(session('clerk'), document.id);
    assert.equal(state.incoming?.status, 'UNVERIFIED');
    assert.equal(state.incoming?.flagged, true);
    assert.equal(state.canRecheck, true);
    assert.deepEqual(state.records, []);

    await prisma.document.update({ where: { id: document.id }, data: { securityLevel: 'TUYET_MAT' } });
    await assert.rejects(getSignatureState(session('clerk'), document.id), ApiError);
  });
});
