import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TaskDetailSideSheet } from "@/components/dashboard/task-detail-side-sheet";
import { CreateTaskModal } from "@/components/dashboard/create-task-modal";
import { MobileTaskFilterSheet } from "@/components/tasks/mobile-task-filter-sheet";
import { sideSheetVariants, fadeVariants, dialogVariants, bottomSheetVariants } from "@/lib/motion/variants";

const rootDir = process.cwd();

describe("Task Surfaces Motion Invariants", () => {
  const sideSheetPath = path.join(rootDir, "src/components/dashboard/task-detail-side-sheet.tsx");
  const createModalPath = path.join(rootDir, "src/components/dashboard/create-task-modal.tsx");
  const filterSheetPath = path.join(rootDir, "src/components/tasks/mobile-task-filter-sheet.tsx");

  const sideSheetSource = fs.readFileSync(sideSheetPath, "utf-8");
  const createModalSource = fs.readFileSync(createModalPath, "utf-8");
  const filterSheetSource = fs.readFileSync(filterSheetPath, "utf-8");

  describe("Zero framer-motion ban", () => {
    it("task-detail-side-sheet does not import framer-motion", () => {
      assert.doesNotMatch(sideSheetSource, /from\s+["']framer-motion["']/);
      assert.doesNotMatch(sideSheetSource, /from\s+["']framer-motion\//);
    });

    it("create-task-modal does not import framer-motion", () => {
      assert.doesNotMatch(createModalSource, /from\s+["']framer-motion["']/);
      assert.doesNotMatch(createModalSource, /from\s+["']framer-motion\//);
    });

    it("mobile-task-filter-sheet does not import framer-motion", () => {
      assert.doesNotMatch(filterSheetSource, /from\s+["']framer-motion["']/);
      assert.doesNotMatch(filterSheetSource, /from\s+["']framer-motion\//);
    });
  });

  describe("Motion module imports and variant usage", () => {
    it("task-detail-side-sheet imports AnimatePresence and m from motion/react and motion/react-m", () => {
      assert.match(sideSheetSource, /import\s+\{[^}]*AnimatePresence[^}]*\}\s+from\s+["']motion\/react["']/);
      assert.match(sideSheetSource, /import\s+\*\s+as\s+m\s+from\s+["']motion\/react-m["']/);
      assert.match(sideSheetSource, /sideSheetVariants/);
      assert.match(sideSheetSource, /fadeVariants/);
    });

    it("create-task-modal imports AnimatePresence and m from motion/react and motion/react-m", () => {
      assert.match(createModalSource, /import\s+\{[^}]*AnimatePresence[^}]*\}\s+from\s+["']motion\/react["']/);
      assert.match(createModalSource, /import\s+\*\s+as\s+m\s+from\s+["']motion\/react-m["']/);
      assert.match(createModalSource, /dialogVariants/);
      assert.match(createModalSource, /fadeVariants/);
    });

    it("mobile-task-filter-sheet imports AnimatePresence and m from motion/react and motion/react-m", () => {
      assert.match(filterSheetSource, /import\s+\{[^}]*AnimatePresence[^}]*\}\s+from\s+["']motion\/react["']/);
      assert.match(filterSheetSource, /import\s+\*\s+as\s+m\s+from\s+["']motion\/react-m["']/);
      assert.match(filterSheetSource, /bottomSheetVariants/);
      assert.match(filterSheetSource, /fadeVariants/);
    });
  });

  describe("Variants integrity", () => {
    it("motion variant tokens exist and are correctly structured", () => {
      assert.ok(sideSheetVariants.initial);
      assert.ok(sideSheetVariants.animate);
      assert.ok(sideSheetVariants.exit);

      assert.ok(dialogVariants.initial);
      assert.ok(dialogVariants.animate);
      assert.ok(dialogVariants.exit);

      assert.ok(fadeVariants.initial);
      assert.ok(fadeVariants.animate);
      assert.ok(fadeVariants.exit);
    });
  });

  describe("Runtime rendering and surface behavior", () => {
    it("renders TaskDetailSideSheet correctly when closed", () => {
      const html = renderToStaticMarkup(
        React.createElement(TaskDetailSideSheet, {
          task: null,
          isOpen: false,
          onClose: () => {},
        })
      );
      assert.equal(html, "");
    });

    it("renders CreateTaskModal correctly when closed", () => {
      const html = renderToStaticMarkup(
        React.createElement(CreateTaskModal, {
          isOpen: false,
          onClose: () => {},
          onSubmit: async () => {},
        })
      );
      assert.equal(html, "");
    });

    it("renders MobileTaskFilterSheet correctly when closed", () => {
      const html = renderToStaticMarkup(
        React.createElement(MobileTaskFilterSheet, {
          isOpen: false,
          onClose: () => {},
          statusFilter: "ALL",
          onStatusChange: () => {},
          departmentFilter: "ALL",
          onDepartmentChange: () => {},
          monthFilter: "ALL",
          onMonthChange: () => {},
          availableDepartments: [],
          onReset: () => {},
          activeFilterCount: 0,
        })
      );
      assert.equal(html, "");
    });

    it("renders MobileTaskFilterSheet correctly when open", () => {
      const html = renderToStaticMarkup(
        React.createElement(MobileTaskFilterSheet, {
          isOpen: true,
          onClose: () => {},
          statusFilter: "ALL",
          onStatusChange: () => {},
          departmentFilter: "ALL",
          onDepartmentChange: () => {},
          monthFilter: "ALL",
          onMonthChange: () => {},
          availableDepartments: [{ code: "dept-1", name: "Phòng Đào tạo" }],
          onReset: () => {},
          activeFilterCount: 1,
        })
      );
      assert.ok(html.includes("Bộ lọc công việc"));
      assert.ok(html.includes("Phòng Đào tạo"));
    });
  });
});
