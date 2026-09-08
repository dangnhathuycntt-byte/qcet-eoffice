import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ONBOARDING_FEATURES } from "../src/lib/onboarding-constants";

describe("Task 6: Academic Microcopy & Tone Detox", () => {
  const userProfile = fs.readFileSync(
    path.join(process.cwd(), "src/components/auth/user-profile-modal.tsx"),
    "utf8"
  );
  const googleBtn = fs.readFileSync(
    path.join(process.cwd(), "src/components/auth/google-login-button.tsx"),
    "utf8"
  );
  const roleBanner = fs.readFileSync(
    path.join(process.cwd(), "src/components/auth/role-viewpoint-banner.tsx"),
    "utf8"
  );
  const welcomeModal = fs.readFileSync(
    path.join(process.cwd(), "src/components/onboarding/welcome-modal.tsx"),
    "utf8"
  );
  const checklistWidget = fs.readFileSync(
    path.join(process.cwd(), "src/components/onboarding/onboarding-checklist-widget.tsx"),
    "utf8"
  );
  const taskTable = fs.readFileSync(
    path.join(process.cwd(), "src/components/tasks/cascading-task-table.tsx"),
    "utf8"
  );

  it("user-profile-modal.tsx addresses user with respect ('Quý Thầy/Cô') and formal role subtitles", () => {
    assert.match(userProfile, /Kính chào Quý Thầy\/Cô đến với QCET E-Office!/);
    assert.doesNotMatch(userProfile, /Chào mừng bạn đến với QCET E-Office!/);
    assert.match(userProfile, /Thực hiện nhiệm vụ & Nộp minh chứng/);
    assert.match(userProfile, /Lãnh đạo đơn vị & Phê duyệt/);
    assert.match(userProfile, /Chỉ đạo & Điều hành toàn trường/);
  });

  it("google-login-button.tsx uses formal civil-service copy and hides internal route URLs", () => {
    assert.match(googleBtn, /Đăng nhập bằng Email công vụ Nhà trường/);
    assert.match(googleBtn, /Đã sao chép/);
    assert.doesNotMatch(googleBtn, /Đã copy/);
    assert.doesNotMatch(googleBtn, /Vẫn thử tới \/api\/auth\/google/);
    assert.match(googleBtn, /Tiếp tục kết nối xác thực Google/);
    assert.match(googleBtn, /Đóng thông báo/);
  });

  it("role-viewpoint-banner.tsx eliminates tautology and uses formal title", () => {
    assert.match(roleBanner, /Nhiệm vụ trực tiếp: Các công việc được phân công cho/);
    assert.match(roleBanner, /Viên chức thực hiện/);
  });

  it("onboarding-constants.ts replaces tech jargon with official administrative terminology", () => {
    const allText = JSON.stringify(ONBOARDING_FEATURES);
    assert.doesNotMatch(allText, /Radar & Điểm Nghẽn/);
    assert.doesNotMatch(allText, /Tìm Kiếm Toàn Năng/);
    assert.doesNotMatch(allText, /tra cứu thần tốc/);
    assert.doesNotMatch(allText, /Nghị quyết can thiệp/);
    assert.match(allText, /Tiến Độ & Hồ Sơ Tồn Đọng/);
    assert.match(allText, /kịp thời đôn đốc và chỉ đạo/);
  });

  it("welcome-modal.tsx removes SaaS 45-second marketing formula", () => {
    assert.doesNotMatch(welcomeModal, /Khám phá trong 45 giây/);
    assert.match(welcomeModal, /Xem hướng dẫn sử dụng/);
  });

  it("checklist-widget.tsx removes casual 'Tour' and keeps faculty respect", () => {
    assert.doesNotMatch(checklistWidget, /Tour/);
    assert.match(checklistWidget, /Xem hướng dẫn từng bước/);
  });

  it("cascading-task-table.tsx standardizes task statuses to formal reporting terms", () => {
    assert.match(taskTable, /"Đang thực hiện"/);
    assert.match(taskTable, /"Chờ phê duyệt"/);
    assert.doesNotMatch(taskTable, /"Đang làm"/);
    assert.doesNotMatch(taskTable, /"Cần duyệt"/);
  });
});
