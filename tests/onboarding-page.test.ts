import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Onboarding Flow & Design Specification Invariants", () => {
  const onboardingSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/components/onboarding/onboarding-flow.tsx"),
    "utf-8"
  );
  const onboardingPageSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/app/onboarding/page.tsx"),
    "utf-8"
  );

  test("implements full-screen layout without sidebar or outer header", () => {
    assert.strictEqual(
      onboardingSource.includes("AppSidebar"),
      false,
      "Onboarding must NOT include AppSidebar"
    );
    assert.ok(
      onboardingSource.includes("min-h-[100dvh]"),
      "Onboarding must be full-screen with min-h-[100dvh]"
    );
  });

  test("contains standard Vietnamese institutional copy across all steps", () => {
    // Step 1: Xác nhận thông tin
    assert.ok(
      onboardingSource.includes("Xác nhận thông tin của bạn"),
      "Step 1 must have heading 'Xác nhận thông tin của bạn'"
    );
    assert.ok(
      onboardingSource.includes("Quản trị đã thiết lập sẵn. Bạn chỉ cần kiểm tra."),
      "Step 1 must have description 'Quản trị đã thiết lập sẵn. Bạn chỉ cần kiểm tra.'"
    );
    assert.ok(
      onboardingSource.includes("Đơn vị") && onboardingSource.includes("Vai trò") && onboardingSource.includes("Người quản lý"),
      "Step 1 profile card must include unit, role and manager fields"
    );
    assert.ok(
      onboardingSource.includes("Chưa đúng?") && onboardingSource.includes("Báo quản trị"),
      "Step 1 must include correction report action"
    );

    // Step 2: Văn bản đến
    assert.ok(
      onboardingSource.includes("Văn bản đến, ký gọn hơn"),
      "Step 2 must have heading 'Văn bản đến, ký gọn hơn'"
    );
    assert.ok(
      onboardingSource.includes("Đọc, bút phê và trình ký ngay trên cùng một màn hình."),
      "Step 2 must have description 'Đọc, bút phê và trình ký ngay trên cùng một màn hình.'"
    );
    assert.ok(
      onboardingSource.includes("Công văn đến · 214/CV-ĐT"),
      "Step 2 must show sample document card"
    );

    // Step 3: Nhắc việc
    assert.ok(
      onboardingSource.includes("Nhắc việc đúng lúc"),
      "Step 3 must have heading 'Nhắc việc đúng lúc'"
    );
    assert.ok(
      onboardingSource.includes("Bạn sẽ được hỏi bật nhắc khi có việc đầu tiên sắp đến hạn, không phải bây giờ."),
      "Step 3 must have description deferring push permission request"
    );

    // Step 4: Sẵn sàng
    assert.ok(
      onboardingSource.includes("Xin chào,"),
      "Step 4 must greet user"
    );
    assert.ok(
      onboardingSource.includes("Mở việc đầu tiên"),
      "Step 4 must have primary CTA 'Mở việc đầu tiên'"
    );
    assert.ok(
      onboardingSource.includes("Xem hướng dẫn nhanh"),
      "Step 4 must have secondary link 'Xem hướng dẫn nhanh'"
    );
  });

  test("provides skip action (Bỏ qua) on steps 1-3", () => {
    assert.ok(
      onboardingSource.includes("Bỏ qua"),
      "Onboarding must provide 'Bỏ qua' button on steps 1-3"
    );
  });

  test("does NOT request browser notification permissions during onboarding", () => {
    assert.strictEqual(
      onboardingSource.includes("Notification.requestPermission"),
      false,
      "Notification permission must NOT be requested during onboarding"
    );
  });

  test("uses official ready illustration asset", () => {
    assert.ok(
      onboardingSource.includes("/design/onboarding-ready-illustration.webp"),
      "Step 4 must display /design/onboarding-ready-illustration.webp"
    );
    const assetPath = path.resolve(process.cwd(), "public/design/onboarding-ready-illustration.webp");
    assert.ok(fs.existsSync(assetPath), "Asset file must exist on disk");
    const stat = fs.statSync(assetPath);
    assert.ok(stat.size > 10000, "Asset file must be valid non-empty WebP image");
  });
});
