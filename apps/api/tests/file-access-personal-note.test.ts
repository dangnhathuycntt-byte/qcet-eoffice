/**
 * Ảnh/tệp chèn vào ghi chú cá nhân (editor khối tải lên không gắn đối tượng nào): chỉ chủ ghi chú, cũng là người tải lên, tải
 * được khi còn ghi chú chứa mã tệp; người khác dán mã tệp vào ghi chú của họ không tự có quyền. Ghi chú còn dùng tệp thì tệp
 * không bị xóa khi dọn tệp. Chạy trên qcet_test và chỉ xóa bản ghi do test tạo.
 */
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { FileScanStatus, UserRole } from '@prisma/client';
import { prisma } from '@qcet/db/prisma';
import { signSessionToken } from '../src/lib/jwt-session';
import { GET as getFileObject } from '../src/app/api/file-objects/[id]/route';
import { countFileObjectReferences } from '../src/server/files/file-object-purge';

const runId = `fapn_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

describe('Tải ảnh chèn trong ghi chú cá nhân', { concurrency: 1 }, () => {
  const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qcet-personal-note-file-'));
  const previousUploadsDir = process.env.UPLOADS_DIR;
  const objectKey = `notes/${runId}/anh.png`;
  const content = 'PNG QCET personal note file access test';

  const users: Record<'owner' | 'other', { id: string; token: string }> = {
    owner: { id: '', token: '' },
    other: { id: '', token: '' },
  };
  let fileObjectId = '';

  const download = (token: string) =>
    getFileObject(
      new NextRequest(`http://localhost:3000/api/file-objects/${fileObjectId}`, { headers: { Authorization: `Bearer ${token}` } }),
      { params: Promise.resolve({ id: fileObjectId }) }
    );
  /** Nội dung như editor khối lưu: khối ảnh trỏ tới `/api/file-objects/{id}`. */
  const noteContent = () =>
    JSON.stringify({
      qcetBlocks: true,
      version: 1,
      blocks: [{ id: 'b1', type: 'image', content: 'anh.png', url: `/api/file-objects/${fileObjectId}`, imageWidth: 100 }],
    });

  before(async () => {
    process.env.UPLOADS_DIR = uploadsDir;
    fs.mkdirSync(path.join(uploadsDir, 'notes', runId), { recursive: true });
    fs.writeFileSync(path.join(uploadsDir, objectKey), content);

    for (const key of ['owner', 'other'] as const) {
      const user = await prisma.user.create({
        data: { email: `${runId}_${key}@cdktcnqn.edu.vn`, name: `${runId} ${key}`, role: UserRole.CHUYEN_VIEN },
      });
      users[key] = { id: user.id, token: signSessionToken({ id: user.id, email: user.email, name: user.name, role: user.role }) };
    }

    fileObjectId = (await prisma.fileObject.create({
      data: {
        storageKey: objectKey,
        originalName: 'anh.png',
        mimeType: 'image/png',
        extension: 'png',
        byteSize: BigInt(Buffer.byteLength(content)),
        contentHash: 'b'.repeat(64),
        scanStatus: FileScanStatus.CLEAN,
        uploadedById: users.owner.id,
      },
    })).id;
  });

  after(async () => {
    if (previousUploadsDir === undefined) delete process.env.UPLOADS_DIR;
    else process.env.UPLOADS_DIR = previousUploadsDir;
    fs.rmSync(uploadsDir, { recursive: true, force: true });

    const userIds = Object.values(users).map((x) => x.id).filter(Boolean);
    await prisma.personalNote.deleteMany({ where: { userId: { in: userIds } } });
    if (fileObjectId) await prisma.fileObject.deleteMany({ where: { id: fileObjectId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  test('chưa có ghi chú nào chứa tệp: kể cả người tải lên cũng không tải được', async () => {
    const res = await download(users.owner.token);
    assert.equal(res.status, 403);
  });

  test('ghi chú của người tải lên chứa tệp: chủ ghi chú tải được, người khác thì không', async () => {
    await prisma.personalNote.create({ data: { userId: users.owner.id, title: 'Có ảnh', content: noteContent() } });
    const own = await download(users.owner.token);
    assert.equal(own.status, 200);
    assert.equal(await own.text(), content);

    const other = await download(users.other.token);
    assert.equal(other.status, 403);
  });

  test('người khác dán mã tệp vào ghi chú của họ không tự có quyền tải', async () => {
    await prisma.personalNote.create({ data: { userId: users.other.id, title: 'Dán mã', content: noteContent() } });
    const res = await download(users.other.token);
    assert.equal(res.status, 403);
  });

  test('ghi chú còn chứa tệp thì tệp còn tham chiếu (không bị dọn); xóa ghi chú thì hết quyền tải', async () => {
    const file = await prisma.fileObject.findUniqueOrThrow({ where: { id: fileObjectId } });
    assert.ok((await countFileObjectReferences(prisma, file)) >= 1);

    await prisma.personalNote.deleteMany({ where: { userId: users.owner.id } });
    const res = await download(users.owner.token);
    assert.equal(res.status, 403);
  });
});
