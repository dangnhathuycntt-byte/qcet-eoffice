/**
 * QCET Plan Executor - Dynamic Dependency DAG & Resource Pool Scheduler (T09)
 */

import os from 'node:os';
import { computeShardPriorities } from './executor-contracts.mjs';

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
 */
export class DagScheduler {
  constructor(manifest, options = {}) {
    this.manifest = manifest;
    this.shards = Array.isArray(manifest.shards) ? manifest.shards : [];
    this.concurrency = options.concurrency || Math.min(16, Math.max(2, (os.cpus()?.length || 4) - 2));
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
    const completedResults = new Map();
    const timeline = [];
    const executionErrors = [];

    return new Promise((resolve, reject) => {
      const checkAndPump = () => {
        // If all shards finished
        if (completedResults.size === this.shards.length) {
          return resolve({
            status: executionErrors.length === 0 ? 'completed' : 'failed',
            completedCount: completedResults.size,
            results: Object.fromEntries(completedResults),
            timeline,
            errors: executionErrors,
          });
        }

        // If deadlock or no progress possible
        if (activeCount === 0 && readyQueue.length === 0 && completedResults.size < this.shards.length) {
          return reject(new Error('DAG scheduler deadlock: remaining shards are blocked but no active tasks running'));
        }

        // Launch tasks up to concurrency capacity
        while (activeCount < this.concurrency && readyQueue.length > 0) {
          const shard = readyQueue.shift();
          activeCount++;
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

              // Unblock dependents
              for (const depId of dependentsMap.get(shard.id) || []) {
                const currentDeg = inDegree.get(depId) - 1;
                inDegree.set(depId, currentDeg);
                if (currentDeg === 0) {
                  readyQueue.push(shardMap.get(depId));
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
