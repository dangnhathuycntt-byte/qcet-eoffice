/**
 * Feature Flags — Phase 8 Stage B Migration Cutover
 *
 * WI-8.1b: TaskAssignee → TaskActor
 * TASK_ACTOR_READ_ENABLED: khi bật, đọc từ TaskActor thay vì TaskAssignee.
 *   Dual-write (cả hai bảng được ghi) luôn hoạt động trong observe window.
 *   Bật bằng: TASK_ACTOR_READ_ENABLED=true
 *
 * WI-8.2b: Department → OrganizationalUnit
 * ORG_UNIT_READ_CUTOVER:  khi bật, truy vấn đơn vị đọc từ OrganizationalUnit.
 *   Bật bằng: FEATURE_FLAG_ORG_UNIT_READ_CUTOVER=true
 * ORG_UNIT_WRITE_CUTOVER: khi bật, ghi nhiệm vụ dual-write leadUnitId.
 *   Bật bằng: FEATURE_FLAG_ORG_UNIT_WRITE_CUTOVER=true
 */

export const TASK_ACTOR_READ_ENABLED =
  process.env.TASK_ACTOR_READ_ENABLED === 'true';

export const ORG_UNIT_READ_CUTOVER =
  process.env.FEATURE_FLAG_ORG_UNIT_READ_CUTOVER === 'true';

export const ORG_UNIT_WRITE_CUTOVER =
  process.env.FEATURE_FLAG_ORG_UNIT_WRITE_CUTOVER === 'true';
