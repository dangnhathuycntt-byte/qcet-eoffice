/**
 * QCET E-Office - Ma trận DACUM & Khung Danh mục Vị trí việc làm (VTVL)
 * Căn cứ pháp lý:
 * - Nghị định số 106/2020/NĐ-CP về vị trí việc làm trong đơn vị sự nghiệp công lập
 * - Thông tư số 12/2022/TT-BNV hướng dẫn về vị trí việc làm công chức, viên chức
 * - Thông tư số 04/2022/TT-BLĐTBXH về định mức giờ chuẩn giảng dạy và NCKH
 * - Phương pháp DACUM (Developing A CurriculUM / Developing A Competence)
 */

export interface DacumTaskItem {
  id: string;
  code: string;
  title: string;
  standardHours: number;
  criteria?: string;
  tools?: string;
  requiredDeliverables?: string;
}

export interface DacumDutyItem {
  id: string;
  code: string;
  title: string;
  tasks: DacumTaskItem[];
}

export interface DacumChartItem {
  id: string;
  code: string;
  title: string;
  targetRole: string;
  departmentCode: string;
  duties: DacumDutyItem[];
}

export interface VtvlRoleItem {
  id: string;
  code: string;
  title: string;
  category:
    | "Lãnh đạo, quản lý"
    | "Nghiệp vụ chuyên ngành"
    | "Nghiệp vụ chuyên môn dùng chung"
    | "Hỗ trợ, phục vụ";
  standardRank: string;
  requiredDuties: string[];
  competencyLevel: string;
  legalBasis: string;
}

export const QCET_DACUM_CHARTS: DacumChartItem[] = [
  {
    id: "chart-cntt-2026",
    code: "DACUM_CNTT_2026",
    title: "Ma trận Phân tích Nghề nghiệp DACUM - Giảng viên Công nghệ Thông tin",
    targetRole: "Giảng viên CNTT",
    departmentCode: "K_CNTT",
    duties: [
      {
        id: "duty-a",
        code: "A",
        title: "Nhiệm vụ A: Chuẩn bị giảng dạy và Phát triển học liệu",
        tasks: [
          {
            id: "task-a1",
            code: "A1",
            title: "Xây dựng đề cương chi tiết học phần và kế hoạch giảng dạy môn học",
            standardHours: 40,
            criteria: "Bám sát chuẩn đầu ra chương trình, đúng biểu mẫu ISO",
            tools: "Moodle, Google Workspace, LaTeX/Word",
            requiredDeliverables: "Đề cương chi tiết đã phê duyệt, ma trận chuẩn đầu ra",
          },
          {
            id: "task-a2",
            code: "A2",
            title: "Biên soạn bài giảng số, slide thuyết trình và hệ thống câu hỏi trắc nghiệm",
            standardHours: 60,
            criteria: "Có tính tương tác, minh họa trực quan, ngân hàng đề tối thiểu 100 câu",
            tools: "Canva, PowerPoint, Moodle Quiz, GitHub",
            requiredDeliverables: "Bộ bài giảng điện tử, ngân hàng câu hỏi đánh giá",
          },
          {
            id: "task-a3",
            code: "A3",
            title: "Chuẩn bị môi trường thực hành phòng Lab và hạ tầng máy chủ ảo",
            standardHours: 35,
            criteria: "Cài đặt đầy đủ công cụ lập trình, Docker container hoạt động ổn định",
            tools: "Proxmox, Docker, VS Code, Linux Ubuntu",
            requiredDeliverables: "Kịch bản thực hành phòng Lab, image môi trường mẫu",
          },
        ],
      },
      {
        id: "duty-b",
        code: "B",
        title: "Nhiệm vụ B: Giảng dạy trực tiếp và Đánh giá người học",
        tasks: [
          {
            id: "task-b1",
            code: "B1",
            title: "Thực hiện giờ giảng lý thuyết và hướng dẫn thực hành trên lớp",
            standardHours: 270,
            criteria: "Đúng tiến độ thời khóa biểu, đánh giá định kỳ bằng rubric minh bạch",
            tools: "Phòng học thông minh, bảng tương tác, máy chiếu",
            requiredDeliverables: "Sổ lên lớp, nhật ký giảng dạy, bảng điểm quá trình",
          },
          {
            id: "task-b2",
            code: "B2",
            title: "Tổ chức chấm thi, đánh giá đồ án môn học và phản hồi học tập",
            standardHours: 50,
            criteria: "Chấm thi 2 vòng độc lập, nhập điểm đúng hạn hệ thống đào tạo",
            tools: "Phần mềm Quản lý Đào tạo, Git Classroom",
            requiredDeliverables: "Bảng điểm tổng hợp có chữ ký, biên bản chấm phúc khảo",
          },
        ],
      },
      {
        id: "duty-c",
        code: "C",
        title: "Nhiệm vụ C: Nghiên cứu khoa học và Chuyển giao công nghệ",
        tasks: [
          {
            id: "task-c1",
            code: "C1",
            title: "Chủ trì hoặc tham gia đề tài NCKH cấp cơ sở / cấp Bộ",
            standardHours: 120,
            criteria: "Nghiệm thu đạt yêu cầu trở lên, có sản phẩm ứng dụng thực tiễn",
            tools: "Overleaf, Mendeley, Google Scholar",
            requiredDeliverables: "Thuyết minh đề tài, báo cáo tổng kết nghiệm thu",
          },
          {
            id: "task-c2",
            code: "C2",
            title: "Công bố bài báo khoa học trên tạp chí chuyên ngành / kỷ yếu hội thảo",
            standardHours: 80,
            criteria: "Được phản biện kín, đăng tải đúng năm học",
            tools: "Scopus, WoS, Tạp chí Khoa học & Công nghệ",
            requiredDeliverables: "Bản in bài báo hoặc giấy chứng nhận chấp nhận đăng",
          },
        ],
      },
      {
        id: "duty-d",
        code: "D",
        title: "Nhiệm vụ D: Công tác cố vấn học tập và Phục vụ cộng đồng",
        tasks: [
          {
            id: "task-d1",
            code: "D1",
            title: "Cố vấn học tập, định hướng nghề nghiệp và hướng dẫn NCKH sinh viên",
            standardHours: 45,
            criteria: "Họp lớp định kỳ hàng tháng, nắm bắt tâm tư sinh viên",
            tools: "Zalo nhóm lớp, Cổng thông tin sinh viên",
            requiredDeliverables: "Sổ tay cố vấn học tập, biên bản sinh hoạt lớp",
          },
          {
            id: "task-d2",
            code: "D2",
            title: "Tham gia hội đồng tự đánh giá chương trình đào tạo theo chuẩn kiểm định",
            standardHours: 30,
            criteria: "Cung cấp đầy đủ minh chứng tiêu chí phụ trách",
            tools: "Hệ thống quản lý minh chứng kiểm định",
            requiredDeliverables: "Báo cáo tự đánh giá tiêu chuẩn, file minh chứng số hóa",
          },
        ],
      },
    ],
  },
  {
    id: "chart-ck-2026",
    code: "DACUM_CK_2026",
    title: "Ma trận Phân tích Nghề nghiệp DACUM - Giảng viên Cơ khí Chế tạo máy",
    targetRole: "Giảng viên Cơ khí",
    departmentCode: "K_CK",
    duties: [
      {
        id: "duty-ck-a",
        code: "A",
        title: "Nhiệm vụ A: Vận hành và Bảo dưỡng thiết bị gia công CNC",
        tasks: [
          {
            id: "task-ck-a1",
            code: "A1",
            title: "Lập trình gia công và mô phỏng trên phần mềm CAD/CAM",
            standardHours: 50,
            criteria: "Đúng thông số công nghệ, tối ưu đường chạy dao",
            tools: "MasterCAM, SolidWorks, NX",
            requiredDeliverables: "File chương trình G-code, video mô phỏng",
          },
          {
            id: "task-ck-a2",
            code: "A2",
            title: "Bảo dưỡng dự phòng hệ thống máy phay, tiện CNC và thiết bị xưởng",
            standardHours: 40,
            criteria: "Tuân thủ quy trình an toàn 5S, kiểm tra dầu mỡ định kỳ",
            tools: "Dụng cụ đo cơ khí, đồng hồ so, thước cặp",
            requiredDeliverables: "Nhật ký bảo dưỡng thiết bị xưởng thực hành",
          },
        ],
      },
      {
        id: "duty-ck-b",
        code: "B",
        title: "Nhiệm vụ B: Giảng dạy thực hành sản xuất và An toàn lao động",
        tasks: [
          {
            id: "task-ck-b1",
            code: "B1",
            title: "Hướng dẫn thực tập cơ khí đại cương và an toàn vệ sinh lao động",
            standardHours: 280,
            criteria: "100% người học tuân thủ trang bị bảo hộ, không có tai nạn lao động",
            tools: "Máy gia công cơ khí, thiết bị bảo hộ cá nhân (PPE)",
            requiredDeliverables: "Phiếu đánh giá kỹ năng tay nghề, sản phẩm mẫu",
          },
        ],
      },
    ],
  },
];

export const QCET_VTVL_ROLES: VtvlRoleItem[] = [
  {
    id: "vtvl-truong-khoa",
    code: "VTVL_TRUONG_KHOA",
    title: "Trưởng khoa / Trưởng bộ môn trực thuộc",
    category: "Lãnh đạo, quản lý",
    standardRank: "Giảng viên chính (hạng II) trở lên - V.07.01.02",
    requiredDuties: [
      "Quản lý toàn diện hoạt động đào tạo, nghiên cứu và nhân sự khoa",
      "Phê duyệt đề cương, kế hoạch giảng dạy và phân công nhiệm vụ",
      "Chủ trì phát triển chương trình đào tạo và kiểm định chất lượng",
    ],
    competencyLevel: "Bậc 4/4 - Quản lý chiến lược và điều hành khoa học",
    legalBasis: "Nghị định 106/2020/NĐ-CP Điều 4 Khoản 1",
  },
  {
    id: "vtvl-pho-truong-khoa",
    code: "VTVL_PHO_TRUONG_KHOA",
    title: "Phó Trưởng khoa phụ trách chuyên môn",
    category: "Lãnh đạo, quản lý",
    standardRank: "Giảng viên (hạng III) hoặc Giảng viên chính (hạng II)",
    requiredDuties: [
      "Giúp việc Trưởng khoa phụ trách công tác đào tạo hoặc NCKH",
      "Thẩm định sơ bộ ma trận DACUM và đánh giá chuẩn đầu ra học phần",
      "Thực hiện các nhiệm vụ được ủy quyền theo văn bản của Trưởng khoa",
    ],
    competencyLevel: "Bậc 3/4 - Quản lý vận hành và điều phối nghiệp vụ",
    legalBasis: "Nghị định 106/2020/NĐ-CP Điều 4 Khoản 1",
  },
  {
    id: "vtvl-giang-vien",
    code: "VTVL_GV_CHUYEN_NGANH",
    title: "Giảng viên chuyên ngành",
    category: "Nghiệp vụ chuyên ngành",
    standardRank: "Giảng viên (hạng III) - V.07.01.03",
    requiredDuties: [
      "Trực tiếp giảng dạy lý thuyết, hướng dẫn thực hành theo phân công",
      "Nghiên cứu khoa học, viết bài báo, biên soạn bài giảng giáo trình",
      "Tham gia cố vấn học tập và xây dựng chương trình đào tạo",
    ],
    competencyLevel: "Bậc 3/4 - Nghiệp vụ sư phạm và chuyên môn kỹ thuật",
    legalBasis: "Thông tư 12/2022/TT-BNV & Thông tư 04/2022/TT-BLĐTBXH",
  },
  {
    id: "vtvl-chuyen-vien-dao-tao",
    code: "VTVL_CV_DAO_TAO",
    title: "Chuyên viên quản lý đào tạo",
    category: "Nghiệp vụ chuyên môn dùng chung",
    standardRank: "Chuyên viên (ngạch 01.003)",
    requiredDuties: [
      "Xây dựng thời khóa biểu, quản lý điểm số và cơ sở dữ liệu học tập",
      "Thẩm tra điều kiện tốt nghiệp và cấp phát văn bằng chứng chỉ",
      "Xác thực thủ tục ủy quyền ký văn bản theo phân cấp của BGH",
    ],
    competencyLevel: "Bậc 3/4 - Nghiệp vụ hành chính giáo dục",
    legalBasis: "Nghị định 106/2020/NĐ-CP Điều 4 Khoản 2",
  },
  {
    id: "vtvl-ky-thuat-vien",
    code: "VTVL_KTV_PHONG_MAY",
    title: "Kỹ thuật viên quản trị phòng thực hành",
    category: "Hỗ trợ, phục vụ",
    standardRank: "Kỹ thuật viên (hạng IV - V.05.02.08)",
    requiredDuties: [
      "Quản lý, bảo trì máy tính, máy chiếu và trang thiết bị thực hành",
      "Hỗ trợ cài đặt phần mềm chuyên ngành và sao lưu dữ liệu phòng lab",
      "Trực phục vụ giờ học thực hành và công tác thi trắc nghiệm",
    ],
    competencyLevel: "Bậc 2/4 - Kỹ thuật tác nghiệp trực tiếp",
    legalBasis: "Nghị định 106/2020/NĐ-CP Điều 4 Khoản 4",
  },
];

export function getDacumDutiesByChartCode(chartCode: string): DacumDutyItem[] {
  const chart = QCET_DACUM_CHARTS.find((c) => c.code === chartCode);
  return chart ? chart.duties : [];
}

export function getDacumTaskByCode(
  chartCode: string,
  taskCode: string
): DacumTaskItem | undefined {
  const chart = QCET_DACUM_CHARTS.find((c) => c.code === chartCode);
  if (!chart) return undefined;
  for (const duty of chart.duties) {
    const task = duty.tasks.find((t) => t.code === taskCode);
    if (task) return task;
  }
  return undefined;
}

export function getVtvlRoleByCode(roleCode: string): VtvlRoleItem | undefined {
  return QCET_VTVL_ROLES.find((r) => r.code === roleCode);
}

export function calculateTotalDacumHours(chartCode: string): number {
  const duties = getDacumDutiesByChartCode(chartCode);
  return duties.reduce((total, d) => {
    return total + d.tasks.reduce((sum, t) => sum + t.standardHours, 0);
  }, 0);
}
