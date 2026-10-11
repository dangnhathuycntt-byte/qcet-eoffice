import { describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
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
