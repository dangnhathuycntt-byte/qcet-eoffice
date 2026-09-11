import fs from 'node:fs';
import path from 'node:path';

/**
 * Check whether the agent transcript contains an explicit Skill tool invocation
 * for qcet-plan-executor. This is the Tier-1 fidelity proof (model-level intent),
 * complementing Tier-2 executor artifact proof.
 *
 * Returns { invoked: boolean, detail: string }.
 */
export function verifySkillInvocation(transcriptPath) {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) {
    return { invoked: false, detail: 'transcript not found' };
  }
  let lines;
  try {
    lines = fs.readFileSync(transcriptPath, 'utf8').split('\n').filter(Boolean);
  } catch (err) {
    return { invoked: false, detail: `transcript read error: ${err.message}` };
  }
  for (const line of lines) {
    let obj;
    try { obj = JSON.parse(line); } catch (_) { continue; }
    // Claude Code stream-json: tool_use blocks appear inside assistant message content arrays
    const content = obj?.message?.content ?? obj?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (block?.type !== 'tool_use' || block?.name !== 'Skill') continue;
      const skillName = block?.input?.skill ?? block?.input?.name ?? '';
      if (String(skillName).includes('qcet-plan-executor')) {
        return { invoked: true, detail: `Skill tool called with skill="${skillName}"` };
      }
    }
  }
  return { invoked: false, detail: 'no Skill tool invocation for qcet-plan-executor found in transcript' };
}

/**
 * Verify treatment fidelity for benchmark arms.
 * - Arm A: Must NOT produce any QCET executor artifacts (gate-verdict.json, run-ledger.jsonl, or telemetry).
 *   If found, mark HARNESS_LEAKAGE.
 * - Arm B: Must produce V1.5 run evidence (e.g. run-ledger.jsonl or run telemetry).
 *   If missing, mark HARNESS_NOT_INVOKED.
 * - Arm C: Must produce Lean V2 gate-verdict.json (and/or run-ledger.jsonl).
 *   If missing, mark HARNESS_NOT_INVOKED.
 *
 * For B and C, also verifies transcript contains an explicit Skill tool invocation
 * (Tier-1 proof), in addition to executor artifact evidence (Tier-2 proof).
 */
export function verifyTreatmentFidelity(arg1, arg2) {
  let arm, trialDir, transcriptPath;
  if (typeof arg1 === 'object' && arg1 !== null && arg1.arm) {
    arm = arg1.arm;
    trialDir = arg1.trialDir;
    transcriptPath = arg1.transcriptPath ?? null;
  } else {
    arm = arg1;
    trialDir = arg2;
    transcriptPath = null;
  }

  if (!trialDir || !fs.existsSync(trialDir)) {
    return { valid: false, reason: 'Trial directory does not exist' };
  }

  const executorRunsDir = path.join(trialDir, '.claude', 'executor-runs');
  const runTelemetryPath = path.join(trialDir, '.claude', 'executor-evals', 'run-telemetry.json');
  const rootGateVerdict = path.join(trialDir, 'gate-verdict.json');
  const runLedgerPath = path.join(trialDir, '.claude', 'dist', 'run-ledger.jsonl');

  if (arm === 'A') {
    const hasGateVerdict = fs.existsSync(rootGateVerdict);
    const hasRunLedger = fs.existsSync(runLedgerPath);
    const hasRuns = fs.existsSync(executorRunsDir) && fs.readdirSync(executorRunsDir).filter(f => !f.startsWith('.')).length > 0;
    const hasTelemetry = fs.existsSync(runTelemetryPath);
    if (hasGateVerdict || hasRunLedger || hasRuns || hasTelemetry) {
      return {
        valid: false,
        reason: 'HARNESS_LEAKAGE',
        details: 'Arm A produced QCET executor evidence (gate-verdict.json, run-ledger.jsonl, or telemetry)'
      };
    }
    return { valid: true };
  }

  if (arm === 'B') {
    // Tier-1: Skill invocation proof (model-level intent). Fail-closed.
    if (!transcriptPath) {
      return {
        valid: false,
        reason: 'HARNESS_NOT_INVOKED',
        details: 'Arm B: transcript missing — cannot verify Tier-1 Skill invocation'
      };
    }
    const skillCheckB = verifySkillInvocation(transcriptPath);
    if (!skillCheckB.invoked) {
      return {
        valid: false,
        reason: 'HARNESS_NOT_INVOKED',
        details: `Arm B Skill invocation missing: ${skillCheckB.detail}`
      };
    }

    // Tier-2: executor artifact proof.
    const hasTelemetry = fs.existsSync(runTelemetryPath);
    const hasLedger = fs.existsSync(runLedgerPath);
    const hasRuns = fs.existsSync(executorRunsDir) && fs.readdirSync(executorRunsDir).filter(f => !f.startsWith('.')).length > 0;

    if (!hasTelemetry && !hasLedger && !hasRuns) {
      return {
        valid: false,
        reason: 'HARNESS_NOT_INVOKED',
        details: 'Arm B failed to produce V1.5 run evidence (run-telemetry.json, run-ledger.jsonl, or executor-runs missing)'
      };
    }

    if (hasTelemetry) {
      try {
        const data = JSON.parse(fs.readFileSync(runTelemetryPath, 'utf8'));
        if (!data.run && !data.final && !data.finalVerdict && !data.verdict) {
          return {
            valid: false,
            reason: 'HARNESS_NOT_INVOKED',
            details: 'Arm B run telemetry missing required run/final/verdict fields'
          };
        }
      } catch (err) {
        return {
          valid: false,
          reason: 'HARNESS_NOT_INVOKED',
          details: `Malformed Arm B run telemetry: ${err.message}`
        };
      }
    }
    return { valid: true };
  }

  if (arm === 'C') {
    // Tier-1: Skill invocation proof (model-level intent). Fail-closed.
    if (!transcriptPath) {
      return {
        valid: false,
        reason: 'HARNESS_NOT_INVOKED',
        details: 'Arm C: transcript missing — cannot verify Tier-1 Skill invocation'
      };
    }
    const skillCheckC = verifySkillInvocation(transcriptPath);
    if (!skillCheckC.invoked) {
      return {
        valid: false,
        reason: 'HARNESS_NOT_INVOKED',
        details: `Arm C Skill invocation missing: ${skillCheckC.detail}`
      };
    }

    // Tier-2: executor artifact proof.
    let gateVerdictFound = false;
    let validGateVerdict = false;
    let hasFingerprint = false;

    // Check direct gate-verdict.json in trial root
    if (fs.existsSync(rootGateVerdict)) {
      gateVerdictFound = true;
      try {
        const parsed = JSON.parse(fs.readFileSync(rootGateVerdict, 'utf8'));
        if (typeof parsed.ready === 'boolean' || typeof parsed.status === 'string' || typeof parsed.verdict === 'string') {
          validGateVerdict = true;
        }
        if (parsed.runtimeFingerprint || parsed.executorVersion === 'lean-v2') {
          hasFingerprint = true;
        }
      } catch (_) {}
    }

    if (fs.existsSync(executorRunsDir)) {
      const entries = fs.readdirSync(executorRunsDir);
      for (const entry of entries) {
        const verdictFile = path.join(executorRunsDir, entry, 'gate-verdict.json');
        if (fs.existsSync(verdictFile)) {
          gateVerdictFound = true;
          try {
            const parsed = JSON.parse(fs.readFileSync(verdictFile, 'utf8'));
            if (typeof parsed.ready === 'boolean' || typeof parsed.status === 'string' || typeof parsed.verdict === 'string') {
              validGateVerdict = true;
              if (parsed.runtimeFingerprint || parsed.executorVersion === 'lean-v2') {
                hasFingerprint = true;
              }
              break;
            }
          } catch (_) {}
        }
      }
    }

    const hasRunLedger = fs.existsSync(runLedgerPath);

    if ((!gateVerdictFound || !validGateVerdict) && !hasRunLedger) {
      return {
        valid: false,
        reason: 'HARNESS_NOT_INVOKED',
        details: 'Arm C failed to produce Lean V2 gate-verdict.json or run-ledger.jsonl'
      };
    }

    // Verify runtimeFingerprint or lean-v2 provenance if telemetry available
    if (!hasFingerprint && fs.existsSync(runTelemetryPath)) {
      try {
        const telem = JSON.parse(fs.readFileSync(runTelemetryPath, 'utf8'));
        if (telem.runtimeFingerprint || telem.run?.runtimeFingerprint || telem.executorVersion === 'lean-v2' || telem.run?.executorVersion === 'lean-v2') {
          hasFingerprint = true;
        }
      } catch (_) {}
    }

    return { valid: true, hasFingerprint };
  }

  return { valid: true };
}

/**
 * Determine agent verdict from execution output, status, and on-disk structured artifacts.
 * Avoids fragile loose regex matching that confuses "Not READY" with READY.
 */
export function determineAgentVerdict(agentExecution, options = {}) {
  if (!agentExecution) return 'UNKNOWN';
  if (agentExecution.timedOut) return 'TIMEOUT';
  if (agentExecution.isError) return 'ERROR';

  const trialDir = typeof options === 'string' ? options : (options.trialDir || agentExecution.trialDir);
  const arm = typeof options === 'object' ? (options.arm || agentExecution.arm) : agentExecution.arm;

  // 1. Structured verdict parsing from disk artifacts for Arm B/C:
  // If gate-verdict.json exists in targetDir, read verdict directly (verdict === 'READY' ? 'READY' : 'BLOCKED')
  if (trialDir) {
    const directVerdict = path.join(trialDir, 'gate-verdict.json');
    if (fs.existsSync(directVerdict)) {
      try {
        const gv = JSON.parse(fs.readFileSync(directVerdict, 'utf8'));
        const rawVerdict = gv.verdict ?? (gv.ready === true ? 'READY' : (gv.ready === false ? 'BLOCKED' : gv.status));
        if (rawVerdict) {
          return rawVerdict === 'READY' ? 'READY' : 'BLOCKED';
        }
      } catch (_) {}
    }

    const runsDir = path.join(trialDir, '.claude', 'executor-runs');
    if (fs.existsSync(runsDir)) {
      try {
        const entries = fs.readdirSync(runsDir);
        for (const entry of entries) {
          const verdictPath = path.join(runsDir, entry, 'gate-verdict.json');
          if (fs.existsSync(verdictPath)) {
            const gv = JSON.parse(fs.readFileSync(verdictPath, 'utf8'));
            const rawVerdict = gv.verdict ?? (gv.ready === true ? 'READY' : (gv.ready === false ? 'BLOCKED' : gv.status));
            if (rawVerdict) {
              return rawVerdict === 'READY' ? 'READY' : 'BLOCKED';
            }
          }
        }
      } catch (_) {}
    }
  }

  // 2. Structured verdict parsing from disk artifacts for Arm B (run-telemetry.json)
  if (trialDir && (arm === 'B' || !arm)) {
    const telemPath = path.join(trialDir, '.claude', 'executor-evals', 'run-telemetry.json');
    if (fs.existsSync(telemPath)) {
      try {
        const telem = JSON.parse(fs.readFileSync(telemPath, 'utf8'));
        const status = telem.final?.status || telem.finalVerdict?.status || telem.run?.finalStatus || telem.finalStatus || telem.verdict;
        if (status === 'READY' || status === 'READY_WITH_KNOWN_ISSUES') {
          return 'READY';
        }
        if (status === 'BLOCKED') {
          return 'BLOCKED';
        }
      } catch (_) {}
    }
  }

  // 3. Structured JSON schema output parsing (e.g. json.benchmarkVerdict)
  const text = agentExecution.output || '';
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object') {
      if (parsed.benchmarkVerdict) return parsed.benchmarkVerdict === 'READY' ? 'READY' : 'BLOCKED';
      if (parsed.verdict) return parsed.verdict === 'READY' ? 'READY' : 'BLOCKED';
      if (parsed.status) return parsed.status === 'READY' ? 'READY' : 'BLOCKED';
    }
  } catch (_) {}

  const jsonBlockMatch = text.match(/\{[\s\S]*?"benchmarkVerdict"\s*:\s*"([^"]+)"[\s\S]*?\}/);
  if (jsonBlockMatch) {
    try {
      const parsedBlock = JSON.parse(jsonBlockMatch[0]);
      if (parsedBlock.benchmarkVerdict) {
        return parsedBlock.benchmarkVerdict === 'READY' ? 'READY' : 'BLOCKED';
      }
    } catch (_) {
      if (jsonBlockMatch[1]) {
        return jsonBlockMatch[1] === 'READY' ? 'READY' : 'BLOCKED';
      }
    }
  }

  // 4. Free-text prose parsing: reject contradictory phrases (e.g. "Not READY", "Unresolved blockers: READY", etc.)
  const isContradictoryOrNegated =
    /(?:not|never|unready|failed to be|cannot claim|is not|not yet)\s+ready/i.test(text) ||
    /unresolved blockers(?:\s*:\s*ready)?/i.test(text) ||
    /blockers?\s*:\s*(?:found|remain|unresolved)/i.test(text) ||
    /\bnot_ready\b/i.test(text) ||
    /(?:has|found|with)\s+\d+\s+blockers?/i.test(text);

  if (isContradictoryOrNegated) {
    return 'BLOCKED';
  }

  const explicitBlockedMatch = text.match(/(?:RELEASE GATE VERDICT|FINAL STATUS|RELEASE STATUS|STATUS|VERDICT)\s*:\s*(BLOCKED)/i);
  if (explicitBlockedMatch) {
    return 'BLOCKED';
  }

  const explicitReadyMatch = text.match(/(?:RELEASE GATE VERDICT|FINAL STATUS|RELEASE STATUS|STATUS|VERDICT)\s*:\s*(READY|READY_WITH_KNOWN_ISSUES)/i);
  if (explicitReadyMatch && !isContradictoryOrNegated) {
    return 'READY';
  }

  if (/LEAN_V2_IMPLEMENTED/i.test(text) && !isContradictoryOrNegated) {
    return 'READY';
  }

  return 'UNKNOWN';
}

/**
 * Grade a trial directory by locating its task-specific grader and comparing with agent verdict.
 */
export async function gradeTrial(taskName, trialDir, tasksBaseDir, agentExecution = null, options = {}) {
  const graderPath = path.join(tasksBaseDir, taskName, 'grader', 'verify.mjs');
  if (!fs.existsSync(graderPath)) {
    throw new Error(`Grader not found at ${graderPath}`);
  }

  const { runGrader } = await import(graderPath);
  const gradeResult = await runGrader(trialDir);

  const arm = options.arm || agentExecution?.arm;
  let treatmentFidelity = true;
  let fidelityReason = null;

  if (arm && !options.skipTreatmentGate) {
    const transcriptPathRel = options.transcriptPath ?? agentExecution?.transcriptPath ?? null;
    const transcriptPath = transcriptPathRel
      ? path.isAbsolute(transcriptPathRel) ? transcriptPathRel : path.resolve(transcriptPathRel)
      : null;
    const fidelity = verifyTreatmentFidelity({ arm, trialDir, transcriptPath });
    if (!fidelity.valid) {
      treatmentFidelity = false;
      fidelityReason = fidelity.reason;
    }
  }

  let agentVerdict = determineAgentVerdict(agentExecution, { trialDir, arm });

  if (!treatmentFidelity) {
    agentVerdict = fidelityReason?.startsWith('CONTAMINATED_ARM_A') ? 'CONTAMINATED_ARM_A' : 'HARNESS_NOT_INVOKED';
    gradeResult.success = false;
    if (!gradeResult.errors) gradeResult.errors = [];
    gradeResult.errors.push(`[Treatment Fidelity Failure] ${fidelityReason}`);
  }

  const graderVerdict = gradeResult.success ? 'PASS' : 'FAIL';
  const falseReady = (agentVerdict === 'READY' && graderVerdict === 'FAIL');

  return {
    ...gradeResult,
    agentVerdict,
    graderVerdict,
    falseReady,
    treatmentFidelity
  };
}

if (process.argv[1] && process.argv[1].endsWith('grade.mjs')) {
  const task = process.argv[2];
  const trialDir = process.argv[3];
  const tasksBaseDir = process.argv[4] || path.join(process.cwd(), 'benchmarks', 'live', 'tasks');

  if (!task || !trialDir) {
    console.error('Usage: node grade.mjs <task-name> <trial-dir> [tasks-base-dir]');
    process.exit(1);
  }

  gradeTrial(task, trialDir, tasksBaseDir)
    .then(res => {
      console.log(JSON.stringify(res, null, 2));
      process.exit(res.success ? 0 : 1);
    })
    .catch(err => {
      console.error('Grading failed:', err);
      process.exit(2);
    });
}
