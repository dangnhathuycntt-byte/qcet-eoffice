import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';

const directory = 'src/components/tasks/';
const page = readFileSync(directory + 'task-detail-page.tsx', 'utf8');
const css = postcss.parse(readFileSync(directory + 'task-detail-page.module.css', 'utf8'));

test('panel motion changes only composited visual properties in 160–220ms', () => {
  let reveals = 0;
  css.walkAtRules('keyframes', (rule) => {
    reveals++;
    rule.walkDecls((declaration) => {
      assert.ok(['transform', 'opacity'].includes(declaration.prop));
    });
  });
  assert.ok(reveals > 0);
  css.walkDecls('animation', (declaration) => {
    if (declaration.value === 'none') return;
    const duration = declaration.value.match(/(\d+)ms/);
    assert.ok(duration);
    assert.ok(Number(duration[1]) >= 160 && Number(duration[1]) <= 220);
  });
  css.walkDecls('transition', (declaration) => {
    assert.doesNotMatch(declaration.value, /\b(all|width|max-width|height|margin-left)\b/);
  });
});

test('inspector snaps once without a second Motion owner or delayed exit', () => {
  assert.doesNotMatch(page, /motion\/react|AnimatePresence|<m\./);
  // Inspector now rendered via TaskDetailSplitLayout; verify integration
  assert.match(page, /TaskDetailSplitLayout/);
  // inspector className now in split layout component
  assert.ok(page.includes("inspectorOpen") || page.includes("styles.inspector"));
});

test('reduced motion covers both workspace and sibling drawer', () => {
  const reduced = css.nodes.find((node) => node.type === 'atrule' && node.params === '(prefers-reduced-motion: reduce)');
  assert.ok(reduced && reduced.type === 'atrule');
  const rule = reduced.nodes?.find((node) => node.type === 'rule' && node.selector.includes('.splitWorkspace *'));
  assert.ok(rule && rule.type === 'rule');
  for (const property of ['animation', 'transition']) {
    assert.ok(rule.nodes.some((node) => node.type === 'decl' && node.prop === property && node.value === 'none' && node.important));
  }
});

test('tab rows and drawer menus do not add staggered or nested reveals', () => {
  const rows = readFileSync(directory + 'detail/task-subtasks-section.tsx', 'utf8');
  const drawer = readFileSync(directory + 'detail/subtask-detail-drawer.tsx', 'utf8');
  assert.doesNotMatch(rows, /motion\/react|<m\.|delay:.*idx/);
  assert.doesNotMatch(drawer, /zoom-in|duration-100/);
  assert.match(drawer, /motion-reduce:animate-none/);
  assert.doesNotMatch(css.toString(), /editorReveal/);
});
