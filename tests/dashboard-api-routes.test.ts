import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { GET as getDashboardOverview } from '../src/app/api/dashboard/overview/route';
import { GET as getDocumentStats } from '../src/app/api/documents/stats/route';

describe('Dashboard API Routes (Zero Mock Fallback)', () => {
  test('GET /api/dashboard/overview phải trả về source=database', async () => {
    const response = await getDashboardOverview();
    assert.strictEqual(response.status, 200);

    const json = await response.json();
    assert.strictEqual(json.source, 'database');
    assert.notStrictEqual(json.source, 'mock-fallback');
    assert.ok(Array.isArray(json.tasks));
  });

  test('GET /api/documents/stats phải trả về thống kê sổ văn bản từ cơ sở dữ liệu thực', async () => {
    const response = await getDocumentStats();
    assert.strictEqual(response.status, 200);

    const json = await response.json();
    assert.ok(json.success);
    assert.ok(typeof json.data.total === 'number');
    assert.ok(json.data.total > 0, 'Tổng số văn bản trong DB phải > 0');
  });
});
