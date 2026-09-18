import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { UpdateTaskInputSchema, UpdateTaskMetadataSchema } from '@/contracts/tasks';
import { parseAndValidateJson, MAX_JSON_BODY_SIZE } from '@/server/api/validation';
import { moveBlock, parseContentToBlocks, serializeBlocksToContent } from '@/components/tasks/detail/task-notion-block-content';

const editorPath = 'src/components/tasks/detail/task-notion-block-content.tsx';
const editorSource = ts.createSourceFile(editorPath, readFileSync(editorPath, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

test('editing blocks preserves the row component identity across editor renders', () => {
  const row = editorSource.statements.find((node) =>
    ts.isVariableStatement(node) && node.declarationList.declarations.some((declaration) =>
      declaration.name.getText(editorSource) === 'NotionBlockRow'
    )
  );
  assert.ok(row, 'Block rows must be defined at module scope, not recreated on every keystroke');
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
  const body = { tagName: 'BODY', closest: () => null };
  const code = ts.transpileModule(`(${effect.getText(source)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(code, {
    window: { addEventListener: (_name: string, handler: typeof handleKeyDown) => { handleKeyDown = handler; } },
    document: { activeElement: body, querySelector: () => null },
    handleToggleInspector: () => { toggles += 1; },
    isProgressModalOpen: false,
    selectedSubtaskId: null,
    lastPeekSubtaskIdRef: { current: null },
  })();
  const event = { key: ' ', code: 'Space', target: body, preventDefault: () => { prevented += 1; } };
  handleKeyDown(event);
  assert.equal(toggles, 0);
  assert.equal(prevented, 0);
  handleKeyDown({ ...event, key: 'i', code: 'KeyI', ctrlKey: true });
  assert.equal(toggles, 1);
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

test('autosave waits for persistent media URLs instead of saving blob previews', async () => {
  const timers: Array<() => Promise<void>> = [];
  const saved: string[] = [];
  const scope = {
    debounceTimerRef: { current: null }, lastSavedContentRef: { current: null },
    clearTimeout() {}, setTimeout(callback: () => Promise<void>) { timers.push(callback); return timers.length; },
    setSaveStatus() {}, serializeBlocksToContent, async onSaveContent(content: string) { saved.push(content); },
  };
  const save = editorCallback('triggerAutoSave', scope);
  const image = { id: 'image-1', type: 'image', content: 'anh.png', url: 'blob:temporary-preview' };
  save([image]);
  assert.equal(timers.length, 0, 'A pending FileReader must not schedule a save of its temporary URL');
  save([{ ...image, url: 'data:image/png;base64,aGVsbG8=' }]);
  assert.equal(timers.length, 1);
  await timers[0]();
  assert.equal(saved.length, 1);
  assert.equal(parseContentToBlocks(saved[0])[0].url, 'data:image/png;base64,aGVsbG8=');
});

test('global file drop is scoped and always clears its overlay state', () => {
  const source = readFileSync(editorPath, 'utf8');
  assert.match(source, /if \(!canEdit \|\| !globalFileDrop\) \{/);
  assert.match(source, /window\.addEventListener\("blur", resetGlobalDrag\)/);
  assert.match(source, /onClick=\{resetGlobalDrag\}/);
  assert.match(source, /<DndContext/);
  assert.match(source, /onDragEnd=\{handleBlockDragEnd\}/);
});

test('reordering commits once on drop without mutating the original blocks', () => {
  const blocks = [
    { id: 'first', type: 'text' as const, content: 'Một' },
    { id: 'second', type: 'text' as const, content: 'Hai' },
    { id: 'third', type: 'text' as const, content: 'Ba' },
  ];
  let current = blocks;
  const saves: string[][] = [];
  const dragEnd = editorCallback('handleBlockDragEnd', {
    window: { setTimeout(callback: () => void) { callback(); } },
    isDraggingRef: { current: true },
    setBlocks(update: (previous: typeof blocks) => typeof blocks) { current = update(current); },
    moveBlock,
    triggerAutoSave(next: typeof blocks) { saves.push(next.map((block) => block.id)); },
  });

  dragEnd({ active: { id: 'first' }, over: { id: 'third' } });
  assert.deepEqual(current.map((block) => block.id), ['second', 'third', 'first']);
  assert.deepEqual(blocks.map((block) => block.id), ['first', 'second', 'third']);
  assert.deepEqual(saves, [['second', 'third', 'first']]);
});

function editingScope(contents: string[]) {
  let focused = '';
  class Textarea {
    selectionStart = 0;
    selectionEnd = 0;
    constructor(public id: string, public value: string) {}
    focus() { focused = this.id; }
    scrollIntoView() {}
    setSelectionRange(start: number, end: number) { this.selectionStart = start; this.selectionEnd = end; }
  }
  const blocks = contents.map((content, index) => ({ id: `block-${index}`, type: 'text', content }));
  const inputs = new Map(blocks.map(block => [block.id, new Textarea(block.id, block.content)]));
  const timers: Array<() => void> = [];
  const saved: string[] = [];
  const scope: Record<string, any> = {
    blocks, selected: new Set(), trailingValue: '', pendingFocusBlockIdRef: { current: null }, pendingFocusAtEndRef: { current: false },
    blockInputRefs: { current: inputs },
    blockWrapperRefs: { current: new Map(blocks.map(block => [block.id, { focus() { focused = `wrapper-${block.id}`; } }])) },
    HTMLTextAreaElement: Textarea, HTMLInputElement: class {}, autoResizeTextarea() {},
    setSelectedBlockIds(value: Set<string>) { scope.selected = value; },
    setAnchorBlockId() {}, setActiveContextMenu() {},
    setBlocks(update: (previous: typeof blocks) => typeof blocks) { scope.blocks = update(scope.blocks); },
    setTimeout(callback: () => void) { timers.push(callback); },
    triggerAutoSave(next: typeof blocks) { saved.push(serializeBlocksToContent(next as any)); },
  };
  scope.handleDeleteBlock = editorCallback('handleDeleteBlock', scope);
  return { scope, inputs, saved, focus: () => focused, flushFocus: () => { editorCallback('focusEffect', scope)(); timers.forEach(callback => callback()); } };
}

test('Backspace on an empty lower row leaves the caret at the end of the previous row', () => {
  for (const contents of [['Dòng trên', ''], ['Dòng trên', '', 'Dòng sau']]) {
    const editor = editingScope(contents);
    let prevented = false;
    editorCallback('handleBlockKeyDown', editor.scope)({ key: 'Backspace', nativeEvent: {}, preventDefault() { prevented = true; } }, editor.scope.blocks[1], 1);
    editor.flushFocus();
    const previous = editor.inputs.get('block-0')!;
    assert.ok(prevented);
    assert.equal(editor.scope.blocks.length, contents.length - 1);
    assert.equal(editor.focus(), previous.id, 'A delayed wrapper focus must not steal the caret');
    assert.equal(previous.selectionStart, previous.value.length);
    assert.equal(previous.selectionEnd, previous.value.length);
    assert.equal(editor.scope.selected.size, 0);
  }
});

test('Backspace from the trailing placeholder returns to the previous text end', () => {
  const editor = editingScope(['Dòng trên']);
  editorCallback('handleTrailingKeyDown', editor.scope)({ key: 'Backspace', nativeEvent: {}, preventDefault() {} });
  assert.equal(editor.focus(), 'block-0');
  assert.equal(editor.inputs.get('block-0')!.selectionStart, 'Dòng trên'.length);
  assert.equal(editor.scope.blocks.length, 1);
});

test('deleting the final block persists an empty document', () => {
  const editor = editingScope(['Dòng cuối']);
  editor.scope.handleDeleteBlock('block-0');
  assert.deepEqual(editor.saved, ['']);
});

test('subtask properties match the compact overview density', () => {
  const drawer = readFileSync('src/components/tasks/detail/subtask-detail-drawer.tsx', 'utf8');
  const properties = drawer.match(/<section aria-label="Thuộc tính việc thành phần"[\s\S]*?<\/section>/)?.[0];
  assert.ok(properties);
  assert.match(properties, /className="[^"]*text-xs[^>]*"/);
  assert.ok(!properties.includes('min-h-9'));
  assert.match(properties, /min-h-7/);
});
