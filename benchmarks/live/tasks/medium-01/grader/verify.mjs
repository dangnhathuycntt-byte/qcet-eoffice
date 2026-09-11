import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ALLOWED_FILES = [
  'src/contracts/meeting.ts',
  'src/lib/services/meeting-service.ts',
  'tests/unit/meeting.test.ts'
];

export async function runGrader(trialDir) {
  const result = {
    task: 'medium-01',
    timestamp: new Date().toISOString(),
    success: false,
    requirementsTotal: 3,
    requirementsPassed: 0,
    hiddenTestsTotal: 3,
    hiddenTestsPassed: 0,
    forbiddenFilesChanged: 0,
    ownershipViolations: 0,
    escapedDefects: 0,
    errors: []
  };

  // 1. Check Git Status for forbidden modifications
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
        result.errors.push(`Forbidden file modified: ${file}`);
      }
    }
  } catch (err) {
    result.errors.push(`Git status inspection failed: ${err.message}`);
  }

  // 2. Requirement 1: VerifyAttendanceSchema
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

  // 3. Requirement 2: validateMeetingQuorum
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
let passed = 0;
try {
  const parsed = VerifyAttendanceSchema.safeParse({
    meetingId: 'm1',
    participantId: 'p1',
    status: 'PRESENT',
    verifiedAt: new Date().toISOString(),
    verifiedBy: 'u1'
  });
  if (parsed.success) passed++;
  const invalid = VerifyAttendanceSchema.safeParse({ meetingId: '' });
  if (!invalid.success) passed++;
  passed++;
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
