import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();
const DOC_PATH = path.join(ROOT_DIR, "docs", "architecture", "DATABASE_OPERATIONS.md");

describe("Database Operations & Reliability Runbook (QCET E-Office)", () => {
  it("verifies DATABASE_OPERATIONS.md exists and is non-empty", () => {
    assert.strictEqual(fs.existsSync(DOC_PATH), true, "DATABASE_OPERATIONS.md must exist at docs/architecture/");
    const stats = fs.statSync(DOC_PATH);
    assert.ok(stats.size > 2000, `Documentation file must be substantial, got size ${stats.size} bytes`);
  });

  const content = fs.existsSync(DOC_PATH) ? fs.readFileSync(DOC_PATH, "utf8") : "";

  describe("1. Architectural Topology & Invariants", () => {
    it("documents the layered database topology", () => {
      assert.ok(content.includes("APPLICATION LAYER"), "Must include Application Layer");
      assert.ok(content.includes("DOMAIN SERVICES LAYER"), "Must include Domain Services Layer");
      assert.ok(content.includes("TRANSACTION BOUNDARY"), "Must include Transaction Boundary");
      assert.ok(content.includes("POSTGRESQL DATABASE ENGINE"), "Must include Database Engine");
      assert.ok(content.includes("STORAGE & WAL ARCHITECTURE"), "Must include Storage & WAL Architecture");
    });

    it("documents server truth and interactive transaction boundaries", () => {
      assert.ok(content.includes("Server Truth Wins"), "Must state 'Server Truth Wins' core invariant");
      assert.ok(
        content.includes("prisma.$transaction"),
        "Must specify prisma.$transaction as transaction boundary"
      );
    });
  });

  describe("2. Recovery Point Objective (RPO) & Recovery Time Objective (RTO)", () => {
    it("specifies RPO <= 15 minutes and RTO <= 2 hours", () => {
      assert.match(content, /RPO.*<=?\s*15\s*minutes/i, "Must define RPO <= 15 minutes");
      assert.match(content, /RTO.*<=?\s*2\s*hours/i, "Must define RTO <= 2 hours");
    });

    it("specifies monthly disaster recovery validation schedule", () => {
      assert.match(
        content,
        /monthly.*(drill|validation|restore)/i,
        "Must specify monthly disaster recovery validation schedule"
      );
    });

    it("outlines disaster recovery failure scenarios matrix", () => {
      assert.ok(content.includes("Failure Scenarios and Recovery Matrix"), "Must contain failure scenarios table");
      assert.ok(content.includes("Point-in-Time Recovery"), "Must cover PITR");
    });
  });

  describe("3. Backup & Recovery Strategy", () => {
    it("documents logical backup with pg_dump custom format (-Fc)", () => {
      assert.ok(content.includes("pg_dump"), "Must document pg_dump");
      assert.ok(content.includes("-Fc") || content.includes("--format=custom"), "Must document custom format (-Fc)");
    });

    it("documents physical backups and continuous WAL archiving", () => {
      assert.ok(
        content.includes("pgBackRest") || content.includes("wal-g") || content.includes("pg_basebackup"),
        "Must document physical backup tool (pgBackRest / wal-g / pg_basebackup)"
      );
      assert.ok(content.includes("archive_command"), "Must configure archive_command");
      assert.ok(content.includes("archive_timeout"), "Must configure archive_timeout");
    });

    it("details step-by-step PITR restore procedure", () => {
      assert.ok(content.includes("Point-in-Time Recovery (PITR) Procedure"), "Must document PITR procedure");
      assert.ok(content.includes("recovery_target_time"), "Must specify recovery_target_time");
      assert.ok(content.includes("recovery_target_action"), "Must specify recovery_target_action");
    });
  });

  describe("4. Autovacuum Tuning & Database Health Monitoring", () => {
    it("documents autovacuum tuning for high-churn tables (notifications, audit_events, outbox_events, tasks)", () => {
      assert.ok(content.includes('"outbox_events"'), "Must tune outbox_events table");
      assert.ok(content.includes('"notifications"'), "Must tune notifications table");
      assert.ok(content.includes('"tasks"'), "Must tune tasks table");
      assert.ok(content.includes('"audit_events"'), "Must tune audit_events table");
      assert.ok(content.includes("autovacuum_vacuum_scale_factor"), "Must tune autovacuum_vacuum_scale_factor");
      assert.ok(content.includes("autovacuum_vacuum_threshold"), "Must tune autovacuum_vacuum_threshold");
    });

    it("provides concrete SQL monitoring queries", () => {
      assert.ok(content.includes("pg_stat_user_tables"), "Must query pg_stat_user_tables for dead tuples");
      assert.ok(content.includes("pg_stat_activity"), "Must query pg_stat_activity for connection states");
      assert.ok(content.includes("pg_stat_statements"), "Must include pg_stat_statements telemetry");
      assert.ok(content.includes("dead_tuples") || content.includes("n_dead_tup"), "Must monitor dead tuples");
      assert.ok(content.includes("bloat") || content.includes("pg_total_relation_size"), "Must include bloat query");
      assert.ok(content.includes("wraparound") || content.includes("datfrozenxid"), "Must include XID wraparound check");
    });
  });

  describe("5. Connection Management & Pooling", () => {
    it("enforces single PrismaClient per process invariant", () => {
      assert.ok(content.includes("Single PrismaClient per Process"), "Must declare single client invariant");
      assert.ok(content.includes("src/lib/prisma.ts"), "Must reference canonical src/lib/prisma.ts");
    });

    it("documents connection pool sizing formula", () => {
      assert.ok(
        content.includes("core_count") || content.includes("CPU Cores") || content.includes("spindle"),
        "Must specify connection sizing formula with CPU cores and spindles"
      );
    });

    it("documents PgBouncer transactional pooling setup", () => {
      assert.ok(content.includes("PgBouncer"), "Must include PgBouncer");
      assert.ok(content.includes("pool_mode = transaction"), "Must configure transaction pool mode");
      assert.ok(content.includes("DISCARD ALL"), "Must configure server_reset_query");
      assert.ok(content.includes("pgbouncer=true"), "Must document Prisma pgbouncer query parameter");
    });
  });

  describe("6. Zero-Downtime Migration Discipline (Expand-and-Contract)", () => {
    it("strictly requires prisma migrate deploy in CI/CD and forbids dev/push", () => {
      assert.ok(content.includes("prisma migrate deploy"), "Must require prisma migrate deploy");
      assert.ok(content.includes("prisma migrate dev"), "Must cite prisma migrate dev prohibition");
    });

    it("details the 4-phase expand-and-contract pattern", () => {
      assert.ok(content.includes("Phase A"), "Must detail Phase A (Expand)");
      assert.ok(content.includes("Phase B"), "Must detail Phase B (Dual-Write & Backfill)");
      assert.ok(content.includes("Phase C"), "Must detail Phase C (Contract Read)");
      assert.ok(content.includes("Phase D"), "Must detail Phase D (Contract Cleanup)");
    });

    it("includes migration safety gates and review checklist", () => {
      assert.ok(content.includes("Migration Safety Gates"), "Must include migration safety gates");
      assert.ok(content.includes("CREATE INDEX CONCURRENTLY"), "Must specify non-blocking index creation");
    });
  });

  describe("7. Security, Auditing & Operational Compliance", () => {
    it("documents audit_events immutability trigger", () => {
      assert.ok(content.includes("audit_events"), "Must cover audit_events");
      assert.ok(content.includes("prevent_audit_tampering") || content.includes("append-only"), "Must enforce immutability");
    });

    it("documents outbox event lifecycle and DLQ monitoring", () => {
      assert.ok(content.includes("outbox_events"), "Must cover outbox_events");
      assert.ok(content.includes("FOR UPDATE SKIP LOCKED"), "Must document lock-free worker polling");
      assert.ok(content.includes("FAILED"), "Must cover DLQ failed status");
    });

    it("documents idempotency lifecycle and TTL pruning", () => {
      assert.ok(content.includes("idempotency_records"), "Must cover idempotency_records");
      assert.ok(content.includes("DELETE FROM idempotency_records"), "Must include TTL purge query");
    });
  });

  describe("8. Documentation Hygiene & Anti-Slop Check", () => {
    it("contains zero placeholder syntax (TODO, FIXME, TBD, <replace-me>, etc.)", () => {
      const placeholderPattern = /\b(TODO|FIXME|TBD|XXX)\b|<[a-zA-Z0-9_-]+>/;
      const lines = content.split("\n");
      const offendingLines: string[] = [];

      lines.forEach((line, index) => {
        // Exclude generic math/formula or valid HTML tag brackets if any
        if (placeholderPattern.test(line) && !line.includes("$$\\text{") && !line.includes("ROUND(100.0")) {
          offendingLines.push(`Line ${index + 1}: ${line.trim()}`);
        }
      });

      assert.deepStrictEqual(
        offendingLines,
        [],
        `Document must not contain placeholder tokens:\n${offendingLines.join("\n")}`
      );
    });

    it("contains zero emojis in accordance with system guidelines", () => {
      // Regular expression matching common emojis
      const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
      assert.strictEqual(
        emojiRegex.test(content),
        false,
        "Documentation must contain zero emojis"
      );
    });
  });
});
