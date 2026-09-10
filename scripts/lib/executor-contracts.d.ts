export declare const MANIFEST_CONTRACT_VERSION: string;
export declare const SHARD_STATUSES: readonly ['pending', 'in_progress', 'completed', 'failed', 'blocked'];
export declare const VERDICT_TYPES: readonly ['LGTM', 'NEEDS_WORK', 'BLOCKED'];
export declare const REQUIRED_SECTIONS: readonly ['Executive Summary', 'Architecture & Invariants', 'Workstreams & Sharding', 'Verification Matrix', 'Risk & Mitigation'];

export declare function validateManifestCoverage(manifest: any): string[];
export declare function validateManifestOwnership(manifest: any): string[];
export declare function computeShardPriorities(shards: any[]): any[];
export declare function clusterIntegrationFindings(findings: any[]): any[];
export declare function buildShardPacket(shard: any, manifest: any): any;

export declare function normalizePath(filePath: string): string;
export declare function toRepoRelativePath(targetPath: string, rootDir?: string): string;
export declare function matchesPath(pattern: string, targetPath: string): boolean;
export declare function pathsOverlap(patternA: string, patternB: string): boolean;

export declare function getRepoRoot(): string;
export declare function getWorktreesBaseDir(): string;
export declare function createRunWorktree(runId: string, shardId: string, options?: any): any;
export declare function inspectWorktreeDiff(worktreeInfo: any): any;
export declare function integrateWorktreeBranch(worktreeInfo: any, options?: any): any;
export declare function cleanupRunWorktree(worktreeInfo: any, options?: any): any;
export declare function reapStaleWorktrees(runId: string, options?: any): any[];

export declare function scanInvariants(diffText: string): any[];
export declare function evaluateReleaseReadiness(input: any): any;
export declare function formatRepairRequest(cluster: any, options?: any): any;

export declare class ExecutionTelemetry {
  constructor(runId: string, options?: any);
  runId: string;
  totalDurationMs: number;
  tokenUsage: any;
  phases: any;
  shards: any;
  verification: any;
  startPhase(name: string, metadata?: any): void;
  endPhase(name: string, data?: any): void;
  recordShardExecution(shardId: string, data: any): void;
  recordVerification(data: any): void;
  finish(): void;
  persist(): string;
}

export declare function loadTelemetry(filePathOrRunId: string, options?: any): any;
export declare function compareTelemetry(runA: any, runB: any): any;

export declare function findAllTestFiles(dir: string, fileList?: string[]): string[];
export declare function discoverTargetedTests(changedFiles: string[], options?: any): any;
export declare function runTargetedTests(testFiles: string[], options?: any): Promise<any>;
export declare class VerificationCache {
  constructor(namespace?: string);
  getStateHash(extraInputs?: any): string;
  get(key: string, stateHash: string): any;
  set(key: string, value: any, stateHash: string): void;
}

export declare function gradeExecution(telemetry: any, manifest: any, options?: any): any;
export declare function gradeBenchmark(baselineTelemetry: any, candidateTelemetry: any, manifest: any): any;
