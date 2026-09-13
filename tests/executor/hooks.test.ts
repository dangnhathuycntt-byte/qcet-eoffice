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

test('pre-tool-use-ownership-guard: non-Write/Edit tools are immediately allowed for normal agents (exit 0)', () => {
  const res = runHook(ownershipGuard, {
    tool_name: 'Read',
    tool_input: { file_path: 'src/secret.ts' },
  });
  assert.equal(res.status, 0);
});

test('pre-tool-use-ownership-guard: read-only agent can run read-only Bash commands (exit 0 allowed)', () => {
  const readOnlyAgents = ['qcet-recon', 'qcet-skeptic', 'qcet-researcher', 'verifier'];
  // Canonical deny-by-default allowlist for read-only agents. Only these
  // inspection/verification command shapes are permitted; anything else
  // (including `rg` and shell redirection) is denied.
  const allowedCommands = [
    'git status',
    'git diff',
    'git diff --staged',
    'git log -n 5',
    'git grep "function login"',
    'git ls-files',
    'npm test',
    'npm run typecheck',
    'npm run lint',
  ];

  for (const agent of readOnlyAgents) {
    for (const cmd of allowedCommands) {
      const res = runHook(ownershipGuard, {
        tool_name: 'Bash',
        agent_type: agent,
        tool_input: { command: cmd },
      });
      assert.equal(
        res.status,
        0,
        `Expected command '${cmd}' to be allowed for read-only agent '${agent}'`
      );
    }
  }
});

test('pre-tool-use-ownership-guard: read-only agent cannot run mutating Bash commands (exit 2 blocked)', () => {
  const readOnlyAgents = ['qcet-recon', 'qcet-skeptic', 'qcet-researcher', 'verifier'];
  const blockedCommands = [
    'rm -rf src/critical.ts',
    'mv src/a.ts src/b.ts',
    'cp src/a.ts src/b.ts',
    'touch src/new_file.ts',
    'sed -i "s/old/new/g" src/index.ts',
    'git checkout HEAD -- src/app.ts',
    'git reset --hard HEAD',
    'git clean -fd',
    'git apply patch.diff',
    'npm install lodash',
    'npm i express',
    'echo "hello" > src/output.txt',
    'echo "hello" >> src/output.txt',
    'echo "data" >src/output.txt',
    'echo "data" 1> src/output.txt',
  ];

  for (const agent of readOnlyAgents) {
    for (const cmd of blockedCommands) {
      const res = runHook(ownershipGuard, {
        tool_name: 'Bash',
        agent_type: agent,
        tool_input: { command: cmd },
      });
      assert.equal(
        res.status,
        2,
        `Expected command '${cmd}' to be blocked for read-only agent '${agent}'`
      );
      assert.ok(
        res.stderr.includes('disallowed shell command'),
        `Expected stderr to explain prohibition for command '${cmd}'`
      );
    }
  }
});

test('pre-tool-use-ownership-guard: builder agent is not gated by the read-only bash allowlist (exit 0 allowed)', () => {
  // The deny-by-default read-only allowlist applies only to read-only agents.
  // These commands are absent from that allowlist (so a read-only agent would be
  // denied) yet are non-mutating, so the builder shell guard must permit them.
  // Builder shell *mutation* remains blocked separately (see the mutating-Bash tests).
  const builderCommands = [
    'ls -la src',
    'cat package.json',
    'git blame src/app.ts',
    'npm run build',
  ];

  for (const cmd of builderCommands) {
    const res = runHook(ownershipGuard, {
      tool_name: 'Bash',
      agent_type: 'qcet-builder',
      tool_input: { command: cmd },
    });
    assert.equal(
      res.status,
      0,
      `Expected builder agent to be permitted for Bash command '${cmd}'`
    );
  }
});

test('settings.json: PreToolUse Bash hook configuration enforces exact guard ordering', () => {
  const settingsPath = path.join(rootDir, '.claude', 'settings.json');
  const raw = fs.readFileSync(settingsPath, 'utf8');
  const settings = JSON.parse(raw);

  // A hook entry governs Bash when its matcher pattern list includes 'Bash'.
  // Multiple entries may match Bash; the effective guard order is the flattened
  // command sequence across all Bash-matching entries.
  const bashMatchers: { matcher: string; hooks: { command: string }[] }[] = (
    settings.hooks?.PreToolUse ?? []
  ).filter((entry: { matcher: string }) => String(entry.matcher).split('|').includes('Bash'));
  assert.ok(bashMatchers.length > 0, 'At least one PreToolUse entry must match Bash');

  const bashHookCommands = bashMatchers.flatMap((entry) =>
    entry.hooks.map((hook) => hook.command)
  );

  // Ordering invariant:
  // 1. ./.claude/hooks/pre-tool-use-ownership-guard (ownership/read-only guard)
  // 2. ./.claude/hooks/guard-next-build (build safety guard)
  // 3. ./.claude/hooks/protect-sensitive-files (sensitive-file guard)
  assert.equal(bashHookCommands.length, 3, 'Bash should be guarded by exactly 3 hooks');

  const commandIndex = (suffix: string) =>
    bashHookCommands.findIndex((command) => command.endsWith(suffix));

  assert.equal(
    commandIndex('/pre-tool-use-ownership-guard'),
    0,
    'First Bash hook must be pre-tool-use-ownership-guard'
  );
  assert.equal(
    commandIndex('/guard-next-build'),
    1,
    'Second Bash hook must be guard-next-build'
  );
  assert.equal(
    commandIndex('/protect-sensitive-files'),
    2,
    'Third Bash hook must be protect-sensitive-files'
  );
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
    'rg "function login" src/',
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
    'git status > /dev/null 2>&1',
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

test('qcet-run-event: removed in Lean V2 and not registered in settings.json', () => {
  assert.equal(
    fs.existsSync(path.join(rootDir, '.claude', 'hooks', 'qcet-run-event')),
    false,
    'qcet-run-event script must be removed in Lean V2'
  );

  const settings = JSON.parse(fs.readFileSync(path.join(rootDir, '.claude', 'settings.json'), 'utf8'));
  const allHooks = JSON.stringify(settings.hooks || {});
  assert.equal(
    allHooks.includes('qcet-run-event'),
    false,
    'qcet-run-event must not be registered in settings.json'
  );
});
