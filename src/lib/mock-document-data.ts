import { OfficialDocument, DocumentStats } from "../types/document";

export const MOCK_DOCUMENTS: OfficialDocument[] = [
  {
    id: "DOC-IN-001",
    type: "inbox",
    documentNumber: "128/TCGDNN-VP",
    issuedDate: "2026-09-02",
    receivedDate: "2026-09-03",
    issuingAuthority: "Tổng cục Giáo dục Nghề nghiệp",
    summary:
      "V/v Hướng dẫn giao chỉ tiêu tuyển sinh cao đẳng, trung cấp năm học 2025–2026 và đổi mới cấu trúc chuẩn đầu ra theo phương pháp DACUM",
    urgency: "urgent",
    status: "delegated",
    leadDepartment: "Phòng Đào tạo",
    signatory: "Trương Anh Dũng (Tổng cục trưởng)",
    linkedTaskId: "TASK-101",
    linkedTaskTitle: "Cập nhật ma trận phân công DACUM & chỉ tiêu đào tạo 2025-2026",
    fileAttachment: {
      name: "128_TCGDNN_HuongDan_TuyenSinh_DACUM.pdf",
      size: "2.4 MB",
    },
  },
  {
    id: "DOC-IN-002",
    type: "inbox",
    documentNumber: "2456/UBND-VX",
    issuedDate: "2026-09-04",
    receivedDate: "2026-09-05",
    issuingAuthority: "UBND Tỉnh Bình Định",
    summary:
      "Kế hoạch triển khai đề án Chuyển đổi số toàn diện các cơ sở giáo dục nghề nghiệp tỉnh Bình Định giai đoạn 2025–2030",
    urgency: "top_urgent",
    status: "delegated",
    leadDepartment: "Khoa CNTT / Ban Chuyển đổi số",
    signatory: "Phạm Anh Tuấn (Chủ tịch UBND Tỉnh)",
    linkedTaskId: "TASK-102",
    linkedTaskTitle: "Triển khai trục liên thông dữ liệu và hạ tầng số QCET E-Office",
    fileAttachment: {
      name: "2456_UBND_DeAn_ChuyenDoiSo_GDNN.pdf",
      size: "3.8 MB",
    },
  },
  {
    id: "DOC-IN-003",
    type: "inbox",
    documentNumber: "42/SLĐTBXH-DN",
    issuedDate: "2026-09-05",
    receivedDate: "2026-09-06",
    issuingAuthority: "Sở Lao động - Thương binh & Xã hội",
    summary:
      "Kế hoạch thanh kiểm tra công tác an toàn lao động, vệ sinh công nghiệp và tiêu chuẩn kiểm định chất lượng xưởng thực hành năm học 2025–2026",
    urgency: "normal",
    status: "processing",
    leadDepartment: "Phòng Quản trị - Thiết bị",
    signatory: "Đỗ Nguyên Hùng (Phó Giám đốc Sở)",
    fileAttachment: {
      name: "42_SLDTBXH_KeHoach_KiemDinh_Xuong.pdf",
      size: "1.6 MB",
    },
  },
  {
    id: "DOC-IN-004",
    type: "inbox",
    documentNumber: "89/BGDĐT-GDĐH",
    issuedDate: "2026-09-06",
    receivedDate: "2026-09-07",
    issuingAuthority: "Bộ Giáo dục và Đào tạo",
    summary:
      "Thông tri hướng dẫn công nhận tín chỉ kỹ năng thực hành nghề tương đương và liên thông đào tạo khối ngành kỹ thuật công nghệ",
    urgency: "normal",
    status: "pending_assignment",
    leadDepartment: "Phòng Đào tạo",
    signatory: "Hoàng Minh Sơn (Thứ trưởng)",
    fileAttachment: {
      name: "89_BGDDT_CongNhan_TinChi_LienThong.pdf",
      size: "1.9 MB",
    },
  },
  {
    id: "DOC-IN-005",
    type: "inbox",
    documentNumber: "19/UBND-NC",
    issuedDate: "2026-08-28",
    receivedDate: "2026-08-28",
    issuingAuthority: "UBND Tỉnh Bình Định",
    summary:
      "Công văn HỎA TỐC: Chủ động ứng phó áp thấp nhiệt đới và rà soát an toàn hệ thống điện xưởng cơ khí, nhà điều hành trường học",
    urgency: "flash",
    status: "completed",
    leadDepartment: "Ban Chỉ huy PCTT & TKCN Trường",
    signatory: "Nguyễn Tuấn Thanh (Phó Chủ tịch Thường trực)",
    linkedTaskId: "TASK-098",
    linkedTaskTitle: "Kiểm tra toàn bộ hệ thống thoát nước và lưới điện cao thế",
    fileAttachment: {
      name: "19_UBND_HoaToc_PhongChongBaoLut.pdf",
      size: "850 KB",
    },
  },
  {
    id: "DOC-OUT-001",
    type: "outbox",
    documentNumber: "145/CĐKTCN-ĐT",
    issuedDate: "2026-09-03",
    issuingAuthority: "Trường CĐ Kỹ thuật Công nghệ Quy Nhơn",
    summary:
      "Báo cáo sơ kết giai đoạn 1 đề án đào tạo thí điểm kỹ thuật viên Cơ điện tử và Ô tô điện theo tiêu chuẩn CHLB Đức",
    urgency: "normal",
    status: "completed",
    leadDepartment: "Phòng Đào tạo & Hợp tác Quốc tế",
    signatory: "TS. Nguyễn Văn Hiệu (Phó Hiệu trưởng)",
    fileAttachment: {
      name: "145_CDKTCN_BaoCao_DaoTao_TieuChuanDuc.pdf",
      size: "4.2 MB",
    },
  },
  {
    id: "DOC-OUT-002",
    type: "outbox",
    documentNumber: "210/CĐKTCN-TCKT",
    issuedDate: "2026-09-05",
    issuingAuthority: "Trường CĐ Kỹ thuật Công nghệ Quy Nhơn",
    summary:
      "Tờ trình đề xuất phân bổ dự toán kinh phí mua sắm vật tư thực hành kỳ 1 và bảo dưỡng máy móc CNC xưởng Cơ khí",
    urgency: "urgent",
    status: "processing",
    leadDepartment: "Phòng Tài chính - Kế toán",
    signatory: "ThS. Đặng Thị Bích (Trưởng phòng TCKT)",
    fileAttachment: {
      name: "210_CDKTCN_DuToan_VatTu_ThucHanh.pdf",
      size: "2.1 MB",
    },
  },
  {
    id: "DOC-OUT-003",
    type: "outbox",
    documentNumber: "56/CĐKTCN-VP",
    issuedDate: "2026-08-30",
    issuingAuthority: "Trường CĐ Kỹ thuật Công nghệ Quy Nhơn",
    summary:
      "Thông báo kế hoạch điều hành tuần lễ khai giảng năm học 2025–2026 và đón tân sinh viên nhập học đợt 2",
    urgency: "normal",
    status: "completed",
    leadDepartment: "Văn phòng Trường",
    signatory: "TS. Nguyễn Văn Hiệu (Phó Hiệu trưởng)",
    fileAttachment: {
      name: "56_CDKTCN_KeHoach_KhaiGiang_2025.pdf",
      size: "1.2 MB",
    },
  },
  {
    id: "DOC-SUB-001",
    type: "submission",
    documentNumber: "15/TTr-CNTT",
    issuedDate: "2026-09-06",
    issuingAuthority: "Khoa Công nghệ thông tin",
    summary:
      "Tờ trình xin phê duyệt kinh phí và cấu hình máy chủ phục vụ Hội thi Kỹ năng nghề quốc gia phân môn Điện toán đám mây",
    urgency: "urgent",
    status: "pending_assignment",
    leadDepartment: "Khoa CNTT",
    signatory: "ThS. Trần Hùng (Phó Trưởng khoa phụ trách)",
    linkedTaskId: "TASK-105",
    linkedTaskTitle: "Chuẩn bị đề thi và hạ tầng Server Kỹ năng nghề 2026",
    fileAttachment: {
      name: "15_TTr_CNTT_KinhPhi_Server_HoiThi.pdf",
      size: "1.4 MB",
    },
  },
  {
    id: "DOC-SUB-002",
    type: "submission",
    documentNumber: "28/TTr-ĐT",
    issuedDate: "2026-09-05",
    issuingAuthority: "Phòng Đào tạo",
    summary:
      "Tờ trình ban hành Quy chế khảo thí trực tuyến và quy trình thẩm định minh chứng giảng dạy số hóa theo khung DACUM",
    urgency: "normal",
    status: "approved",
    leadDepartment: "Phòng Đào tạo",
    signatory: "ThS. Lê Thanh Hải (Trưởng phòng Đào tạo)",
    linkedTaskId: "TASK-106",
    linkedTaskTitle: "Duyệt khung quy chế khảo thí trực tuyến DACUM",
    fileAttachment: {
      name: "28_TTr_DT_QuyChe_KhaoThi_DACUM.pdf",
      size: "2.8 MB",
    },
  },
];

export function getDocumentStats(docs: OfficialDocument[] = MOCK_DOCUMENTS): DocumentStats {
  const totalInbox = docs.filter((d) => d.type === "inbox").length;
  const totalOutbox = docs.filter((d) => d.type === "outbox").length;
  const totalSubmissions = docs.filter((d) => d.type === "submission").length;
  const urgentCount = docs.filter(
    (d) => d.urgency === "urgent" || d.urgency === "top_urgent" || d.urgency === "flash"
  ).length;
  const linkedTaskCount = docs.filter((d) => Boolean(d.linkedTaskId)).length;

  return {
    totalInbox,
    totalOutbox,
    totalSubmissions,
    urgentCount,
    linkedTaskCount,
  };
}
