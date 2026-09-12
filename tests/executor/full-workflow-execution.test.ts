import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const workflowScriptPath = path.join(rootDir, '.claude', 'workflows', 'qcet-plan-executor.js');

/**
 * Creates a sandboxed execution of qcet-plan-executor.js with simulated Workflow runtime.
 */
function createWorkflowRunner(options: {
  args: any;
  agentMock: (prompt: string, opts?: any) => Promise<any> | any;
  onLog?: (msg: string) => void;
}) {
  let source = fs.readFileSync(workflowScriptPath, 'utf8');

  // Strip ES module export keywords so it can execute inside an async context
  source = source.replace(/export\s+(const|function|let|class)\s+/g, '$1 ');

  const logs: string[] = [];
  const phases: string[] = [];

  const context: Record<string, any> = {
    args: options.args,
    budget: {
      total: null,
      spent: () => 0,
      remaining: () => Infinity,
    },
    log: (msg: string) => {
      logs.push(msg);
      if (options.onLog) options.onLog(msg);
    },
    phase: (title: string) => {
      phases.push(title);
    },
    agent: async (prompt: string, opts: any) => {
      return await options.agentMock(prompt, opts);
    },
    parallel: async (thunks: Array<() => Promise<any>>) => {
      const results = [];
      for (const t of thunks) {
        try {
          results.push(await t());
        } catch (_) {
          results.push(null);
        }
      }
      return results;
    },
    pipeline: async (items: any[], ...stages: Array<(prev: any, item: any, idx: number) => Promise<any>>) => {
      const results = [];
      for (let i = 0; i < items.length; i++) {
        let current = items[i];
        for (const stage of stages) {
          if (current === null || current === undefined) break;
          try {
            current = await stage(current, items[i], i);
          } catch (_) {
            current = null;
            break;
          }
        }
        results.push(current);
      }
      return results;
    },
    JSON,
    Math,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Set,
    Map,
    RegExp,
    Date,
    Promise,
    Error,
    TypeError,
    console,
    process: {
      cwd: () => rootDir,
      env: { QCET_PERSIST_TELEMETRY: '0' },
    },
  };

  const script = new vm.Script(`(async () => {\n${source}\n})()`, {
    filename: 'qcet-plan-executor.js',
  });

  return {
    run: async () => {
      const vmContext = vm.createContext(context);
      const result = await script.runInContext(vmContext);
      return { result, logs, phases };
    },
  };
}

test('full-workflow-execution: clean end-to-end execution reaches READY', async () => {
  const runner = createWorkflowRunner({
    args: {
      planPath: 'test-plan.md',
    },
    agentMock: async (prompt: string, opts: any) => {
      const label = opts?.label || '';

      if (
        label.includes('plan-decomposer') ||
        label.includes('repo-boundary-mapper') ||
        label.includes('manifest-synthesizer') ||
        label.includes('calibrate')
      ) {
        return {
          planPath: 'test-plan.md',
          architectureNotes: 'Clean architecture',
          requirements: [{ id: 'REQ-1', text: 'Auth feature' }],
          shards: [
            {
              id: 'shard-1',
              title: 'Auth Module',
              objective: 'Implement authentication module',
              type: 'feature',
              risk: 'low',
              priority: 1,
              dependencies: [],
              owns: ['src/lib/auth/**'],
              antiOwns: ['src/lib/db/**'],
              requirements: ['REQ-1'],
              acceptanceCriteria: ['Auth works'],
              testHints: ['tests/auth.test.ts'],
            },
          ],
        };
      }

      if (label.includes('recon')) {
        return {
          status: 'ready',
          currentState: 'Ready for implementation',
          relevantFiles: ['src/lib/auth/index.ts'],
          contracts: ['src/lib/auth/types.ts'],
          implementationNotes: ['Implement clean auth handler'],
          risks: [],
        };
      }

      if (label.includes('reconcile')) {
        return {
          status: 'ready',
          currentState: 'Reconciled',
          relevantFiles: ['src/lib/auth/index.ts'],
          contracts: ['src/lib/auth/types.ts'],
          implementationNotes: ['Reconciled dependencies'],
          risks: [],
        };
      }

      if (label.includes('builder')) {
        return {
          status: 'completed',
          changedFiles: ['src/lib/auth/index.ts'],
          summary: 'Implemented auth',
          requirementsSatisfied: ['REQ-1'],
          testsRun: [{ command: 'npm test', status: 'passed', evidence: '1 test passed' }],
          risks: [],
        };
      }

      if (label.includes('verify')) {
        return {
          verdict: 'pass',
          requirementsChecked: ['REQ-1'],
          issues: [],
          summary: 'Verification passed',
        };
      }

      if (label.includes('integration:')) {
        return {
          findings: [],
          summary: 'No integration issues',
        };
      }

      if (label.includes('proof') || label.includes('global') || label.includes('validation')) {
        return {
          status: 'pass',
          checks: [{ name: 'typecheck', command: 'npm run typecheck', status: 'passed', evidence: '0 errors' }],
          requirementCoverage: [{ id: 'REQ-1', status: 'satisfied', evidence: 'Verified' }],
          preExistingFailures: [],
          summary: 'All checks passed',
        };
      }

      if (label.includes('final release skeptic')) {
        return {
          status: 'READY',
          reasons: ['All requirements satisfied', 'All tests passing'],
          unresolvedRisks: [],
        };
      }

      return {};
    },
  });

  const { result, phases } = await runner.run();
  assert.equal(result?.final?.status, 'READY');
  assert.ok(phases.includes('Calibrate'));
  assert.ok(phases.includes('Integration Review'));
  assert.ok(phases.includes('Global Validation'));
  assert.ok(phases.includes('Release Gate'));
});

test('full-workflow-execution: const reassignment bug regression - overrides agent READY to BLOCKED without throwing', async () => {
  const runner = createWorkflowRunner({
    args: {
      planPath: 'test-plan.md',
    },
    agentMock: async (prompt: string, opts: any) => {
      const label = opts?.label || '';

      if (
        label.includes('plan-decomposer') ||
        label.includes('repo-boundary-mapper') ||
        label.includes('manifest-synthesizer') ||
        label.includes('calibrate')
      ) {
        return {
          planPath: 'test-plan.md',
          requirements: [{ id: 'REQ-1', text: 'Auth feature' }],
          shards: [
            {
              id: 'shard-1',
              title: 'Auth Module',
              objective: 'Implement authentication module',
              type: 'feature',
              risk: 'low',
              priority: 1,
              dependencies: [],
              owns: ['src/lib/auth/**'],
              antiOwns: [],
              requirements: ['REQ-1'],
            },
          ],
        };
      }

      if (label.includes('recon')) {
        return {
          status: 'ready',
          currentState: 'Ready for implementation',
          relevantFiles: ['src/lib/auth/index.ts'],
          contracts: ['src/lib/auth/types.ts'],
          implementationNotes: ['Implement clean auth handler'],
          risks: [],
        };
      }

      if (label.includes('builder')) {
        return {
          shardId: 'shard-1',
          status: 'completed',
          changedFiles: ['src/lib/auth/index.ts'],
          summary: 'Completed auth implementation',
          requirementsSatisfied: ['REQ-1'],
          testsRun: [{ command: 'npm test', status: 'passed', evidence: 'passed' }],
          risks: [],
        };
      }

      if (label.includes('verify')) {
        return {
          verdict: 'pass',
          requirementsChecked: ['REQ-1'],
          issues: [],
          summary: 'Verified cleanly',
        };
      }

      if (label.includes('integration:')) {
        return { findings: [], summary: 'clean' };
      }

      // GLOBAL VALIDATION FAILS
      if (label.includes('proof') || label.includes('validation')) {
        return {
          status: 'fail',
          checks: [{ name: 'typecheck', command: 'npm run typecheck', status: 'failed', evidence: 'TS2322' }],
          requirementCoverage: [{ id: 'REQ-1', status: 'failed', evidence: 'Typecheck failure' }],
          preExistingFailures: [],
          summary: 'Global validation failed due to typecheck',
        };
      }

      // Final agent says READY, but deterministic gate MUST override to BLOCKED
      if (label.includes('final release skeptic')) {
        return {
          status: 'READY',
          reasons: ['Agent mistakenly claims ready despite validation failure'],
          unresolvedRisks: [],
        };
      }

      return {};
    },
  });

  const { result } = await runner.run();
  assert.equal(result?.final?.status, 'BLOCKED');
  assert.equal(result?.final?.deterministicOverride, true);
  assert.ok(result?.final?.blockers.some((b: string) => b.includes('Global validation') || b.includes('fail')));
});

test('full-workflow-execution: integration severity normalization and independent reverification gate', async () => {
  let reverificationCalled = false;

  const runner = createWorkflowRunner({
    args: {
      planPath: 'test-plan.md',
    },
    agentMock: async (prompt: string, opts: any) => {
      const label = opts?.label || '';

      if (
        label.includes('plan-decomposer') ||
        label.includes('repo-boundary-mapper') ||
        label.includes('manifest-synthesizer') ||
        label.includes('calibrate')
      ) {
        return {
          planPath: 'test-plan.md',
          requirements: [{ id: 'REQ-1', text: 'Cross-shard integration' }],
          shards: [
            {
              id: 'shard-1',
              title: 'Module 1',
              objective: 'Implement module 1',
              type: 'feature',
              risk: 'low',
              priority: 1,
              dependencies: [],
              owns: ['src/lib/mod1/**'],
              antiOwns: [],
              requirements: ['REQ-1'],
            },
          ],
        };
      }

      if (label.includes('recon')) {
        return {
          status: 'ready',
          currentState: 'Ready for implementation',
          relevantFiles: ['src/lib/mod1/index.ts'],
          contracts: ['src/lib/mod1/types.ts'],
          implementationNotes: ['Implement module 1'],
          risks: [],
        };
      }

      if (label.includes('builder')) {
        return {
          shardId: 'shard-1',
          status: 'completed',
          changedFiles: ['src/lib/mod1/index.ts'],
          summary: 'Completed mod1',
          requirementsSatisfied: ['REQ-1'],
          testsRun: [{ command: 'npm test', status: 'passed', evidence: 'passed' }],
          risks: [],
        };
      }

      if (label.includes('verify')) {
        return {
          verdict: 'pass',
          requirementsChecked: ['REQ-1'],
          issues: [],
          summary: 'Verified cleanly',
        };
      }

      // Integration findings with LOWERCASE severity
      if (label === 'integration:skeptic') {
        return {
          findings: [
            {
              id: 'INT-1',
              severity: 'critical', // lowercase!
              category: 'contract-mismatch',
              file: 'src/lib/mod1/index.ts',
              evidence: 'Export mismatch between modules',
              impact: 'Breaks consumers',
              recommendedFix: 'Align types',
            },
          ],
          summary: 'Critical contract break found',
        };
      }

      if (label.includes('integration:repair')) {
        return {
          status: 'completed',
          changedFiles: ['src/lib/mod1/index.ts'],
          summary: 'Applied contract fix',
          resolvedIssueIds: ['INT-1'],
          testsRun: [{ command: 'npm test', status: 'passed', evidence: 'passed' }],
          risks: [],
        };
      }

      // Independent reverification skeptic
      if (label.includes('integration:reverification')) {
        reverificationCalled = true;
        // Reverification reports defect is STILL NOT FIXED
        return {
          passed: false,
          remainingIssues: [
            {
              severity: 'critical',
              file: 'src/lib/mod1/index.ts',
              description: 'Contract mismatch still exists in compiled export',
            },
          ],
          summary: 'Defect was not resolved by repair',
        };
      }

      if (label.includes('integration:')) {
        return {
          findings: [
            {
              id: 'INT-1',
              severity: 'critical',
              category: 'contract-mismatch',
              file: 'src/lib/mod1/index.ts',
              evidence: 'Export mismatch',
              impact: 'Breaks consumers',
              recommendedFix: 'Align types',
            },
          ],
          summary: 'Contract issue found',
        };
      }

      if (label.includes('proof') || label.includes('global') || label.includes('validation')) {
        return {
          status: 'pass',
          checks: [{ name: 'typecheck', command: 'npm run typecheck', status: 'passed', evidence: 'passed' }],
          requirementCoverage: [{ id: 'REQ-1', status: 'satisfied', evidence: 'satisfied' }],
          preExistingFailures: [],
          summary: 'All pass',
        };
      }

      if (label.includes('final release skeptic')) {
        return {
          status: 'READY',
          reasons: ['Ready'],
          unresolvedRisks: [],
        };
      }

      return {};
    },
  });

  const { result } = await runner.run();
  assert.equal(reverificationCalled, true, 'Independent reverification skeptic MUST be called');
  assert.equal(result?.final?.status, 'BLOCKED', 'Unreverified / failed repair MUST block release');
  assert.ok(result?.final?.blockers.some((b: string) => b.includes('critical/high integration defect(s) remain unresolved or unverified')));
});

test('full-workflow-execution: null agent results are handled gracefully without uncaught exceptions', async () => {
  const runner = createWorkflowRunner({
    args: {
      planPath: 'test-plan.md',
    },
    agentMock: async (prompt: string, opts: any) => {
      const label = opts?.label || '';

      if (label.includes('calibrate')) {
        return {
          planPath: 'test-plan.md',
          requirements: [{ id: 'REQ-1', text: 'Feature' }],
          shards: [
            {
              id: 'shard-1',
              title: 'Module',
              type: 'feature',
              risk: 'low',
              priority: 1,
              dependencies: [],
              owns: ['src/lib/mod/**'],
              antiOwns: [],
              requirements: ['REQ-1'],
            },
          ],
        };
      }

      // Builder returns null (e.g. timeout or skip)
      if (label.includes('builder:')) {
        return null;
      }

      if (label.includes('skeptic:')) {
        return null;
      }

      if (label.includes('integration:skeptic')) {
        return null;
      }

      if (label.includes('validation')) {
        return null;
      }

      if (label.includes('final release skeptic')) {
        return null;
      }

      return null;
    },
  });

  const { result } = await runner.run();
  assert.equal(result?.status, 'BLOCKED', 'Null agent outputs must result in fail-closed BLOCKED');
  assert.ok(result?.reason || (Array.isArray(result?.blockers) && result.blockers.length > 0));
});

test('full-workflow-execution: dependency pass gate - failed skeptic verification on dependency blocks downstream builder', async () => {
  let shardBBuilderInvoked = false;
  let shardBReconcileInvoked = false;

  const runner = createWorkflowRunner({
    args: {
      planPath: 'test-plan.md',
    },
    agentMock: async (prompt: string, opts: any) => {
      const label = opts?.label || '';

      if (
        label.includes('plan-decomposer') ||
        label.includes('repo-boundary-mapper') ||
        label.includes('manifest-synthesizer') ||
        label.includes('calibrate')
      ) {
        return {
          planPath: 'test-plan.md',
          architectureNotes: 'Architecture with A -> B dependency',
          requirements: [
            { id: 'REQ-1', text: 'Base shard A requirement' },
            { id: 'REQ-2', text: 'Dependent shard B requirement' },
          ],
          shards: [
            {
              id: 'shard-A',
              title: 'Shard A',
              objective: 'Implement base functionality',
              type: 'feature',
              risk: 'low',
              priority: 1,
              dependencies: [],
              owns: ['src/lib/a/**'],
              antiOwns: [],
              requirements: ['REQ-1'],
              acceptanceCriteria: ['A works'],
              testHints: ['tests/a.test.ts'],
            },
            {
              id: 'shard-B',
              title: 'Shard B',
              objective: 'Implement dependent functionality',
              type: 'feature',
              risk: 'low',
              priority: 2,
              dependencies: ['shard-A'],
              owns: ['src/lib/b/**'],
              antiOwns: [],
              requirements: ['REQ-2'],
              acceptanceCriteria: ['B works'],
              testHints: ['tests/b.test.ts'],
            },
          ],
        };
      }

      if (label.includes('pre-recon')) {
        return {
          status: 'ready',
          currentState: 'Ready',
          relevantFiles: ['src/lib/mod.ts'],
          contracts: [],
          implementationNotes: [],
          risks: [],
        };
      }

      if (label.includes('shard-B:reconcile')) {
        shardBReconcileInvoked = true;
        return {
          status: 'ready',
          currentState: 'Reconciled',
          relevantFiles: ['src/lib/b/index.ts'],
          contracts: [],
          implementationNotes: [],
          risks: [],
        };
      }

      if (label.includes('shard-A:implement')) {
        return {
          status: 'completed',
          changedFiles: ['src/lib/a/index.ts'],
          summary: 'Implemented shard A',
          requirementsSatisfied: ['REQ-1'],
          testsRun: [{ command: 'npm test', status: 'passed', evidence: 'Pass' }],
          risks: [],
        };
      }

      if (label.includes('shard-B:implement')) {
        shardBBuilderInvoked = true;
        return {
          status: 'completed',
          changedFiles: ['src/lib/b/index.ts'],
          summary: 'Implemented shard B',
          requirementsSatisfied: ['REQ-2'],
          testsRun: [],
          risks: [],
        };
      }

      // Shard A skeptic verification returns FAIL despite implementation being completed
      if (label.includes('shard-A:verify')) {
        return {
          verdict: 'fail',
          requirementsChecked: ['REQ-1'],
          issues: [
            {
              id: 'ISSUE-A-1',
              severity: 'high',
              category: 'correctness',
              evidence: 'Shard A verification failed',
              impact: 'Unsound API contract',
              recommendedFix: 'Fix contract',
            },
          ],
          summary: 'Shard A verification failed skeptic audit',
        };
      }

      // Shard A repair also fails
      if (label.includes('shard-A:repair')) {
        return {
          status: 'failed',
          summary: 'Repair failed',
          changedFiles: [],
        };
      }

      if (label.includes('integration:')) {
        return { findings: [], summary: 'No findings' };
      }

      if (label.includes('proof') || label.includes('global') || label.includes('validation')) {
        return {
          status: 'fail',
          checks: [],
          requirementCoverage: [],
          preExistingFailures: [],
          summary: 'Shard A verification failed',
        };
      }

      if (label.includes('final release skeptic')) {
        return {
          status: 'BLOCKED',
          reasons: ['Shard A verification failed, Shard B dependency blocked'],
          unresolvedRisks: [],
        };
      }

      return {};
    },
  });

  const { result } = await runner.run();
  assert.equal(
    shardBBuilderInvoked,
    false,
    'Shard B builder must NEVER be invoked when dependency Shard A failed skeptic verification'
  );
  assert.equal(
    shardBReconcileInvoked,
    false,
    'Shard B reconciliation must NEVER be invoked when dependency Shard A failed skeptic verification'
  );
  const status = result?.final?.status || result?.status;
  assert.equal(status, 'BLOCKED', 'Workflow must end with fail-closed BLOCKED status');
});

