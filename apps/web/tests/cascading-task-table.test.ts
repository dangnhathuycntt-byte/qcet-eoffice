import { test, describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TaskPaginationBar } from "../src/components/tasks/table/components/task-pagination-bar";
import { TaskRow } from "../src/components/tasks/table/components/task-row";
import { getCategoryBadgeConfig, CATEGORY_TABS } from "../src/components/tasks/table/constants";
import { filterTasksForTable } from "../src/lib/unified-task-hub";
import { TaskTableHeader } from "../src/components/tasks/table/components/task-table-header";
import { ModularCascadingTaskTable } from "../src/components/tasks/table/modular-cascading-task-table";
import type { SchoolTask } from "@qcet/contracts/types/dashboard";

describe("CascadingTaskTable Helpers", () => {
  test("provides distinct subtle badge styling for categories", () => {
    const attt = getCategoryBadgeConfig("ATTT");
    assert.equal(attt.label, "An toàn thông tin");
    assert.ok(attt.className.includes("text-"));

    const cds = getCategoryBadgeConfig("CHUYEN_DOI_SO");
    assert.equal(cds.label, "Chuyển đổi số");
    assert.ok(cds.className.includes("text-"));

    const cntt = getCategoryBadgeConfig("CNTT");
    assert.equal(cntt.label, "CNTT");

    const tt = getCategoryBadgeConfig("TRUYEN_THONG");
    assert.equal(tt.label, "Truyền thông");

    const tv = getCategoryBadgeConfig("THU_VIEN");
    assert.equal(tv.label, "Thư viện");

    const bc = getCategoryBadgeConfig("BAO_CAO");
    assert.equal(bc.label, "Báo cáo");

    const khac = getCategoryBadgeConfig("KHAC");
    assert.equal(khac.label, "Khác");
  });

  test("CATEGORY_TABS labels contain zero emojis", () => {
    CATEGORY_TABS.forEach((tab) => {
      assert.match(
        tab.label,
        /^[\p{L}\p{N}\s\-\/]+$/u,
        `Tab ${tab.label} must not contain emojis`
      );
    });
  });

  test("CATEGORY_TABS defines all required category filters in proper order", () => {
    const labels = CATEGORY_TABS.map((t) => t.label);
    assert.deepEqual(labels, [
      "Tất cả",
      "Chuyển đổi số",
      "Truyền thông",
      "CNTT",
      "An toàn thông tin",
      "Thư viện",
      "Báo cáo",
    ]);
  });

  test("filterTasksForTable filters by category and search keyword across parent and subtasks", () => {
    const mockTasks: SchoolTask[] = [
      {
        id: "task-1",
        title: "Triển khai SSO tập trung",
        category: "CNTT",
        categoryLabel: "CNTT",
        leadAssigneeName: "Trần Hùng",
        coAssignees: [],
        assignedDate: "2026-09-01",
        dueDate: "2026-09-15",
        status: "IN_PROGRESS",
        subTasks: [
          {
            id: "sub-1",
            title: "Cấu hình SAML 2.0",
            assigneeName: "Nguyễn Ngọc Vinh",
            status: "IN_PROGRESS",
            dueDate: "2026-09-10",
            parentSchoolTaskId: "task-1",
            updatedAt: "2026-09-02",
          },
        ],
        totalSubTasks: 1,
        completedSubTasks: 0,
        progressPercent: 0,
      },
      {
        id: "task-2",
        title: "Báo cáo an toàn thông tin tháng 8",
        category: "ATTT",
        categoryLabel: "An toàn thông tin",
        leadAssigneeName: "Mai Đinh Thị Xuân",
        coAssignees: [],
        assignedDate: "2026-09-01",
        dueDate: "2026-09-05",
        status: "COMPLETED",
        subTasks: [],
        totalSubTasks: 0,
        completedSubTasks: 0,
        progressPercent: 100,
      },
    ];

    // Filter by category
    const atttOnly = filterTasksForTable(mockTasks, "ATTT", "");
    assert.equal(atttOnly.length, 1);
    assert.equal(atttOnly[0].id, "task-2");

    // All categories
    const all = filterTasksForTable(mockTasks, "ALL", "");
    assert.equal(all.length, 2);

    // Search by parent title
    const searchSSO = filterTasksForTable(mockTasks, "ALL", "SSO");
    assert.equal(searchSSO.length, 1);
    assert.equal(searchSSO[0].id, "task-1");

    // Search by subtask title
    const searchSAML = filterTasksForTable(mockTasks, "ALL", "SAML");
    assert.equal(searchSAML.length, 1);
    assert.equal(searchSAML[0].id, "task-1");

    // Search by assignee
    const searchVinh = filterTasksForTable(mockTasks, "ALL", "Vinh");
    assert.equal(searchVinh.length, 1);
    assert.equal(searchVinh[0].id, "task-1");

    // Empty search match
    const searchNone = filterTasksForTable(mockTasks, "ALL", "non-existent-xyz");
    assert.equal(searchNone.length, 0);
  });
});

describe("Task 6: Cascading Task Table Single Source of Truth", () => {
  it("filters tasks by relational departmentId and resolveDepartmentId without name heuristics", () => {
    const mockTasks: SchoolTask[] = [
      {
        id: "task-rel-1",
        title: "Nâng cấp hạ tầng mạng Core",
        category: "CNTT",
        categoryLabel: "CNTT",
        leadAssigneeName: "Nguyễn Văn A",

        coAssignees: [],
        assignedDate: "2026-09-01",
        dueDate: "2026-09-20",
        status: "IN_PROGRESS",
        subTasks: [
          {
            id: "sub-rel-1",
            title: "Cấu hình Switch L3",
            assigneeName: "Kỹ thuật viên 1",

            status: "IN_PROGRESS",
            dueDate: "2026-09-15",
            parentSchoolTaskId: "task-rel-1",
            updatedAt: "2026-09-02",
          },
        ],
        totalSubTasks: 1,
        completedSubTasks: 0,
        progressPercent: 50,
      },
      {
        id: "task-rel-2",
        title: "Báo cáo tuyển sinh năm 2026",
        category: "BAO_CAO",
        categoryLabel: "Báo cáo",
        leadAssigneeName: "Trần Thị B",

        coAssignees: [],
        assignedDate: "2026-09-01",
        dueDate: "2026-09-10",
        status: "COMPLETED",
        subTasks: [],
        totalSubTasks: 0,
        completedSubTasks: 0,
        progressPercent: 100,
      },
    ];

    // Filter by departmentId CNTT
    const cnttTasks = filterTasksForTable(mockTasks, "ALL", "", "CNTT");
    assert.equal(cnttTasks.length, 1);
    assert.equal(cnttTasks[0].id, "task-rel-1");

    // Filter by departmentId DAO_TAO
    const daoTaoTasks = filterTasksForTable(mockTasks, "ALL", "", "DAO_TAO");
    assert.equal(daoTaoTasks.length, 1);
    assert.equal(daoTaoTasks[0].id, "task-rel-2");
  });
});

describe("Plan 10.8/10.9: shortcut strip removal, lightweight help trigger, compact pagination copy", () => {
  it("shared pagination uses document terminology only when explicitly requested", () => {
    const html = renderToStaticMarkup(React.createElement(TaskPaginationBar, {
      currentPage: 1, pageSize: 10, totalItems: 95,
      onPageChange: () => {}, onPageSizeChange: () => {}, itemLabel: "văn bản",
    }));
    assert.ok(html.includes('aria-label="Phân trang văn bản"'));
    assert.ok(html.includes("văn bản"));
    assert.ok(!html.includes("nhiệm vụ"));
    assert.ok(html.includes("Số lượng văn bản trên mỗi trang"));
  });
  // NOTE on placement: src/components/tasks/cascading-task-table.tsx
  // (facade delegating to ModularCascadingTaskTable) does not render its own
  // pagination footer markup — the footer lives in
  // src/components/tasks/table/components/task-pagination-bar.tsx and is
  // composed by ModularCascadingTaskTable. Pagination copy is therefore
  // asserted via source-string on task-pagination-bar.tsx plus a direct
  // render of TaskPaginationBar below, not via the facade.

  it("persistent shortcut strip is absent: footer markup lacks 'Phím tắt nhanh'", () => {
    const html = renderToStaticMarkup(
      React.createElement(TaskPaginationBar, {
        currentPage: 1,
        pageSize: 10,
        totalItems: 95,
        onPageChange: () => {},
        onPageSizeChange: () => {},
      })
    );

    assert.ok(
      html.includes('aria-label="Phân trang bảng công việc"'),
      "footer must render so the absence assertion is not vacuous"
    );
    assert.ok(
      !html.includes("Phím tắt nhanh"),
      "collapsed footer must not persistently show the shortcut strip"
    );
  });

  it("pagination footer uses compact copy ('–' range + '/ N nhiệm vụ', '/ trang')", () => {
    const html = renderToStaticMarkup(
      React.createElement(TaskPaginationBar, {
        currentPage: 1,
        pageSize: 10,
        totalItems: 95,
        onPageChange: () => {},
        onPageSizeChange: () => {},
      })
    );
    assert.ok(html.includes("–"), "rendered footer must show the compact range");
    assert.ok(html.includes("95"), "rendered footer must show the total count");
    assert.ok(html.includes("nhiệm vụ"), "rendered footer must count in 'nhiệm vụ'");
    assert.ok(html.includes("/ trang"), "rendered page-size options must use '/ trang'");
    assert.ok(
      !html.includes("Hiển thị"),
      "rendered footer must not use verbose 'Hiển thị' copy"
    );
    assert.ok(
      !html.includes("trên tổng số"),
      "rendered footer must not use verbose 'trên tổng số' copy"
    );
  });

  it("hides the entire pagination footer when totalItems <= pageSize (filtered results fit within one page)", () => {
    const htmlFit = renderToStaticMarkup(
      React.createElement(TaskPaginationBar, {
        currentPage: 1,
        pageSize: 20,
        totalItems: 6,
        onPageChange: () => {},
        onPageSizeChange: () => {},
      })
    );
    assert.equal(htmlFit, "", "footer must return null when items fit within one page (6 <= 20)");

    const htmlExact = renderToStaticMarkup(
      React.createElement(TaskPaginationBar, {
        currentPage: 1,
        pageSize: 20,
        totalItems: 20,
        onPageChange: () => {},
        onPageSizeChange: () => {},
      })
    );
    assert.equal(htmlExact, "", "footer must return null when items exactly equal pageSize (20 <= 20)");

    const htmlEmpty = renderToStaticMarkup(
      React.createElement(TaskPaginationBar, {
        currentPage: 1,
        pageSize: 20,
        totalItems: 0,
        onPageChange: () => {},
        onPageSizeChange: () => {},
      })
    );
    assert.equal(htmlEmpty, "", "footer must return null when totalItems is 0");
  });
});

describe("Linear Table Redesign: Inline Property Editing & End-of-row Button Removal", () => {
  const sampleTask: SchoolTask = {
    id: "task-test-01",
    title: "Triển khai hệ thống xác thực tập trung SSO",
    taskCode: "NV-CNTT-01",
    category: "CNTT",
    categoryLabel: "CNTT",
    leadAssigneeName: "ThS. Đặng Nhật Huy",
    leadAssigneeId: "user-staff-huy",
    department: "Trung tâm Số và Truyền thông",
    priority: "HIGH",
    assignedDate: "2026-09-01",
    dueDate: "2026-10-28",
    status: "IN_PROGRESS",
    progressPercent: 65,
    subTasks: [],
    totalSubTasks: 0,
    completedSubTasks: 0,
    coAssignees: [],
  };

  it("removes '...' (MoreHorizontal) button at end of row, preventing date text overlap", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        "table",
        null,
        React.createElement(
          "tbody",
          null,
          React.createElement(TaskRow, {
            task: sampleTask,
            visibleColumns: {
              code: true,
              department: true,
              priority: true,
              leadAssignee: true,
              dueDate: true,
              subtasks: true,
              status: true,
            },
          })
        )
      )
    );

    // Không còn nút MoreHorizontal (aria-label="Thao tác nhanh") đè lên cuối hàng
    assert.ok(
      !html.includes("Thao tác nhanh"),
      "Row must not contain overlapping 'Thao tác nhanh' button at the end"
    );
    assert.ok(
      !html.includes("MoreHorizontal"),
      "MoreHorizontal button must be completely absent from the row"
    );
    // Vẫn hiển thị đầy đủ ngày hạn
    assert.ok(
      html.includes("28/10"),
      "Due date text (28/10) must be clearly visible"
    );
  });

  it("does not advertise inline editing on Priority, Department, Assignee, Due Date cells", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        "table",
        null,
        React.createElement(
          "tbody",
          null,
          React.createElement(TaskRow, {
            task: sampleTask,
            visibleColumns: {
              code: true,
              department: true,
              priority: true,
              leadAssignee: true,
              dueDate: true,
              subtasks: true,
              status: true,
            },
          })
        )
      )
    );

    // Đổi ưu tiên, người chủ trì, hạn nằm ở menu chuột phải; ô trong bảng không mời bấm để sửa
    for (const phrase of [
      "Nhấp để đổi độ ưu tiên",
      "Nhấp để đổi đơn vị phụ trách",
      "Nhấp để đổi người phụ trách",
      "Nhấp để đổi hạn hoàn thành",
    ]) {
      assert.ok(!html.includes(phrase), `Cell must not advertise inline edit: ${phrase}`);
    }

    // Tiến độ đã gộp vào cột Trạng thái nhưng không còn nút cập nhật riêng
    assert.ok(
      !html.includes('title="Nhấp để cập nhật tiến độ"'),
      "Progress trigger must not render"
    );
  });

  it("does not render a description line under the task title", () => {
    const taskWithDesc: SchoolTask = {
      ...sampleTask,
      id: "task-desc-01",
      title: "Chuẩn bị hội nghị viên chức",
      description: "Thực hiện rà soát công tác chuẩn bị và chuẩn bị văn kiện",
    };

    const html = renderToStaticMarkup(
      React.createElement(
        "table",
        null,
        React.createElement("tbody", null, React.createElement(TaskRow, { task: taskWithDesc }))
      )
    );

    assert.ok(html.includes("Chuẩn bị hội nghị viên chức"), "Must render the title");
    assert.ok(
      !html.includes("Thực hiện rà soát công tác chuẩn bị và chuẩn bị văn kiện"),
      "Must not render the description under the title"
    );
  });
});

describe("Linear Table Redesign: Synchronized Table Headers & Column Alignment", () => {
  it("renders 5 matching synchronized columns by default (Nhiệm vụ, Đơn vị, Ưu tiên, Phụ trách, Hạn)", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        "table",
        null,
        React.createElement(TaskTableHeader, {
          visibleColumns: {
            department: true,
            priority: true,
            leadAssignee: true,
            dueDate: true,
            status: false,
          },
        })
      )
    );

    assert.ok(html.includes("Nhiệm vụ"), "Header must include 'Nhiệm vụ'");
    assert.ok(html.includes("Đơn vị"), "Header must include 'Đơn vị'");
    assert.ok(html.includes("Ưu tiên"), "Header must include 'Ưu tiên'");
    assert.ok(html.includes("Phụ trách"), "Header must include 'Phụ trách'");
    assert.ok(html.includes("Hạn"), "Header must include 'Hạn'");
    assert.ok(!html.includes(">Trạng thái<"), "Header must not include 'Trạng thái' column when disabled");
  });

  it("renders the merged Trạng thái column (with progress) when status is enabled", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        "table",
        null,
        React.createElement(TaskTableHeader, {
          visibleColumns: {
            department: true,
            priority: true,
            leadAssignee: true,
            dueDate: true,
            status: true,
          },
        })
      )
    );

    assert.ok(html.includes("Trạng thái"), "Header must include 'Trạng thái' when status: true");
    assert.ok(!html.includes("Tiến độ"), "Tiến độ must not be a separate header column");
  });

  it("orders Bắt đầu, Hạn, then Ngày tạo in the header", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        "table",
        null,
        React.createElement(TaskTableHeader, {
          visibleColumns: { dueDate: true, createdAt: true, startDate: true, status: true },
        })
      )
    );

    const start = html.indexOf(">Bắt đầu<");
    const due = html.indexOf(">Hạn");
    const created = html.indexOf(">Ngày tạo<");
    assert.ok(start > -1 && due > start && created > due, "order must be Bắt đầu → Hạn → Ngày tạo");
  });

  it("dynamically hides optional columns when configured in visibleColumns", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        "table",
        null,
        React.createElement(TaskTableHeader, {
          visibleColumns: {
            department: false,
            priority: false,
            leadAssignee: true,
            dueDate: true,
            status: false,
          },
        })
      )
    );

    assert.ok(html.includes("Nhiệm vụ"), "Must keep Nhiệm vụ");
    assert.ok(!html.includes(">Đơn vị<"), "Must omit Đơn vị header");
    assert.ok(!html.includes(">Ưu tiên<"), "Must omit Ưu tiên header");
    assert.ok(html.includes("Phụ trách"), "Must keep Phụ trách");
    assert.ok(html.includes("Hạn"), "Must keep Hạn");
  });
});

describe("Linear Table Redesign: Collapsible Grouped Sections", () => {
  const sampleGroupTasks: SchoolTask[] = [
    {
      id: "t-status-1",
      title: "Nhiệm vụ Đang làm",
      taskCode: "NV-01",
      category: "CNTT",
      categoryLabel: "CNTT",
      leadAssigneeName: "Nguyễn Văn A",
      status: "IN_PROGRESS",
      priority: "HIGH",
      department: "Khoa CNTT",
      assignedDate: "2026-09-01",
      dueDate: "2026-10-28",
      progressPercent: 50,
      totalSubTasks: 0,
      completedSubTasks: 0,
      subTasks: [],
      coAssignees: [],
    },
    {
      id: "t-status-2",
      title: "Nhiệm vụ Chờ duyệt",
      taskCode: "NV-02",
      category: "ATTT",
      categoryLabel: "An toàn thông tin",
      leadAssigneeName: "Trần Thị B",
      status: "WAITING_APPROVAL",
      priority: "URGENT",
      department: "Phòng Đào tạo",
      assignedDate: "2026-09-01",
      dueDate: "2026-10-30",
      progressPercent: 100,
      totalSubTasks: 0,
      completedSubTasks: 0,
      subTasks: [],
      coAssignees: [],
    },
    {
      id: "t-status-3",
      title: "Nhiệm vụ Mới",
      taskCode: "NV-03",
      category: "CNTT",
      categoryLabel: "CNTT",
      leadAssigneeName: "Lê Văn C",
      status: "NEW",
      priority: "LOW",
      department: "Khoa CNTT",
      assignedDate: "2026-09-01",
      dueDate: "2026-11-05",
      progressPercent: 0,
      totalSubTasks: 0,
      completedSubTasks: 0,
      subTasks: [],
      coAssignees: [],
    },
  ];

  it("groups tasks by status with collapsible header rows, status glyphs, and count badges when groupingField='status'", () => {
    const html = renderToStaticMarkup(
      React.createElement(ModularCascadingTaskTable, {
        tasks: sampleGroupTasks,
        groupingField: "status",
        hideToolbar: false,
      })
    );

    // Kiểm tra có các group header rows
    assert.ok(html.includes('data-slot="group-header"'), "Must render group header rows");
    assert.ok(html.includes("Đang thực hiện"), "Must render group header for 'Đang thực hiện'");
    assert.ok(html.includes("Chờ duyệt"), "Must render group header for 'Chờ duyệt'");
    assert.ok(html.includes("Mới"), "Must render group header for 'Mới'");
  });

  it("groups tasks by priority with priority signal bars and count badges when groupingField='priority'", () => {
    const html = renderToStaticMarkup(
      React.createElement(ModularCascadingTaskTable, {
        tasks: sampleGroupTasks,
        groupingField: "priority",
        hideToolbar: false,
      })
    );

    assert.ok(html.includes('data-slot="group-header"'), "Must render group header rows");
    assert.ok(html.includes("Khẩn cấp"), "Must render group header for 'Khẩn cấp'");
    assert.ok(html.includes("Cao"), "Must render group header for 'Cao'");
    assert.ok(html.includes("Thấp"), "Must render group header for 'Thấp'");
  });

  it("groups tasks by department with department icons and count badges when groupingField='department'", () => {
    const html = renderToStaticMarkup(
      React.createElement(ModularCascadingTaskTable, {
        tasks: sampleGroupTasks,
        groupingField: "department",
        hideToolbar: false,
      })
    );

    assert.ok(html.includes('data-slot="group-header"'), "Must render group header rows");
    assert.ok(html.includes("Khoa CNTT"), "Must render group header for 'Khoa CNTT'");
    assert.ok(html.includes("Phòng Đào tạo"), "Must render group header for 'Phòng Đào tạo'");
  });

  it("nhóm ưu tiên/trạng thái dùng nhãn tiếng Việt chuẩn và thứ tự chuẩn (NORMAL, MEDIUM, NOT_STARTED không lộ mã)", () => {
    const extra = [
      { ...sampleGroupTasks[0], id: "g-normal", priority: "NORMAL", status: "NOT_STARTED" },
      { ...sampleGroupTasks[0], id: "g-medium", priority: "MEDIUM", status: "COMPLETED" },
    ] as SchoolTask[];
    const render = (groupingField: string) =>
      renderToStaticMarkup(
        React.createElement(ModularCascadingTaskTable, { tasks: [...sampleGroupTasks, ...extra], groupingField, hideToolbar: false })
      );
    const labelsOf = (html: string) =>
      [...html.matchAll(/data-slot="group-header"[\s\S]*?text-compact font-medium text-foreground">([^<]+)</g)].map((m) => m[1]);

    assert.deepEqual(labelsOf(render("priority")), ["Khẩn cấp", "Cao", "Bình thường", "Thấp"]);
    assert.deepEqual(labelsOf(render("status")), ["Mới", "Đang thực hiện", "Chờ duyệt", "Hoàn thành"]);
  });

  it("mọi kiểu nhóm mặc định thu gọn hết, không hiện hàng nhiệm vụ", () => {
    for (const groupingField of ["department", "status", "priority"]) {
      const html = renderToStaticMarkup(
        React.createElement(ModularCascadingTaskTable, { tasks: sampleGroupTasks, groupingField, hideToolbar: false })
      );
      const headers = html.match(/data-slot="group-header"[^>]*/g) ?? [];
      assert.ok(headers.length > 0, groupingField);
      assert.ok(headers.every((h) => h.includes("data-collapsed")), `Nhóm theo ${groupingField} thu gọn hết`);
      assert.ok(!html.includes('data-slot="task-row"'), `Nhóm theo ${groupingField} không hiện hàng`);
    }
  });

  it("renders clean flat table without group headers when groupingField='none'", () => {
    const html = renderToStaticMarkup(
      React.createElement(ModularCascadingTaskTable, {
        tasks: sampleGroupTasks,
        groupingField: "none",
        hideToolbar: false,
      })
    );

    assert.ok(!html.includes('data-slot="group-header"'), "Must not render group headers when groupingField is 'none'");
    assert.ok(html.includes("Nhiệm vụ Đang làm"), "Must render tasks in flat list");
  });
});

