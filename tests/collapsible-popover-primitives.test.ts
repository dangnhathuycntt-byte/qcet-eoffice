import { describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Collapsible,
  CollapsibleRoot,
  CollapsibleTrigger,
  CollapsiblePanel,
  StandardCollapsible,
} from "../src/components/ui/collapsible";
import {
  Popover,
  PopoverRoot,
  PopoverTrigger,
  PopoverPortal,
  PopoverPositioner,
  PopoverPopup,
  PopoverContent,
  StandardPopover,
} from "../src/components/ui/popover";

describe("Collapsible & Popover Shared Primitives", () => {
  describe("Collapsible Component", () => {
    it("exports all standard primitives and helpers", () => {
      assert.ok(Collapsible, "Collapsible namespace should be defined");
      assert.ok(CollapsibleRoot, "CollapsibleRoot should be defined");
      assert.ok(CollapsibleTrigger, "CollapsibleTrigger should be defined");
      assert.ok(CollapsiblePanel, "CollapsiblePanel should be defined");
      assert.ok(StandardCollapsible, "StandardCollapsible helper should be defined");
    });

    it("renders StandardCollapsible with CSS Grid animation container", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          StandardCollapsible,
          {
            defaultOpen: true,
            trigger: React.createElement("button", null, "Toggle"),
          },
          React.createElement("div", null, "Panel content")
        )
      );

      assert.match(html, /grid/, "CollapsiblePanel should use CSS grid");
      assert.match(html, /transition-\[grid-template-rows\]/, "CollapsiblePanel should have grid-template-rows transition");
      assert.match(html, /overflow-hidden/, "CollapsiblePanel inner container should be overflow-hidden");
      assert.match(html, /Toggle/, "Trigger content rendered");
      assert.match(html, /Panel content/, "Panel content rendered");
    });
  });

  describe("Popover Component", () => {
    it("exports all standard primitives and helpers", () => {
      assert.ok(Popover, "Popover namespace should be defined");
      assert.ok(PopoverRoot, "PopoverRoot should be defined");
      assert.ok(PopoverTrigger, "PopoverTrigger should be defined");
      assert.ok(PopoverPortal, "PopoverPortal should be defined");
      assert.ok(PopoverPositioner, "PopoverPositioner should be defined");
      assert.ok(PopoverPopup, "PopoverPopup should be defined");
      assert.ok(PopoverContent, "PopoverContent should be defined");
      assert.ok(StandardPopover, "StandardPopover helper should be defined");
    });

    it("renders StandardPopover trigger markup correctly", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          StandardPopover,
          {
            trigger: React.createElement("button", { type: "button" }, "Open Popover"),
          },
          React.createElement("p", null, "Popover body")
        )
      );

      assert.match(html, /Open Popover/, "Popover trigger button should be rendered");
    });
  });
});
