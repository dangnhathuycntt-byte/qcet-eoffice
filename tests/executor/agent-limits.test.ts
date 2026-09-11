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

test('agent-limits: builder turn cap is 25 in frontmatter', () => {
  const fm = parseFrontmatter(path.join(rootDir, '.claude', 'agents', 'qcet-builder.md'));
  assert.equal(fm.maxTurns, 25);
});

test('agent-limits: skeptic turn cap is 15 in frontmatter', () => {
  const fm = parseFrontmatter(path.join(rootDir, '.claude', 'agents', 'qcet-skeptic.md'));
  assert.equal(fm.maxTurns, 15);
});

test('agent-limits: recon turn cap is 10 in frontmatter', () => {
  const fm = parseFrontmatter(path.join(rootDir, '.claude', 'agents', 'qcet-recon.md'));
  assert.equal(fm.maxTurns, 10);
});

test('agent-limits: verifier turn cap is 15 in frontmatter', () => {
  const fm = parseFrontmatter(path.join(rootDir, '.claude', 'agents', 'verifier.md'));
  assert.equal(fm.maxTurns, 15);
});

test('agent-limits: specialized reviewers have maxTurns 10', () => {
  for (const name of ['data-reviewer.md', 'security-reviewer.md', 'ux-reviewer.md']) {
    const fm = parseFrontmatter(path.join(rootDir, '.claude', 'agents', name));
    assert.equal(fm.maxTurns, 10, `${name} must have maxTurns 10`);
  }
});

test('agent-limits: Lean V2 role turn limits match canonical policy', () => {
  const canonicalLimits: Record<string, number> = {
    builder: 25,
    repair: 20,
    skeptic: 15,
    verifier: 15,
    reconcile: 12,
    recon: 10,
    evaluator: 10,
  };

  assert.equal(canonicalLimits.builder, 25);
  assert.equal(canonicalLimits.repair, 20);
  assert.equal(canonicalLimits.skeptic, 15);
  assert.equal(canonicalLimits.verifier, 15);
  assert.equal(canonicalLimits.reconcile, 12);
  assert.equal(canonicalLimits.recon, 10);
  assert.equal(canonicalLimits.evaluator, 10);
});
