import { describe, test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CANONICAL_ROUTES,
  getRouteByPath,
  getSidebarNavItems,
} from "../src/lib/navigation/canonical-navigation-registry";
import { isRouteActive, resolveBreadcrumb } from "../src/lib/navigation/active-matcher";
import { getInboxEmptyCopy } from "../src/components/inbox/inbox-view";
import {
  formatNotificationContent,
  filterNotificationsByTab,
  mapDbNotification,
  type QCETNotification,
} from "@qcet/shared/lib/notification-triage";

describe("QCET App Shell & Inbox Test Suite", () => {
  describe("1. Canonical Navigation Registry & Inbox Route", () => {
    test("defines /inbox with label 'Hộp thư' and Inbox icon", () => {
      const inboxRoute = CANONICAL_ROUTES.find((r) => r.href === "/inbox");
      assert.ok(inboxRoute, "Must define /inbox route");
      assert.equal(inboxRoute.id, "inbox");
      assert.equal(inboxRoute.label, "Hộp thư");
      assert.equal(inboxRoute.iconName, "Inbox");
      assert.equal(inboxRoute.badgeKey, "notifications");
      assert.ok(inboxRoute.aliases?.includes("/notifications"), "Must include /notifications alias");
    });

    test("getRouteByPath resolves /inbox and legacy /notifications alias", () => {
      const routeInbox = getRouteByPath("/inbox");
      assert.ok(routeInbox);
      assert.equal(routeInbox.id, "inbox");

      const routeLegacy = getRouteByPath("/notifications");
      assert.ok(routeLegacy);
      assert.equal(routeLegacy.id, "inbox");
    });

    test("resolveBreadcrumb maps /inbox to 'Hộp thư'", () => {
      const [rootTitle, pageTitle] = resolveBreadcrumb("/inbox");
      assert.equal(rootTitle, "QCET E-Office");
      assert.equal(pageTitle, "Hộp thư");
    });

    test("isRouteActive accurately handles /inbox and legacy /notifications", () => {
      assert.equal(isRouteActive("/inbox", "/inbox"), true);
      assert.equal(isRouteActive("/inbox", "/notifications"), true);
      assert.equal(isRouteActive("/inbox", "/tasks"), false);
    });
  });

  describe("2. Notification Triage & Formatting Invariants", () => {
    const mockNotifs: QCETNotification[] = [
      {
        id: "notif-1",
        actorName: "ThS. Đặng Nhật Huy",
        action: "Giao nhiệm vụ: Chuẩn bị hồ sơ tuyển sinh đợt 2",
        targetTitle: "Kế hoạch tuyển sinh Đợt 2",
        timestamp: "10 phút trước",
        category: "ĐÀO TẠO",
        isRead: false,
        type: "task_assigned",
        linkHref: "/tasks?taskId=task-01",
      },
      {
        id: "notif-2",
        actorName: "Ban Giám hiệu",
        action: "Đã phê duyệt tờ trình tổ chức hội thảo",
        targetTitle: "Tờ trình Hội thảo NCKH 2026",
        timestamp: "1 giờ trước",
        category: "KHOA HỌC",
        isRead: true,
        type: "review",
        linkHref: "/tasks?taskId=task-02",
      },
      {
        id: "notif-3",
        actorName: "Hệ thống QCET",
        action: "Nhiệm vụ sắp đến hạn trong vòng 24h tới",
        targetTitle: "Báo cáo tài chính quý 3",
        timestamp: "Hôm qua",
        category: "TÀI CHÍNH",
        isRead: false,
        type: "deadline_warning_24h",
        linkHref: "/tasks?taskId=task-03",
      },
    ];

    test("formatNotificationContent cleans prefix and extracts metadata without duplication", () => {
      const formatted = formatNotificationContent(mockNotifs[0]);
      assert.equal(formatted.actorName, "ThS. Đặng Nhật Huy");
      assert.equal(formatted.targetTitle, "Kế hoạch tuyển sinh Đợt 2");
      assert.ok(formatted.actionText.includes("Giao nhiệm vụ"));
    });

    test("filterNotificationsByTab categorizes items accurately", () => {
      const all = filterNotificationsByTab(mockNotifs, "all");
      assert.equal(all.length, 3);

      const actionReq = filterNotificationsByTab(mockNotifs, "action_required");
      assert.equal(actionReq.length, 1);
      assert.equal(actionReq[0].id, "notif-1");

      const approvals = filterNotificationsByTab(mockNotifs, "approvals");
      assert.equal(approvals.length, 1);
      assert.equal(approvals[0].id, "notif-2");

      const reminders = filterNotificationsByTab(mockNotifs, "reminders");
      assert.equal(reminders.length, 1);
      assert.equal(reminders[0].id, "notif-3");
    });

    test("mapDbNotification transforms raw DB record safely", () => {
      const raw = {
        id: "db-1",
        title: "Chỉ đạo về phân bổ ngân sách",
        body: "Đồng ý cấp kinh phí mua sắm thiết bị",
        isRead: false,
        category: "BGH",
        type: "executive_directive",
        createdAt: new Date("2026-09-16T08:00:00Z"),
      };
      const mapped = mapDbNotification(raw);
      assert.equal(mapped.id, "db-1");
      assert.equal(mapped.targetTitle, "Chỉ đạo về phân bổ ngân sách");
      assert.equal(mapped.isRead, false);
      assert.equal(mapped.category, "BGH");
      assert.equal(mapped.type, "executive_directive");
    });
  });

  describe("3. Desktop Layout & Mobile Header Invariants", () => {
    test("sidebar nav items start with inbox and tasks (no Tổng quan since 19/10/2026)", () => {
      const items = getSidebarNavItems();
      assert.deepEqual(
        items.map((i) => i.id),
        ["inbox", "tasks", "meetings", "documents", "org", "settings"]
      );
    });
  });

  describe("Hộp thư trống", () => {
    test("nói đúng lý do và việc làm tiếp: lỗi tải ưu tiên, rồi lọc không ra, đã đọc hết, chưa có thông báo", () => {
      const pick = (o: Parameters<typeof getInboxEmptyCopy>[0]) => {
        const c = getInboxEmptyCopy(o);
        return [c.illustration, c.title, c.action ?? null];
      };
      assert.deepEqual(pick({ failed: true, hasCondition: true, unreadOnly: true }), ["load-error", "Không tải được hộp thư", "retry"]);
      assert.deepEqual(pick({ failed: false, hasCondition: true, unreadOnly: true }), ["no-results", "Không có thông báo phù hợp", "clear"]);
      assert.deepEqual(pick({ failed: false, hasCondition: false, unreadOnly: true }), ["all-done", "Đã đọc hết", "show-all"]);
      assert.deepEqual(pick({ failed: false, hasCondition: false, unreadOnly: false }), ["inbox", "Không có thông báo", null]);
    });
  });
});
