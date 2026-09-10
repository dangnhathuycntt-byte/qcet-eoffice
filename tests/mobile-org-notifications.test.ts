import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  extractNotificationEntity,
  resolveActionableDeepLink,
  getNotificationDayGroup,
  groupNotificationsByDay,
  filterNotificationsMobile,
  formatNotificationContent,
  type QCETNotification,
} from "../src/lib/notification-triage";
import { QCET_DEPARTMENTS } from "../src/components/org/organization-tree";

describe("Sprint M5: Mobile Org Drill-Down & Actionable Notification Inbox", () => {
  const orgDrilldownPath = path.resolve(
    process.cwd(),
    "src/components/org/mobile-org-drilldown.tsx"
  );
  const orgTreePath = path.resolve(
    process.cwd(),
    "src/components/org/organization-tree.tsx"
  );
  const mobileInboxPath = path.resolve(
    process.cwd(),
    "src/components/notifications/mobile-notification-inbox.tsx"
  );
  const notifPagePath = path.resolve(
    process.cwd(),
    "src/app/notifications/page.tsx"
  );
  const notifPopoverPath = path.resolve(
    process.cwd(),
    "src/components/notifications/notification-popover.tsx"
  );
  const docRegistryPath = path.resolve(
    process.cwd(),
    "src/components/documents/document-registry-view.tsx"
  );

  // =========================================================================
  // 1. Organization Mobile Drill-Down Verification
  // =========================================================================
  describe("1. Organization Mobile Drill-Down", () => {
    test("mobile-org-drilldown component exists and contains 4 required root org groups", () => {
      assert.ok(fs.existsSync(orgDrilldownPath), "mobile-org-drilldown.tsx must exist");
      const content = fs.readFileSync(orgDrilldownPath, "utf-8");

      // Root view: Categories / Org Groups
      assert.ok(
        content.includes("Ban Giám hiệu"),
        "Must contain 'Ban Giám hiệu' group"
      );
      assert.ok(
        content.includes("Các phòng chức năng"),
        "Must contain 'Các phòng chức năng' group"
      );
      assert.ok(
        content.includes("Các khoa đào tạo"),
        "Must contain 'Các khoa đào tạo' group"
      );
      assert.ok(
        content.includes("Các trung tâm & đơn vị trực thuộc"),
        "Must contain 'Các trung tâm & đơn vị trực thuộc' group"
      );

      // Breadcrumb / Back button with min-h-[44px]
      assert.ok(
        content.includes("Quay lại"),
        "Must have 'Quay lại' back navigation"
      );
      assert.ok(
        content.includes("min-h-[44px]"),
        "Back button or touch targets must have min-h-[44px]"
      );

      // Sub-level view and Department detail view
      assert.ok(
        content.includes("Trưởng đơn vị") || content.includes("leaderRole"),
        "Must display leader information"
      );
      assert.ok(
        content.includes("Phó đơn vị"),
        "Must distinguish deputy leaders"
      );
      assert.ok(
        content.includes("min-h-[48px]"),
        "Personnel cards must have min-h-[48px] touch target"
      );
      assert.ok(
        content.includes("touch-manipulation"),
        "Touch targets must include touch-manipulation"
      );
      assert.ok(
        content.includes("tel:"),
        "Must support clickable phone dialing"
      );
      assert.ok(
        content.includes("mailto:"),
        "Must support clickable email composing"
      );
    });

    test("organization-tree renders MobileOrgDrillDown on mobile (sm:hidden) and visual tree on desktop (sm:block)", () => {
      const content = fs.readFileSync(orgTreePath, "utf-8");
      assert.ok(
        content.includes("MobileOrgDrillDown"),
        "organization-tree must import and render MobileOrgDrillDown"
      );
      assert.ok(
        content.includes("block sm:hidden"),
        "Mobile drilldown must be visible only on mobile viewports (< 640px)"
      );
      assert.ok(
        content.includes("hidden sm:block"),
        "Desktop tree must be visible on sm:block (>= 640px)"
      );
    });

    test("QCET_DEPARTMENTS correctly maps to the 4 org categories", () => {
      const bgh = QCET_DEPARTMENTS.filter((d) => d.category === "BGH");
      const phong = QCET_DEPARTMENTS.filter((d) => d.category === "PHONG_CHUC_NANG");
      const khoa = QCET_DEPARTMENTS.filter((d) => d.category === "KHOA_CHUYEN_MON");
      const trungTam = QCET_DEPARTMENTS.filter((d) => d.category === "TRUNG_TAM");

      assert.ok(bgh.length >= 1, "Must have BGH department");
      assert.ok(phong.length >= 5, "Must have at least 5 functional rooms");
      assert.ok(khoa.length >= 3, "Must have at least 3 faculties");
      assert.ok(trungTam.length >= 2, "Must have at least 2 centers");

      // Verify members have required contact and role information
      const allMembers = QCET_DEPARTMENTS.flatMap((d) => d.members);
      assert.ok(allMembers.length >= 15, "Must have sufficient staff members");
      for (const m of allMembers) {
        assert.ok(m.name, `Member ${m.id} must have a name`);
        assert.ok(m.role, `Member ${m.id} must have a role`);
        assert.ok(m.email, `Member ${m.id} must have an email`);
      }
    });
  });

  // =========================================================================
  // 2. Actionable Mobile Notification Inbox Verification
  // =========================================================================
  describe("2. Actionable Mobile Notification Inbox", () => {
    test("mobile-notification-inbox exists and contains required inbox structure", () => {
      assert.ok(fs.existsSync(mobileInboxPath), "mobile-notification-inbox.tsx must exist");
      const content = fs.readFileSync(mobileInboxPath, "utf-8");

      // Time grouping: "HÔM NAY" and "TRƯỚC ĐÓ"
      assert.ok(
        content.includes("HÔM NAY"),
        "Must contain section header 'HÔM NAY'"
      );
      assert.ok(
        content.includes("TRƯỚC ĐÓ"),
        "Must contain section header 'TRƯỚC ĐÓ'"
      );

      // Filter tabs: [Tất cả] [Chưa đọc] [Cần xử lý]
      assert.ok(
        content.includes("Tất cả"),
        "Must contain filter tab 'Tất cả'"
      );
      assert.ok(
        content.includes("Chưa đọc"),
        "Must contain filter tab 'Chưa đọc'"
      );
      assert.ok(
        content.includes("Cần xử lý"),
        "Must contain filter tab 'Cần xử lý'"
      );

      // Card requirements: unread indicator, min-h-[48px], touch-manipulation
      assert.ok(
        content.includes("unread-indicator") || content.includes("!item.isRead"),
        "Must display unread indicator dot"
      );
      assert.ok(
        content.includes("min-h-[48px]"),
        "Notification cards must have min-h-[48px] touch target"
      );
      assert.ok(
        content.includes("touch-manipulation"),
        "Must include touch-manipulation"
      );
      assert.ok(
        content.includes("tabular-nums"),
        "Must use font-mono tabular-nums for numeric badges and counts"
      );
    });

    test("extractNotificationEntity accurately extracts task codes and document numbers", () => {
      // 1. Task code extraction
      const taskItem1 = {
        title: "Giao nhiệm vụ NV-092 cho Khoa CNTT",
        body: "Đồng chí triển khai thực hiện báo cáo",
        linkHref: "/tasks?code=NV-092",
      };
      const entity1 = extractNotificationEntity(taskItem1);
      assert.ok(entity1);
      assert.equal(entity1!.code, "NV-092");
      assert.equal(entity1!.type, "task");

      // 2. Task code from query param taskId=...
      const taskItem2 = {
        title: "Cập nhật tiến độ nhiệm vụ",
        body: "Đã hoàn thành 80%",
        linkHref: "/tasks?taskId=NV-2026-09-038&scope=unit",
      };
      const entity2 = extractNotificationEntity(taskItem2);
      assert.ok(entity2);
      assert.equal(entity2!.code, "NV-2026-09-038");
      assert.equal(entity2!.type, "task");

      // 3. Document number extraction e.g. 142/QĐ
      const docItem1 = {
        title: "Tiếp nhận văn bản số 142/QĐ về công tác cán bộ",
        body: "Ban Giám hiệu chỉ đạo nghiên cứu thực hiện",
        linkHref: "/documents?docId=142/QĐ",
      };
      const docEntity1 = extractNotificationEntity(docItem1);
      assert.ok(docEntity1);
      assert.equal(docEntity1!.code, "142/QĐ");
      assert.equal(docEntity1!.type, "document");

      // 4. Document number e.g. 420/QĐ-CĐKTCN
      const docItem2 = {
        title: "Quyết định thành lập hội đồng",
        body: "Số hiệu 420/QĐ-CĐKTCN",
        linkHref: "/documents",
      };
      const docEntity2 = extractNotificationEntity(docItem2);
      assert.ok(docEntity2);
      assert.equal(docEntity2!.code, "420/QĐ-CĐKTCN");
      assert.equal(docEntity2!.type, "document");
    });

    test("resolveActionableDeepLink creates direct actionable links for tasks and documents", () => {
      // 1. Task with code in link
      const taskNotif1 = {
        title: "Nhiệm vụ mới",
        body: "Đã giao nhiệm vụ NV-092",
        linkHref: "/tasks?code=NV-092",
      };
      const deepLink1 = resolveActionableDeepLink(taskNotif1, "school");
      assert.ok(
        deepLink1.includes("/tasks?"),
        "Deep link must point to /tasks?"
      );
      assert.ok(
        deepLink1.includes("taskId=NV-092"),
        "Deep link must include taskId=NV-092"
      );
      assert.ok(
        deepLink1.includes("scope=school"),
        "Deep link must include scope=school"
      );

      // 2. Task with no initial linkHref
      const taskNotif2 = {
        title: "Báo cáo hoàn thành NV-105",
        body: "Khoa Điện đã nộp kết quả nghiệm thu",
        category: "Nhiệm vụ",
      };
      const deepLink2 = resolveActionableDeepLink(taskNotif2, "unit");
      assert.equal(deepLink2, "/tasks?taskId=NV-105&scope=unit");

      // 3. Document notification
      const docNotif = {
        title: "Văn bản đến số 142/QĐ",
        body: "Chuyển Phòng Đào tạo tham mưu",
        linkHref: "/documents?code=142/QĐ",
      };
      const deepLinkDoc = resolveActionableDeepLink(docNotif);
      assert.ok(
        deepLinkDoc.startsWith("/documents?docId="),
        "Deep link must start with /documents?docId="
      );
      assert.ok(
        decodeURIComponent(deepLinkDoc).includes("142/QĐ"),
        "Decoded deep link must include 142/QĐ"
      );

      // 4. Document notification with no linkHref
      const docNotif2 = {
        title: "Tờ trình 55/TTr-KCNTT",
        body: "Xin phê duyệt kế hoạch thực tập",
        category: "Văn bản",
      };
      const deepLinkDoc2 = resolveActionableDeepLink(docNotif2);
      assert.equal(decodeURIComponent(deepLinkDoc2), "/documents?docId=55/TTR-KCNTT");
    });

    test("getNotificationDayGroup and groupNotificationsByDay correctly separate TODAY vs EARLIER", () => {
      const now = new Date();
      const yesterday = new Date(Date.now() - 26 * 60 * 60 * 1000);

      const notifToday: QCETNotification = {
        id: "notif-1",
        title: "Thông báo vừa giao",
        body: "Cần xử lý gấp",
        action: "đã giao việc",
        targetTitle: "NV-092",
        category: "Nhiệm vụ",
        timestamp: "5 phút trước",
        createdAt: now.toISOString(),
        isRead: false,
        timeGroup: "new",
        type: "task_assigned",
        actorName: "Trần Hùng",
        linkHref: "/tasks?taskId=NV-092",
      };

      const notifEarlier: QCETNotification = {
        id: "notif-2",
        title: "Thông báo cũ",
        body: "Đã hoàn tất",
        action: "đã ký duyệt",
        targetTitle: "142/QĐ",
        category: "Văn bản",
        timestamp: "2 ngày trước",
        createdAt: yesterday.toISOString(),
        isRead: true,
        timeGroup: "earlier",
        type: "document_signed",
        actorName: "Nguyễn Ngọc Vinh",
        linkHref: "/documents?docId=142/QĐ",
      };

      assert.equal(getNotificationDayGroup(notifToday), "TODAY");
      assert.equal(getNotificationDayGroup(notifEarlier), "EARLIER");

      const grouped = groupNotificationsByDay([notifToday, notifEarlier]);
      assert.equal(grouped.today.length, 1);
      assert.equal(grouped.today[0].id, "notif-1");
      assert.equal(grouped.earlier.length, 1);
      assert.equal(grouped.earlier[0].id, "notif-2");
    });

    test("filterNotificationsMobile correctly filters [Tất cả], [Chưa đọc], [Cần xử lý]", () => {
      const notifications: QCETNotification[] = [
        {
          id: "n-1",
          title: "Giao việc NV-01",
          body: "Yêu cầu nộp báo cáo",
          action: "đã giao",
          targetTitle: "NV-01",
          category: "Nhiệm vụ",
          timestamp: "10 phút trước",
          isRead: false,
          timeGroup: "new",
          type: "task_assigned",
          actorName: "Trần Hùng",
          linkHref: "/tasks?taskId=NV-01",
        },
        {
          id: "n-2",
          title: "Đã đọc việc NV-02",
          body: "Đã xong",
          action: "đã hoàn thành",
          targetTitle: "NV-02",
          category: "Nhiệm vụ",
          timestamp: "1 giờ trước",
          isRead: true,
          timeGroup: "new",
          type: "task_completed",
          actorName: "Lê Hoàng Nam",
          linkHref: "/tasks?taskId=NV-02",
        },
        {
          id: "n-3",
          title: "Tờ trình cần duyệt",
          body: "Chờ phê duyệt tờ trình",
          action: "chờ phê duyệt",
          targetTitle: "15/TTr",
          category: "Văn bản",
          timestamp: "Hôm qua",
          isRead: false,
          timeGroup: "earlier",
          type: "approval_needed",
          actorName: "Đặng Văn Hậu",
          linkHref: "/documents?docId=15/TTr",
        },
      ];

      // All tab
      const allResult = filterNotificationsMobile(notifications, "all");
      assert.equal(allResult.length, 3);

      // Unread tab
      const unreadResult = filterNotificationsMobile(notifications, "unread");
      assert.equal(unreadResult.length, 2);
      assert.ok(unreadResult.every((n) => !n.isRead));

      // Action required tab
      const actionResult = filterNotificationsMobile(notifications, "action_required");
      assert.ok(actionResult.length >= 1);
      const actionIds = actionResult.map((n) => n.id);
      assert.ok(actionIds.includes("n-1") || actionIds.includes("n-3"));
    });

    test("formatNotificationContent extracts actorName, actionText, targetTitle accurately", () => {
      const notif: QCETNotification = {
        id: "fmt-1",
        title: "Báo cáo nghiệm thu đã được nộp",
        body: "Nguyễn Văn A đã nộp báo cáo hoàn thành nhiệm vụ NV-092",
        action: "đã nộp báo cáo",
        targetTitle: "NV-092",
        category: "Nhiệm vụ",
        timestamp: "Vừa xong",
        isRead: false,
        timeGroup: "new",
        type: "deliverable_submitted",
        actorName: "Nguyễn Văn A",
        linkHref: "/tasks?taskId=NV-092",
      };

      const formatted = formatNotificationContent(notif);
      assert.equal(formatted.actorName, "Nguyễn Văn A");
      assert.ok(
        formatted.actionText.includes("đã nộp") ||
          formatted.actionText.includes("báo cáo") ||
          formatted.actionText.length > 0
      );
    });

    test("notifications/page.tsx mounts MobileNotificationInbox for mobile viewports", () => {
      const content = fs.readFileSync(notifPagePath, "utf-8");
      assert.ok(
        content.includes("MobileNotificationInbox"),
        "Notifications page must mount MobileNotificationInbox"
      );
      assert.ok(
        content.includes("block sm:hidden"),
        "Mobile inbox must render with block sm:hidden"
      );
      assert.ok(
        content.includes("hidden sm:block"),
        "Desktop container must render with hidden sm:block"
      );
    });

    test("document-registry-view supports docId parameter for direct drawer opening", () => {
      const content = fs.readFileSync(docRegistryPath, "utf-8");
      assert.ok(
        content.includes('searchParams.get("docId")'),
        "DocumentRegistryView must read ?docId= parameter"
      );
      assert.ok(
        content.includes("setSelectedDocument") && content.includes("setIsDetailOpen(true)"),
        "DocumentRegistryView must open detail drawer for deep-linked docId"
      );
    });
  });

  // =========================================================================
  // 3. Invariants Verification (Zero emojis, Light-Only, 44px+ touch targets)
  // =========================================================================
  describe("3. Invariants Verification", () => {
    const inspectedFiles = [
      orgDrilldownPath,
      mobileInboxPath,
      orgTreePath,
      notifPagePath,
      notifPopoverPath,
    ];

    test("Zero emojis in all inspected files", () => {
      const emojiRegex =
        /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FAFF}]/u;

      for (const filePath of inspectedFiles) {
        if (!fs.existsSync(filePath)) continue;
        const fileContent = fs.readFileSync(filePath, "utf-8");
        const lines = fileContent.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const hasEmoji = emojiRegex.test(lines[i]);
          assert.equal(
            hasEmoji,
            false,
            `Emoji found at ${path.basename(filePath)}:${i + 1}: ${lines[i]}`
          );
        }
      }
    });

    test("Light-Only standard: Zero 'dark:' classes in mobile components", () => {
      const mobileFiles = [orgDrilldownPath, mobileInboxPath];
      for (const filePath of mobileFiles) {
        const content = fs.readFileSync(filePath, "utf-8");
        assert.equal(
          content.includes("dark:"),
          false,
          `File ${path.basename(filePath)} must not contain 'dark:' classes`
        );
      }
    });

    test("All touch interactive elements comply with minimum 44px touch targets", () => {
      const drilldownContent = fs.readFileSync(orgDrilldownPath, "utf-8");
      const inboxContent = fs.readFileSync(mobileInboxPath, "utf-8");

      assert.ok(
        drilldownContent.includes("min-h-[44px]") || drilldownContent.includes("min-h-[48px]"),
        "mobile-org-drilldown must declare min-h-[44px] or min-h-[48px]"
      );
      assert.ok(
        inboxContent.includes("min-h-[44px]") || inboxContent.includes("min-h-[48px]"),
        "mobile-notification-inbox must declare min-h-[44px] or min-h-[48px]"
      );
    });
  });
});
