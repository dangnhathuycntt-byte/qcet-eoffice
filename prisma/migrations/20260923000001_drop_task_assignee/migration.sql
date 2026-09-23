-- Phase 9 WI-9.1: Drop legacy TaskAssignee table and AssigneeRole enum
-- Prerequisite: Stage B dual-write active, Stage C observe window completed
-- All TaskActor records verified via verifyTaskAssigneeParity()

DROP TABLE IF EXISTS "task_assignees" CASCADE;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AssigneeRole') THEN
    DROP TYPE "AssigneeRole";
  END IF;
END $$;
