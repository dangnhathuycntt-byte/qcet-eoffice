import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

function parseFrontmatter(filePath: string): Record<string, any> {
  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const lines = match[1].split('\n');
  const result: Record<string, any> = {};
  let currentKey: string | null = null;
  let currentList: string[] | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (line.startsWith('  - ')) {
      if (currentKey && currentList) {
        currentList.push(trimmed.slice(2).trim());
      }
    } else if (line.includes(':')) {
      if (currentKey && currentList) {
        result[currentKey] = currentList;
        currentList = null;
      }
      const colonIdx = line.indexOf(':');
      const key = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 1).trim();
      if (!val) {
        currentKey = key;
        currentList = [];
      } else {
        currentKey = null;
        if (/^\d+$/.test(val)) {
          result[key] = parseInt(val, 10);
        } else if (val === 'true' || val === 'false') {
          result[key] = val === 'true';
        } else {
          result[key] = val;
        }
      }
    }
  }
  if (currentKey && currentList) {
    result[currentKey] = currentList;
  }
  return result;
}

test('agent-config: qcet-recon policy enforces maxTurns 15, no Bash, read tools', () => {
  const agentPath = path.join(rootDir, '.claude', 'agents', 'qcet-recon.md');
  const fm = parseFrontmatter(agentPath);
  assert.equal(fm.maxTurns, 15);
  const tools = fm.tools || [];
  assert.ok(tools.includes('Read'));
  assert.ok(tools.includes('Grep'));
  assert.ok(tools.includes('Glob'));
  assert.ok(tools.includes('Skill'));
  assert.ok(!tools.includes('Bash'), 'qcet-recon must not have Bash in tools');
});

test('agent-config: qcet-researcher policy enforces maxTurns 12, web/read tools, no Bash', () => {
  const agentPath = path.join(rootDir, '.claude', 'agents', 'qcet-researcher.md');
  const fm = parseFrontmatter(agentPath);
  assert.equal(fm.maxTurns, 12);
  const tools = fm.tools || [];
  assert.ok(tools.includes('WebSearch'));
  assert.ok(tools.includes('WebFetch'));
  assert.ok(tools.includes('Read'));
  assert.ok(tools.includes('Grep'));
  assert.ok(tools.includes('Glob'));
  assert.ok(tools.includes('Skill'));
  assert.ok(!tools.includes('Bash'), 'qcet-researcher must not have Bash in tools');
});

test('agent-config: qcet-skeptic policy enforces maxTurns 20 with Bash and read tools', () => {
  const agentPath = path.join(rootDir, '.claude', 'agents', 'qcet-skeptic.md');
  const fm = parseFrontmatter(agentPath);
  assert.equal(fm.maxTurns, 20);
  const tools = fm.tools || [];
  assert.ok(tools.includes('Read'));
  assert.ok(tools.includes('Grep'));
  assert.ok(tools.includes('Glob'));
  assert.ok(tools.includes('Bash'));
  assert.ok(tools.includes('Skill'));
});

test('agent-config: qcet-builder policy enforces maxTurns 30 and denies web tools', () => {
  const agentPath = path.join(rootDir, '.claude', 'agents', 'qcet-builder.md');
  const fm = parseFrontmatter(agentPath);
  assert.equal(fm.maxTurns, 30);
  const disallowed = fm.disallowedTools || [];
  assert.ok(disallowed.includes('WebSearch'));
  assert.ok(disallowed.includes('WebFetch'));
});

test('agent-config: verifier policy enforces maxTurns 15 and disallows mutation tools', () => {
  const agentPath = path.join(rootDir, '.claude', 'agents', 'verifier.md');
  const fm = parseFrontmatter(agentPath);
  assert.equal(fm.maxTurns, 15);
  const disallowed = fm.disallowedTools || [];
  assert.ok(disallowed.includes('Write'));
  assert.ok(disallowed.includes('Edit'));
});

test('agent-config: qcet-telemetry-recorder enforces maxTurns 4', () => {
  const agentPath = path.join(rootDir, '.claude', 'agents', 'qcet-telemetry-recorder.md');
  const fm = parseFrontmatter(agentPath);
  assert.equal(fm.maxTurns, 4);
});

test('agent-config: settings.json uses portable ${CLAUDE_PROJECT_DIR}/.claude/hooks/ for every hook', () => {
  const settingsPath = path.join(rootDir, '.claude', 'settings.json');
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  const hookGroups = Object.values(settings.hooks || {}) as any[];

  let commandCount = 0;
  for (const group of hookGroups) {
    if (!Array.isArray(group)) continue;
    for (const item of group) {
      if (Array.isArray(item.hooks)) {
        for (const h of item.hooks) {
          if (h.command) {
            commandCount++;
            assert.ok(
              h.command.startsWith('${CLAUDE_PROJECT_DIR}/.claude/hooks/'),
              `Hook command must start with \${CLAUDE_PROJECT_DIR}/.claude/hooks/: ${h.command}`
            );
          }
        }
      }
    }
  }
  assert.ok(commandCount > 0, 'Must have found hook commands to assert');
});
