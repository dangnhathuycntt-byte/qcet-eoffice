import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const ownershipGuard = path.join(rootDir, '.claude', 'hooks', 'pre-tool-use-ownership-guard');

function runHook(stdinJson: Record<string, any>, env: Record<string, any> = {}) {
  const res = spawnSync('node', [ownershipGuard], {
    cwd: rootDir,
    input: JSON.stringify(stdinJson),
    encoding: 'utf8',
    env: {
      ...process.env,
      ...env,
    },
  });
  return {
    status: res.status,
    stdout: res.stdout,
    stderr: res.stderr,
  };
}

test('readonly-shell: allowed commands pass for read-only agents', (t) => {
  if (!fs.existsSync(ownershipGuard)) {
    t.skip('Legacy ownership guard hook not present');
    return;
  }
  const allowedCommands = [
    'git status',
    'git status --short',
    'git diff',
    'git diff HEAD~1',
    'git log -n 5',
    'git show HEAD',
    'git grep "function"',
    'git rev-parse HEAD',
    'git ls-files',
    'npm run typecheck',
    'npm run lint',
    'npm test',
    'npm run test',
    'npm test -- tests/unit',
    'npx tsx --test tests/executor/agent-limits.test.ts',
  ];

  for (const cmd of allowedCommands) {
    const res = runHook({
      tool_name: 'Bash',
      agent_type: 'qcet-skeptic',
      tool_input: { command: cmd },
    });
    assert.equal(res.status, 0, `Command should be allowed: ${cmd}, got ${res.status}`);
  }
});

test('readonly-shell: disallowed commands are blocked by default for read-only agents', (t) => {
  if (!fs.existsSync(ownershipGuard)) {
    t.skip('Legacy ownership guard hook not present');
    return;
  }
  const disallowedCommands = [
    'rm -rf node_modules',
    'touch newfile.txt',
    'mkdir src/temp',
    'echo "hello" > test.txt',
    'cat src/index.ts',
    'node -e "console.log(1)"',
    'python3 -c "print(1)"',
    'curl https://example.com',
    'git commit -m "fix"',
    'git push origin main',
    'git checkout -b new-branch',
  ];

  for (const cmd of disallowedCommands) {
    const res = runHook({
      tool_name: 'Bash',
      agent_type: 'qcet-skeptic',
      tool_input: { command: cmd },
    });
    assert.equal(res.status, 2, `Command should be denied: ${cmd}, got ${res.status}`);
    assert.ok(res.stderr.includes('BLOCKED'), `Stderr must contain BLOCKED for: ${cmd}`);
  }
});

test('readonly-shell: compound commands and redirections are blocked for read-only agents', (t) => {
  if (!fs.existsSync(ownershipGuard)) {
    t.skip('Legacy ownership guard hook not present');
    return;
  }
  const compoundCommands = [
    'git status && git diff',
    'git diff; echo "done"',
    'git status | grep modified',
    'git diff > diff.patch',
    'git log < input.txt',
    'git show `git rev-parse HEAD`',
    'git show $(git rev-parse HEAD)',
  ];

  for (const cmd of compoundCommands) {
    const res = runHook({
      tool_name: 'Bash',
      agent_type: 'qcet-skeptic',
      tool_input: { command: cmd },
    });
    assert.equal(res.status, 2, `Compound command should be denied: ${cmd}`);
    assert.ok(res.stderr.includes('BLOCKED'));
  }
});

test('readonly-shell: risky git diff flags are blocked for read-only agents', (t) => {
  if (!fs.existsSync(ownershipGuard)) {
    t.skip('Legacy ownership guard hook not present');
    return;
  }
  const riskyDiffCommands = [
    'git diff --ext-diff',
    'git diff --no-index fileA fileB',
    'git diff --output=diff.txt',
  ];

  for (const cmd of riskyDiffCommands) {
    const res = runHook({
      tool_name: 'Bash',
      agent_type: 'qcet-skeptic',
      tool_input: { command: cmd },
    });
    assert.equal(res.status, 2, `Risky git diff flag should be denied: ${cmd}`);
    assert.ok(res.stderr.includes('BLOCKED'));
  }
});
