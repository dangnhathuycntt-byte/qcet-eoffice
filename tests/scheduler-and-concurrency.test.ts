import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

describe('DAG Scheduler and Concurrency Upgrades (REQ-10, REQ-11, REQ-14, REQ-15)', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const executorPath = path.join(repoRoot, '.claude/workflows/qcet-plan-executor.js');
  let helpers: any;
  let fullWorkflowCode: string;

  before(async () => {
    fullWorkflowCode = fs.readFileSync(executorPath, 'utf8');
    const helperCode = fullWorkflowCode.split(
      '// -----------------------------------------------------------------------------\n// WORKFLOW'
    )[0];
    const tempFile = path.join('/tmp', `qcet-executor-sched-helpers-${Date.now()}.mjs`);
    fs.writeFileSync(tempFile, helperCode, 'utf8');
    try {
      helpers = await import(tempFile);
    } finally {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  });

  it('Syntax check: node --check passes cleanly on qcet-plan-executor.js', () => {
    const result = execFileSync('node', ['--check', executorPath], {
      encoding: 'utf8',
    });
    assert.equal(result, '');
  });

  it('Deterministic time check: no Date.now() or argless new Date() calls in qcet-plan-executor.js', () => {
    assert.ok(
      !fullWorkflowCode.includes('Date.now()'),
      'qcet-plan-executor.js must not call Date.now()'
    );
    assert.ok(
      !/new\s+Date\(\s*\)/.test(fullWorkflowCode),
      'qcet-plan-executor.js must not call argless new Date()'
    );
  });

  describe('REQ-10: Decoupled Read Gate & Strict Write Gate', () => {
    it('schedulePreRecon starts immediately for all shards in parallel before write gate unblocks', () => {
      // Verify workflow triggers schedulePreRecon for all prioritizedShards up front
      const preReconDispatchMatch = fullWorkflowCode.includes(
        'for (const shard of prioritizedShards) {\n    schedulePreRecon(shard);\n  }'
      );
      assert.ok(
        preReconDispatchMatch,
        'Workflow must launch schedulePreRecon for all prioritizedShards in parallel upfront'
      );

      // Verify scheduleShard ensures preReconPromise is initiated
      assert.ok(
        fullWorkflowCode.includes('const preReconPromise = schedulePreRecon(shard);'),
        'scheduleShard must acquire or initiate preReconPromise'
      );
    });

    it('scheduleShard strictly blocks builder execution on unresolved dependencies', () => {
      // Verify scheduleShard waits for all dependencies via Promise.all
      assert.ok(
        fullWorkflowCode.includes('const dependencyPromises = (shard.dependencies || []).map'),
        'scheduleShard must map dependencies to scheduleShard promises'
      );
      assert.ok(
        fullWorkflowCode.includes('Promise.all(dependencyPromises)'),
        'scheduleShard must wait for all dependency promises to resolve'
      );

      // Verify badDependency detection returns blockedByDependency immediately
      assert.ok(
        fullWorkflowCode.includes('result.lastVerification?.verdict !== \'pass\''),
        'scheduleShard must check that all dependencies pass verification'
      );
      assert.ok(
        fullWorkflowCode.includes('return blockedByDependency('),
        'scheduleShard must immediately return blockedByDependency if any dependency failed'
      );
    });
  });

  describe('REQ-11: Pre-Implementation Reconciliation Stage', () => {
    it('exports RECONCILE_SCHEMA and RECONCILE_STATIC_PREFIX adhering to contract', () => {
      assert.ok(helpers.RECONCILE_SCHEMA, 'RECONCILE_SCHEMA must be exported');
      assert.deepEqual(helpers.RECONCILE_SCHEMA.required, [
        'status',
        'upstreamChangesDetected',
        'reconciledNotes',
        'invalidatedAssumptions',
        'summary',
      ]);
      assert.deepEqual(helpers.RECONCILE_SCHEMA.properties.status.enum, ['ready', 'blocked']);
      assert.equal(helpers.RECONCILE_SCHEMA.properties.upstreamChangesDetected.type, 'boolean');

      assert.ok(
        typeof helpers.RECONCILE_STATIC_PREFIX === 'string' &&
        helpers.RECONCILE_STATIC_PREFIX.includes('qcet-recon'),
        'RECONCILE_STATIC_PREFIX must be exported and designate qcet-recon'
      );
    });

    it('runShardWithReconciliation invokes reconciliation when shard has upstream dependencies', () => {
      assert.ok(
        fullWorkflowCode.includes('if (shard.dependencies && shard.dependencies.length > 0)'),
        'runShardWithReconciliation must branch on presence of dependencies'
      );
      assert.ok(
        fullWorkflowCode.includes('agent: \'qcet-recon\'') &&
        fullWorkflowCode.includes('schema: RECONCILE_SCHEMA'),
        'runShardWithReconciliation must call qcet-recon with RECONCILE_SCHEMA'
      );
      assert.ok(
        fullWorkflowCode.includes('COMPLETED UPSTREAM DEPENDENCY DELTAS:'),
        'Reconciliation prompt must include completed upstream dependency deltas'
      );
    });

    it('runShardWithReconciliation terminates early with blocked status if reconciliation fails', () => {
      assert.ok(
        fullWorkflowCode.includes('if (!reconciliation || reconciliation.status === \'blocked\')'),
        'runShardWithReconciliation must check for blocked reconciliation status'
      );
      assert.ok(
        fullWorkflowCode.includes('summary: `Shard blocked during pre-implementation reconciliation:'),
        'Blocked reconciliation must prevent builder execution and set lastVerification.verdict to blocked'
      );
    });
  });

  describe('REQ-14: Critical-Path Scheduling Heuristic & Priority Calculation', () => {
    it('computeShardPriorities calculates transitive downstream dependents correctly', () => {
      const manifest = {
        requirements: [{ id: 'R1' }, { id: 'R2' }, { id: 'R3' }],
        shards: [
          {
            id: 'shard-root',
            dependencies: [],
            requirements: ['R1'],
            owns: ['src/a.ts'],
            acceptanceCriteria: ['AC1'],
            risk: 'critical',
          },
          {
            id: 'shard-mid',
            dependencies: ['shard-root'],
            requirements: ['R2'],
            owns: ['src/b.ts'],
            acceptanceCriteria: ['AC2'],
            risk: 'high',
          },
          {
            id: 'shard-leaf',
            dependencies: ['shard-mid'],
            requirements: ['R3'],
            owns: ['src/c.ts'],
            acceptanceCriteria: ['AC3'],
            risk: 'low',
          },
        ],
      };

      const priorities = helpers.computeShardPriorities(manifest);
      assert.equal(priorities.size, 3);

      const root = priorities.get('shard-root');
      assert.equal(root.transitiveDownstream, 2, 'shard-root has 2 downstream dependents (mid and leaf)');
      assert.equal(root.riskWeight, 4, 'critical risk weight is 4');
      assert.equal(root.workCount, 3, '1 req + 1 own + 1 ac = 3');
      // priority = (2 * 10) + (4 * 3) + 3 = 20 + 12 + 3 = 35
      assert.equal(root.priority, 35);

      const mid = priorities.get('shard-mid');
      assert.equal(mid.transitiveDownstream, 1, 'shard-mid has 1 downstream dependent (leaf)');
      assert.equal(mid.riskWeight, 3, 'high risk weight is 3');
      assert.equal(mid.workCount, 3);
      // priority = (1 * 10) + (3 * 3) + 3 = 10 + 9 + 3 = 22
      assert.equal(mid.priority, 22);

      const leaf = priorities.get('shard-leaf');
      assert.equal(leaf.transitiveDownstream, 0, 'shard-leaf has 0 downstream dependents');
      assert.equal(leaf.riskWeight, 1, 'low risk weight is 1');
      assert.equal(leaf.workCount, 3);
      // priority = (0 * 10) + (1 * 3) + 3 = 0 + 3 + 3 = 6
      assert.equal(leaf.priority, 6);

      assert.ok(root.priority > mid.priority && mid.priority > leaf.priority, 'Root must have highest priority');
    });

    it('computeShardPriorities gracefully handles manifests with branches and shared dependencies', () => {
      const manifest = {
        requirements: [],
        shards: [
          { id: 'S1', dependencies: [], risk: 'medium' },
          { id: 'S2', dependencies: ['S1'], risk: 'medium' },
          { id: 'S3', dependencies: ['S1'], risk: 'medium' },
          { id: 'S4', dependencies: ['S2', 'S3'], risk: 'medium' },
        ],
      };

      const priorities = helpers.computeShardPriorities(manifest);
      const s1 = priorities.get('S1');
      // S1 has transitive dependents S2, S3, S4 (3 total)
      assert.equal(s1.transitiveDownstream, 3);
    });

    it('prioritizedShards uses deterministic tie-breaker on identical priorities', () => {
      assert.ok(
        fullWorkflowCode.includes('if (prioB !== prioA) return prioB - prioA;\n    return a.id.localeCompare(b.id);'),
        'Workflow must employ deterministic tie-breaker a.id.localeCompare(b.id) for identical priorities'
      );
    });
  });

  describe('REQ-14: Adaptive Git Worktree Isolation', () => {
    it('shouldIsolateShard returns true when explicit isolation is requested', () => {
      assert.equal(helpers.shouldIsolateShard({ id: 's1', isolation: 'worktree' }), true);
      assert.equal(helpers.shouldIsolateShard({ id: 's1', isolated: true }), true);
    });

    it('shouldIsolateShard returns true for exploratory and migration shard kinds', () => {
      assert.equal(helpers.shouldIsolateShard({ id: 's1', kind: 'exploratory' }), true);
      assert.equal(helpers.shouldIsolateShard({ id: 's1', kind: 'migration' }), true);
      assert.equal(helpers.shouldIsolateShard({ id: 's1', kind: 'feature' }), false);
    });

    it('shouldIsolateShard returns true when mutable ownership overlaps with another shard', () => {
      const manifest = {
        shards: [
          { id: 's1', owns: ['src/components/*.tsx'] },
          { id: 's2', owns: ['src/components/button.tsx'] },
          { id: 's3', owns: ['src/server/auth.ts'] },
        ],
      };

      assert.equal(helpers.shouldIsolateShard(manifest.shards[0], manifest), true);
      assert.equal(helpers.shouldIsolateShard(manifest.shards[1], manifest), true);
      assert.equal(helpers.shouldIsolateShard(manifest.shards[2], manifest), false);
    });

    it('workflow injects isolation: "worktree" for isolated shards and omits it for disjoint shards', () => {
      assert.ok(
        fullWorkflowCode.includes('if (shouldIsolateShard(shard, manifest)) {\n      log(`Shard ${shard.id} invoked with adaptive git worktree isolation.`);\n      builderOptions.isolation = \'worktree\';\n    }'),
        'Builder options must set isolation to worktree when shouldIsolateShard is true'
      );
      assert.ok(
        fullWorkflowCode.includes('if (shouldIsolateShard(state.shard, manifest)) {\n      log(`Shard ${state.shard.id} repair invoked with adaptive worktree isolation.`);\n      repairOptions.isolation = \'worktree\';\n    }'),
        'Repair options must set isolation to worktree when shouldIsolateShard is true'
      );
    });
  });

  describe('REQ-15: Parallel Integration Repair Clusters', () => {
    it('clusterIntegrationFindings groups overlapping findings into disjoint clusters', () => {
      const findings = [
        { id: 'F1', file: 'src/lib/auth.ts', evidence: 'Issue in auth', recommendedFix: 'Fix auth' },
        { id: 'F2', file: 'src/lib/auth.ts', evidence: 'Another issue in auth', recommendedFix: 'Fix auth' },
        { id: 'F3', file: 'src/components/Task.tsx', evidence: 'UI bug', recommendedFix: 'Fix task' },
        { id: 'F4', file: 'src/components/Task.tsx', evidence: 'UI layout', recommendedFix: 'Fix task' },
      ];

      const clusters = helpers.clusterIntegrationFindings(findings);
      assert.equal(clusters.length, 2, 'Should create 2 disjoint clusters');

      const cluster1 = clusters.find((c: any) => c.files.includes('src/lib/auth.ts'));
      const cluster2 = clusters.find((c: any) => c.files.includes('src/components/Task.tsx'));

      assert.ok(cluster1, 'Cluster 1 should contain src/lib/auth.ts');
      assert.equal(cluster1.findings.length, 2);
      assert.ok(cluster2, 'Cluster 2 should contain src/components/Task.tsx');
      assert.equal(cluster2.findings.length, 2);
    });

    it('workflow executes parallel repairs across disjoint clusters with strict affected whitelists', () => {
      assert.ok(
        fullWorkflowCode.includes('const clusterRepairs = await parallel('),
        'Workflow must use parallel() to execute cluster repairs concurrently'
      );
      assert.ok(
        fullWorkflowCode.includes('STRICT AFFECTED FILES WHITELIST:'),
        'Parallel repair clusters must receive strict affected files whitelist in prompt'
      );
      assert.ok(
        fullWorkflowCode.includes('agentId: `integration:repair-cluster-${idx + 1}`'),
        'Each cluster repair must use a distinct agentId for hook-level boundary enforcement'
      );
    });
  });

  describe('REQ-15: Evaluation Telemetry Capture & Persistence', () => {
    it('buildRunTelemetry calculates comprehensive correctness, speed, efficiency, and reliability metrics', () => {
      const manifest = {
        requirements: [{ id: 'R1' }, { id: 'R2' }],
        shards: [{ id: 'S1', requirements: ['R1', 'R2'], risk: 'high' }],
      };
      const allShardResults = [
        {
          shard: { id: 'S1', requirements: ['R1', 'R2'], risk: 'high' },
          lastVerification: { verdict: 'pass', issues: [] },
          repairRound: 1,
        },
      ];
      const validation = { status: 'pass' };
      const finalVerdict = { status: 'READY' };

      const telemetry = helpers.buildRunTelemetry({
        manifest,
        allShardResults,
        validation,
        finalVerdict,
        wallClockMs: 100000,
        calibrationDurationMs: 15000,
        totalAgents: 8,
        peakConcurrent: 3,
        tokensTotal: 150000,
        planPath: 'docs/plans/active/test-plan.md',
        runId: 'test-run-01',
      });

      assert.equal(telemetry.run.runId, 'test-run-01');
      assert.equal(telemetry.run.wallClockMs, 100000);
      assert.equal(telemetry.run.calibrationDurationMs, 15000);
      assert.equal(telemetry.run.agents, 8);
      assert.equal(telemetry.run.peakConcurrent, 3);
      assert.equal(telemetry.run.tokens, 150000);
      assert.equal(telemetry.run.requirementsTotal, 2);
      assert.equal(telemetry.run.requirementsCovered, 2);
      assert.equal(telemetry.run.repairRounds, 1);
      assert.equal(telemetry.run.globalValidation, 'pass');
      assert.equal(telemetry.run.finalStatus, 'READY');

      assert.equal(telemetry.run.metrics.correctness.requirementCoveragePct, 100.0);
      assert.equal(telemetry.run.metrics.speed.wallClockMs, 100000);
      assert.equal(telemetry.run.metrics.efficiency.tokens, 150000);
      assert.equal(telemetry.run.metrics.efficiency.tokensPerVerifiedRequirement, 75000);
      assert.equal(telemetry.run.metrics.reliability.nullAgentRate, 0.0);

      assert.ok(telemetry.comparison, 'Comparison block must be generated');
      assert.equal(telemetry.comparison.baselineRunId, 'run-baseline-ux-consolidation-01');
      assert.equal(typeof telemetry.comparison.deltaWallClockMs, 'number');
      assert.equal(typeof telemetry.comparison.deltaTokens, 'number');
      assert.ok(typeof telemetry.comparison.verdict === 'string');
    });

    it('.claude/executor-evals/run-telemetry.json exists and conforms to template schema', () => {
      const telemetryFilePath = path.join(repoRoot, '.claude/executor-evals/run-telemetry.json');
      assert.ok(fs.existsSync(telemetryFilePath), 'run-telemetry.json must exist');

      const data = JSON.parse(fs.readFileSync(telemetryFilePath, 'utf8'));
      assert.equal(data.$schema, 'https://json-schema.org/draft/2020-12/schema');
      assert.equal(data.templateVersion, '1.0.0');
      assert.ok(data.run, 'run object must exist in run-telemetry.json');
      assert.ok(data.run.metrics, 'run.metrics must exist in run-telemetry.json');
      assert.ok(data.comparison, 'comparison object must exist in run-telemetry.json');
      assert.equal(data.comparison.regressionFlags.scopeViolations, false);
      assert.equal(data.comparison.regressionFlags.uncoveredRequirements, false);
    });

    it('workflow calls qcet-telemetry-recorder to persist telemetry to .claude/executor-evals/run-telemetry.json', () => {
      assert.ok(
        fullWorkflowCode.includes('agent: \'qcet-telemetry-recorder\'') &&
        fullWorkflowCode.includes('.claude/executor-evals/run-telemetry.json'),
        'Workflow must call qcet-telemetry-recorder targeting .claude/executor-evals/run-telemetry.json'
      );
    });
  });
});
