export interface DepartmentPersonnel {
  name: string;
  role: string;
  title?: string;
}

export interface DepartmentPersonnelGroup {
  id: string;
  name: string;
  code: string;
  personnel: DepartmentPersonnel[];
  /** Backwards compatibility alias for name */
  department: string;
  icon: string;
  /** Backwards compatibility alias for personnel */
  members: { name: string; title: string; role: string }[];
}

export const QCET_DEPARTMENT_GROUPS: DepartmentPersonnelGroup[] = [
  {
    id: "bgh",
    name: "Ban Giám hiệu",
    department: "Ban Giám hiệu",
    code: "BGH",
    icon: "",
    personnel: [
      { name: "Nguyễn Minh Tuấn", title: "TS. Nguyễn Minh Tuấn", role: "Hiệu trưởng" },
      { name: "Lê Thành Đạt", title: "ThS. Lê Thành Đạt", role: "Phó Hiệu trưởng" },
      { name: "Hoàng Thị Kim Cúc", title: "ThS. Hoàng Thị Kim Cúc", role: "Phó Hiệu trưởng" },
    ],
    members: [
      { name: "Nguyễn Minh Tuấn", title: "TS. Nguyễn Minh Tuấn", role: "Hiệu trưởng" },
      { name: "Lê Thành Đạt", title: "ThS. Lê Thành Đạt", role: "Phó Hiệu trưởng" },
      { name: "Hoàng Thị Kim Cúc", title: "ThS. Hoàng Thị Kim Cúc", role: "Phó Hiệu trưởng" },
    ],
  },
  {
    id: "cntt",
    name: "Khoa Công nghệ thông tin",
    department: "Khoa Công nghệ thông tin",
    code: "CNTT",
    icon: "",
    personnel: [
      { name: "Nguyễn Ngọc Vinh", title: "TS. Nguyễn Ngọc Vinh", role: "Trưởng khoa (CĐS)" },
      { name: "Trần Hùng", title: "ThS. Trần Hùng", role: "Phó Trưởng khoa (ATTT)" },
      { name: "Phan Đình Khôi", title: "ThS. Phan Đình Khôi", role: "Giảng viên CNTT" },
    ],
    members: [
      { name: "Nguyễn Ngọc Vinh", title: "TS. Nguyễn Ngọc Vinh", role: "Trưởng khoa (CĐS)" },
      { name: "Trần Hùng", title: "ThS. Trần Hùng", role: "Phó Trưởng khoa (ATTT)" },
      { name: "Phan Đình Khôi", title: "ThS. Phan Đình Khôi", role: "Giảng viên CNTT" },
    ],
  },
  {
    id: "dao_tao",
    name: "Phòng Đào tạo & Quản lý Khoa học",
    department: "Phòng Đào tạo & Quản lý Khoa học",
    code: "DAO_TAO",
    icon: "",
    personnel: [
      { name: "Đỗ Quang Trung", title: "ThS. Đỗ Quang Trung", role: "Trưởng phòng" },
      { name: "Võ Minh Trí", title: "ThS. Võ Minh Trí", role: "Phó Trưởng phòng" },
      { name: "Nguyễn Thị Bích Thủy", title: "CN. Nguyễn Thị Bích Thủy", role: "Chuyên viên" },
    ],
    members: [
      { name: "Đỗ Quang Trung", title: "ThS. Đỗ Quang Trung", role: "Trưởng phòng" },
      { name: "Võ Minh Trí", title: "ThS. Võ Minh Trí", role: "Phó Trưởng phòng" },
      { name: "Nguyễn Thị Bích Thủy", title: "CN. Nguyễn Thị Bích Thủy", role: "Chuyên viên" },
    ],
  },
  {
    id: "truyen_thong",
    name: "Trung tâm Truyền thông & Số hóa (DCC)",
    department: "Trung tâm Truyền thông & Số hóa (DCC)",
    code: "TRUYEN_THONG",
    icon: "",
    personnel: [
      { name: "Mai Đinh Thị Xuân", title: "ThS. Mai Đinh Thị Xuân", role: "Giám đốc TT" },
      { name: "Dương Quang Huy", title: "CN. Dương Quang Huy", role: "Chuyên viên CNTT" },
      { name: "Hoàng Thùy Linh", title: "CN. Hoàng Thùy Linh", role: "Chuyên viên nội dung" },
    ],
    members: [
      { name: "Mai Đinh Thị Xuân", title: "ThS. Mai Đinh Thị Xuân", role: "Giám đốc TT" },
      { name: "Dương Quang Huy", title: "CN. Dương Quang Huy", role: "Chuyên viên CNTT" },
      { name: "Hoàng Thùy Linh", title: "CN. Hoàng Thùy Linh", role: "Chuyên viên nội dung" },
    ],
  },
  {
    id: "hanh_chinh",
    name: "Phòng Hành chính - Quản trị",
    department: "Phòng Hành chính - Quản trị",
    code: "HANH_CHINH",
    icon: "",
    personnel: [
      { name: "Phan Văn Thanh", title: "ThS. Phan Văn Thanh", role: "Trưởng phòng" },
      { name: "Lê Hoàng Nam", title: "ThS. Lê Hoàng Nam", role: "Phó Trưởng phòng" },
      { name: "Trương Thị Hồng Nhung", title: "CN. Trương Thị Hồng Nhung", role: "Văn thư" },
    ],
    members: [
      { name: "Phan Văn Thanh", title: "ThS. Phan Văn Thanh", role: "Trưởng phòng" },
      { name: "Lê Hoàng Nam", title: "ThS. Lê Hoàng Nam", role: "Phó Trưởng phòng" },
      { name: "Trương Thị Hồng Nhung", title: "CN. Trương Thị Hồng Nhung", role: "Văn thư" },
    ],
  },
  {
    id: "khao_thi",
    name: "Phòng Khảo thí & Đảm bảo chất lượng",
    department: "Phòng Khảo thí & Đảm bảo chất lượng",
    code: "KHAO_THI",
    icon: "",
    personnel: [
      { name: "Nguyễn Công Minh", title: "ThS. Nguyễn Công Minh", role: "Trưởng phòng" },
      { name: "Đặng Văn Hậu", title: "ThS. Đặng Văn Hậu", role: "Phó Trưởng phòng" },
      { name: "Lê Thị Diễm My", title: "ThS. Lê Thị Diễm My", role: "Chuyên viên" },
    ],
    members: [
      { name: "Nguyễn Công Minh", title: "ThS. Nguyễn Công Minh", role: "Trưởng phòng" },
      { name: "Đặng Văn Hậu", title: "ThS. Đặng Văn Hậu", role: "Phó Trưởng phòng" },
      { name: "Lê Thị Diễm My", title: "ThS. Lê Thị Diễm My", role: "Chuyên viên" },
    ],
  },
  {
    id: "thu_vien",
    name: "Trung tâm Ngoại ngữ - Tin học & Thư viện",
    department: "Trung tâm Ngoại ngữ - Tin học & Thư viện",
    code: "THU_VIEN",
    icon: "",
    personnel: [
      { name: "Chu Đình Thắng", title: "ThS. Chu Đình Thắng", role: "Giám đốc TT" },
      { name: "Phạm Thị Thu", title: "CN. Phạm Thị Thu", role: "Phụ trách Thư viện" },
      { name: "Trần Bảo Ngọc", title: "ThS. Trần Bảo Ngọc", role: "Giảng viên" },
    ],
    members: [
      { name: "Chu Đình Thắng", title: "ThS. Chu Đình Thắng", role: "Giám đốc TT" },
      { name: "Phạm Thị Thu", title: "CN. Phạm Thị Thu", role: "Phụ trách Thư viện" },
      { name: "Trần Bảo Ngọc", title: "ThS. Trần Bảo Ngọc", role: "Giảng viên" },
    ],
  },
  {
    id: "kinh_te",
    name: "Khoa Kinh tế - Quản trị",
    department: "Khoa Kinh tế - Quản trị",
    code: "KINH_TE",
    icon: "",
    personnel: [
      { name: "Lê Thị Ánh Tuyết", title: "ThS. Lê Thị Ánh Tuyết", role: "Trưởng khoa" },
      { name: "Đỗ Hoàng Sơn", title: "ThS. Đỗ Hoàng Sơn", role: "Phó Trưởng khoa" },
      { name: "Nguyễn Hồng Phượng", title: "ThS. Nguyễn Hồng Phượng", role: "Giảng viên" },
    ],
    members: [
      { name: "Lê Thị Ánh Tuyết", title: "ThS. Lê Thị Ánh Tuyết", role: "Trưởng khoa" },
      { name: "Đỗ Hoàng Sơn", title: "ThS. Đỗ Hoàng Sơn", role: "Phó Trưởng khoa" },
      { name: "Nguyễn Hồng Phượng", title: "ThS. Nguyễn Hồng Phượng", role: "Giảng viên" },
    ],
  },
  {
    id: "ky_thuat",
    name: "Khoa Kỹ thuật - Công nghệ",
    department: "Khoa Kỹ thuật - Công nghệ",
    code: "KY_THUAT",
    icon: "",
    personnel: [
      { name: "Đinh Quốc Cường", title: "TS. Đinh Quốc Cường", role: "Trưởng khoa" },
      { name: "Vũ Mạnh Hùng", title: "ThS. Vũ Mạnh Hùng", role: "Phó Trưởng khoa" },
      { name: "Trần Bá Lộc", title: "ThS. Trần Bá Lộc", role: "Giảng viên" },
    ],
    members: [
      { name: "Đinh Quốc Cường", title: "TS. Đinh Quốc Cường", role: "Trưởng khoa" },
      { name: "Vũ Mạnh Hùng", title: "ThS. Vũ Mạnh Hùng", role: "Phó Trưởng khoa" },
      { name: "Trần Bá Lộc", title: "ThS. Trần Bá Lộc", role: "Giảng viên" },
    ],
  },
  {
    id: "tai_chinh",
    name: "Phòng Kế hoạch - Tài chính",
    department: "Phòng Kế hoạch - Tài chính",
    code: "TAI_CHINH",
    icon: "",
    personnel: [
      { name: "Trần Thị Mai Loan", title: "ThS. Trần Thị Mai Loan", role: "Trưởng phòng" },
      { name: "Hà Thanh Vân", title: "ThS. Hà Thanh Vân", role: "Kế toán trưởng" },
      { name: "Bùi Văn Hào", title: "CN. Bùi Văn Hào", role: "Kế toán viên" },
    ],
    members: [
      { name: "Trần Thị Mai Loan", title: "ThS. Trần Thị Mai Loan", role: "Trưởng phòng" },
      { name: "Hà Thanh Vân", title: "ThS. Hà Thanh Vân", role: "Kế toán trưởng" },
      { name: "Bùi Văn Hào", title: "CN. Bùi Văn Hào", role: "Kế toán viên" },
    ],
  },
  {
    id: "cthssv",
    name: "Phòng Công tác học sinh sinh viên",
    department: "Phòng Công tác học sinh sinh viên",
    code: "CTHSSV",
    icon: "",
    personnel: [
      { name: "Huỳnh Công Tuấn", title: "ThS. Huỳnh Công Tuấn", role: "Trưởng phòng" },
      { name: "Nguyễn Thị Thanh Hà", title: "ThS. Nguyễn Thị Thanh Hà", role: "Phó Trưởng phòng" },
      { name: "Lâm Vĩnh Phúc", title: "CN. Lâm Vĩnh Phúc", role: "Chuyên viên" },
    ],
    members: [
      { name: "Huỳnh Công Tuấn", title: "ThS. Huỳnh Công Tuấn", role: "Trưởng phòng" },
      { name: "Nguyễn Thị Thanh Hà", title: "ThS. Nguyễn Thị Thanh Hà", role: "Phó Trưởng phòng" },
      { name: "Lâm Vĩnh Phúc", title: "CN. Lâm Vĩnh Phúc", role: "Chuyên viên" },
    ],
  },
];

export function getDepartmentByCode(code: string): DepartmentPersonnelGroup | undefined {
  return QCET_DEPARTMENT_GROUPS.find(
    (g) => g.code.toLowerCase() === code.toLowerCase()
  );
}

export function getDepartmentForMember(
  memberName: string
): DepartmentPersonnelGroup | undefined {
  if (!memberName) return undefined;
  const clean = memberName.replace(/^(ThS\.|TS\.|CN\.|BS\.|PGS\.|GS\.)\s*/, "").trim().toLowerCase();
  return QCET_DEPARTMENT_GROUPS.find((group) =>
    group.members.some((m) => {
      const mClean = m.name.replace(/^(ThS\.|TS\.|CN\.|BS\.|PGS\.|GS\.)\s*/, "").trim().toLowerCase();
      return m.name.toLowerCase() === memberName.toLowerCase() || mClean === clean;
    })
  );
}
