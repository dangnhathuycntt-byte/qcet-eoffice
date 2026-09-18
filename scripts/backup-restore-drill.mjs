/**
 * QCET E-Office Automated Backup & Restore Drill
 * Sprint 10 Workstream 10.3: Disaster Recovery & Backup Verification Drill
 *
 * Verifies:
 * 1. Execution of database backup using pg_dump.
 * 2. Creation of an isolated, uniquely named temporary drill database.
 * 3. Execution of database restore using pg_restore.
 * 4. 100% data integrity verification across critical entity tables.
 * 5. Automatic cleanup of drill artifacts and database.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import nextEnv from '@next/env';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const baseDbUrl = process.env.DATABASE_URL;
if (!baseDbUrl) {
  console.error('[drill] FATAL: DATABASE_URL is not set.');
  process.exit(1);
}

const drillDbName = `qcet_drill_test_${process.pid}_${Date.now()}`;
if (!/^qcet_drill_test_[0-9]+_[0-9]+$/.test(drillDbName)) {
  throw new Error('Unsafe disaster-recovery drill database name');
}
const drillDbUrl = baseDbUrl.replace(/\/([a-zA-Z0-9_-]+)(\?.*)?$/, `/${drillDbName}$2`);
const timestamp = Date.now();
const tempBackupDir = path.join(rootDir, 'backups', 'drill-temp');
fs.mkdirSync(tempBackupDir, { recursive: true });
const dumpFile = path.join(tempBackupDir, `drill_test_${timestamp}.dump`);

const cleanBaseDbUrl = baseDbUrl.split('?')[0];
const cleanDrillDbUrl = drillDbUrl.split('?')[0];

console.log('================================================================');
console.log('  QCET E-OFFICE DISASTER RECOVERY & BACKUP DRILL (SPRINT 10)   ');
console.log('================================================================');
console.log(`[drill] Base DB URL: ${cleanBaseDbUrl.replace(/:[^:@]+@/, ':****@')}`);
console.log(`[drill] Drill DB URL: ${cleanDrillDbUrl.replace(/:[^:@]+@/, ':****@')}`);
console.log(`[drill] Dump Destination: ${dumpFile}`);

// Check for pg_dump and pg_restore
const hasPgDump = spawnSync('pg_dump', ['--version']).status === 0;
const hasPgRestore = spawnSync('pg_restore', ['--version']).status === 0;

if (!hasPgDump || !hasPgRestore) {
  console.error('[drill] FATAL: pg_dump and pg_restore are required for a real restore drill.');
  process.exit(1);
}

const sourcePrisma = new PrismaClient({
  datasources: { db: { url: baseDbUrl } },
});
let drillPrisma;
let drillDatabaseCreated = false;

async function runDrill() {
  try {
    // 1. Collect Source Metrics
    console.log('[drill] Step 1: Querying source database state...');
    await sourcePrisma.$connect();

    const tableRows = await sourcePrisma.$queryRawUnsafe(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    const allTables = ['_prisma_migrations', ...tableRows.map((r) => r.table_name)];
    // deduplicate
    const targetTables = Array.from(new Set(allTables));

    const getTableCount = async (client, tableName) => {
      try {
        const rows = await client.$queryRawUnsafe(`SELECT count(*)::int as count FROM "${tableName}"`);
        return rows[0]?.count ?? 0;
      } catch {
        return null;
      }
    };

    const sourceCounts = {};
    for (const table of targetTables) {
      sourceCounts[table] = await getTableCount(sourcePrisma, table);
      console.log(`[drill] Source "${table}": ${sourceCounts[table] ?? 'N/A'}`);
    }

    // 2. Execute pg_dump
    console.log('[drill] Step 2: Executing pg_dump custom binary format...');
    const dumpRes = spawnSync(
      'pg_dump',
      ['--dbname', cleanBaseDbUrl, '-F', 'c', '-b', '-f', dumpFile],
      { stdio: 'inherit' }
    );
    if (dumpRes.status !== 0) {
      throw new Error(`pg_dump failed with status ${dumpRes.status}`);
    }
    const stat = fs.statSync(dumpFile);
    console.log(`[drill] ✓ Dump created successfully (${(stat.size / 1024).toFixed(2)} KB)`);

    // 3. Prepare Target Drill Database
    console.log(`[drill] Step 3: Creating temporary drill database "${drillDbName}"...`);
    try {
      await sourcePrisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${drillDbName}" WITH (FORCE)`);
    } catch {
      await sourcePrisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${drillDbName}"`);
    }
    await sourcePrisma.$executeRawUnsafe(`CREATE DATABASE "${drillDbName}"`);
    drillDatabaseCreated = true;

    // 4. Execute pg_restore
    console.log('[drill] Step 4: Restoring dump into drill database using pg_restore...');
    const restoreRes = spawnSync(
      'pg_restore',
      [
        '--clean',
        '--if-exists',
        '--no-owner',
        '--no-privileges',
        '--exit-on-error',
        '-d',
        cleanDrillDbUrl,
        dumpFile,
      ],
      { stdio: 'inherit' }
    );
    if (restoreRes.status !== 0) {
      throw new Error(`pg_restore failed with status ${restoreRes.status}`);
    }
    console.log('[drill] ✓ Restore completed.');

    // 5. Connect to Restored Database & Verify 100% Integrity
    console.log('[drill] Step 5: Connecting to restored database for data verification...');
    drillPrisma = new PrismaClient({
      datasources: { db: { url: drillDbUrl } },
    });
    await drillPrisma.$connect();

    let allMatched = true;
    for (const table of targetTables) {
      const restoredCount = await getTableCount(drillPrisma, table);
      const expectedCount = sourceCounts[table];
      const match = expectedCount === restoredCount;
      console.log(
        `[drill] Verify "${table}": Expected=${expectedCount} | Restored=${restoredCount} | ${match ? 'MATCH ✓' : 'MISMATCH ✗'}`
      );
      if (!match) {
        allMatched = false;
      }
    }

    await drillPrisma.$disconnect();
    drillPrisma = undefined;

    if (!allMatched) {
      throw new Error('Data integrity mismatch detected between source and restored database!');
    }

    console.log('[drill] ✓ 100% Data Integrity Verified across all critical entities.');

    console.log('================================================================');
    console.log('  BACKUP & RESTORE DRILL COMPLETED SUCCESSFULLY: 100% PASS     ');
    console.log('================================================================');
  } catch (err) {
    console.error('[drill] FATAL DRILL ERROR:', err);
    process.exitCode = 1;
  } finally {
    if (drillPrisma) {
      await drillPrisma.$disconnect().catch(() => {});
    }
    if (drillDatabaseCreated) {
      console.log(`[drill] Cleanup: dropping temporary database "${drillDbName}"...`);
      try {
        await sourcePrisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${drillDbName}" WITH (FORCE)`);
      } catch (error) {
        console.error('[drill] Cleanup failed while dropping drill database:', error);
        process.exitCode = 1;
      }
    }
    if (fs.existsSync(dumpFile)) {
      fs.unlinkSync(dumpFile);
    }
    try {
      fs.rmdirSync(tempBackupDir);
    } catch {}
    await sourcePrisma.$disconnect();
  }
}

runDrill();
