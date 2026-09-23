/**
 * Feature Flags — Phase 8/9 Migration Cutover
 *
 * WI-9.1: TaskAssignee table dropped; TaskActor is now the sole authority.
 * TASK_ACTOR_READ_ENABLED is hardcoded true — kept for reference only (no-op).
 *
 * WI-8.2b: Department → OrganizationalUnit
 * ORG_UNIT_READ_CUTOVER:  khi bật, truy vấn đơn vị đọc từ OrganizationalUnit.
 *   Bật bằng: FEATURE_FLAG_ORG_UNIT_READ_CUTOVER=true
 * ORG_UNIT_WRITE_CUTOVER: khi bật, ghi nhiệm vụ dual-write leadUnitId.
 *   Bật bằng: FEATURE_FLAG_ORG_UNIT_WRITE_CUTOVER=true
 */

/** Phase 9: legacy TaskAssignee table dropped. Always true — no-op flag retained for reference. */
export const TASK_ACTOR_READ_ENABLED = true;

export const ORG_UNIT_READ_CUTOVER =
  process.env.FEATURE_FLAG_ORG_UNIT_READ_CUTOVER === 'true';

export const ORG_UNIT_WRITE_CUTOVER =
  process.env.FEATURE_FLAG_ORG_UNIT_WRITE_CUTOVER === 'true';
