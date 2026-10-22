/**
 * Onboarding hướng tới Trợ lý (`/onboarding`): bước theo cờ Trợ lý, cách gọi người dùng, Hướng dẫn riêng ghép từ lựa chọn,
 * câu hỏi đầu tiên chỉ cho việc Trợ lý có công cụ đọc, và điều kiện chuyển người chưa onboarding sang trang này.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ASSISTANT_INSTRUCTIONS_MAX } from "@qcet/contracts/assistant";
import {
  FOCUS_AREAS,
  addressLabel,
  composeAssistantInstructions,
  givenName,
  onboardingSteps,
  parseOnboardingStep,
  selfPronoun,
  shouldRedirectToOnboarding,
  starterPrompts,
} from "../src/lib/onboarding";

test("bước: Trợ lý tắt chỉ còn hồ sơ; ?step= lạ hoặc thuộc bước đã tắt thì về bước đầu", () => {
  assert.deepEqual(onboardingSteps(true), ["profile", "address", "focus", "start"]);
  assert.deepEqual(onboardingSteps(false), ["profile"]);
  assert.equal(parseOnboardingStep("focus", onboardingSteps(true)), "focus");
  assert.equal(parseOnboardingStep("focus", onboardingSteps(false)), "profile");
  assert.equal(parseOnboardingStep("xyz", onboardingSteps(true)), "profile");
  assert.equal(parseOnboardingStep(null, onboardingSteps(true)), "profile");
});

test("cách gọi theo tên (chữ cuối họ tên), xưng em khi có Thầy/Cô/Anh/Chị", () => {
  assert.equal(givenName("  Nguyễn  Văn   An "), "An");
  assert.equal(addressLabel("thay", "Nguyễn Văn An"), "Thầy An");
  assert.equal(addressLabel("chi", "Trần Thị Bình"), "Chị Bình");
  assert.equal(addressLabel("ten", "Nguyễn Văn An"), "An");
  assert.equal(addressLabel("co", ""), "Cô");
  assert.equal(selfPronoun("anh"), "em");
  assert.equal(selfPronoun("ten"), "tôi");
});

test("Hướng dẫn riêng ghép từ lựa chọn, việc theo thứ tự hiển thị", () => {
  const text = composeAssistantInstructions({
    fullName: "Nguyễn Văn An",
    title: " Giảng viên ",
    address: "thay",
    style: "concise",
    focus: ["meetings", "tasks"],
  });
  assert.equal(
    text,
    [
      'Gọi tôi là Thầy An, xưng "em".',
      "Trả lời ngắn gọn, đi thẳng vào việc; chỉ giải thích thêm khi tôi hỏi.",
      "Chức danh của tôi: Giảng viên.",
      "Tôi cần hỗ trợ nhiều nhất về: nhiệm vụ được giao, lịch họp.",
    ].join("\n")
  );
});

test("Hướng dẫn riêng bỏ dòng trống và không vượt giới hạn của ô Hướng dẫn riêng", () => {
  const text = composeAssistantInstructions({ fullName: "", title: "", address: "ten", style: "detailed", focus: [] });
  assert.equal(text, "Trả lời đầy đủ: nêu lý do và các bước cần làm.");
  const long = composeAssistantInstructions({ fullName: "A", title: "x".repeat(5000), address: "ten", style: "concise", focus: [] });
  assert.ok(long.length <= ASSISTANT_INSTRUCTIONS_MAX);
});

test("câu hỏi đầu tiên theo việc đã chọn (tối đa 3), chưa chọn thì gợi ý nhiệm vụ và việc hôm nay", () => {
  const prompt = (id: string) => FOCUS_AREAS.find((area) => area.id === id)!.prompt;
  assert.deepEqual(starterPrompts(["documents", "tasks"]), [prompt("tasks"), prompt("documents")]);
  assert.deepEqual(starterPrompts([]), [prompt("tasks"), prompt("today")]);
  assert.equal(starterPrompts(["tasks", "documents", "meetings", "today"]).length, 3);
  // Chỉ việc Trợ lý có công cụ đọc: không có ghi chú
  assert.deepEqual(FOCUS_AREAS.map((area) => area.id), ["tasks", "documents", "meetings", "today"]);
});

test("chuyển sang onboarding chỉ khi phiên máy chủ có onboardedAt null, trừ trang công khai và chính onboarding", () => {
  const fresh = { onboardedAt: null };
  assert.equal(shouldRedirectToOnboarding(fresh, true, "/tasks"), true);
  assert.equal(shouldRedirectToOnboarding(fresh, true, "/tasks/abc"), true);
  assert.equal(shouldRedirectToOnboarding({ onboardedAt: "2026-10-22T00:00:00.000Z" }, true, "/tasks"), false);
  // Bản lưu ngoại tuyến không có trường onboardedAt; chưa xác thực với máy chủ
  assert.equal(shouldRedirectToOnboarding({}, true, "/tasks"), false);
  assert.equal(shouldRedirectToOnboarding(fresh, false, "/tasks"), false);
  assert.equal(shouldRedirectToOnboarding(null, true, "/tasks"), false);
  for (const path of ["/onboarding", "/login", "/portal", "/docs", "/docs/tro-ly", "/maintenance"]) {
    assert.equal(shouldRedirectToOnboarding(fresh, true, path), false, path);
  }
  assert.equal(shouldRedirectToOnboarding(fresh, true, "/onboardingx"), true);
});
