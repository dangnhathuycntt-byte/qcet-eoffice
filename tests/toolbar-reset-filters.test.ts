import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { resetTaskToolbarFilters } from "../src/components/dashboard/unified-task-toolbar";

test("clear all uses a single atomic reset without queuing individual filter navigations", () => {
  const calls: string[] = [];
  resetTaskToolbarFilters({
    onResetFilters: () => calls.push("reset"),
    onSearchChange: () => calls.push("search"),
    onTabChange: () => calls.push("tab"),
    onStatusChange: () => calls.push("status"),
    onDeadlineChange: () => calls.push("deadline"),
    onCategoryChange: () => calls.push("category"),
    onPriorityChange: () => calls.push("priority"),
    onMonthChange: () => calls.push("month"),
  });
  assert.deepEqual(calls, ["reset"]);
});

test("standalone toolbar reset clears every task-list filter", () => {
  const state = {
    search: "report",
    status: "WAITING_APPROVAL",
    deadline: "overdue",
    category: "TRAINING",
    priority: "HIGH",
    department: "CNTT",
    month: 9 as number | "ALL",
  };
  resetTaskToolbarFilters({
    onSearchChange: value => { state.search = value; },
    onStatusChange: value => { state.status = value; },
    onDeadlineChange: value => { state.deadline = value; },
    onCategoryChange: value => { state.category = value; },
    onPriorityChange: value => { state.priority = value; },
    onDepartmentChange: value => { state.department = value; },
    onMonthChange: value => { state.month = value; },
  });
  assert.deepEqual(state, {
    search: "",
    status: "all",
    deadline: "all",
    category: "ALL",
    priority: "ALL",
    department: "ALL",
    month: "ALL",
  });
});

// Bất biến (8e8f355a): mọi điểm xóa toàn bộ bộ lọc phải gọi handler reset đầy đủ, không reset từng bộ lọc rời.
// Đọc bằng AST để prop được giới hạn đúng trong element (regex dễ trôi sang <TaskEmptyState> ở dưới).
const toolbarPath = path.resolve("src/components/dashboard/unified-task-toolbar.tsx");
const workspacePath = path.resolve("src/components/workspace/unified-adaptive-workspace.tsx");

type JsxTag = ts.JsxOpeningElement | ts.JsxSelfClosingElement;

function parseTsx(file: string): ts.SourceFile {
  return ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function collectTags(source: ts.SourceFile): JsxTag[] {
  const tags: JsxTag[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) tags.push(node);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return tags;
}

function attrValue(tag: JsxTag, name: string): string | undefined {
  const source = tag.getSourceFile();
  const attr = tag.attributes.properties.find(
    (prop): prop is ts.JsxAttribute => ts.isJsxAttribute(prop) && prop.name.getText(source) === name
  );
  if (!attr?.initializer) return undefined;
  if (ts.isStringLiteral(attr.initializer)) return attr.initializer.text;
  if (!ts.isJsxExpression(attr.initializer) || !attr.initializer.expression) return undefined;
  const expression = attr.initializer.expression;
  // `aria-label={"..."}` đọc như chuỗi; còn lại (handler, biến) giữ nguyên mã nguồn để so tên
  return ts.isStringLiteralLike(expression) ? expression.text : expression.getText(source);
}

/** Chữ hiển thị của một con JSX: `Xóa bộ lọc` hoặc `{"Xóa bộ lọc"}` */
function childLabel(node: ts.Node): string | undefined {
  if (ts.isJsxText(node)) return node.text.trim();
  if (ts.isJsxExpression(node) && node.expression && ts.isStringLiteralLike(node.expression)) return node.expression.text.trim();
  return undefined;
}

// Neo cả cuối chuỗi: nhãn khác như "Xóa bộ lọc đã lưu" không phải điểm xóa toàn bộ
const CLEAR_ALL_LABEL = /^(Xóa bộ lọc|Xóa tất cả|Xóa tất cả bộ lọc)$/;
const LABEL_ATTRIBUTES = ["aria-label", "title", "label"];
// Nút bọc component (như ListToolbarClearFiltersButton đã bỏ ở 59ca8235) không có nhãn trong file này.
const CLEAR_ALL_COMPONENT = /(Clear|Reset)\w*(Filter|All)/;

function clearAllEntryPoints(source: ts.SourceFile): { where: string; tag: JsxTag | undefined }[] {
  const entries: { where: string; tag: JsxTag | undefined }[] = [];
  const visit = (node: ts.Node): void => {
    const label = node.parent && ts.isJsxElement(node.parent) ? childLabel(node) : undefined;
    if (label && CLEAR_ALL_LABEL.test(label)) {
      // Vùng bấm gần nhất bao nhãn
      let ancestor: ts.Node | undefined = node.parent;
      while (ancestor && !(ts.isJsxElement(ancestor) && attrValue(ancestor.openingElement, "onClick") !== undefined)) {
        ancestor = ancestor.parent;
      }
      entries.push({ where: `"${label}"`, tag: ancestor && ts.isJsxElement(ancestor) ? ancestor.openingElement : undefined });
    }
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(source);
      const labelled = LABEL_ATTRIBUTES.map((name) => [name, attrValue(node, name)] as const).find(
        ([, value]) => value !== undefined && CLEAR_ALL_LABEL.test(value)
      );
      if (CLEAR_ALL_COMPONENT.test(tagName)) entries.push({ where: `<${tagName}>`, tag: node });
      else if (labelled) entries.push({ where: `${labelled[0]} "${labelled[1]}"`, tag: node });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return entries;
}

test("every clear-all entry point uses the shared full-reset handler", () => {
  const toolbar = parseTsx(toolbarPath);
  assert.ok(
    toolbar.getFullText().includes("onMonthChange: handleEffectiveMonthChange, onDepartmentChange"),
    "The standalone fallback must receive the department reset callback"
  );

  const entries = clearAllEntryPoints(toolbar);
  assert.ok(entries.length >= 1, "The toolbar must expose at least one clear-all entry point");
  for (const { where, tag } of entries) {
    assert.ok(tag, `${where} must sit inside a clickable element`);
    assert.equal(attrValue(tag, "onClick"), "handleResetFilters", `${where} must call the full reset handler`);
  }

  const workspaceTags = collectTags(parseTsx(workspacePath));
  const byName = (name: string) => workspaceTags.filter((tag) => tag.tagName.getText(tag.getSourceFile()) === name);

  const toolbars = byName("UnifiedTaskToolbar");
  assert.ok(toolbars.length >= 1, "workspace must render <UnifiedTaskToolbar>");
  for (const tag of toolbars) {
    assert.equal(attrValue(tag, "onResetFilters"), "handleResetFilters", "<UnifiedTaskToolbar> must receive the workspace full reset");
  }

  const breadcrumbs = byName("ActiveFilterBreadcrumb");
  assert.ok(breadcrumbs.length >= 1, "workspace must render <ActiveFilterBreadcrumb>");
  for (const tag of breadcrumbs) {
    assert.equal(attrValue(tag, "onResetFilters"), "handleResetFilters", "<ActiveFilterBreadcrumb> onResetFilters must be the full reset");
    assert.equal(attrValue(tag, "onClearAll"), "handleResetFilters", "<ActiveFilterBreadcrumb> onClearAll must be the full reset");
  }
});
