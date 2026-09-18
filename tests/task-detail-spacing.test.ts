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

test('desktop task columns reserve a real flex gutter of at least 48px', () => {
  assert.equal(declarations('.shell').display, 'flex');
  const gap = declarations('.shellOpen')['column-gap'];
  assert.ok(gap, 'Grid tracks cannot create a gutter in the flex task shell');
  const minimum = /^clamp\((\d+)px,/.exec(gap);
  assert.ok(minimum);
  assert.ok(Number(minimum[1]) >= 48);
});

test('sidebar sections have breathing room without additional shadows', () => {
  const sidebar = declarations(".workspace [data-slot='linear-properties-sidebar']");
  assert.ok(parseFloat(sidebar.gap) >= 16);
  assert.equal(declarations(".workspace [data-slot='linear-properties-sidebar'] > div")['box-shadow'], 'none');
});

test('narrow workspaces stack columns with a vertical gutter', () => {
  const query = css.nodes.find((node) => node.type === 'atrule' && node.name === 'container' && node.params === '(max-width: 1100px)');
  assert.ok(query && query.type === 'atrule');
  const shell = query.nodes?.find((node) => node.type === 'rule' && node.selector === '.shellOpen');
  assert.ok(shell && shell.type === 'rule');
  const values = Object.fromEntries(shell.nodes.filter((node) => node.type === 'decl').map((node) => [node.prop, node.value]));
  assert.equal(values['flex-direction'], 'column');
  assert.ok(parseFloat(values.gap) >= 24);
});

