import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Sprint 8: Canonical Routing & Legacy Redirects Suite', () => {
  const rootDir = process.cwd();

  test('next.config.ts defines canonical redirects for legacy routes', async () => {
    const configPath = path.join(rootDir, 'next.config.ts');
    assert.ok(fs.existsSync(configPath), 'next.config.ts must exist');
    const configContent = fs.readFileSync(configPath, 'utf8');

    // Must have redirects function
    assert.ok(configContent.includes('redirects'), 'next.config.ts must define redirects');
    assert.ok(configContent.includes('/dashboard'), 'Must redirect /dashboard');
    assert.ok(configContent.includes('/unit-tasks'), 'Must redirect /unit-tasks');
    assert.ok(configContent.includes('/tasks?scope=unit'), 'Must redirect /unit-tasks to /tasks?scope=unit');
    assert.ok(configContent.includes('permanent: true'), 'Redirects must be permanent (308)');
  });

  test('Middleware handles legacy ?zone=* query redirects to canonical paths', async () => {
    const middlewarePath = path.join(rootDir, 'src/middleware.ts');
    assert.ok(fs.existsSync(middlewarePath), 'src/middleware.ts must exist');
    const middlewareContent = fs.readFileSync(middlewarePath, 'utf8');

    assert.ok(middlewareContent.includes('zone'), 'Middleware must intercept zone parameter');
    assert.ok(middlewareContent.includes('/tasks'), 'Middleware must redirect zone=tasks to /tasks');
    assert.ok(middlewareContent.includes('/documents'), 'Middleware must redirect zone=documents to /documents');
    assert.ok(middlewareContent.includes('/calendar'), 'Middleware must redirect zone=calendar to /calendar');
    assert.ok(middlewareContent.includes('/org'), 'Middleware must redirect zone=org to /org');
  });

  test('No active source code generates legacy /?zone= links', async () => {
    // Scan src/ for any href or push with /?zone=
    const scanDir = (dir: string): string[] => {
      const results: string[] = [];
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          if (file !== 'node_modules' && file !== '.next' && file !== '.git') {
            results.push(...scanDir(fullPath));
          }
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
          results.push(fullPath);
        }
      }
      return results;
    };

    const sourceFiles = scanDir(path.join(rootDir, 'src'));
    const matches: { file: string; line: number; text: string }[] = [];

    for (const file of sourceFiles) {
      // Exclude registry definitions of legacy aliases and middleware
      if (file.includes('canonical-navigation-registry.ts') || file.includes('middleware.ts')) {
        continue;
      }
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        // Look for active zone links like href="/?zone=" or href='/?zone=' or push('/?zone=')
        if (
          (line.includes('/?zone=') || line.includes('?zone=')) &&
          !line.includes('//') &&
          !line.includes('/*')
        ) {
          matches.push({ file: path.relative(rootDir, file), line: idx + 1, text: line.trim() });
        }
      });
    }

    assert.equal(
      matches.length,
      0,
      `Found legacy /?zone= links in active source code:\n${matches.map((m) => `${m.file}:${m.line} -> ${m.text}`).join('\n')}`
    );
  });

  test('Canonical primary pages exist in src/app', () => {
    const requiredPages = [
      'src/app/page.tsx',
      'src/app/tasks/page.tsx',
      'src/app/documents/page.tsx',
      'src/app/calendar/page.tsx',
      'src/app/org/page.tsx',
      'src/app/notifications/page.tsx',
      'src/app/settings/page.tsx',
    ];

    for (const page of requiredPages) {
      const fullPath = path.join(rootDir, page);
      assert.ok(fs.existsSync(fullPath), `Canonical page must exist: ${page}`);
    }
  });

  test('Workspaces are unified into canonical task and document workspaces', () => {
    // Unified workspaces must exist
    assert.ok(
      fs.existsSync(path.join(rootDir, 'src/components/tasks/task-workspace.tsx')),
      'Canonical TaskWorkspace must exist'
    );
    assert.ok(
      fs.existsSync(path.join(rootDir, 'src/components/documents/document-workspace.tsx')),
      'Canonical DocumentWorkspace must exist'
    );
    assert.ok(
      fs.existsSync(path.join(rootDir, 'src/components/inbox/action-inbox.tsx')),
      'Canonical ActionInbox V2 must exist'
    );
    assert.ok(
      fs.existsSync(path.join(rootDir, 'src/components/workspace/unified-adaptive-workspace.tsx')),
      'Canonical UnifiedAdaptiveWorkspace must exist'
    );
  });
});
