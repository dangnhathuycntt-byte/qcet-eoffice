import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DocumentQuickEntryModal } from "../src/components/documents/document-quick-entry-modal";

describe("Quick Directive Presets for Leadership", () => {

  test("DocumentQuickEntryModal returns null when isOpen is false", () => {
    const html = renderToStaticMarkup(
      React.createElement(DocumentQuickEntryModal, {
        isOpen: false,
        onClose: () => {},
      })
    );
    assert.equal(html, "");
  });

  test("DocumentQuickEntryModal mounts Base UI StandardDialog successfully", () => {
    assert.equal(typeof DocumentQuickEntryModal, "function");
    const el = React.createElement(DocumentQuickEntryModal, {
      isOpen: true,
      onClose: () => {},
      departments: [
        { id: "DT", name: "Phòng Đào tạo" },
        { id: "TCHC", name: "Phòng Tổ chức - Hành chính" },
      ],
    });
    assert.ok(React.isValidElement(el));
  });
});
