import { spawnSync } from 'child_process';

// Dùng runner chung: test chạy với cwd của workspace apps/api (alias @/ của api) và cùng env test (NODE_ENV, DB qcet_test).
const res = spawnSync(
  process.execPath,
  ['scripts/run-tests.mjs', '--files', 'apps/api/tests/security/master-cutover-gate0.test.ts'],
  { stdio: 'inherit' }
);

process.exit(res.status ?? 1);
