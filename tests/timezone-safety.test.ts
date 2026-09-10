import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseDateParts, getAcademicMonthInfo, getAcademicYear } from '../src/lib/academic-calendar';
import { mapPrismaTaskToSchoolTask, formatLocalDate } from '../src/lib/adapters/task-db-adapter';

describe('Timezone and Null Safety Tests', () => {
  test('parseDateParts returns null gracefully when input is null, undefined, or invalid', () => {
    assert.strictEqual(parseDateParts(null), null);
    assert.strictEqual(parseDateParts(undefined), null);
    assert.strictEqual(parseDateParts(''), null);
    assert.strictEqual(parseDateParts('invalid-date'), null);
  });

  test('getAcademicYear returns default academic year gracefully on invalid input', () => {
    assert.strictEqual(getAcademicYear(null as any), '2026-2027');
    assert.strictEqual(getAcademicYear(undefined as any), '2026-2027');
    assert.strictEqual(getAcademicYear('invalid' as any), '2026-2027');
  });

  test('getAcademicMonthInfo handles invalid input gracefully', () => {
    const info = getAcademicMonthInfo(null as any);
    assert.strictEqual(info.monthNumber, 9);
    assert.strictEqual(info.academicYear, '2026-2027');
  });

  test('formatLocalDate formats Date using Asia/Ho_Chi_Minh timezone', () => {
    // 2026-09-24T17:30:00Z is 2026-09-25 00:30:00 in UTC+7 (Asia/Ho_Chi_Minh)
    const utcDate = new Date('2026-09-24T17:30:00Z');
    assert.strictEqual(formatLocalDate(utcDate), '2026-09-25');
  });

  test('formatLocalDate handles null and undefined safely', () => {
    assert.strictEqual(formatLocalDate(null), '');
    assert.strictEqual(formatLocalDate(undefined), '');
  });

  test('mapPrismaTaskToSchoolTask formats dueDate using Asia/Ho_Chi_Minh timezone', () => {
    const mockPrismaTask: any = {
      id: 'task-test-tz',
      code: 'NV-2026-09-999',
      title: 'Test Timezone',
      description: 'Desc',
      scope: 'SCHOOL',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      progressPercent: 50,
      academicMonth: 9,
      academicYear: '2026-2027',
      startDate: new Date('2026-09-01T00:00:00Z'),
      dueDate: new Date('2026-09-24T17:30:00Z'),
      department: { name: 'P.TC-ĐBCL' },
      assignees: []
    };
    const mapped = mapPrismaTaskToSchoolTask(mockPrismaTask);
    assert.strictEqual(mapped.dueDate, '2026-09-25');
  });
});
