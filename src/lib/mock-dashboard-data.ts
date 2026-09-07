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

export interface Personnel {
  name: string;
  avatar: string;
  dept: string;
}

export const QCET_PERSONNEL: Personnel[] = [
  {
    name: "Trần Hùng",
    avatar: "",
    dept: "CNTT / ATTT",
  },
  {
    name: "Nguyễn Ngọc Vinh",
    avatar: "",
    dept: "Chuyển đổi số",
  },
  {
    name: "Mai Đinh Thị Xuân",
    avatar: "",
    dept: "Truyền thông",
  },
  {
    name: "Lê Hoàng Nam",
    avatar: "",
    dept: "Hành chính - Quản trị",
  },
  {
    name: "Phạm Thị Thu",
    avatar: "",
    dept: "Thư viện & Học liệu",
  },
  {
    name: "Đặng Văn Hậu",
    avatar: "",
    dept: "Khảo thí & Đảm bảo chất lượng",
  },
  {
    name: "Võ Minh Trí",
    avatar: "",
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

const REALISTIC_SUFFIXES = [
  " - Học kỳ I (2026-2027)",
  " - Khu giảng đường A",
  " - Khu xưởng thực hành B",
  " - Khoa CNTT & Tự động hóa",
  " - Khoa Cơ khí chế tạo",
  " - Khoa Điện - Điện tử",
  " - Quý III/2026",
  " - Tháng 9/2026",
  " - Phòng Đào tạo & QLKH",
  " - Phòng Công tác sinh viên",
  " - Thư viện trung tâm",
  " - Cơ sở đào tạo Quy Nhơn",
  " - Đợt đầu năm học",
  " - Khối các phòng ban chức năng",
  " - Trung tâm đào tạo lái xe & nghề",
  " - Phòng Khảo thí & ĐBCL",
];

const CATEGORY_SUBTASK_TEMPLATES: Record<TaskCategory, string[]> = {
  ATTT: [
    "Rà soát chính sách bảo mật và phân quyền hệ thống máy chủ",
    "Sao lưu dữ liệu định kỳ và kiểm tra tính toàn vẹn CSDL",
    "Quét và vá lỗ hổng bảo mật cổng thông tin đào tạo",
    "Giám sát lưu lượng mạng và nhật ký tường lửa trung tâm",
    "Kiểm tra nhật ký đăng nhập và phát hiện bất thường",
    "Cập nhật chứng chỉ số SSL và mã hóa đường truyền nội bộ",
    "Diễn tập phương án ứng cứu sự cố an toàn thông tin",
    "Đánh giá rủi ro an ninh mạng định kỳ tháng",
    "Cấu hình hệ thống phát hiện xâm nhập IDS/IPS",
    "Kiểm tra tính an toàn các bản sao lưu lưu trữ ngoại vi",
  ],
  CNTT: [
    "Khảo sát và bảo trì hệ thống cáp mạng các phòng học",
    "Cấu hình và tối ưu hóa thiết bị wifi phòng thực hành",
    "Cài đặt phần mềm chuyên ngành cho các phòng lab máy tính",
    "Kiểm tra và thay thế thiết bị chuyển mạch switch bị suy hao",
    "Bảo dưỡng định kỳ hệ thống máy chủ và lưu điện UPS",
    "Hỗ trợ kỹ thuật phần cứng CNTT cho các đơn vị phòng ban",
    "Nâng cấp băng thông và đường truyền Internet nội bộ",
    "Lập kế hoạch bảo trì máy tính phục vụ kỳ thi tốt nghiệp",
    "Kiểm tra kết nối mạng giữa các tòa nhà khu hiệu bộ",
    "Cập nhật danh mục tài sản thiết bị tin học năm 2026",
  ],
  CHUYEN_DOI_SO: [
    "Số hóa hồ sơ cán bộ viên chức và học sinh sinh viên",
    "Chuẩn hóa quy trình liên thông văn bản điện tử nội bộ",
    "Tập huấn cán bộ sử dụng chữ ký số và văn phòng số",
    "Đồng bộ cơ sở dữ liệu với cổng dịch vụ công trực tuyến",
    "Kiểm thử tính năng mới trên phần mềm quản lý đào tạo",
    "Tích hợp cổng thanh toán học phí trực tuyến liên ngân hàng",
    "Khảo sát mức độ hài lòng về dịch vụ hành chính số",
    "Dự thảo báo cáo đánh giá chỉ số chuyển đổi số DTI",
    "Kiểm tra đồng bộ danh mục mã định danh sinh viên",
    "Tối ưu hóa giao diện biểu mẫu khảo sát trực tuyến",
  ],
  TRUYEN_THONG: [
    "Biên tập tin bài và xử lý hình ảnh đăng website nhà trường",
    "Thiết kế ấn phẩm truyền thông và banner thông báo tuyển sinh",
    "Sản xuất video clip phóng sự giới thiệu các ngành đào tạo",
    "Cập nhật thông tin tuyển sinh và tư vấn trên mạng xã hội",
    "Ghi hình và đưa tin sự kiện hội nghị cán bộ viên chức",
    "Phát hành bản tin nội bộ điện tử chào đón tân sinh viên",
    "Phối hợp với cơ quan báo đài địa phương đưa tin tuyên truyền",
    "Khảo sát nhu cầu thông tin của học sinh và phụ huynh",
    "Thiết kế backdrop và tài liệu phục vụ lễ bế giảng",
    "Tổng hợp số liệu tương tác truyền thông số các kênh",
  ],
  THU_VIEN: [
    "Phân loại, lập danh mục và dán mã vạch sách giáo trình mới",
    "Cập nhật cơ sở dữ liệu tài liệu và giáo trình điện tử",
    "Bố trí và sắp xếp lại không gian phòng đọc mở sinh viên",
    "Kiểm kê và thanh lý ấn phẩm hư hỏng, giáo trình lạc hậu",
    "Phục vụ bạn đọc mượn trả sách và tài liệu nghiên cứu",
    "Kết nối liên thông dữ liệu thư viện với các trường đối tác",
    "Khảo sát nhu cầu tài liệu học tập của các khoa chuyên môn",
    "Bảo quản và số hóa các công trình nghiên cứu khoa học",
    "Hướng dẫn tân sinh viên tra cứu tài liệu thư viện số",
    "Kiểm tra hệ thống cửa từ an ninh và máy quét mã vạch",
  ],
  BAO_CAO: [
    "Thu thập số liệu thống kê từ các khoa và phòng ban trực thuộc",
    "Tổng hợp và phân tích dữ liệu tuyển sinh, đào tạo đợt 1",
    "Dự thảo báo cáo sơ kết công tác gửi UBND Tỉnh",
    "Rà soát bảng biểu và hoàn thiện số liệu báo cáo quý",
    "Cập nhật hệ thống chỉ số KPI cán bộ quản lý tháng 9",
    "Tập hợp hồ sơ minh chứng phục vụ kiểm định chất lượng",
    "Lập báo cáo tình hình sử dụng ngân sách và tiến độ giải ngân",
    "Hoàn thiện báo cáo định kỳ gửi Tổng cục Giáo dục nghề nghiệp",
    "Kiểm tra tính nhất quán của số liệu thống kê sinh viên tốt nghiệp",
    "Dự thảo báo cáo đánh giá công tác thi đua khen thưởng",
  ],
  KHAC: [
    "Kiểm tra điều kiện cơ sở vật chất và an toàn lao động các xưởng",
    "Phối hợp chuẩn bị hội trường và âm thanh hội nghị cán bộ",
    "Lập danh sách học sinh sinh viên diện chính sách miễn giảm học phí",
    "Kiểm tra công tác vệ sinh môi trường và cảnh quan sư phạm",
    "Rà soát nội quy, quy chế hoạt động của đơn vị đầu năm học",
    "Tổ chức phong trào thi đua dạy tốt học tốt chào mừng năm học mới",
    "Chuẩn bị tài liệu và công tác hậu cần cho đoàn kiểm tra",
    "Đánh giá kết quả công tác chuyên môn tháng và đề xuất giải pháp",
    "Bảo dưỡng hệ thống điện chiếu sáng và máy phát điện dự phòng",
    "Kiểm tra hạn sử dụng các bình chữa cháy tại các khu giảng đường",
  ],
};

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
      const suffix = REALISTIC_SUFFIXES[i % REALISTIC_SUFFIXES.length];
      title = `${template.title}${suffix}`;
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
        const templates =
          CATEGORY_SUBTASK_TEMPLATES[parentTask.category] ||
          CATEGORY_SUBTASK_TEMPLATES.KHAC;
        const templateIdx = (i * 3 + s) % templates.length;
        subTitle = templates[templateIdx];
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
      taskId: "school-task-3",
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
      taskId: "school-task-4",
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
      taskId: "staff-task-3",
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
      taskId: "staff-task-5",
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
      taskId: "school-task-6",
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
      taskId: "staff-task-30",
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
      taskId: "school-task-5",
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
