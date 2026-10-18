import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

describe("Issue #13 canonical Task cutover", () => {
  test("generic PATCH uses the strict metadata-only contract", () => {
    const route = read("src/app/api/tasks/[id]/route.ts");
    assert.match(route, /parseAndValidateJson\(req, UpdateTaskMetadataSchema[),]/);
    assert.doesNotMatch(route, /parseAndValidateJson\(req, UpdateTaskInputSchema\)/);
    for (const forbidden of [
      "progressPercent: validatedBody",
      "assigneeId: validatedBody",
      "collaboratorIds: validatedBody",
      "parentTaskId: validatedBody",
    ]) {
      assert.doesNotMatch(route, new RegExp(forbidden));
    }
  });

  test("Task production services have no legacy authorization imports", () => {
    const command = read("src/server/tasks/task-command-service.ts");
    const actions = read("src/server/tasks/task-domain-actions.ts");
    for (const source of [command, actions]) {
      assert.doesNotMatch(source, /hybrid-authorization/);
      assert.doesNotMatch(source, /from ['\"].*task-policy/);
      assert.doesNotMatch(source, /canUser(Create|Update|Delete|Submit|Review|Transition)/);
      assert.doesNotMatch(source, /checkActiveDelegation|isPrivilegedUser/);
    }
  });

  test("shared action transport enforces every mutation guard", () => {
    const shared = read("src/app/api/tasks/[id]/actions/shared.ts");
    const transport = read("src/server/api/task-subresource-request.ts");
    // Route hành động đi qua phần đầu request dùng chung ở chế độ ghi, có schema.
    assert.match(shared, /resolveTaskSubresourceRequest\(request, context, \{\s*mutate: true,\s*schema,/);
    for (const guard of [
      "assertCsrf(request)",
      "assertJsonContentType(request)",
      "assertRequestBodySize(request, MAX_PAYLOAD_SIZE)",
      '"MUTATIONS_SENSITIVE"',
      "parseAndValidateJson(request, options.schema)",
    ]) {
      assert.ok(transport.includes(guard), `missing shared guard: ${guard}`);
    }
    for (const guard of ["loadCachedAuthorizationContext(session.id", "authorize(authorizationContext, action"]) {
      assert.ok(shared.includes(guard), `missing shared guard: ${guard}`);
    }
  });

  test("normal routes archive and active queries exclude archived tasks", () => {
    const itemRoute = read("src/app/api/tasks/[id]/route.ts");
    const queryService = read("src/server/tasks/task-query-service.ts");
    assert.match(itemRoute, /taskCommandService\.archiveTask/);
    assert.doesNotMatch(itemRoute, /taskCommandService\.deleteTask/);
    assert.match(queryService, /archivedAt: null/);
  });

  test("SSR list and detail use the canonical Task query service", () => {
    const listPage = read("src/app/tasks/page.tsx");
    const detailPage = read("src/app/tasks/[id]/page.tsx");
    assert.match(listPage, /taskQueryService\.queryTasks/);
    assert.doesNotMatch(listPage, /getLiveDashboardData/);
    assert.match(detailPage, /taskQueryService\.getTaskEntityForInternalUse/);
    assert.doesNotMatch(detailPage, /prisma\.task\.findUnique/);
  });
});
