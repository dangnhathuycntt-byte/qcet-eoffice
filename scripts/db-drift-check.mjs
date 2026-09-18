#!/usr/bin/env node
import { execSync } from 'child_process';
import nextEnv from '@next/env';
const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

console.log('[db:drift:check] Verifying Prisma migration status...');

// 1. Check migration status
try {
  const statusOut = execSync('npx prisma migrate status', {
    env: process.env,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  console.log(statusOut.trim());
} catch (err) {
  console.error('[db:drift:check] ERROR: prisma migrate status failed!');
  console.error(err.stdout || err.message);
  process.exit(1);
}

// 2. Check schema drift between live database datasource and Prisma datamodel
console.log('[db:drift:check] Checking schema drift against Prisma datamodel...');
let diffSql = '';
try {
  diffSql = execSync(
    'npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script',
    {
      env: process.env,
      encoding: 'utf8',
      stdio: 'pipe',
    }
  );
} catch (err) {
  console.error('[db:drift:check] ERROR: prisma migrate diff failed!');
  console.error(err.stdout || err.message);
  process.exit(1);
}

// 3. Filter out acceptable custom PostgreSQL extensions & trigram indexes
// These indexes are intentionally defined in versioned SQL migration because Prisma schema syntax does not natively support gin_trgm_ops.
const allowedDiffLines = [
  'DROP INDEX "document_summary_trgm_idx";',
  'DROP INDEX "task_title_trgm_idx";',
  'DROP INDEX "user_name_trgm_idx";',
  '-- DropIndex',
];

const cleanedLines = diffSql
  .split('\n')
  .map((line) => line.trim())
  .filter(
    (line) =>
      line.length > 0 &&
      !line.startsWith('--') &&
      !line.startsWith('warn') &&
      !line.startsWith('For more information')
  )
  .filter((line) => !allowedDiffLines.includes(line));

if (cleanedLines.length > 0) {
  console.error('[db:drift:check] ERROR: Unexpected database drift detected:');
  console.error(cleanedLines.join('\n'));
  process.exit(1);
}

console.log('[db:drift:check] SUCCESS: Database schema and migrations are in sync with zero unexpected drift.');
process.exit(0);
