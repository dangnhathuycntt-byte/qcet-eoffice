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

const sprint2Tests = [
  'tests/security/session-revocation.test.ts',
  'tests/security/authorization-context-v2.test.ts',
  'tests/security/capability-catalog.test.ts',
  'tests/security/authorization-engine.test.ts',
  'tests/security/meeting-authorization.test.ts',
  'tests/security/document-classification.test.ts',
  'tests/security/task-read-v2-parity.test.ts',
  'tests/security/role-equivalence-audit.test.ts',
  'tests/security/me-context-api.test.ts',
  'tests/security/available-actions.test.ts',
  'tests/security/authorization-audit.test.ts',
  'tests/security/authorization-context-cache.test.ts',
];

const res = spawnSync('npx', ['tsx', '--test', '--test-concurrency=1', ...sprint2Tests], {
  env,
  stdio: 'inherit',
});

process.exit(res.status ?? 1);
