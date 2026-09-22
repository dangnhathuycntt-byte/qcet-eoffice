export type DepartmentCategory =
  | "BGH"
  | "PHONG_CHUC_NANG"
  | "KHOA_CHUYEN_MON"
  | "TRUNG_TAM";

/**
 * Domain configuration for QCET organizational units.
 *
 * This is institutional metadata that rarely changes (description, location,
 * phone, email, category). Personnel data (members, leader) comes from the
 * database via useDepartmentList({ includePersonnel: true }).
 */
export interface OrgUnitConfig {
  id: string;
  code: string;
  name: string;
  shortName: string;
  category: DepartmentCategory;
  categoryLabel: string;
  description: string;
  location: string;
  phone: string;
  email: string;
  groupField?: "Nhóm" | "Nhóm công tác";
  notionDbKey?: string;
}

export const QCET_ORG_UNITS: OrgUnitConfig[] = [
  {
    id: "dept-bgh",
    code: "BGH",
    name: "Ban Giám hiệu",
    shortName: "Ban Giám hiệu",
    category: "BGH",
    categoryLabel: "Lãnh đạo nhà trường",
    description: "Tập thể lãnh đạo cao nhất trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn, chỉ đạo chiến lược phát triển, chuyển đổi số toàn diện và quản trị chất lượng giáo dục nghề nghiệp.",
    location: "Tòa nhà Hiệu bộ - Tầng 3",
    phone: "0256 3846 478",
    email: "bgh@cdktcnqn.edu.vn",
    groupField: "Nhóm",
  },
  {
    id: "dept-p-hcqt",
    code: "P_HCQT",
    name: "Phòng Hành chính - Quản trị",
    shortName: "Hành chính - Quản trị",
    category: "PHONG_CHUC_NANG",
    categoryLabel: "Phòng chức năng",
    description: "Chịu trách nhiệm quản lý văn thư lưu trữ, công tác hành chính tổng hợp, an ninh trật tự, quản trị tài sản và cơ sở vật chất.",
    location: "Tòa nhà Hiệu bộ - Tầng 1, P.101",
    phone: "0256 3846 479",
    email: "hanhchinh@cdktcnqn.edu.vn",
    groupField: "Nhóm",
    notionDbKey: "hanh_chinh_quan_tri",
  },
  {
    id: "dept-p-tcdbcl",
    code: "P_TCDBCL",
    name: "Phòng Tổ chức - Đảm bảo chất lượng",
    shortName: "Tổ chức - ĐBCL",
    category: "PHONG_CHUC_NANG",
    categoryLabel: "Phòng chức năng",
    description: "Tham mưu kiện toàn tổ chức cán bộ, bổ nhiệm, thi đua khen thưởng, thực hiện tự đánh giá kiểm định cơ sở giáo dục nghề nghiệp và khảo thí.",
    location: "Tòa nhà Hiệu bộ - Tầng 2, P.202",
    phone: "0256 3846 481",
    email: "tochuc@cdktcnqn.edu.vn",
    groupField: "Nhóm",
    notionDbKey: "to_chuc_dbcl",
  },
  {
    id: "dept-p-qldt",
    code: "P_QLDT",
    name: "Phòng Quản lý Đào tạo",
    shortName: "Quản lý Đào tạo",
    category: "PHONG_CHUC_NANG",
    categoryLabel: "Phòng chức năng",
    description: "Xây dựng kế hoạch giảng dạy, thời khóa biểu, quản lý tiến độ đào tạo, liên kết doanh nghiệp và theo dõi đề tài nghiên cứu khoa học.",
    location: "Tòa nhà Hiệu bộ - Tầng 1, P.102",
    phone: "0256 3846 477",
    email: "daotao@cdktcnqn.edu.vn",
    groupField: "Nhóm",
    notionDbKey: "quan_ly_dao_tao",
  },
  {
    id: "dept-p-tshtqt",
    code: "P_TSHTQT",
    name: "Phòng Tuyển sinh - Hợp tác quốc tế",
    shortName: "Tuyển sinh - HTQT",
    category: "PHONG_CHUC_NANG",
    categoryLabel: "Phòng chức năng",
    description: "Đầu mối tổ chức công tác tư vấn tuyển sinh các hệ đào tạo, quản lý ký túc xá, chế độ chính sách sinh viên và phát triển dự án hợp tác quốc tế.",
    location: "Tòa nhà Hiệu bộ - Tầng 1, P.103",
    phone: "0256 3846 482",
    email: "tuyensinh@cdktcnqn.edu.vn",
    groupField: "Nhóm",
    notionDbKey: "tuyen_sinh_htqt",
  },
  {
    id: "dept-p-tc",
    code: "P_TC",
    name: "Phòng Tài chính",
    shortName: "Tài chính",
    category: "PHONG_CHUC_NANG",
    categoryLabel: "Phòng chức năng",
    description: "Tham mưu và thực hiện công tác quản lý tài chính, phân bổ dự toán ngân sách nhà nước, kế toán tiền lương, học phí và giải ngân đầu tư công.",
    location: "Tòa nhà Hiệu bộ - Tầng 1, P.104",
    phone: "0256 3846 480",
    email: "taichinh@cdktcnqn.edu.vn",
    groupField: "Nhóm",
    notionDbKey: "tai_chinh",
  },
  {
    id: "dept-tt-stt",
    code: "TT_STT",
    name: "Trung tâm Số - Truyền thông",
    shortName: "Số - Truyền thông",
    category: "TRUNG_TAM",
    categoryLabel: "Trung tâm trực thuộc",
    description: "Đầu mối kỹ thuật vận hành hệ thống E-Office, máy chủ, cổng thông tin trường, mạng viễn thông và sản xuất ấn phẩm truyền thông số hóa.",
    location: "Tòa nhà Thư viện & TT Số - Tầng 2, P.204",
    phone: "0256 3846 486",
    email: "quantrimang@cdktcnqn.edu.vn",
    groupField: "Nhóm",
    notionDbKey: "so_truyen_thong",
  },
  {
    id: "dept-tt-nnth",
    code: "TT_NNTH",
    name: "Trung tâm Ngoại ngữ - Tin học",
    shortName: "TT Ngoại ngữ - Tin học",
    category: "TRUNG_TAM",
    categoryLabel: "Trung tâm trực thuộc",
    description: "Tổ chức đào tạo, bồi dưỡng và sát hạch cấp chứng chỉ Ngoại ngữ chuẩn quốc tế (TOEIC, IELTS) và Tin học chuẩn kỹ năng quốc gia.",
    location: "Tòa nhà Thư viện & TT Số - Tầng 1, P.105",
    phone: "0256 3846 487",
    email: "nnth@cdktcnqn.edu.vn",
    groupField: "Nhóm",
  },
  {
    id: "dept-k-dtth",
    code: "K_CNTT",
    name: "Khoa Công nghệ thông tin (Điện tử - Tin học)",
    shortName: "Khoa CNTT",
    category: "KHOA_CHUYEN_MON",
    categoryLabel: "Khoa chuyên môn",
    description: "Đào tạo kỹ sư thực hành các chuyên ngành Công nghệ thông tin, Kỹ thuật Phần mềm, An toàn mạng, Thiết kế đồ họa số và Trí tuệ nhân tạo.",
    location: "Khu Giảng đường C - Tầng 3, P.302",
    phone: "0256 3846 483",
    email: "khoadientutinhoc@cdktcnqn.edu.vn",
    groupField: "Nhóm công tác",
    notionDbKey: "khoa_dien_tu_tin_hoc",
  },
  {
    id: "dept-k-ck",
    code: "K_CK",
    name: "Khoa Cơ khí",
    shortName: "Khoa Cơ khí",
    category: "KHOA_CHUYEN_MON",
    categoryLabel: "Khoa chuyên môn",
    description: "Đào tạo kỹ sư thực hành chuyên ngành Cắt gọt kim loại CNC, Công nghệ Hàn công nghệ cao và Thiết kế chế tạo máy công nghiệp.",
    location: "Khu Xưởng Thực hành A - P.101",
    phone: "0256 3846 488",
    email: "khoacokhi@cdktcnqn.edu.vn",
    groupField: "Nhóm công tác",
    notionDbKey: "khoa_co_khi",
  },
  {
    id: "dept-k-cnoto",
    code: "K_CNOTO",
    name: "Khoa Công nghệ Ô tô (Ô tô & Chế tạo máy)",
    shortName: "Khoa KTCN",
    category: "KHOA_CHUYEN_MON",
    categoryLabel: "Khoa chuyên môn",
    description: "Đào tạo kỹ sư thực hành chuyên ngành Công nghệ kỹ thuật ô tô, Hệ thống điều khiển điện tử ô tô và Xe điện thông minh (EV).",
    location: "Khu Xưởng Thực hành D - P.102",
    phone: "0256 3846 489",
    email: "khoaoto@cdktcnqn.edu.vn",
    groupField: "Nhóm công tác",
    notionDbKey: "khoa_cong_nghe_o_to",
  },
  {
    id: "dept-k-dien",
    code: "K_DIEN",
    name: "Khoa Điện",
    shortName: "Khoa Điện",
    category: "KHOA_CHUYEN_MON",
    categoryLabel: "Khoa chuyên môn",
    description: "Đào tạo chuyên ngành Điện công nghiệp, Kỹ thuật lắp đặt điện tử công suất, Hệ thống pin năng lượng mặt trời và Tự động hóa trạm biến áp.",
    location: "Khu Giảng đường B - Tầng 1, P.108",
    phone: "0256 3846 490",
    email: "khoadien@cdktcnqn.edu.vn",
    groupField: "Nhóm công tác",
    notionDbKey: "khoa_dien",
  },
  {
    id: "dept-k-dulich",
    code: "K_DULICH",
    name: "Khoa Du lịch",
    shortName: "Khoa Du lịch",
    category: "KHOA_CHUYEN_MON",
    categoryLabel: "Khoa chuyên môn",
    description: "Đào tạo các ngành Quản trị Khách sạn, Quản trị Nhà hàng & Dịch vụ ăn uống, Kỹ thuật chế biến món ăn và Hướng dẫn viên du lịch quốc tế.",
    location: "Khu Giảng đường D - Tầng 2, P.201",
    phone: "0256 3846 491",
    email: "khoadulich@cdktcnqn.edu.vn",
    groupField: "Nhóm công tác",
    notionDbKey: "khoa_du_lich",
  },
  {
    id: "dept-k-ktth",
    code: "K_KTQT",
    name: "Khoa Kinh tế - Quản trị (Kinh tế tổng hợp)",
    shortName: "Khoa KTQT",
    category: "KHOA_CHUYEN_MON",
    categoryLabel: "Khoa chuyên môn",
    description: "Đào tạo Kế toán doanh nghiệp, Quản trị kinh doanh số, Logistics & Quản lý chuỗi cung ứng, Thương mại điện tử chất lượng cao.",
    location: "Khu Giảng đường B - Tầng 2, P.205",
    phone: "0256 3846 484",
    email: "khoaktth@cdktcnqn.edu.vn",
    groupField: "Nhóm công tác",
    notionDbKey: "khoa_kinh_te_tong_hop",
  },
  {
    id: "dept-k-ktnn",
    code: "K_KTNN",
    name: "Khoa Kỹ thuật nông nghiệp",
    shortName: "Khoa Kỹ thuật nông nghiệp",
    category: "KHOA_CHUYEN_MON",
    categoryLabel: "Khoa chuyên môn",
    description: "Đào tạo Nông nghiệp công nghệ cao, Trồng trọt thông minh, Bảo vệ thực vật và Thú y ứng dụng phục vụ kinh tế nông nghiệp miền Trung.",
    location: "Khu Giảng đường Nông nghiệp & Trại thực nghiệm",
    phone: "0256 3846 492",
    email: "khoann@cdktcnqn.edu.vn",
    groupField: "Nhóm công tác",
    notionDbKey: "khoa_ky_thuat_nong_nghiep",
  },
  {
    id: "dept-k-vhnt",
    code: "K_VHNT",
    name: "Khoa Văn hóa nghệ thuật",
    shortName: "Khoa Văn hóa nghệ thuật",
    category: "KHOA_CHUYEN_MON",
    categoryLabel: "Khoa chuyên môn",
    description: "Đào tạo Thanh nhạc, Biểu diễn nhạc cụ truyền thống, Biên đạo múa, Quản lý văn hóa cơ sở và Thiết kế mỹ thuật ứng dụng.",
    location: "Khu Giảng đường Nghệ thuật - Tòa E",
    phone: "0256 3846 493",
    email: "khoavhnt@cdktcnqn.edu.vn",
    groupField: "Nhóm công tác",
    notionDbKey: "khoa_van_hoa_nghe_thuat",
  },
  {
    id: "dept-k-daicuong",
    code: "K_DAICUONG",
    name: "Khoa Đại cương",
    shortName: "Khoa Đại cương",
    category: "KHOA_CHUYEN_MON",
    categoryLabel: "Khoa chuyên môn",
    description: "Giảng dạy các học phần khoa học cơ bản (Toán cao cấp, Vật lý đại cương), Lý luận chính trị, Giáo dục quốc phòng và Giáo dục thể chất cho toàn trường.",
    location: "Khu Giảng đường B - Tầng 3, P.305",
    phone: "0256 3846 494",
    email: "khoadaicuong@cdktcnqn.edu.vn",
    groupField: "Nhóm công tác",
    notionDbKey: "khoa_dai_cuong",
  }
];

/** Lookup a unit config by code (case-insensitive). */
export function getOrgUnitConfig(code: string): OrgUnitConfig | undefined {
  if (!code) return undefined;
  const norm = code.trim().toUpperCase();
  return QCET_ORG_UNITS.find(
    (u) => u.code.toUpperCase() === norm || u.id.toUpperCase() === norm,
  );
}
