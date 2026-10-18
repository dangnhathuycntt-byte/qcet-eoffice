/**
 * Tệp gắn với mục của hồ sơ đã hủy (V-07, xóa mềm) không còn tải được qua hồ sơ đó: cả đường FileObject
 * (`/api/file-objects/[id]`) lẫn đường dẫn cũ (`/api/files/...`) trả 403 như khi không có quyền.
 * Chạy trên qcet_test và chỉ xóa bản ghi do test tạo.
 */
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { DossierStatus, FileScanStatus, UnitType, UserRole } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { signSessionToken } from '../src/lib/jwt-session';
import { GET as getFileObject } from '../src/app/api/file-objects/[id]/route';
import { GET as getLegacyFile } from '../src/app/api/files/[...path]/route';

const DAY = 86_400_000;
const runId = `fadd_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

describe('Tải tệp qua mục hồ sơ đã hủy', { concurrency: 1 }, () => {
  const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcet-dossier-disposed-'));
  const previousUploadsDir = process.env.UPLOADS_DIR;
  const objectKey = `dossier/${runId}/ban-goc.pdf`;
  const legacyKey = `dossier/${runId}/cu.pdf`;
  const content = '%PDF-1.4 QCET disposed dossier file access test';

  const users: Record<'owner' | 'contributor', { id: string; token: string }> = {
    owner: { id: '', token: '' },
    contributor: { id: '', token: '' },
  };
  let unitId = '';
  let dossierId = '';
  let fileObjectId = '';

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const downloadObject = (token: string) =>
    getFileObject(new NextRequest(`http://localhost:3000/api/file-objects/${fileObjectId}`, { headers: auth(token) }), {
      params: Promise.resolve({ id: fileObjectId }),
    });
  const downloadLegacy = (token: string) =>
    getLegacyFile(new NextRequest(`http://localhost:3000/api/files/${legacyKey}`, { headers: auth(token) }), {
      params: Promise.resolve({ path: legacyKey.split('/') }),
    });

  before(async () => {
    process.env.UPLOADS_DIR = uploadsDir;
    fs.mkdirSync(path.join(uploadsDir, 'dossier', runId), { recursive: true });
    fs.writeFileSync(path.join(uploadsDir, objectKey), content);
    fs.writeFileSync(path.join(uploadsDir, legacyKey), content);

    for (const key of ['owner', 'contributor'] as const) {
      const user = await prisma.user.create({
        data: { email: `${runId}_${key}@cdktcnqn.edu.vn`, name: `${runId} ${key}`, role: UserRole.CHUYEN_VIEN },
      });
      users[key] = {
        id: user.id,
        token: signSessionToken({ id: user.id, email: user.email, name: user.name, role: user.role }),
      };
    }
    unitId = (await prisma.organizationalUnit.create({
      data: { code: `${runId}_U`.slice(0, 50), name: 'Đơn vị hồ sơ đã hủy', type: UnitType.DEPARTMENT },
    })).id;

    fileObjectId = (await prisma.fileObject.create({
      data: {
        storageKey: objectKey,
        originalName: 'ban-goc.pdf',
        mimeType: 'application/pdf',
        extension: 'pdf',
        byteSize: BigInt(Buffer.byteLength(content)),
        contentHash: 'a'.repeat(64),
        scanStatus: FileScanStatus.CLEAN,
        uploadedById: users.contributor.id,
      },
    })).id;

    const dossier = await prisma.workDossier.create({
      data: {
        code: `${runId}_HS`,
        title: 'Hồ sơ sẽ bị hủy',
        owningUnitId: unitId,
        responsiblePersonId: users.owner.id,
        status: DossierStatus.ARCHIVED,
        archivedAt: new Date(Date.now() - 30 * DAY),
      },
    });
    dossierId = dossier.id;
    // Mục do người đóng góp thêm: người phụ trách đọc được cả hồ sơ, người đóng góp đọc được mục của mình.
    await prisma.dossierItem.createMany({
      data: [
        { dossierId, itemType: 'ATTACHMENT', title: 'Bản gốc', addedById: users.contributor.id, sequence: 1, fileObjectId },
        { dossierId, itemType: 'ATTACHMENT', title: 'Tệp cũ', addedById: users.contributor.id, sequence: 2, itemId: legacyKey },
      ],
    });
  });

  after(async () => {
    if (previousUploadsDir === undefined) delete process.env.UPLOADS_DIR;
    else process.env.UPLOADS_DIR = previousUploadsDir;
    fs.rmSync(uploadsDir, { recursive: true, force: true });

    if (dossierId) await prisma.workDossier.deleteMany({ where: { id: dossierId } });
    if (fileObjectId) await prisma.fileObject.deleteMany({ where: { id: fileObjectId } });
    if (unitId) await prisma.organizationalUnit.deleteMany({ where: { id: unitId } });
    await prisma.user.deleteMany({ where: { id: { in: Object.values(users).map((x) => x.id).filter(Boolean) } } });
  });

  test('trước khi hủy: người phụ trách và người đóng góp tải được tệp qua mục hồ sơ', async () => {
    for (const key of ['owner', 'contributor'] as const) {
      const byObject = await downloadObject(users[key].token);
      assert.equal(byObject.status, 200, `FileObject: ${key}`);
      assert.equal(await byObject.text(), content);

      const byLegacy = await downloadLegacy(users[key].token);
      assert.equal(byLegacy.status, 200, `đường dẫn cũ: ${key}`);
    }
  });

  test('sau khi hủy: không ai tải được tệp qua mục của hồ sơ đó (403 như khi không có quyền)', async () => {
    await prisma.workDossier.update({ where: { id: dossierId }, data: { disposedAt: new Date(Date.now() - DAY) } });

    for (const key of ['owner', 'contributor'] as const) {
      const byObject = await downloadObject(users[key].token);
      assert.equal(byObject.status, 403, `FileObject: ${key}`);
      assert.equal((await byObject.json()).code, 'FORBIDDEN', `FileObject: ${key}`);
      assert.equal(byObject.headers.get('cache-control'), 'private, no-store');

      const byLegacy = await downloadLegacy(users[key].token);
      assert.equal(byLegacy.status, 403, `đường dẫn cũ: ${key}`);
      assert.equal((await byLegacy.json()).code, 'FORBIDDEN', `đường dẫn cũ: ${key}`);
    }
  });
});
