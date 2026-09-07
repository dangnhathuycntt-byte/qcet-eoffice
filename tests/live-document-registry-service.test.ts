import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { listDocuments } from '../src/lib/documents/document-service';

describe('Live Document Registry Service & Component Contract', () => {
  test('document-registry-view.tsx không phụ thuộc vào MOCK_DOCUMENTS', () => {
    const filePath = path.resolve(process.cwd(), 'src/components/documents/document-registry-view.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    assert.strictEqual(
      content.includes('MOCK_DOCUMENTS'),
      false,
      'document-registry-view không được phụ thuộc vào MOCK_DOCUMENTS'
    );
  });

  test('listDocuments trả về danh sách văn bản từ cơ sở dữ liệu PostgreSQL', async () => {
    const docs = await listDocuments({ limit: 10 });
    assert.ok(Array.isArray(docs), 'Kết quả trả về phải là một mảng');
  });
});
