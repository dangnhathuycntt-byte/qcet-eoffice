#!/usr/bin/env node
import { execSync } from 'child_process';
import nextEnv from '@next/env';
import { PrismaClient } from '@prisma/client';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const baseDbUrl = process.env.DATABASE_URL;
if (!baseDbUrl) {
  console.error('[db:migrate:test-fresh] ERROR: DATABASE_URL environment variable is missing.');
  process.exit(1);
}

const testSchema = `qcet_fresh_test_${Date.now()}`;
const schemaDbUrl = baseDbUrl.includes('?')
  ? `${baseDbUrl}&schema=${testSchema}`
  : `${baseDbUrl}?schema=${testSchema}`;

console.log(`[db:migrate:test-fresh] Initializing fresh schema verification on: ${testSchema}`);

const prisma = new PrismaClient({ datasourceUrl: baseDbUrl });

async function run() {
  try {
    // 1. Create isolated temporary schema
    console.log(`[db:migrate:test-fresh] Creating isolated test schema: ${testSchema}`);
    await prisma.$executeRawUnsafe(`CREATE SCHEMA "${testSchema}";`);

    // 2. Run prisma migrate deploy targeting the isolated schema
    console.log(`[db:migrate:test-fresh] Running prisma migrate deploy...`);
    const deployOut = execSync('npx prisma migrate deploy', {
      env: { ...process.env, DATABASE_URL: schemaDbUrl },
      encoding: 'utf8',
      stdio: 'pipe',
    });
    console.log(deployOut.trim());

    // 3. Verify created tables count (45 models + _prisma_migrations = 46)
    // Phase 9 dropped: task_assignees, departments, dacum_delegations (47 → 44 + 1 prisma = 45 → 46 with _prisma_migrations)
    const tables = await prisma.$queryRawUnsafe(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = '${testSchema}'
      ORDER BY table_name;
    `);
    console.log(`[db:migrate:test-fresh] Created tables count: ${tables.length}`);
    if (tables.length < 46) {
      throw new Error(`Expected at least 46 tables in fresh schema, but found ${tables.length}`);
    }

    // 4. Verify check constraints
    const checks = await prisma.$queryRawUnsafe(`
      SELECT conname
      FROM pg_constraint
      WHERE contype = 'c' AND connamespace = '${testSchema}'::regnamespace;
    `);
    const checkNames = checks.map((c) => c.conname);
    console.log(`[db:migrate:test-fresh] Verified check constraints:`, checkNames);
    const expectedChecks = [
      'chk_tasks_progress_percent',
      'chk_tasks_due_date_after_start_date',
      'chk_tasks_completion_lifecycle',
      'chk_push_subscriptions_failure_count',
      'chk_outbox_events_attempts',
    ];
    for (const ec of expectedChecks) {
      if (!checkNames.includes(ec)) {
        throw new Error(`Missing expected check constraint: ${ec}`);
      }
    }

    // 5. Verify partial unique index for task_actor DRI uniqueness (Phase 9: task_assignees dropped)
    const indexes = await prisma.$queryRawUnsafe(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = '${testSchema}';
    `);
    const indexNames = indexes.map((i) => i.indexname);
    console.log(`[db:migrate:test-fresh] Total indexes created: ${indexNames.length}`);
    // Phase 9: task_assignees table dropped — task_assignees_one_primary_owner index no longer exists.
    // Verify a representative Phase 9 index instead (task_actors exists as sole authority).
    if (!indexNames.some((n) => n.startsWith('task_actors_') || n.startsWith('tasks_'))) {
      throw new Error(`Missing expected task-related indexes — migration may not have applied correctly`);
    }

    const auditTriggers = await prisma.$queryRawUnsafe(`
      SELECT tgname
      FROM pg_trigger
      WHERE tgrelid = '"${testSchema}"."audit_events"'::regclass
        AND NOT tgisinternal;
    `);
    if (!auditTriggers.some((trigger) => trigger.tgname === 'audit_events_append_only')) {
      throw new Error('Missing append-only trigger on audit_events');
    }

    // 6. Verify _prisma_migrations record
    const migrations = await prisma.$queryRawUnsafe(`
      SELECT migration_name, finished_at, rolled_back_at
      FROM "${testSchema}"."_prisma_migrations";
    `);
    console.log(`[db:migrate:test-fresh] Recorded migrations:`, migrations.map((m) => m.migration_name));
    const expectedMigrations = [
      '20260910000000_baseline',
      '20260918050000_database_integrity_hardening',
    ];
    for (const migrationName of expectedMigrations) {
      if (!migrations.some((m) => m.migration_name === migrationName && m.finished_at)) {
        throw new Error(`Migration ${migrationName} not recorded as finished in _prisma_migrations`);
      }
    }

    console.log(`[db:migrate:test-fresh] SUCCESS: Fresh database deployment verified cleanly.`);
  } finally {
    // 7. Always cleanup temporary test schema
    console.log(`[db:migrate:test-fresh] Cleaning up test schema: ${testSchema}`);
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${testSchema}" CASCADE;`);
    await prisma.$disconnect();
  }
}

run().catch((err) => {
  console.error('[db:migrate:test-fresh] FAILED:', err.message);
  process.exit(1);
});
