import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

test('hook-portable: settings.json uses portable ${CLAUDE_PROJECT_DIR}/.claude/hooks/ for every hook command', () => {
  const settingsPath = path.join(rootDir, '.claude', 'settings.json');
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  const hooksConfig = settings.hooks || {};

  let commandCount = 0;
  for (const [hookEvent, matchers] of Object.entries(hooksConfig)) {
    assert.ok(Array.isArray(matchers), `Hook event ${hookEvent} must map to an array`);
    for (const item of matchers as any[]) {
      if (Array.isArray(item.hooks)) {
        for (const h of item.hooks) {
          if (h.command) {
            commandCount++;
            assert.ok(
              h.command.startsWith('${CLAUDE_PROJECT_DIR}/.claude/hooks/'),
              `Hook command must start with \${CLAUDE_PROJECT_DIR}/.claude/hooks/: ${h.command}`
            );
            assert.ok(!h.command.includes('/Users/'), `Hook command must not contain hardcoded user path: ${h.command}`);
            assert.ok(!h.command.includes('/home/'), `Hook command must not contain hardcoded home path: ${h.command}`);

            // Verify file exists on disk
            const relFile = h.command.replace('${CLAUDE_PROJECT_DIR}/', '');
            const targetPath = path.join(rootDir, relFile);
            assert.ok(fs.existsSync(targetPath), `Hook target file must exist: ${targetPath}`);
          }
        }
      }
    }
  }
  assert.ok(commandCount > 0, 'Must have inspected at least one hook command');
});

test('hook-portable: PreToolUse maps Write, Edit, and Bash to ownership guard', () => {
  const settingsPath = path.join(rootDir, '.claude', 'settings.json');
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  const preToolUse = settings.hooks?.PreToolUse || [];

  const ownershipEntry = preToolUse.find((entry: any) =>
    entry.hooks?.some((h: any) => h.command?.includes('pre-tool-use-ownership-guard'))
  );

  assert.ok(ownershipEntry, 'pre-tool-use-ownership-guard must be configured under PreToolUse');
  assert.ok(
    ownershipEntry.matcher === 'Write|Edit|Bash' ||
      (ownershipEntry.matcher.includes('Write') &&
        ownershipEntry.matcher.includes('Edit') &&
        ownershipEntry.matcher.includes('Bash')),
    `Matcher must cover Write, Edit, Bash: got ${ownershipEntry.matcher}`
  );
});
