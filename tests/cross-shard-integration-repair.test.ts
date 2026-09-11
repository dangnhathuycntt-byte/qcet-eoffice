import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

describe('Cross-Shard Integration Repair Verification', () => {
  const repoRoot = process.cwd();
  let helpers: any;

  before(async () => {
    const executorPath = path.join(repoRoot, '.claude/workflows/qcet-plan-executor.js');
    const content = fs.readFileSync(executorPath, 'utf8');
    const helperCode = content.split('// -----------------------------------------------------------------------------\n// WORKFLOW')[0];
    const tempFile = path.join('/tmp', `qcet-executor-helpers-${Date.now()}.mjs`);
    fs.writeFileSync(tempFile, helperCode, 'utf8');
    try {
      helpers = await import(tempFile);
    } finally {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  });

  it('DEFECT-01: qcet-plan-executor.js contains no Date.now() or argless new Date() calls', () => {
    const executorPath = path.join(repoRoot, '.claude/workflows/qcet-plan-executor.js');
    const content = fs.readFileSync(executorPath, 'utf8');

    assert.ok(
      !content.includes('Date.now()'),
      'qcet-plan-executor.js must not call Date.now() directly'
    );
    assert.ok(
      !/new\s+Date\(\s*\)/.test(content),
      'qcet-plan-executor.js must not call argless new Date()'
    );
  });

  it('DEFECT-02: pre-tool-use-ownership-guard enforces bounds from active shards file for builder agents', () => {
    const guardScript = path.join(repoRoot, '.claude/hooks/pre-tool-use-ownership-guard');
    const testShardsFile = path.join('/tmp', `qcet-active-shards-test-${Date.now()}.json`);

    fs.writeFileSync(
      testShardsFile,
      JSON.stringify([
        {
          id: 'shard-test',
          agentId: 'shard-test:implement',
          owns: ['src/lib/safe.ts'],
          antiOwns: ['src/lib/forbidden.ts'],
        },
      ]),
      'utf8'
    );

    try {
      // 1. Allowed file edit for shard-test
      const allowPayload = JSON.stringify({
        toolName: 'Edit',
        toolInput: { file_path: path.join(repoRoot, 'src/lib/safe.ts') },
        agentType: 'qcet-builder',
        agentId: 'shard-test:implement',
      });
      const allowResult = execFileSync('node', [guardScript], {
        input: allowPayload,
        env: { ...process.env, QCET_ACTIVE_SHARDS_FILE: testShardsFile },
        encoding: 'utf8',
      });
      assert.ok(
        allowResult.includes('"allow"') || allowResult.length === 0 || !allowResult.includes('"block"'),
        'Guard should allow edits within shard bounds'
      );

      // 2. Blocked file edit (out of shard bounds)
      const blockPayload = JSON.stringify({
        toolName: 'Edit',
        toolInput: { file_path: path.join(repoRoot, 'src/lib/forbidden.ts') },
        agentType: 'qcet-builder',
        agentId: 'shard-test:implement',
      });

      let blocked = false;
      try {
        const blockResult = execFileSync('node', [guardScript], {
          input: blockPayload,
          env: { ...process.env, QCET_ACTIVE_SHARDS_FILE: testShardsFile },
          encoding: 'utf8',
        });
        if (blockResult.includes('"block"')) {
          blocked = true;
        }
      } catch (err: any) {
        if (err.status === 2 || err.stdout?.includes('"block"')) {
          blocked = true;
        }
      }
      assert.ok(blocked, 'Guard must block edits outside shard bounds for builder agent');
    } finally {
      if (fs.existsSync(testShardsFile)) {
        fs.unlinkSync(testShardsFile);
      }
    }
  });

  it('DEFECT-03: subagent-stop-evidence-gate exempts telemetry-recorder utility agent', () => {
    const gateScript = path.join(repoRoot, '.claude/hooks/subagent-stop-evidence-gate');

    const telemetryStopPayload = JSON.stringify({
      agentType: 'qcet-telemetry-recorder',
      agentId: 'telemetry-recorder',
      label: 'telemetry-recorder',
      phase: 'Release Gate',
      subagentResult: { status: 'persisted', path: '.claude/executor-evals/run-telemetry.json' },
    });

    let exitCode = 0;
    let output = '';
    try {
      output = execFileSync('node', [gateScript], {
        input: telemetryStopPayload,
        encoding: 'utf8',
      });
    } catch (err: any) {
      exitCode = err.status;
      output = err.stdout || '';
    }

    assert.equal(exitCode, 0, 'Telemetry recorder must exit 0 and be exempted from builder evidence checks');
    assert.ok(!output.includes('BLOCKED'), 'Telemetry recorder must not be blocked');
  });

  it('DEFECT-04: bounce-back tracking state does not cause global bypass across distinct builders', () => {
    const gateScript = path.join(repoRoot, '.claude/hooks/subagent-stop-evidence-gate');
    const testStateFile = path.join('/tmp', `qcet-bounce-test-${Date.now()}.json`);

    try {
      // First builder fails evidence gate once
      const builder1Payload = JSON.stringify({
        agentType: 'qcet-builder',
        agentId: 'shard-1:implement',
        label: 'shard-1:implement',
        phase: 'Implement',
        subagentResult: { status: 'completed' }, // Missing testsRun, changedFiles, requirementsSatisfied
      });

      let builder1Blocked = false;
      try {
        execFileSync('node', [gateScript], {
          input: builder1Payload,
          env: { ...process.env, QCET_BOUNCEBACK_STATE_FILE: testStateFile },
          encoding: 'utf8',
        });
      } catch (err: any) {
        if (err.status === 2) builder1Blocked = true;
      }
      assert.ok(builder1Blocked, 'First builder with missing evidence must be blocked on first attempt');

      // Second builder with different agentId must ALSO be checked, NOT bypassed
      const builder2Payload = JSON.stringify({
        agentType: 'qcet-builder',
        agentId: 'shard-2:implement',
        label: 'shard-2:implement',
        phase: 'Implement',
        subagentResult: { status: 'completed' }, // Also missing evidence
      });

      let builder2Blocked = false;
      try {
        execFileSync('node', [gateScript], {
          input: builder2Payload,
          env: { ...process.env, QCET_BOUNCEBACK_STATE_FILE: testStateFile },
          encoding: 'utf8',
        });
      } catch (err: any) {
        if (err.status === 2) builder2Blocked = true;
      }
      assert.ok(builder2Blocked, 'Second builder must NOT inherit bypass from first builder');
    } finally {
      if (fs.existsSync(testStateFile)) {
        fs.unlinkSync(testStateFile);
      }
    }
  });

  it('DEFECT-05: buildRunTelemetry standardizes finalStatus enum to READY_WITH_KNOWN_ISSUES', () => {
    const telemetry = helpers.buildRunTelemetry({
      manifest: { shards: [{ id: 'shard-1', requirements: ['REQ-01'] }], requirements: ['REQ-01'] },
      allShardResults: [
        { shard: { id: 'shard-1', requirements: ['REQ-01'] }, lastVerification: { verdict: 'pass', issues: [] } },
      ],
      validation: { status: 'pass' },
      finalVerdict: { status: 'READY WITH KNOWN ISSUES', verdict: 'READY WITH KNOWN ISSUES' },
      wallClockMs: 12000,
      totalAgents: 2,
    });

    assert.equal(
      telemetry.run.finalStatus,
      'READY_WITH_KNOWN_ISSUES',
      'finalStatus must match baseline schema enum READY_WITH_KNOWN_ISSUES'
    );
  });

  it('DEFECT-06: clusterIntegrationFindings dynamically extracts affected files from global findings', () => {
    const globalFindings = [
      {
        id: 'GLOBAL-01',
        file: 'none',
        evidence: 'In src/lib/auth.ts and src/hooks/use-auth.ts token was invalid',
        recommendedFix: 'Update src/lib/auth.ts to export canonical token',
      },
    ];

    const clusters = helpers.clusterIntegrationFindings(globalFindings);
    assert.equal(clusters.length, 1);
    const globalCluster = clusters[0];
    assert.equal(globalCluster.id, 'cluster-global');
    assert.ok(globalCluster.files.includes('src/lib/auth.ts'), 'Should extract src/lib/auth.ts');
    assert.ok(globalCluster.files.includes('src/hooks/use-auth.ts'), 'Should extract src/hooks/use-auth.ts');
  });

  it('DEFECT-07: pathsOverlap accurately detects wildcards and file-extension glob overlaps', () => {
    assert.equal(helpers.pathsOverlap('src/components/*.tsx', 'src/components/button.tsx'), true);
    assert.equal(helpers.pathsOverlap('src/lib/**/*.ts', 'src/lib/auth/session.ts'), true);
    assert.equal(helpers.pathsOverlap('src/components/button.tsx', 'src/components/*.tsx'), true);
    assert.equal(helpers.pathsOverlap('src/api/*.ts', 'src/components/button.tsx'), false);
  });

  it('DEFECT-08: buildRunTelemetry calculates valid agent counts and accounts for repaired findings', () => {
    const telemetryWithRepairs = helpers.buildRunTelemetry({
      manifest: { shards: [{ id: 'shard-1', requirements: ['REQ-01'] }], requirements: ['REQ-01'] },
      allShardResults: [
        { shard: { id: 'shard-1', requirements: ['REQ-01'] }, lastVerification: { verdict: 'pass', issues: [] } },
      ],
      integrationSynthesis: { findings: [{ id: 'F-1' }, { id: 'F-2' }] },
      integrationRepair: { status: 'completed' },
      validation: { status: 'pass' },
      finalVerdict: { status: 'READY' },
      wallClockMs: 15000,
      totalAgents: 4,
    });

    assert.equal(telemetryWithRepairs.run.agents, 4, 'Agents count must equal resolved totalAgents');
    assert.equal(telemetryWithRepairs.run.metrics.efficiency.totalAgents, 4, 'Efficiency totalAgents must equal resolved agents');
    assert.ok(telemetryWithRepairs.run.agents >= 1, 'Agents count must be >= 1');
    assert.equal(telemetryWithRepairs.run.metrics.correctness.unresolvedFindings, 0, 'Repaired findings should not count as unresolved');

    const telemetryDefaultAgents = helpers.buildRunTelemetry({
      manifest: { shards: [{ id: 'shard-1', requirements: ['REQ-01'] }], requirements: ['REQ-01'] },
      allShardResults: [],
      validation: { status: 'pass' },
      finalVerdict: { status: 'READY' },
      totalAgents: 0,
      agentsCount: 0,
    });
    assert.ok(telemetryDefaultAgents.run.agents >= 1, 'Agents count should default to at least 1 for valid schema');
  });

  it('DEFECT-09: normalizePath strips absolute repo root prefixes', () => {
    const absolutePath = path.join(repoRoot, 'src/components/TaskView.tsx');
    const normalized = helpers.normalizePath(absolutePath);
    assert.equal(normalized, 'src/components/TaskView.tsx');

    const relativePath = './src/lib/prisma.ts';
    assert.equal(helpers.normalizePath(relativePath), 'src/lib/prisma.ts');
  });

  it('AUTH-INT-01: worktree relative path resolution strips .claude/worktrees prefix', () => {
    const wtPath = path.join(repoRoot, '.claude', 'worktrees', 'wt-test', 'src', 'lib', 'safe.ts');
    const rel = helpers.toRepoRelativePath(wtPath);
    assert.equal(rel, 'src/lib/safe.ts', 'toRepoRelativePath must strip worktree prefix');

    const guardScript = path.join(repoRoot, '.claude/hooks/pre-tool-use-ownership-guard');
    const testShardsFile = path.join('/tmp', `qcet-active-shards-wt-${Date.now()}.json`);
    fs.writeFileSync(
      testShardsFile,
      JSON.stringify([
        {
          id: 'shard-wt',
          agentId: 'shard-wt:implement',
          owns: ['src/lib/safe.ts'],
          antiOwns: [],
        },
      ]),
      'utf8'
    );

    try {
      const payload = JSON.stringify({
        toolName: 'Edit',
        toolInput: { file_path: wtPath },
        agentType: 'qcet-builder',
        agentId: 'shard-wt:implement',
        cwd: path.join(repoRoot, '.claude', 'worktrees', 'wt-test'),
      });
      const result = execFileSync('node', [guardScript], {
        input: payload,
        env: { ...process.env, QCET_ACTIVE_SHARDS_FILE: testShardsFile },
        encoding: 'utf8',
      });
      assert.ok(!result.includes('"block"'), 'Worktree path within shard owns must be allowed');
    } finally {
      if (fs.existsSync(testShardsFile)) fs.unlinkSync(testShardsFile);
    }
  });

  it('AUTH-INT-02: fail-closed authorization blocks builders with empty owns scope', () => {
    const guardScript = path.join(repoRoot, '.claude/hooks/pre-tool-use-ownership-guard');
    const testShardsFile = path.join('/tmp', `qcet-active-shards-empty-${Date.now()}.json`);
    fs.writeFileSync(
      testShardsFile,
      JSON.stringify([
        {
          id: 'shard-empty',
          agentId: 'shard-empty:implement',
          owns: [],
          antiOwns: [],
        },
      ]),
      'utf8'
    );

    try {
      const payload = JSON.stringify({
        toolName: 'Edit',
        toolInput: { file_path: path.join(repoRoot, 'src/server/auth/authorization-engine.ts') },
        agentType: 'qcet-builder',
        agentId: 'shard-empty:implement',
      });
      let blocked = false;
      try {
        const result = execFileSync('node', [guardScript], {
          input: payload,
          env: { ...process.env, QCET_ACTIVE_SHARDS_FILE: testShardsFile },
          encoding: 'utf8',
        });
        if (result.includes('"block"')) blocked = true;
      } catch (err: any) {
        if (err.status === 2 || err.stdout?.includes('"block"')) blocked = true;
      }
      assert.ok(blocked, 'Builder with empty owns array must be fail-closed blocked from editing');
    } finally {
      if (fs.existsSync(testShardsFile)) fs.unlinkSync(testShardsFile);
    }
  });

  it('AUTH-INT-04: unified glob matching enforces single * vs recursive ** semantics consistently', () => {
    // Single * does not match subdirectories
    assert.equal(helpers.matchesOwnership('src/server/auth/sub/file.ts', 'src/server/auth/*'), false);
    // Recursive ** matches subdirectories
    assert.equal(helpers.matchesOwnership('src/server/auth/sub/file.ts', 'src/server/auth/**'), true);
    assert.equal(helpers.matchesOwnership('src/server/auth/sub/file.ts', 'src/server/auth/**/*'), true);
  });

  it('AUTH-INT-05 & REG-04: session-scoped shard boundaries are synchronized and verified', () => {
    const origSession = process.env.QCET_SESSION_ID;
    const testSessionId = `test-sess-${Date.now()}`;
    process.env.QCET_SESSION_ID = testSessionId;

    try {
      const paths = helpers.getActiveShardsFilePaths();
      assert.ok(
        paths.some((p: string) => p.includes(testSessionId)),
        'getActiveShardsFilePaths must include session-scoped path'
      );

      const payload = [{ id: 'test-shard', owns: ['src/*'], antiOwns: [] }];
      helpers.syncActiveShardBoundaries(payload, 'Test');

      for (const p of paths) {
        assert.ok(fs.existsSync(p), `Path ${p} must exist after sync`);
        const readData = JSON.parse(fs.readFileSync(p, 'utf8'));
        assert.equal(readData[0].id, 'test-shard');
      }
    } finally {
      process.env.QCET_SESSION_ID = origSession;
      try {
        const paths = helpers.getActiveShardsFilePaths();
        for (const p of paths) {
          if (fs.existsSync(p)) fs.rmSync(p, { force: true });
        }
      } catch (_) {}
    }
  });

  it('SEM-01: telemetry preserves defect counts across repair rounds and combines confirmed findings', () => {
    const telemetry = helpers.buildRunTelemetry({
      manifest: { shards: [{ id: 'shard-1', requirements: ['REQ-01'] }], requirements: ['REQ-01'] },
      allShardResults: [
        {
          shard: { id: 'shard-1', requirements: ['REQ-01'] },
          initialVerification: { issues: [{ id: 'ISS-1' }, { id: 'ISS-2' }] },
          lastVerification: { verdict: 'pass', issues: [] },
          repairRound: 1,
        },
      ],
      integrationSynthesis: { findings: [{ id: 'GLOBAL-1' }] },
      integrationRepair: { status: 'completed' },
      validation: { status: 'pass' },
      finalVerdict: { status: 'READY' },
      wallClockMs: 20000,
      totalAgents: 3,
    });

    assert.equal(telemetry.run.verificationFindings, 2, 'Must count 2 initial verification issues despite pass verdict on reverify');
    assert.equal(telemetry.run.findingsConfirmed, 3, 'Must combine 2 shard defects + 1 integration defect');
    assert.equal(telemetry.run.repairRounds, 2, 'Must include 1 shard repair + 1 integration repair');
    assert.equal(telemetry.run.metrics.correctness.unresolvedFindings, 0, 'Unresolved findings should be 0 when repairs complete');
  });

  it('SEM-02: 5.0% wall-clock regression tolerance triggers regression flag', () => {
    // Baseline wall-clock is 462,000ms. A 7% increase is 494,340ms (> 5.0%).
    const telemetry = helpers.buildRunTelemetry({
      manifest: { shards: [{ id: 'shard-1', requirements: ['REQ-01'] }], requirements: ['REQ-01'] },
      allShardResults: [
        { shard: { id: 'shard-1', requirements: ['REQ-01'] }, lastVerification: { verdict: 'pass', issues: [] } },
      ],
      validation: { status: 'pass' },
      finalVerdict: { status: 'READY' },
      wallClockMs: 495000,
      totalAgents: 2,
    });

    assert.equal(telemetry.comparison.regressionFlags.wallClockRegressed, true, '7% delta must exceed 5.0% tolerance');
    assert.equal(telemetry.comparison.verdict, 'REGRESSION_DETECTED', 'Verdict must be REGRESSION_DETECTED');
  });

  it('SEM-03: buildStatus not-applicable is mapped to skipped in telemetry', () => {
    const telemetry = helpers.buildRunTelemetry({
      manifest: { shards: [{ id: 'shard-1', requirements: ['REQ-01'] }], requirements: ['REQ-01'] },
      allShardResults: [
        { shard: { id: 'shard-1', requirements: ['REQ-01'] }, lastVerification: { verdict: 'pass', issues: [] } },
      ],
      validation: {
        status: 'pass',
        checks: [{ name: 'next-build-safety', status: 'not-applicable' }],
      },
      finalVerdict: { status: 'READY' },
      wallClockMs: 10000,
      totalAgents: 1,
    });

    assert.equal(telemetry.run.buildStatus, 'skipped', 'not-applicable build status must be mapped to skipped');
    assert.equal(telemetry.run.metrics.correctness.buildStatus, 'skipped');
  });

  it('SEM-05: repair agent submitting resolvedIssueIds is accepted by subagent-stop-evidence-gate', () => {
    const gateScript = path.join(repoRoot, '.claude/hooks/subagent-stop-evidence-gate');
    const repairPayload = JSON.stringify({
      agentType: 'qcet-builder',
      agentId: 'shard-1:repair-1',
      label: 'shard-1:repair-1',
      phase: 'Repair',
      subagentResult: {
        status: 'completed',
        changedFiles: ['src/lib/safe.ts'],
        testsRun: [{ command: 'npm test', status: 'passed', evidence: 'pass' }],
        resolvedIssueIds: ['ISS-1'],
        risks: ['none'],
        summary: 'Repaired issue 1',
      },
    });

    let exitCode = 0;
    let output = '';
    try {
      output = execFileSync('node', [gateScript], {
        input: repairPayload,
        encoding: 'utf8',
      });
    } catch (err: any) {
      exitCode = err.status;
      output = err.stdout || '';
    }

    assert.equal(exitCode, 0, 'Repair agent with resolvedIssueIds must pass evidence gate');
    assert.ok(!output.includes('BLOCKED'), 'Repair agent must not be blocked');
  });

  it('REG-01: validateManifestOwnership allows overlapping ownership when shard uses worktree isolation', () => {
    const manifestWithoutIsolation = {
      shards: [
        { id: 'shard-a', owns: ['src/shared/*'] },
        { id: 'shard-b', owns: ['src/shared/*'] },
      ],
    };
    const errorsNoIso = helpers.validateManifestOwnership(manifestWithoutIsolation);
    assert.ok(errorsNoIso.length > 0, 'Overlapping ownership without isolation must produce errors');

    const manifestWithIsolation = {
      shards: [
        { id: 'shard-a', isolation: 'worktree', owns: ['src/shared/*'] },
        { id: 'shard-b', owns: ['src/shared/*'] },
      ],
    };
    const errorsWithIso = helpers.validateManifestOwnership(manifestWithIsolation);
    assert.equal(errorsWithIso.length, 0, 'Overlapping ownership with worktree isolation must be permitted');
  });

  it('REG-05: subagent-stop-evidence-gate records cutoff bypasses in telemetry', () => {
    const gateScript = path.join(repoRoot, '.claude/hooks/subagent-stop-evidence-gate');
    const testStateFile = path.join('/tmp', `qcet-bounce-cutoff-${Date.now()}.json`);
    const testTeleFile = path.join('/tmp', `qcet-gate-tele-${Date.now()}.json`);

    try {
      // Simulate existing attempt = 1 to trigger cutoff on second attempt
      fs.writeFileSync(
        testStateFile,
        JSON.stringify({
          attempts: { 'agent-cutoff-test': 1 },
        }),
        'utf8'
      );

      const cutoffPayload = JSON.stringify({
        agentType: 'qcet-builder',
        agentId: 'agent-cutoff-test',
        label: 'agent-cutoff-test',
        phase: 'Implement',
        subagentResult: { status: 'completed' }, // Missing evidence
      });

      const output = execFileSync('node', [gateScript], {
        input: cutoffPayload,
        env: {
          ...process.env,
          QCET_BOUNCEBACK_STATE_FILE: testStateFile,
          QCET_GATE_TELEMETRY_FILE: testTeleFile,
        },
        encoding: 'utf8',
      });

      assert.ok(output.includes('"allow"') && output.includes('cutoff'), 'Cutoff must allow subagent to stop');
      assert.ok(fs.existsSync(testTeleFile), 'Telemetry file must be created on cutoff bypass');
      const tele = JSON.parse(fs.readFileSync(testTeleFile, 'utf8'));
      assert.equal(tele.cutoffBypassCount, 1, 'cutoffBypassCount must be 1');
      assert.ok(tele.bypassedAgents.includes('agent-cutoff-test'), 'bypassedAgents must include agent-cutoff-test');
    } finally {
      if (fs.existsSync(testStateFile)) fs.unlinkSync(testStateFile);
      if (fs.existsSync(testTeleFile)) fs.unlinkSync(testTeleFile);
    }
  });
});
