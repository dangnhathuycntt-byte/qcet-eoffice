/**
 * V-07 (spec task-document-gap-spec.md): xóa hẳn hồ sơ kéo theo xóa tệp vật lý qua outbox.
 * Chạy trên qcet_test, tệp ghi vào thư mục tạm riêng; chỉ xóa bản ghi do test tạo.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DocumentType, DossierItemType, DossierStatus, UnitType, UserRole } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { purgeDossier } from '../src/server/dossiers/dossier-disposal-service';
import { purgeFileObject } from '../src/server/files/file-object-purge';
import { runOutboxCycle } from '../src/server/outbox/outbox-worker';

const runId = `fpurge_${Date.now()}`;
const u: Record<string, string> = {};
let unitId = '';
const dossiers: string[] = [];
const files: string[] = [];
const documents: string[] = [];
let uploadsDir = '';
const previousUploadsDir = process.env.UPLOADS_DIR;

const NOW = new Date('2026-10-10T08:00:00Z');
const admin = () => ({ id: u.admin, email: 'admin@x', name: 'admin', role: 'ADMIN' });

async function makeFile(key: string) {
  const bytes = Buffer.from(`${runId}-${key}-${crypto.randomUUID()}`);
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');
  const storageKey = `${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash}.pdf`;
  const absolute = path.join(uploadsDir, storageKey);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, bytes);
  const f = await prisma.fileObject.create({
    data: { storageKey, originalName: `${key}.pdf`, mimeType: 'application/pdf', extension: '.pdf', byteSize: BigInt(bytes.length), contentHash: hash, uploadedById: u.admin },
  });
  files.push(f.id);
  return { id: f.id, absolute };
}

const exists = (p: string) => fs.stat(p).then(() => true, () => false);

async function makeDossier(key: string, disposed: boolean) {
  const d = await prisma.workDossier.create({
    data: {
      code: `${runId}_${key}`.slice(0, 100),
      title: `Hồ sơ ${key}`,
      owningUnitId: unitId,
      responsiblePersonId: u.owner,
      status: DossierStatus.ARCHIVED,
      archivedAt: new Date('2015-01-01T00:00:00Z'),
      disposedAt: disposed ? new Date('2026-10-01T00:00:00Z') : null,
      disposedById: disposed ? u.rector : null,
    },
  });
  dossiers.push(d.id);
  if (disposed) {
    await prisma.dossierDisposalProposal.create({
      data: { dossierId: d.id, proposedById: u.clerk, minutesReference: `BB-${key}`, reason: 'Hết hạn', status: 'DISPOSE', decidedById: u.rector, decidedAt: new Date('2026-10-01T00:00:00Z') },
    });
  }
  return d.id;
}

async function addItem(dossierId: string, fileObjectId: string | null, data: { itemType?: DossierItemType; itemId?: string } = {}) {
  await prisma.dossierItem.create({
    data: { dossierId, itemType: data.itemType ?? DossierItemType.ATTACHMENT, itemId: data.itemId ?? null, title: 'Tài liệu', addedById: u.owner, fileObjectId },
  });
}

async function runPurgeEvents(fileObjectIds: string[]) {
  const events = await prisma.outboxEvent.findMany({ where: { eventType: 'FILE_OBJECT_PURGE_REQUESTED', aggregateId: { in: fileObjectIds } }, select: { id: true } });
  await runOutboxCycle(prisma, { ids: events.map((e) => e.id), now: new Date() });
  return events.length;
}

describe('V-07 xóa tệp vật lý khi xóa hẳn hồ sơ', () => {
  before(async () => {
    uploadsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qcet-fpurge-'));
    process.env.UPLOADS_DIR = uploadsDir;
    for (const [key, role] of [['owner', 'CHUYEN_VIEN'], ['clerk', 'VAN_THU'], ['rector', 'BAN_GIAM_HIEU'], ['admin', 'ADMIN']] as const) {
      u[key] = (await prisma.user.create({ data: { email: `${runId}_${key}@cdktcnqn.edu.vn`, name: `${runId} ${key}`, role: role as UserRole } })).id;
    }
    unitId = (await prisma.organizationalUnit.create({ data: { code: `${runId}_U`.slice(0, 50), name: 'Đơn vị xóa tệp', type: UnitType.DEPARTMENT } })).id;
  });

  after(async () => {
    const ids = Object.values(u);
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: [...dossiers, ...files] } } });
    await prisma.auditEvent.deleteMany({ where: { entityId: { in: [...dossiers, ...files] } } });
    await prisma.workDossier.deleteMany({ where: { id: { in: dossiers } } });
    await prisma.document.deleteMany({ where: { id: { in: documents } } });
    await prisma.fileObject.deleteMany({ where: { id: { in: files } } });
    await prisma.organizationalUnit.delete({ where: { id: unitId } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    if (previousUploadsDir === undefined) delete process.env.UPLOADS_DIR;
    else process.env.UPLOADS_DIR = previousUploadsDir;
    await fs.rm(uploadsDir, { recursive: true, force: true });
  });

  test('xóa hẳn hồ sơ chỉ ghi outbox; tệp không ai dùng bị xóa khỏi đĩa và DB khi outbox chạy, có nhật ký', async () => {
    const id = await makeDossier('solo', true);
    const a = await makeFile('a');
    const b = await makeFile('b');
    await addItem(id, a.id);
    await addItem(id, a.id); // cùng tệp ở hai mục: chỉ một yêu cầu xóa
    await addItem(id, b.id);
    await addItem(id, null);

    const res = await purgeDossier(admin(), id, NOW);
    assert.equal(res.filePurgesRequested, 2);
    // Trong giao dịch chưa đụng đĩa.
    assert.ok(await exists(a.absolute));
    assert.equal(await prisma.fileObject.count({ where: { id: { in: [a.id, b.id] } } }), 2);

    assert.equal(await runPurgeEvents([a.id, b.id]), 2);
    assert.equal(await exists(a.absolute), false);
    assert.equal(await exists(b.absolute), false);
    assert.equal(await prisma.fileObject.count({ where: { id: { in: [a.id, b.id] } } }), 0);
    const audit = await prisma.auditEvent.findFirstOrThrow({ where: { entityId: a.id, action: 'FILE_OBJECT_PURGED' } });
    assert.equal(audit.actorId, u.admin);
    assert.equal((audit.metadata as { dossierId: string }).dossierId, id);
    const events = await prisma.outboxEvent.findMany({ where: { aggregateId: { in: [a.id, b.id] } } });
    assert.ok(events.every((e) => e.status === 'COMPLETED'));
  });

  test('tệp còn được hồ sơ khác dùng thì giữ nguyên cả tệp và bản ghi', async () => {
    const purged = await makeDossier('shared1', true);
    const other = await makeDossier('shared2', false);
    const f = await makeFile('shared');
    await addItem(purged, f.id);
    await addItem(other, f.id);

    await purgeDossier(admin(), purged, NOW);
    await runPurgeEvents([f.id]);
    assert.ok(await exists(f.absolute));
    const row = await prisma.fileObject.findUniqueOrThrow({ where: { id: f.id } });
    assert.equal(row.isArchived, false);
    assert.ok(await prisma.auditEvent.findFirst({ where: { entityId: f.id, action: 'FILE_OBJECT_PURGE_SKIPPED' } }));
  });

  test('không xóa văn bản trong hồ sơ, kể cả tệp đính kèm của văn bản trùng với tệp của mục hồ sơ', async () => {
    const id = await makeDossier('withdoc', true);
    const f = await makeFile('doc');
    const doc = await prisma.document.create({
      data: {
        type: DocumentType.VAN_BAN_DEN,
        registrationNumber: 800000 + Math.floor(Math.random() * 99999),
        documentYear: 2026,
        originalNumber: `${runId}/DOC`,
        issuedDate: new Date('2015-01-01'),
        issuingAuthority: 'Sở',
        category: 'Công văn',
        summary: 'Văn bản trong hồ sơ',
        registeredById: u.clerk,
        attachments: { create: { fileName: 'doc.pdf', fileUrl: `/api/file-objects/${f.id}`, fileObjectId: f.id, fileSize: 10, mimeType: 'application/pdf' } },
      },
    });
    documents.push(doc.id);
    await addItem(id, f.id, { itemType: DossierItemType.DOCUMENT, itemId: doc.id });

    await purgeDossier(admin(), id, NOW);
    await runPurgeEvents([f.id]);
    assert.equal(await prisma.document.count({ where: { id: doc.id } }), 1, 'văn bản còn nguyên');
    assert.equal(await prisma.documentAttachment.count({ where: { documentId: doc.id } }), 1);
    assert.ok(await exists(f.absolute), 'tệp của văn bản còn nguyên');
  });

  test('idempotent: chạy lại sau khi đã xóa, hoặc sau khi đã gắn cờ mà tệp đã mất, vẫn đúng', async () => {
    const f = await makeFile('idem');
    assert.equal(await purgeFileObject({ fileObjectId: f.id, requestedById: u.admin, reason: 'TEST' }, NOW), 'deleted');
    assert.equal(await purgeFileObject({ fileObjectId: f.id, requestedById: u.admin, reason: 'TEST' }, NOW), 'missing');

    // Lần chạy trước dừng sau bước xóa đĩa: dòng còn, đã gắn cờ, tệp đã mất.
    const g = await makeFile('half');
    await prisma.fileObject.update({ where: { id: g.id }, data: { isArchived: true } });
    await fs.rm(g.absolute);
    assert.equal(await purgeFileObject({ fileObjectId: g.id, requestedById: u.admin, reason: 'TEST' }, NOW), 'deleted');
    assert.equal(await prisma.fileObject.count({ where: { id: g.id } }), 0);
  });

  test('đã gắn cờ chờ xóa mà có tham chiếu mới thì trả tệp về dùng được, không xóa', async () => {
    const holder = await makeDossier('late', false);
    const f = await makeFile('late');
    await prisma.fileObject.update({ where: { id: f.id }, data: { isArchived: true } });
    await addItem(holder, f.id);
    assert.equal(await purgeFileObject({ fileObjectId: f.id, requestedById: u.admin, reason: 'TEST' }, NOW), 'referenced');
    assert.ok(await exists(f.absolute));
    assert.equal((await prisma.fileObject.findUniqueOrThrow({ where: { id: f.id } })).isArchived, false);
  });

  test('tệp nhúng trong mô tả nhiệm vụ hoặc gắn theo đường dẫn cũng được tính là còn dùng', async () => {
    const f = await makeFile('legacyurl');
    const doc = await prisma.document.create({
      data: {
        type: DocumentType.VAN_BAN_DEN,
        registrationNumber: 700000 + Math.floor(Math.random() * 99999),
        documentYear: 2026,
        originalNumber: `${runId}/URL`,
        issuedDate: new Date('2015-01-01'),
        issuingAuthority: 'Sở',
        category: 'Công văn',
        summary: 'Đính kèm theo đường dẫn',
        registeredById: u.clerk,
        attachments: { create: { fileName: 'x.pdf', fileUrl: `/api/file-objects/${f.id}`, fileSize: 10, mimeType: 'application/pdf' } },
      },
    });
    documents.push(doc.id);
    assert.equal(await purgeFileObject({ fileObjectId: f.id, requestedById: u.admin, reason: 'TEST' }, NOW), 'referenced');
    assert.ok(await exists(f.absolute));
  });
});
