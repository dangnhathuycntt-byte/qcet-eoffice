import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('useTaskMutations Zero Mock Contract', () => {
  test('use-task-mutations.ts không được khởi tạo state bằng getMockDashboardPayload', () => {
    const filePath = path.resolve(process.cwd(), 'src/hooks/use-task-mutations.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Không được có getMockDashboardPayload trong mã nguồn runtime
    assert.strictEqual(
      content.includes('getMockDashboardPayload()'),
      false,
      'useTaskMutations không được khởi tạo bằng getMockDashboardPayload()'
    );
  });
});
