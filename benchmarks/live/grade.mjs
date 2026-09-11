import fs from 'node:fs';
import path from 'node:path';

/**
 * Verify treatment fidelity for benchmark arms.
 * - Arm A: Must NOT produce any QCET executor artifacts (runs or fresh run telemetry).
 * - Arm B: Must produce V1.5 evidence (.claude/executor-evals/run-telemetry.json).
 * - Arm C: Must produce Lean V2 gate-verdict.json and runtimeFingerprint / lean-v2 provenance.
 */
export function verifyTreatmentFidelity(arg1, arg2) {
  let arm, trialDir;
  if (typeof arg1 === 'object' && arg1 !== null && arg1.arm) {
    arm = arg1.arm;
    trialDir = arg1.trialDir;
  } else {
    arm = arg1;
    trialDir = arg2;
  }

  if (!trialDir || !fs.existsSync(trialDir)) {
    return { valid: false, reason: 'Trial directory does not exist' };
  }

  const executorRunsDir = path.join(trialDir, '.claude', 'executor-runs');
  const runTelemetryPath = path.join(trialDir, '.claude', 'executor-evals', 'run-telemetry.json');

  if (arm === 'A') {
    const hasRuns = fs.existsSync(executorRunsDir) && fs.readdirSync(executorRunsDir).filter(f => !f.startsWith('.')).length > 0;
    const hasTelemetry = fs.existsSync(runTelemetryPath);
    if (hasRuns || hasTelemetry) {
      return {
        valid: false,
        reason: 'CONTAMINATED_ARM_A',
        details: 'Arm A produced QCET executor evidence'
      };
    }
    return { valid: true };
  }

  if (arm === 'B') {
    if (!fs.existsSync(runTelemetryPath)) {
      return {
        valid: false,
        reason: 'HARNESS_NOT_INVOKED',
        details: 'Arm B failed to produce V1.5 run telemetry (.claude/executor-evals/run-telemetry.json missing)'
      };
    }
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
    return { valid: true };
  }

  if (arm === 'C') {
    let gateVerdictFound = false;
    let validGateVerdict = false;
    let hasFingerprint = false;

    // Check direct gate-verdict.json in trial root
    const rootGateVerdict = path.join(trialDir, 'gate-verdict.json');
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

    if (!gateVerdictFound || !validGateVerdict) {
      return {
        valid: false,
        reason: 'HARNESS_NOT_INVOKED',
        details: 'Arm C failed to produce Lean V2 gate-verdict.json'
      };
    }

    // Verify runtimeFingerprint or lean-v2 provenance
    if (!hasFingerprint && fs.existsSync(runTelemetryPath)) {
      try {
        const telem = JSON.parse(fs.readFileSync(runTelemetryPath, 'utf8'));
        if (telem.runtimeFingerprint || telem.run?.runtimeFingerprint || telem.executorVersion === 'lean-v2' || telem.run?.executorVersion === 'lean-v2') {
          hasFingerprint = true;
        }
      } catch (_) {}
    }
    if (!hasFingerprint && fs.existsSync(executorRunsDir)) {
      const entries = fs.readdirSync(executorRunsDir);
      for (const entry of entries) {
        const telemFile = path.join(executorRunsDir, entry, 'run-telemetry.json');
        if (fs.existsSync(telemFile)) {
          try {
            const telem = JSON.parse(fs.readFileSync(telemFile, 'utf8'));
            if (telem.runtimeFingerprint || telem.executorVersion === 'lean-v2') {
              hasFingerprint = true;
              break;
            }
          } catch (_) {}
        }
      }
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

  // 1. Structured verdict parsing from disk artifacts for Arm C (Lean V2 gate-verdict.json)
  if (trialDir && (arm === 'C' || !arm)) {
    const directVerdict = path.join(trialDir, 'gate-verdict.json');
    if (fs.existsSync(directVerdict)) {
      try {
        const gv = JSON.parse(fs.readFileSync(directVerdict, 'utf8'));
        if (gv.verdict === 'READY' || gv.ready === true || gv.status === 'READY' || gv.status === 'READY_WITH_KNOWN_ISSUES') {
          return 'READY';
        }
        if (gv.verdict === 'BLOCKED' || gv.ready === false || gv.status === 'BLOCKED') {
          return 'BLOCKED';
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
            if (gv.ready === true || gv.status === 'READY' || gv.status === 'READY_WITH_KNOWN_ISSUES') {
              return 'READY';
            }
            if (gv.ready === false || gv.status === 'BLOCKED') {
              return 'BLOCKED';
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

  // 3. Structured JSON stdout output parsing
  const text = agentExecution.output || '';
  try {
    const parsed = JSON.parse(text);
    if (parsed.status === 'READY' || parsed.verdict === 'READY' || parsed.benchmarkVerdict === 'READY') return 'READY';
    if (parsed.status === 'BLOCKED' || parsed.verdict === 'BLOCKED' || parsed.benchmarkVerdict === 'BLOCKED') return 'BLOCKED';
  } catch (_) {}

  // 4. Free-text parsing with negative assertion protection and strict boundaries
  const isNegatedReady = /(?:not|never|unready|failed to be|cannot claim|is not)\s+ready/i.test(text);
  if (isNegatedReady) {
    return 'BLOCKED';
  }

  const explicitBlockedMatch = text.match(/(?:RELEASE GATE VERDICT|FINAL STATUS|RELEASE STATUS|STATUS|VERDICT)\s*:\s*(BLOCKED)/i);
  if (explicitBlockedMatch) {
    return 'BLOCKED';
  }

  const explicitReadyMatch = text.match(/(?:RELEASE GATE VERDICT|FINAL STATUS|RELEASE STATUS|STATUS|VERDICT)\s*:\s*(READY|READY_WITH_KNOWN_ISSUES)/i);
  if (explicitReadyMatch && !isNegatedReady) {
    return 'READY';
  }

  if (/LEAN_V2_IMPLEMENTED/i.test(text) && !isNegatedReady) {
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
    const fidelity = verifyTreatmentFidelity({ arm, trialDir });
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
