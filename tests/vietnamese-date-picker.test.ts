import { describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { VietnameseDatePicker } from "../src/components/ui/vietnamese-date-picker";

describe("VietnameseDatePicker Component Suite", () => {
  it("keeps the selected date while allowing a form to opt out of clearing it", () => {
    const render = (clearable?: boolean) => renderToStaticMarkup(React.createElement(VietnameseDatePicker, {
      value: "2026-10-09", variant: "input", clearable,
    }));
    assert.ok(render().includes('role="button"'), "existing consumers retain the clear affordance");
    const protectedDate = render(false);
    assert.ok(protectedDate.includes("09/10/2026"));
    assert.ok(!protectedDate.includes('role="button"'), "required document dates have no clear affordance");
  });
  it("renders chip variant with formatted Vietnamese date dd/mm/yyyy", () => {
    const html = renderToStaticMarkup(
      React.createElement(VietnameseDatePicker, {
        value: "2026-09-16",
        label: "Hạn chót:",
        variant: "chip",
      })
    );

    assert.ok(html.includes("Hạn chót:"), "renders label");
    assert.ok(html.includes("16/09/2026"), "formats ISO date to DD/MM/YYYY");
  });

  it("renders placeholder when value is empty in chip variant", () => {
    const html = renderToStaticMarkup(
      React.createElement(VietnameseDatePicker, {
        value: "",
        label: "Bắt đầu:",
        variant: "chip",
        placeholder: "dd/mm/yyyy",
      })
    );

    assert.ok(html.includes("Bắt đầu:"), "renders label");
    assert.ok(html.includes("dd/mm/yyyy"), "renders placeholder");
  });

  it("renders input variant cleanly with form field container", () => {
    const html = renderToStaticMarkup(
      React.createElement(VietnameseDatePicker, {
        value: "2026-10-05",
        variant: "input",
        placeholder: "Chọn ngày...",
      })
    );

    assert.ok(html.includes("05/10/2026"), "formats date in input variant");
  });

  it("applies error styling when error prop is provided", () => {
    const html = renderToStaticMarkup(
      React.createElement(VietnameseDatePicker, {
        value: "",
        variant: "chip",
        error: true,
      })
    );

    assert.ok(
      html.includes("bg-rose-50") || html.includes("text-rose-700"),
      "applies error classes"
    );
  });
});
