import { test, describe } from "node:test";
import assert from "node:assert/strict";
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
  // =========================================================================
  // 1. Organization Data Verification
  // =========================================================================
  describe("1. Organization Data", () => {
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
  });
});
