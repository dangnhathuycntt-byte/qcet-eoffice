import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  readAuditLogResponse,
  readUserDirectoryResponse,
} from '../src/lib/admin/api-response';

describe('admin API response mapping', () => {
  it('reads audit entries and pagination total from the success envelope', () => {
    const entries = [{ id: 'audit-1' }];
    assert.deepEqual(
      readAuditLogResponse<{ id: string }>({
        data: entries,
        pagination: { page: 1, pageSize: 20, total: 47 },
      }),
      { entries, total: 47 },
    );
  });

  it('reads users and pagination total from the success envelope', () => {
    const users = [{ id: 'user-1' }];
    assert.deepEqual(
      readUserDirectoryResponse<{ id: string }>({
        users,
        pagination: { page: 2, pageSize: 20, total: 35 },
      }),
      { users, total: 35 },
    );
  });

  it('uses safe empty defaults for malformed envelopes', () => {
    assert.deepEqual(readAuditLogResponse(null), { entries: [], total: 0 });
    assert.deepEqual(readUserDirectoryResponse({ users: [] }), { users: [], total: 0 });
  });
});
