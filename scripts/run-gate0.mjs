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

const res = spawnSync('npx', ['tsx', '--test', 'tests/security/master-cutover-gate0.test.ts'], {
  env,
  stdio: 'inherit',
});

process.exit(res.status ?? 1);
