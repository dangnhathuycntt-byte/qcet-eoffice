"use client";

import * as React from "react";
import {
  Building2,
  Users,
  Search,
  Mail,
  Phone,
  MapPin,
  ChevronRight,
  ChevronDown,
  Briefcase,
  GraduationCap,
  FolderKanban,
  Globe,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Filter,
  Layers,
  LayoutGrid,
  List,
  Plus,
  UserCheck,
  X,
  BadgeCheck,
  LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ============================================================================
// 1. Data Models & Types
// ============================================================================

export type DepartmentCategory =
  | "BGH"
  | "PHONG_CHUC_NANG"
  | "KHOA_CHUYEN_MON"
  | "TRUNG_TAM";

export interface StaffMember {
  id: string;
  name: string;
  role: string;
  titlePrefix?: string;
  email: string;
  phone: string;
  avatar: string;
  departmentId: string;
  departmentName: string;
  activeTaskCount: number;
  status?: "ACTIVE" | "ON_LEAVE" | "BUSY";
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
}

// ============================================================================
// 2. Authentic QCET Organizational Dataset
// ============================================================================

export const QCET_DEPARTMENTS: DepartmentNode[] = [
  // --------------------------------------------------------------------------
  // Ban Giám hiệu
  // --------------------------------------------------------------------------
  {
    id: "dept-bgh",
    code: "BGH",
    name: "Ban Giám hiệu Trường Cao đẳng KT-CN Quy Nhơn",
    shortName: "Ban Giám hiệu",
    category: "BGH",
    categoryLabel: "Ban Giám hiệu",
    description:
      "Lãnh đạo toàn diện và quản lý điều hành mọi mặt hoạt động của nhà trường theo điều lệ trường Cao đẳng và pháp luật hiện hành.",
    location: "Tòa nhà Hiệu bộ - Tầng 2, Phòng BGH",
    phone: "0256 3846 477",
    email: "bgh@qcet.edu.vn",
    leaderName: "TS. Nguyễn Minh Tuấn",
    leaderRole: "Hiệu trưởng",
    members: [
      {
        id: "staff-tuan-nm",
        name: "Nguyễn Minh Tuấn",
        titlePrefix: "TS.",
        role: "Hiệu trưởng",
        email: "tuan.nguyen@qcet.edu.vn",
        phone: "0913 456 789",
        avatar:
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-bgh",
        departmentName: "Ban Giám hiệu",
        activeTaskCount: 6,
        status: "ACTIVE",
        room: "Tầng 2 - P.201",
        responsibilities: [
          "Phụ trách chung toàn diện công tác nhà trường",
          "Công tác tổ chức cán bộ, chiến lược quy hoạch phát triển",
          "Kế hoạch tài chính và quan hệ đối ngoại cấp cao",
        ],
      },
      {
        id: "staff-dat-lt",
        name: "Lê Thành Đạt",
        titlePrefix: "ThS.",
        role: "Phó Hiệu trưởng",
        email: "dat.le@qcet.edu.vn",
        phone: "0914 234 567",
        avatar:
          "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-bgh",
        departmentName: "Ban Giám hiệu",
        activeTaskCount: 4,
        status: "ACTIVE",
        room: "Tầng 2 - P.202",
        responsibilities: [
          "Chỉ đạo công tác đào tạo chuyên môn và nghiên cứu khoa học",
          "Đổi mới chương trình đào tạo theo chuẩn kiểm định quốc tế",
          "Phối hợp hoạt động các khoa chuyên môn",
        ],
      },
      {
        id: "staff-cuc-htk",
        name: "Hoàng Thị Kim Cúc",
        titlePrefix: "ThS.",
        role: "Phó Hiệu trưởng",
        email: "cuc.hoang@qcet.edu.vn",
        phone: "0905 678 901",
        avatar:
          "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-bgh",
        departmentName: "Ban Giám hiệu",
        activeTaskCount: 3,
        status: "ACTIVE",
        room: "Tầng 2 - P.203",
        responsibilities: [
          "Chỉ đạo công tác Hành chính - Quản trị, Cơ sở vật chất",
          "Công tác học sinh sinh viên, đoàn thể và đời sống cán bộ",
          "Chỉ đạo chuyển đổi số và công tác khảo thí",
        ],
      },
    ],
  },

  // --------------------------------------------------------------------------
  // Phòng chức năng (5 units)
  // --------------------------------------------------------------------------
  {
    id: "dept-p-dtqlkh",
    code: "P_DTQLKH",
    name: "Phòng Đào tạo & Quản lý Khoa học",
    shortName: "Đào tạo & QLKH",
    category: "PHONG_CHUC_NANG",
    categoryLabel: "Phòng chức năng",
    description:
      "Tham mưu xây dựng quy mô, ngành nghề đào tạo, kế hoạch giảng dạy, quản lý học vụ và các đề tài sáng kiến NCKH toàn trường.",
    location: "Tòa nhà Hiệu bộ - Tầng 1, P.102",
    phone: "0256 3846 478",
    email: "daotao@qcet.edu.vn",
    leaderName: "ThS. Đỗ Quang Trung",
    leaderRole: "Trưởng phòng",
    members: [
      {
        id: "staff-trung-dq",
        name: "Đỗ Quang Trung",
        titlePrefix: "ThS.",
        role: "Trưởng phòng Đào tạo & QLKH",
        email: "trung.do@qcet.edu.vn",
        phone: "0982 111 222",
        avatar:
          "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-p-dtqlkh",
        departmentName: "Phòng Đào tạo & QLKH",
        activeTaskCount: 4,
        status: "ACTIVE",
        room: "P.102",
        responsibilities: [
          "Quản lý điều hành chung công tác đào tạo",
          "Phê duyệt thời khóa biểu, kế hoạch giảng dạy năm học",
        ],
      },
      {
        id: "staff-tri-vm",
        name: "Võ Minh Trí",
        titlePrefix: "ThS.",
        role: "Phó Trưởng phòng / Phụ trách Đào tạo & QLSV",
        email: "tri.vo@qcet.edu.vn",
        phone: "0988 234 567",
        avatar:
          "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-p-dtqlkh",
        departmentName: "Phòng Đào tạo & QLKH",
        activeTaskCount: 3,
        status: "ACTIVE",
        room: "P.102",
        responsibilities: [
          "Theo dõi hồ sơ sinh viên, tốt nghiệp và chuyển đổi chứng chỉ",
          "Điều phối giảng đường và phần mềm quản lý học vụ",
        ],
      },
      {
        id: "staff-thuy-ntb",
        name: "Nguyễn Thị Bích Thủy",
        titlePrefix: "ThS.",
        role: "Chuyên viên QLKH & Hợp tác Quốc tế",
        email: "thuy.nguyen@qcet.edu.vn",
        phone: "0976 555 666",
        avatar:
          "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-p-dtqlkh",
        departmentName: "Phòng Đào tạo & QLKH",
        activeTaskCount: 2,
        status: "ACTIVE",
        room: "P.102",
        responsibilities: [
          "Theo dõi đề tài NCKH, sáng kiến kinh nghiệm",
          "Quản lý hồ sơ dự án hợp tác quốc tế GIZ",
        ],
      },
    ],
  },
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
    email: "hanhchinh@qcet.edu.vn",
    leaderName: "ThS. Phan Văn Thanh",
    leaderRole: "Trưởng phòng",
    members: [
      {
        id: "staff-thanh-pv",
        name: "Phan Văn Thanh",
        titlePrefix: "ThS.",
        role: "Trưởng phòng Hành chính - Quản trị",
        email: "thanh.phan@qcet.edu.vn",
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
        email: "nam.le@qcet.edu.vn",
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
        email: "nhung.truong@qcet.edu.vn",
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
    id: "dept-p-khtc",
    code: "P_KHTC",
    name: "Phòng Kế hoạch - Tài chính",
    shortName: "Kế hoạch - Tài chính",
    category: "PHONG_CHUC_NANG",
    categoryLabel: "Phòng chức năng",
    description:
      "Tham mưu và thực hiện công tác quản lý tài chính, phân bổ ngân sách, kế toán thu chi và quyết toán vốn đầu tư theo quy định.",
    location: "Tòa nhà Hiệu bộ - Tầng 1, P.104",
    phone: "0256 3846 480",
    email: "taichinh@qcet.edu.vn",
    leaderName: "ThS. Trần Thị Mai Loan",
    leaderRole: "Trưởng phòng / Kế toán trưởng",
    members: [
      {
        id: "staff-loan-ttm",
        name: "Trần Thị Mai Loan",
        titlePrefix: "ThS.",
        role: "Kế toán trưởng / Trưởng phòng",
        email: "loan.tran@qcet.edu.vn",
        phone: "0915 222 333",
        avatar:
          "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-p-khtc",
        departmentName: "Phòng Kế hoạch - Tài chính",
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
        email: "van.ha@qcet.edu.vn",
        phone: "0934 888 999",
        avatar:
          "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-p-khtc",
        departmentName: "Phòng Kế hoạch - Tài chính",
        activeTaskCount: 2,
        status: "ACTIVE",
        room: "P.104",
        responsibilities: [
          "Thực hiện kế toán tiền lương, phụ cấp giảng dạy",
          "Báo cáo thuế và thanh quyết toán chế độ cán bộ",
        ],
      },
      {
        id: "staff-hao-bv",
        name: "Bùi Văn Hào",
        titlePrefix: "ThS.",
        role: "Chuyên viên Kế hoạch & Dự án",
        email: "hao.bui@qcet.edu.vn",
        phone: "0903 112 233",
        avatar:
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-p-khtc",
        departmentName: "Phòng Kế hoạch - Tài chính",
        activeTaskCount: 1,
        status: "ACTIVE",
        room: "P.104",
        responsibilities: [
          "Lập kế hoạch mua sắm trang thiết bị định kỳ",
          "Theo dõi nguồn vốn chương trình mục tiêu quốc gia",
        ],
      },
    ],
  },
  {
    id: "dept-p-ktdbcl",
    code: "P_KTDBCL",
    name: "Phòng Khảo thí & Đảm bảo chất lượng",
    shortName: "Khảo thí & ĐBCL",
    category: "PHONG_CHUC_NANG",
    categoryLabel: "Phòng chức năng",
    description:
      "Tổ chức công tác ngân hàng đề thi, coi thi, chấm thi, giám sát chất lượng đào tạo và thực hiện tự đánh giá kiểm định cơ sở.",
    location: "Tòa nhà Hiệu bộ - Tầng 2, P.203",
    phone: "0256 3846 481",
    email: "khaothi@qcet.edu.vn",
    leaderName: "TS. Nguyễn Công Minh",
    leaderRole: "Trưởng phòng",
    members: [
      {
        id: "staff-minh-nc",
        name: "Nguyễn Công Minh",
        titlePrefix: "TS.",
        role: "Trưởng phòng Khảo thí & ĐBCL",
        email: "minh.nguyen@qcet.edu.vn",
        phone: "0916 444 555",
        avatar:
          "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-p-ktdbcl",
        departmentName: "Phòng Khảo thí & ĐBCL",
        activeTaskCount: 3,
        status: "ACTIVE",
        room: "P.203",
        responsibilities: [
          "Chỉ đạo công tác khảo thí và kiểm định chất lượng GDNN",
          "Chuẩn hóa ngân hàng đề thi và quy trình thi tập trung",
        ],
      },
      {
        id: "staff-hau-dv",
        name: "Đặng Văn Hậu",
        titlePrefix: "ThS.",
        role: "Chuyên viên Khảo thí & ĐBCL",
        email: "hau.dang@qcet.edu.vn",
        phone: "0977 123 456",
        avatar:
          "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-p-ktdbcl",
        departmentName: "Phòng Khảo thí & ĐBCL",
        activeTaskCount: 2,
        status: "ACTIVE",
        room: "P.203",
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
        email: "my.le@qcet.edu.vn",
        phone: "0989 333 777",
        avatar:
          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-p-ktdbcl",
        departmentName: "Phòng Khảo thí & ĐBCL",
        activeTaskCount: 2,
        status: "ACTIVE",
        room: "P.203",
        responsibilities: [
          "Lập báo cáo tự đánh giá chất lượng chương trình đào tạo",
          "Tổng hợp minh chứng phục vụ đoàn đánh giá ngoài",
        ],
      },
    ],
  },
  {
    id: "dept-p-cthssv",
    code: "P_CTHSSV",
    name: "Phòng Công tác học sinh sinh viên",
    shortName: "Công tác HSSV",
    category: "PHONG_CHUC_NANG",
    categoryLabel: "Phòng chức năng",
    description:
      "Tổ chức quản lý học sinh sinh viên, thực hiện chính sách học bổng, miễn giảm học phí, nội trú ký túc xá và tư vấn việc làm.",
    location: "Tòa nhà Ký túc xá B - Tầng 1",
    phone: "0256 3846 482",
    email: "cthssv@qcet.edu.vn",
    leaderName: "ThS. Huỳnh Công Tuấn",
    leaderRole: "Trưởng phòng",
    members: [
      {
        id: "staff-tuan-hc",
        name: "Huỳnh Công Tuấn",
        titlePrefix: "ThS.",
        role: "Trưởng phòng CTHSSV",
        email: "tuan.huynh@qcet.edu.vn",
        phone: "0917 888 111",
        avatar:
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-p-cthssv",
        departmentName: "Phòng CTHSSV",
        activeTaskCount: 3,
        status: "ACTIVE",
        room: "KTX B - P.101",
        responsibilities: [
          "Phụ trách chung công tác giáo dục chính trị tư tưởng HSSV",
          "Xử lý kỷ luật, khen thưởng và phong trào đoàn hội sinh viên",
        ],
      },
      {
        id: "staff-ha-ntt",
        name: "Nguyễn Thị Thanh Hà",
        titlePrefix: "CN.",
        role: "Chuyên viên Chính sách & Học bổng",
        email: "ha.nguyen@qcet.edu.vn",
        phone: "0945 666 222",
        avatar:
          "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-p-cthssv",
        departmentName: "Phòng CTHSSV",
        activeTaskCount: 1,
        status: "ACTIVE",
        room: "KTX B - P.102",
        responsibilities: [
          "Thẩm định hồ sơ miễn giảm học phí và trợ cấp xã hội",
          "Xét duyệt học bổng khuyến khích học tập học kỳ",
        ],
      },
      {
        id: "staff-phuc-lv",
        name: "Lâm Vĩnh Phúc",
        titlePrefix: "CN.",
        role: "Cán bộ Quản lý Ký túc xá & Hỗ trợ việc làm",
        email: "phuc.lam@qcet.edu.vn",
        phone: "0923 111 888",
        avatar:
          "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-p-cthssv",
        departmentName: "Phòng CTHSSV",
        activeTaskCount: 2,
        status: "ACTIVE",
        room: "KTX B - P.103",
        responsibilities: [
          "Quản lý an ninh trật tự khu ký túc xá sinh viên",
          "Kết nối doanh nghiệp tuyển dụng và ngày hội việc làm",
        ],
      },
    ],
  },

  // --------------------------------------------------------------------------
  // Khoa chuyên môn (3 units)
  // --------------------------------------------------------------------------
  {
    id: "dept-k-cntt",
    code: "K_CNTT",
    name: "Khoa Công nghệ thông tin",
    shortName: "Khoa CNTT",
    category: "KHOA_CHUYEN_MON",
    categoryLabel: "Khoa chuyên môn",
    description:
      "Đào tạo kỹ sư thực hành các chuyên ngành Công nghệ thông tin, Quản trị mạng, An toàn thông tin, Thiết kế đồ họa và Chuyển đổi số.",
    location: "Khu Giảng đường C - Tầng 3, P.302",
    phone: "0256 3846 483",
    email: "khoacntt@qcet.edu.vn",
    leaderName: "TS. Nguyễn Ngọc Vinh",
    leaderRole: "Trưởng khoa",
    members: [
      {
        id: "staff-vinh-nn",
        name: "Nguyễn Ngọc Vinh",
        titlePrefix: "TS.",
        role: "Trưởng khoa CNTT / Phụ trách Chuyển đổi số",
        email: "vinh.nguyen@qcet.edu.vn",
        phone: "0909 234 567",
        avatar:
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-k-cntt",
        departmentName: "Khoa Công nghệ thông tin",
        activeTaskCount: 5,
        status: "ACTIVE",
        room: "C.302",
        responsibilities: [
          "Quản lý toàn diện chuyên môn và nhân sự khoa CNTT",
          "Chủ nhiệm đề án Chuyển đổi số và triển khai E-Office nhà trường",
          "Giảng dạy chuyên sâu Kiến trúc phần mềm & Cơ sở dữ liệu lớn",
        ],
      },
      {
        id: "staff-hung-t",
        name: "Trần Hùng",
        titlePrefix: "ThS.",
        role: "Phó Trưởng khoa / Phụ trách An ninh mạng & ATTT",
        email: "hung.tran@qcet.edu.vn",
        phone: "0908 123 456",
        avatar:
          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-k-cntt",
        departmentName: "Khoa Công nghệ thông tin",
        activeTaskCount: 4,
        status: "ACTIVE",
        room: "C.303",
        responsibilities: [
          "Phụ trách chuyên môn An toàn thông tin và Quản trị hạ tầng mạng",
          "Trưởng nhóm ứng cứu sự cố máy tính và bảo mật mạng QCET",
          "Hướng dẫn đề tài đồ án tốt nghiệp chuyên ngành An ninh mạng",
        ],
      },
      {
        id: "staff-khoi-pd",
        name: "Phan Đình Khôi",
        titlePrefix: "ThS.",
        role: "Giảng viên Bộ môn Phát triển phần mềm",
        email: "khoi.phan@qcet.edu.vn",
        phone: "0983 999 111",
        avatar:
          "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-k-cntt",
        departmentName: "Khoa Công nghệ thông tin",
        activeTaskCount: 3,
        status: "ACTIVE",
        room: "C.304",
        responsibilities: [
          "Giảng dạy Lập trình Web full-stack, Lập trình ứng dụng di động",
          "Phụ trách cố vấn học tập các lớp cao đẳng CNTT K48",
        ],
      },
    ],
  },
  {
    id: "dept-k-ktqt",
    code: "K_KTQT",
    name: "Khoa Kinh tế - Quản trị",
    shortName: "Khoa Kinh tế - QT",
    category: "KHOA_CHUYEN_MON",
    categoryLabel: "Khoa chuyên môn",
    description:
      "Đào tạo chuyên ngành Kế toán doanh nghiệp, Quản trị kinh doanh, Logistic & Chuỗi cung ứng, Thương mại điện tử chất lượng cao.",
    location: "Khu Giảng đường B - Tầng 2, P.205",
    phone: "0256 3846 484",
    email: "khoaktqt@qcet.edu.vn",
    leaderName: "TS. Lê Thị Ánh Tuyết",
    leaderRole: "Trưởng khoa",
    members: [
      {
        id: "staff-tuyet-lta",
        name: "Lê Thị Ánh Tuyết",
        titlePrefix: "TS.",
        role: "Trưởng khoa Kinh tế - Quản trị",
        email: "tuyet.le@qcet.edu.vn",
        phone: "0918 222 666",
        avatar:
          "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-k-ktqt",
        departmentName: "Khoa Kinh tế - Quản trị",
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
        email: "son.do@qcet.edu.vn",
        phone: "0932 777 555",
        avatar:
          "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-k-ktqt",
        departmentName: "Khoa Kinh tế - Quản trị",
        activeTaskCount: 2,
        status: "ACTIVE",
        room: "B.206",
        responsibilities: [
          "Quản lý chuyên môn Kế toán tài chính, Kế toán quản trị",
          "Tổ chức hội thi tay nghề Kế toán sinh viên cấp trường",
        ],
      },
      {
        id: "staff-phuong-nh",
        name: "Nguyễn Hồng Phượng",
        titlePrefix: "ThS.",
        role: "Giảng viên Logistics & E-Commerce",
        email: "phuong.nguyen@qcet.edu.vn",
        phone: "0981 444 333",
        avatar:
          "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-k-ktqt",
        departmentName: "Khoa Kinh tế - Quản trị",
        activeTaskCount: 1,
        status: "ACTIVE",
        room: "B.206",
        responsibilities: [
          "Giảng dạy Chuỗi cung ứng, Vận tải quốc tế và Sàn TMĐT",
          "Phụ trách quan hệ đối tác cảng biển và doanh nghiệp kho vận",
        ],
      },
    ],
  },
  {
    id: "dept-k-ktcn",
    code: "K_KTCN",
    name: "Khoa Kỹ thuật - Công nghệ",
    shortName: "Khoa Kỹ thuật - CN",
    category: "KHOA_CHUYEN_MON",
    categoryLabel: "Khoa chuyên môn",
    description:
      "Đào tạo các ngành Công nghệ Kỹ thuật Ô tô, Điện công nghiệp, Cơ điện tử, Cắt gọt kim loại và Kỹ thuật Hàn công nghệ cao.",
    location: "Khu Xưởng Thực hành A & D",
    phone: "0256 3846 485",
    email: "khoaktcn@qcet.edu.vn",
    leaderName: "TS. Đinh Quốc Cường",
    leaderRole: "Trưởng khoa",
    members: [
      {
        id: "staff-cuong-dq",
        name: "Đinh Quốc Cường",
        titlePrefix: "TS.",
        role: "Trưởng khoa Kỹ thuật - Công nghệ",
        email: "cuong.dinh@qcet.edu.vn",
        phone: "0919 111 444",
        avatar:
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-k-ktcn",
        departmentName: "Khoa Kỹ thuật - Công nghệ",
        activeTaskCount: 5,
        status: "ACTIVE",
        room: "Xưởng A - P.101",
        responsibilities: [
          "Lãnh đạo toàn diện các bộ môn cơ khí chế tạo, ô tô và tự động hóa",
          "Chủ nhiệm chương trình hiện đại hóa xưởng thực hành kỹ thuật",
        ],
      },
      {
        id: "staff-hung-vm",
        name: "Vũ Mạnh Hùng",
        titlePrefix: "KS.",
        role: "Phó Trưởng khoa / Phụ trách Xưởng Ô tô",
        email: "hung.vu@qcet.edu.vn",
        phone: "0906 333 999",
        avatar:
          "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-k-ktcn",
        departmentName: "Khoa Kỹ thuật - Công nghệ",
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
        role: "Giảng viên Cơ điện tử & Tự động hóa",
        email: "loc.tran@qcet.edu.vn",
        phone: "0978 222 111",
        avatar:
          "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-k-ktcn",
        departmentName: "Khoa Kỹ thuật - Công nghệ",
        activeTaskCount: 2,
        status: "ACTIVE",
        room: "Xưởng A - P.103",
        responsibilities: [
          "Giảng dạy PLC, Vi điều khiển công nghiệp và Cánh tay robot",
          "Phụ trách phòng Lab tự động hóa thông minh Festo",
        ],
      },
    ],
  },

  // --------------------------------------------------------------------------
  // Trung tâm (2 units)
  // --------------------------------------------------------------------------
  {
    id: "dept-tt-dcc",
    code: "TT_DCC",
    name: "Trung tâm Truyền thông & Số hóa (DCC)",
    shortName: "Trung tâm DCC",
    category: "TRUNG_TAM",
    categoryLabel: "Trung tâm trực thuộc",
    description:
      "Đơn vị đầu mối sản xuất nội dung số, vận hành Cổng thông tin điện tử, quản trị hệ thống E-Office & hạ tầng số hóa toàn trường.",
    location: "Tòa nhà Thư viện & TT Số - Tầng 2, P.204",
    phone: "0256 3846 486",
    email: "dcc@qcet.edu.vn",
    leaderName: "ThS. Mai Đinh Thị Xuân",
    leaderRole: "Giám đốc Trung tâm",
    members: [
      {
        id: "staff-xuan-mdt",
        name: "Mai Đinh Thị Xuân",
        titlePrefix: "ThS.",
        role: "Giám đốc Trung tâm DCC / Chuyên viên Truyền thông",
        email: "xuan.mai@qcet.edu.vn",
        phone: "0918 345 678",
        avatar:
          "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-tt-dcc",
        departmentName: "Trung tâm Truyền thông & Số hóa (DCC)",
        activeTaskCount: 4,
        status: "ACTIVE",
        room: "P.204",
        responsibilities: [
          "Chỉ đạo chiến lược truyền thông thương hiệu trường Cao đẳng KTCN Quy Nhơn",
          "Quản trị cổng tin điện tử, sản xuất video & ấn phẩm số hóa tuyển sinh",
          "Điều phối vận hành ứng dụng văn phòng điện tử E-Office",
        ],
      },
      {
        id: "staff-huy-dq",
        name: "Dương Quang Huy",
        titlePrefix: "KS.",
        role: "Kỹ sư Hệ thống mạng & An toàn thông tin",
        email: "huy.duong@qcet.edu.vn",
        phone: "0938 123 888",
        avatar:
          "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-tt-dcc",
        departmentName: "Trung tâm Truyền thông & Số hóa (DCC)",
        activeTaskCount: 3,
        status: "ACTIVE",
        room: "P.204",
        responsibilities: [
          "Quản trị hạ tầng máy chủ, hệ thống mạng WiFi trường và tường lửa",
          "Hỗ trợ kỹ thuật ứng dụng số hóa nội bộ và sao lưu dữ liệu",
        ],
      },
      {
        id: "staff-linh-ht",
        name: "Hoàng Thùy Linh",
        titlePrefix: "CN.",
        role: "Chuyên viên Biên tập & Thiết kế Media",
        email: "linh.hoang@qcet.edu.vn",
        phone: "0904 555 777",
        avatar:
          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-tt-dcc",
        departmentName: "Trung tâm Truyền thông & Số hóa (DCC)",
        activeTaskCount: 2,
        status: "ACTIVE",
        room: "P.204",
        responsibilities: [
          "Chụp ảnh sự kiện, thiết kế banner và bản tin nội bộ hàng tháng",
          "Biên tập nội dung mạng xã hội Fanpage & YouTube chính thức QCET",
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
      "Tổ chức đào tạo ngắn hạn, bồi dưỡng và liên kết sát hạch cấp chứng chỉ Ngoại ngữ (TOEIC, IELTS), Tin học chuẩn kỹ năng quốc gia & quản lý học liệu số.",
    location: "Tòa nhà Thư viện & TT Số - Tầng 1, P.105",
    phone: "0256 3846 487",
    email: "nnth@qcet.edu.vn",
    leaderName: "ThS. Chu Đình Thắng",
    leaderRole: "Giám đốc Trung tâm",
    members: [
      {
        id: "staff-thang-cd",
        name: "Chu Đình Thắng",
        titlePrefix: "ThS.",
        role: "Giám đốc Trung tâm Ngoại ngữ - Tin học",
        email: "thang.chu@qcet.edu.vn",
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
        role: "Chuyên viên Thư viện & Học liệu số / TT Ngoại ngữ - Tin học",
        email: "thu.pham@qcet.edu.vn",
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
      {
        id: "staff-ngoc-tb",
        name: "Trần Bảo Ngọc",
        titlePrefix: "CN.",
        role: "Điều phối viên Khảo thí chứng chỉ Tin học",
        email: "ngoc.tran@qcet.edu.vn",
        phone: "0972 666 999",
        avatar:
          "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=120&auto=format&fit=crop&q=80",
        departmentId: "dept-tt-nnth",
        departmentName: "Trung tâm Ngoại ngữ - Tin học",
        activeTaskCount: 2,
        status: "ACTIVE",
        room: "P.105",
        responsibilities: [
          "Tiếp nhận hồ sơ thi chứng chỉ chuẩn kỹ năng CNTT theo Thông tư 03",
          "Quản lý phòng máy thi chuẩn quốc tế và cấp phát chứng chỉ",
        ],
      },
    ],
  },
];

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
  if (!trimmed) {
    return allStaff;
  }

  return allStaff.filter((staff) => {
    return (
      staff.name.toLowerCase().includes(trimmed) ||
      staff.email.toLowerCase().includes(trimmed) ||
      staff.role.toLowerCase().includes(trimmed) ||
      staff.departmentName.toLowerCase().includes(trimmed) ||
      (staff.phone && staff.phone.includes(trimmed)) ||
      (staff.titlePrefix && staff.titlePrefix.toLowerCase().includes(trimmed))
    );
  });
}

// Category icon mapper helper
function getCategoryIcon(category: DepartmentCategory): LucideIcon {
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

function getRoleBadgeVariant(role: string): "default" | "secondary" | "progress" | "warning" | "outline" {
  if (role.includes("Hiệu trưởng") || role.includes("Trưởng phòng") || role.includes("Trưởng khoa") || role.includes("Giám đốc")) {
    return "secondary";
  }
  if (role.includes("Giảng viên")) {
    return "progress";
  }
  return "outline";
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
  // Navigation & Filter States
  const [selectedDeptCode, setSelectedDeptCode] = React.useState<string | null>(
    initialDepartmentCode || "BGH"
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

  // Group departments by category
  const categoriesList: {
    category: DepartmentCategory;
    label: string;
    icon: LucideIcon;
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
      label: "Phòng chức năng",
      icon: Briefcase,
      departments: QCET_DEPARTMENTS.filter(
        (d) => d.category === "PHONG_CHUC_NANG"
      ),
    },
    {
      category: "KHOA_CHUYEN_MON",
      label: "Khoa chuyên môn",
      icon: GraduationCap,
      departments: QCET_DEPARTMENTS.filter(
        (d) => d.category === "KHOA_CHUYEN_MON"
      ),
    },
    {
      category: "TRUNG_TAM",
      label: "Trung tâm trực thuộc",
      icon: Globe,
      departments: QCET_DEPARTMENTS.filter((d) => d.category === "TRUNG_TAM"),
    },
  ];

  // Current selected department
  const selectedDepartment = QCET_DEPARTMENTS.find(
    (d) => d.code === selectedDeptCode
  );

  // Total members count across all units
  const totalStaffCount = React.useMemo(() => {
    return QCET_DEPARTMENTS.reduce((acc, d) => acc + d.members.length, 0);
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

    // Apply role filter
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
    <div className="space-y-6" data-slot="twenty-organization-tree">
      {/* ===================================================================== */}
      {/* 1. Global Search & Filter Bar                                         */}
      {/* ===================================================================== */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xs p-3.5 shadow-card">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input with quick clear */}
          <div className="relative flex-1">
            <Search className="size-4 text-muted-foreground pointer-events-none absolute left-3 top-2.5" strokeWidth={1.5} />
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

            {/* View Mode Switcher */}
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

      {/* ===================================================================== */}
      {/* 2. Main Two-Column View                                               */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Department Tree Navigation (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-card">
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-border/60">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Building2 className="size-3.5" strokeWidth={1.5} />
                </span>
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Cơ cấu Tổ chức QCET
                </span>
              </div>
              <Badge variant="secondary" className="text-[10px] h-5 px-2 font-semibold rounded-full font-mono tabular-nums">
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
                    "text-[10px] h-4.5 px-1.5 rounded-md font-mono tabular-nums",
                    selectedDeptCode === "ALL" && "bg-white/20 text-white border-transparent"
                  )}
                >
                  {totalStaffCount}
                </Badge>
              </button>
            </div>

            {/* Department Categories Accordion/Tree */}
            <div className="space-y-3">
              {categoriesList.map((catGroup) => {
                const Icon = catGroup.icon;
                const isExpanded = expandedCategories[catGroup.category];
                const catTotalMembers = catGroup.departments.reduce(
                  (acc, d) => acc + d.members.length,
                  0
                );

                return (
                  <div key={catGroup.category} className="space-y-1">
                    {/* Category Header */}
                    <button
                      type="button"
                      onClick={() => toggleCategory(catGroup.category)}
                      className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-1.5">
                        {isExpanded ? (
                          <ChevronDown className="size-3 text-muted-foreground group-hover:text-foreground transition-transform" strokeWidth={1.5} />
                        ) : (
                          <ChevronRight className="size-3 text-muted-foreground group-hover:text-foreground transition-transform" strokeWidth={1.5} />
                        )}
                        <Icon className="size-3.5 text-primary" strokeWidth={1.5} />
                        <span className="text-[11px] uppercase tracking-wide font-bold">
                          {catGroup.label}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-normal font-mono tabular-nums">
                        ({catTotalMembers})
                      </span>
                    </button>

                    {/* Department items with clean connector lines */}
                    {isExpanded && (
                      <div className="pl-3.5 space-y-1 border-l border-border/60 ml-2.5 my-1 relative">
                        {catGroup.departments.map((dept) => {
                          const isSelected =
                            selectedDeptCode === dept.code && !searchQuery;

                          return (
                            <div key={dept.id} className="relative flex items-center">
                              {/* Horizontal branch connector tick */}
                              <span className="absolute -left-3.5 top-1/2 -translate-y-1/2 w-2.5 h-px bg-border/60 pointer-events-none" />
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedDeptCode(dept.code);
                                  setSearchQuery("");
                                }}
                                className={cn(
                                  "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer text-left",
                                  isSelected
                                    ? "bg-primary/10 text-primary font-semibold shadow-xs"
                                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                                )}
                              >
                                <div className="flex items-center gap-1.5 min-w-0 pr-1">
                                  <span
                                    className={cn(
                                      "size-1.5 rounded-full shrink-0 transition-all",
                                      isSelected
                                        ? "bg-primary ring-2 ring-primary/20"
                                        : "bg-muted-foreground/40"
                                    )}
                                  />
                                  <span className="truncate">
                                    {dept.shortName || dept.name}
                                  </span>
                                </div>
                                <Badge
                                  variant={isSelected ? "default" : "outline"}
                                  className={cn(
                                    "text-[10px] h-4 px-1.5 shrink-0 rounded-md font-mono tabular-nums transition-colors",
                                    isSelected
                                      ? "bg-primary/20 text-primary border border-primary/30"
                                      : "text-muted-foreground"
                                  )}
                                >
                                  {dept.members.length}
                                </Badge>
                              </button>
                            </div>
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

        {/* Right Column: Department Details Banner & Staff Cards Grid (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Department Information Banner */}
          {selectedDepartment && !searchQuery && selectedDeptCode !== "ALL" ? (
            <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-card space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] h-5 font-semibold rounded-md">
                      {selectedDepartment.categoryLabel}
                    </Badge>
                    <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
                      Mã: {selectedDepartment.code}
                    </span>
                  </div>
                  <h2 className="text-base font-semibold text-foreground sm:text-lg tracking-tight">
                    {selectedDepartment.name}
                  </h2>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {selectedDepartment.description}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      window.dispatchEvent(
                        new CustomEvent("qcet:open-create-task", {
                          detail: { leadAssigneeName: selectedDepartment.leaderName },
                        })
                      );
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-1.5 text-xs font-medium transition-all shadow-xs cursor-pointer"
                    title={`Giao việc cho đơn vị ${selectedDepartment.shortName || selectedDepartment.name}`}
                  >
                    <UserCheck className="size-3.5" strokeWidth={1.5} />
                    <span>Giao việc đơn vị</span>
                  </button>

                  <a
                    href={`mailto:${selectedDepartment.email}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors shadow-2xs"
                    title="Gửi email cho phòng ban"
                  >
                    <Mail className="size-3.5" strokeWidth={1.5} />
                    <span>Gửi thư</span>
                  </a>
                </div>
              </div>

              {/* Department Contact & Leader Meta Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3.5 border-t border-border/60 text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <UserCheck className="size-4 text-primary shrink-0" strokeWidth={1.5} />
                  <div className="truncate">
                    <span className="text-[10px] text-muted-foreground block font-medium">Trưởng đơn vị:</span>
                    <span className="font-medium text-foreground truncate block">
                      {selectedDepartment.leaderName}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="size-4 text-primary shrink-0" strokeWidth={1.5} />
                  <div className="truncate">
                    <span className="text-[10px] text-muted-foreground block font-medium">Vị trí phòng:</span>
                    <span className="font-medium text-foreground truncate block">
                      {selectedDepartment.location}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="size-4 text-primary shrink-0" strokeWidth={1.5} />
                  <div className="truncate">
                    <span className="text-[10px] text-muted-foreground block font-medium">Điện thoại:</span>
                    <span className="font-medium font-mono tabular-nums text-foreground truncate block">
                      {selectedDepartment.phone}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="size-4 text-primary shrink-0" strokeWidth={1.5} />
                  <div className="truncate">
                    <span className="text-[10px] text-muted-foreground block font-medium">Quy mô nhân sự:</span>
                    <span className="font-medium font-mono tabular-nums text-foreground truncate block">
                      {selectedDepartment.members.length} cán bộ / GV
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-border/60 bg-card p-4.5 shadow-card flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <span>
                    {searchQuery
                      ? `Kết quả tìm kiếm: "${searchQuery}"`
                      : "Danh bạ Toàn trường (Tất cả đơn vị)"}
                  </span>
                  <Badge variant="secondary" className="text-xs rounded-full font-mono tabular-nums">
                    {displayedMembers.length} cán bộ
                  </Badge>
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Hiển thị danh sách cán bộ, giảng viên và chuyên viên toàn hệ thống trường QCET
                </p>
              </div>

              {searchQuery && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setSearchQuery("")}
                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                >
                  Xóa lọc
                </Button>
              )}
            </div>
          )}

          {/* Staff Members List / Grid */}
          {displayedMembers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 p-10 text-center bg-card/50">
              <Users className="size-8 text-muted-foreground/40 mx-auto mb-2" strokeWidth={1.5} />
              <p className="text-xs font-semibold text-foreground">
                Không tìm thấy cán bộ nào phù hợp
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Thử thay đổi từ khóa tìm kiếm hoặc chọn lại đơn vị phòng ban
              </p>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {displayedMembers.map((member) => (
                <div
                  key={member.id}
                  onClick={() => handleOpenStaff(member)}
                  className="group relative flex flex-col justify-between rounded-xl border border-border/60 bg-card p-4 shadow-2xs hover:shadow-card hover:border-border/80 hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-150 cursor-pointer"
                >
                  {/* Top card: Avatar & Status & Info */}
                  <div className="flex items-start gap-3.5">
                    <div className="relative shrink-0">
                      <img
                        src={member.avatar}
                        alt={member.name}
                        className="size-11 rounded-full object-cover border border-primary/20 ring-2 ring-background"
                        loading="lazy"
                      />
                      <span
                        className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-500 ring-2 ring-card"
                        title="Đang công tác"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        {member.titlePrefix && (
                          <span className="text-[11px] font-semibold text-muted-foreground shrink-0">
                            {member.titlePrefix}
                          </span>
                        )}
                        <h3 className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                          {member.name}
                        </h3>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                        {member.role}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span className="inline-block text-[10px] text-muted-foreground bg-muted/70 px-2 py-0.5 rounded-md">
                          {member.departmentName}
                        </span>
                        {member.role.includes("Trưởng") || member.role.includes("Hiệu trưởng") || member.role.includes("Giám đốc") ? (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            Lãnh đạo
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Contact & Task details bottom */}
                  <div className="mt-3.5 pt-3 border-t border-border/60 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2 text-muted-foreground">
                      <a
                        href={`mailto:${member.email}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1.5 hover:text-primary truncate transition-colors text-[11px]"
                        title={`Gửi email đến ${member.email}`}
                      >
                        <Mail className="size-3 shrink-0" strokeWidth={1.5} />
                        <span className="truncate">{member.email}</span>
                      </a>

                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md shrink-0 border",
                          member.activeTaskCount > 3
                            ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                            : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                        )}
                        title={`${member.activeTaskCount} nhiệm vụ được giao`}
                      >
                        <Clock className="size-2.5" strokeWidth={1.5} />
                        <span className="font-mono tabular-nums">{member.activeTaskCount}</span> việc
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground/80 pt-0.5">
                      <a
                        href={`tel:${member.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 hover:text-foreground transition-colors font-mono tabular-nums"
                      >
                        <Phone className="size-3 shrink-0" strokeWidth={1.5} />
                        <span>{member.phone}</span>
                      </a>

                      {/* 1-click Giao việc quick action micro-button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.dispatchEvent(
                            new CustomEvent("qcet:open-create-task", {
                              detail: { leadAssigneeName: member.name },
                            })
                          );
                        }}
                        className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground border border-primary/20 text-[11px] font-medium transition-all cursor-pointer shadow-2xs"
                        title={`Giao việc nhanh cho ${member.name}`}
                      >
                        <UserCheck className="size-3" strokeWidth={1.5} />
                        <span>Giao việc</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* List / Table Mode */
            <div className="rounded-2xl border border-border/60 bg-card shadow-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border/80 bg-muted/40 font-semibold text-muted-foreground">
                      <th className="py-3 px-3.5">Cán bộ / Giảng viên</th>
                      <th className="py-3 px-3.5">Chức vụ / Đơn vị</th>
                      <th className="py-3 px-3.5">Email liên hệ</th>
                      <th className="py-3 px-3.5">Điện thoại</th>
                      <th className="py-3 px-3.5 text-center">Nhiệm vụ</th>
                      <th className="py-3 px-3.5 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {displayedMembers.map((member) => (
                      <tr
                        key={member.id}
                        onClick={() => handleOpenStaff(member)}
                        className="hover:bg-muted/40 transition-colors cursor-pointer"
                      >
                        <td className="py-3 px-3.5">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={member.avatar}
                              alt={member.name}
                              className="size-8 rounded-full object-cover border border-primary/20 shrink-0"
                            />
                            <div>
                              <span className="font-medium text-foreground">
                                {member.titlePrefix ? `${member.titlePrefix} ` : ""}
                                {member.name}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3.5">
                          <div className="text-foreground font-normal truncate max-w-[200px]">
                            {member.role}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {member.departmentName}
                          </div>
                        </td>
                        <td className="py-3 px-3.5 text-muted-foreground">
                          <a
                            href={`mailto:${member.email}`}
                            onClick={(e) => e.stopPropagation()}
                            className="hover:underline hover:text-primary"
                          >
                            {member.email}
                          </a>
                        </td>
                        <td className="py-3 px-3.5 text-muted-foreground whitespace-nowrap font-mono tabular-nums">
                          {member.phone}
                        </td>
                        <td className="py-3 px-3.5 text-center">
                          <Badge
                            variant={member.activeTaskCount > 3 ? "warning" : "progress"}
                            className="text-[10px] h-4.5 px-1.5 font-medium rounded-md font-mono tabular-nums"
                          >
                            {member.activeTaskCount} việc
                          </Badge>
                        </td>
                        <td className="py-3 px-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 text-[11px] font-medium gap-1 text-primary border-primary/30 hover:bg-primary/10 cursor-pointer"
                              title={`Giao việc nhanh cho ${member.name}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                window.dispatchEvent(
                                  new CustomEvent("qcet:open-create-task", {
                                    detail: { leadAssigneeName: member.name },
                                  })
                                );
                              }}
                            >
                              <UserCheck className="size-3" strokeWidth={1.5} />
                              <span>Giao việc</span>
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenStaff(member);
                              }}
                            >
                              Xem
                            </Button>
                          </div>
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

      {/* ===================================================================== */}
      {/* 3. Staff Profile Modal / Drawer                                       */}
      {/* ===================================================================== */}
      {activeProfileStaff && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => setActiveProfileStaff(null)}
        >
          <div
            className="relative w-full max-w-lg rounded-2xl border border-border/80 bg-card p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => setActiveProfileStaff(null)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
            >
              <X className="size-4" strokeWidth={1.5} />
            </button>

            {/* Profile Header */}
            <div className="flex items-start gap-4">
              <img
                src={activeProfileStaff.avatar}
                alt={activeProfileStaff.name}
                className="size-16 rounded-full object-cover border-2 border-primary/30 shadow-card shrink-0"
              />
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="text-base font-semibold text-foreground tracking-tight">
                    {activeProfileStaff.titlePrefix
                      ? `${activeProfileStaff.titlePrefix} `
                      : ""}
                    {activeProfileStaff.name}
                  </h3>
                  <Badge variant="success" className="text-[10px] h-4.5 rounded-md font-semibold">
                    Đang làm việc
                  </Badge>
                </div>
                <p className="text-xs font-semibold text-primary">
                  {activeProfileStaff.role}
                </p>
                <p className="text-xs text-muted-foreground">
                  {activeProfileStaff.departmentName}
                </p>
              </div>
            </div>

            {/* Meta Cards: Email, Phone, Room */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 text-xs">
              <a
                href={`mailto:${activeProfileStaff.email}`}
                className="flex items-center gap-2 p-3 rounded-xl border border-border/70 bg-muted/30 hover:bg-muted/60 transition-colors"
              >
                <Mail className="size-4 text-primary shrink-0" strokeWidth={1.5} />
                <div className="truncate">
                  <span className="text-[10px] text-muted-foreground block font-medium">Email trường:</span>
                  <span className="font-medium text-foreground truncate block">
                    {activeProfileStaff.email}
                  </span>
                </div>
              </a>

              <a
                href={`tel:${activeProfileStaff.phone}`}
                className="flex items-center gap-2 p-3 rounded-xl border border-border/70 bg-muted/30 hover:bg-muted/60 transition-colors"
              >
                <Phone className="size-4 text-primary shrink-0" strokeWidth={1.5} />
                <div className="truncate">
                  <span className="text-[10px] text-muted-foreground block font-medium">Điện thoại di động:</span>
                  <span className="font-medium text-foreground truncate block font-mono tabular-nums">
                    {activeProfileStaff.phone}
                  </span>
                </div>
              </a>

              {activeProfileStaff.room && (
                <div className="flex items-center gap-2 p-3 rounded-xl border border-border/70 bg-muted/30">
                  <MapPin className="size-4 text-primary shrink-0" strokeWidth={1.5} />
                  <div className="truncate">
                    <span className="text-[10px] text-muted-foreground block font-medium">Phòng làm việc:</span>
                    <span className="font-medium text-foreground truncate block">
                      {activeProfileStaff.room}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 p-3 rounded-xl border border-border/70 bg-muted/30">
                <Clock className="size-4 text-primary shrink-0" strokeWidth={1.5} />
                <div className="truncate">
                  <span className="text-[10px] text-muted-foreground block font-medium">Khối lượng nhiệm vụ:</span>
                  <span className="font-medium text-foreground truncate block">
                    <span className="font-mono tabular-nums">{activeProfileStaff.activeTaskCount}</span> việc đang tiến hành
                  </span>
                </div>
              </div>
            </div>

            {/* Responsibilities list */}
            {activeProfileStaff.responsibilities && (
              <div className="space-y-1.5 pt-2">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Trách nhiệm & Nhiệm vụ chuyên môn
                </h4>
                <ul className="space-y-1 pl-4 list-disc text-xs text-muted-foreground">
                  {activeProfileStaff.responsibilities.map((resp, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {resp}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Footer action buttons */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveProfileStaff(null)}
                className="h-8 text-xs font-medium rounded-lg"
              >
                Đóng
              </Button>
              <Button
                type="button"
                className="h-8 px-3.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium shadow-card gap-1.5 cursor-pointer"
                onClick={() => {
                  const staffName = activeProfileStaff.name;
                  setActiveProfileStaff(null);
                  window.dispatchEvent(
                    new CustomEvent("qcet:open-create-task", {
                      detail: { leadAssigneeName: staffName },
                    })
                  );
                }}
              >
                <UserCheck className="size-3.5" strokeWidth={1.5} />
                <span>Giao việc ngay</span>
              </Button>
              <a
                href={`mailto:${activeProfileStaff.email}?subject=[QCET-E-Office]%20Liên%20hệ%20công%20việc`}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border/80 bg-card text-foreground hover:bg-secondary text-xs font-medium transition-all shadow-xs"
              >
                <Mail className="size-3.5" strokeWidth={1.5} />
                <span>Gửi email công tác</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
