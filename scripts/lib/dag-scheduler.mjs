/**
 * QCET Plan Executor - Dynamic Dependency DAG & Resource Pool Scheduler (T09)
 */

import { computeShardPriorities } from './executor-contracts.mjs';
export { computeShardPriorities };

/**
 * Computes which shards are eligible for pre-reconnaissance based on bounded lookahead.
 * Prevents unbounded speculative fan-out on deep-future shards.
 *
 * @param {Object} manifest
 * @param {Set<string>|Array<string>} activeShardIds
 * @param {Set<string>|Array<string>} completedShardIds
 * @param {number} [lookaheadDepth=1]
 * @returns {Set<string>} Set of eligible shard IDs
 */
export function computeEligibleReconShards(
  manifest,
  activeShardIds = new Set(),
  completedShardIds = new Set(),
  lookaheadDepth = 1
) {
  const shards = Array.isArray(manifest?.shards) ? manifest.shards : [];
  const activeSet = activeShardIds instanceof Set ? activeShardIds : new Set(activeShardIds);
  const completedSet = completedShardIds instanceof Set ? completedShardIds : new Set(completedShardIds);

  const eligible = new Set();
  const dependentsMap = new Map();
  const dependenciesMap = new Map();

  for (const s of shards) {
    dependentsMap.set(s.id, []);
    const deps = Array.isArray(s.dependencies)
      ? s.dependencies
      : Array.isArray(s.dependsOn)
      ? s.dependsOn
      : [];
    dependenciesMap.set(s.id, deps);
  }

  for (const [id, deps] of dependenciesMap.entries()) {
    for (const d of deps) {
      if (dependentsMap.has(d)) {
        dependentsMap.get(d).push(id);
      }
    }
  }

  // Level 0: Ready shards (all dependencies completed or none)
  const readyShards = [];
  for (const s of shards) {
    if (completedSet.has(s.id)) continue;
    const deps = dependenciesMap.get(s.id) || [];
    const allMet = deps.every((d) => completedSet.has(d));
    if (allMet) {
      eligible.add(s.id);
      readyShards.push(s.id);
    }
  }

  // Bounded lookahead: Traverse up to lookaheadDepth levels downstream from ready or currently active shards
  let currentFrontier = [...readyShards, ...Array.from(activeSet)];
  let currentDepth = 0;

  while (currentDepth < lookaheadDepth && currentFrontier.length > 0) {
    const nextFrontier = [];
    for (const parentId of currentFrontier) {
      for (const childId of dependentsMap.get(parentId) || []) {
        if (!eligible.has(childId) && !completedSet.has(childId)) {
          eligible.add(childId);
          nextFrontier.push(childId);
        }
      }
    }
    currentFrontier = nextFrontier;
    currentDepth++;
  }

  return eligible;
}

/**
 * Detects cycles in shard dependencies.
 * @param {Array<Object>} shards
 * @returns {Array<string>|null} Cycle path or null if DAG is acyclic
 */
export function detectCycles(shards) {
  const adj = new Map();
  for (const s of shards) {
    adj.set(s.id, s.dependencies || []);
  }

  const visited = new Map(); // 0 = unvisited, 1 = visiting, 2 = visited
  const path = [];

  function dfs(nodeId) {
    visited.set(nodeId, 1);
    path.push(nodeId);

    const deps = adj.get(nodeId) || [];
    for (const dep of deps) {
      if (!adj.has(dep)) continue; // external/untracked dependency
      const state = visited.get(dep) || 0;
      if (state === 1) {
        // Cycle detected
        const cycleStartIndex = path.indexOf(dep);
        return path.slice(cycleStartIndex).concat(dep);
      }
      if (state === 0) {
        const cycle = dfs(dep);
        if (cycle) return cycle;
      }
    }

    path.pop();
    visited.set(nodeId, 2);
    return null;
  }

  for (const s of shards) {
    if (!visited.get(s.id)) {
      const cycle = dfs(s.id);
      if (cycle) return cycle;
    }
  }

  return null;
}

/**
 * Performs topological sort of shards.
 * @param {Array<Object>} shards
 * @returns {Array<string>} Array of shard IDs in topological order
 */
export function topologicalSort(shards) {
  const cycle = detectCycles(shards);
  if (cycle) {
    throw new Error(`Cycle detected in DAG dependencies: ${cycle.join(' -> ')}`);
  }

  const inDegree = new Map();
  const adj = new Map(); // dep -> dependents

  for (const s of shards) {
    inDegree.set(s.id, 0);
    adj.set(s.id, []);
  }

  for (const s of shards) {
    const deps = (s.dependencies || []).filter((d) => inDegree.has(d));
    inDegree.set(s.id, deps.length);
    for (const d of deps) {
      adj.get(d).push(s.id);
    }
  }

  const queue = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(id);
  }

  const order = [];
  while (queue.length > 0) {
    const curr = queue.shift();
    order.push(curr);
    for (const next of adj.get(curr)) {
      const newDeg = inDegree.get(next) - 1;
      inDegree.set(next, newDeg);
      if (newDeg === 0) {
        queue.push(next);
      }
    }
  }

  return order;
}

/**
 * Dynamic DAG Scheduler with concurrency throttling and priority queue.
 * Operates on resource pools (builders, verifiers, recon, researchers) and optimizes makespan.
 */
export class DagScheduler {
  constructor(manifest, options = {}) {
    this.manifest = manifest;
    this.shards = Array.isArray(manifest.shards) ? manifest.shards : [];
    // Concurrency is an explicit LLM agent concurrency limit, never derived from CPU cores
    this.concurrency = typeof options.concurrency === 'number' ? options.concurrency : 6;
    this.poolCaps = {
      builders: options.poolCaps?.builders ?? 4,
      verifiers: options.poolCaps?.verifiers ?? 4,
      recon: options.poolCaps?.recon ?? 2,
      researchers: options.poolCaps?.researchers ?? 1,
      ...(options.poolCaps || {}),
    };
    this.lookaheadDepth = typeof options.lookaheadDepth === 'number' ? options.lookaheadDepth : 1;
    this.runShard = options.runShard || (async (s) => ({ status: 'completed', shardId: s.id }));
    this.priorities = computeShardPriorities(manifest);
  }

  async execute() {
    const cycle = detectCycles(this.shards);
    if (cycle) {
      throw new Error(`Cannot execute DAG: Cycle detected: ${cycle.join(' -> ')}`);
    }

    const shardMap = new Map(this.shards.map((s) => [s.id, s]));
    const inDegree = new Map();
    const dependentsMap = new Map();

    for (const s of this.shards) {
      inDegree.set(s.id, 0);
      dependentsMap.set(s.id, []);
    }

    for (const s of this.shards) {
      const deps = (s.dependencies || []).filter((d) => inDegree.has(d));
      inDegree.set(s.id, deps.length);
      for (const d of deps) {
        dependentsMap.get(d).push(s.id);
      }
    }

    // Unblocked queue sorted by priority descending
    const readyQueue = [];
    for (const [id, deg] of inDegree.entries()) {
      if (deg === 0) {
        readyQueue.push(shardMap.get(id));
      }
    }
    this._sortQueueByPriority(readyQueue);

    let activeCount = 0;
    let peakConcurrent = 0;
    const activePoolCounts = {
      builders: 0,
      verifiers: 0,
      recon: 0,
      researchers: 0,
    };
    const completedResults = new Map();
    const timeline = [];
    const executionErrors = [];
    const executionStartTime = Date.now();

    return new Promise((resolve, reject) => {
      const checkAndPump = () => {
        // If all shards finished
        if (completedResults.size === this.shards.length) {
          const makespanMs = Date.now() - executionStartTime;
          return resolve({
            status: executionErrors.length === 0 ? 'completed' : 'failed',
            completedCount: completedResults.size,
            results: Object.fromEntries(completedResults),
            timeline,
            errors: executionErrors,
            makespanMs,
            peakConcurrent,
          });
        }

        // Check if any shard in readyQueue can run given poolCaps
        const hasRunnable = readyQueue.some((candidate) => {
          const pool = candidate.pool;
          return !pool || (activePoolCounts[pool] ?? 0) < (this.poolCaps[pool] ?? this.concurrency);
        });

        // If deadlock or no progress possible
        if (activeCount === 0 && !hasRunnable && completedResults.size < this.shards.length) {
          return reject(new Error('DAG scheduler deadlock: remaining shards are blocked or starved by pool caps but no active tasks running'));
        }

        // Launch tasks up to concurrency capacity and pool limits
        while (activeCount < this.concurrency && readyQueue.length > 0) {
          let candidateIndex = -1;
          for (let i = 0; i < readyQueue.length; i++) {
            const candidate = readyQueue[i];
            const pool = candidate.pool;
            if (!pool || (activePoolCounts[pool] ?? 0) < (this.poolCaps[pool] ?? this.concurrency)) {
              candidateIndex = i;
              break;
            }
          }

          if (candidateIndex === -1) {
            break; // All remaining ready shards are waiting on pool capacity
          }

          const shard = readyQueue.splice(candidateIndex, 1)[0];
          activeCount++;
          if (shard.pool) {
            activePoolCounts[shard.pool] = (activePoolCounts[shard.pool] || 0) + 1;
          }
          if (activeCount > peakConcurrent) {
            peakConcurrent = activeCount;
          }
          const startTime = Date.now();

          Promise.resolve(this.runShard(shard))
            .then((res) => {
              const endTime = Date.now();
              timeline.push({
                shardId: shard.id,
                startTime,
                endTime,
                durationMs: endTime - startTime,
                status: 'completed',
              });
              completedResults.set(shard.id, res);

              // Shard unblocks dependents ONLY if it succeeded/passed verification
              const passed = res?.status === 'completed' || res?.status === 'passed' || !res?.status;
              if (passed) {
                for (const depId of dependentsMap.get(shard.id) || []) {
                  const currentDeg = inDegree.get(depId) - 1;
                  inDegree.set(depId, currentDeg);
                  if (currentDeg === 0) {
                    readyQueue.push(shardMap.get(depId));
                  }
                }
              }
              this._sortQueueByPriority(readyQueue);
            })
            .catch((err) => {
              const endTime = Date.now();
              executionErrors.push({ shardId: shard.id, error: err.message });
              timeline.push({
                shardId: shard.id,
                startTime,
                endTime,
                durationMs: endTime - startTime,
                status: 'failed',
                error: err.message,
              });
              completedResults.set(shard.id, { status: 'failed', error: err.message });
            })
            .finally(() => {
              activeCount--;
              if (shard.pool) {
                activePoolCounts[shard.pool] = Math.max(0, (activePoolCounts[shard.pool] || 0) - 1);
              }
              checkAndPump();
            });
        }
      };

      checkAndPump();
    });
  }

  _sortQueueByPriority(queue) {
    queue.sort((a, b) => {
      const pA = this.priorities.get(a.id)?.priority || 0;
      const pB = this.priorities.get(b.id)?.priority || 0;
      return pB - pA; // higher priority first
    });
  }
}

/**
 * Asynchronous Priority Semaphore with Speculative Recon Reservation.
 * Guarantees that agent concurrency is bounded by capacity and speculative pre-reads
 * are capped at speculativeReadLimit so they never starve builders or verifiers.
 *
 * @param {number} [capacity=6] - Maximum concurrent permits (valid 1..16, never CPU-derived)
 * @param {Object} [options={}]
 * @param {number} [options.speculativeReadLimit] - Maximum concurrent speculative permits
 * @returns {Object}
 */
export function createSemaphore(capacity = 6, options = {}) {
  const num = typeof capacity === 'number' ? capacity : (capacity !== undefined ? Number(capacity) : 6);
  const rawCap = Number.isFinite(num) ? num : 6;
  const maxCapacity = Math.max(1, Math.min(16, Math.floor(rawCap)));
  const specNum = typeof options.speculativeReadLimit === 'number'
    ? options.speculativeReadLimit
    : (options.speculativeReadLimit !== undefined ? Number(options.speculativeReadLimit) : NaN);
  const speculativeLimit = Number.isFinite(specNum)
    ? Math.max(1, Math.min(maxCapacity, Math.floor(specNum)))
    : Math.min(2, Math.max(1, Math.floor(maxCapacity / 2)));
  let activeCount = 0;
  let activeSpeculative = 0;
  let peakConcurrent = 0;
  const queue = [];

  function tryAcquire(isSpeculative) {
    if (activeCount >= maxCapacity) return false;
    if (isSpeculative && activeSpeculative >= speculativeLimit) return false;
    activeCount++;
    if (isSpeculative) activeSpeculative++;
    if (activeCount > peakConcurrent) peakConcurrent = activeCount;
    return true;
  }

  function pump() {
    if (activeCount >= maxCapacity || queue.length === 0) return;
    for (let i = 0; i < queue.length; i++) {
      const waiter = queue[i];
      if (waiter.isSpeculative && activeSpeculative >= speculativeLimit) continue;
      queue.splice(i, 1);
      i--;
      activeCount++;
      if (waiter.isSpeculative) activeSpeculative++;
      if (activeCount > peakConcurrent) peakConcurrent = activeCount;
      waiter.resolve(createRelease(waiter.isSpeculative));
      if (activeCount >= maxCapacity) break;
    }
  }

  function createRelease(isSpeculative) {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      activeCount--;
      if (isSpeculative) activeSpeculative--;
      pump();
    };
  }

  function acquire(priority = 1, isSpeculative = false) {
    const prio = typeof priority === 'number' ? priority : 1;
    const spec = Boolean(isSpeculative);
    if (queue.length === 0 && tryAcquire(spec)) {
      return Promise.resolve(createRelease(spec));
    }
    return new Promise((resolve) => {
      const waiter = { priority: prio, isSpeculative: spec, resolve };
      let inserted = false;
      for (let i = 0; i < queue.length; i++) {
        if (queue[i].priority > prio) {
          queue.splice(i, 0, waiter);
          inserted = true;
          break;
        }
      }
      if (!inserted) queue.push(waiter);
      pump();
    });
  }

  async function withPermit(fn, priority = 1, isSpeculative = false) {
    const release = await acquire(priority, isSpeculative);
    try {
      return await fn();
    } finally {
      release();
    }
  }

  return {
    acquire,
    withPermit,
    getActiveCount: () => activeCount,
    getActiveSpeculative: () => activeSpeculative,
    getPeakConcurrent: () => peakConcurrent,
    getQueueLength: () => queue.length,
    capacity: maxCapacity,
    speculativeLimit,
  };
}

/**
 * Resolves priority tier (P0..P5) for an agent invocation.
 * Priority tiers:
 *   P0 - Release gate & global verification (highest priority)
 *   P1 - Builder & repair agents
 *   P2 - Verifier, reverify & skeptic agents
 *   P3 - Pre-implementation reconciliation & merge
 *   P4 - Ready reconnaissance (dependencies met)
 *   P5 - Speculative reconnaissance (dependencies in-flight)
 *
 * @param {Object|number} [options={}]
 * @returns {number} Priority 0..5 (lower number = higher priority)
 */
export function getAgentPriority(options = {}) {
  if (typeof options === 'number') return options;
  if (typeof options?.priority === 'number') return options.priority;
  const role = String(
    options?.role || options?.type || options?.agentType || options?.agent || options?.phase || options?.label || ''
  ).toLowerCase();
  const isSpeculative = Boolean(options?.isSpeculative || options?.speculative);

  if (role.includes('release') || role.includes('global')) return 0;
  if (role.includes('builder') || role.includes('repair') || role.includes('implement')) return 1;
  if (role.includes('verif') || role.includes('skeptic')) return 2;
  if (role.includes('reconcil') || role.includes('merge')) return 3;
  if (role.includes('recon')) {
    return isSpeculative ? 5 : 4;
  }
  return 1;
}


