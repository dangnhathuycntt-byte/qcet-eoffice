import nextEnv from '@next/env';
import { spawnSync } from 'child_process';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const testDbUrl = (process.env.DATABASE_URL || '').replace(/\/qcet_eoffice(\?.*)?$/, '/qcet_test$1');

const env = {
  ...process.env,
  NODE_ENV: 'test',
  QCET_ALLOW_DB_TESTS: '1',
  DATABASE_URL: testDbUrl,
};

const sprint3Tests = [
  'tests/task-occ-concurrency.test.ts',
  'tests/idempotency-command.test.ts',
  'tests/outbox-worker.test.ts',
  'tests/document-acl-pagination.test.ts',
  'tests/institution-config.test.ts',
  'tests/m21-negative-authorization-concurrency.test.ts',
];

const res = spawnSync('npx', ['tsx', '--test', '--test-concurrency=1', ...sprint3Tests], {
  env,
  stdio: 'inherit',
});

process.exit(res.status ?? 1);
