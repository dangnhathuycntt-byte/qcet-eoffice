import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync('.claude/workflows/qcet-plan-executor.js', 'utf8');
const sandbox: Record<string, any> = { console, process };
vm.createContext(sandbox);
vm.runInContext(source.split('// WORKFLOW')[0].replace(/^export\s+/gm, ''), sandbox);

test('canonical verdict path isolates the explicit run ID outside .claude', () => {
  assert.equal(sandbox.buildGateVerdictPath('e2e-123'), 'qcet-executor-runs/e2e-123/gate-verdict.json');
  assert.notEqual(sandbox.buildGateVerdictPath('e2e-123'), sandbox.buildGateVerdictPath('e2e-456'));
});
test('verdict run ID cannot escape its directory', () => {
  for (const id of ['', '../escape', 'a/b', '/tmp/file']) assert.throws(() => sandbox.buildGateVerdictPath(id));
});
test('harness forwards run ID and requires the canonical artifact', () => {
  const harness = fs.readFileSync('benchmarks/e2e/run-plan-executor-e2e.mjs', 'utf8');
  assert.match(harness, /stdinMessage:.*JSON.stringify.*runId: e2eRunId/);
  assert.match(harness, /gateVerdictContent\?\.runId !== e2eRunId/);
  assert.match(harness, /gateVerdictContent.verificationPassed === true/);
  assert.match(harness, /fs.copyFileSync\(canonicalPath, gateVerdictPath\)/);
  assert.doesNotMatch(harness, /source: 'transcript-result-text'/);
});
