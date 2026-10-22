/**
 * ADR-015: QCET chỉ gửi nhận trong trường. Không tạo văn bản đến; văn bản đi đã phát hành tới đơn vị nào thì đơn vị đó
 * thấy trong sổ Văn bản đến (không ở sổ Văn bản đi), mở được, trưởng đơn vị nhận bấm tiếp nhận và được báo khi phát hành.
 * Chạy trên qcet_test và chỉ xóa bản ghi do test tạo.
 */
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { AssignmentStatus, DocumentType, JobCatalogGroup, OutgoingDocumentStatus, UnitType, UserRole } from '@prisma/client';
import { prisma } from '@qcet/db/prisma';
import { signSessionToken } from '../src/lib/jwt-session';
import { resetRateLimits } from '../src/server/security/rate-limit';
import { OutgoingDocumentService } from '../src/server/documents/outgoing-document-service';
import { confirmReceipt, getRecipientsState, recallOutgoing, RecipientsSchema } from '../src/server/documents/outgoing-recipients';
import { runOutboxCycle } from '../src/server/outbox/outbox-worker';
import { ApiError } from '../src/server/api/errors';
import { authorizeFileObjectDownload } from '../src/server/files/file-access-service';
import { listReadableDocuments } from '../src/server/assistant/assistant-tool-documents';
import { loadAuthorizationContext } from '../src/server/authorization/authorization-context-service';
import { GET as listDocumentsRoute, POST as createDocumentRoute } from '../src/app/api/documents/route';
import { POST as registerIncomingRoute } from '../src/app/api/documents/incoming/route';
import { GET as getDocumentRoute } from '../src/app/api/documents/[id]/route';
import { GET as getStatsRoute } from '../src/app/api/documents/stats/route';

const runId = `dlv${Date.now()}${Math.floor(Math.random() * 1000)}`;
const u: Record<string, { id: string; role: UserRole }> = {};
const unit: Record<'sender' | 'recipient' | 'other', string> = { sender: '', recipient: '', other: '' };
const docs: string[] = [];
const createdPositions: string[] = [];
let seq = 0;

const tokenOf = (key: string) => signSessionToken({ id: u[key].id, email: `${runId}_${key}@x`, name: key, role: u[key].role });
const session = (key: string) => ({ id: u[key].id, email: `${key}@x`, name: key, role: u[key].role });
const clerkActor = () => ({ id: u.clerk.id, email: 'clerk@x', name: 'clerk', role: 'VAN_THU' }) as never;
const forbidden = (err: unknown) => err instanceof ApiError && err.statusCode === 403;

async function ensurePosition(code: string, group: JobCatalogGroup) {
  const existing = await prisma.positionDefinition.findUnique({ where: { code } });
  if (existing) return existing.id;
  const created = await prisma.positionDefinition.create({ data: { code, title: code, group, isLeadership: group === JobCatalogGroup.LDPU } });
  createdPositions.push(created.id);
  return created.id;
}

/** Văn bản đi đã đóng dấu cơ quan (chờ phát hành), do người soạn ở đơn vị gửi. */
async function makeSignedDoc(key: string) {
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
      registeredById: u.drafter.id,
      outgoingWorkflow: { create: { status: OutgoingDocumentStatus.ORGANIZATION_SIGNED, outgoingNumber: 800000 + seq, outgoingNumberStr: `${800000 + seq}/QCET` } },
    },
  });
  docs.push(doc.id);
  return doc;
}

async function issueTo(documentId: string, unitIds: string[]) {
  await OutgoingDocumentService.issueDocument({ documentId, recipients: unitIds.map((unitId) => ({ unitId })) }, clerkActor());
}

async function listIds(key: string, query: string) {
  const res = await listDocumentsRoute(
    new NextRequest(`http://localhost:3000/api/documents?${query}&search=${runId}`, { headers: { authorization: `Bearer ${tokenOf(key)}` } })
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  return (body.documents as Array<{ id: string }>).map((d) => d.id);
}

async function detailStatus(key: string, id: string) {
  const res = await getDocumentRoute(new NextRequest(`http://localhost:3000/api/documents/${id}`, { headers: { authorization: `Bearer ${tokenOf(key)}` } }), {
    params: Promise.resolve({ id }),
  });
  return res.status;
}

async function stats(key: string) {
  const res = await getStatsRoute(new NextRequest('http://localhost:3000/api/documents/stats', { headers: { authorization: `Bearer ${tokenOf(key)}` } }));
  assert.equal(res.status, 200);
  return (await res.json()).data as { incoming: number; outgoing: number; buckets: { incomingPending: number; incomingDone: number } };
}

describe('ADR-015 văn bản đến phát sinh từ phát hành văn bản đi', () => {
  before(async () => {
    unit.sender = (await prisma.organizationalUnit.create({ data: { code: `${runId}_S`.slice(0, 50), name: `Đơn vị gửi ${runId}`, type: UnitType.DEPARTMENT } })).id;
    unit.recipient = (await prisma.organizationalUnit.create({ data: { code: `${runId}_R`.slice(0, 50), name: `Đơn vị nhận ${runId}`, type: UnitType.DEPARTMENT } })).id;
    unit.other = (await prisma.organizationalUnit.create({ data: { code: `${runId}_O`.slice(0, 50), name: `Đơn vị khác ${runId}`, type: UnitType.DEPARTMENT } })).id;
    const clerkPos = await ensurePosition('VAN_THU', JobCatalogGroup.HTPV);
    const headPos = await ensurePosition('TRUONG_DON_VI', JobCatalogGroup.LDPU);
    const staffPos = await ensurePosition('CHUYEN_VIEN', JobCatalogGroup.VCDC);
    const members: Array<[string, UserRole, string, string]> = [
      ['clerk', UserRole.VAN_THU, clerkPos, unit.sender],
      ['drafter', UserRole.CHUYEN_VIEN, staffPos, unit.sender],
      ['head', UserRole.TRUONG_PHONG, headPos, unit.recipient],
      ['staff', UserRole.CHUYEN_VIEN, staffPos, unit.recipient],
      ['outsider', UserRole.CHUYEN_VIEN, staffPos, unit.other],
    ];
    for (const [key, role, positionDefinitionId, unitId] of members) {
      const user = await prisma.user.create({ data: { email: `${runId}_${key}@cdktcnqn.edu.vn`, name: `${runId} ${key}`, role } });
      u[key] = { id: user.id, role };
      await prisma.positionAssignment.create({
        data: { userId: user.id, positionDefinitionId, unitId, status: AssignmentStatus.ACTIVE, effectiveFrom: new Date('2020-01-01T00:00:00Z') },
      });
    }
  });

  beforeEach(() => resetRateLimits());

  after(async () => {
    const ids = Object.values(u).map((x) => x.id);
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: docs } } });
    await prisma.auditEvent.deleteMany({ where: { entityId: { in: docs } } });
    await prisma.documentOutgoingWorkflow.deleteMany({ where: { documentId: { in: docs } } });
    await prisma.document.deleteMany({ where: { id: { in: docs } } });
    await prisma.fileObject.deleteMany({ where: { uploadedById: { in: ids } } });
    await prisma.positionAssignment.deleteMany({ where: { userId: { in: ids } } });
    if (createdPositions.length) await prisma.positionDefinition.deleteMany({ where: { id: { in: createdPositions } } });
    await prisma.organizationalUnit.deleteMany({ where: { id: { in: Object.values(unit) } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });

  it('không ai tạo được văn bản đến, kể cả văn thư (403 ở cả hai route)', async () => {
    const body = JSON.stringify({
      type: 'VAN_BAN_DEN',
      originalNumber: `${runId}/DEN`,
      issuedDate: new Date().toISOString(),
      issuingAuthority: 'Sở GD&ĐT',
      category: 'Công văn',
      summary: 'Văn bản đến tạo tay',
    });
    for (const key of ['clerk', 'staff']) {
      const res = await createDocumentRoute(
        new NextRequest('http://localhost:3000/api/documents', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${tokenOf(key)}` }, body })
      );
      assert.equal(res.status, 403, key);
    }
    const res = await registerIncomingRoute(
      new NextRequest('http://localhost:3000/api/documents/incoming', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${tokenOf('clerk')}` },
        body: JSON.stringify({ title: 'Văn bản đến tạo tay', issuingAuthority: 'Sở GD&ĐT' }),
      })
    );
    assert.equal(res.status, 403);
    assert.equal(await prisma.document.count({ where: { originalNumber: `${runId}/DEN` } }), 0);
  });

  it('chỉ phát hành tới đơn vị trong trường: nơi nhận chỉ có tên cơ quan bị từ chối', () => {
    assert.equal(RecipientsSchema.safeParse([{ name: 'Sở Giáo dục' }]).success, false);
    assert.equal(RecipientsSchema.safeParse([{ unitId: unit.recipient }]).success, true);
  });

  it('phát hành rồi đơn vị nhận mới thấy ở sổ Văn bản đến, mở được; không ở sổ Văn bản đi; đơn vị khác không thấy', async () => {
    const doc = await makeSignedDoc('flow');
    assert.ok(!(await listIds('staff', 'type=VAN_BAN_DEN')).includes(doc.id), 'chưa phát hành thì chưa tới');
    assert.equal(await detailStatus('staff', doc.id), 403);

    await issueTo(doc.id, [unit.recipient]);

    assert.ok((await listIds('staff', 'type=VAN_BAN_DEN')).includes(doc.id), 'thành viên đơn vị nhận thấy ở sổ đến');
    assert.ok((await listIds('head', 'type=VAN_BAN_DEN')).includes(doc.id));
    assert.ok(!(await listIds('staff', 'type=VAN_BAN_DI')).includes(doc.id), 'không lẫn vào sổ đi của đơn vị nhận');
    assert.equal(await detailStatus('staff', doc.id), 200);

    assert.ok(!(await listIds('outsider', 'type=VAN_BAN_DEN')).includes(doc.id));
    assert.equal(await detailStatus('outsider', doc.id), 403);

    // Trợ lý đọc cùng sổ: văn bản đến gồm văn bản được gửi tới, văn bản đi thì không.
    const authz = await loadAuthorizationContext(u.staff.id, new Date());
    const asked = async (type: DocumentType) => (await listReadableDocuments(authz, { type, query: runId, limit: 20 })).documents.map((d) => d.id);
    assert.ok((await asked(DocumentType.VAN_BAN_DEN)).includes(doc.id));
    assert.ok(!(await asked(DocumentType.VAN_BAN_DI)).includes(doc.id));

    // Bên gửi vẫn thấy ở sổ đi như trước, không thấy ở sổ đến (đơn vị gửi không có trong nơi nhận).
    assert.ok((await listIds('drafter', 'type=VAN_BAN_DI')).includes(doc.id));
    assert.ok(!(await listIds('drafter', 'type=VAN_BAN_DEN')).includes(doc.id));
  });

  it('tiếp nhận: trưởng đơn vị nhận bấm; văn thư bên gửi và chuyên viên không bấm được; nhóm Chờ xử lý → Đã xử lý và bộ đếm khớp', async () => {
    const doc = await makeSignedDoc('receipt');
    await issueTo(doc.id, [unit.recipient]);
    const recipientId = (await prisma.outgoingDocumentRecipient.findFirstOrThrow({ where: { documentId: doc.id } })).id;

    assert.ok((await listIds('staff', 'type=VAN_BAN_DEN&bucket=pending')).includes(doc.id));
    assert.ok(!(await listIds('staff', 'type=VAN_BAN_DEN&bucket=done')).includes(doc.id));
    const before = await stats('staff');
    assert.ok(before.incoming >= 1);
    assert.ok(before.buckets.incomingPending >= 1);

    assert.equal((await getRecipientsState(session('head'), doc.id)).recipients[0].canConfirm, true);
    assert.equal((await getRecipientsState(session('staff'), doc.id)).recipients[0].canConfirm, false);
    assert.equal((await getRecipientsState(session('clerk'), doc.id)).recipients[0].canConfirm, false);
    for (const key of ['clerk', 'staff', 'outsider']) {
      await assert.rejects(confirmReceipt(session(key), doc.id, { recipientId }), forbidden, key);
    }

    const res = await confirmReceipt(session('head'), doc.id, { recipientId });
    assert.equal(res.changed, true);
    assert.ok((await listIds('staff', 'type=VAN_BAN_DEN&bucket=done')).includes(doc.id));
    assert.ok(!(await listIds('staff', 'type=VAN_BAN_DEN&bucket=pending')).includes(doc.id));
    const after = await stats('staff');
    assert.equal(after.buckets.incomingPending, before.buckets.incomingPending - 1);
    assert.equal(after.buckets.incomingDone, before.buckets.incomingDone + 1);
    assert.equal(after.outgoing, 0, 'đơn vị nhận không có văn bản đi nào');
  });

  it('phát hành báo trưởng đơn vị nhận; sự kiện cũ của văn bản đến bị bỏ qua', async () => {
    const doc = await makeSignedDoc('notify');
    await issueTo(doc.id, [unit.recipient]);
    const event = await prisma.outboxEvent.findFirstOrThrow({ where: { aggregateId: doc.id, eventType: 'DOCUMENT_ISSUED_NOTIFICATION' } });
    await runOutboxCycle(prisma, { ids: [event.id] });
    const notes = await prisma.notification.findMany({ where: { type: 'document_delivered', linkHref: { contains: doc.id } } });
    assert.deepEqual(notes.map((n) => n.userId), [u.head.id]);
    assert.match(notes[0].body, /Mở văn bản để tiếp nhận/);

    // Sự kiện cùng loại do bước vào sổ cũ (văn bản đến) để lại: hoàn tất mà không báo ai.
    seq += 1;
    const legacy = await prisma.document.create({
      data: {
        type: DocumentType.VAN_BAN_DEN,
        registrationNumber: -(Math.floor(Math.random() * 2_000_000_000) + 1),
        documentYear: 2026,
        originalNumber: `${runId}-legacy`,
        issuedDate: new Date('2026-10-01'),
        issuingAuthority: 'Sở GD&ĐT',
        category: 'Công văn',
        summary: `Văn bản đến cũ ${runId}`,
        registeredById: u.clerk.id,
      },
    });
    docs.push(legacy.id);
    const legacyEvent = await prisma.outboxEvent.create({
      data: { eventType: 'DOCUMENT_ISSUED_NOTIFICATION', aggregateType: 'DOCUMENT', aggregateId: legacy.id, payload: { documentId: legacy.id } },
    });
    await runOutboxCycle(prisma, { ids: [legacyEvent.id] });
    assert.equal((await prisma.outboxEvent.findUniqueOrThrow({ where: { id: legacyEvent.id } })).status, 'COMPLETED');
    assert.equal(await prisma.notification.count({ where: { linkHref: { contains: legacy.id } } }), 0);
  });

  it('đơn vị nhận tải được tệp đính kèm của văn bản gửi tới, đơn vị khác không', async () => {
    const doc = await makeSignedDoc('file');
    const file = await prisma.fileObject.create({
      data: {
        storageKey: `${runId}/du-thao.pdf`,
        originalName: 'du-thao.pdf',
        mimeType: 'application/pdf',
        extension: 'pdf',
        byteSize: BigInt(10),
        contentHash: 'a'.repeat(64),
        scanStatus: 'CLEAN',
        uploadedById: u.drafter.id,
      },
    });
    await prisma.documentAttachment.create({
      data: { documentId: doc.id, fileName: 'du-thao.pdf', fileUrl: `/api/file-objects/${file.id}`, fileObjectId: file.id, fileSize: 10, mimeType: 'application/pdf' },
    });
    const download = (key: string) =>
      authorizeFileObjectDownload({ authUser: session(key) as never, fileObjectId: file.id, requestId: `${runId}-${key}` });
    await assert.rejects(download('staff'), forbidden, 'chưa phát hành thì chưa tải được');
    await issueTo(doc.id, [unit.recipient]);
    await download('staff');
    await assert.rejects(download('outsider'), forbidden);
  });

  it('thu hồi: đơn vị nhận vẫn mở được để đọc thông báo thu hồi, văn bản rời nhóm Chờ xử lý', async () => {
    const doc = await makeSignedDoc('recall');
    await issueTo(doc.id, [unit.recipient]);
    await recallOutgoing(session('clerk'), doc.id, { reason: 'Gửi nhầm nội dung' });
    assert.equal(await detailStatus('staff', doc.id), 200);
    assert.ok(!(await listIds('staff', 'type=VAN_BAN_DEN&bucket=pending')).includes(doc.id));
    assert.ok((await listIds('staff', 'type=VAN_BAN_DEN&bucket=done')).includes(doc.id));
  });
});
