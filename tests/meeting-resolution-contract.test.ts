/**
 * Test: Meeting Resolution Contract Validation
 *
 * Verifies CreateMeetingResolutionSchema boundary conditions
 * for the POST /api/meetings/[id]/resolutions endpoint.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { CreateMeetingResolutionSchema } from "@/contracts/meeting";

describe("CreateMeetingResolutionSchema validation boundaries", () => {
  test("accepts valid minimal input (title + content)", () => {
    const result = CreateMeetingResolutionSchema.safeParse({
      title: "Quyết nghị triển khai kế hoạch",
      content: "Giao phòng CNTT triển khai hệ thống mới",
    });
    assert.ok(result.success, "Minimal valid input should parse");
    assert.strictEqual(result.data!.createTask, false, "createTask defaults to false");
  });

  test("accepts full input with all optional fields", () => {
    const result = CreateMeetingResolutionSchema.safeParse({
      code: "QN-001",
      title: "Quyết nghị phê duyệt đề án",
      content: "Phê duyệt đề án nâng cấp CNTT theo hồ sơ đính kèm",
      leadUnitId: "dept-cntt",
      leadUserId: "user-lead-1",
      deadline: "2026-10-15T00:00:00.000Z",
      createTask: true,
      taskTitle: "Triển khai đề án nâng cấp CNTT",
    });
    assert.ok(result.success, "Full valid input should parse");
    assert.strictEqual(result.data!.createTask, true);
    assert.strictEqual(result.data!.taskTitle, "Triển khai đề án nâng cấp CNTT");
  });

  test("rejects title shorter than 3 characters", () => {
    const result = CreateMeetingResolutionSchema.safeParse({
      title: "AB",
      content: "Nội dung hợp lệ đầy đủ",
    });
    assert.strictEqual(result.success, false, "Title < 3 chars should fail");
  });

  test("rejects content shorter than 5 characters", () => {
    const result = CreateMeetingResolutionSchema.safeParse({
      title: "Quyết nghị hợp lệ",
      content: "Ngắn",
    });
    assert.strictEqual(result.success, false, "Content < 5 chars should fail");
  });

  test("rejects title exceeding 500 characters", () => {
    const result = CreateMeetingResolutionSchema.safeParse({
      title: "A".repeat(501),
      content: "Nội dung hợp lệ đầy đủ",
    });
    assert.strictEqual(result.success, false, "Title > 500 chars should fail");
  });

  test("rejects code exceeding 100 characters", () => {
    const result = CreateMeetingResolutionSchema.safeParse({
      code: "X".repeat(101),
      title: "Quyết nghị hợp lệ",
      content: "Nội dung hợp lệ đầy đủ",
    });
    assert.strictEqual(result.success, false, "Code > 100 chars should fail");
  });

  test("rejects missing title", () => {
    const result = CreateMeetingResolutionSchema.safeParse({
      content: "Nội dung hợp lệ đầy đủ",
    });
    assert.strictEqual(result.success, false, "Missing title should fail");
  });

  test("rejects missing content", () => {
    const result = CreateMeetingResolutionSchema.safeParse({
      title: "Quyết nghị hợp lệ",
    });
    assert.strictEqual(result.success, false, "Missing content should fail");
  });

  test("rejects invalid deadline format", () => {
    const result = CreateMeetingResolutionSchema.safeParse({
      title: "Quyết nghị hợp lệ",
      content: "Nội dung hợp lệ đầy đủ",
      deadline: "15/10/2026", // DD/MM/YYYY not ISO 8601
    });
    assert.strictEqual(result.success, false, "Non-ISO deadline should fail");
  });

  test("accepts boundary title of exactly 3 characters", () => {
    const result = CreateMeetingResolutionSchema.safeParse({
      title: "ABC",
      content: "Nội dung hợp lệ đầy đủ",
    });
    assert.ok(result.success, "Title of exactly 3 chars should pass");
  });

  test("accepts boundary content of exactly 5 characters", () => {
    const result = CreateMeetingResolutionSchema.safeParse({
      title: "Quyết nghị hợp lệ",
      content: "ABCDE",
    });
    assert.ok(result.success, "Content of exactly 5 chars should pass");
  });
});
