import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ALLOWED_FILES = [
  'src/contracts/meeting.ts',
  'src/lib/services/meeting-service.ts',
  'tests/unit/meeting.test.ts'
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
    task: 'medium-01',
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

  // 1. Check Git Status / Diff against BENCHMARK_START_SHA for forbidden modifications
  const allAgentFiles = getAgentModifiedFiles(trialDir);
  for (const file of allAgentFiles) {
    if (!ALLOWED_FILES.some(allowed => file === allowed || file.startsWith(allowed))) {
      result.forbiddenFilesChanged++;
      result.ownershipViolations++;
      result.errors.push(`Forbidden file modified by agent: ${file}`);
    }
  }

  // 2. Requirement 1: VerifyAttendanceSchema in src/contracts/meeting.ts
  const meetingContractPath = path.join(trialDir, 'src/contracts/meeting.ts');
  if (fs.existsSync(meetingContractPath)) {
    const content = fs.readFileSync(meetingContractPath, 'utf8');
    if (content.includes('VerifyAttendanceSchema')) {
      result.requirementsPassed++;
    } else {
      result.errors.push('Missing VerifyAttendanceSchema in src/contracts/meeting.ts');
    }
  } else {
    result.errors.push('src/contracts/meeting.ts missing');
  }

  // 3. Requirement 2: validateMeetingQuorum in src/lib/services/meeting-service.ts
  const meetingServicePath = path.join(trialDir, 'src/lib/services/meeting-service.ts');
  if (fs.existsSync(meetingServicePath)) {
    const content = fs.readFileSync(meetingServicePath, 'utf8');
    if (content.includes('validateMeetingQuorum')) {
      result.requirementsPassed++;
    } else {
      result.errors.push('Missing validateMeetingQuorum in src/lib/services/meeting-service.ts');
    }
  } else {
    result.errors.push('src/lib/services/meeting-service.ts missing');
  }

  // 4. Requirement 3: Unit tests
  const testPath = path.join(trialDir, 'tests/unit/meeting.test.ts');
  if (fs.existsSync(testPath)) {
    result.requirementsPassed++;
  } else {
    result.errors.push('Missing tests/unit/meeting.test.ts');
  }

  // 5. Hidden assertions via tsx
  const testScript = `
import { VerifyAttendanceSchema } from './src/contracts/meeting';
import { validateMeetingQuorum } from './src/lib/services/meeting-service';
let passed = 0;
try {
  // Test 1: VerifyAttendanceSchema valid parsing
  const parsed = VerifyAttendanceSchema.safeParse({
    meetingId: 'm1',
    participantId: 'p1',
    status: 'PRESENT',
    verifiedAt: new Date().toISOString(),
    verifiedBy: 'u1'
  });
  if (parsed.success) passed++;

  // Test 2: VerifyAttendanceSchema rejects missing participant
  const invalid = VerifyAttendanceSchema.safeParse({ meetingId: 'm1' });
  if (!invalid.success) passed++;

  // Test 3: Quorum meets >= 50% threshold (1 present, 1 absent -> 50%)
  const q1 = validateMeetingQuorum('m1', [
    { id: 'p1', status: 'PRESENT' },
    { id: 'p2', status: 'ABSENT' }
  ]);
  if (q1 && q1.hasQuorum === true && Math.abs(q1.ratio - 0.5) < 0.01) passed++;

  // Test 4: Quorum rejects < 50% threshold (1 present, 2 absent -> 33.3%)
  const q2 = validateMeetingQuorum('m2', [
    { id: 'p1', status: 'PRESENT' },
    { id: 'p2', status: 'ABSENT' },
    { id: 'p3', status: 'ABSENT' }
  ]);
  if (q2 && q2.hasQuorum === false && q2.ratio < 0.5) passed++;

  // Test 5: Quorum treats EXCUSED as attending for quorum calculation (1 excused, 1 absent -> 50%)
  const q3 = validateMeetingQuorum('m3', [
    { id: 'p1', status: 'EXCUSED' },
    { id: 'p2', status: 'ABSENT' }
  ]);
  if (q3 && q3.hasQuorum === true) passed++;

  // Test 6: Empty participants returns hasQuorum = false
  const q4 = validateMeetingQuorum('m4', []);
  if (q4 && q4.hasQuorum === false) passed++;
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
