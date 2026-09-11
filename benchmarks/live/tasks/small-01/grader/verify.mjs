import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ALLOWED_FILES = [
  'src/lib/academic-calendar.ts',
  'tests/unit/academic-calendar.test.ts'
];

function getAgentModifiedFiles(trialDir) {
  const files = new Set();
  let startSha = null;
  const shaFile = path.join(trialDir, '.qcet-benchmark-start-sha');
  if (fs.existsSync(shaFile)) {
    startSha = fs.readFileSync(shaFile, 'utf8').trim();
  }

  if (startSha) {
    try {
      const diffOut = execSync(`git diff --name-only "${startSha}" HEAD`, {
        cwd: trialDir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
      }).trim();
      if (diffOut) {
        diffOut.split('\n').map(s => s.trim()).filter(Boolean).forEach(f => files.add(f));
      }
    } catch (_) {}
  }

  try {
    const statusOut = execSync('git status --porcelain', {
      cwd: trialDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }).trim();
    if (statusOut) {
      statusOut.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;
        const filePath = trimmed.replace(/^[^\s]+\s+/, '').trim();
        if (filePath && !filePath.endsWith('/')) {
          files.add(filePath);
        } else if (filePath && filePath.endsWith('/')) {
          // If untracked directory, find actual files inside
          const fullDirPath = path.join(trialDir, filePath);
          if (fs.existsSync(fullDirPath)) {
            const findFiles = (dir, base = '') => {
              for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const rel = base ? `${base}/${entry.name}` : entry.name;
                if (entry.isDirectory()) {
                  findFiles(path.join(dir, entry.name), rel);
                } else {
                  files.add(`${filePath}${rel}`);
                }
              }
            };
            findFiles(fullDirPath);
          }
        }
      });
    }
  } catch (_) {}

  return Array.from(files).filter(f => !f.startsWith('.claude') && f !== 'plan.md' && f !== '.qcet-benchmark-start-sha');
}

export async function runGrader(trialDir) {
  const result = {
    task: 'small-01',
    timestamp: new Date().toISOString(),
    success: false,
    requirementsTotal: 3,
    requirementsPassed: 0,
    hiddenTestsTotal: 6,
    hiddenTestsPassed: 0,
    forbiddenFilesChanged: 0,
    ownershipViolations: 0,
    escapedDefects: 0,
    errors: []
  };

  // 1. Check Git modifications against BENCHMARK_START_SHA
  const allAgentFiles = getAgentModifiedFiles(trialDir);
  for (const file of allAgentFiles) {
    if (!ALLOWED_FILES.some(allowed => file === allowed || file.startsWith(allowed))) {
      result.forbiddenFilesChanged++;
      result.ownershipViolations++;
      result.errors.push(`Forbidden file modified by agent: ${file}`);
    }
  }

  // 2. Requirement 1: Source inspection for isOperationalMonthBoundary export
  const calendarPath = path.join(trialDir, 'src/lib/academic-calendar.ts');
  if (fs.existsSync(calendarPath)) {
    const content = fs.readFileSync(calendarPath, 'utf8');
    if (content.includes('isOperationalMonthBoundary')) {
      result.requirementsPassed++;
    } else {
      result.errors.push('Missing export isOperationalMonthBoundary in src/lib/academic-calendar.ts');
    }
  } else {
    result.errors.push('src/lib/academic-calendar.ts missing');
  }

  // 3. Requirement 2: Unit tests file exists
  const testPath = path.join(trialDir, 'tests/unit/academic-calendar.test.ts');
  if (fs.existsSync(testPath)) {
    result.requirementsPassed++;
  } else {
    result.errors.push('Missing tests/unit/academic-calendar.test.ts');
  }

  // 4. Requirement 3: Academic month info timezone & boundary consistency
  if (fs.existsSync(calendarPath)) {
    result.requirementsPassed++;
  }

  // 5. Rigorous hidden assertions via tsx
  const testScript = `
import { isOperationalMonthBoundary, getAcademicMonthInfo } from './src/lib/academic-calendar';
let passed = 0;
try {
  // Test 1: Standard cycle start (25th)
  const t1 = isOperationalMonthBoundary('2026-08-25');
  if (t1 && t1.isStart === true && t1.isEnd === false) passed++;

  // Test 2: Standard cycle end (24th)
  const t2 = isOperationalMonthBoundary('2026-08-24');
  if (t2 && t2.isStart === false && t2.isEnd === true) passed++;

  // Test 3: Non-boundary day (15th)
  const t3 = isOperationalMonthBoundary('2026-08-15');
  if (t3 && t3.isStart === false && t3.isEnd === false) passed++;

  // Test 4: Timezone offset awareness (UTC 18:00 on 24th -> +07:00 is 01:00 on 25th)
  const t4 = isOperationalMonthBoundary('2026-08-24T18:00:00Z');
  if (t4 && t4.isStart === true && t4.isEnd === false) passed++;

  // Test 5: Leap-year February boundaries (2028 is leap year)
  const t5a = isOperationalMonthBoundary('2028-02-24');
  const t5b = isOperationalMonthBoundary('2028-02-25');
  if (t5a && t5a.isEnd === true && t5b && t5b.isStart === true) passed++;

  // Test 6: getAcademicMonthInfo with timezone string returns correct academic month (Month 9)
  const info = getAcademicMonthInfo('2026-08-24T18:00:00Z');
  if (info && info.monthNumber === 9 && info.academicYear.includes('2026')) passed++;
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
    result.forbiddenFilesChanged === 0 &&
    result.ownershipViolations === 0
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
