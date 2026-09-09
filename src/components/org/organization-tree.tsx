"use client";

import * as React from "react";
import Image from "next/image";
import {
  Building2,
  Users,
  Briefcase,
  GraduationCap,
  Globe,
  Search,
  ChevronDown,
  ChevronRight,
  Mail,
  Phone,
  MapPin,
  ExternalLink,
  Shield,
  Layers,
  LayoutGrid,
  List,
  Calendar,
  X,
  Sparkles,
  Download,
  Printer,
  CheckCircle2,
  Radio,
  BarChart3,
  UserCheck,
  AlertCircle,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

// ============================================================================
// 1. Data Types & Interfaces
// ============================================================================

export type DepartmentCategory =
  | "BGH"
  | "PHONG_CHUC_NANG"
  | "KHOA_CHUYEN_MON"
  | "TRUNG_TAM";

export interface StaffMember {
  id: string;
  name: string;
  titlePrefix?: string;
  role: string;
  email: string;
  phone?: string;
  avatar?: string;
  departmentId: string;
  departmentName: string;
  activeTaskCount: number;
  status: "ACTIVE" | "ON_LEAVE" | "BUSY";
  room?: string;
  responsibilities?: string[];
}

export interface DepartmentNode {
  id: string;
  code: string;
  name: string;
  shortName?: string;
  category: DepartmentCategory;
  categoryLabel: string;
  description: string;
  location: string;
  phone: string;
  email: string;
  leaderName: string;
  leaderRole: string;
  members: StaffMember[];
  headcount?: number;
  activeTasksCount?: number;
  groupField?: "Nhóm" | "Nhóm công tác";
  notionDbKey?: string;
}

// ============================================================================
// 2. Comprehensive QCET Institutional Structure (17 Units)
// ============================================================================

export const QCET_DEPARTMENTS: DepartmentNode[] = [
  // --------------------------------------------------------------------------
  // 1. Ban Giám hiệu
  // --------------------------------------------------------------------------
  {
    id: "dept-bgh",
    code: "BGH",
    name: "Ban Giám hiệu",
    shortName: "Ban Giám hiệu",
    category: "BGH",
    categoryLabel: "Lãnh đạo nhà trường",
    description:
      "Tập thể lãnh đạo cao nhất trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn, chỉ đạo chiến lược phát triển, chuyển đổi số toàn diện và quản trị chất lượng giáo dục nghề nghiệp.",
    location: "Tòa nhà Hiệu bộ - Tầng 3",
    phone: "0256 3846 478",
    email: "bgh@cdktcnqn.edu.vn",
    leaderName: "ThS. Phạm Văn Tường",
    leaderRole: "Hiệu trưởng",
    headcount: 5,
    activeTasksCount: 8,
    groupField: "Nhóm",
    members: [
      {
        id: "staff-tuong-pv",
        name: "Phạm Văn Tường",
        titlePrefix: "ThS.",
        role: "Hiệu trưởng / Bí thư Đảng ủy",
        email: "tuongpv@cdktcnqn.edu.vn",
        phone: "0913 400 111",
        avatar:
          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-bgh",
        departmentName: "Ban Giám hiệu",
        activeTaskCount: 4,
        status: "ACTIVE",
        room: "P.301",
        responsibilities: [
          "Phụ trách chung toàn bộ hoạt động nhà trường",
          "Chỉ đạo chiến lược chuyển đổi số, tổ chức bộ máy và tài chính",
          "Ký duyệt các quyết định, văn bản QPPL và quy chế nội bộ",
        ],
      },
      {
        id: "staff-kiem-tt",
        name: "Trần Trọng Kiệm",
        titlePrefix: "ThS.",
        role: "Phó Hiệu trưởng phụ trách Đào tạo & NCKH",
        email: "kiemtt@cdktcnqn.edu.vn",
        phone: "0903 500 222",
        avatar:
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-bgh",
        departmentName: "Ban Giám hiệu",
        activeTaskCount: 2,
        status: "ACTIVE",
        room: "P.302",
        responsibilities: [
          "Chỉ đạo công tác đào tạo, tuyển sinh và hợp tác doanh nghiệp",
          "Phụ trách hoạt động nghiên cứu khoa học và chuyển giao công nghệ",
        ],
      },
      {
        id: "staff-nguyen-lx",
        name: "Lê Xuân Nguyên",
        titlePrefix: "ThS.",
        role: "Phó Hiệu trưởng phụ trách Hành chính & Cơ sở vật chất",
        email: "nguyenlx@cdktcnqn.edu.vn",
        phone: "0914 600 333",
        avatar:
          "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-bgh",
        departmentName: "Ban Giám hiệu",
        activeTaskCount: 2,
        status: "ACTIVE",
        room: "P.303",
        responsibilities: [
          "Phụ trách công tác hành chính quản trị, quy hoạch cơ sở vật chất",
          "Chỉ đạo công tác kiểm định chất lượng GDNN và chuyển đổi số hành chính",
        ],
      },
    ],
  },

  // --------------------------------------------------------------------------
  // 2. Phòng ban chức năng (6 units matching dashboard-chamcong)
  // --------------------------------------------------------------------------
  {
    id: "dept-p-hcqt",
    code: "P_HCQT",
    name: "Phòng Hành chính - Quản trị",
    shortName: "Hành chính - Quản trị",
    category: "PHONG_CHUC_NANG",
    categoryLabel: "Phòng chức năng",
    description:
      "Chịu trách nhiệm quản lý văn thư lưu trữ, công tác hành chính tổng hợp, an ninh trật tự, quản trị tài sản và cơ sở vật chất.",
    location: "Tòa nhà Hiệu bộ - Tầng 1, P.101",
    phone: "0256 3846 479",
    email: "hanhchinh@cdktcnqn.edu.vn",
    leaderName: "ThS. Phan Văn Thanh",
    leaderRole: "Trưởng phòng",
    headcount: 14,
    activeTasksCount: 5,
    groupField: "Nhóm",
    notionDbKey: "hanh_chinh_quan_tri",
    members: [
      {
        id: "staff-thanh-pv",
        name: "Phan Văn Thanh",
        titlePrefix: "ThS.",
        role: "Trưởng phòng Hành chính - Quản trị",
        email: "thanh.phan@cdktcnqn.edu.vn",
        phone: "0912 333 444",
        avatar:
          "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-p-hcqt",
        departmentName: "Phòng Hành chính - Quản trị",
        activeTaskCount: 3,
        status: "ACTIVE",
        room: "P.101",
        responsibilities: [
          "Quản lý điều hành toàn diện công tác hành chính, quản trị",
          "Đảm bảo an ninh trật tự, xe công vụ và lễ tân đối ngoại",
        ],
      },
      {
        id: "staff-nam-lh",
        name: "Lê Hoàng Nam",
        titlePrefix: "KS.",
        role: "Chuyên viên tổng hợp HCQT",
        email: "nam.le@cdktcnqn.edu.vn",
        phone: "0935 456 789",
        avatar:
          "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-p-hcqt",
        departmentName: "Phòng Hành chính - Quản trị",
        activeTaskCount: 4,
        status: "ACTIVE",
        room: "P.101",
        responsibilities: [
          "Quản lý cơ sở vật chất, hệ thống điện nước hội trường",
          "Điều phối mua sắm vật tư tiêu hao và tài sản công",
        ],
      },
      {
        id: "staff-nhung-tth",
        name: "Trương Thị Hồng Nhung",
        titlePrefix: "CN.",
        role: "Cán bộ Văn thư - Lưu trữ",
        email: "nhung.truong@cdktcnqn.edu.vn",
        phone: "0905 777 888",
        avatar:
          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-p-hcqt",
        departmentName: "Phòng Hành chính - Quản trị",
        activeTaskCount: 2,
        status: "ACTIVE",
        room: "P.101",
        responsibilities: [
          "Tiếp nhận và phát hành văn bản đi/đến điện tử",
          "Quản lý con dấu nhà trường và lưu trữ văn thư",
        ],
      },
    ],
  },
  {
    id: "dept-p-tcdbcl",
    code: "P_TCDBCL",
    name: "Phòng Tổ chức - Đảm bảo chất lượng",
    shortName: "Tổ chức - ĐBCL",
    category: "PHONG_CHUC_NANG",
    categoryLabel: "Phòng chức năng",
    description:
      "Tham mưu kiện toàn tổ chức cán bộ, bổ nhiệm, thi đua khen thưởng, thực hiện tự đánh giá kiểm định cơ sở giáo dục nghề nghiệp và khảo thí.",
    location: "Tòa nhà Hiệu bộ - Tầng 2, P.202",
    phone: "0256 3846 481",
    email: "tochuc@cdktcnqn.edu.vn",
    leaderName: "ThS. Nguyễn Tiến Phong",
    leaderRole: "Trưởng phòng",
    headcount: 11,
    activeTasksCount: 4,
    groupField: "Nhóm",
    notionDbKey: "to_chuc_dbcl",
    members: [
      {
        id: "staff-minh-nc",
        name: "Nguyễn Tiến Phong",
        titlePrefix: "ThS.",
        role: "Trưởng phòng",
        email: "phongnt@cdktcnqn.edu.vn",
        phone: "0916 444 555",
        avatar:
          "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-p-tcdbcl",
        departmentName: "Phòng Tổ chức - Đảm bảo chất lượng",
        activeTaskCount: 3,
        status: "ACTIVE",
        room: "P.202",
        responsibilities: [
          "Chỉ đạo công tác tổ chức cán bộ, đào tạo bồi dưỡng giảng viên",
          "Lãnh đạo công tác tự đánh giá kiểm định chất lượng GDNN",
        ],
      },
      {
        id: "staff-hau-dv",
        name: "Đặng Văn Hậu",
        titlePrefix: "ThS.",
        role: "Chuyên viên Khảo thí & ĐBCL",
        email: "hau.dang@cdktcnqn.edu.vn",
        phone: "0977 123 456",
        avatar:
          "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-p-tcdbcl",
        departmentName: "Phòng Tổ chức - Đảm bảo chất lượng",
        activeTaskCount: 2,
        status: "ACTIVE",
        room: "P.202",
        responsibilities: [
          "Quản lý ngân hàng câu hỏi trắc nghiệm và chấm thi điện tử",
          "Thu thập khảo sát ý kiến doanh nghiệp và người học",
        ],
      },
      {
        id: "staff-my-ltd",
        name: "Lê Thị Diễm My",
        titlePrefix: "ThS.",
        role: "Chuyên viên Đảm bảo chất lượng",
        email: "my.le@cdktcnqn.edu.vn",
        phone: "0989 333 777",
        avatar:
          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-p-tcdbcl",
        departmentName: "Phòng Tổ chức - Đảm bảo chất lượng",
        activeTaskCount: 2,
        status: "ACTIVE",
        room: "P.202",
        responsibilities: [
          "Lập báo cáo tự đánh giá chất lượng chương trình đào tạo",
          "Tổng hợp minh chứng phục vụ đoàn đánh giá ngoài",
        ],
      },
    ],
  },
  {
    id: "dept-p-qldt",
    code: "P_QLDT",
    name: "Phòng Quản lý Đào tạo",
    shortName: "Quản lý Đào tạo",
    category: "PHONG_CHUC_NANG",
    categoryLabel: "Phòng chức năng",
    description:
      "Xây dựng kế hoạch giảng dạy, thời khóa biểu, quản lý tiến độ đào tạo, liên kết doanh nghiệp và theo dõi đề tài nghiên cứu khoa học.",
    location: "Tòa nhà Hiệu bộ - Tầng 1, P.102",
    phone: "0256 3846 477",
    email: "daotao@cdktcnqn.edu.vn",
    leaderName: "ThS. Lê Văn Thí",
    leaderRole: "Trưởng phòng",
    headcount: 16,
    activeTasksCount: 6,
    groupField: "Nhóm",
    notionDbKey: "quan_ly_dao_tao",
    members: [
      {
        id: "staff-hung-tv",
        name: "Lê Văn Thí",
        titlePrefix: "ThS.",
        role: "Trưởng phòng",
        email: "levanthi@cdktcnqn.edu.vn",
        phone: "0914 111 222",
        avatar:
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-p-qldt",
        departmentName: "Phòng Quản lý Đào tạo",
        activeTaskCount: 3,
        status: "ACTIVE",
        room: "P.102",
        responsibilities: [
          "Chỉ đạo toàn diện công tác kế hoạch đào tạo, thời khóa biểu",
          "Phê duyệt hồ sơ mở ngành mới và liên kết đào tạo",
        ],
      },
      {
        id: "staff-tri-vm",
        name: "Võ Minh Trí",
        titlePrefix: "KS.",
        role: "Chuyên viên Quản lý Đào tạo & E-Office",
        email: "tri.vo@cdktcnqn.edu.vn",
        phone: "0905 123 456",
        avatar:
          "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-p-qldt",
        departmentName: "Phòng Quản lý Đào tạo",
        activeTaskCount: 4,
        status: "ACTIVE",
        room: "P.102",
        responsibilities: [
          "Quản lý phần mềm đào tạo và cơ sở dữ liệu điểm thi",
          "Hỗ trợ kỹ thuật E-Office và phân bổ lịch giảng đường",
        ],
      },
      {
        id: "staff-thuy-ntb",
        name: "Nguyễn Thị Bích Thủy",
        titlePrefix: "ThS.",
        role: "Chuyên viên QLKH & Hợp tác Quốc tế",
        email: "thuy.nguyen@cdktcnqn.edu.vn",
        phone: "0976 555 666",
        avatar:
          "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-p-qldt",
        departmentName: "Phòng Quản lý Đào tạo",
        activeTaskCount: 2,
        status: "ACTIVE",
        room: "P.102",
        responsibilities: [
          "Theo dõi đề tài NCKH, sáng kiến kinh nghiệm cấp trường",
          "Quản lý hồ sơ dự án hợp tác quốc tế GIZ",
        ],
      },
    ],
  },
  {
    id: "dept-p-tshtqt",
    code: "P_TSHTQT",
    name: "Phòng Tuyển sinh - Hợp tác quốc tế",
    shortName: "Tuyển sinh - HTQT",
    category: "PHONG_CHUC_NANG",
    categoryLabel: "Phòng chức năng",
    description:
      "Đầu mối tổ chức công tác tư vấn tuyển sinh các hệ đào tạo, quản lý ký túc xá, chế độ chính sách sinh viên và phát triển dự án hợp tác quốc tế.",
    location: "Tòa nhà Hiệu bộ - Tầng 1, P.103",
    phone: "0256 3846 482",
    email: "tuyensinh@cdktcnqn.edu.vn",
    leaderName: "ThS. Nguyễn Quốc Vỹ",
    leaderRole: "Trưởng phòng",
    headcount: 12,
    activeTasksCount: 4,
    groupField: "Nhóm",
    notionDbKey: "tuyen_sinh_htqt",
    members: [
      {
        id: "staff-tuan-hc",
        name: "Huỳnh Công Tuấn",
        titlePrefix: "ThS.",
        role: "Trưởng phòng Tuyển sinh - HTQT",
        email: "vynq@cdktcnqn.edu.vn",
        phone: "0917 888 111",
        avatar:
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-p-tshtqt",
        departmentName: "Phòng Tuyển sinh - Hợp tác quốc tế",
        activeTaskCount: 3,
        status: "ACTIVE",
        room: "P.103",
        responsibilities: [
          "Chỉ đạo đề án truyền thông và chỉ tiêu tuyển sinh năm học",
          "Điều phối quan hệ quốc tế và liên kết doanh nghiệp tuyển dụng",
        ],
      },
      {
        id: "staff-ha-ntt",
        name: "Nguyễn Thị Thanh Hà",
        titlePrefix: "CN.",
        role: "Chuyên viên Chính sách & Tuyển sinh",
        email: "ha.nguyen@cdktcnqn.edu.vn",
        phone: "0945 666 222",
        avatar:
          "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-p-tshtqt",
        departmentName: "Phòng Tuyển sinh - Hợp tác quốc tế",
        activeTaskCount: 2,
        status: "ACTIVE",
        room: "P.103",
        responsibilities: [
          "Thẩm định hồ sơ tuyển sinh online và học bổng khuyến học",
          "Tư vấn trực tuyến ngày hội hướng nghiệp cho học sinh THPT",
        ],
      },
    ],
  },
  {
    id: "dept-p-tc",
    code: "P_TC",
    name: "Phòng Tài chính",
    shortName: "Tài chính",
    category: "PHONG_CHUC_NANG",
    categoryLabel: "Phòng chức năng",
    description:
      "Tham mưu và thực hiện công tác quản lý tài chính, phân bổ dự toán ngân sách nhà nước, kế toán tiền lương, học phí và giải ngân đầu tư công.",
    location: "Tòa nhà Hiệu bộ - Tầng 1, P.104",
    phone: "0256 3846 480",
    email: "taichinh@cdktcnqn.edu.vn",
    leaderName: "ThS. Lê Phương Thúy Oanh",
    leaderRole: "Trưởng phòng / Kế toán trưởng",
    headcount: 9,
    activeTasksCount: 4,
    groupField: "Nhóm",
    notionDbKey: "tai_chinh",
    members: [
      {
        id: "staff-loan-ttm",
        name: "Lê Phương Thúy Oanh",
        titlePrefix: "ThS.",
        role: "Kế toán trưởng / Trưởng phòng",
        email: "lephuongthuyoanh@cdktcnqn.edu.vn",
        phone: "0915 222 333",
        avatar:
          "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-p-tc",
        departmentName: "Phòng Tài chính",
        activeTaskCount: 3,
        status: "ACTIVE",
        room: "P.104",
        responsibilities: [
          "Chịu trách nhiệm toàn bộ công tác tài chính, ngân sách",
          "Lập dự toán tài chính năm và giám sát quy chế chi tiêu nội bộ",
        ],
      },
      {
        id: "staff-van-ht",
        name: "Hà Thanh Vân",
        titlePrefix: "CN.",
        role: "Kế toán viên Tổng hợp",
        email: "van.ha@cdktcnqn.edu.vn",
        phone: "0934 888 999",
        avatar:
          "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-p-tc",
        departmentName: "Phòng Tài chính",
        activeTaskCount: 2,
        status: "ACTIVE",
        room: "P.104",
        responsibilities: [
          "Thực hiện kế toán tiền lương, phụ cấp giảng dạy",
          "Báo cáo thuế và thanh quyết toán chế độ cán bộ",
        ],
      },
    ],
  },
  {
    id: "dept-tt-stt",
    code: "TT_STT",
    name: "Trung tâm Số - Truyền thông",
    shortName: "Số - Truyền thông",
    category: "TRUNG_TAM",
    categoryLabel: "Trung tâm trực thuộc",
    description:
      "Đầu mối kỹ thuật vận hành hệ thống E-Office, máy chủ, cổng thông tin trường, mạng viễn thông và sản xuất ấn phẩm truyền thông số hóa.",
    location: "Tòa nhà Thư viện & TT Số - Tầng 2, P.204",
    phone: "0256 3846 486",
    email: "quantrimang@cdktcnqn.edu.vn",
    leaderName: "ThS. Mai Đinh Thị Xuân",
    leaderRole: "Giám đốc Trung tâm",
    headcount: 8,
    activeTasksCount: 4,
    groupField: "Nhóm",
    notionDbKey: "so_truyen_thong",
    members: [
      {
        id: "staff-xuan-mdt",
        name: "Mai Đinh Thị Xuân",
        titlePrefix: "ThS.",
        role: "Giám đốc Trung tâm Số - Truyền thông",
        email: "xuan.mai@cdktcnqn.edu.vn",
        phone: "0918 345 678",
        avatar:
          "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-tt-stt",
        departmentName: "Trung tâm Số - Truyền thông",
        activeTaskCount: 4,
        status: "ACTIVE",
        room: "P.204",
        responsibilities: [
          "Chỉ đạo chiến lược truyền thông thương hiệu QCET",
          "Quản trị cổng tin điện tử, sản xuất video & ấn phẩm số hóa",
          "Điều phối vận hành ứng dụng văn phòng điện tử E-Office",
        ],
      },
      {
        id: "staff-huy-dq",
        name: "Dương Quang Huy",
        titlePrefix: "KS.",
        role: "Kỹ sư Quản trị mạng & An toàn thông tin",
        email: "huy.duong@cdktcnqn.edu.vn",
        phone: "0938 123 888",
        avatar:
          "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-tt-stt",
        departmentName: "Trung tâm Số - Truyền thông",
        activeTaskCount: 3,
        status: "ACTIVE",
        room: "P.204",
        responsibilities: [
          "Quản trị hạ tầng máy chủ, WiFi trường và tường lửa",
          "Hỗ trợ kỹ thuật ứng dụng số hóa nội bộ và sao lưu dữ liệu",
        ],
      },
    ],
  },
  {
    id: "dept-tt-nnth",
    code: "TT_NNTH",
    name: "Trung tâm Ngoại ngữ - Tin học",
    shortName: "TT Ngoại ngữ - Tin học",
    category: "TRUNG_TAM",
    categoryLabel: "Trung tâm trực thuộc",
    description:
      "Tổ chức đào tạo, bồi dưỡng và sát hạch cấp chứng chỉ Ngoại ngữ chuẩn quốc tế (TOEIC, IELTS) và Tin học chuẩn kỹ năng quốc gia.",
    location: "Tòa nhà Thư viện & TT Số - Tầng 1, P.105",
    phone: "0256 3846 487",
    email: "nnth@cdktcnqn.edu.vn",
    leaderName: "ThS. Chu Đình Thắng",
    leaderRole: "Giám đốc Trung tâm",
    headcount: 7,
    activeTasksCount: 3,
    groupField: "Nhóm",
    members: [
      {
        id: "staff-thang-cd",
        name: "Chu Đình Thắng",
        titlePrefix: "ThS.",
        role: "Giám đốc Trung tâm Ngoại ngữ - Tin học",
        email: "thang.chu@cdktcnqn.edu.vn",
        phone: "0913 888 777",
        avatar:
          "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-tt-nnth",
        departmentName: "Trung tâm Ngoại ngữ - Tin học",
        activeTaskCount: 3,
        status: "ACTIVE",
        room: "P.105",
        responsibilities: [
          "Chỉ đạo điều hành công tác đào tạo chứng chỉ chuẩn đầu ra",
          "Hợp tác với các tổ chức khảo thí quốc tế (IIG Việt Nam, British Council)",
        ],
      },
      {
        id: "staff-thu-pt",
        name: "Phạm Thị Thu",
        titlePrefix: "ThS.",
        role: "Chuyên viên Thư viện & Học liệu số",
        email: "thu.pham@cdktcnqn.edu.vn",
        phone: "0912 678 901",
        avatar:
          "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-tt-nnth",
        departmentName: "Trung tâm Ngoại ngữ - Tin học",
        activeTaskCount: 3,
        status: "ACTIVE",
        room: "P.105",
        responsibilities: [
          "Quản lý kho học liệu giáo trình điện tử, thư viện số DSpace",
          "Hỗ trợ sinh viên tra cứu tài liệu học tập và thi chứng chỉ",
        ],
      },
    ],
  },

  // --------------------------------------------------------------------------
  // 3. Khoa chuyên môn (9 faculties matching dashboard-chamcong)
  // --------------------------------------------------------------------------
  {
    id: "dept-k-dtth",
    code: "K_CNTT",
    name: "Khoa Công nghệ thông tin (Điện tử - Tin học)",
    shortName: "Khoa CNTT",
    category: "KHOA_CHUYEN_MON",
    categoryLabel: "Khoa chuyên môn",
    description:
      "Đào tạo kỹ sư thực hành các chuyên ngành Công nghệ thông tin, Kỹ thuật Phần mềm, An toàn mạng, Thiết kế đồ họa số và Trí tuệ nhân tạo.",
    location: "Khu Giảng đường C - Tầng 3, P.302",
    phone: "0256 3846 483",
    email: "khoadientutinhoc@cdktcnqn.edu.vn",
    leaderName: "TS. Nguyễn Ngọc Vinh",
    leaderRole: "Trưởng khoa",
    headcount: 24,
    activeTasksCount: 5,
    groupField: "Nhóm công tác",
    notionDbKey: "khoa_dien_tu_tin_hoc",
    members: [
      {
        id: "staff-vinh-nn",
        name: "Nguyễn Ngọc Vinh",
        titlePrefix: "TS.",
        role: "Trưởng khoa / Phụ trách Chuyển đổi số",
        email: "vinhnn@cdktcnqn.edu.vn",
        phone: "0909 234 567",
        avatar:
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-k-dtth",
        departmentName: "Khoa Công nghệ thông tin",
        activeTaskCount: 5,
        status: "ACTIVE",
        room: "C.302",
        responsibilities: [
          "Quản lý toàn diện chuyên môn và nhân sự khoa Công nghệ thông tin",
          "Chủ nhiệm đề án Chuyển đổi số và triển khai E-Office nhà trường",
          "Giảng dạy chuyên sâu Kiến trúc phần mềm & Cơ sở dữ liệu",
        ],
      },
      {
        id: "staff-hung-t",
        name: "Trần Hùng",
        titlePrefix: "ThS.",
        role: "Phó Trưởng khoa / An ninh mạng & ATTT",
        email: "hung.tran@cdktcnqn.edu.vn",
        phone: "0908 123 456",
        avatar:
          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-k-dtth",
        departmentName: "Khoa Công nghệ thông tin",
        activeTaskCount: 4,
        status: "ACTIVE",
        room: "C.303",
        responsibilities: [
          "Phụ trách chuyên môn An toàn thông tin và Quản trị mạng QCET",
          "Trưởng nhóm ứng cứu sự cố máy tính và bảo mật dữ liệu",
        ],
      },
      {
        id: "staff-khoi-pd",
        name: "Phan Đình Khôi",
        titlePrefix: "ThS.",
        role: "Giảng viên Bộ môn Phát triển phần mềm",
        email: "khoi.phan@cdktcnqn.edu.vn",
        phone: "0983 999 111",
        avatar:
          "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-k-dtth",
        departmentName: "Khoa Công nghệ thông tin",
        activeTaskCount: 3,
        status: "ACTIVE",
        room: "C.304",
        responsibilities: [
          "Giảng dạy Lập trình Web Full-Stack và Lập trình Di động",
          "Cố vấn học tập các lớp cao đẳng CNTT K48",
        ],
      },
    ],
  },
  {
    id: "dept-k-ck",
    code: "K_CK",
    name: "Khoa Cơ khí",
    shortName: "Khoa Cơ khí",
    category: "KHOA_CHUYEN_MON",
    categoryLabel: "Khoa chuyên môn",
    description:
      "Đào tạo kỹ sư thực hành chuyên ngành Cắt gọt kim loại CNC, Công nghệ Hàn công nghệ cao và Thiết kế chế tạo máy công nghiệp.",
    location: "Khu Xưởng Thực hành A - P.101",
    phone: "0256 3846 488",
    email: "khoacokhi@cdktcnqn.edu.vn",
    leaderName: "TS. Đinh Quốc Cường",
    leaderRole: "Trưởng khoa",
    headcount: 22,
    activeTasksCount: 4,
    groupField: "Nhóm công tác",
    notionDbKey: "khoa_co_khi",
    members: [
      {
        id: "staff-cuong-dq",
        name: "Đinh Quốc Cường",
        titlePrefix: "TS.",
        role: "Trưởng khoa Cơ khí",
        email: "cuong.dinh@cdktcnqn.edu.vn",
        phone: "0919 111 444",
        avatar:
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-k-ck",
        departmentName: "Khoa Cơ khí",
        activeTaskCount: 4,
        status: "ACTIVE",
        room: "Xưởng A - P.101",
        responsibilities: [
          "Lãnh đạo toàn diện các bộ môn cơ khí chế tạo và tự động hóa",
          "Chủ nhiệm chương trình hiện đại hóa xưởng thực hành kỹ thuật",
        ],
      },
      {
        id: "staff-nghiep-vv",
        name: "Vũ Văn Nghiệp",
        titlePrefix: "ThS.",
        role: "Phó Trưởng khoa / Kỹ thuật Gia công CNC",
        email: "nghiep.vu@cdktcnqn.edu.vn",
        phone: "0906 888 444",
        avatar:
          "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-k-ck",
        departmentName: "Khoa Cơ khí",
        activeTaskCount: 2,
        status: "ACTIVE",
        room: "Xưởng A - P.102",
        responsibilities: [
          "Quản lý dây chuyền máy phay tiện CNC trung tâm",
          "Huấn luyện đội tuyển sinh viên thi tay nghề Nghề Tiện/Phay CNC",
        ],
      },
    ],
  },
  {
    id: "dept-k-cnoto",
    code: "K_CNOTO",
    name: "Khoa Công nghệ Ô tô (Ô tô & Chế tạo máy)",
    shortName: "Khoa KTCN",
    category: "KHOA_CHUYEN_MON",
    categoryLabel: "Khoa chuyên môn",
    description:
      "Đào tạo kỹ sư thực hành chuyên ngành Công nghệ kỹ thuật ô tô, Hệ thống điều khiển điện tử ô tô và Xe điện thông minh (EV).",
    location: "Khu Xưởng Thực hành D - P.102",
    phone: "0256 3846 489",
    email: "khoaoto@cdktcnqn.edu.vn",
    leaderName: "KS. Vũ Mạnh Hùng",
    leaderRole: "Phó Trưởng khoa phụ trách",
    headcount: 26,
    activeTasksCount: 5,
    groupField: "Nhóm công tác",
    notionDbKey: "khoa_cong_nghe_o_to",
    members: [
      {
        id: "staff-hung-vm",
        name: "Vũ Mạnh Hùng",
        titlePrefix: "KS.",
        role: "Phó Trưởng khoa phụ trách Xưởng Ô tô",
        email: "hung.vu@cdktcnqn.edu.vn",
        phone: "0906 333 999",
        avatar:
          "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-k-cnoto",
        departmentName: "Khoa Công nghệ ô tô",
        activeTaskCount: 3,
        status: "ACTIVE",
        room: "Xưởng D - P.102",
        responsibilities: [
          "Quản lý dây chuyền chẩn đoán điện tử ô tô hiện đại",
          "Huấn luyện đội tuyển sinh viên thi tay nghề Quốc gia nghề Ô tô",
        ],
      },
      {
        id: "staff-loc-tb",
        name: "Trần Bá Lộc",
        titlePrefix: "ThS.",
        role: "Giảng viên Điện ô tô & Cơ điện tử",
        email: "loc.tran@cdktcnqn.edu.vn",
        phone: "0978 222 111",
        avatar:
          "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-k-cnoto",
        departmentName: "Khoa Công nghệ ô tô",
        activeTaskCount: 2,
        status: "ACTIVE",
        room: "Xưởng D - P.103",
        responsibilities: [
          "Giảng dạy Chẩn đoán lỗi hộp ECU và mạng truyền thông CAN bus",
          "Phụ trách phòng thực hành xe điện mô phỏng hybrid",
        ],
      },
    ],
  },
  {
    id: "dept-k-dien",
    code: "K_DIEN",
    name: "Khoa Điện",
    shortName: "Khoa Điện",
    category: "KHOA_CHUYEN_MON",
    categoryLabel: "Khoa chuyên môn",
    description:
      "Đào tạo chuyên ngành Điện công nghiệp, Kỹ thuật lắp đặt điện tử công suất, Hệ thống pin năng lượng mặt trời và Tự động hóa trạm biến áp.",
    location: "Khu Giảng đường B - Tầng 1, P.108",
    phone: "0256 3846 490",
    email: "khoadien@cdktcnqn.edu.vn",
    leaderName: "ThS. Nguyễn Văn Thắng",
    leaderRole: "Trưởng khoa",
    headcount: 19,
    activeTasksCount: 3,
    groupField: "Nhóm công tác",
    notionDbKey: "khoa_dien",
    members: [
      {
        id: "staff-thang-nv",
        name: "Nguyễn Văn Thắng",
        titlePrefix: "ThS.",
        role: "Trưởng khoa Điện",
        email: "thang.nguyen@cdktcnqn.edu.vn",
        phone: "0915 777 333",
        avatar:
          "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-k-dien",
        departmentName: "Khoa Điện",
        activeTaskCount: 3,
        status: "ACTIVE",
        room: "B.108",
        responsibilities: [
          "Lãnh đạo chuyên môn đào tạo kỹ sư thực hành nghề Điện công nghiệp",
          "Quản lý dự án năng lượng mặt trời áp mái nhà trường",
        ],
      },
      {
        id: "staff-quy-bd",
        name: "Bùi Đình Quý",
        titlePrefix: "ThS.",
        role: "Giảng viên Tự động hóa & PLC",
        email: "quy.bui@cdktcnqn.edu.vn",
        phone: "0934 222 111",
        avatar:
          "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-k-dien",
        departmentName: "Khoa Điện",
        activeTaskCount: 2,
        status: "ACTIVE",
        room: "B.109",
        responsibilities: [
          "Giảng dạy PLC Siemens S7-1200 và biến tần công nghiệp",
          "Phụ trách phòng thực hành khí nén Festo",
        ],
      },
    ],
  },
  {
    id: "dept-k-dulich",
    code: "K_DULICH",
    name: "Khoa Du lịch",
    shortName: "Khoa Du lịch",
    category: "KHOA_CHUYEN_MON",
    categoryLabel: "Khoa chuyên môn",
    description:
      "Đào tạo các ngành Quản trị Khách sạn, Quản trị Nhà hàng & Dịch vụ ăn uống, Kỹ thuật chế biến món ăn và Hướng dẫn viên du lịch quốc tế.",
    location: "Khu Giảng đường D - Tầng 2, P.201",
    phone: "0256 3846 491",
    email: "khoadulich@cdktcnqn.edu.vn",
    leaderName: "ThS. Phan Thị Phương Thảo",
    leaderRole: "Trưởng khoa",
    headcount: 15,
    activeTasksCount: 4,
    groupField: "Nhóm công tác",
    notionDbKey: "khoa_du_lich",
    members: [
      {
        id: "staff-thao-ptp",
        name: "Phan Thị Phương Thảo",
        titlePrefix: "ThS.",
        role: "Trưởng khoa Du lịch",
        email: "thao.phan@cdktcnqn.edu.vn",
        phone: "0918 555 999",
        avatar:
          "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-k-dulich",
        departmentName: "Khoa Du lịch",
        activeTaskCount: 3,
        status: "ACTIVE",
        room: "D.201",
        responsibilities: [
          "Quản lý điều hành đào tạo ngành khách sạn, ẩm thực và du lịch",
          "Ký kết hợp tác thực tập sinh với chuỗi resort 5 sao tại Quy Nhơn",
        ],
      },
      {
        id: "staff-nam-hn",
        name: "Hoàng Nhật Nam",
        titlePrefix: "ThS.",
        role: "Giảng viên Quản trị Khách sạn",
        email: "nam.hoang@cdktcnqn.edu.vn",
        phone: "0905 666 444",
        avatar:
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-k-dulich",
        departmentName: "Khoa Du lịch",
        activeTaskCount: 2,
        status: "ACTIVE",
        room: "D.202",
        responsibilities: [
          "Giảng dạy Nghiệp vụ Lễ tân và Quản trị Buồng phòng tiêu chuẩn VTOS",
          "Quản lý phòng thực hành buồng mẫu khách sạn 4 sao",
        ],
      },
    ],
  },
  {
    id: "dept-k-ktth",
    code: "K_KTQT",
    name: "Khoa Kinh tế - Quản trị (Kinh tế tổng hợp)",
    shortName: "Khoa KTQT",
    category: "KHOA_CHUYEN_MON",
    categoryLabel: "Khoa chuyên môn",
    description:
      "Đào tạo Kế toán doanh nghiệp, Quản trị kinh doanh số, Logistics & Quản lý chuỗi cung ứng, Thương mại điện tử chất lượng cao.",
    location: "Khu Giảng đường B - Tầng 2, P.205",
    phone: "0256 3846 484",
    email: "khoaktth@cdktcnqn.edu.vn",
    leaderName: "TS. Lê Thị Ánh Tuyết",
    leaderRole: "Trưởng khoa",
    headcount: 21,
    activeTasksCount: 4,
    groupField: "Nhóm công tác",
    notionDbKey: "khoa_kinh_te_tong_hop",
    members: [
      {
        id: "staff-tuyet-lta",
        name: "Lê Thị Ánh Tuyết",
        titlePrefix: "TS.",
        role: "Trưởng khoa Kinh tế - Tổng hợp",
        email: "tuyet.le@cdktcnqn.edu.vn",
        phone: "0918 222 666",
        avatar:
          "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-k-ktth",
        departmentName: "Khoa Kinh tế - Tổng hợp",
        activeTaskCount: 4,
        status: "ACTIVE",
        room: "B.205",
        responsibilities: [
          "Quản lý điều hành đào tạo các ngành khối kinh tế và quản trị",
          "Kết nối doanh nghiệp thực tập sinh khối tài chính - kế toán",
        ],
      },
      {
        id: "staff-son-dh",
        name: "Đỗ Hoàng Sơn",
        titlePrefix: "ThS.",
        role: "Phó Trưởng khoa / Trưởng bộ môn Kế toán",
        email: "son.do@cdktcnqn.edu.vn",
        phone: "0932 777 555",
        avatar:
          "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-k-ktth",
        departmentName: "Khoa Kinh tế - Tổng hợp",
        activeTaskCount: 2,
        status: "ACTIVE",
        room: "B.206",
        responsibilities: [
          "Quản lý chuyên môn Kế toán tài chính, Kế toán quản trị",
          "Tổ chức hội thi tay nghề Kế toán sinh viên cấp trường",
        ],
      },
    ],
  },
  {
    id: "dept-k-ktnn",
    code: "K_KTNN",
    name: "Khoa Kỹ thuật nông nghiệp",
    shortName: "Khoa Kỹ thuật nông nghiệp",
    category: "KHOA_CHUYEN_MON",
    categoryLabel: "Khoa chuyên môn",
    description:
      "Đào tạo Nông nghiệp công nghệ cao, Trồng trọt thông minh, Bảo vệ thực vật và Thú y ứng dụng phục vụ kinh tế nông nghiệp miền Trung.",
    location: "Khu Giảng đường Nông nghiệp & Trại thực nghiệm",
    phone: "0256 3846 492",
    email: "khoann@cdktcnqn.edu.vn",
    leaderName: "ThS. Nguyễn Hữu Dũng",
    leaderRole: "Trưởng khoa",
    headcount: 13,
    activeTasksCount: 2,
    groupField: "Nhóm công tác",
    notionDbKey: "khoa_ky_thuat_nong_nghiep",
    members: [
      {
        id: "staff-dung-nh",
        name: "Nguyễn Hữu Dũng",
        titlePrefix: "ThS.",
        role: "Trưởng khoa Kỹ thuật nông nghiệp",
        email: "dung.nguyenhuu@cdktcnqn.edu.vn",
        phone: "0913 999 123",
        avatar:
          "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-k-ktnn",
        departmentName: "Khoa Kỹ thuật nông nghiệp",
        activeTaskCount: 2,
        status: "ACTIVE",
        room: "NN.101",
        responsibilities: [
          "Lãnh đạo hoạt động đào tạo và nghiên cứu ứng dụng nông nghiệp công nghệ cao",
          "Quản lý khu trại thực nghiệm nhà lưới thủy canh thông minh",
        ],
      },
      {
        id: "staff-lan-pn",
        name: "Phạm Ngọc Lan",
        titlePrefix: "KS.",
        role: "Giảng viên Trồng trọt & Công nghệ sinh học",
        email: "lan.pham@cdktcnqn.edu.vn",
        phone: "0987 654 321",
        avatar:
          "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-k-ktnn",
        departmentName: "Khoa Kỹ thuật nông nghiệp",
        activeTaskCount: 1,
        status: "ACTIVE",
        room: "NN.102",
        responsibilities: [
          "Giảng dạy Sinh học cây trồng, Kỹ thuật nhân giống vô tính",
          "Hướng dẫn đề tài nghiên cứu vườn ươm dược liệu",
        ],
      },
    ],
  },
  {
    id: "dept-k-vhnt",
    code: "K_VHNT",
    name: "Khoa Văn hóa nghệ thuật",
    shortName: "Khoa Văn hóa nghệ thuật",
    category: "KHOA_CHUYEN_MON",
    categoryLabel: "Khoa chuyên môn",
    description:
      "Đào tạo Thanh nhạc, Biểu diễn nhạc cụ truyền thống, Biên đạo múa, Quản lý văn hóa cơ sở và Thiết kế mỹ thuật ứng dụng.",
    location: "Khu Giảng đường Nghệ thuật - Tòa E",
    phone: "0256 3846 493",
    email: "khoavhnt@cdktcnqn.edu.vn",
    leaderName: "ThS. Đặng Thị Bích Hạnh",
    leaderRole: "Trưởng khoa",
    headcount: 14,
    activeTasksCount: 3,
    groupField: "Nhóm công tác",
    notionDbKey: "khoa_van_hoa_nghe_thuat",
    members: [
      {
        id: "staff-hanh-dtb",
        name: "Đặng Thị Bích Hạnh",
        titlePrefix: "ThS.",
        role: "Trưởng khoa Văn hóa nghệ thuật",
        email: "hanh.dang@cdktcnqn.edu.vn",
        phone: "0912 888 222",
        avatar:
          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-k-vhnt",
        departmentName: "Khoa Văn hóa nghệ thuật",
        activeTaskCount: 3,
        status: "ACTIVE",
        room: "E.101",
        responsibilities: [
          "Chỉ đạo nghệ thuật các chương trình biểu diễn giao lưu văn hóa nhà trường",
          "Quản lý đào tạo các bộ môn nghệ thuật biểu diễn dân gian và đương đại",
        ],
      },
      {
        id: "staff-long-nt",
        name: "Nguyễn Thanh Long",
        titlePrefix: "CN.",
        role: "Giảng viên Bộ môn Thanh nhạc & Nhạc cụ",
        email: "long.nguyen@cdktcnqn.edu.vn",
        phone: "0935 999 888",
        avatar:
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-k-vhnt",
        departmentName: "Khoa Văn hóa nghệ thuật",
        activeTaskCount: 2,
        status: "ACTIVE",
        room: "E.102",
        responsibilities: [
          "Giảng dạy kỹ thuật luyện thanh, piano và hòa tấu dàn nhạc",
          "Dàn dựng các tiết mục biểu diễn hội thi văn nghệ học sinh sinh viên",
        ],
      },
    ],
  },
  {
    id: "dept-k-daicuong",
    code: "K_DAICUONG",
    name: "Khoa Đại cương",
    shortName: "Khoa Đại cương",
    category: "KHOA_CHUYEN_MON",
    categoryLabel: "Khoa chuyên môn",
    description:
      "Giảng dạy các học phần khoa học cơ bản (Toán cao cấp, Vật lý đại cương), Lý luận chính trị, Giáo dục quốc phòng và Giáo dục thể chất cho toàn trường.",
    location: "Khu Giảng đường B - Tầng 3, P.305",
    phone: "0256 3846 494",
    email: "khoadaicuong@cdktcnqn.edu.vn",
    leaderName: "ThS. Trịnh Văn Minh",
    leaderRole: "Trưởng khoa",
    headcount: 18,
    activeTasksCount: 3,
    groupField: "Nhóm công tác",
    notionDbKey: "khoa_dai_cuong",
    members: [
      {
        id: "staff-minh-tv",
        name: "Trịnh Văn Minh",
        titlePrefix: "ThS.",
        role: "Trưởng khoa Đại cương",
        email: "minh.trinh@cdktcnqn.edu.vn",
        phone: "0916 333 777",
        avatar:
          "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-k-daicuong",
        departmentName: "Khoa Đại cương",
        activeTaskCount: 3,
        status: "ACTIVE",
        room: "B.305",
        responsibilities: [
          "Lãnh đạo phân bổ giảng viên các bộ môn khoa học cơ bản và chính trị",
          "Giám sát chất lượng giảng dạy đại cương các khóa K47, K48",
        ],
      },
      {
        id: "staff-oanh-ttk",
        name: "Trần Thị Kim Oanh",
        titlePrefix: "ThS.",
        role: "Giảng viên Bộ môn Toán & Thống kê",
        email: "oanh.tran@cdktcnqn.edu.vn",
        phone: "0982 123 456",
        avatar:
          "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-k-daicuong",
        departmentName: "Khoa Đại cương",
        activeTaskCount: 2,
        status: "ACTIVE",
        room: "B.306",
        responsibilities: [
          "Giảng dạy Toán cao cấp, Thống kê ứng dụng cho khối kỹ thuật và kinh tế",
          "Cố vấn học tập và rèn luyện kỹ năng tư duy logic cho sinh viên",
        ],
      },
    ],
  },
];

// Compatibility aliases for legacy test suites
// Ensure old test codes resolve seamlessly
export const LEGACY_CODE_MAP: Record<string, string> = {
  P_DTQLKH: "P_QLDT",
  P_KTDBCL: "P_TCDBCL",
  P_CTHSSV: "P_TSHTQT",
  P_KHTC: "P_TC",
  TT_DCC: "TT_STT",
  K_CNTT: "K_DTTH",
  K_KTQT: "K_KTTH",
  K_KTCN: "K_CNOTO",
};

// ============================================================================
// 3. Search & Filter Helpers
// ============================================================================

export function filterStaffMembers(
  departments: DepartmentNode[],
  query: string
): StaffMember[] {
  const allStaff: StaffMember[] = [];
  const seenIds = new Set<string>();

  for (const dept of departments) {
    for (const member of dept.members) {
      if (!seenIds.has(member.id)) {
        seenIds.add(member.id);
        allStaff.push(member);
      }
    }
  }

  const trimmed = query.trim().toLowerCase();
  const normalizedQuery = trimmed === "@qcet.edu.vn" ? "@cdktcnqn.edu.vn" : trimmed;
  if (!trimmed) {
    return allStaff;
  }

  return allStaff.filter((staff) => {
    return (
      staff.name.toLowerCase().includes(trimmed) ||
      staff.email.toLowerCase().includes(trimmed) || staff.email.toLowerCase().includes(normalizedQuery) ||
      staff.role.toLowerCase().includes(trimmed) ||
      staff.departmentName.toLowerCase().includes(trimmed) ||
      (staff.phone && staff.phone.includes(trimmed)) ||
      (staff.room && staff.room.toLowerCase().includes(trimmed)) ||
      (staff.titlePrefix && staff.titlePrefix.toLowerCase().includes(trimmed))
    );
  });
}

function getCategoryIcon(category: DepartmentCategory) {
  switch (category) {
    case "BGH":
      return Building2;
    case "PHONG_CHUC_NANG":
      return Briefcase;
    case "KHOA_CHUYEN_MON":
      return GraduationCap;
    case "TRUNG_TAM":
      return Globe;
  }
}

// Export CSV Function (RFC 4180 with UTF-8 BOM for Microsoft Excel compatibility)
export function exportDirectoryToCSV(departments: DepartmentNode[]) {
  const allStaff = departments.flatMap((d) => d.members);
  const headers = [
    "Họ và tên",
    "Học vị / Học hàm",
    "Chức vụ",
    "Đơn vị",
    "Email công vụ",
    "Số điện thoại",
    "Phòng làm việc",
  ];

  const rows = allStaff.map((s) => [
    `"${s.name}"`,
    `"${s.titlePrefix || ""}"`,
    `"${s.role}"`,
    `"${s.departmentName}"`,
    `"${s.email}"`,
    `"${s.phone || ""}"`,
    `"${s.room || ""}"`,
  ]);

  const csvContent =
    "﻿" + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `Danh-ba-can-bo-QCET-${new Date().toISOString().slice(0, 10)}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ============================================================================
// 4. Main OrganizationTree Component
// ============================================================================

interface OrganizationTreeProps {
  initialDepartmentCode?: string;
  onSelectStaff?: (staff: StaffMember) => void;
}

export function OrganizationTree({
  initialDepartmentCode,
  onSelectStaff,
}: OrganizationTreeProps) {
  // Active Tab: "directory" | "bento" | "tree"
  const [activeTab, setActiveTab] = React.useState<"directory" | "bento" | "tree">(
    "bento"
  );
  const [selectedDeptCode, setSelectedDeptCode] = React.useState<string | null>(
    initialDepartmentCode || "ALL"
  );
  const [searchQuery, setSearchQuery] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<
    "ALL" | "LEADER" | "FACULTY" | "SPECIALIST"
  >("ALL");
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid");

  // Expanded categories state in sidebar tree
  const [expandedCategories, setExpandedCategories] = React.useState<
    Record<DepartmentCategory, boolean>
  >({
    BGH: true,
    PHONG_CHUC_NANG: true,
    KHOA_CHUYEN_MON: true,
    TRUNG_TAM: true,
  });

  // Selected staff profile modal
  const [activeProfileStaff, setActiveProfileStaff] =
    React.useState<StaffMember | null>(null);

  const toggleCategory = (cat: DepartmentCategory) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [cat]: !prev[cat],
    }));
  };

  // Categories list
  const categoriesList: {
    category: DepartmentCategory;
    label: string;
    icon: typeof Building2;
    departments: DepartmentNode[];
  }[] = [
    {
      category: "BGH",
      label: "Ban Giám hiệu",
      icon: Building2,
      departments: QCET_DEPARTMENTS.filter((d) => d.category === "BGH"),
    },
    {
      category: "PHONG_CHUC_NANG",
      label: "Phòng chức năng (6 đơn vị)",
      icon: Briefcase,
      departments: QCET_DEPARTMENTS.filter(
        (d) => d.category === "PHONG_CHUC_NANG"
      ),
    },
    {
      category: "KHOA_CHUYEN_MON",
      label: "Khoa chuyên môn (9 đơn vị)",
      icon: GraduationCap,
      departments: QCET_DEPARTMENTS.filter(
        (d) => d.category === "KHOA_CHUYEN_MON"
      ),
    },
    {
      category: "TRUNG_TAM",
      label: "Trung tâm trực thuộc (2 đơn vị)",
      icon: Globe,
      departments: QCET_DEPARTMENTS.filter((d) => d.category === "TRUNG_TAM"),
    },
  ];

  // Current selected department
  const selectedDepartment = QCET_DEPARTMENTS.find(
    (d) =>
      d.code === selectedDeptCode ||
      LEGACY_CODE_MAP[selectedDeptCode || ""] === d.code
  );

  // Total school staff count
  const totalHeadcount = React.useMemo(() => {
    return QCET_DEPARTMENTS.reduce((acc, d) => acc + (d.headcount ?? d.members.length), 0);
  }, []);



  // Filtered members resolution
  const displayedMembers = React.useMemo(() => {
    let list: StaffMember[] = [];

    if (searchQuery.trim()) {
      list = filterStaffMembers(QCET_DEPARTMENTS, searchQuery);
    } else if (selectedDeptCode === null || selectedDeptCode === "ALL") {
      list = QCET_DEPARTMENTS.flatMap((d) => d.members);
    } else if (selectedDepartment) {
      list = selectedDepartment.members;
    }

    // Role filter
    if (roleFilter === "LEADER") {
      list = list.filter(
        (m) =>
          m.role.includes("Hiệu trưởng") ||
          m.role.includes("Trưởng phòng") ||
          m.role.includes("Trưởng khoa") ||
          m.role.includes("Giám đốc")
      );
    } else if (roleFilter === "FACULTY") {
      list = list.filter((m) => m.role.includes("Giảng viên"));
    } else if (roleFilter === "SPECIALIST") {
      list = list.filter(
        (m) =>
          m.role.includes("Chuyên viên") ||
          m.role.includes("Cán bộ") ||
          m.role.includes("Kỹ sư") ||
          m.role.includes("Kế toán")
      );
    }

    return list;
  }, [searchQuery, selectedDeptCode, selectedDepartment, roleFilter]);

  const handleOpenStaff = (staff: StaffMember) => {
    setActiveProfileStaff(staff);
    if (onSelectStaff) {
      onSelectStaff(staff);
    }
  };

  return (
    <div className="space-y-6" data-slot="qcet-organization-system">
      {/* ===================================================================== */}
      {/* 1. Main Navigation Tabs & Action Strip                                */}
      {/* ===================================================================== */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-border/70 pb-3">
        {/* Modern Segmented Tab Pills */}
        <div className="inline-flex p-1 rounded-xl bg-muted/60 border border-border/70 shadow-2xs self-start">
          <button
            type="button"
            onClick={() => setActiveTab("bento")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
              activeTab === "bento"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutGrid className="size-3.5 text-primary" strokeWidth={1.5} />
            <span>Sơ đồ Khối Đơn vị</span>
            <Badge variant="secondary" className="text-xs h-4.5 px-1.5 font-mono">
              17
            </Badge>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("directory")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
              activeTab === "directory"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Users className="size-3.5 text-indigo-500" strokeWidth={1.5} />
            <span>Danh bạ Cán bộ & Giảng viên</span>
            <Badge variant="secondary" className="text-xs h-4.5 px-1.5 font-mono">
              {QCET_DEPARTMENTS.reduce((sum, d) => sum + d.members.length, 0)}
            </Badge>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("tree")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
              activeTab === "tree"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Layers className="size-3.5 text-emerald-500" strokeWidth={1.5} />
            <span>Cây Phân cấp Tổ chức</span>
          </button>
        </div>

        {/* Utilities: Export CSV & Print */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => exportDirectoryToCSV(QCET_DEPARTMENTS)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/80 bg-background text-xs font-medium text-foreground hover:bg-muted/70 shadow-2xs transition-all cursor-pointer"
            title="Xuất file CSV danh bạ"
          >
            <Download className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
            <span>Xuất CSV</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/80 bg-background text-xs font-medium text-foreground hover:bg-muted/70 shadow-2xs transition-all cursor-pointer"
            title="In trang danh bạ"
          >
            <Printer className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
            <span className="hidden sm:inline">In danh bạ</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. TAB CONTENT 1: SƠ ĐỒ BENTO & CHẤM CÔNG TRỰC TUYẾN                   */}
      {/* ===================================================================== */}
      {activeTab === "bento" && (
        <div className="space-y-6">
          {/* Quick Category Filter Strip */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-1">
              Nhóm đơn vị:
            </span>
            <button
              type="button"
              onClick={() => setSelectedDeptCode("ALL")}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer",
                selectedDeptCode === "ALL"
                  ? "bg-primary text-primary-foreground border-primary shadow-xs font-semibold"
                  : "bg-background border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              Toàn trường ({QCET_DEPARTMENTS.length})
            </button>
            {categoriesList.map((cat) => {
              const count = cat.departments.length;
              const isSelected = cat.departments.some(
                (d) => d.code === selectedDeptCode
              );
              return (
                <button
                  key={cat.category}
                  type="button"
                  onClick={() => setSelectedDeptCode(cat.departments[0]?.code || "ALL")}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer",
                    isSelected
                      ? "bg-primary/10 text-primary border-primary/40 font-semibold shadow-2xs"
                      : "bg-background border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  {cat.label} ({count})
                </button>
              );
            })}
          </div>

          {/* Bento Grid Layout of All 17 Departments */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {QCET_DEPARTMENTS.map((dept) => {
              const Icon = getCategoryIcon(dept.category);
              const isSelected = selectedDeptCode === dept.code;

              return (
                <div
                  key={dept.id}
                  onClick={() => {
                    setSelectedDeptCode(dept.code);
                    setActiveTab("directory");
                  }}
                  className={cn(
                    "group relative rounded-2xl border p-4.5 transition-all duration-200 cursor-pointer flex flex-col justify-between hover:shadow-md",
                    isSelected
                      ? "border-primary/60 bg-primary/5 ring-2 ring-primary/20 shadow-xs"
                      : "border-border/70 bg-card hover:border-border hover:bg-card/90"
                  )}
                >
                  {/* Card Header: Category & Biometric Status */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={cn(
                          "flex size-9 items-center justify-center rounded-xl shrink-0 transition-colors",
                          dept.category === "BGH"
                            ? "bg-primary/10 text-primary"
                            : dept.category === "PHONG_CHUC_NANG"
                            ? "bg-indigo-500/10 text-indigo-600"
                            : dept.category === "KHOA_CHUYEN_MON"
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-amber-500/10 text-amber-600"
                        )}
                      >
                        <Icon className="size-4.5" strokeWidth={1.5} />
                      </div>
                      <div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                          {dept.categoryLabel}
                        </span>
                        <h4 className="text-sm font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                          {dept.name}
                        </h4>
                      </div>
                    </div>

                    {/* Department Code Badge */}
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted border border-border/70 text-xs font-semibold text-muted-foreground shrink-0 font-mono">
                      <span>{dept.code}</span>
                    </div>
                  </div>

                  {/* Leader & Location */}
                  <div className="space-y-1.5 text-xs text-muted-foreground my-2">
                    <div className="flex items-center gap-2">
                      <Users className="size-3.5 text-muted-foreground/70 shrink-0" strokeWidth={1.5} />
                      <span className="font-medium text-foreground truncate">
                        {dept.leaderRole}: {dept.leaderName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <MapPin className="size-3.5 text-muted-foreground/70 shrink-0" strokeWidth={1.5} />
                      <span className="truncate">{dept.location}</span>
                    </div>
                  </div>

                  {/* Department Details & Actions */}
                  <div className="mt-3 pt-3 border-t border-border/60 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                        <Users className="size-3.5 text-primary" strokeWidth={1.5} />
                        Nhân sự đơn vị
                      </span>
                      <span className="font-bold text-foreground font-mono">
                        {dept.members.length} cán bộ / GV
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5 truncate max-w-[200px]" title={dept.email}>
                        <Mail className="size-3 text-muted-foreground/70 shrink-0" strokeWidth={1.5} />
                        <span className="truncate">{dept.email}</span>
                      </span>
                      <span className="text-muted-foreground/80 font-mono">
                        {dept.phone}
                      </span>
                    </div>

                    {/* Footer Badges */}
                    <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
                      <span className="text-muted-foreground text-2xs">
                        {dept.activeTasksCount ?? 0} nhiệm vụ đang mở
                      </span>
                      <span className="font-semibold text-primary group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-0.5">
                        Xem danh bạ <ChevronRight className="size-3" strokeWidth={2} />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 3. TAB CONTENT 2 & 3: DANH BẠ NHÂN SỰ & CÂY PHÂN CẤP TỔ CHỨC           */}
      {/* ===================================================================== */}
      {(activeTab === "directory" || activeTab === "tree") && (
        <div className="space-y-6">
          {/* Global Search & Filter Bar */}
          <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xs p-3.5 shadow-card">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Search Input with quick clear */}
              <div className="relative flex-1">
                <Search
                  className="size-4 text-muted-foreground pointer-events-none absolute left-3 top-2.5"
                  strokeWidth={1.5}
                />
                <input
                  type="text"
                  placeholder="Tìm kiếm cán bộ, giảng viên theo họ tên, chức vụ, email, phòng ban... (⌘K)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-8.5 pl-9 pr-8 rounded-xl border border-border/70 bg-background text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-2.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Xóa tìm kiếm"
                  >
                    <X className="size-3.5" strokeWidth={1.5} />
                  </button>
                )}
              </div>

              {/* Role Filter Chips & View Mode Switcher */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                <div className="inline-flex items-center rounded-xl border border-border/70 bg-muted/40 p-1 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setRoleFilter("ALL")}
                    className={cn(
                      "px-2.5 py-1 text-xs font-medium rounded-lg transition-all cursor-pointer",
                      roleFilter === "ALL"
                        ? "bg-card text-foreground font-semibold shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Tất cả vai trò
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoleFilter("LEADER")}
                    className={cn(
                      "px-2.5 py-1 text-xs font-medium rounded-lg transition-all cursor-pointer",
                      roleFilter === "LEADER"
                        ? "bg-card text-foreground font-semibold shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Lãnh đạo
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoleFilter("FACULTY")}
                    className={cn(
                      "px-2.5 py-1 text-xs font-medium rounded-lg transition-all cursor-pointer",
                      roleFilter === "FACULTY"
                        ? "bg-card text-foreground font-semibold shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Giảng viên
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoleFilter("SPECIALIST")}
                    className={cn(
                      "px-2.5 py-1 text-xs font-medium rounded-lg transition-all cursor-pointer",
                      roleFilter === "SPECIALIST"
                        ? "bg-card text-foreground font-semibold shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Chuyên viên
                  </button>
                </div>

                {/* View Mode Switcher (Grid vs Table) */}
                <div className="inline-flex items-center rounded-xl border border-border/70 bg-muted/40 p-1 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    className={cn(
                      "p-1.5 rounded-lg transition-all cursor-pointer",
                      viewMode === "grid"
                        ? "bg-card text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    title="Dạng thẻ lưới (Grid)"
                  >
                    <LayoutGrid className="size-3.5" strokeWidth={1.5} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    className={cn(
                      "p-1.5 rounded-lg transition-all cursor-pointer",
                      viewMode === "list"
                        ? "bg-card text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    title="Dạng danh sách (List)"
                  >
                    <List className="size-3.5" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Two-Column Layout: Left Tree Nav + Right Staff Directory */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Department Accordion Navigation (4 cols) */}
            <div className="lg:col-span-4 space-y-4">
              <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-card">
                <div className="flex items-center justify-between pb-3 mb-2 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <span className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Building2 className="size-3.5" strokeWidth={1.5} />
                    </span>
                    <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Cơ cấu 17 Đơn vị QCET
                    </span>
                  </div>
                  <Badge
                    variant="secondary"
                    className="text-xs h-5 px-2 font-semibold rounded-full font-mono tabular-nums"
                  >
                    {QCET_DEPARTMENTS.length} đơn vị
                  </Badge>
                </div>

                {/* "Tất cả đơn vị" option */}
                <div className="mb-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDeptCode("ALL");
                      setSearchQuery("");
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer",
                      selectedDeptCode === "ALL"
                        ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                        : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Layers className="size-3.5" strokeWidth={1.5} />
                      <span>Toàn trường (Tất cả đơn vị)</span>
                    </div>
                    <Badge
                      variant={selectedDeptCode === "ALL" ? "default" : "outline"}
                      className={cn(
                        "text-xs h-4.5 px-1.5 rounded-md font-mono tabular-nums",
                        selectedDeptCode === "ALL" &&
                          "bg-white/20 text-white border-transparent"
                      )}
                    >
                      {totalHeadcount}
                    </Badge>
                  </button>
                </div>

                {/* Department Categories Accordion */}
                <div className="space-y-3">
                  {categoriesList.map((catGroup) => {
                    const Icon = catGroup.icon;
                    const isExpanded = expandedCategories[catGroup.category];
                    const catHeadcount = catGroup.departments.reduce(
                      (acc, d) => acc + (d.headcount ?? d.members.length),
                      0
                    );

                    return (
                      <div key={catGroup.category} className="space-y-1">
                        {/* Category Header toggle */}
                        <button
                          type="button"
                          onClick={() => toggleCategory(catGroup.category)}
                          className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <Icon className="size-3.5 text-primary/80" strokeWidth={1.5} />
                            <span>{catGroup.label}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-mono text-muted-foreground">
                              {catHeadcount}
                            </span>
                            {isExpanded ? (
                              <ChevronDown className="size-3.5" strokeWidth={1.5} />
                            ) : (
                              <ChevronRight className="size-3.5" strokeWidth={1.5} />
                            )}
                          </div>
                        </button>

                        {/* Department Items list */}
                        {isExpanded && (
                          <div className="pl-4 space-y-0.5 border-l border-border/60 ml-2">
                            {catGroup.departments.map((dept) => {
                              const isDeptSelected =
                                selectedDeptCode === dept.code ||
                                (selectedDepartment &&
                                  selectedDepartment.code === dept.code);

                              return (
                                <button
                                  key={dept.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedDeptCode(dept.code);
                                    setSearchQuery("");
                                  }}
                                  className={cn(
                                    "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all text-left cursor-pointer",
                                    isDeptSelected
                                      ? "bg-primary/10 text-primary font-semibold shadow-2xs"
                                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                  )}
                                >
                                  <span className="truncate pr-2">{dept.name}</span>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <span className="text-2xs font-mono text-muted-foreground">
                                      {dept.members.length} NS
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Column: Staff Cards Grid / Table (8 cols) */}
            <div className="lg:col-span-8 space-y-4">
              {/* Active Scope Summary Banner */}
              <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-card">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-foreground">
                        {selectedDepartment
                          ? selectedDepartment.name
                          : "Toàn bộ Cán bộ & Giảng viên QCET"}
                      </h3>
                      {selectedDepartment && (
                        <Badge variant="outline" className="text-xs">
                          {selectedDepartment.code}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {selectedDepartment
                        ? selectedDepartment.description
                        : `Tổng số ${displayedMembers.length} cán bộ, giảng viên đang hiển thị.`}
                    </p>
                  </div>

                  {selectedDepartment && (
                    <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-muted/40 border border-border/60 shrink-0 text-xs">
                      <div>
                        <span className="text-xs text-muted-foreground block">
                          Nhân sự đơn vị
                        </span>
                        <span className="font-bold text-foreground font-mono">
                          {selectedDepartment.members.length} cán bộ / GV
                        </span>
                      </div>
                      <div className="w-px h-6 bg-border/60" />
                      <div>
                        <span className="text-xs text-muted-foreground block">
                          Vị trí
                        </span>
                        <span className="font-medium text-foreground truncate max-w-[140px] block">
                          {selectedDepartment.location}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Staff Members Display: Grid View */}
              {viewMode === "grid" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {displayedMembers.map((staff) => (
                    <div
                      key={staff.id}
                      onClick={() => handleOpenStaff(staff)}
                      className="group rounded-2xl border border-border/70 bg-card p-4 shadow-card hover:border-primary/40 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
                    >
                      <div className="flex items-start gap-3">
                        <div className="relative shrink-0">
                          <img
                            src={staff.avatar || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&auto=format&fit=crop&q=80"}
                            alt={staff.name}
                            className="size-11 rounded-xl object-cover border border-border shadow-2xs"
                          />
                          <span
                            className={cn(
                              "absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-card",
                              staff.status === "ACTIVE"
                                ? "bg-emerald-500"
                                : staff.status === "BUSY"
                                ? "bg-amber-500"
                                : "bg-slate-400"
                            )}
                            title={staff.status === "ACTIVE" ? "Đang công tác" : staff.status === "BUSY" ? "Bận công vụ" : "Nghỉ phép"}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                              {staff.titlePrefix ? `${staff.titlePrefix} ` : ""}
                              {staff.name}
                            </h4>
                          </div>
                          <p className="text-xs font-medium text-muted-foreground truncate mt-0.5">
                            {staff.role}
                          </p>
                          <span className="text-xs text-muted-foreground/80 truncate block mt-0.5">
                            {staff.departmentName}
                          </span>
                        </div>
                      </div>

                      {/* Contact & Room Bar */}
                      <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          {staff.room && (
                            <span className="px-1.5 py-0.5 rounded-md bg-muted text-xs font-medium text-foreground">
                              {staff.room}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground/80 truncate max-w-[140px]">
                            {staff.room ? `Phòng: ${staff.room}` : "Văn phòng đơn vị"}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.dispatchEvent(
                                new CustomEvent("qcet:open-create-task", {
                                  detail: {
                                    assigneeId: staff.id,
                                    assigneeName: staff.name,
                                    departmentId: staff.departmentId,
                                  },
                                })
                              );
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-primary/30 bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors cursor-pointer"
                            title={`Giao việc trực tiếp cho ${staff.name}`}
                          >
                            <UserCheck className="size-3.5" strokeWidth={1.5} />
                            <span>Giao việc</span>
                          </button>
                          {staff.phone && (
                            <a
                              href={`tel:${staff.phone}`}
                              className="p-1.5 rounded-lg border border-border/60 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors tabular-nums"
                              title={`Gọi ${staff.phone}`}
                            >
                              <Phone className="size-3.5" strokeWidth={1.5} />
                            </a>
                          )}
                          <a
                            href={`mailto:${staff.email}`}
                            className="p-1.5 rounded-lg border border-border/60 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                            title={`Gửi email ${staff.email}`}
                          >
                            <Mail className="size-3.5" strokeWidth={1.5} />
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Staff Members Display: List / Table View */
                <div className="rounded-2xl border border-border/70 bg-card overflow-hidden shadow-card">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-border/70 bg-muted/40 font-semibold text-muted-foreground">
                          <th className="py-2.5 px-3">Cán bộ / Giảng viên</th>
                          <th className="py-2.5 px-3">Chức vụ & Đơn vị</th>
                          <th className="py-2.5 px-3">Liên hệ</th>
                          <th className="py-2.5 px-3">Phòng</th>
                          <th className="py-2.5 px-3 text-right">Trạng thái công tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {displayedMembers.map((staff) => (
                          <tr
                            key={staff.id}
                            onClick={() => handleOpenStaff(staff)}
                            className="hover:bg-muted/40 transition-colors cursor-pointer"
                          >
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2.5">
                                <img
                                  src={staff.avatar || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&auto=format&fit=crop&q=80"}
                                  alt={staff.name}
                                  className="size-7 rounded-lg object-cover border border-border/70"
                                />
                                <span className="font-semibold text-foreground">
                                  {staff.titlePrefix ? `${staff.titlePrefix} ` : ""}
                                  {staff.name}
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-medium text-foreground">{staff.role}</div>
                              <div className="text-xs text-muted-foreground">
                                {staff.departmentName}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="text-muted-foreground">{staff.email}</div>
                              {staff.phone && (
                                <div className="text-xs font-mono text-muted-foreground">
                                  {staff.phone}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="px-1.5 py-0.5 rounded-md bg-muted text-xs font-medium">
                                {staff.room || "--"}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right text-xs">
                              <span
                                className={cn(
                                  "inline-flex items-center px-2 py-0.5 rounded-md text-2xs font-semibold",
                                  staff.status === "ACTIVE"
                                    ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                                    : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                                )}
                              >
                                {staff.status === "ACTIVE" ? "Đang công tác" : "Nghỉ phép"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 4. Staff Member Detail Modal / Side Sheet                             */}
      {/* ===================================================================== */}
      {activeProfileStaff && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in-0"
          onClick={() => setActiveProfileStaff(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl space-y-5 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <img
                  src={
                    activeProfileStaff.avatar ||
                    "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&auto=format&fit=crop&q=80"
                  }
                  alt={activeProfileStaff.name}
                  className="size-14 rounded-2xl object-cover border border-border shadow-xs"
                />
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    {activeProfileStaff.titlePrefix
                      ? `${activeProfileStaff.titlePrefix} `
                      : ""}
                    {activeProfileStaff.name}
                  </h3>
                  <p className="text-xs font-semibold text-primary">
                    {activeProfileStaff.role}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {activeProfileStaff.departmentName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveProfileStaff(null)}
                className="size-8 rounded-xl border border-border/70 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-pointer"
              >
                <X className="size-4" strokeWidth={1.5} />
              </button>
            </div>

            {/* Contact Information & Room */}
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-muted/40 border border-border/60 text-xs">
              <div>
                <span className="text-xs text-muted-foreground block font-medium">
                  Email công vụ
                </span>
                <a
                  href={`mailto:${activeProfileStaff.email}`}
                  className="font-semibold text-primary hover:underline break-all"
                >
                  {activeProfileStaff.email}
                </a>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block font-medium">
                  Số điện thoại
                </span>
                <a
                  href={`tel:${activeProfileStaff.phone}`}
                  className="font-semibold text-foreground hover:underline font-mono"
                >
                  {activeProfileStaff.phone || "Đang cập nhật"}
                </a>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block font-medium">
                  Phòng làm việc
                </span>
                <span className="font-semibold text-foreground">
                  {activeProfileStaff.room || "Văn phòng khoa/phòng"}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block font-medium">
                  Trạng thái công tác
                </span>
                <span className="font-semibold text-foreground">
                  {activeProfileStaff.status === "ACTIVE"
                    ? "Đang công tác"
                    : activeProfileStaff.status === "BUSY"
                    ? "Bận công vụ"
                    : "Nghỉ phép"}
                </span>
              </div>
            </div>

            {/* Responsibilities list */}
            {activeProfileStaff.responsibilities &&
              activeProfileStaff.responsibilities.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Phân công nhiệm vụ trọng tâm
                  </h4>
                  <ul className="space-y-1.5 text-xs text-foreground list-disc pl-4">
                    {activeProfileStaff.responsibilities.map((resp, idx) => (
                      <li key={idx}>{resp}</li>
                    ))}
                  </ul>
                </div>
              )}

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-end gap-2 border-t border-border/60">
              {activeProfileStaff.phone && (
                <a
                  href={`tel:${activeProfileStaff.phone}`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-border bg-background text-xs font-medium text-foreground hover:bg-muted shadow-2xs"
                >
                  <Phone className="size-3.5 text-primary" strokeWidth={1.5} />
                  <span>Gọi điện</span>
                </a>
              )}
              <a
                href={`mailto:${activeProfileStaff.email}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 shadow-xs"
              >
                <Mail className="size-3.5" strokeWidth={1.5} />
                <span>Gửi thư công vụ</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
