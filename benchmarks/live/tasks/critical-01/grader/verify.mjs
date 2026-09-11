import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ALLOWED_FILES = [
  'src/contracts/documents.ts',
  'src/lib/auth/document-clearance.ts',
  'tests/unit/document-clearance.test.ts'
];

export async function runGrader(trialDir) {
  const result = {
    task: 'critical-01',
    timestamp: new Date().toISOString(),
    success: false,
    requirementsTotal: 3,
    requirementsPassed: 0,
    hiddenTestsTotal: 4,
    hiddenTestsPassed: 0,
    forbiddenFilesChanged: 0,
    ownershipViolations: 0,
    escapedDefects: 0,
    errors: []
  };

  // 1. Check Git Status for unauthorized changes
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

  // 2. Requirement 1: Document clearance module exists
  const clearancePath = path.join(trialDir, 'src/lib/auth/document-clearance.ts');
  if (fs.existsSync(clearancePath)) {
    const content = fs.readFileSync(clearancePath, 'utf8');
    if (content.includes('assertDocumentReadAccess')) {
      result.requirementsPassed++;
    } else {
      result.errors.push('assertDocumentReadAccess missing in src/lib/auth/document-clearance.ts');
    }
  } else {
    result.errors.push('src/lib/auth/document-clearance.ts missing');
  }

  // 3. Requirement 2: Strict statutory check
  if (fs.existsSync(clearancePath)) {
    const content = fs.readFileSync(clearancePath, 'utf8');
    if (content.includes('TUYET_MAT') && content.includes('TOI_MAT')) {
      result.requirementsPassed++;
    } else {
      result.errors.push('Classification levels not properly evaluated in clearance checks');
    }
  }

  // 4. Requirement 3: Adversarial test suite
  const testPath = path.join(trialDir, 'tests/unit/document-clearance.test.ts');
  if (fs.existsSync(testPath)) {
    result.requirementsPassed++;
  } else {
    result.errors.push('Missing tests/unit/document-clearance.test.ts');
  }

  // 5. Hidden adversarial tests via tsx
  const testScript = `
import { assertDocumentReadAccess } from './src/lib/auth/document-clearance';
let passed = 0;
try {
  // Test 1: Inactive user rejected
  const r1 = assertDocumentReadAccess({
    user: { id: 'u1', role: 'HIEU_TRUONG', isActive: false },
    document: { id: 'd1', securityLevel: 'THUONG' }
  });
  if (r1.allowed === false) passed++;

  // Test 2: Regular staff accessing TUYET_MAT rejected
  const r2 = assertDocumentReadAccess({
    user: { id: 'u2', role: 'CHUYEN_VIEN', isActive: true },
    document: { id: 'd2', securityLevel: 'TUYET_MAT' }
  });
  if (r2.allowed === false) passed++;

  // Test 3: Hiệu trưởng accessing TUYET_MAT allowed
  const r3 = assertDocumentReadAccess({
    user: { id: 'u3', role: 'HIEU_TRUONG', isActive: true },
    document: { id: 'd3', securityLevel: 'TUYET_MAT' }
  });
  if (r3.allowed === true) passed++;

  // Test 4: Scope masquerading attempt rejected
  const r4 = assertDocumentReadAccess({
    user: { id: 'u4', role: 'CHUYEN_VIEN', isActive: true, requestedScope: 'SCHOOL' },
    document: { id: 'd4', securityLevel: 'TOI_MAT' }
  });
  if (r4.allowed === false) passed++;
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
    result.errors.push(`Hidden security assertions failed: ${err.message}`);
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
