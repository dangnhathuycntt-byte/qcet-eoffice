#!/usr/bin/env python3
from pathlib import Path
import argparse


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"missing patch anchor: {label}")
    return text.replace(old, new, 1)


def add_tests() -> None:
    workflow_test = Path("tests/executor/workflow-executor.test.ts")
    text = workflow_test.read_text()
    text = replace_once(
        text,
        "  validateResearchEscalation,\n} = sandbox;",
        "  validateResearchEscalation,\n  createConcurrencyLimiter,\n  selectIntegrationReviewDimensionIds,\n  computeCriticalPathDurationMs,\n} = sandbox;",
        "workflow helper imports",
    )
    marker = "workflow-executor: lowercase high integration severity blocks release"
    if marker not in text:
        text += r'''

test('workflow-executor: lowercase high integration severity blocks release', () => {
  const gate = evaluateDeterministicReleaseGate({
    manifest: { requirements: [{ id: 'REQ-1' }] },
    allShardResults: [
      { shard: { id: 's1', requirements: ['REQ-1'] }, lastVerification: { verdict: 'pass', issues: [] } },
    ],
    integrationSynthesis: {
      findings: [
        { id: 'INT-1', severity: 'high', category: 'contracts', file: 'src/a.ts', evidence: 'broken', impact: 'runtime', recommendedFix: 'fix' },
      ],
    },
    integrationRepair: null,
    validation: { status: 'passed', checks: [] },
    finalVerdict: { status: 'READY' },
  });

  assert.equal(gate.status, 'BLOCKED');
  assert.ok(gate.blockers.some((b: string) => b.includes('critical/high integration defect')));
});

test('workflow-executor: concurrency limiter caps simultaneous agent work', async () => {
  const limit = createConcurrencyLimiter(2);
  let active = 0;
  let peak = 0;
  const tasks = Array.from({ length: 6 }, (_, i) =>
    limit(async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 15));
      active -= 1;
      return i;
    })
  );
  const results = await Promise.all(tasks);
  assert.deepEqual(results, [0, 1, 2, 3, 4, 5]);
  assert.equal(peak, 2);
});

test('workflow-executor: buildRunTelemetry preserves measured scheduler timings', () => {
  const telemetry = buildRunTelemetry({
    planPath: 'test-plan.md',
    manifest: { requirements: [], shards: [] },
    allShardResults: [],
    integrationSynthesis: { findings: [] },
    validation: { status: 'passed', checks: [] },
    finalVerdict: { status: 'READY' },
    wallClockMs: 1500,
    calibrationDurationMs: 200,
    timeToFirstBuilderMs: 250,
    criticalPathDurationMs: 900,
    avgDependencyWaitMs: 80,
    domain: 'ux',
    executorVersion: 'v1.5',
  });

  assert.equal(telemetry.run.metrics.speed.timeToFirstBuilderMs, 250);
  assert.equal(telemetry.run.metrics.speed.criticalPathDurationMs, 900);
  assert.equal(telemetry.run.metrics.speed.avgDependencyWaitMs, 80);
  assert.equal(telemetry.run.domain, 'ux');
  assert.equal(telemetry.run.executorVersion, 'v1.5');
});

test('workflow-executor: integration review dimensions adapt to risk', () => {
  assert.deepEqual(
    selectIntegrationReviewDimensionIds([
      { id: 's1', risk: 'low', changedFiles: ['src/ui/a.tsx'] },
      { id: 's2', risk: 'low', changedFiles: ['src/ui/b.tsx'] },
    ]),
    ['contracts', 'regression']
  );

  assert.deepEqual(
    selectIntegrationReviewDimensionIds([
      { id: 's1', risk: 'critical', changedFiles: ['src/server/auth/session.ts'] },
    ]),
    ['contracts', 'authorization', 'semantics', 'regression']
  );
});

test('workflow-executor: critical path sums the longest dependency chain', () => {
  const duration = computeCriticalPathDurationMs(
    {
      shards: [
        { id: 'a', dependencies: [] },
        { id: 'b', dependencies: ['a'] },
        { id: 'c', dependencies: ['a'] },
        { id: 'd', dependencies: ['b', 'c'] },
      ],
    },
    { a: 100, b: 200, c: 500, d: 50 }
  );
  assert.equal(duration, 650);
});
'''
    workflow_test.write_text(text)

    hooks_test = Path("tests/executor/hooks.test.ts")
    text = hooks_test.read_text()
    marker = "builder mutating Bash is blocked"
    if marker not in text:
        text += r'''

test('pre-tool-use-ownership-guard: builder mutating Bash is blocked', () => {
  const res = runHook(ownershipGuard, {
    tool_name: 'Bash',
    agent_type: 'qcet-builder',
    agent_id: 'shard-auth:implement',
    tool_input: { command: "sed -i 's/a/b/' src/server/auth/session.ts" },
  });
  assert.equal(res.status, 2);
  assert.ok(res.stderr.includes('shell file mutation'));
});

test('pre-tool-use-ownership-guard: builder inline interpreter mutation is blocked', () => {
  const res = runHook(ownershipGuard, {
    tool_name: 'Bash',
    agent_type: 'qcet-builder',
    agent_id: 'shard-auth:implement',
    tool_input: { command: "python -c \"open('src/server/auth/session.ts','w').write('x')\"" },
  });
  assert.equal(res.status, 2);
  assert.ok(res.stderr.includes('shell file mutation'));
});

test('pre-tool-use-ownership-guard: builder non-mutating Bash remains allowed', () => {
  const res = runHook(ownershipGuard, {
    tool_name: 'Bash',
    agent_type: 'qcet-builder',
    agent_id: 'shard-auth:implement',
    tool_input: { command: 'npm test -- tests/unit/auth.test.ts' },
  });
  assert.equal(res.status, 0);
});

test('settings: ownership guard also receives Bash PreToolUse events', () => {
  const settings = JSON.parse(fs.readFileSync(path.join(rootDir, '.claude', 'settings.json'), 'utf8'));
  const entry = settings.hooks.PreToolUse.find((item: any) =>
    item.hooks?.some((hook: any) => hook.command === './.claude/hooks/pre-tool-use-ownership-guard')
  );
  assert.ok(entry);
  assert.ok(String(entry.matcher).split('|').includes('Bash'));
});
'''
    hooks_test.write_text(text)


def apply_implementation() -> None:
    path = Path(".claude/workflows/qcet-plan-executor.js")
    text = path.read_text()

    text = replace_once(
        text,
        "  const criticalIntegrationDefects = synthFindings.filter(\n    (d) => d?.severity === 'CRITICAL' || d?.severity === 'HIGH'\n  );",
        "  const criticalIntegrationDefects = synthFindings.filter((d) =>\n    ['critical', 'high'].includes(String(d?.severity || '').toLowerCase())\n  );",
        "severity normalization",
    )

    helper_anchor = "export function shouldIsolateShard(shard, manifest, isolationConfig = 'auto') {"
    helpers = r'''export function createConcurrencyLimiter(maxConcurrent = Infinity) {
  const parsed = Number(maxConcurrent);
  const limit = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : Infinity;
  let active = 0;
  const queue = [];

  const drain = () => {
    while (active < limit && queue.length > 0) {
      const next = queue.shift();
      active++;
      Promise.resolve()
        .then(next.task)
        .then(next.resolve, next.reject)
        .finally(() => {
          active--;
          drain();
        });
    }
  };

  return (task) =>
    new Promise((resolve, reject) => {
      queue.push({ task, resolve, reject });
      drain();
    });
}

export function selectIntegrationReviewDimensionIds(shardSummary = []) {
  const summaries = Array.isArray(shardSummary) ? shardSummary : [];
  const risks = summaries.map((item) => String(item?.risk || 'low').toLowerCase());
  const hasHighRisk = risks.some((risk) => risk === 'high' || risk === 'critical');
  const hasMediumRisk = risks.some((risk) => risk === 'medium');
  const authSurface = summaries.some((item) => {
    const haystack = JSON.stringify({
      files: item?.changedFiles || [],
      requirements: item?.requirements || [],
      id: item?.id || '',
    }).toLowerCase();
    return /auth|permission|rbac|session|security|token|role/.test(haystack);
  });

  if (hasHighRisk || authSurface) {
    return ['contracts', 'authorization', 'semantics', 'regression'];
  }
  if (hasMediumRisk || summaries.length > 2) {
    return ['contracts', 'semantics', 'regression'];
  }
  return ['contracts', 'regression'];
}

export function computeCriticalPathDurationMs(manifest, shardDurations = {}) {
  const shards = Array.isArray(manifest?.shards) ? manifest.shards : [];
  const byId = new Map(shards.map((shard) => [shard.id, shard]));
  const memo = new Map();
  const visiting = new Set();

  const durationOf = (id) => {
    const value = Number(shardDurations?.[id]);
    return Number.isFinite(value) && value > 0 ? value : 0;
  };

  const longestTo = (id) => {
    if (memo.has(id)) return memo.get(id);
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const shard = byId.get(id);
    const deps = Array.isArray(shard?.dependencies) ? shard.dependencies : [];
    let upstream = 0;
    for (const depId of deps) {
      upstream = Math.max(upstream, longestTo(depId));
    }
    visiting.delete(id);
    const total = upstream + durationOf(id);
    memo.set(id, total);
    return total;
  };

  let critical = 0;
  for (const shard of shards) {
    critical = Math.max(critical, longestTo(shard.id));
  }
  return critical > 0 ? Math.round(critical) : null;
}

'''
    text = replace_once(text, helper_anchor, helpers + helper_anchor, "scheduler helpers")

    text = replace_once(
        text,
        "  peakConcurrent = 1,\n  tokensTotal = null,\n  planPath = '',\n  timestamp = '2026-09-10T00:00:00.000Z',\n  runId = '',\n}) {",
        "  peakConcurrent = 1,\n  tokensTotal = null,\n  timeToFirstBuilderMs = null,\n  criticalPathDurationMs = null,\n  avgDependencyWaitMs = null,\n  domain = 'general',\n  executorVersion = 'v1.5',\n  planPath = '',\n  timestamp = '2026-09-10T00:00:00.000Z',\n  runId = '',\n}) {",
        "telemetry signature",
    )

    text = replace_once(
        text,
        "  const calibrationDuration = typeof calibrationDurationMs === 'number' && calibrationDurationMs > 0 ? Math.round(calibrationDurationMs) : null;\n  const timeToFirstBuilder = null;\n  const criticalPathDuration = null;\n  const avgDependencyWait = null;",
        "  const calibrationDuration = typeof calibrationDurationMs === 'number' && calibrationDurationMs > 0 ? Math.round(calibrationDurationMs) : null;\n  const timeToFirstBuilder = typeof timeToFirstBuilderMs === 'number' && timeToFirstBuilderMs >= 0 ? Math.round(timeToFirstBuilderMs) : null;\n  const criticalPathDuration = typeof criticalPathDurationMs === 'number' && criticalPathDurationMs >= 0 ? Math.round(criticalPathDurationMs) : null;\n  const avgDependencyWait = typeof avgDependencyWaitMs === 'number' && avgDependencyWaitMs >= 0 ? Math.round(avgDependencyWaitMs) : null;",
        "telemetry timings",
    )

    text = replace_once(
        text,
        "    executorVersion: 'v1.4',\n    domain: 'general',\n    description: `QCET Plan Executor v1.4 execution run for ${planPath || 'manifest'}`,",
        "    executorVersion,\n    domain,\n    description: `QCET Plan Executor ${executorVersion} execution run for ${planPath || 'manifest'}`,",
        "telemetry version/domain",
    )

    text = replace_once(
        text,
        """// Concurrency & wall-clock tracking for evaluation telemetry
const startTime = typeof args?.startTime === 'number' ? args.startTime : 0;
let calibrationDurationMs = typeof args?.calibrationDurationMs === 'number' ? args.calibrationDurationMs : 0;
let activeAgents = 0;
let peakConcurrent = 0;
let totalAgentsCount = 0;

const rawAgent = agent;
const callAgent = async (prompt, options) => {
  if (typeof budget !== 'undefined' && budget?.total && budget.remaining() <= 0) {
    log('WARNING: Token budget exhausted. Returning null from callAgent.');
    return null;
  }
  activeAgents++;
  totalAgentsCount++;
  if (activeAgents > peakConcurrent) {
    peakConcurrent = activeAgents;
  }
  try {
    return await rawAgent(prompt, options);
  } finally {
    activeAgents--;
  }
};""",
        """// Concurrency & wall-clock tracking for evaluation telemetry
const workflowStartedAtMs = typeof rawArgs?.startTime === 'number' && rawArgs.startTime > 0
  ? rawArgs.startTime
  : Date.now();
const calibrationStartedAtMs = Date.now();
let calibrationDurationMs = typeof rawArgs?.calibrationDurationMs === 'number' ? rawArgs.calibrationDurationMs : 0;
let activeAgents = 0;
let peakConcurrent = 0;
let totalAgentsCount = 0;
let firstBuilderStartedAtMs = null;
const dependencyWaitDurationsMs = [];

const configuredMaxConcurrent = Number(budgetConfig?.maxConcurrentAgents ?? budgetConfig?.maxConcurrent ?? 8);
const maxConcurrentAgents = Number.isFinite(configuredMaxConcurrent) && configuredMaxConcurrent > 0
  ? Math.floor(configuredMaxConcurrent)
  : 8;
const configuredMaxAgents = Number(budgetConfig?.maxAgents);
const maxAgents = Number.isFinite(configuredMaxAgents) && configuredMaxAgents > 0
  ? Math.floor(configuredMaxAgents)
  : Infinity;
const runWithAgentSlot = createConcurrencyLimiter(maxConcurrentAgents);

const rawAgent = agent;
const callAgent = async (prompt, options) => {
  if (totalAgentsCount >= maxAgents) {
    log(`WARNING: Agent budget exhausted (${maxAgents}). Returning null from callAgent.`);
    return null;
  }
  if (typeof budget !== 'undefined' && budget?.total && budget.remaining() <= 0) {
    log('WARNING: Token budget exhausted. Returning null from callAgent.');
    return null;
  }
  totalAgentsCount++;
  return runWithAgentSlot(async () => {
    activeAgents++;
    if (options?.phase === 'Implement' && firstBuilderStartedAtMs === null) {
      firstBuilderStartedAtMs = Date.now();
    }
    if (activeAgents > peakConcurrent) {
      peakConcurrent = activeAgents;
    }
    try {
      return await rawAgent(prompt, options);
    } finally {
      activeAgents--;
    }
  });
};""",
        "concurrency governor",
    )

    text = replace_once(
        text,
        "calibrationDurationMs = typeof args?.calibrationDurationMs === 'number' ? args.calibrationDurationMs : 0;",
        "calibrationDurationMs = typeof rawArgs?.calibrationDurationMs === 'number' && rawArgs.calibrationDurationMs > 0\n    ? rawArgs.calibrationDurationMs\n    : Math.max(0, Date.now() - calibrationStartedAtMs);",
        "calibration timing",
    )

    text = replace_once(
        text,
        "    const implementation = await callAgent(\n      implementationPrompt,\n      builderOptions\n    );",
        "    const shardExecutionStartedAtMs = Date.now();\n    const implementation = await callAgent(\n      implementationPrompt,\n      builderOptions\n    );",
        "builder timing start",
    )

    text = replace_once(
        text,
        "    return state;\n  }\n\n\n  // ===========================================================================\n  // DEPENDENCY-READY DAG SCHEDULER",
        "    state.timing = {\n      durationMs: Math.max(0, Date.now() - shardExecutionStartedAtMs),\n    };\n    return state;\n  }\n\n\n  // ===========================================================================\n  // DEPENDENCY-READY DAG SCHEDULER",
        "builder timing end",
    )

    text = replace_once(
        text,
        "    const promise = Promise.all(dependencyPromises)\n      .then(async (dependencyResults) => {",
        "    const dependencyWaitStartedAtMs = Date.now();\n    const promise = Promise.all(dependencyPromises)\n      .then(async (dependencyResults) => {\n        if (dependencyPromises.length > 0) {\n          dependencyWaitDurationsMs.push(Math.max(0, Date.now() - dependencyWaitStartedAtMs));\n        }",
        "dependency wait timing",
    )

    text = replace_once(text, "  const reviewDimensions = [", "  const allReviewDimensions = [", "review dimensions rename")
    text = replace_once(
        text,
        "  ];\n\n\n  const integrationReviews = await parallel(\n    reviewDimensions.map((dimension) => () =>",
        "  ];\n\n  const selectedReviewDimensionIds = selectIntegrationReviewDimensionIds(shardSummary);\n  const reviewDimensions = allReviewDimensions.filter((dimension) =>\n    selectedReviewDimensionIds.includes(dimension.id)\n  );\n  log(`Adaptive integration review selected: ${selectedReviewDimensionIds.join(', ')}`);\n\n\n  const integrationReviews = await parallel(\n    reviewDimensions.map((dimension) => () =>",
        "adaptive integration review",
    )

    text = replace_once(
        text,
        "  const wallClockMs = typeof args?.wallClockMs === 'number' ? args.wallClockMs : (calibrationDurationMs + 10000);\n  const runTelemetry = buildRunTelemetry({",
        "  const wallClockMs = typeof rawArgs?.wallClockMs === 'number' && rawArgs.wallClockMs > 0\n    ? rawArgs.wallClockMs\n    : Math.max(0, Date.now() - workflowStartedAtMs);\n  const timeToFirstBuilderMs = firstBuilderStartedAtMs === null\n    ? null\n    : Math.max(0, firstBuilderStartedAtMs - workflowStartedAtMs);\n  const avgDependencyWaitMs = dependencyWaitDurationsMs.length > 0\n    ? dependencyWaitDurationsMs.reduce((sum, value) => sum + value, 0) / dependencyWaitDurationsMs.length\n    : 0;\n  const shardDurations = Object.fromEntries(\n    allShardResults.map((result) => [result?.shard?.id, result?.timing?.durationMs || 0]).filter(([id]) => id)\n  );\n  const criticalPathDurationMs = computeCriticalPathDurationMs(manifest, shardDurations);\n  const runTelemetry = buildRunTelemetry({",
        "final timing metrics",
    )

    text = replace_once(
        text,
        "    peakConcurrent,\n    timestamp:",
        "    peakConcurrent,\n    timeToFirstBuilderMs,\n    criticalPathDurationMs,\n    avgDependencyWaitMs,\n    domain: domainConfig,\n    executorVersion: 'v1.5',\n    timestamp:",
        "telemetry measured args",
    )
    path.write_text(text)

    guard = Path(".claude/hooks/pre-tool-use-ownership-guard")
    text = guard.read_text()
    helper_anchor = "// -----------------------------------------------------------------------------\n// MAIN EXECUTION\n// -----------------------------------------------------------------------------"
    bash_helper = r'''function isMutatingShellCommand(command) {
  const text = String(command || '').trim();
  if (!text) return false;
  const mutatingPrimitive = /(?:^|[;&|]\s*)(?:sed\s+-i\b|perl\s+-pi\b|tee\b|touch\b|truncate\b|cp\b|mv\b|rm\b|patch\b|git\s+(?:apply|restore|rm|mv|checkout\s+--?)\b)/i;
  const outputRedirect = /(?:^|[^<])>>?\s*(?:["']?)(?:\.?\.?\/)?[A-Za-z0-9_.-]/m;
  const inlineInterpreter = /\b(?:python3?|node|ruby|perl|bash|sh)\s+(?:-c|-e)\b/i;
  return mutatingPrimitive.test(text) || outputRedirect.test(text) || inlineInterpreter.test(text);
}

'''
    text = replace_once(text, helper_anchor, bash_helper + helper_anchor, "bash mutation helper")

    old = """  const toolName = data.tool_name || data.toolName || '';
  // PreToolUse ownership guard specifically enforces Write and Edit invocations
  if (toolName !== 'Write' && toolName !== 'Edit') {
    process.exit(EXIT_ALLOW);
  }

  const toolInput = data.tool_input || data.toolInput || {};
  const rawPath =
    toolInput.file_path ||
    toolInput.filePath ||
    toolInput.path ||
    toolInput.notebook_path ||
    '';

  if (!rawPath) {
    process.exit(EXIT_ALLOW);
  }

  const agentId = data.agent_id || data.agentId || process.env.QCET_AGENT_ID || '';
  const agentType = data.agent_type || data.agentType || process.env.QCET_AGENT_TYPE || '';
  const agentRole = data.agent_role || data.agentRole || process.env.QCET_AGENT_ROLE || '';
  const subagentLabel = data.subagent_label || data.subagentLabel || data.label || '';

  // 1. Prohibit read-only agents from writing or editing
  if (isReadOnlyAgent(agentType, agentId, agentRole, subagentLabel)) {
    block(
      `Agent '${agentType || agentId || subagentLabel}' has a read-only role. Write and Edit tools are prohibited.`
    );
  }"""
    new = """  const toolName = data.tool_name || data.toolName || '';
  const isFileMutationTool = toolName === 'Write' || toolName === 'Edit';
  const isBashTool = toolName === 'Bash';
  if (!isFileMutationTool && !isBashTool) {
    process.exit(EXIT_ALLOW);
  }

  const toolInput = data.tool_input || data.toolInput || {};
  const agentId = data.agent_id || data.agentId || process.env.QCET_AGENT_ID || '';
  const agentType = data.agent_type || data.agentType || process.env.QCET_AGENT_TYPE || '';
  const agentRole = data.agent_role || data.agentRole || process.env.QCET_AGENT_ROLE || '';
  const subagentLabel = data.subagent_label || data.subagentLabel || data.label || '';
  const readOnly = isReadOnlyAgent(agentType, agentId, agentRole, subagentLabel);
  const builder = [agentType, agentRole, agentId, subagentLabel]
    .filter(Boolean)
    .some((value) => /builder|:implement|:repair/i.test(String(value)));

  if (isBashTool) {
    const command = toolInput.command || '';
    if ((readOnly || builder) && isMutatingShellCommand(command)) {
      block(
        `Agent '${agentType || agentId || subagentLabel}' attempted shell file mutation. Use Write/Edit so shard ownership can be enforced deterministically.`
      );
    }
    process.exit(EXIT_ALLOW);
  }

  const rawPath =
    toolInput.file_path ||
    toolInput.filePath ||
    toolInput.path ||
    toolInput.notebook_path ||
    '';

  if (!rawPath) {
    process.exit(EXIT_ALLOW);
  }

  // 1. Prohibit read-only agents from writing or editing
  if (readOnly) {
    block(
      `Agent '${agentType || agentId || subagentLabel}' has a read-only role. Write and Edit tools are prohibited.`
    );
  }"""
    text = replace_once(text, old, new, "bash ownership enforcement")
    guard.write_text(text)

    settings = Path(".claude/settings.json")
    text = settings.read_text()
    text = replace_once(
        text,
        '"matcher": "Write|Edit",\n        "hooks": [\n          {\n            "type": "command",\n            "command": "./.claude/hooks/pre-tool-use-ownership-guard"',
        '"matcher": "Write|Edit|Bash",\n        "hooks": [\n          {\n            "type": "command",\n            "command": "./.claude/hooks/pre-tool-use-ownership-guard"',
        "settings bash matcher",
    )
    settings.write_text(text)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["tests", "implementation"])
    args = parser.parse_args()
    if args.mode == "tests":
        add_tests()
    else:
        apply_implementation()


if __name__ == "__main__":
    main()
