-- Phase 9 WI-9.3: Drop legacy DacumDelegation table
-- Prerequisite: task-policy.ts fallback removed (Stage B), DelegationGrant is sole authority

DROP TABLE IF EXISTS "dacum_delegations" CASCADE;
