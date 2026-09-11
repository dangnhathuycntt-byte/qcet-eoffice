import fs from 'node:fs';
import path from 'node:path';

/**
 * Determine agent verdict from execution output and status.
 */
export function determineAgentVerdict(agentExecution) {
  if (!agentExecution) return 'UNKNOWN';
  if (agentExecution.timedOut) return 'TIMEOUT';
  if (agentExecution.isError) return 'ERROR';

  const text = agentExecution.output || '';
  if (/RELEASE GATE VERDICT:\s*READY|Final status:\s*READY|STATUS:\s*READY|\bREADY\b|LEAN_V2_IMPLEMENTED/i.test(text)) {
    return 'READY';
  }
  if (/RELEASE GATE VERDICT:\s*BLOCKED|Final status:\s*BLOCKED|STATUS:\s*BLOCKED|\bBLOCKED\b/i.test(text)) {
    return 'BLOCKED';
  }
  return 'UNKNOWN';
}

/**
 * Grade a trial directory by locating its task-specific grader and comparing with agent verdict.
 */
export async function gradeTrial(taskName, trialDir, tasksBaseDir, agentExecution = null) {
  const graderPath = path.join(tasksBaseDir, taskName, 'grader', 'verify.mjs');
  if (!fs.existsSync(graderPath)) {
    throw new Error(`Grader not found at ${graderPath}`);
  }

  const { runGrader } = await import(graderPath);
  const gradeResult = await runGrader(trialDir);

  const agentVerdict = determineAgentVerdict(agentExecution);
  const graderVerdict = gradeResult.success ? 'PASS' : 'FAIL';
  const falseReady = (agentVerdict === 'READY' && graderVerdict === 'FAIL');

  return {
    ...gradeResult,
    agentVerdict,
    graderVerdict,
    falseReady
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
