export interface DepartmentPersonnel {
  name: string;
  role: string;
  title?: string;
  email?: string;
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
  members: { name: string; title: string; role: string; email?: string }[];
  aliases?: string[];
}

/**
 * Bảng ánh xạ tương thích ngược và chuẩn hóa mã đơn vị QCET
 * Ánh xạ tất cả mã cũ / kebab-case / alias về 15 mã chuẩn quy chuẩn
 */
export const QCET_UNIT_CANONICAL_MAP: Record<string, string> = {
  // Ban Giám hiệu
  BGH: "BGH",
  bgh: "BGH",
  BAN_GIAM_HIEU: "BGH",
  "ban-giam-hieu": "BGH",
  "dept-bgh": "BGH",

  // 6 Phòng / Trung tâm chức năng
  P_QLDT: "P_QLDT",
  p_qldt: "P_QLDT",
  P_DTQLKH: "P_QLDT",
  DT_QLKH: "P_QLDT",
  DAO_TAO: "P_QLDT",
  dao_tao: "P_QLDT",
  "phong-dao-tao": "P_QLDT",
  "dept-p-qldt": "P_QLDT",

  P_TC: "P_TC",
  p_tc: "P_TC",
  P_KHTC: "P_TC",
  KHTC: "P_TC",
  TAI_CHINH: "P_TC",
  tai_chinh: "P_TC",
  "phong-tckt": "P_TC",
  "dept-p-tc": "P_TC",

  P_TCDBCL: "P_TCDBCL",
  p_tcdbcl: "P_TCDBCL",
  P_KTDBCL: "P_TCDBCL",
  TC_DBCL: "P_TCDBCL",
  KHAO_THI: "P_TCDBCL",
  khao_thi: "P_TCDBCL",
  "dept-p-tcdbcl": "P_TCDBCL",

  P_HCQT: "P_HCQT",
  p_hcqt: "P_HCQT",
  P_HC: "P_HCQT",
  HCQT: "P_HCQT",
  HANH_CHINH: "P_HCQT",
  hanh_chinh: "P_HCQT",
  "phong-qctb": "P_HCQT",
  "dept-p-hcqt": "P_HCQT",

  P_TSHTQT: "P_TSHTQT",
  p_tshtqt: "P_TSHTQT",
  P_CTHSSV: "P_TSHTQT",
  TS_HTQT: "P_TSHTQT",
  CTHSSV: "P_TSHTQT",
  cthssv: "P_TSHTQT",
  "phong-cthssv": "P_TSHTQT",
  "tt-tuyensinh": "P_TSHTQT",
  "dept-p-tshtqt": "P_TSHTQT",

  TT_STT: "TT_STT",
  tt_stt: "TT_STT",
  TT_DCC: "TT_STT",
  QTM_CNTT: "TT_STT",
  TRUYEN_THONG: "TT_STT",
  truyen_thong: "TT_STT",
  "dept-tt-stt": "TT_STT",
  "tt-laixe": "TT_STT",

  // 9 Khoa chuyên môn
  K_CNTT: "K_CNTT",
  k_cntt: "K_CNTT",
  K_DTTH: "K_CNTT",
  CNTT: "K_CNTT",
  cntt: "K_CNTT",
  "khoa-cntt": "K_CNTT",
  "dept-k-dtth": "K_CNTT",
  "dept-k-cntt": "K_CNTT",

  K_CK: "K_CK",
  k_ck: "K_CK",
  K_COKHI: "K_CK",
  "khoa-co-khi": "K_CK",
  "dept-k-ck": "K_CK",

  K_DIEN: "K_DIEN",
  k_dien: "K_DIEN",
  "khoa-dien": "K_DIEN",
  "dept-k-dien": "K_DIEN",

  K_CNOTO: "K_CNOTO",
  k_cnoto: "K_CNOTO",
  K_KTCN: "K_CNOTO",
  "khoa-oto": "K_CNOTO",
  "dept-k-cnoto": "K_CNOTO",
  KY_THUAT: "K_CNOTO",
  ky_thuat: "K_CNOTO",

  K_DULICH: "K_DULICH",
  k_dulich: "K_DULICH",
  K_DL: "K_DULICH",
  "khoa-dulich": "K_DULICH",
  "dept-k-dulich": "K_DULICH",

  K_KTQT: "K_KTQT",
  k_ktqt: "K_KTQT",
  K_KTTH: "K_KTQT",
  KINH_TE: "K_KTQT",
  kinh_te: "K_KTQT",
  "dept-k-ktth": "K_KTQT",
  "dept-k-ktqt": "K_KTQT",

  K_KTNN: "K_KTNN",
  k_ktnn: "K_KTNN",
  "khoa-nongnghiep": "K_KTNN",
  "dept-k-ktnn": "K_KTNN",

  K_VHNT: "K_VHNT",
  k_vhnt: "K_VHNT",
  "khoa-vhnt": "K_VHNT",
  "dept-k-vhnt": "K_VHNT",

  K_DAICUONG: "K_DAICUONG",
  k_daicuong: "K_DAICUONG",
  K_VHTHPT: "K_DAICUONG",
  K_COBAN: "K_DAICUONG",
  "dept-k-daicuong": "K_DAICUONG",

  // Trung tâm Ngoại ngữ - Tin học
  TT_NNTH: "TT_NNTH",
  tt_nnth: "TT_NNTH",
  "dept-tt-nnth": "TT_NNTH",
  thu_vien: "TT_NNTH",
  THU_VIEN: "TT_NNTH",
};

export const QCET_DEPARTMENT_GROUPS: DepartmentPersonnelGroup[] = [
  // 1. Ban Giám hiệu
  {
    id: "bgh",
    name: "Ban Giám hiệu",
    department: "Ban Giám hiệu",
    code: "BGH",
    icon: "",
    aliases: ["ban-giam-hieu", "BAN_GIAM_HIEU"],
    personnel: [
      { name: "Phạm Văn Tường", title: "ThS. Phạm Văn Tường", role: "Hiệu trưởng", email: "tuongpv@cdktcnqn.edu.vn" },
      { name: "Trần Trọng Kiệm", title: "ThS. Trần Trọng Kiệm", role: "Phó Hiệu trưởng", email: "kiemtt@cdktcnqn.edu.vn" },
      { name: "Lê Xuân Nguyên", title: "ThS. Lê Xuân Nguyên", role: "Phó Hiệu trưởng", email: "nguyenlx@cdktcnqn.edu.vn" },
    ],
    members: [
      { name: "Phạm Văn Tường", title: "ThS. Phạm Văn Tường", role: "Hiệu trưởng", email: "tuongpv@cdktcnqn.edu.vn" },
      { name: "Trần Trọng Kiệm", title: "ThS. Trần Trọng Kiệm", role: "Phó Hiệu trưởng", email: "kiemtt@cdktcnqn.edu.vn" },
      { name: "Lê Xuân Nguyên", title: "ThS. Lê Xuân Nguyên", role: "Phó Hiệu trưởng", email: "nguyenlx@cdktcnqn.edu.vn" },
    ],
  },

  // 2. 6 Phòng / Trung tâm chức năng
  {
    id: "p_qldt",
    name: "Phòng Quản lý Đào tạo",
    department: "Phòng Quản lý Đào tạo",
    code: "P_QLDT",
    icon: "",
    aliases: ["dao_tao", "DAO_TAO", "P_DTQLKH", "DT_QLKH", "phong-dao-tao", "dept-p-qldt"],
    personnel: [
      { name: "Lê Văn Thí", title: "ThS. Lê Văn Thí", role: "Trưởng phòng", email: "levanthi@cdktcnqn.edu.vn" },
      { name: "Võ Minh Trí", title: "ThS. Võ Minh Trí", role: "Phó Trưởng phòng", email: "trivm@cdktcnqn.edu.vn" },
      { name: "Đỗ Quang Trung", title: "ThS. Đỗ Quang Trung", role: "Chuyên viên QLĐT", email: "trungdq@cdktcnqn.edu.vn" },
      { name: "Nguyễn Thị Bích Thủy", title: "CN. Nguyễn Thị Bích Thủy", role: "Chuyên viên", email: "thuyntb@cdktcnqn.edu.vn" },
    ],
    members: [
      { name: "Lê Văn Thí", title: "ThS. Lê Văn Thí", role: "Trưởng phòng", email: "levanthi@cdktcnqn.edu.vn" },
      { name: "Võ Minh Trí", title: "ThS. Võ Minh Trí", role: "Phó Trưởng phòng", email: "trivm@cdktcnqn.edu.vn" },
      { name: "Đỗ Quang Trung", title: "ThS. Đỗ Quang Trung", role: "Chuyên viên QLĐT", email: "trungdq@cdktcnqn.edu.vn" },
      { name: "Nguyễn Thị Bích Thủy", title: "CN. Nguyễn Thị Bích Thủy", role: "Chuyên viên", email: "thuyntb@cdktcnqn.edu.vn" },
    ],
  },
  {
    id: "p_tc",
    name: "Phòng Tài chính",
    department: "Phòng Tài chính",
    code: "P_TC",
    icon: "",
    aliases: ["tai_chinh", "TAI_CHINH", "P_KHTC", "KHTC", "phong-tckt", "dept-p-tc"],
    personnel: [
      { name: "Lê Phương Thúy Oanh", title: "ThS. Lê Phương Thúy Oanh", role: "Trưởng phòng", email: "lephuongthuyoanh@cdktcnqn.edu.vn" },
      { name: "Hà Thanh Vân", title: "ThS. Hà Thanh Vân", role: "Kế toán trưởng", email: "vanht@cdktcnqn.edu.vn" },
      { name: "Bùi Văn Hào", title: "CN. Bùi Văn Hào", role: "Kế toán viên", email: "haobv@cdktcnqn.edu.vn" },
    ],
    members: [
      { name: "Lê Phương Thúy Oanh", title: "ThS. Lê Phương Thúy Oanh", role: "Trưởng phòng", email: "lephuongthuyoanh@cdktcnqn.edu.vn" },
      { name: "Hà Thanh Vân", title: "ThS. Hà Thanh Vân", role: "Kế toán trưởng", email: "vanht@cdktcnqn.edu.vn" },
      { name: "Bùi Văn Hào", title: "CN. Bùi Văn Hào", role: "Kế toán viên", email: "haobv@cdktcnqn.edu.vn" },
    ],
  },
  {
    id: "p_tcdbcl",
    name: "Phòng Tổ chức - Đảm bảo chất lượng",
    department: "Phòng Tổ chức - Đảm bảo chất lượng",
    code: "P_TCDBCL",
    icon: "",
    aliases: ["khao_thi", "KHAO_THI", "P_KTDBCL", "TC_DBCL", "dept-p-tcdbcl"],
    personnel: [
      { name: "Nguyễn Tiến Phong", title: "ThS. Nguyễn Tiến Phong", role: "Trưởng phòng", email: "phongnt@cdktcnqn.edu.vn" },
      { name: "Đặng Văn Hậu", title: "ThS. Đặng Văn Hậu", role: "Phó Trưởng phòng", email: "haudv@cdktcnqn.edu.vn" },
      { name: "Lê Thị Diễm My", title: "ThS. Lê Thị Diễm My", role: "Chuyên viên", email: "myltd@cdktcnqn.edu.vn" },
    ],
    members: [
      { name: "Nguyễn Tiến Phong", title: "ThS. Nguyễn Tiến Phong", role: "Trưởng phòng", email: "phongnt@cdktcnqn.edu.vn" },
      { name: "Đặng Văn Hậu", title: "ThS. Đặng Văn Hậu", role: "Phó Trưởng phòng", email: "haudv@cdktcnqn.edu.vn" },
      { name: "Lê Thị Diễm My", title: "ThS. Lê Thị Diễm My", role: "Chuyên viên", email: "myltd@cdktcnqn.edu.vn" },
    ],
  },
  {
    id: "p_hcqt",
    name: "Phòng Hành chính - Quản trị",
    department: "Phòng Hành chính - Quản trị",
    code: "P_HCQT",
    icon: "",
    aliases: ["hanh_chinh", "HANH_CHINH", "P_HC", "HCQT", "phong-qctb", "dept-p-hcqt"],
    personnel: [
      { name: "Phan Văn Thanh", title: "ThS. Phan Văn Thanh", role: "Trưởng phòng", email: "thanhpv@cdktcnqn.edu.vn" },
      { name: "Lê Hoàng Nam", title: "ThS. Lê Hoàng Nam", role: "Phó Trưởng phòng", email: "namlh@cdktcnqn.edu.vn" },
      { name: "Trương Thị Hồng Nhung", title: "CN. Trương Thị Hồng Nhung", role: "Văn thư", email: "nhungtth@cdktcnqn.edu.vn" },
    ],
    members: [
      { name: "Phan Văn Thanh", title: "ThS. Phan Văn Thanh", role: "Trưởng phòng", email: "thanhpv@cdktcnqn.edu.vn" },
      { name: "Lê Hoàng Nam", title: "ThS. Lê Hoàng Nam", role: "Phó Trưởng phòng", email: "namlh@cdktcnqn.edu.vn" },
      { name: "Trương Thị Hồng Nhung", title: "CN. Trương Thị Hồng Nhung", role: "Văn thư", email: "nhungtth@cdktcnqn.edu.vn" },
    ],
  },
  {
    id: "p_tshtqt",
    name: "Phòng Tuyển sinh - Hợp tác quốc tế",
    department: "Phòng Tuyển sinh - Hợp tác quốc tế",
    code: "P_TSHTQT",
    icon: "",
    aliases: ["cthssv", "CTHSSV", "P_CTHSSV", "TS_HTQT", "phong-cthssv", "tt-tuyensinh", "dept-p-tshtqt"],
    personnel: [
      { name: "Nguyễn Quốc Vỹ", title: "ThS. Nguyễn Quốc Vỹ", role: "Trưởng phòng", email: "vynq@cdktcnqn.edu.vn" },
      { name: "Huỳnh Công Tuấn", title: "ThS. Huỳnh Công Tuấn", role: "Phó Trưởng phòng", email: "tuanhc@cdktcnqn.edu.vn" },
      { name: "Nguyễn Thị Thanh Hà", title: "ThS. Nguyễn Thị Thanh Hà", role: "Chuyên viên", email: "hantt@cdktcnqn.edu.vn" },
    ],
    members: [
      { name: "Nguyễn Quốc Vỹ", title: "ThS. Nguyễn Quốc Vỹ", role: "Trưởng phòng", email: "vynq@cdktcnqn.edu.vn" },
      { name: "Huỳnh Công Tuấn", title: "ThS. Huỳnh Công Tuấn", role: "Phó Trưởng phòng", email: "tuanhc@cdktcnqn.edu.vn" },
      { name: "Nguyễn Thị Thanh Hà", title: "ThS. Nguyễn Thị Thanh Hà", role: "Chuyên viên", email: "hantt@cdktcnqn.edu.vn" },
    ],
  },
  {
    id: "tt_stt",
    name: "Trung tâm Số - Truyền thông",
    department: "Trung tâm Số - Truyền thông",
    code: "TT_STT",
    icon: "",
    aliases: ["truyen_thong", "TRUYEN_THONG", "TT_DCC", "QTM_CNTT", "dept-tt-stt", "tt-laixe"],
    personnel: [
      { name: "Nguyễn Ngọc Vinh", title: "KS. Nguyễn Ngọc Vinh", role: "Phó Giám đốc phụ trách", email: "vinhnn@cdktcnqn.edu.vn" },
      { name: "Mai Đinh Thị Xuân", title: "ThS. Mai Đinh Thị Xuân", role: "Phó Giám đốc", email: "xuanmdt@cdktcnqn.edu.vn" },
      { name: "Dương Quang Huy", title: "CN. Dương Quang Huy", role: "Chuyên viên CNTT", email: "huydq@cdktcnqn.edu.vn" },
    ],
    members: [
      { name: "Nguyễn Ngọc Vinh", title: "KS. Nguyễn Ngọc Vinh", role: "Phó Giám đốc phụ trách", email: "vinhnn@cdktcnqn.edu.vn" },
      { name: "Mai Đinh Thị Xuân", title: "ThS. Mai Đinh Thị Xuân", role: "Phó Giám đốc", email: "xuanmdt@cdktcnqn.edu.vn" },
      { name: "Dương Quang Huy", title: "CN. Dương Quang Huy", role: "Chuyên viên CNTT", email: "huydq@cdktcnqn.edu.vn" },
    ],
  },

  // 3. 9 Khoa chuyên môn
  {
    id: "k_cntt",
    name: "Khoa Điện tử - Tin học",
    department: "Khoa Điện tử - Tin học",
    code: "K_CNTT",
    icon: "",
    aliases: ["cntt", "CNTT", "K_DTTH", "khoa-cntt", "dept-k-dtth", "dept-k-cntt"],
    personnel: [
      { name: "Nguyễn Ngọc Vinh", title: "TS. Nguyễn Ngọc Vinh", role: "Trưởng khoa (CĐS)", email: "vinhnn@cdktcnqn.edu.vn" },
      { name: "Trần Hùng", title: "ThS. Trần Hùng", role: "Phó Trưởng khoa (ATTT)", email: "hungth@cdktcnqn.edu.vn" },
      { name: "Phan Đình Khôi", title: "ThS. Phan Đình Khôi", role: "Giảng viên CNTT", email: "khoipd@cdktcnqn.edu.vn" },
    ],
    members: [
      { name: "Nguyễn Ngọc Vinh", title: "TS. Nguyễn Ngọc Vinh", role: "Trưởng khoa (CĐS)", email: "vinhnn@cdktcnqn.edu.vn" },
      { name: "Trần Hùng", title: "ThS. Trần Hùng", role: "Phó Trưởng khoa (ATTT)", email: "hungth@cdktcnqn.edu.vn" },
      { name: "Phan Đình Khôi", title: "ThS. Phan Đình Khôi", role: "Giảng viên CNTT", email: "khoipd@cdktcnqn.edu.vn" },
    ],
  },
  {
    id: "k_ck",
    name: "Khoa Cơ khí",
    department: "Khoa Cơ khí",
    code: "K_CK",
    icon: "",
    aliases: ["K_COKHI", "khoa-co-khi", "dept-k-ck"],
    personnel: [
      { name: "Đinh Quốc Cường", title: "TS. Đinh Quốc Cường", role: "Trưởng khoa", email: "cuongdq@cdktcnqn.edu.vn" },
      { name: "Vũ Văn Nghiệp", title: "ThS. Vũ Văn Nghiệp", role: "Phó Trưởng khoa", email: "nghiepvv@cdktcnqn.edu.vn" },
      { name: "Trần Bá Lộc", title: "ThS. Trần Bá Lộc", role: "Giảng viên", email: "loctb@cdktcnqn.edu.vn" },
    ],
    members: [
      { name: "Đinh Quốc Cường", title: "TS. Đinh Quốc Cường", role: "Trưởng khoa", email: "cuongdq@cdktcnqn.edu.vn" },
      { name: "Vũ Văn Nghiệp", title: "ThS. Vũ Văn Nghiệp", role: "Phó Trưởng khoa", email: "nghiepvv@cdktcnqn.edu.vn" },
      { name: "Trần Bá Lộc", title: "ThS. Trần Bá Lộc", role: "Giảng viên", email: "loctb@cdktcnqn.edu.vn" },
    ],
  },
  {
    id: "k_dien",
    name: "Khoa Điện",
    department: "Khoa Điện",
    code: "K_DIEN",
    icon: "",
    aliases: ["khoa-dien", "dept-k-dien"],
    personnel: [
      { name: "Nguyễn Văn Thắng", title: "ThS. Nguyễn Văn Thắng", role: "Trưởng khoa", email: "thangnv@cdktcnqn.edu.vn" },
      { name: "Bùi Văn Quy", title: "ThS. Bùi Văn Quy", role: "Phó Trưởng khoa", email: "quybv@cdktcnqn.edu.vn" },
    ],
    members: [
      { name: "Nguyễn Văn Thắng", title: "ThS. Nguyễn Văn Thắng", role: "Trưởng khoa", email: "thangnv@cdktcnqn.edu.vn" },
      { name: "Bùi Văn Quy", title: "ThS. Bùi Văn Quy", role: "Phó Trưởng khoa", email: "quybv@cdktcnqn.edu.vn" },
    ],
  },
  {
    id: "k_cnoto",
    name: "Khoa Công nghệ Ô tô",
    department: "Khoa Công nghệ Ô tô",
    code: "K_CNOTO",
    icon: "",
    aliases: ["ky_thuat", "KY_THUAT", "K_KTCN", "khoa-oto", "dept-k-cnoto"],
    personnel: [
      { name: "Vũ Mạnh Hùng", title: "ThS. Vũ Mạnh Hùng", role: "Trưởng khoa", email: "hungvm@cdktcnqn.edu.vn" },
      { name: "Trần Bá Lộc", title: "ThS. Trần Bá Lộc", role: "Phó Trưởng khoa", email: "loctb@cdktcnqn.edu.vn" },
    ],
    members: [
      { name: "Vũ Mạnh Hùng", title: "ThS. Vũ Mạnh Hùng", role: "Trưởng khoa", email: "hungvm@cdktcnqn.edu.vn" },
      { name: "Trần Bá Lộc", title: "ThS. Trần Bá Lộc", role: "Phó Trưởng khoa", email: "loctb@cdktcnqn.edu.vn" },
    ],
  },
  {
    id: "k_dulich",
    name: "Khoa Du lịch - Dịch vụ",
    department: "Khoa Du lịch - Dịch vụ",
    code: "K_DULICH",
    icon: "",
    aliases: ["K_DL", "khoa-dulich", "dept-k-dulich"],
    personnel: [
      { name: "Phan Thị Thanh Thảo", title: "ThS. Phan Thị Thanh Thảo", role: "Trưởng khoa", email: "thaoptt@cdktcnqn.edu.vn" },
      { name: "Hoàng Thành Nam", title: "ThS. Hoàng Thành Nam", role: "Phó Trưởng khoa", email: "namht@cdktcnqn.edu.vn" },
    ],
    members: [
      { name: "Phan Thị Thanh Thảo", title: "ThS. Phan Thị Thanh Thảo", role: "Trưởng khoa", email: "thaoptt@cdktcnqn.edu.vn" },
      { name: "Hoàng Thành Nam", title: "ThS. Hoàng Thành Nam", role: "Phó Trưởng khoa", email: "namht@cdktcnqn.edu.vn" },
    ],
  },
  {
    id: "k_ktqt",
    name: "Khoa Kinh tế - Tổng hợp",
    department: "Khoa Kinh tế - Tổng hợp",
    code: "K_KTQT",
    icon: "",
    aliases: ["kinh_te", "KINH_TE", "K_KTTH", "dept-k-ktth", "dept-k-ktqt"],
    personnel: [
      { name: "Lê Thị Ánh Tuyết", title: "ThS. Lê Thị Ánh Tuyết", role: "Trưởng khoa", email: "tuyetla@cdktcnqn.edu.vn" },
      { name: "Đỗ Hoàng Sơn", title: "ThS. Đỗ Hoàng Sơn", role: "Phó Trưởng khoa", email: "sondh@cdktcnqn.edu.vn" },
      { name: "Nguyễn Hồng Phượng", title: "ThS. Nguyễn Hồng Phượng", role: "Giảng viên", email: "phuongnh@cdktcnqn.edu.vn" },
    ],
    members: [
      { name: "Lê Thị Ánh Tuyết", title: "ThS. Lê Thị Ánh Tuyết", role: "Trưởng khoa", email: "tuyetla@cdktcnqn.edu.vn" },
      { name: "Đỗ Hoàng Sơn", title: "ThS. Đỗ Hoàng Sơn", role: "Phó Trưởng khoa", email: "sondh@cdktcnqn.edu.vn" },
      { name: "Nguyễn Hồng Phượng", title: "ThS. Nguyễn Hồng Phượng", role: "Giảng viên", email: "phuongnh@cdktcnqn.edu.vn" },
    ],
  },
  {
    id: "k_ktnn",
    name: "Khoa Kỹ thuật Nông nghiệp",
    department: "Khoa Kỹ thuật Nông nghiệp",
    code: "K_KTNN",
    icon: "",
    aliases: ["khoa-nongnghiep", "dept-k-ktnn"],
    personnel: [
      { name: "Nguyễn Hữu Dũng", title: "ThS. Nguyễn Hữu Dũng", role: "Trưởng khoa", email: "dungnh@cdktcnqn.edu.vn" },
      { name: "Phạm Thị Thu Lan", title: "ThS. Phạm Thị Thu Lan", role: "Phó Trưởng khoa", email: "lanptt@cdktcnqn.edu.vn" },
    ],
    members: [
      { name: "Nguyễn Hữu Dũng", title: "ThS. Nguyễn Hữu Dũng", role: "Trưởng khoa", email: "dungnh@cdktcnqn.edu.vn" },
      { name: "Phạm Thị Thu Lan", title: "ThS. Phạm Thị Thu Lan", role: "Phó Trưởng khoa", email: "lanptt@cdktcnqn.edu.vn" },
    ],
  },
  {
    id: "k_vhnt",
    name: "Khoa Văn hóa Nghệ thuật",
    department: "Khoa Văn hóa Nghệ thuật",
    code: "K_VHNT",
    icon: "",
    aliases: ["khoa-vhnt", "dept-k-vhnt"],
    personnel: [
      { name: "Đặng Thị Mỹ Hạnh", title: "ThS. Đặng Thị Mỹ Hạnh", role: "Trưởng khoa", email: "hanhdtm@cdktcnqn.edu.vn" },
      { name: "Nguyễn Thành Long", title: "ThS. Nguyễn Thành Long", role: "Phó Trưởng khoa", email: "longnt@cdktcnqn.edu.vn" },
    ],
    members: [
      { name: "Đặng Thị Mỹ Hạnh", title: "ThS. Đặng Thị Mỹ Hạnh", role: "Trưởng khoa", email: "hanhdtm@cdktcnqn.edu.vn" },
      { name: "Nguyễn Thành Long", title: "ThS. Nguyễn Thành Long", role: "Phó Trưởng khoa", email: "longnt@cdktcnqn.edu.vn" },
    ],
  },
  {
    id: "k_daicuong",
    name: "Khoa Văn hóa THPT & Khoa học cơ bản",
    department: "Khoa Văn hóa THPT & Khoa học cơ bản",
    code: "K_DAICUONG",
    icon: "",
    aliases: ["K_VHTHPT", "K_COBAN", "dept-k-daicuong"],
    personnel: [
      { name: "Trịnh Thị Thu Minh", title: "ThS. Trịnh Thị Thu Minh", role: "Trưởng khoa", email: "minhttt@cdktcnqn.edu.vn" },
      { name: "Trần Thị Kiều Oanh", title: "ThS. Trần Thị Kiều Oanh", role: "Phó Trưởng khoa", email: "oanhttk@cdktcnqn.edu.vn" },
    ],
    members: [
      { name: "Trịnh Thị Thu Minh", title: "ThS. Trịnh Thị Thu Minh", role: "Trưởng khoa", email: "minhttt@cdktcnqn.edu.vn" },
      { name: "Trần Thị Kiều Oanh", title: "ThS. Trần Thị Kiều Oanh", role: "Phó Trưởng khoa", email: "oanhttk@cdktcnqn.edu.vn" },
    ],
  },

  // Trung tâm Ngoại ngữ - Tin học (bổ trợ)
  {
    id: "tt_nnth",
    name: "Trung tâm Ngoại ngữ - Tin học",
    department: "Trung tâm Ngoại ngữ - Tin học",
    code: "TT_NNTH",
    icon: "",
    aliases: ["thu_vien", "THU_VIEN", "dept-tt-nnth"],
    personnel: [
      { name: "Chu Đình Thắng", title: "ThS. Chu Đình Thắng", role: "Giám đốc TT", email: "thangcd@cdktcnqn.edu.vn" },
      { name: "Phạm Thị Thu", title: "CN. Phạm Thị Thu", role: "Phụ trách Thư viện", email: "thupt@cdktcnqn.edu.vn" },
      { name: "Trần Bảo Ngọc", title: "ThS. Trần Bảo Ngọc", role: "Giảng viên", email: "ngoctb@cdktcnqn.edu.vn" },
    ],
    members: [
      { name: "Chu Đình Thắng", title: "ThS. Chu Đình Thắng", role: "Giám đốc TT", email: "thangcd@cdktcnqn.edu.vn" },
      { name: "Phạm Thị Thu", title: "CN. Phạm Thị Thu", role: "Phụ trách Thư viện", email: "thupt@cdktcnqn.edu.vn" },
      { name: "Trần Bảo Ngọc", title: "ThS. Trần Bảo Ngọc", role: "Giảng viên", email: "ngoctb@cdktcnqn.edu.vn" },
    ],
  },
];

export function getDepartmentByCode(rawCode: string): DepartmentPersonnelGroup | undefined {
  if (!rawCode) return undefined;
  const normalized = QCET_UNIT_CANONICAL_MAP[rawCode] ||
    QCET_UNIT_CANONICAL_MAP[rawCode.toUpperCase()] ||
    QCET_UNIT_CANONICAL_MAP[rawCode.toLowerCase()] ||
    rawCode;

  return QCET_DEPARTMENT_GROUPS.find((g) => {
    if (g.code.toLowerCase() === normalized.toLowerCase()) return true;
    if (g.id.toLowerCase() === normalized.toLowerCase()) return true;
    if (g.code.toLowerCase() === rawCode.toLowerCase()) return true;
    if (g.id.toLowerCase() === rawCode.toLowerCase()) return true;
    if (g.aliases && g.aliases.some((a) => a.toLowerCase() === rawCode.toLowerCase() || a.toLowerCase() === normalized.toLowerCase())) {
      return true;
    }
    return false;
  });
}

export function getDepartmentForMember(
  memberName: string
): DepartmentPersonnelGroup | undefined {
  if (!memberName) return undefined;
  const clean = memberName.replace(/^(ThS\.|TS\.|CN\.|BS\.|PGS\.|GS\.|KS\.|GVC\.)\s*/, "").trim().toLowerCase();
  return QCET_DEPARTMENT_GROUPS.find((group) =>
    group.members.some((m) => {
      const mClean = m.name.replace(/^(ThS\.|TS\.|CN\.|BS\.|PGS\.|GS\.|KS\.|GVC\.)\s*/, "").trim().toLowerCase();
      return m.name.toLowerCase() === memberName.toLowerCase() || mClean === clean;
    })
  );
}
