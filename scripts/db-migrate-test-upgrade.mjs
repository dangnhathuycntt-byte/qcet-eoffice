#!/usr/bin/env node
import { execSync } from 'child_process';
import nextEnv from '@next/env';
import { PrismaClient } from '@prisma/client';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const baseDbUrl = process.env.DATABASE_URL;
if (!baseDbUrl) {
  console.error('[db:migrate:test-upgrade] ERROR: DATABASE_URL environment variable is missing.');
  process.exit(1);
}

const testSchema = `qcet_upgrade_test_${Date.now()}`;
const schemaDbUrl = baseDbUrl.includes('?')
  ? `${baseDbUrl}&schema=${testSchema}`
  : `${baseDbUrl}?schema=${testSchema}`;

console.log(`[db:migrate:test-upgrade] Initializing migration upgrade verification on: ${testSchema}`);

const prisma = new PrismaClient({ datasourceUrl: baseDbUrl });

async function run() {
  try {
    // 1. Create isolated temporary schema
    console.log(`[db:migrate:test-upgrade] Creating isolated test schema: ${testSchema}`);
    await prisma.$executeRawUnsafe(`CREATE SCHEMA "${testSchema}";`);

    // 2. Initial deployment
    console.log(`[db:migrate:test-upgrade] Running initial prisma migrate deploy...`);
    const initialDeployOut = execSync('npx prisma migrate deploy', {
      env: { ...process.env, DATABASE_URL: schemaDbUrl },
      encoding: 'utf8',
      stdio: 'pipe',
    });
    console.log(initialDeployOut.trim());

    // 3. Verify migrate status on deployed schema
    console.log(`[db:migrate:test-upgrade] Checking migrate status...`);
    const statusOut = execSync('npx prisma migrate status', {
      env: { ...process.env, DATABASE_URL: schemaDbUrl },
      encoding: 'utf8',
      stdio: 'pipe',
    });
    console.log(statusOut.trim());
    if (!statusOut.includes('Database schema is up to date')) {
      throw new Error(`Expected 'Database schema is up to date', got:\n${statusOut}`);
    }

    // 4. Test idempotency / upgrade re-run
    console.log(`[db:migrate:test-upgrade] Testing re-application of prisma migrate deploy (idempotency check)...`);
    const secondDeployOut = execSync('npx prisma migrate deploy', {
      env: { ...process.env, DATABASE_URL: schemaDbUrl },
      encoding: 'utf8',
      stdio: 'pipe',
    });
    console.log(secondDeployOut.trim());
    if (!secondDeployOut.includes('No pending migrations to apply')) {
      throw new Error(`Expected 'No pending migrations to apply' on re-run, got:\n${secondDeployOut}`);
    }

    // 5. Verify tables & constraints remain consistent
    // Phase 9: task_assignees, departments, dacum_delegations dropped → 45 models + _prisma_migrations = 46 tables
    const tables = await prisma.$queryRawUnsafe(`
      SELECT count(*)::int as count
      FROM information_schema.tables
      WHERE table_schema = '${testSchema}';
    `);
    const tableCount = tables[0]?.count || 0;
    console.log(`[db:migrate:test-upgrade] Verified stable table count: ${tableCount}`);
    if (tableCount < 46) {
      throw new Error(`Expected at least 46 tables, got ${tableCount}`);
    }

    console.log(`[db:migrate:test-upgrade] SUCCESS: Migration upgrade and idempotency verified cleanly.`);
  } finally {
    // 6. Always cleanup temporary test schema
    console.log(`[db:migrate:test-upgrade] Cleaning up test schema: ${testSchema}`);
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${testSchema}" CASCADE;`);
    await prisma.$disconnect();
  }
}

run().catch((err) => {
  console.error('[db:migrate:test-upgrade] FAILED:', err.message);
  process.exit(1);
});
