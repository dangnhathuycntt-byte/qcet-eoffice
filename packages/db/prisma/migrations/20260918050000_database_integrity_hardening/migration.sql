-- Repair historical task lifecycle contradictions before enforcing the rule.
UPDATE "tasks"
SET
  "progress_percent" = 100,
  "completed_at" = COALESCE("completed_at", GREATEST("updated_at", "start_date"))
WHERE "status" = 'COMPLETED'
  AND ("progress_percent" <> 100 OR "completed_at" IS NULL);

UPDATE "tasks"
SET "completed_at" = NULL
WHERE "status" <> 'COMPLETED'
  AND "completed_at" IS NOT NULL;

ALTER TABLE "tasks"
  ADD CONSTRAINT "chk_tasks_completion_lifecycle"
  CHECK (
    ("status" = 'COMPLETED' AND "progress_percent" = 100 AND "completed_at" IS NOT NULL)
    OR
    ("status" <> 'COMPLETED' AND "completed_at" IS NULL)
  ) NOT VALID;

ALTER TABLE "tasks"
  VALIDATE CONSTRAINT "chk_tasks_completion_lifecycle";

-- Audit events are append-only outside explicitly named test/CI databases.
-- Statement-level triggers also cover bulk operations and TRUNCATE.
CREATE OR REPLACE FUNCTION "prevent_audit_event_mutation"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF current_database() ~ '(_test|_ci)$' THEN
    RETURN NULL;
  END IF;

  RAISE EXCEPTION 'audit_events is append-only; % is not permitted', TG_OP
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS "audit_events_append_only" ON "audit_events";
CREATE TRIGGER "audit_events_append_only"
BEFORE UPDATE OR DELETE OR TRUNCATE ON "audit_events"
FOR EACH STATEMENT
EXECUTE FUNCTION "prevent_audit_event_mutation"();

REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE "audit_events" FROM PUBLIC;

-- High-churn queues need prompt dead-tuple cleanup under sustained workload.
ALTER TABLE "outbox_events" SET (
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_analyze_scale_factor = 0.01
);
ALTER TABLE "idempotency_records" SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);
ALTER TABLE "notifications" SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);
