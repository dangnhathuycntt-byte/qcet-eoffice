import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const readSource = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

describe("Task detail audit regressions", () => {
  it("enforces authentication and object-level read authorization before rendering", () => {
    const source = readSource("src/app/tasks/[id]/page.tsx");

    assert.match(source, /if \(!session\)[\s\S]*redirect\(/);
    assert.match(source, /canReadTask\(session as any, rawTask\)/);
    assert.ok(
      source.indexOf("canReadTask(session as any, rawTask)") > source.indexOf("if (!rawTask)"),
      "authorization must happen after loading the task and before mapping/rendering it"
    );
  });

  it("passes a computed edit capability instead of enabling every editor", () => {
    const source = readSource("src/components/tasks/task-detail-page.tsx");

    assert.ok(!source.includes("canEdit={true}"), "detail editors must not be hard-coded writable");
    assert.ok(source.includes("canEdit={canEdit}"), "detail editors must receive the server capability");
  });

  it("submits completed child work for approval without bypassing maker-checker", () => {
    const source = readSource("src/components/tasks/task-detail-page.tsx");

    assert.match(
      source,
      /st\.status === "COMPLETED" \? "IN_PROGRESS" : "WAITING_APPROVAL"/
    );
    assert.ok(
      !source.includes('handleStatusChange(task.id, "COMPLETED", `Tự động'),
      "parent rollup must never auto-approve the parent"
    );
  });

  it("sends expectedVersion with every task-detail metadata PATCH", () => {
    const source = readSource("src/components/tasks/task-detail-page.tsx");
    const patchBodies = [...source.matchAll(/method: "PATCH",[\s\S]{0,260}?body: JSON\.stringify\(([^)]*)\)/g)];

    assert.ok(patchBodies.length >= 2, "expected title and description PATCH calls");
    for (const match of patchBodies) {
      assert.match(match[1], /expectedVersion/);
    }
  });
});
