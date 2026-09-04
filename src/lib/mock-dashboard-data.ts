import {
  SchoolTask,
  StaffTask,
  DashboardStats,
  UpcomingItem,
  ActivityEvent,
  DashboardPayload,
  TaskCategory,
  TaskStatus,
} from "../types/dashboard";
import { computeSchoolTaskRollup, computeDashboardStats } from "./dashboard-aggregator";

export const CATEGORY_LABELS: Record<TaskCategory, string> = {
  CHUYEN_DOI_SO: "Chuyển đổi số",
  TRUYEN_THONG: "Truyền thông",
  CNTT: "Công nghệ thông tin",
  ATTT: "An toàn thông tin",
  THU_VIEN: "Thư viện",
  BAO_CAO: "Báo cáo",
  KHAC: "Khác",
};

interface Personnel {
  name: string;
  avatar: string;
  dept: string;
}

const QCET_PERSONNEL: Personnel[] = [
  {
    name: "Trần Hùng",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
    dept: "CNTT / ATTT",
  },
  {
    name: "Nguyễn Ngọc Vinh",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
    dept: "Chuyển đổi số",
  },
  {
    name: "Mai Đinh Thị Xuân",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80",
    dept: "Truyền thông",
  },
  {
    name: "Lê Hoàng Nam",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80",
    dept: "Hành chính - Quản trị",
  },
  {
    name: "Phạm Thị Thu",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&auto=format&fit=crop&q=80",
    dept: "Thư viện & Học liệu",
  },
  {
    name: "Đặng Văn Hậu",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&auto=format&fit=crop&q=80",
    dept: "Khảo thí & Đảm bảo chất lượng",
  },
  {
    name: "Võ Minh Trí",
    avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=100&auto=format&fit=crop&q=80",
    dept: "Đào tạo & Quản lý sinh viên",
  },
];

interface SeedTaskDefinition {
  title: string;
  category: TaskCategory;
  leadName: string;
  coAssignees: string[];
  assignedDate: string;
  dueDate: string;
  subTaskTitles: { title: string; assigneeName: string; status: TaskStatus; dueDate: string }[];
}

const SEED_SCHOOL_TASKS: SeedTaskDefinition[] = [
  {
    title: "Sao lưu, giám sát an ninh mạng",
    category: "ATTT",
    leadName: "Trần Hùng",
    coAssignees: ["Nguyễn Ngọc Vinh"],
    assignedDate: "2026-09-03",
    dueDate: "2026-09-24",
    subTaskTitles: [
      {
        title: "Kiểm tra các bản sao lưu và giám sát an ninh mạng máy chủ trung tâm",
        assigneeName: "Trần Hùng",
        status: "IN_PROGRESS",
        dueDate: "2026-09-24",
      },
      {
        title: "Báo cáo an toàn thông tin định kỳ tháng 9/2026",
        assigneeName: "Trần Hùng",
        status: "COMPLETED",
        dueDate: "2026-09-15",
      },
      {
        title: "Cấu hình tường lửa và quy tắc phát hiện xâm nhập IDS/IPS",
        assigneeName: "Trần Hùng",
        status: "IN_PROGRESS",
        dueDate: "2026-09-20",
      },
    ],
  },
  {
    title: "Theo dõi kênh theo dõi chỉ đạo của UBND Tỉnh tháng 9/2026",
    category: "KHAC",
    leadName: "Nguyễn Ngọc Vinh",
    coAssignees: ["Trần Hùng", "Lê Hoàng Nam"],
    assignedDate: "2026-09-03",
    dueDate: "2026-09-24",
    subTaskTitles: [
      {
        title: "Theo dõi kênh Hệ thống theo dõi thực hiện chỉ đạo điều hành",
        assigneeName: "Nguyễn Ngọc Vinh",
        status: "IN_PROGRESS",
        dueDate: "2026-09-24",
      },
      {
        title: "Tổng hợp các văn bản chỉ đạo khẩn của UBND Tỉnh tuần 36",
        assigneeName: "Nguyễn Ngọc Vinh",
        status: "COMPLETED",
        dueDate: "2026-09-10",
      },
      {
        title: "Phân luồng và nhắc nhở các đơn vị xử lý nhiệm vụ tồn đọng",
        assigneeName: "Lê Hoàng Nam",
        status: "NEEDS_REVIEW",
        dueDate: "2026-09-18",
      },
    ],
  },
  {
    title: "Bài viết MỚI VÀO QCET – NHỮNG NGÀY ĐẦU TIÊN SẼ CÓ GÌ?",
    category: "TRUYEN_THONG",
    leadName: "Mai Đinh Thị Xuân",
    coAssignees: ["Nguyễn Ngọc Vinh"],
    assignedDate: "2026-09-01",
    dueDate: "2026-09-15",
    subTaskTitles: [
      {
        title: "Biên tập nội dung cẩm nang chào tân sinh viên khóa 2026",
        assigneeName: "Mai Đinh Thị Xuân",
        status: "COMPLETED",
        dueDate: "2026-09-05",
      },
      {
        title: "Thiết kế bộ infographic hướng dẫn thủ tục nhập học và nhận phòng KTX",
        assigneeName: "Mai Đinh Thị Xuân",
        status: "COMPLETED",
        dueDate: "2026-09-08",
      },
      {
        title: "Đăng tải bài viết trên Fanpage và Cổng thông tin điện tử QCET",
        assigneeName: "Mai Đinh Thị Xuân",
        status: "COMPLETED",
        dueDate: "2026-09-12",
      },
    ],
  },
  {
    title: "Rà soát hệ thống mạng và wifi các giảng đường",
    category: "CNTT",
    leadName: "Trần Hùng",
    coAssignees: ["Nguyễn Ngọc Vinh"],
    assignedDate: "2026-09-02",
    dueDate: "2026-09-18",
    subTaskTitles: [
      {
        title: "Khảo sát và đo kiểm tín hiệu wifi khu nhà A và nhà B",
        assigneeName: "Trần Hùng",
        status: "COMPLETED",
        dueDate: "2026-09-06",
      },
      {
        title: "Thay thế 4 Access Point bị chập chờn tại phòng máy thực hành",
        assigneeName: "Trần Hùng",
        status: "IN_PROGRESS",
        dueDate: "2026-09-16",
      },
      {
        title: "Tối ưu hóa băng thông đường truyền internet chuẩn bị khai giảng",
        assigneeName: "Trần Hùng",
        status: "IN_PROGRESS",
        dueDate: "2026-09-18",
      },
    ],
  },
  {
    title: "Triển khai phần mềm quản lý văn bản điều hành E-Office phiên bản mới",
    category: "CHUYEN_DOI_SO",
    leadName: "Nguyễn Ngọc Vinh",
    coAssignees: ["Trần Hùng", "Lê Hoàng Nam"],
    assignedDate: "2026-08-20",
    dueDate: "2026-09-30",
    subTaskTitles: [
      {
        title: "Tập huấn chữ ký số cho cán bộ quản lý và trưởng các khoa phòng",
        assigneeName: "Nguyễn Ngọc Vinh",
        status: "COMPLETED",
        dueDate: "2026-09-02",
      },
      {
        title: "Đồng bộ cơ sở dữ liệu cán bộ viên chức và phân quyền luồng ký",
        assigneeName: "Nguyễn Ngọc Vinh",
        status: "IN_PROGRESS",
        dueDate: "2026-09-22",
      },
      {
        title: "Tiếp nhận phản hồi người dùng và hoàn thiện giao diện ký duyệt",
        assigneeName: "Nguyễn Ngọc Vinh",
        status: "NEEDS_REVIEW",
        dueDate: "2026-09-28",
      },
    ],
  },
  {
    title: "Số hóa tài liệu và giáo trình điện tử phục vụ năm học mới",
    category: "THU_VIEN",
    leadName: "Phạm Thị Thu",
    coAssignees: ["Nguyễn Ngọc Vinh"],
    assignedDate: "2026-08-15",
    dueDate: "2026-09-25",
    subTaskTitles: [
      {
        title: "Quét và OCR 150 đầu giáo trình chuyên ngành kỹ thuật công nghệ",
        assigneeName: "Phạm Thị Thu",
        status: "COMPLETED",
        dueDate: "2026-09-01",
      },
      {
        title: "Cập nhật metadata và đưa lên cổng tra cứu thư viện số",
        assigneeName: "Phạm Thị Thu",
        status: "IN_PROGRESS",
        dueDate: "2026-09-20",
      },
    ],
  },
  {
    title: "Báo cáo tổng kết công tác tuyển sinh đợt 1 và chuẩn bị đợt 2",
    category: "BAO_CAO",
    leadName: "Võ Minh Trí",
    coAssignees: ["Mai Đinh Thị Xuân", "Đặng Văn Hậu"],
    assignedDate: "2026-08-28",
    dueDate: "2026-09-12",
    subTaskTitles: [
      {
        title: "Thống kê số liệu nhập học các ngành công nghệ và kinh tế",
        assigneeName: "Võ Minh Trí",
        status: "COMPLETED",
        dueDate: "2026-09-04",
      },
      {
        title: "Xây dựng kế hoạch truyền thông và xét tuyển bổ sung đợt 2",
        assigneeName: "Mai Đinh Thị Xuân",
        status: "IN_PROGRESS",
        dueDate: "2026-09-11",
      },
    ],
  },
  {
    title: "Kiểm định chất lượng 02 chương trình đào tạo trọng điểm",
    category: "BAO_CAO",
    leadName: "Đặng Văn Hậu",
    coAssignees: ["Võ Minh Trí"],
    assignedDate: "2026-08-10",
    dueDate: "2026-10-15",
    subTaskTitles: [
      {
        title: "Hoàn thiện báo cáo tự đánh giá tiêu chuẩn 1 đến 5",
        assigneeName: "Đặng Văn Hậu",
        status: "COMPLETED",
        dueDate: "2026-09-05",
      },
      {
        title: "Tập hợp minh chứng hồ sơ môn học và bài giảng thực hành",
        assigneeName: "Đặng Văn Hậu",
        status: "IN_PROGRESS",
        dueDate: "2026-09-25",
      },
    ],
  },
];

const TEMPLATE_TITLES: { title: string; category: TaskCategory }[] = [
  { title: "Nâng cấp hạ tầng trung tâm dữ liệu giai đoạn 2", category: "CNTT" },
  { title: "Bảo trì định kỳ máy chủ cơ sở dữ liệu sinh viên", category: "CNTT" },
  { title: "Rà soát lỗ hổng bảo mật cổng thông tin trường định kỳ", category: "ATTT" },
  { title: "Cập nhật chứng thư số SSL cho tất cả các subdomain trường", category: "ATTT" },
  { title: "Phối hợp với Sở TT&TT triển khai trục kết nối liên thông", category: "CHUYEN_DOI_SO" },
  { title: "Xây dựng biểu mẫu số cho quy trình xin nghỉ phép và tiếp nhận thiết bị", category: "CHUYEN_DOI_SO" },
  { title: "Sản xuất video clip giới thiệu các ngành nghề đào tạo chất lượng cao", category: "TRUYEN_THONG" },
  { title: "Truyền thông tuần lễ văn hóa sinh viên và hội chợ việc làm", category: "TRUYEN_THONG" },
  { title: "Bổ sung nguồn tài liệu số và cơ sở dữ liệu tạp chí khoa học", category: "THU_VIEN" },
  { title: "Kiểm kê sách và trang thiết bị phòng đọc đa phương tiện", category: "THU_VIEN" },
  { title: "Tổng hợp báo cáo định kỳ gửi Bộ LĐ-TB&XH và UBND Tỉnh", category: "BAO_CAO" },
  { title: "Báo cáo giám sát tiến độ thực hiện các dự án đầu tư công 2026", category: "BAO_CAO" },
  { title: "Chuẩn bị cơ sở vật chất hội nghị cán bộ viên chức đầu năm học", category: "KHAC" },
  { title: "Mua sắm bổ sung vật tư thực hành xưởng cơ khí và tự động hóa", category: "KHAC" },
  { title: "Kiểm tra công tác phòng cháy chữa cháy các khu giảng đường", category: "KHAC" },
  { title: "Khảo sát sự hài lòng của doanh nghiệp về chất lượng sinh viên tốt nghiệp", category: "BAO_CAO" },
];

function generateQCETDataset(): {
  tasks: SchoolTask[];
  stats: DashboardStats;
  upcoming: UpcomingItem[];
  activities: ActivityEvent[];
} {
  const TOTAL_SCHOOL_TASKS = 304;
  const TOTAL_STAFF_TASKS = 920;
  const TARGET_SCHOOL_COMPLETED = 92;
  const TARGET_STAFF_COMPLETED = 290;
  const TARGET_STAFF_IN_PROGRESS = 580;
  const TARGET_STAFF_NEEDS_REVIEW = 42;
  const TARGET_STAFF_NEW = 8;
  const TARGET_OVERDUE = 5;

  const tasks: SchoolTask[] = [];
  const allStaffTasks: StaffTask[] = [];

  // 1. Build initial list of 304 school tasks
  for (let i = 0; i < TOTAL_SCHOOL_TASKS; i++) {
    const isSeed = i < SEED_SCHOOL_TASKS.length;
    let title: string;
    let category: TaskCategory;
    let leadName: string;
    let coAssignees: string[];
    let assignedDate: string;
    let dueDate: string;

    if (isSeed) {
      const seed = SEED_SCHOOL_TASKS[i];
      title = seed.title;
      category = seed.category;
      leadName = seed.leadName;
      coAssignees = seed.coAssignees;
      assignedDate = seed.assignedDate;
      dueDate = seed.dueDate;
    } else {
      const template = TEMPLATE_TITLES[i % TEMPLATE_TITLES.length];
      const person = QCET_PERSONNEL[i % QCET_PERSONNEL.length];
      const partner = QCET_PERSONNEL[(i + 1) % QCET_PERSONNEL.length];
      title = `${template.title} (Đợt ${Math.floor(i / TEMPLATE_TITLES.length) + 1})`;
      category = template.category;
      leadName = person.name;
      coAssignees = [partner.name];
      const dayOffset = (i % 20) + 1;
      assignedDate = `2026-08-${String(Math.min(28, dayOffset + 5)).padStart(2, "0")}`;
      dueDate = `2026-09-${String(Math.min(30, dayOffset + 8)).padStart(2, "0")}`;
    }

    const leadPerson = QCET_PERSONNEL.find((p) => p.name === leadName) || QCET_PERSONNEL[0];
    const isCompleted = i < TARGET_SCHOOL_COMPLETED;

    tasks.push({
      id: `school-task-${i + 1}`,
      title,
      category,
      categoryLabel: CATEGORY_LABELS[category],
      leadAssigneeName: leadName,
      leadAssigneeAvatar: leadPerson.avatar,
      coAssignees,
      assignedDate,
      dueDate,
      status: isCompleted ? "COMPLETED" : "IN_PROGRESS",
      subTasks: [],
      totalSubTasks: 0,
      completedSubTasks: 0,
      progressPercent: 0,
    });
  }

  // 2. Allocate sub-tasks per school task to sum up to exactly 920 staff tasks
  // 304 tasks: 304 * 3 = 912 tasks. Add 1 extra to the first 8 tasks -> 8 * 4 + 296 * 3 = 32 + 888 = 920.
  const subTaskCounts: number[] = [];
  for (let i = 0; i < TOTAL_SCHOOL_TASKS; i++) {
    subTaskCounts.push(i < 8 ? 4 : 3);
  }

  // Target status distribution for the 920 staff tasks:
  // First 92 completed school tasks: all their subtasks must be COMPLETED so rollup progress is 100%.
  // Count of subtasks for first 92 tasks:
  // 8 * 4 + 84 * 3 = 32 + 252 = 284 COMPLETED subtasks.
  // We need 6 more COMPLETED subtasks from the remaining tasks (284 + 6 = 290 COMPLETED).
  // Remaining non-completed tasks (indexes 92 to 303, count = 212):
  // Total subtasks in remaining: 212 * 3 = 636 subtasks.
  // Breakdown of these 636 subtasks:
  // - 6 COMPLETED
  // - 580 IN_PROGRESS
  // - 42 NEEDS_REVIEW
  // - 8 NEW
  // Total = 6 + 580 + 42 + 8 = 636. Exactly matches!

  let remainingCompleted = TARGET_STAFF_COMPLETED; // 290
  let remainingInProgress = TARGET_STAFF_IN_PROGRESS; // 580
  let remainingNeedsReview = TARGET_STAFF_NEEDS_REVIEW; // 42
  let remainingNew = TARGET_STAFF_NEW; // 8
  let overdueAssigned = 0;

  let staffTaskIdCounter = 1;

  for (let i = 0; i < TOTAL_SCHOOL_TASKS; i++) {
    const parentTask = tasks[i];
    const subCount = subTaskCounts[i];
    const isParentCompleted = i < TARGET_SCHOOL_COMPLETED;

    for (let s = 0; s < subCount; s++) {
      let status: TaskStatus;
      if (isParentCompleted) {
        status = "COMPLETED";
        remainingCompleted--;
      } else {
        // Distribute remaining statuses
        if (remainingCompleted > 0) {
          status = "COMPLETED";
          remainingCompleted--;
        } else if (remainingNeedsReview > 0 && (s === 1 || remainingInProgress <= 0)) {
          status = "NEEDS_REVIEW";
          remainingNeedsReview--;
        } else if (remainingNew > 0 && (s === 2 || remainingInProgress <= 0)) {
          status = "NEW";
          remainingNew--;
        } else {
          status = "IN_PROGRESS";
          remainingInProgress--;
        }
      }

      // Check overdue constraint: assign past due date to exactly 5 non-completed tasks
      let subDueDate: string;
      if (status !== "COMPLETED" && overdueAssigned < TARGET_OVERDUE) {
        subDueDate = "2026-09-01"; // definitely in the past relative to 2026-09-04
        overdueAssigned++;
      } else {
        const day = 10 + ((i * 3 + s) % 18);
        subDueDate = `2026-09-${String(day).padStart(2, "0")}`;
      }

      const assigneePerson = QCET_PERSONNEL[(i + s) % QCET_PERSONNEL.length];

      // If seed sub-task exists, use its title
      let subTitle: string;
      if (i < SEED_SCHOOL_TASKS.length && s < SEED_SCHOOL_TASKS[i].subTaskTitles.length) {
        subTitle = SEED_SCHOOL_TASKS[i].subTaskTitles[s].title;
      } else {
        subTitle = `Công việc chi tiết ${s + 1}: ${parentTask.title}`;
      }

      const staffTask: StaffTask = {
        id: `staff-task-${staffTaskIdCounter++}`,
        title: subTitle,
        assigneeName: assigneePerson.name,
        assigneeAvatar: assigneePerson.avatar,
        status,
        dueDate: subDueDate,
        parentSchoolTaskId: parentTask.id,
        updatedAt: `2026-09-03T08:${String(10 + (s * 7) % 50).padStart(2, "0")}:00Z`,
      };

      parentTask.subTasks.push(staffTask);
      allStaffTasks.push(staffTask);
    }

    // Compute rollup for the school task
    tasks[i] = computeSchoolTaskRollup(parentTask);
  }

  // 3. Compute stats
  const stats = computeDashboardStats(tasks);

  // 4. Build upcoming deadlines (7 items)
  const upcoming: UpcomingItem[] = [
    {
      id: "upcoming-1",
      title: "Bài viết MỚI VÀO QCET – NHỮNG NGÀY ĐẦU TIÊN SẼ CÓ GÌ?",
      dueDate: "2026-09-04",
      assigneeName: "Mai Đinh Thị Xuân",
      assigneeAvatar: QCET_PERSONNEL[2].avatar,
      level: "Trường",
      category: "TRUYEN_THONG",
      isOverdue: false,
    },
    {
      id: "upcoming-2",
      title: "Rà soát hệ thống mạng và wifi các giảng đường",
      dueDate: "2026-09-05",
      assigneeName: "Trần Hùng",
      assigneeAvatar: QCET_PERSONNEL[0].avatar,
      level: "Trường",
      category: "CNTT",
      isOverdue: false,
    },
    {
      id: "upcoming-3",
      title: "Cấu hình tường lửa và quy tắc phát hiện xâm nhập IDS/IPS",
      dueDate: "2026-09-01",
      assigneeName: "Trần Hùng",
      assigneeAvatar: QCET_PERSONNEL[0].avatar,
      level: "Đơn vị",
      category: "ATTT",
      isOverdue: true,
    },
    {
      id: "upcoming-4",
      title: "Theo dõi kênh Hệ thống theo dõi thực hiện chỉ đạo điều hành",
      dueDate: "2026-09-06",
      assigneeName: "Nguyễn Ngọc Vinh",
      assigneeAvatar: QCET_PERSONNEL[1].avatar,
      level: "Đơn vị",
      category: "KHAC",
      isOverdue: false,
    },
    {
      id: "upcoming-5",
      title: "Số hóa tài liệu và giáo trình điện tử phục vụ năm học mới",
      dueDate: "2026-09-08",
      assigneeName: "Phạm Thị Thu",
      assigneeAvatar: QCET_PERSONNEL[4].avatar,
      level: "Trường",
      category: "THU_VIEN",
      isOverdue: false,
    },
    {
      id: "upcoming-6",
      title: "Tập hợp minh chứng hồ sơ môn học và bài giảng thực hành",
      dueDate: "2026-09-10",
      assigneeName: "Đặng Văn Hậu",
      assigneeAvatar: QCET_PERSONNEL[5].avatar,
      level: "Đơn vị",
      category: "BAO_CAO",
      isOverdue: false,
    },
    {
      id: "upcoming-7",
      title: "Triển khai phần mềm quản lý văn bản điều hành E-Office phiên bản mới",
      dueDate: "2026-09-11",
      assigneeName: "Nguyễn Ngọc Vinh",
      assigneeAvatar: QCET_PERSONNEL[1].avatar,
      level: "Trường",
      category: "CHUYEN_DOI_SO",
      isOverdue: false,
    },
  ];

  // 5. Build activity feed events (8 items)
  const activities: ActivityEvent[] = [
    {
      id: "act-1",
      actorName: "Trần Hùng",
      action: "vừa hoàn thành công việc",
      targetTitle: "Báo cáo an toàn thông tin định kỳ tháng 9/2026",
      timestamp: "10 phút trước",
      category: "ATTT",
    },
    {
      id: "act-2",
      actorName: "Nguyễn Ngọc Vinh",
      action: "đã cập nhật tiến độ công việc",
      targetTitle: "Theo dõi kênh theo dõi chỉ đạo của UBND Tỉnh tháng 9/2026",
      timestamp: "25 phút trước",
      category: "KHAC",
    },
    {
      id: "act-3",
      actorName: "Mai Đinh Thị Xuân",
      action: "vừa tải lên ấn phẩm truyền thông",
      targetTitle: "Bài viết MỚI VÀO QCET – NHỮNG NGÀY ĐẦU TIÊN SẼ CÓ GÌ?",
      timestamp: "45 phút trước",
      category: "TRUYEN_THONG",
    },
    {
      id: "act-4",
      actorName: "Trần Hùng",
      action: "vừa kiểm tra và cấu hình",
      targetTitle: "Khảo sát và đo kiểm tín hiệu wifi khu nhà A và nhà B",
      timestamp: "1 giờ trước",
      category: "CNTT",
    },
    {
      id: "act-5",
      actorName: "Lê Hoàng Nam",
      action: "vừa chuyển trạng thái cần chỉnh sửa",
      targetTitle: "Phân luồng và nhắc nhở các đơn vị xử lý nhiệm vụ tồn đọng",
      timestamp: "2 giờ trước",
      category: "KHAC",
    },
    {
      id: "act-6",
      actorName: "Phạm Thị Thu",
      action: "vừa hoàn thành quét OCR",
      targetTitle: "Quét và OCR 150 đầu giáo trình chuyên ngành kỹ thuật",
      timestamp: "3 giờ trước",
      category: "THU_VIEN",
    },
    {
      id: "act-7",
      actorName: "Võ Minh Trí",
      action: "vừa gửi báo cáo số liệu",
      targetTitle: "Thống kê số liệu nhập học các ngành công nghệ và kinh tế",
      timestamp: "4 giờ trước",
      category: "BAO_CAO",
    },
    {
      id: "act-8",
      actorName: "Đặng Văn Hậu",
      action: "vừa tạo mới công việc đơn vị",
      targetTitle: "Hoàn thiện báo cáo tự đánh giá tiêu chuẩn 1 đến 5",
      timestamp: "5 giờ trước",
      category: "BAO_CAO",
    },
  ];

  return {
    tasks,
    stats,
    upcoming,
    activities,
  };
}

// Cached singleton mock payload to guarantee instant access
let cachedPayload: DashboardPayload | null = null;

export function getMockDashboardPayload(): DashboardPayload {
  if (!cachedPayload) {
    const data = generateQCETDataset();
    cachedPayload = {
      ...data,
      source: "mock",
    };
  }
  return cachedPayload;
}
