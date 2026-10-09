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
    // Authorization refactored to service pattern: loadAuthorizationContext + resolveTaskDetailContext
    assert.match(source, /loadAuthorizationContext\(session\.id\)/);
    assert.match(source, /resolveTaskDetailContext\(/);
    assert.ok(
      source.indexOf("loadAuthorizationContext") < source.indexOf("resolveTaskDetailContext"),
      "authorization context must be loaded before resolving task detail context"
    );
    // Compare the *call sites* (not imports) to verify authorization runs before mapping
    const resolveCallIdx = source.indexOf("resolveTaskDetailContext(");
    const mapCallIdx = source.indexOf("mapPrismaTaskToSchoolTask(");
    assert.ok(resolveCallIdx > 0, "resolveTaskDetailContext must be called");
    assert.ok(mapCallIdx > 0, "mapPrismaTaskToSchoolTask must be called");
    assert.ok(
      resolveCallIdx < mapCallIdx,
      "authorization must happen before mapping/rendering the task"
    );
  });

  it("passes a computed edit capability instead of enabling every editor", () => {
    const source = readSource("src/components/tasks/task-detail-page.tsx");

    assert.ok(!source.includes("canEdit={true}"), "detail editors must not be hard-coded writable");
    assert.ok(source.includes("canEdit={canEdit}"), "detail editors must receive the server capability");
  });

  it("submits completed child work for approval without bypassing maker-checker", () => {
    const source = readSource("src/components/tasks/task-detail-page.tsx");
    const service = readSource("src/lib/services/task-domain-actions.ts");

    // Maker-checker: the server decides the status; at 100% it must be WAITING_APPROVAL (not COMPLETED)
    assert.match(
      service,
      /validated\.progressPercent === 100\)\s*\{\s*targetStatus = TaskStatus\.WAITING_APPROVAL/
    );
    // Client applies the server result instead of deriving the status itself
    assert.ok(source.includes("applyProgressResult(prev, result)"));
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
