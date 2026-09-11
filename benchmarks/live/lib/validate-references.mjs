import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { prepareTrialDirectory, cleanupTrialDirectory } from './git-harness.mjs';
import { gradeTrial } from '../grade.mjs';

/**
 * Preflight verification: All task reference solutions must pass their graders with 100% success
 * before live trials are allowed to execute.
 */
export async function validateReferenceSolutions({
  tasks,
  workloadBaseSha,
  repoRoot = process.cwd(),
  tasksBaseDir = path.join(repoRoot, 'benchmarks', 'live', 'tasks')
}) {
  const results = [];
  const benchmarkId = `preflight-ref-${Date.now()}`;

  for (const task of tasks) {
    const patchPath = path.join(tasksBaseDir, task, 'reference', 'solution.patch');
    if (!fs.existsSync(patchPath)) {
      throw new Error(`Preflight check failed: reference solution patch missing at ${patchPath}`);
    }

    const trialPrep = await prepareTrialDirectory({
      benchmarkId,
      arm: 'A',
      task,
      trial: 0,
      workloadBaseSha,
      repoRoot
    });

    const { targetDir } = trialPrep;

    try {
      execSync(`git apply --whitespace=nowarn "${patchPath}"`, {
        cwd: targetDir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
      });

      const grade = await gradeTrial(task, targetDir, tasksBaseDir);
      if (!grade.success || grade.escapedDefects > 0 || grade.forbiddenFilesChanged > 0) {
        throw new Error(
          `Task "${task}" reference solution failed grader: ${grade.errors.join('; ')}`
        );
      }

      results.push({ task, success: true, hiddenTestsPassed: grade.hiddenTestsPassed });
    } finally {
      await cleanupTrialDirectory(targetDir);
    }
  }

  return { valid: true, validatedTasks: results };
}
