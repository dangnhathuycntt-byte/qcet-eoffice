import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync('.claude/workflows/qcet-plan-executor.js', 'utf8');
const sandbox: Record<string, any> = { console, process };
vm.createContext(sandbox);
vm.runInContext(source.split('// WORKFLOW')[0].replace(/^export\s+/gm, ''), sandbox);

const { verifyWithBoundedRetry } = sandbox;
const pass = { verdict: 'pass', requirementsChecked: ['R1'], issues: [], summary: 'verified' };
const fail = { verdict: 'fail', requirementsChecked: [], issues: [], summary: 'failed' };
const blocked = { verdict: 'blocked', requirementsChecked: [], issues: [], summary: 'blocked' };

// --- Test 1-3: null/undefined/malformed retries once ---
for (const first of [null, undefined, {}, { summary: 'text only' }]) {
  test(`missing structured result retries once: ${JSON.stringify(first)}`, async () => {
    const calls: any[] = [];
    const result = await verifyWithBoundedRetry(async (prompt: string, options: any) => {
      calls.push({ prompt, options });
      return calls.length === 1 ? first : pass;
    }, 'Independent evidence R1', { label: 's1', agent: 'qcet-skeptic' });
    assert.equal(result, pass);
    assert.equal(calls.length, 2);
    assert.match(calls[1].prompt, /MUST return the final independent verification result/);
    assert.equal(calls[1].options.agent, 'qcet-skeptic');
  });
}

// --- Test 4: first returns valid pass — no retry ---
test('first verifier returns valid pass — no retry', async () => {
  let count = 0;
  const result = await verifyWithBoundedRetry(async () => { count++; return pass; }, '', { label: 's1' });
  assert.equal(result, pass);
  assert.equal(count, 1);
});

// --- Test 5: first returns valid fail — no retry ---
test('first verifier returns valid fail — no retry', async () => {
  let count = 0;
  const result = await verifyWithBoundedRetry(async () => { count++; return fail; }, '', { label: 's1' });
  assert.equal(result, fail);
  assert.equal(count, 1);
});

// --- Test 6: first returns valid blocked — no retry ---
test('first verifier returns valid blocked — no retry', async () => {
  let count = 0;
  const result = await verifyWithBoundedRetry(async () => { count++; return blocked; }, '', { label: 's1' });
  assert.equal(result, blocked);
  assert.equal(count, 1);
});

// --- Test 7: retry returns pass ---
test('retry returns pass — pass returned', async () => {
  let count = 0;
  const result = await verifyWithBoundedRetry(async () => { count++; return count === 1 ? null : pass; }, '', { label: 's1' });
  assert.equal(result, pass);
  assert.equal(count, 2);
});

// --- Test 8: retry returns fail ---
test('retry returns fail — fail returned', async () => {
  let count = 0;
  const result = await verifyWithBoundedRetry(async () => { count++; return count === 1 ? null : fail; }, '', { label: 's1' });
  assert.equal(result, fail);
  assert.equal(count, 2);
});

// --- Test 9: retry returns blocked ---
test('retry returns blocked — blocked returned', async () => {
  let count = 0;
  const result = await verifyWithBoundedRetry(async () => { count++; return count === 1 ? null : blocked; }, '', { label: 's1' });
  assert.equal(result, blocked);
  assert.equal(count, 2);
});

// --- Test 10: first throws — retry exactly once, then blocked sentinel ---
test('first invocation throws — retry exactly once', async () => {
  const calls: number[] = [];
  const result = await verifyWithBoundedRetry(async () => {
    calls.push(1);
    if (calls.length === 1) throw new Error('transport failure');
    return null; // retry also fails
  }, '', { label: 's1' });
  assert.equal(calls.length, 2);
  assert.equal(result.verdict, 'blocked');
  assert.ok(result.issues.length > 0);
});

// --- Test 10b: first throws, retry returns pass ---
test('first invocation throws — retry returns pass', async () => {
  let count = 0;
  const result = await verifyWithBoundedRetry(async () => {
    count++;
    if (count === 1) throw new Error('first fail');
    return pass;
  }, '', { label: 's1' });
  assert.equal(count, 2);
  assert.equal(result, pass);
});

// --- Test 11: retry throws — blocked sentinel returned ---
test('retry throws — blocked sentinel returned', async () => {
  let count = 0;
  const result = await verifyWithBoundedRetry(async () => {
    count++;
    throw new Error('both fail');
  }, '', { label: 's2' });
  assert.equal(count, 2);
  assert.equal(result.verdict, 'blocked');
  assert.ok(result.issues.length > 0);
  assert.ok(result.summary.length > 0);
});

// --- Test 12: retry returns null — blocked sentinel returned ---
test('two missing results fail closed with no third invocation', async () => {
  let count = 0;
  const result = await verifyWithBoundedRetry(async () => { count++; return null; }, '', { label: 's1' });
  assert.equal(count, 2);
  assert.equal(result.verdict, 'blocked');
  assert.ok(result.issues.length > 0);
});

// --- Test 12b: retry returns malformed — blocked sentinel returned ---
test('retry returns malformed — blocked sentinel returned', async () => {
  let count = 0;
  const result = await verifyWithBoundedRetry(async () => {
    count++;
    return count === 1 ? null : { verdict: 'pass' }; // missing requirementsChecked/issues/summary
  }, '', { label: 's3' });
  assert.equal(count, 2);
  assert.equal(result.verdict, 'blocked');
});

// --- Test 13: blocked sentinel conforms to VERIFY_SCHEMA semantics ---
test('blocked sentinel conforms to VERIFY_SCHEMA semantics', async () => {
  const result = await verifyWithBoundedRetry(async () => null, '', { label: 'shard-x' });
  assert.equal(result.verdict, 'blocked');
  assert.ok(Array.isArray(result.requirementsChecked));
  assert.ok(Array.isArray(result.issues));
  assert.equal(typeof result.summary, 'string');
  assert.ok(result.issues.length > 0);
  const issue = result.issues[0];
  assert.ok(typeof issue.id === 'string');
  assert.ok(typeof issue.severity === 'string');
  assert.ok(typeof issue.category === 'string');
  assert.ok(typeof issue.file === 'string');
  assert.ok(typeof issue.evidence === 'string');
  assert.ok(typeof issue.impact === 'string');
  assert.ok(typeof issue.recommendedFix === 'string');
});

// --- No more than one retry (no third call) ---
test('explicit fail is not retried', async () => {
  let count = 0;
  assert.equal(await verifyWithBoundedRetry(async () => { count++; return fail; }, '', { label: 's1' }), fail);
  assert.equal(count, 1);
});

test('explicit blocked is not retried', async () => {
  let count = 0;
  assert.equal(await verifyWithBoundedRetry(async () => { count++; return blocked; }, '', { label: 's1' }), blocked);
  assert.equal(count, 1);
});
