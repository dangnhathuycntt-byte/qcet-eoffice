import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  UserQuerySchema,
  UpdateUserRoleSchema,
  OnboardingInputSchema,
  UpdateUserProfileSchema,
} from '@/contracts/users';
import {
  buildUserDirectoryPagination,
  buildUserDirectoryQueryOptions,
} from '@/server/users/user-directory-query';

// ---------------------------------------------------------------------------
// UserQuerySchema
// ---------------------------------------------------------------------------
describe('UserQuerySchema', () => {
  // --- Defaults ---

  test('empty query defaults page=1, pageSize=20', () => {
    const result = UserQuerySchema.safeParse({});
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.page, 1);
      assert.equal(result.data.pageSize, 20);
    }
  });

  // --- Full query ---

  test('accepts full query with all fields', () => {
    const result = UserQuerySchema.safeParse({
      page: 2,
      pageSize: 50,
      cursor: 'abc123',
      departmentId: 'dept-001',
      role: 'ADMIN',
      q: 'Nguyễn Văn',
      search: 'test search',
      limit: 25,
    });
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.page, 2);
      assert.equal(result.data.pageSize, 50);
      assert.equal(result.data.cursor, 'abc123');
      assert.equal(result.data.departmentId, 'dept-001');
      assert.equal(result.data.role, 'ADMIN');
      assert.equal(result.data.q, 'Nguyễn Văn');
      assert.equal(result.data.search, 'test search');
      assert.equal(result.data.limit, 25);
    }
  });

  test('parses directory search, role, and pagination filters together', () => {
    const result = UserQuerySchema.safeParse({
      q: '  Nguyen Van A  ',
      role: '  BAN_GIAM_HIEU  ',
      page: '2',
      pageSize: '20',
    });
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.q, 'Nguyen Van A');
      assert.equal(result.data.role, 'BAN_GIAM_HIEU');
      assert.equal(result.data.page, 2);
      assert.equal(result.data.pageSize, 20);
    }
  });

  test('builds the same server filters and page window used by list and count queries', () => {
    const parsed = UserQuerySchema.parse({
      q: '  Nguyen Van A  ',
      role: 'BAN_GIAM_HIEU',
      page: '3',
      pageSize: '20',
    });
    const options = buildUserDirectoryQueryOptions(parsed);

    assert.equal(options.searchQuery, 'Nguyen Van A');
    assert.deepEqual(options.filters, {
      role: 'BAN_GIAM_HIEU',
      OR: [
        { name: { contains: 'Nguyen Van A', mode: 'insensitive' } },
        { email: { contains: 'Nguyen Van A', mode: 'insensitive' } },
      ],
    });
    assert.equal(options.take, 20);
    assert.equal(options.skip, 40);
    assert.deepEqual(buildUserDirectoryPagination(3, options.take, 65), {
      page: 3,
      pageSize: 20,
      total: 65,
      totalPages: 4,
      hasMore: true,
    });
  });

  // --- departmentId boundaries ---

  test('accepts departmentId at max 64 chars', () => {
    const result = UserQuerySchema.safeParse({ departmentId: 'x'.repeat(64) });
    assert.equal(result.success, true);
  });

  test('rejects departmentId exceeding 64 chars', () => {
    const result = UserQuerySchema.safeParse({ departmentId: 'x'.repeat(65) });
    assert.equal(result.success, false);
  });

  // --- role boundaries ---

  test('accepts role at max 50 chars', () => {
    const result = UserQuerySchema.safeParse({ role: 'r'.repeat(50) });
    assert.equal(result.success, true);
  });

  test('rejects role exceeding 50 chars', () => {
    const result = UserQuerySchema.safeParse({ role: 'r'.repeat(51) });
    assert.equal(result.success, false);
  });

  // --- q boundaries ---

  test('accepts q at max 200 chars', () => {
    const result = UserQuerySchema.safeParse({ q: 'a'.repeat(200) });
    assert.equal(result.success, true);
  });

  test('rejects q exceeding 200 chars', () => {
    const result = UserQuerySchema.safeParse({ q: 'a'.repeat(201) });
    assert.equal(result.success, false);
  });

  // --- search boundaries ---

  test('accepts search at max 200 chars', () => {
    const result = UserQuerySchema.safeParse({ search: 'b'.repeat(200) });
    assert.equal(result.success, true);
  });

  test('rejects search exceeding 200 chars', () => {
    const result = UserQuerySchema.safeParse({ search: 'b'.repeat(201) });
    assert.equal(result.success, false);
  });

  // --- limit boundaries ---

  test('accepts limit=1 (positive)', () => {
    const result = UserQuerySchema.safeParse({ limit: 1 });
    assert.equal(result.success, true);
    if (result.success) assert.equal(result.data.limit, 1);
  });

  test('accepts limit=100 (max)', () => {
    const result = UserQuerySchema.safeParse({ limit: 100 });
    assert.equal(result.success, true);
    if (result.success) assert.equal(result.data.limit, 100);
  });

  test('rejects limit=0 (not positive)', () => {
    const result = UserQuerySchema.safeParse({ limit: 0 });
    assert.equal(result.success, false);
  });

  test('rejects limit=101 (exceeds max)', () => {
    const result = UserQuerySchema.safeParse({ limit: 101 });
    assert.equal(result.success, false);
  });

  // --- page coercion ---

  test('coerces page from string to number', () => {
    const result = UserQuerySchema.safeParse({ page: '3' });
    assert.equal(result.success, true);
    if (result.success) assert.equal(result.data.page, 3);
  });

  // --- NOT strict ---

  test('allows extra fields (not strict)', () => {
    const result = UserQuerySchema.safeParse({
      page: 1,
      unknownField: 'should-pass-through',
      anotherExtra: 42,
    });
    assert.equal(result.success, true);
  });
});

// ---------------------------------------------------------------------------
// UpdateUserRoleSchema
// ---------------------------------------------------------------------------
describe('UpdateUserRoleSchema', () => {
  const VALID_ROLES = [
    'ADMIN',
    'MANAGER',
    'STAFF',
    'BAN_GIAM_HIEU',
    'TRUONG_PHONG',
    'CHUYEN_VIEN',
    'GIANG_VIEN',
    'VAN_THU',
    'CLERK',
  ] as const;

  // --- Happy paths ---

  test('accepts all 9 valid role enum values', () => {
    for (const role of VALID_ROLES) {
      const result = UpdateUserRoleSchema.safeParse({ role });
      assert.equal(result.success, true, `should accept role=${role}`);
    }
  });

  // --- Rejection ---

  test('rejects invalid role value', () => {
    const result = UpdateUserRoleSchema.safeParse({ role: 'SUPER_ADMIN' });
    assert.equal(result.success, false);
  });

  test('rejects missing role', () => {
    const result = UpdateUserRoleSchema.safeParse({});
    assert.equal(result.success, false);
  });

  // --- Strict ---

  test('rejects unknown fields (strict)', () => {
    const result = UpdateUserRoleSchema.safeParse({
      role: 'ADMIN',
      extraField: 'not-allowed',
    });
    assert.equal(result.success, false);
  });
});

// ---------------------------------------------------------------------------
// OnboardingInputSchema
// ---------------------------------------------------------------------------
describe('OnboardingInputSchema', () => {
  // --- Happy paths ---

  test('accepts empty body (all fields optional)', () => {
    const result = OnboardingInputSchema.safeParse({});
    assert.equal(result.success, true);
  });

  test('accepts full input with all fields', () => {
    const result = OnboardingInputSchema.safeParse({
      hasSeenWelcome: true,
      hasCompletedTour: false,
      completedSteps: ['step-1', 'step-2', 'step-3'],
      isDismissed: false,
      snoozedUntil: '2025-06-01T00:00:00Z',
    });
    assert.equal(result.success, true);
  });

  test('accepts snoozedUntil as null', () => {
    const result = OnboardingInputSchema.safeParse({ snoozedUntil: null });
    assert.equal(result.success, true);
  });

  // --- completedSteps boundaries ---

  test('accepts completedSteps with 50 items (max)', () => {
    const steps = Array.from({ length: 50 }, (_, i) => `step-${i}`);
    const result = OnboardingInputSchema.safeParse({ completedSteps: steps });
    assert.equal(result.success, true);
  });

  test('rejects completedSteps with 51 items (exceeds max)', () => {
    const steps = Array.from({ length: 51 }, (_, i) => `step-${i}`);
    const result = OnboardingInputSchema.safeParse({ completedSteps: steps });
    assert.equal(result.success, false);
  });

  test('accepts completedSteps item at max 100 chars', () => {
    const result = OnboardingInputSchema.safeParse({
      completedSteps: ['s'.repeat(100)],
    });
    assert.equal(result.success, true);
  });

  test('rejects completedSteps item exceeding 100 chars', () => {
    const result = OnboardingInputSchema.safeParse({
      completedSteps: ['s'.repeat(101)],
    });
    assert.equal(result.success, false);
  });

  // --- Strict ---

  test('rejects unknown fields (strict)', () => {
    const result = OnboardingInputSchema.safeParse({
      hasSeenWelcome: true,
      extraField: 'not-allowed',
    });
    assert.equal(result.success, false);
  });
});

// ---------------------------------------------------------------------------
// UpdateUserProfileSchema
// ---------------------------------------------------------------------------
describe('UpdateUserProfileSchema', () => {
  // --- Happy paths ---

  test('accepts empty body (all fields optional)', () => {
    const result = UpdateUserProfileSchema.safeParse({});
    assert.equal(result.success, true);
  });

  test('accepts full input with all fields', () => {
    const result = UpdateUserProfileSchema.safeParse({
      name: 'Nguyễn Văn An',
      phone: '0901234567',
      title: 'Trưởng phòng Đào tạo',
    });
    assert.equal(result.success, true);
  });

  // --- name boundaries ---

  test('accepts name at min 2 chars', () => {
    const result = UpdateUserProfileSchema.safeParse({ name: 'An' });
    assert.equal(result.success, true);
  });

  test('rejects name shorter than 2 chars', () => {
    const result = UpdateUserProfileSchema.safeParse({ name: 'A' });
    assert.equal(result.success, false);
  });

  test('accepts name at max 100 chars', () => {
    const result = UpdateUserProfileSchema.safeParse({ name: 'N'.repeat(100) });
    assert.equal(result.success, true);
  });

  test('rejects name exceeding 100 chars', () => {
    const result = UpdateUserProfileSchema.safeParse({ name: 'N'.repeat(101) });
    assert.equal(result.success, false);
  });

  // --- phone boundaries ---

  test('accepts phone at max 20 chars', () => {
    const result = UpdateUserProfileSchema.safeParse({ phone: '0'.repeat(20) });
    assert.equal(result.success, true);
  });

  test('rejects phone exceeding 20 chars', () => {
    const result = UpdateUserProfileSchema.safeParse({ phone: '0'.repeat(21) });
    assert.equal(result.success, false);
  });

  test('accepts phone as null', () => {
    const result = UpdateUserProfileSchema.safeParse({ phone: null });
    assert.equal(result.success, true);
  });

  // --- title boundaries ---

  test('accepts title at max 100 chars', () => {
    const result = UpdateUserProfileSchema.safeParse({ title: 'T'.repeat(100) });
    assert.equal(result.success, true);
  });

  test('rejects title exceeding 100 chars', () => {
    const result = UpdateUserProfileSchema.safeParse({ title: 'T'.repeat(101) });
    assert.equal(result.success, false);
  });

  test('accepts title as null', () => {
    const result = UpdateUserProfileSchema.safeParse({ title: null });
    assert.equal(result.success, true);
  });

  // --- Strict ---

  test('rejects unknown fields (strict)', () => {
    const result = UpdateUserProfileSchema.safeParse({
      name: 'Nguyễn Văn An',
      role: 'ADMIN',
    });
    assert.equal(result.success, false);
  });
});
