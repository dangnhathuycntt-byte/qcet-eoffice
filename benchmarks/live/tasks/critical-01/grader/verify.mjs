import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ALLOWED_FILES = [
  'src/contracts/documents.ts',
  'src/lib/auth/document-clearance.ts',
  'tests/unit/document-clearance.test.ts'
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
    task: 'critical-01',
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

  // 2. Requirement 1: DocumentSecurityLevelSchema
  const docContractPath = path.join(trialDir, 'src/contracts/documents.ts');
  if (fs.existsSync(docContractPath)) {
    const content = fs.readFileSync(docContractPath, 'utf8');
    if (content.includes('DocumentSecurityLevelSchema')) {
      result.requirementsPassed++;
    } else {
      result.errors.push('Missing DocumentSecurityLevelSchema in src/contracts/documents.ts');
    }
  } else {
    result.errors.push('src/contracts/documents.ts missing');
  }

  // 3. Requirement 2: assertDocumentReadAccess
  const clearancePath = path.join(trialDir, 'src/lib/auth/document-clearance.ts');
  if (fs.existsSync(clearancePath)) {
    const content = fs.readFileSync(clearancePath, 'utf8');
    if (content.includes('assertDocumentReadAccess')) {
      result.requirementsPassed++;
    } else {
      result.errors.push('Missing assertDocumentReadAccess in src/lib/auth/document-clearance.ts');
    }
  } else {
    result.errors.push('src/lib/auth/document-clearance.ts missing');
  }

  // 4. Requirement 3: Unit tests
  const testPath = path.join(trialDir, 'tests/unit/document-clearance.test.ts');
  if (fs.existsSync(testPath)) {
    result.requirementsPassed++;
  } else {
    result.errors.push('Missing tests/unit/document-clearance.test.ts');
  }

  // 5. Rigorous adversarial hidden assertions via tsx
  const testScript = `
import { DocumentSecurityLevelSchema } from './src/contracts/documents';
import { assertDocumentReadAccess } from './src/lib/auth/document-clearance';
let passed = 0;
try {
  // Test 1: Schema validation
  const s1 = DocumentSecurityLevelSchema.safeParse('TUYET_MAT');
  const s2 = DocumentSecurityLevelSchema.safeParse('FORGED_LEVEL');
  if (s1.success && !s2.success) passed++;

  // Test 2: Inactive user unconditionally rejected (even if HIEU_TRUONG)
  const rInactive = assertDocumentReadAccess({
    user: { id: 'u1', role: 'HIEU_TRUONG', isActive: false },
    document: { id: 'd1', securityLevel: 'THUONG' }
  });
  if (rInactive && rInactive.allowed === false) passed++;

  // Test 3: Standard staff (CHUYEN_VIEN) rejected from MAT document
  const rStaffMat = assertDocumentReadAccess({
    user: { id: 'u2', role: 'CHUYEN_VIEN', isActive: true },
    document: { id: 'd2', securityLevel: 'MAT' }
  });
  if (rStaffMat && rStaffMat.allowed === false) passed++;

  // Test 4: Scope spoofing defense - requesting SCHOOL scope does NOT elevate staff clearance
  const rScopeSpoof = assertDocumentReadAccess({
    user: { id: 'u2', role: 'CHUYEN_VIEN', isActive: true },
    document: { id: 'd3', securityLevel: 'TOI_MAT' },
    scope: 'SCHOOL'
  });
  if (rScopeSpoof && rScopeSpoof.allowed === false) passed++;

  // Test 5: Unit department head (TRUONG_PHONG) permitted for MAT
  const rDeptHead = assertDocumentReadAccess({
    user: { id: 'u3', role: 'TRUONG_PHONG', isActive: true },
    document: { id: 'd2', securityLevel: 'MAT' }
  });
  if (rDeptHead && rDeptHead.allowed === true) passed++;

  // Test 6: Institutional Head (HIEU_TRUONG) permitted for TUYET_MAT
  const rPrincipal = assertDocumentReadAccess({
    user: { id: 'u1', role: 'HIEU_TRUONG', isActive: true },
    document: { id: 'd4', securityLevel: 'TUYET_MAT' }
  });
  if (rPrincipal && rPrincipal.allowed === true) passed++;
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
