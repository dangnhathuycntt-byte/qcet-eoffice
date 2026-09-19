import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import ts from "typescript";

test("Base UI popups have portal, positioning context, and a trigger or explicit anchor", () => {
  const directory = path.resolve("src");
  let popupCount = 0;
  for (const entry of readdirSync(directory, { recursive: true }).map(String)) {
    if (!entry.endsWith(".tsx")) continue;
    const file = path.join(directory, entry);
    const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const elements: ts.JsxElement[] = [];
    const visit = (node: ts.Node) => {
      if (ts.isJsxElement(node)) elements.push(node);
      ts.forEachChild(node, visit);
    };
    visit(source);
    for (const popup of elements.filter((node) => node.openingElement.tagName.getText(source) === "Popover.Popup")) {
      popupCount++;
      const ancestors: ts.JsxElement[] = [];
      for (let ancestor = popup.parent; ancestor; ancestor = ancestor.parent) {
        if (ts.isJsxElement(ancestor)) ancestors.push(ancestor);
      }
      const positioner = ancestors.find((node) => node.openingElement.tagName.getText(source) === "Popover.Positioner");
      const root = ancestors.find((node) => node.openingElement.tagName.getText(source) === "Popover.Root");
      assert.ok(positioner, `${entry}: Popup requires Positioner`);
      const layer = positioner.openingElement.attributes.properties.find((attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText(source) === "className");
      assert.ok(layer && ts.isJsxAttribute(layer) && layer.initializer && ts.isStringLiteral(layer.initializer) && layer.initializer.text.split(/\s+/).includes("z-50"), `${entry}: overlay layer belongs on the Positioner stacking context`);
      assert.ok(root, `${entry}: Popup requires Root`);
      assert.ok(ancestors.some((node) => node.openingElement.tagName.getText(source) === "Popover.Portal"), `${entry}: Popup requires Portal`);
      const hasAnchor = positioner.openingElement.attributes.properties.some((attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText(source) === "anchor");
      const hasTrigger = elements.some((node) => node.pos >= root.pos && node.end <= root.end && node.openingElement.tagName.getText(source) === "Popover.Trigger");
      assert.ok(hasAnchor || hasTrigger, `${entry}: Positioner requires an anchor or registered trigger`);
    }
  }
  assert.ok(popupCount >= 10, "audit includes all migrated popover consumers");
});
