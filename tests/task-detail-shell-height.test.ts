import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import ts from "typescript";

// Source-level contract only: browser geometry and real scroll behaviour must be checked in the running app.

const shellPath = path.resolve("src/components/layout/app-shell.tsx");
const shellSource = ts.createSourceFile(shellPath, readFileSync(shellPath, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function findOpeningElement(match: (node: ts.JsxOpeningElement) => boolean): ts.JsxOpeningElement {
  let found: ts.JsxOpeningElement | undefined;
  const visit = (node: ts.Node): void => {
    if (!found && ts.isJsxOpeningElement(node) && match(node)) found = node;
    ts.forEachChild(node, visit);
  };
  visit(shellSource);
  assert.ok(found, "JSX element not found in app-shell.tsx");
  return found;
}

function findConditional(match: (node: ts.ConditionalExpression) => boolean): ts.ConditionalExpression {
  let found: ts.ConditionalExpression | undefined;
  const visit = (node: ts.Node): void => {
    if (!found && ts.isConditionalExpression(node) && match(node)) found = node;
    ts.forEachChild(node, visit);
  };
  visit(shellSource);
  assert.ok(found, "conditional not found in app-shell.tsx");
  return found;
}

function classNameExpression(element: ts.JsxOpeningElement): ts.Expression {
  const attr = element.attributes.properties.find(
    (prop): prop is ts.JsxAttribute => ts.isJsxAttribute(prop) && prop.name.getText(shellSource) === "className"
  );
  assert.ok(attr?.initializer && ts.isJsxExpression(attr.initializer) && attr.initializer.expression, "className expression missing");
  return attr.initializer.expression;
}

function branchText(node: ts.Expression): string {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ? node.text : node.getText(shellSource);
}

const isTaskDetailBranch = (node: ts.ConditionalExpression) =>
  ts.isIdentifier(node.condition) && node.condition.text === "isTaskDetail";

// The element AppShellInner actually returns (its last top-level return; early returns sit inside if-blocks).
function returnedRootOpening(): ts.JsxOpeningElement {
  let inner: ts.FunctionDeclaration | undefined;
  shellSource.forEachChild((node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "AppShellInner") inner = node;
  });
  assert.ok(inner?.body, "AppShellInner not found in app-shell.tsx");
  let expression = inner.body.statements.filter(ts.isReturnStatement).pop()?.expression;
  while (expression && ts.isParenthesizedExpression(expression)) expression = expression.expression;
  assert.ok(expression && ts.isJsxElement(expression), "AppShellInner must return a JSX root");
  return expression.openingElement;
}

test("returned app shell root is definite on task detail and min-height elsewhere", () => {
  const root = returnedRootOpening();
  const className = classNameExpression(root);
  assert.ok(ts.isCallExpression(className) && className.expression.getText(shellSource) === "cn", "root className must be built with cn");
  const [staticClasses, branch] = className.arguments;
  assert.ok(staticClasses && ts.isStringLiteral(staticClasses) && staticClasses.text.includes("md:flex-row"), "static root classes must be the shell root");
  assert.ok(!staticClasses.text.split(/\s+/).some((cls) => cls.startsWith("min-h-") || cls.startsWith("h-")), "static root classes must not set a height");
  assert.ok(branch && ts.isConditionalExpression(branch) && isTaskDetailBranch(branch), "root height must branch on isTaskDetail");
  assert.equal(branchText(branch.whenTrue), "h-[100dvh]");
  assert.equal(branchText(branch.whenFalse), "min-h-[100dvh]", "other routes keep the minimum-height shell");
});

test("task detail main column wrapper fills the remaining height instead of growing", () => {
  const wrapper = findOpeningElement((node) => node.tagName.getText(shellSource) === "m.div");
  const branch = classNameExpression(wrapper);
  assert.ok(ts.isConditionalExpression(branch) && isTaskDetailBranch(branch), "wrapper className must branch on isTaskDetail");
  const classes = branchText(branch.whenTrue).split(/\s+/);
  assert.ok(classes.includes("min-h-0"), "task detail wrapper must allow shrinking");
  assert.ok(classes.includes("flex-1"), "task detail wrapper must take the remaining height");
  assert.ok(!branchText(branch.whenTrue).includes("min-h-[100dvh]"), "task detail wrapper must not force 100dvh minimum");
});

test("task detail main panel sizes by flex, keeping overflow contained", () => {
  const main = findOpeningElement((node) =>
    node.attributes.properties.some((prop) =>
      ts.isJsxAttribute(prop) && prop.name.getText(shellSource) === "id" && prop.initializer?.getText(shellSource) === "\"main-content\""
    )
  );
  const branch = classNameExpression(main);
  assert.ok(ts.isConditionalExpression(branch) && isTaskDetailBranch(branch), "main className must branch on isTaskDetail");
  const classes = branchText(branch.whenTrue).split(/\s+/);
  assert.ok(classes.includes("flex-1"), "main must grow into the remaining height");
  assert.ok(classes.includes("min-h-0"), "main must be allowed to shrink below its content");
  assert.ok(classes.includes("overflow-hidden"), "main must contain overflow");
  assert.ok(!classes.some((cls) => cls.startsWith("h-[")), "main must not use a fixed calc height that ignores banners");
  assert.ok(!classes.some((cls) => cls.startsWith("md:h-[")), "main must not use a fixed desktop calc height");
});

test("inbox main panel keeps its own height contract", () => {
  const main = findOpeningElement((node) =>
    node.attributes.properties.some((prop) =>
      ts.isJsxAttribute(prop) && prop.name.getText(shellSource) === "id" && prop.initializer?.getText(shellSource) === "\"main-content\""
    )
  );
  const branch = classNameExpression(main);
  assert.ok(ts.isConditionalExpression(branch));
  const inboxBranch = branch.whenFalse;
  assert.ok(ts.isConditionalExpression(inboxBranch), "inbox branch must stay separate from task detail");
  assert.ok(branchText(inboxBranch.whenTrue).includes("h-[calc(100dvh-48px)]"), "inbox height is out of scope and must stay unchanged");
});

// Mobile: the parent canvas is the only scroller, so the split layout's mobile stack must take its natural height.
const splitPath = path.resolve("src/components/tasks/detail/task-detail-split-layout.tsx");
const splitSource = ts.createSourceFile(splitPath, readFileSync(splitPath, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function jsxClassNames(node: ts.Node): string[] {
  const classes: string[] = [];
  const visit = (child: ts.Node): void => {
    if (ts.isJsxOpeningElement(child) || ts.isJsxSelfClosingElement(child)) {
      for (const prop of child.attributes.properties) {
        if (ts.isJsxAttribute(prop) && prop.name.getText(splitSource) === "className" && prop.initializer) {
          classes.push(prop.initializer.getText(splitSource));
        }
      }
    }
    ts.forEachChild(child, visit);
  };
  visit(node);
  return classes;
}

test("mobile split stack takes natural content height so the canvas scrolls all content and the inspector", () => {
  let mobileBranch: ts.Statement | undefined;
  const visit = (node: ts.Node): void => {
    if (!mobileBranch && ts.isIfStatement(node) && node.expression.getText(splitSource) === "isMobile") mobileBranch = node.thenStatement;
    ts.forEachChild(node, visit);
  };
  visit(splitSource);
  assert.ok(mobileBranch, "mobile branch not found in task-detail-split-layout.tsx");
  const mobileClasses = jsxClassNames(mobileBranch);
  assert.equal(mobileClasses.length, 3, "mobile stack has the outer wrapper, the children wrapper and the inspector wrapper");
  assert.ok(mobileClasses.every((cls) => !cls.includes("min-h-0")), "mobile wrappers must not force shrinking below content");
  assert.ok(jsxClassNames(splitSource).some((cls) => cls.includes("min-h-0")), "desktop split branch keeps its min-h-0 contract");
});

test("mobile canvas bottom padding clears the fixed bottom navigation", () => {
  const css = readFileSync(cssPath, "utf8");
  const mobileCanvas = /@media \(max-width: 1023px\)\s*\{[\s\S]*?\.canvas\s*\{\s*padding:\s*0 16px ([^;]+);/.exec(css);
  assert.ok(mobileCanvas, "mobile canvas padding rule not found");
  assert.match(mobileCanvas[1], /56px/, "bottom padding must clear the 56px bottom nav");
  assert.match(mobileCanvas[1], /env\(safe-area-inset-bottom/);
});

// Scroll contract: the parent canvas and the child drawer each own a scroll area inside a bounded chain.
const cssPath = path.resolve("src/components/tasks/task-detail-page.module.css");
const css = readFileSync(cssPath, "utf8");

function ruleBodies(selector: string): string[] {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...css.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "g"))].map((match) => match[1]);
}

test("split workspace, parent card, and parent canvas are bounded so each scrolls on its own", () => {
  const splitBody = ruleBodies(".splitWorkspace")[0];
  assert.match(splitBody, /min-height:\s*0/, "split workspace must not grow to content");
  assert.match(splitBody, /grid-template-rows:\s*minmax\(0,\s*1fr\)/);

  const workspaceBody = ruleBodies(".workspace")[0];
  assert.match(workspaceBody, /min-height:\s*0/);
  assert.match(workspaceBody, /overflow:\s*hidden/);

  const canvasBody = ruleBodies(".canvas")[0];
  assert.match(canvasBody, /min-height:\s*0/);
  assert.match(canvasBody, /overflow-y:\s*auto/);
});

test("desktop child drawer is a bounded grid item that keeps the minimum height at zero", () => {
  const peekBodies = ruleBodies(".peekSurface");
  assert.ok(peekBodies.some((body) => /min-height:\s*0/.test(body)), "desktop peek surface must set min-height: 0");
});

test("child drawer scroll region contains its own overscroll", () => {
  const drawerPath = path.resolve("src/components/tasks/detail/subtask-detail-drawer.tsx");
  const drawerSource = ts.createSourceFile(drawerPath, readFileSync(drawerPath, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const literals: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node)) literals.push(node.text);
    ts.forEachChild(node, visit);
  };
  visit(drawerSource);
  const scrollRegion = literals.find((text) => text.includes("overflow-y-auto"));
  assert.ok(scrollRegion, "drawer scroll region must exist");
  const classes = scrollRegion.split(/\s+/);
  assert.ok(classes.includes("min-h-0"), "drawer scroll region must shrink inside the grid item");
  assert.ok(classes.includes("overscroll-contain"), "drawer scroll region must contain overscroll");
});
