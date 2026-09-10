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

    // 3. Verify created tables count (47 models + _prisma_migrations = 48)
    const tables = await prisma.$queryRawUnsafe(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = '${testSchema}'
      ORDER BY table_name;
    `);
    console.log(`[db:migrate:test-fresh] Created tables count: ${tables.length}`);
    if (tables.length < 48) {
      throw new Error(`Expected at least 48 tables in fresh schema, but found ${tables.length}`);
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
      'chk_push_subscriptions_failure_count',
      'chk_outbox_events_attempts',
    ];
    for (const ec of expectedChecks) {
      if (!checkNames.includes(ec)) {
        throw new Error(`Missing expected check constraint: ${ec}`);
      }
    }

    // 5. Verify partial unique index for PRIMARY_OWNER
    const indexes = await prisma.$queryRawUnsafe(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = '${testSchema}';
    `);
    const indexNames = indexes.map((i) => i.indexname);
    console.log(`[db:migrate:test-fresh] Total indexes created: ${indexNames.length}`);
    if (!indexNames.includes('task_assignees_one_primary_owner')) {
      throw new Error(`Missing expected partial unique index: task_assignees_one_primary_owner`);
    }

    // 6. Verify _prisma_migrations record
    const migrations = await prisma.$queryRawUnsafe(`
      SELECT migration_name, finished_at, rolled_back_at
      FROM "${testSchema}"."_prisma_migrations";
    `);
    console.log(`[db:migrate:test-fresh] Recorded migrations:`, migrations.map((m) => m.migration_name));
    if (!migrations.some((m) => m.migration_name === '20260910000000_baseline' && m.finished_at)) {
      throw new Error(`Migration 20260910000000_baseline not recorded as finished in _prisma_migrations`);
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
