import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getLiveDashboardData } from '../src/lib/server/dashboard-service';

describe('Live Dashboard Service Contract', () => {
  test('getLiveDashboardData phải tổng hợp dữ liệu thực từ PostgreSQL', async () => {
    const data = await getLiveDashboardData();

    assert.ok(data, 'Dashboard payload không được null');
    assert.ok(Array.isArray(data.tasks), 'tasks phải là một mảng');
    assert.ok(data.tasks.length > 0, 'Phải có ít nhất 1 nhiệm vụ trường');
    assert.strictEqual(data.source, 'database');

    // Kiểm tra cấu trúc chỉ số DashboardStats
    assert.ok(typeof data.stats.totalTasks === 'number');
    assert.ok(typeof data.stats.completedTasks === 'number');
    assert.ok(typeof data.stats.overdueTasks === 'number');
    assert.ok(typeof data.stats.pendingApprovals === 'number');

    // Kiểm tra 11 đơn vị
    assert.ok(Array.isArray(data.departmentHealth), 'departmentHealth phải là mảng');
    assert.ok(data.departmentHealth.length >= 11, 'Phải có tối thiểu 11 đơn vị');
  });
});
