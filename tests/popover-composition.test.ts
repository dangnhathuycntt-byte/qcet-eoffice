import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import ts from "typescript";

test("Base UI popups/menus have portal, positioning context, and a trigger or explicit anchor", () => {
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
    // Nơi dùng wrapper chung của ui/menu, ui/popover cũng là popover đã chuyển sang Base UI (cấu trúc nằm trong wrapper)
    popupCount += elements.filter((node) => ["MenuPopup", "PopoverPopup"].includes(node.openingElement.tagName.getText(source))).length;
    for (const popup of elements.filter((node) => (node.openingElement.tagName.getText(source) === "Popover.Popup" || node.openingElement.tagName.getText(source) === "Menu.Popup"))) {
      popupCount++;
      const ancestors: ts.JsxElement[] = [];
      for (let ancestor = popup.parent; ancestor; ancestor = ancestor.parent) {
        if (ts.isJsxElement(ancestor)) ancestors.push(ancestor);
      }
      const positioner = ancestors.find((node) => (node.openingElement.tagName.getText(source) === "Popover.Positioner" || node.openingElement.tagName.getText(source) === "Menu.Positioner"));
      const root = ancestors.find((node) => (node.openingElement.tagName.getText(source) === "Popover.Root" || node.openingElement.tagName.getText(source) === "Menu.Root"));
      assert.ok(positioner, `${entry}: Popup requires Positioner`);
      const layer = positioner.openingElement.attributes.properties.find((attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText(source) === "className");
      // className="z-50 …" hoặc className={cn("z-50", SHEET_POSITIONER_CLASS)}: chỉ đọc các chuỗi literal truyền vào cn()
      const init = layer && ts.isJsxAttribute(layer) ? layer.initializer : undefined;
      const layerClasses = !init
        ? ""
        : ts.isStringLiteral(init)
          ? init.text
          : ts.isJsxExpression(init) && init.expression && ts.isCallExpression(init.expression) && init.expression.expression.getText(source) === "cn"
            ? init.expression.arguments.filter(ts.isStringLiteral).map((arg) => arg.text).join(" ")
            : "";
      assert.ok(layerClasses.split(/\s+/).some((cls) => /^z-(\d+|\[\d+\])$/.test(cls)), `${entry}: overlay layer belongs on the Positioner stacking context`);
      assert.ok(root, `${entry}: Popup requires Root`);
      assert.ok(ancestors.some((node) => (node.openingElement.tagName.getText(source) === "Popover.Portal" || node.openingElement.tagName.getText(source) === "Menu.Portal")), `${entry}: Popup requires Portal`);
      const hasAnchor = positioner.openingElement.attributes.properties.some((attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText(source) === "anchor");
      const hasTrigger = elements.some((node) => node.pos >= root.pos && node.end <= root.end && (node.openingElement.tagName.getText(source) === "Popover.Trigger" || node.openingElement.tagName.getText(source) === "Menu.Trigger"));
      assert.ok(hasAnchor || hasTrigger, `${entry}: Positioner requires an anchor or registered trigger`);
    }
  }
  assert.ok(popupCount >= 10, "audit includes all migrated popover consumers");
});
