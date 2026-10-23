import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  buildNotificationWhere,
  decodeNotificationCursor,
  encodeNotificationCursor,
} from "../apps/api/src/server/notifications/notification-query";
import {
  formatNotificationAbsoluteTime,
  formatNotificationTime,
  formatUnreadBadge,
  getNotificationDisplayTitle,
  getNotificationEventLabel,
  getNotificationFocus,
  getNotificationHref,
  getNotificationSnippet,
  getNotificationTimeBucket,
  groupNotificationsByTarget,
  resolveNotificationTarget,
} from "../apps/web/src/lib/notification-inbox";
import { filterNotificationsByTab, mapDbNotification } from "@qcet/shared/lib/notification-triage";

const NOW = new Date("2026-10-09T16:30:00.000Z"); // 23:30 ICT

describe("formatNotificationTime", () => {
  test("dùng phút/giờ/ngày trong 7 ngày, không viết tắt", () => {
    assert.equal(formatNotificationTime(new Date(NOW.getTime() - 30_000), NOW), "Vừa xong");
    assert.equal(formatNotificationTime(new Date(NOW.getTime() - 5 * 60_000), NOW), "5 phút");
    assert.equal(formatNotificationTime(new Date(NOW.getTime() - 2 * 3_600_000), NOW), "2 giờ");
    assert.equal(formatNotificationTime(new Date(NOW.getTime() - 3 * 86_400_000), NOW), "3 ngày");
  });

  test("từ 7 ngày hiện ngày theo ICT, khác năm kèm năm", () => {
    assert.equal(formatNotificationTime("2026-09-27T03:00:00.000Z", NOW), "27/09");
    // 31/12/2025 20:00 UTC là 01/01/2026 ICT
    assert.equal(formatNotificationTime("2025-12-31T20:00:00.000Z", NOW), "01/01");
    assert.equal(formatNotificationTime("2025-12-31T10:00:00.000Z", NOW), "31/12/2025");
  });

  test("timestamp thiếu/lỗi rỗng, tương lai không thành 'Vừa xong'", () => {
    assert.equal(formatNotificationTime(undefined, NOW), "");
    assert.equal(formatNotificationTime("not-a-date", NOW), "");
    assert.equal(formatNotificationTime("2026-10-12T03:00:00.000Z", NOW), "12/10");
  });

  test("thời gian tuyệt đối theo GMT+7", () => {
    assert.equal(formatNotificationAbsoluteTime("2026-10-09T14:32:00.000Z"), "09/10/2026 21:32 (GMT+7)");
    assert.equal(formatNotificationAbsoluteTime(null), "");
  });
});

describe("resolveNotificationTarget", () => {
  test("không dựng đích cho '/', URL ngoài hoặc rỗng", () => {
    assert.equal(resolveNotificationTarget("/"), null);
    assert.equal(resolveNotificationTarget(""), null);
    assert.equal(resolveNotificationTarget(undefined), null);
    assert.equal(resolveNotificationTarget("https://evil.example/tasks/1"), null);
    assert.equal(resolveNotificationTarget("//evil.example/tasks/1"), null);
  });

  test("nhận nhiệm vụ theo query và path", () => {
    const q = resolveNotificationTarget("/tasks?taskId=abc");
    assert.equal(q?.kind, "task");
    assert.equal(q?.taskId, "abc");
    assert.equal(q?.ctaLabel, "Mở nhiệm vụ");
    assert.equal(resolveNotificationTarget("/tasks/xyz")?.taskId, "xyz");
  });

  test("/documents?id= dẫn tới trang chi tiết văn bản", () => {
    const t = resolveNotificationTarget("/documents?id=doc%201");
    assert.equal(t?.kind, "document");
    assert.equal(t?.href, "/documents?docId=doc%201");
    assert.equal(t?.ctaLabel, "Mở văn bản");
  });
});

describe("mapDbNotification với DTO hiện hành", () => {
  test("đọc message/link, không bịa người gửi hay liên kết", () => {
    const n = mapDbNotification({
      id: "n1",
      title: "[GIAO VIỆC] EEE",
      message: "Nội dung thật",
      link: "/tasks?taskId=t1",
      type: "assigned",
      isRead: false,
      actorName: null,
      createdAt: "2026-10-09T14:00:00.000Z",
    });
    assert.equal(n.body, "Nội dung thật");
    assert.equal(n.linkHref, "/tasks?taskId=t1");
    assert.equal(n.hasActor, false);
    assert.equal(getNotificationDisplayTitle(n), "EEE");

    const noLink = mapDbNotification({ id: "n2", title: "x", message: "", type: "general", isRead: true });
    assert.equal(noLink.linkHref, undefined);
    assert.equal(noLink.createdAt, undefined);
    assert.equal(noLink.isArchived, false);
    assert.equal(mapDbNotification({ id: "n3", title: "x", message: "", type: "general", isRead: true, archivedAt: "2026-10-09T14:00:00.000Z" }).isArchived, true);
  });

  test("nhãn sự kiện, type lạ dùng nhãn trung tính", () => {
    assert.equal(getNotificationEventLabel("assigned"), "Giao nhiệm vụ");
    assert.equal(getNotificationEventLabel("DOCUMENT_OVERDUE"), "Văn bản trễ hạn");
    assert.equal(getNotificationEventLabel("something_new"), "Thông báo");
  });

  test("nhắc hạn chỉ theo type, không suy từ chữ 'hạn'", () => {
    const list = [
      mapDbNotification({ id: "a", title: "Gia hạn hợp đồng", message: "", type: "assigned", isRead: false }),
      mapDbNotification({ id: "b", title: "Văn bản", message: "", type: "DOCUMENT_OVERDUE", isRead: false }),
    ];
    assert.deepEqual(filterNotificationsByTab(list, "reminders").map((n) => n.id), ["b"]);
  });
});

describe("groupNotificationsByTarget", () => {
  const make = (id: string, link: string | null, at: string, isRead = false) =>
    mapDbNotification({ id, title: id, message: "", type: "assigned", link, isRead, createdAt: at });

  test("một hàng mỗi đối tượng, sắp theo sự kiện mới nhất", () => {
    const groups = groupNotificationsByTarget([
      make("old-t1", "/tasks?taskId=t1", "2026-10-01T00:00:00.000Z", true),
      make("doc", "/documents?id=d1", "2026-10-05T00:00:00.000Z"),
      make("new-t1", "/tasks/t1", "2026-10-08T00:00:00.000Z"),
      make("lonely", null, "2026-10-03T00:00:00.000Z"),
    ]);
    assert.deepEqual(groups.map((g) => g.key), ["task:t1", "document:d1", "notification:lonely"]);
    assert.equal(groups[0].latest.id, "new-t1");
    assert.deepEqual(groups[0].items.map((n) => n.id), ["new-t1", "old-t1"]);
    assert.deepEqual(groups[0].unreadIds, ["new-t1"]);
  });

  test("bỏ trùng ID khi trang tải thêm lặp lại", () => {
    const a = make("a", "/tasks/t1", "2026-10-08T00:00:00.000Z");
    assert.equal(groupNotificationsByTarget([a, a])[0].items.length, 1);
  });
});

describe("buildNotificationWhere & cursor", () => {
  test("cursor mã hóa/giải mã hai chiều; giá trị lạ bị bỏ qua", () => {
    const at = new Date("2026-10-09T10:00:00.000Z");
    assert.deepEqual(decodeNotificationCursor(encodeNotificationCursor(at, "id1")), { createdAt: at, id: "id1" });
    assert.equal(decodeNotificationCursor("garbage"), null);
    assert.equal(decodeNotificationCursor("bad-date|id"), null);
  });

  test("luôn giới hạn theo người dùng; unread, triage, từ khóa, cursor", () => {
    const at = new Date("2026-10-09T10:00:00.000Z");
    const where = buildNotificationWhere({
      userId: "u1",
      unreadOnly: true,
      triage: "reminders",
      q: "  báo cáo ",
      cursor: encodeNotificationCursor(at, "id9"),
    }) as any;
    assert.equal(where.userId, "u1");
    assert.equal(where.isRead, false);
    assert.ok(where.AND[0].type.in.includes("document_overdue"));
    assert.ok(where.AND[0].type.in.includes("DOCUMENT_OVERDUE"));
    assert.equal(where.AND[1].OR[0].title.contains, "báo cáo");
    assert.deepEqual(where.AND[2].OR[1], { createdAt: at, id: { lt: "id9" } });

    const countWhere = buildNotificationWhere({ userId: "u1", cursor: encodeNotificationCursor(at, "id9") }, false) as any;
    assert.equal(countWhere.AND, undefined);
  });

  test("mặc định chỉ thông báo trong Hộp thư; archived=true chỉ thông báo đã lưu trữ", () => {
    assert.equal((buildNotificationWhere({ userId: "u1" }) as any).archivedAt, null);
    assert.equal((buildNotificationWhere({ userId: "u1", archived: false }) as any).archivedAt, null);
    assert.deepEqual((buildNotificationWhere({ userId: "u1", archived: true }) as any).archivedAt, { not: null });
  });
});

describe("Hộp thư kiểu Notion: bấm thông báo tới đúng chỗ", () => {
  test("mỗi loại thông báo nhiệm vụ tô khối liên quan, loại khác tô phần đầu nhiệm vụ", () => {
    assert.equal(getNotificationFocus("mention"), "comments");
    assert.equal(getNotificationFocus("deliverable_submitted"), "deliverables");
    assert.equal(getNotificationFocus("DELIVERABLE_REVISION"), "deliverables");
    assert.equal(getNotificationFocus("review_pending"), "approval");
    assert.equal(getNotificationFocus("extension_requested"), "extension");
    assert.equal(getNotificationFocus("extension_decided"), "extension");
    assert.equal(getNotificationFocus("unit_request_decided"), "unit-requests");
    for (const type of ["assigned", "reminder", "deadline", "overdue", "cancelled", "declined", "escalation", "", null]) {
      assert.equal(getNotificationFocus(type), "overview", String(type));
    }
  });

  test("nhiệm vụ mở thẳng /tasks/<id> kèm khối, không đi qua bảng danh sách", () => {
    assert.equal(
      getNotificationHref({ linkHref: "/tasks?taskId=ck1", type: "extension_requested" }),
      "/tasks/ck1?focus=extension"
    );
    assert.equal(
      getNotificationHref({ linkHref: "/tasks?taskId=ck1&scope=unit", type: "assigned" }),
      "/tasks/ck1?scope=unit&focus=overview"
    );
    // Thông báo nhắc tên mới đã có sẵn bình luận cần tô: giữ nguyên
    assert.equal(
      getNotificationHref({ linkHref: "/tasks/ck1?focus=comments&comment=c9", type: "mention" }),
      "/tasks/ck1?focus=comments&comment=c9"
    );
    // Thông báo nhắc tên cũ chưa có mã bình luận: tô cả khu bình luận
    assert.equal(getNotificationHref({ linkHref: "/tasks?taskId=ck1", type: "mention" }), "/tasks/ck1?focus=comments");
  });

  test("trang con của Nhiệm vụ, mã NV cũ, văn bản và đích không hợp lệ giữ nguyên hoặc null", () => {
    assert.equal(getNotificationHref({ linkHref: "/tasks/unit-requests", type: "unit_request" }), "/tasks/unit-requests");
    assert.equal(getNotificationHref({ linkHref: "/tasks/templates", type: "task_recurrence_failed" }), "/tasks/templates");
    assert.equal(getNotificationHref({ linkHref: "/tasks?taskId=NV-092", type: "assigned" }), "/tasks?taskId=NV-092");
    assert.equal(getNotificationHref({ linkHref: "/dossiers/d1", type: "dossier_submit_deadline" }), "/dossiers/d1");
    assert.equal(getNotificationHref({ linkHref: "https://evil.example/x", type: "assigned" }), null);
    assert.equal(getNotificationHref({ linkHref: undefined, type: "welcome" }), null);
  });

  test("nhóm thời gian theo ngày lịch ICT", () => {
    // NOW = 23:30 ICT 09/10
    assert.equal(getNotificationTimeBucket("2026-10-08T17:30:00.000Z", NOW), "today"); // 00:30 ICT 09/10
    assert.equal(getNotificationTimeBucket("2026-10-08T16:30:00.000Z", NOW), "yesterday"); // 23:30 ICT 08/10
    assert.equal(getNotificationTimeBucket("2026-10-04T03:00:00.000Z", NOW), "week");
    assert.equal(getNotificationTimeBucket("2026-10-02T03:00:00.000Z", NOW), "older");
    assert.equal(getNotificationTimeBucket("2026-10-10T03:00:00.000Z", NOW), "today");
    assert.equal(getNotificationTimeBucket(undefined, NOW), "older");
  });

  test("dòng trích chỉ lấy lời nhắn trong ngoặc kép, bỏ câu mặc định", () => {
    const base = { id: "n1", actorName: "Anh Tuấn", hasActor: true, timestamp: "", category: "task", isRead: false };
    assert.equal(
      getNotificationSnippet({ ...base, type: "mention", title: "[NHẮC TÊN] Dựng video", body: 'Anh Tuấn: "xem và góp ý với nhé"' }),
      "xem và góp ý với nhé"
    );
    assert.equal(
      getNotificationSnippet({ ...base, type: "deliverable_submitted", title: "[NỘP DUYỆT] Dựng video", body: "Anh Tuấn đã gửi sản phẩm kết quả cần duyệt" }),
      ""
    );
  });

  test("tiêu đề bỏ mọi tiền tố loại sự kiện của push (đã có nhãn sự kiện riêng)", () => {
    const base = { id: "n1", actorName: "A", timestamp: "", category: "task", isRead: false, body: "" };
    for (const tag of ["NHẮC TÊN", "XIN GIA HẠN", "NHẮC VIỆC", "YÊU CẦU PHỐI HỢP", "TỪ CHỐI NHẬN VIỆC", "GIAO VIỆC"]) {
      assert.equal(getNotificationDisplayTitle({ ...base, type: "x", title: `[${tag}] Dựng video` }), "Dựng video", tag);
    }
    // Ngoặc vuông là một phần tên nhiệm vụ thì giữ
    assert.equal(getNotificationDisplayTitle({ ...base, type: "x", title: "[GIAO VIỆC] [QĐ] Ban hành quy chế" }), "[QĐ] Ban hành quy chế");
  });

  test("số chưa đọc: ẩn khi 0, hiện số thật tới 99, quá 99 ghi 99+", () => {
    assert.equal(formatUnreadBadge(0), "");
    assert.equal(formatUnreadBadge(5), "5");
    assert.equal(formatUnreadBadge(30), "30");
    assert.equal(formatUnreadBadge(99), "99");
    assert.equal(formatUnreadBadge(100), "99+");
  });
});
