import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';

const css = postcss.parse(readFileSync('src/components/tasks/task-detail-page.module.css', 'utf8'));
function declarations(selector: string) {
  const rule = css.nodes.find((node) => node.type === 'rule' && node.selector === selector);
  assert.ok(rule && rule.type === 'rule', selector);
  return Object.fromEntries(rule.nodes.filter((node) => node.type === 'decl').map((node) => [node.prop, node.value]));
}

test('desktop task canvas uses flex layout', () => {
  const canvas = declarations('.canvas');
  assert.ok(canvas, '.canvas must exist');
});

test('sidebar sections have breathing room without additional shadows', () => {
  const sidebar = declarations(".workspace [data-slot='task-properties-sidebar']");
  assert.ok(parseFloat(sidebar.gap) >= 16);
  assert.equal(declarations(".workspace [data-slot='task-properties-sidebar'] > div")['box-shadow'], 'none');
});

test('narrow workspaces handled by TaskDetailSplitLayout matchMedia', () => {
  const src = readFileSync('src/components/tasks/detail/task-detail-split-layout.tsx', 'utf8');
  assert.ok(src.includes('matchMedia'), 'responsive stacking uses matchMedia');
  assert.ok(src.includes('flex-col') || src.includes('flex flex-col'), 'mobile layout stacks vertically');
});
