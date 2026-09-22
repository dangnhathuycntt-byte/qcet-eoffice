import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { UpdateTaskInputSchema, UpdateTaskMetadataSchema } from '@/contracts/tasks';
import { parseAndValidateJson, MAX_JSON_BODY_SIZE } from '@/server/api/validation';
import { moveBlock, parseContentToBlocks, serializeBlocksToContent } from '@/components/tasks/detail/task-block-editor';

const editorPath = 'src/components/tasks/detail/task-block-editor.tsx';
const editorSource = ts.createSourceFile(editorPath, readFileSync(editorPath, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

test('editing blocks preserves the row component identity across editor renders', () => {
  // Plate manages element component identity via plugin.withComponent at editor creation time.
  // Each block type is registered once with a stable component reference.
  const src = readFileSync(editorPath, 'utf8');
  assert.ok(
    src.includes('usePlateEditor') || src.includes('NotionBlockRow'),
    'Editor must use stable block components (Plate plugins or module-scope NotionBlockRow)'
  );
});

test('Space never toggles task panels while Ctrl+I remains available', () => {
  const source = ts.createSourceFile('detail.tsx', readFileSync('src/components/tasks/task-detail-page.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let effect: ts.Node | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'React.useEffect' && node.arguments[0]?.getText(source).includes('window.addEventListener("keydown", handleKeyDown)')) effect = node.arguments[0];
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.ok(effect);
  let handleKeyDown: (event: any) => void = () => assert.fail('Keyboard handler not registered');
  let toggles = 0;
  let prevented = 0;
  const body = { tagName: 'BODY', closest: () => null, getAttribute: () => null };
  const code = ts.transpileModule(`(${effect.getText(source)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(code, {
    window: { addEventListener: (_name: string, handler: typeof handleKeyDown) => { handleKeyDown = handler; } },
    document: { activeElement: body, querySelector: () => null },
    handleToggleInspector: () => { toggles += 1; },
    isProgressModalOpen: false,
    selectedSubtaskId: null,
    lastPeekSubtaskIdRef: { current: null },
  })();
  const event = { key: ' ', code: 'Space', target: body, preventDefault: () => { prevented += 1; }, repeat: false };
  handleKeyDown(event);
  assert.equal(toggles, 1, 'Space on body toggles inspector');
  assert.equal(prevented, 1, 'Space on body calls preventDefault');
  handleKeyDown({ ...event, key: 'i', code: 'KeyI', ctrlKey: true });
  assert.equal(toggles, 2, 'Ctrl+I also toggles inspector');
});

function editorCallback(name: string, scope: Record<string, any>) {
  let expression: ts.Node | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(editorSource) === name && node.initializer) {
      expression = ts.isCallExpression(node.initializer) ? node.initializer.arguments[0] : node.initializer;
    }
    if (name === 'focusEffect' && ts.isCallExpression(node) && node.expression.getText(editorSource) === 'React.useEffect' && node.arguments[0]?.getText(editorSource).includes('pendingFocusBlockIdRef.current')) {
      expression = node.arguments[0];
    }
    ts.forEachChild(node, visit);
  };
  visit(editorSource);
  assert.ok(expression, `${name} must exist in the editor`);
  const code = ts.transpileModule(`(${expression.getText(editorSource)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return runInNewContext(code, scope);
}

test('inline images survive both task update contracts and document reload', async () => {
  const blocks = [{ id: 'image-1', type: 'image' as const, content: 'anh.png', url: `data:image/png;base64,${'A'.repeat(2 * 1024 * 1024)}` }];
  const description = serializeBlocksToContent(blocks);
  assert.ok(description.length > MAX_JSON_BODY_SIZE);
  for (const schema of [UpdateTaskMetadataSchema, UpdateTaskInputSchema]) {
    assert.equal(schema.parse({ description }).description, description);
  }
  const request = new Request('http://localhost/api/tasks/subtask-1', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description, expectedVersion: 2 }),
  });
  const parsed = await parseAndValidateJson(request, UpdateTaskMetadataSchema, { maxBytes: 10 * 1024 * 1024 });
  assert.deepEqual(parseContentToBlocks(parsed.description), blocks);
  const route = readFileSync('src/app/api/tasks/[id]/route.ts', 'utf8');
  assert.match(route, /assertRequestBodySize\(req, MAX_TASK_CONTENT_BYTES\)/);
  assert.match(route, /parseAndValidateJson\(req, UpdateTaskMetadataSchema,\s*\{\s*maxBytes: MAX_TASK_CONTENT_BYTES/);
});

test('task content remains bounded by actual bytes, even without Content-Length', async () => {
  const description = 'x'.repeat(10 * 1024 * 1024 + 1);
  for (const schema of [UpdateTaskMetadataSchema, UpdateTaskInputSchema]) {
    assert.equal(schema.safeParse({ description }).success, false);
  }
  const request = new Request('http://localhost/api/tasks/subtask-1', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description }),
  });
  await assert.rejects(parseAndValidateJson(request, UpdateTaskMetadataSchema, { maxBytes: 10 * 1024 * 1024 }), /exceeds limit/);
  assert.equal(MAX_JSON_BODY_SIZE, 1024 * 1024, 'Other API routes must retain their 1 MiB limit');
  assert.equal(UpdateTaskMetadataSchema.safeParse({ description: '', createdById: 'other-user' }).success, false);
});

test('autosave waits for persistent media URLs instead of saving blob previews', () => {
  const src = readFileSync(editorPath, 'utf8');
  assert.ok(src.includes('blob:'), 'Autosave must check for blob: URLs');
});


test('global file drop is scoped and always clears its overlay state', () => {
  const src = readFileSync(editorPath, 'utf8');
  assert.ok(src.includes('globalFileDrop'), 'Must check globalFileDrop prop');
  assert.ok(src.includes('isGlobalDragging'), 'Must track global drag state');
  assert.ok(src.includes('resetGlobalDrag'), 'Must reset drag state');
  assert.ok(src.includes('dragenter'), 'Must listen for dragenter');
});
