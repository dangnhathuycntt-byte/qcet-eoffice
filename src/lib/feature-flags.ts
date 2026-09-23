/**
 * Feature Flags — Phase 8/9 Migration Cutover
 *
 * WI-9.1: `TaskAssignee` dropped; `TaskActor` is the sole assignment authority,
 * so the actor read path is no longer gated.
 *
 * Phase 9 also dropped the legacy `department_id` columns and the `Department`
 * table, so the former `FEATURE_FLAG_ORG_UNIT_READ_CUTOVER` /
 * `FEATURE_FLAG_ORG_UNIT_WRITE_CUTOVER` switches no longer have a legacy branch
 * to fall back to; they were removed rather than left as permanently-on flags.
 */

/** Phase 9: legacy TaskAssignee table dropped. Always true — no-op flag retained for reference. */
export const TASK_ACTOR_READ_ENABLED = true;
