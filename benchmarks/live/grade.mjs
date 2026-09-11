import fs from 'node:fs';
import path from 'node:path';

/**
 * Grade a trial directory by locating its task-specific grader.
 */
export async function gradeTrial(taskName, trialDir, tasksBaseDir) {
  const graderPath = path.join(tasksBaseDir, taskName, 'grader', 'verify.mjs');
  if (!fs.existsSync(graderPath)) {
    throw new Error(`Grader not found at ${graderPath}`);
  }

  const { runGrader } = await import(graderPath);
  const gradeResult = await runGrader(trialDir);
  return gradeResult;
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
