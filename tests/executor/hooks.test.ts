import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import runState from '../../.claude/hooks/qcet-run-state.cjs';

const { getRunDir, writeWitness } = runState;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const ownershipGuard = path.join(rootDir, '.claude', 'hooks', 'pre-tool-use-ownership-guard');
const evidenceGate = path.join(rootDir, '.claude', 'hooks', 'subagent-stop-evidence-gate');
const runEventHook = path.join(rootDir, '.claude', 'hooks', 'qcet-run-event');

function runHook(hookPath: string, stdinJson: Record<string, any>, env: Record<string, any> = {}) {
  const res = spawnSync('node', [hookPath], {
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

test('pre-tool-use-ownership-guard: non-Write/Edit tools are immediately allowed (exit 0)', () => {
  const res = runHook(ownershipGuard, {
    tool_name: 'Read',
    tool_input: { file_path: 'src/secret.ts' },
  });
  assert.equal(res.status, 0);
});

test('pre-tool-use-ownership-guard: read-only agent cannot call Write (exit 2 blocked)', () => {
  const res = runHook(ownershipGuard, {
    tool_name: 'Write',
    agent_type: 'qcet-recon',
    tool_input: { file_path: 'src/app.ts', content: 'test' },
  });
  assert.equal(res.status, 2);
  assert.ok(res.stderr.includes('read-only role'));
});

test('pre-tool-use-ownership-guard: skeptic agent cannot call Edit (exit 2 blocked)', () => {
  const res = runHook(ownershipGuard, {
    tool_name: 'Edit',
    agent_type: 'qcet-skeptic',
    tool_input: { file_path: 'src/app.ts', old_string: 'a', new_string: 'b' },
  });
  assert.equal(res.status, 2);
  assert.ok(res.stderr.includes('read-only role'));
});

test('pre-tool-use-ownership-guard: builder with subagent label resolves shard and allows owned file', () => {
  const runId = 'test-run-' + Date.now();
  const runDir = getRunDir(rootDir, runId);
  const stateFile = path.join('/tmp', `qcet-active-shards-${runId}.json`);
  const activeShards = [
    {
      id: 'shard-auth',
      owns: ['src/server/auth/**'],
      antiOwns: ['src/server/db/**'],
    },
  ];
  fs.writeFileSync(stateFile, JSON.stringify(activeShards), 'utf8');
  writeWitness(runDir, 'shards/shard-auth/worktree.json', {
    root: rootDir,
    shardId: 'shard-auth',
  });

  try {
    const res = runHook(
      ownershipGuard,
      {
        tool_name: 'Write',
        agent_type: 'qcet-builder',
        subagent_label: 'builder:shard-auth',
        tool_input: { file_path: 'src/server/auth/jwt.ts', content: 'export const x = 1;' },
      },
      { QCET_RUN_ID: runId }
    );
    assert.equal(res.status, 0);
  } finally {
    if (fs.existsSync(stateFile)) fs.unlinkSync(stateFile);
    if (fs.existsSync(runDir)) fs.rmSync(runDir, { recursive: true, force: true });
  }
});

test('pre-tool-use-ownership-guard: builder modifying file outside owns is blocked (exit 2)', () => {
  const runId = 'test-run-' + Date.now();
  const runDir = getRunDir(rootDir, runId);
  const stateFile = path.join('/tmp', `qcet-active-shards-${runId}.json`);
  const activeShards = [
    {
      id: 'shard-auth',
      owns: ['src/server/auth/**'],
      antiOwns: ['src/server/db/**'],
    },
  ];
  fs.writeFileSync(stateFile, JSON.stringify(activeShards), 'utf8');
  writeWitness(runDir, 'shards/shard-auth/worktree.json', {
    root: rootDir,
    shardId: 'shard-auth',
  });

  try {
    const res = runHook(
      ownershipGuard,
      {
        tool_name: 'Write',
        agent_type: 'qcet-builder',
        subagent_label: 'builder:shard-auth',
        tool_input: { file_path: 'src/ui/dashboard.tsx', content: 'export const y = 2;' },
      },
      { QCET_RUN_ID: runId }
    );
    assert.equal(res.status, 2);
    assert.ok(res.stderr.includes('outside assigned ownership scope'));
  } finally {
    if (fs.existsSync(stateFile)) fs.unlinkSync(stateFile);
    if (fs.existsSync(runDir)) fs.rmSync(runDir, { recursive: true, force: true });
  }
});

test('pre-tool-use-ownership-guard: builder modifying file matching antiOwns is blocked (exit 2)', () => {
  const runId = 'test-run-' + Date.now();
  const runDir = getRunDir(rootDir, runId);
  const stateFile = path.join('/tmp', `qcet-active-shards-${runId}.json`);
  const activeShards = [
    {
      id: 'shard-auth',
      owns: ['src/server/**'],
      antiOwns: ['src/server/db/**'],
    },
  ];
  fs.writeFileSync(stateFile, JSON.stringify(activeShards), 'utf8');
  writeWitness(runDir, 'shards/shard-auth/worktree.json', {
    root: rootDir,
    shardId: 'shard-auth',
  });

  try {
    const res = runHook(
      ownershipGuard,
      {
        tool_name: 'Write',
        agent_type: 'qcet-builder',
        subagent_label: 'builder:shard-auth',
        tool_input: { file_path: 'src/server/db/client.ts', content: 'export const db = null;' },
      },
      { QCET_RUN_ID: runId }
    );
    assert.equal(res.status, 2);
    assert.ok(res.stderr.includes('violates antiOwns constraint'));
  } finally {
    if (fs.existsSync(stateFile)) fs.unlinkSync(stateFile);
    if (fs.existsSync(runDir)) fs.rmSync(runDir, { recursive: true, force: true });
  }
});

test('pre-tool-use-ownership-guard: external file never matches repo owns (exit 2 blocked for builder)', () => {
  const runId = 'test-run-' + Date.now();
  const stateFile = path.join('/tmp', `qcet-active-shards-${runId}.json`);
  const activeShards = [
    {
      id: 'shard-auth',
      owns: ['src/server/auth/**'],
    },
  ];
  fs.writeFileSync(stateFile, JSON.stringify(activeShards), 'utf8');

  try {
    const res = runHook(
      ownershipGuard,
      {
        tool_name: 'Write',
        agent_type: 'qcet-builder',
        subagent_label: 'builder:shard-auth',
        tool_input: { file_path: '/tmp/other/src/server/auth/leak.ts', content: 'test' },
      },
      { QCET_RUN_ID: runId }
    );
    assert.equal(res.status, 2);
  } finally {
    if (fs.existsSync(stateFile)) fs.unlinkSync(stateFile);
  }
});

test('subagent-stop-evidence-gate: non-builder agent exit allowed without evidence', () => {
  const res = runHook(evidenceGate, {
    agent_type: 'qcet-recon',
    last_assistant_message: 'Completed reconnaissance analysis.',
  });
  assert.equal(res.status, 0);
});

test('subagent-stop-evidence-gate: builder agent without structured evidence is bounced back (exit 2)', () => {
  const runId = 'test-gate-' + Date.now();
  const res = runHook(
    evidenceGate,
    {
      agent_type: 'qcet-builder',
      agent_id: 'builder:shard-1',
      last_assistant_message: 'I finished modifying the files.',
    },
    { QCET_RUN_ID: runId }
  );
  assert.equal(res.status, 2);
  assert.ok(
    res.stderr.includes('Incomplete execution evidence') ||
      res.stdout.includes('missing mandatory execution evidence')
  );
});

test('subagent-stop-evidence-gate: builder agent with complete structured evidence is allowed (exit 0)', () => {
  const runId = 'test-gate-' + Date.now();
  const res = runHook(
    evidenceGate,
    {
      agent_type: 'qcet-builder',
      agent_id: 'builder:shard-1',
      last_assistant_message: {
        structuredOutput: {
          status: 'success',
          changedFiles: ['src/a.ts'],
          testsRun: ['npm test'],
          requirementsSatisfied: ['REQ-1'],
        },
      },
    },
    { QCET_RUN_ID: runId }
  );
  assert.equal(res.status, 0);
});



test('pre-tool-use-ownership-guard: builder mutating Bash is blocked', () => {
  const res = runHook(ownershipGuard, {
    tool_name: 'Bash',
    agent_type: 'qcet-builder',
    agent_id: 'shard-auth:implement',
    tool_input: { command: "sed -i 's/a/b/' src/server/auth/session.ts" },
  });
  assert.equal(res.status, 2);
  assert.ok(res.stderr.includes('shell file mutation'));
});

test('pre-tool-use-ownership-guard: builder inline interpreter mutation is blocked', () => {
  const res = runHook(ownershipGuard, {
    tool_name: 'Bash',
    agent_type: 'qcet-builder',
    agent_id: 'shard-auth:implement',
    tool_input: { command: "python -c \"open('src/server/auth/session.ts','w').write('x')\"" },
  });
  assert.equal(res.status, 2);
  assert.ok(res.stderr.includes('shell file mutation'));
});

test('pre-tool-use-ownership-guard: builder non-mutating Bash remains allowed', () => {
  const res = runHook(ownershipGuard, {
    tool_name: 'Bash',
    agent_type: 'qcet-builder',
    agent_id: 'shard-auth:implement',
    tool_input: { command: 'npm test -- tests/unit/auth.test.ts' },
  });
  assert.equal(res.status, 0);
});

test('settings: ownership guard also receives Bash PreToolUse events', () => {
  const settings = JSON.parse(fs.readFileSync(path.join(rootDir, '.claude', 'settings.json'), 'utf8'));
  const entry = settings.hooks.PreToolUse.find((item: any) =>
    item.hooks?.some((hook: any) => hook.command.endsWith('/pre-tool-use-ownership-guard'))
  );
  assert.ok(entry);
  assert.ok(String(entry.matcher).split('|').includes('Bash'));
});

test('pre-tool-use-ownership-guard: read-only agent allowed shell commands', () => {
  const allowed = [
    'git status',
    'git status --short',
    'git diff',
    'git diff HEAD~1',
    'git log -n 5',
    'git show HEAD',
    'git grep "test"',
    'git rev-parse --show-toplevel',
    'git ls-files',
    'npm run typecheck',
    'npm run lint',
    'npm test',
    'npm test -- tests/unit/auth.test.ts',
    'npm run test',
    'npm run test -- tests/unit/auth.test.ts',
    'npx tsx --test tests/executor/hooks.test.ts',
  ];

  for (const cmd of allowed) {
    const res = runHook(ownershipGuard, {
      tool_name: 'Bash',
      agent_type: 'qcet-skeptic',
      tool_input: { command: cmd },
    });
    assert.equal(res.status, 0, `Command should be allowed for skeptic: ${cmd}`);
  }
});

test('pre-tool-use-ownership-guard: read-only agent denied disallowed commands', () => {
  const disallowed = [
    'git add .',
    'git commit -m "fix"',
    'npm install',
    'mkdir newdir',
    'chmod +x script.sh',
    'touch newfile.ts',
    'node -e "console.log(1)"',
    'python -c "print(1)"',
    'cat file.txt',
    'rm -rf node_modules',
  ];

  for (const cmd of disallowed) {
    const res = runHook(ownershipGuard, {
      tool_name: 'Bash',
      agent_type: 'qcet-skeptic',
      tool_input: { command: cmd },
    });
    assert.equal(res.status, 2, `Command should be blocked for skeptic: ${cmd}`);
    assert.ok(res.stderr.includes('disallowed shell command') || res.stderr.includes('shell file mutation'));
  }
});

test('pre-tool-use-ownership-guard: read-only agent blocked on compound/redirection syntax and risky flags', () => {
  const compoundOrRisky = [
    'git status && git diff',
    'git status || git diff',
    'git status ; git diff',
    'git status | grep modified',
    'git status > status.txt',
    'git status < input.txt',
    'echo $(git rev-parse HEAD)',
    'echo `git rev-parse HEAD`',
    'git diff --ext-diff',
    'git diff --no-index a.txt b.txt',
    'git diff --output=diff.txt',
    'git diff --output diff.txt',
  ];

  for (const cmd of compoundOrRisky) {
    const res = runHook(ownershipGuard, {
      tool_name: 'Bash',
      agent_type: 'qcet-skeptic',
      tool_input: { command: cmd },
    });
    assert.equal(res.status, 2, `Compound or risky command should be blocked: ${cmd}`);
  }
});

test('qcet-run-event: no-op exit 0 when QCET_RUN_ID is absent', () => {
  const res = runHook(runEventHook, {
    tool_name: 'Read',
    agent_type: 'qcet-recon',
  }, { QCET_RUN_ID: '' });
  assert.equal(res.status, 0);
});

test('qcet-run-event: records bounded event when QCET_RUN_ID is present', () => {
  const runId = 'test-hook-event-' + Date.now();
  const runDir = path.join(rootDir, '.claude', 'executor-runs', runId);

  try {
    const res = runHook(runEventHook, {
      hook_event_name: 'PostToolUse',
      tool_name: 'Write',
      agent_type: 'qcet-builder',
      tool_input: { file_path: 'src/app.ts', content: 'SECRET_DUMP_OMITTED' },
    }, { QCET_RUN_ID: runId });

    assert.equal(res.status, 0);
    const eventsFile = path.join(runDir, 'events.jsonl');
    assert.ok(fs.existsSync(eventsFile));
    const lines = fs.readFileSync(eventsFile, 'utf8').trim().split('\n');
    assert.equal(lines.length, 1);
    const parsed = JSON.parse(lines[0]);
    assert.equal(parsed.seq, 1);
    assert.equal(parsed.type, 'PostToolUse');
    assert.equal(parsed.agentType, 'qcet-builder');
    assert.equal(parsed.toolName, 'Write');
    assert.equal(parsed.path, 'src/app.ts');
    // Content should not be dumped
    assert.equal(parsed.content, undefined);
  } finally {
    if (fs.existsSync(runDir)) {
      fs.rmSync(runDir, { recursive: true, force: true });
    }
  }
});
