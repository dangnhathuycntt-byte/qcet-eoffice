import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ALLOWED_FILES = [
  'src/lib/academic-calendar.ts',
  'tests/unit/academic-calendar.test.ts'
];

export async function runGrader(trialDir) {
  const result = {
    task: 'small-01',
    timestamp: new Date().toISOString(),
    success: false,
    requirementsTotal: 2,
    requirementsPassed: 0,
    hiddenTestsTotal: 3,
    hiddenTestsPassed: 0,
    forbiddenFilesChanged: 0,
    ownershipViolations: 0,
    escapedDefects: 0,
    errors: []
  };

  // 1. Check Git Status for modified / untracked files
  try {
    const gitStatus = execSync('git status --porcelain', {
      cwd: trialDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }).trim();

    const changedFiles = gitStatus
      .split('\n')
      .map(line => line.trim().slice(3).trim())
      .filter(Boolean);

    for (const file of changedFiles) {
      if (!ALLOWED_FILES.some(allowed => file === allowed || file.startsWith(allowed))) {
        result.forbiddenFilesChanged++;
        result.ownershipViolations++;
        result.errors.push(`Forbidden file modified or created: ${file}`);
      }
    }
  } catch (err) {
    result.errors.push(`Git status inspection failed: ${err.message}`);
  }

  // 2. Requirement 1 & 2 Verification
  const calendarPath = path.join(trialDir, 'src/lib/academic-calendar.ts');
  if (!fs.existsSync(calendarPath)) {
    result.errors.push('src/lib/academic-calendar.ts not found');
    result.escapedDefects = result.hiddenTestsTotal;
    return result;
  }

  const calendarSource = fs.readFileSync(calendarPath, 'utf8');

  // Check Requirement 2: export isOperationalMonthBoundary
  if (calendarSource.includes('isOperationalMonthBoundary')) {
    result.requirementsPassed++;
  } else {
    result.errors.push('Missing required export isOperationalMonthBoundary in src/lib/academic-calendar.ts');
  }

  // Check Requirement 1: Boundary & Timezone safety
  if (calendarSource.includes('25') && calendarSource.includes('24')) {
    result.requirementsPassed++;
  } else {
    result.errors.push('Incomplete boundary logic for day 25/24 transitions');
  }

  // 3. Hidden Grader Functional Assertions via tsx
  const testScript = `
import { isOperationalMonthBoundary } from './src/lib/academic-calendar';
let passed = 0;
try {
  if (typeof isOperationalMonthBoundary === 'function') {
    const b1 = isOperationalMonthBoundary('2026-08-25');
    if (b1 && b1.isStart === true) passed++;
    const b2 = isOperationalMonthBoundary('2026-08-24');
    if (b2 && b2.isEnd === true) passed++;
    const b3 = isOperationalMonthBoundary('2026-08-15');
    if (b3 && b3.isStart === false && b3.isEnd === false) passed++;
  }
} catch (e) {
  process.stderr.write(String(e));
}
process.stdout.write(String(passed));
`;

  try {
    const output = execSync(`npx tsx -e "${testScript.replace(/"/g, '\\"')}"`, {
      cwd: trialDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }).trim();

    result.hiddenTestsPassed = parseInt(output || '0', 10);
  } catch (err) {
    result.errors.push(`Hidden test execution failed: ${err.message}`);
  }

  if (result.hiddenTestsPassed < result.hiddenTestsTotal) {
    result.escapedDefects += (result.hiddenTestsTotal - result.hiddenTestsPassed);
  }

  result.success = (
    result.requirementsPassed === result.requirementsTotal &&
    result.hiddenTestsPassed === result.hiddenTestsTotal &&
    result.forbiddenFilesChanged === 0
  );

  return result;
}

if (process.argv[1] && process.argv[1].endsWith('verify.mjs')) {
  const trialDir = process.argv[2] || process.cwd();
  runGrader(trialDir)
    .then(res => {
      console.log(JSON.stringify(res, null, 2));
      process.exit(res.success ? 0 : 1);
    })
    .catch(err => {
      console.error(err);
      process.exit(2);
    });
}
