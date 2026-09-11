import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  mapDbNotification,
  formatNotificationContent,
  filterNotificationsByTab,
} from "../src/lib/notification-triage";

describe("Notification Integration & Actionable Hub Suite", () => {
  const sidebarContextPath = path.resolve(
    process.cwd(),
    "src/components/layout/sidebar-context.tsx"
  );
  const dashboardStatePath = path.resolve(
    process.cwd(),
    "src/hooks/use-dashboard-state.ts"
  );
  const topbarPath = path.resolve(
    process.cwd(),
    "src/components/layout/app-topbar.tsx"
  );
  const seedPath = path.resolve(process.cwd(), "prisma/seed.ts");

  test("sidebar-context does not hardcode notifications count to 5 or badge '5', badgeVariant: 'danger'", () => {
    const sidebarContent = fs.readFileSync(sidebarContextPath, "utf-8");
    assert.equal(
      sidebarContent.includes('badge: "5", badgeVariant: "danger"'),
      false,
      "Must not hardcode badge '5' danger in sidebar navigation items"
    );
    assert.equal(
      sidebarContent.includes('badge: "6"'),
      false,
      "Must not hardcode badge '6' in sidebar navigation items"
    );
    assert.equal(
      sidebarContent.includes('badge: "4"'),
      false,
      "Must not hardcode badge '4' in sidebar navigation items"
    );
    assert.equal(
      sidebarContent.includes('badge: "1"'),
      false,
      "Must not hardcode badge '1' in sidebar navigation items"
    );
    assert.equal(
      sidebarContent.includes("notifications: 5"),
      false,
      "DEFAULT_SIDEBAR_BADGES must not hardcode notifications to 5"
    );

    const dashboardStateContent = fs.readFileSync(dashboardStatePath, "utf-8");
    assert.equal(
      dashboardStateContent.includes("nextNotifications = 5"),
      false,
      "use-dashboard-state must not hardcode nextNotifications = 5"
    );
    assert.equal(
      dashboardStateContent.includes("notifications: 5"),
      false,
      "use-dashboard-state must not hardcode notifications: 5"
    );
  });

  test("app-topbar imports and mounts NotificationPopover", () => {
    const topbarContent = fs.readFileSync(topbarPath, "utf-8");
    assert.ok(
      topbarContent.includes("NotificationPopover"),
      "Topbar must import and mount NotificationPopover"
    );
    assert.ok(
      topbarContent.includes("isNotificationOpen"),
      "Topbar must maintain isNotificationOpen state for popover toggle"
    );
    assert.ok(
      topbarContent.includes("<NotificationPopover"),
      "Topbar JSX must render NotificationPopover component"
    );
  });

  test("notifications are actionable with clean task links and status indicators", () => {
    const seedContent = fs.readFileSync(seedPath, "utf-8");
    assert.ok(
      seedContent.includes("prisma.notification") ||
        seedContent.includes("prisma.notification.create") ||
        seedContent.includes("prisma.notification.upsert"),
      "prisma/seed.ts must seed notification records"
    );
    assert.ok(
      seedContent.includes("task_assigned"),
      "Seed must include task_assigned notification"
    );
    assert.ok(
      seedContent.includes("deliverable_submitted"),
      "Seed must include deliverable_submitted notification"
    );
    assert.ok(
      seedContent.includes("deadline_warning_24h"),
      "Seed must include deadline_warning_24h notification"
    );

    // Verify actionable mappings in notification-triage
    const mockAssignment = mapDbNotification({
      id: "notif-1",
      actorName: "ThS. Phạm Văn Tường",
      title: "Chuẩn bị Lễ Khai giảng năm học 2026-2027",
      body: "Giao nhiệm vụ hoàn thiện kịch bản",
      category: "Nhiệm vụ",
      type: "task_assigned",
      linkHref: "/tasks?code=NV-2026-09-038",
      isRead: false,
      createdAt: new Date().toISOString(),
    });

    assert.equal(mockAssignment.linkHref, "/tasks?code=NV-2026-09-038");
    assert.equal(mockAssignment.isRead, false);

    const formattedAssignment = formatNotificationContent(mockAssignment);
    assert.ok(
      formattedAssignment.actionText.length > 0,
      "Action text must be populated for task_assigned"
    );

    const mockReview = mapDbNotification({
      id: "notif-2",
      actorName: "ThS. Lê Văn Thí",
      title: "Báo cáo tự đánh giá chất lượng",
      body: "Đã nộp minh chứng chờ duyệt",
      category: "Minh chứng",
      type: "deliverable_submitted",
      linkHref: "/tasks?tab=review",
      isRead: false,
      createdAt: new Date().toISOString(),
    });

    const approvals = filterNotificationsByTab([mockReview], "approvals");
    assert.equal(approvals.length, 1, "deliverable_submitted must triage to approvals tab");

    const mockDeadline = mapDbNotification({
      id: "notif-3",
      actorName: "Hệ thống QCET",
      title: "Báo cáo thanh tra tháng 9 (Hạn: 24h)",
      body: "Sắp đến hạn hoàn thành",
      category: "Nhắc việc",
      type: "deadline_warning_24h",
      linkHref: "/tasks?urgent=true",
      isRead: false,
      createdAt: new Date().toISOString(),
    });

    const reminders = filterNotificationsByTab([mockDeadline], "reminders");
    assert.equal(reminders.length, 1, "deadline_warning_24h must triage to reminders tab");
  });
});
