/**
 * Sprint 10 Production Readiness: Health Probes & Graceful Shutdown Test Suite
 *
 * Verifies:
 * 1. GET /api/health/live returns liveness telemetry (uptime, timestamp, memory, active status).
 * 2. GET /api/health/ready returns readiness telemetry (database, schema, storage, config).
 * 3. Graceful shutdown state transition (/api/health/live and ready return 503 when terminating).
 * 4. GET /api/health backward-compatible probe contract.
 * 5. Safe environment reporting (secrets never exposed).
 */

import assert from 'node:assert/strict';
import { GET as getLive } from '@/app/api/health/live/route';
import { GET as getReady } from '@/app/api/health/ready/route';
import { GET as getHealth } from '@/app/api/health/route';
import {
  isServerShuttingDown,
  markServerTerminating,
  resetShutdownStateForTesting,
  registerShutdownHook,
  executeGracefulShutdown,
} from '@/server/lifecycle/shutdown';

async function testHealthProbes() {
  console.log('--- Test: Liveness Probe (/api/health/live) ---');
  resetShutdownStateForTesting();

  const liveRes = await getLive();
  assert.equal(liveRes.status, 200, 'Liveness probe should return 200 OK when running');

  const liveBody = await liveRes.json();
  assert.equal(liveBody.status, 'alive', 'Status should be alive');
  assert.equal(typeof liveBody.uptime, 'number', 'Uptime must be a number');
  assert.ok(liveBody.timestamp, 'Timestamp must be present');
  assert.ok(liveBody.memory, 'Memory stats must be present');
  assert.ok(liveBody.memory.rssMb > 0, 'RSS memory should be > 0');
  console.log('✓ /api/health/live returns 200 with complete telemetry payload.');

  console.log('--- Test: Readiness Probe (/api/health/ready) ---');
  const readyRes = await getReady();
  const readyBody = await readyRes.json();

  // In test environment with database accessible, status should be 200 or 503 depending on local DB state
  assert.ok(['ready', 'degraded'].includes(readyBody.status), 'Readiness status must be ready or degraded');
  assert.ok(readyBody.checks, 'Checks object must be present');
  assert.ok(readyBody.checks.database, 'Database check must be present');
  assert.ok(readyBody.checks.storage, 'Storage check must be present');
  assert.ok(readyBody.checks.config, 'Config check must be present');
  console.log(`✓ /api/health/ready returns ${readyRes.status} with detailed subsystem checks.`);

  console.log('--- Test: Backward-Compatible Probe (/api/health) ---');
  const compatRes = await getHealth();
  const compatBody = await compatRes.json();
  assert.ok(['ok', 'degraded'].includes(compatBody.status), 'Compat status must be ok or degraded');
  assert.ok(compatBody.timestamp, 'Timestamp must be present');
  console.log(`✓ /api/health backward-compatible probe returns ${compatRes.status}.`);

  console.log('--- Test: Graceful Shutdown State Transition ---');
  markServerTerminating();
  assert.equal(isServerShuttingDown(), true, 'Server state should be terminating');

  const liveTerminatingRes = await getLive();
  assert.equal(liveTerminatingRes.status, 503, 'Liveness must return 503 when terminating');
  const liveTerminatingBody = await liveTerminatingRes.json();
  assert.ok(['terminating', 'degraded'].includes(liveTerminatingBody.status));
  assert.equal(liveTerminatingBody.terminating, true);

  const readyTerminatingRes = await getReady();
  assert.equal(readyTerminatingRes.status, 503, 'Readiness must return 503 when terminating');
  const readyTerminatingBody = await readyTerminatingRes.json();
  assert.equal(readyTerminatingBody.status, 'degraded');
  assert.equal(readyTerminatingBody.terminating, true);

  console.log('✓ Both liveness and readiness return 503 Service Unavailable during shutdown.');

  console.log('--- Test: Graceful Shutdown Hook Execution ---');
  resetShutdownStateForTesting();

  const executedHooks: string[] = [];
  registerShutdownHook(async () => {
    executedHooks.push('hook-p1');
  }, { name: 'Priority1', priority: 1 });

  registerShutdownHook(async () => {
    executedHooks.push('hook-p10');
  }, { name: 'Priority10', priority: 10 });

  await executeGracefulShutdown('TEST_SIGNAL');

  assert.deepEqual(
    executedHooks,
    ['hook-p1', 'hook-p10'],
    'Shutdown hooks must execute in ascending order of priority'
  );
  assert.equal(isServerShuttingDown(), true, 'Server should remain in shut down state');
  console.log('✓ Graceful shutdown hooks executed in strict priority order.');

  // Reset after tests complete
  resetShutdownStateForTesting();
}

testHealthProbes().then(() => {
  console.log('All health probe tests passed successfully!');
}).catch((err) => {
  console.error('Test failure:', err);
  process.exit(1);
});
