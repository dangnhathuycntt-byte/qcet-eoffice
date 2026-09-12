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
for (const first of [null, undefined, {}, { summary: 'text only' }]) {
  test(`missing structured result retries once: ${JSON.stringify(first)}`, async () => {
    const calls: any[] = [];
    const result = await verifyWithBoundedRetry(async (prompt: string, options: any) => {
      calls.push({ prompt, options });
      return calls.length === 1 ? first : pass;
    }, 'Independent evidence R1', { label: 's1', agent: 'qcet-skeptic' });
    assert.equal(result, pass);
    assert.equal(calls.length, 2);
    assert.match(calls[1].prompt, /Independent evidence R1/);
    assert.match(calls[1].prompt, /MUST call StructuredOutput/);
    assert.equal(calls[1].options.agent, 'qcet-skeptic');
  });
}
for (const verdict of ['pass', 'fail', 'blocked']) {
  test(`explicit ${verdict} is not retried`, async () => {
    let count = 0;
    const first = { ...pass, verdict };
    assert.equal(await verifyWithBoundedRetry(async () => { count++; return first; }, '', { label: 's1' }), first);
    assert.equal(count, 1);
  });
}
test('two missing results fail closed with no third invocation', async () => {
  let count = 0;
  const result = await verifyWithBoundedRetry(async () => { count++; return null; }, '', { label: 's1' });
  assert.equal(count, 2);
  assert.equal(result.verdict, 'blocked');
  assert.equal(result.issues[0].severity, 'critical');
});
test('verifier exceptions remain failures', async () => {
  await assert.rejects(verifyWithBoundedRetry(async () => { throw new Error('transport failure'); }, '', { label: 's1' }), /transport failure/);
});
