import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

def build_qcet_eoffice_excel():
    wb = openpyxl.Workbook()

    # ----------------------------------------------------
    # STYLES & PALETTES
    # ----------------------------------------------------
    font_family = "Arial"

    # Colors
    c_navy = "1E3A8A"      # Main Brand Navy
    c_blue = "2563EB"      # Accent Blue
    c_slate_dark = "1E293B"# Dark Slate
    c_slate_light = "F8FAFC" # Alternating row fill
    c_border = "CBD5E1"    # Border color

    # Status Colors
    c_green_fill = "DCFCE7"
    c_green_text = "166534"
    c_yellow_fill = "FEF9C3"
    c_yellow_text = "854D0E"
    c_gray_fill = "F1F5F9"
    c_gray_text = "475569"
    c_red_fill = "FEE2E2"
    c_red_text = "991B1B"
    c_purple_fill = "F3E8FF"
    c_purple_text = "6B21A8"

    # Standard Fonts
    title_font = Font(name=font_family, size=16, bold=True, color="FFFFFF")
    subtitle_font = Font(name=font_family, size=11, italic=True, color="E2E8F0")
    sec_hdr_font = Font(name=font_family, size=13, bold=True, color="1E3A8A")
    tbl_hdr_font = Font(name=font_family, size=10, bold=True, color="FFFFFF")
    bold_font = Font(name=font_family, size=10, bold=True, color="0F172A")
    regular_font = Font(name=font_family, size=10, color="0F172A")
    small_font = Font(name=font_family, size=9, color="64748B")

    # Fills
    navy_fill = PatternFill(start_color=c_navy, end_color=c_navy, fill_type="solid")
    blue_fill = PatternFill(start_color=c_blue, end_color=c_blue, fill_type="solid")
    dark_fill = PatternFill(start_color=c_slate_dark, end_color=c_slate_dark, fill_type="solid")
    zebra_fill = PatternFill(start_color=c_slate_light, end_color=c_slate_light, fill_type="solid")
    white_fill = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")

    # Status Fills & Fonts
    status_done_fill = PatternFill(start_color=c_green_fill, end_color=c_green_fill, fill_type="solid")
    status_done_font = Font(name=font_family, size=10, bold=True, color=c_green_text)

    status_prog_fill = PatternFill(start_color=c_yellow_fill, end_color=c_yellow_fill, fill_type="solid")
    status_prog_font = Font(name=font_family, size=10, bold=True, color=c_yellow_text)

    status_none_fill = PatternFill(start_color=c_gray_fill, end_color=c_gray_fill, fill_type="solid")
    status_none_font = Font(name=font_family, size=10, color=c_gray_text)

    priority_high_fill = PatternFill(start_color=c_red_fill, end_color=c_red_fill, fill_type="solid")
    priority_high_font = Font(name=font_family, size=10, bold=True, color=c_red_text)

    # Borders
    thin_border_side = Side(border_style="thin", color=c_border)
    grid_border = Border(left=thin_border_side, right=thin_border_side, top=thin_border_side, bottom=thin_border_side)
    thick_bottom_border = Border(left=thin_border_side, right=thin_border_side, top=thin_border_side, bottom=Side(border_style="medium", color=c_navy))

    # Alignments
    align_center = Alignment(horizontal="center", vertical="center", wrap_text=True)
    align_left = Alignment(horizontal="left", vertical="center", wrap_text=True)
    align_right = Alignment(horizontal="right", vertical="center")

    # =========================================================================
    # SHEET 1: TỔNG QUAN & DASHBOARD QUẢN TRỊ (Tong_Quan_Dashboard)
    # =========================================================================
    ws1 = wb.active
    ws1.title = "Tong_Quan_Dashboard"
    ws1.views.sheetView[0].showGridLines = True

    # Title Banner
    ws1.merge_cells("A1:H2")
    ws1["A1"] = "DỰ ÁN VĂN PHÒNG ĐIỆN TỬ QCET E-OFFICE - BẢNG ĐIỀU HÀNH & TỔNG QUAN HỆ THỐNG"
    ws1["A1"].font = title_font
    ws1["A1"].fill = navy_fill
    ws1["A1"].alignment = Alignment(horizontal="center", vertical="center")

    ws1.merge_cells("A3:H3")
    ws1["A3"] = "Chủ đầu tư: Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (QCET) | Đơn vị chủ trì: Đội ngũ Kỹ thuật Nội bộ | Phiên bản: 2026.09"
    ws1["A3"].font = subtitle_font
    ws1["A3"].fill = dark_fill
    ws1["A3"].alignment = Alignment(horizontal="center", vertical="center")

    # Section 1: KPI Cards / Executive Stat Strip
    ws1["A5"] = "1. BẢNG SO SÁNH HIỆU QUẢ TÀI CHÍNH & TỰ CHỦ CÔNG NGHỆ"
    ws1["A5"].font = sec_hdr_font

    stat_headers = ["Phương án Triển khai", "Đơn vị cung cấp", "Chi phí Bản quyền", "Chi phí Triển khai & Cài đặt", "Tổng chi phí Ban đầu", "Phí duy trì hàng năm", "Đặc thù Trường nghề (DACUM)", "Đánh giá"]
    for col_idx, h in enumerate(stat_headers, 1):
        cell = ws1.cell(row=6, column=col_idx, value=h)
        cell.font = tbl_hdr_font
        cell.fill = blue_fill
        cell.alignment = align_center
        cell.border = grid_border

    financial_data = [
        ["Gói Cloud (1 Năm)", "1Office", 221000000, 20000000, "=C7+D7", 221000000, "Không (Đóng gói doanh nghiệp)", "Tốn kém hàng năm, phụ thuộc cloud ngoài"],
        ["Gói Private Cloud (3 Năm)", "1Office", 648000000, 70000000, "=C8+D8", 77760000, "Không (Chỉnh sửa tính phí cao)", "Chi phí quá lớn cho 300 users"],
        ["Gói Mua đứt Vĩnh viễn", "VSS PortalOffice 10", 720000000, 200000000, "=C9+D9", 0, "Hạn chế (Khung hành chính chung)", "Gần 1 tỷ đồng (chưa gồm server, SQL Server)"],
        ["HỆ THỐNG TỰ PHÁT TRIỂN (QCET)", "Nội bộ Trường QCET", 0, 0, "=C10+D10", 0, "Tương thích 100% (May đo DACUM)", "TIẾT KIỆM GẦN 1 TỶ ĐỒNG - TỰ CHỦ HOÀN TOÀN"]
    ]

    for row_idx, row_data in enumerate(financial_data, 7):
        is_highlight = (row_idx == 10)
        for col_idx, val in enumerate(row_data, 1):
            cell = ws1.cell(row=row_idx, column=col_idx, value=val)
            cell.border = grid_border
            if is_highlight:
                cell.font = Font(name=font_family, size=10, bold=True, color="166534")
                cell.fill = PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid")
            else:
                cell.font = regular_font
                if row_idx % 2 == 0:
                    cell.fill = zebra_fill

            if col_idx in [3, 4, 5, 6]:
                cell.number_format = '#,##0 "VNĐ"'
                cell.alignment = align_right
            elif col_idx in [1, 2, 7, 8]:
                cell.alignment = align_left if col_idx in [7, 8] else align_center

    # Section 2: Summary of Progress by Module
    ws1["A12"] = "2. TỔNG HỢP HIỆN TRẠNG PHÁT TRIỂN THEO PHÂN HỆ"
    ws1["A12"].font = sec_hdr_font

    mod_summary_headers = ["Mã", "Tên Phân hệ Nghiệp vụ", "Tổng số Chức năng", "Đã hoàn thành (Phase 1)", "Đang phát triển", "Chưa phát triển (Phase 2 & 3)", "Tỷ lệ Hoàn thành", "Đánh giá mức độ hoàn thiện"]
    for col_idx, h in enumerate(mod_summary_headers, 1):
        cell = ws1.cell(row=13, column=col_idx, value=h)
        cell.font = tbl_hdr_font
        cell.fill = navy_fill
        cell.alignment = align_center
        cell.border = grid_border

    modules_stats = [
        ["MOD-01", "Quản lý Công việc & Dự án (Task Hub)", 8, 7, 1, 0, "=D14/C14", "Đã hoàn thành 88% - Sẵn sàng vận hành thử nghiệm"],
        ["MOD-02", "Quản lý Văn bản & Công văn (EdXML)", 7, 0, 0, 7, "=D15/C15", "Chưa triển khai (Kế hoạch trọng tâm Phase 2)"],
        ["MOD-03", "Trình ký & Ký số Điện tử (SmartCA)", 7, 0, 0, 7, "=D16/C16", "Chưa triển khai (Kế hoạch trọng tâm Phase 2)"],
        ["MOD-04", "Lịch cơ quan & Điều phối Phòng họp", 6, 2, 1, 3, "=D17/C17", "Đạt 33% (Đã có Lịch học vụ/công tác, thiếu đặt phòng/xe)"],
        ["MOD-05", "Kho Tài liệu số & Biểu mẫu dùng chung", 5, 0, 0, 5, "=D18/C18", "Chưa triển khai (Phase 2)"],
        ["MOD-06", "Truyền thông & Trao đổi nội bộ", 4, 1, 0, 3, "=D19/C19", "Đạt 25% (Đã có comment task, thiếu Chat/News)"],
        ["MOD-07", "Quản lý Văn phòng phẩm & Vật tư", 3, 0, 0, 3, "=D20/C20", "Chưa triển khai (Phase 3 mở rộng)"],
        ["MOD-08", "Trục liên thông & Tích hợp ngoài", 3, 0, 0, 3, "=D21/C21", "Chưa triển khai (Kết nối khi Tỉnh cấp phép)"],
        ["MOD-09", "Ứng dụng Di động (Mobile App)", 3, 1, 0, 2, "=D22/C22", "Đạt 33% (Giao diện Web Responsive mượt mà)"],
        ["MOD-10", "Quản trị Hệ thống, Phân quyền & Bảo mật", 4, 2, 1, 1, "=D23/C23", "Đạt 50% (Đã có RBAC, Auth, Org Tree)"]
    ]

    for row_idx, row_data in enumerate(modules_stats, 14):
        for col_idx, val in enumerate(row_data, 1):
            cell = ws1.cell(row=row_idx, column=col_idx, value=val)
            cell.border = grid_border
            cell.font = regular_font
            if row_idx % 2 == 1:
                cell.fill = zebra_fill

            if col_idx in [1, 3, 4, 5, 6]:
                cell.alignment = align_center
            elif col_idx == 7:
                cell.number_format = '0.0%'
                cell.alignment = align_right
                cell.font = bold_font
            else:
                cell.alignment = align_left

    # Total Row
    tot_row = 24
    ws1.cell(row=tot_row, column=1, value="TỔNG").font = bold_font
    ws1.cell(row=tot_row, column=1).alignment = align_center
    ws1.cell(row=tot_row, column=1).border = thick_bottom_border
    ws1.cell(row=tot_row, column=1).fill = PatternFill(start_color="E2E8F0", end_color="E2E8F0", fill_type="solid")

    ws1.cell(row=tot_row, column=2, value="Toàn bộ 10 Phân hệ Hệ thống").font = bold_font
    ws1.cell(row=tot_row, column=2).alignment = align_left
    ws1.cell(row=tot_row, column=2).border = thick_bottom_border
    ws1.cell(row=tot_row, column=2).fill = PatternFill(start_color="E2E8F0", end_color="E2E8F0", fill_type="solid")

    ws1.cell(row=tot_row, column=3, value="=SUM(C14:C23)").font = bold_font
    ws1.cell(row=tot_row, column=3).alignment = align_center
    ws1.cell(row=tot_row, column=3).border = thick_bottom_border
    ws1.cell(row=tot_row, column=3).fill = PatternFill(start_color="E2E8F0", end_color="E2E8F0", fill_type="solid")

    ws1.cell(row=tot_row, column=4, value="=SUM(D14:D23)").font = bold_font
    ws1.cell(row=tot_row, column=4).alignment = align_center
    ws1.cell(row=tot_row, column=4).border = thick_bottom_border
    ws1.cell(row=tot_row, column=4).fill = PatternFill(start_color="E2E8F0", end_color="E2E8F0", fill_type="solid")

    ws1.cell(row=tot_row, column=5, value="=SUM(E14:E23)").font = bold_font
    ws1.cell(row=tot_row, column=5).alignment = align_center
    ws1.cell(row=tot_row, column=5).border = thick_bottom_border
    ws1.cell(row=tot_row, column=5).fill = PatternFill(start_color="E2E8F0", end_color="E2E8F0", fill_type="solid")

    ws1.cell(row=tot_row, column=6, value="=SUM(F14:F23)").font = bold_font
    ws1.cell(row=tot_row, column=6).alignment = align_center
    ws1.cell(row=tot_row, column=6).border = thick_bottom_border
    ws1.cell(row=tot_row, column=6).fill = PatternFill(start_color="E2E8F0", end_color="E2E8F0", fill_type="solid")

    ws1.cell(row=tot_row, column=7, value="=D24/C24").font = bold_font
    ws1.cell(row=tot_row, column=7).alignment = align_right
    ws1.cell(row=tot_row, column=7).number_format = '0.0%'
    ws1.cell(row=tot_row, column=7).border = thick_bottom_border
    ws1.cell(row=tot_row, column=7).fill = PatternFill(start_color="E2E8F0", end_color="E2E8F0", fill_type="solid")

    ws1.cell(row=tot_row, column=8, value="Giai đoạn 1 (Nền tảng Quản lý công việc) cơ bản hoàn thiện").font = bold_font
    ws1.cell(row=tot_row, column=8).alignment = align_left
    ws1.cell(row=tot_row, column=8).border = thick_bottom_border
    ws1.cell(row=tot_row, column=8).fill = PatternFill(start_color="E2E8F0", end_color="E2E8F0", fill_type="solid")

    # =========================================================================
    # SHEET 2: ĐẶC TẢ CHI TIẾT TOÀN BỘ CHỨC NĂNG (Dac_Ta_Chi_Tiet_Chuc_Nang)
    # =========================================================================
    ws2 = wb.create_sheet(title="Dac_Ta_Chi_Tiet_Chuc_Nang")
    ws2.views.sheetView[0].showGridLines = True

    # Title Banner
    ws2.merge_cells("A1:K2")
    ws2["A1"] = "BẢNG ĐẶC TẢ CHI TIẾT TOÀN BỘ TÍNH NĂNG HỆ THỐNG QCET E-OFFICE"
    ws2["A1"].font = title_font
    ws2["A1"].fill = navy_fill
    ws2["A1"].alignment = Alignment(horizontal="center", vertical="center")

    headers_ws2 = [
        "Mã Chức năng",
        "Phân hệ Nghiệp vụ",
        "Tên Chức năng",
        "Đặc tả Nghiệp vụ & Quy tắc Xử lý (Business Logic)",
        "Vai trò Sử dụng (Actors)",
        "Giai đoạn (Phase)",
        "Hiện trạng QCET",
        "1Office So sánh",
        "VSS PortalOffice So sánh",
        "Mức Ưu tiên",
        "Ghi chú Kỹ thuật & Tích hợp"
    ]

    for col_idx, h in enumerate(headers_ws2, 1):
        cell = ws2.cell(row=3, column=col_idx, value=h)
        cell.font = tbl_hdr_font
        cell.fill = dark_fill
        cell.alignment = align_center
        cell.border = grid_border

    features_master = [
        # MOD-01: Quản lý Công việc & Dự án
        [
            "TASK-01", "1. Quản lý Công việc", "Giao việc đa cấp & Phân nhiệm",
            "Ban Giám hiệu giao việc cho Trưởng phòng/khoa; Trưởng đơn vị giao tiếp cho Phó phòng/Bộ môn và Giảng viên/Chuyên viên. Hỗ trợ xác định người chủ trì chính và người phối hợp thực hiện.",
            "BGH, Trưởng đơn vị, Giảng viên, Chuyên viên", "Phase 1", "Đã hoàn thành", "Có sẵn", "Có sẵn", "Cao (P1)", "Đã có UnifiedTaskHub, DelegationAuthorityEngine"
        ],
        [
            "TASK-02", "1. Quản lý Công việc", "Giao việc đột xuất & Định kỳ",
            "Thiết lập công việc phát sinh khẩn hoặc chu kỳ định kỳ (hàng tuần, tháng, học kỳ). Hỗ trợ đặt độ khẩn cấp (Khẩn, Thượng khẩn, Hỏa tốc), thời hạn Deadline, nhắc việc tự động.",
            "BGH, Trưởng đơn vị", "Phase 1", "Đã hoàn thành", "Có sẵn", "Có sẵn", "Cao (P1)", "Hỗ trợ SLA & Deadline tracking"
        ],
        [
            "TASK-03", "1. Quản lý Công việc", "Theo dõi Tiến độ & Đánh giá %",
            "Cập nhật % tiến độ thực hiện công việc, lý do chậm trễ nếu quá hạn. Tự động chuyển đổi trạng thái: Chưa bắt đầu -> Đang thực hiện -> Chờ duyệt -> Hoàn thành.",
            "Tất cả cán bộ, viên chức", "Phase 1", "Đã hoàn thành", "Có sẵn", "Có sẵn", "Cao (P1)", "CascadingTaskTable & Progress Bar"
        ],
        [
            "TASK-04", "1. Quản lý Công việc", "Trao đổi & Phản hồi theo Ngữ cảnh",
            "Bình luận, trao đổi ý kiến nghiệp vụ trực tiếp trong từng đầu việc. Đính kèm tệp minh chứng sản phẩm (PDF, Word, Excel, ảnh), tránh trao đổi tản mát qua Zalo.",
            "Người giao & Người nhận việc", "Phase 1", "Đã hoàn thành", "Có sẵn", "Có sẵn", "Cao (P1)", "TaskDetailSideSheet & Feed Widget"
        ],
        [
            "TASK-05", "1. Quản lý Công việc", "Ma trận Tiến độ Điều hành BGH",
            "Bảng tổng hợp ma trận tiến độ thời gian thực của toàn bộ các Phòng, Khoa, Trung tâm. Lọc theo tỷ lệ trễ hạn, khối lượng việc đang tồn, giúp Lãnh đạo phát hiện điểm nghẽn.",
            "Ban Giám hiệu, Chánh Văn phòng", "Phase 1", "Đã hoàn thành", "Chưa tối ưu (Dashboard chung)", "Dạng báo cáo tĩnh", "Cao (P1)", "DepartmentProgressMatrix component"
        ],
        [
            "TASK-06", "1. Quản lý Công việc", "Ủy quyền Nghiệp vụ Đặc thù (DACUM)",
            "Cơ chế ủy quyền điều hành khi lãnh đạo đi công tác hoặc phân quyền tổ trưởng chuyên môn xây dựng chuẩn đầu ra nghề nghiệp (DACUM), thẩm định chương trình giáo dục nghề nghiệp.",
            "BGH, Trưởng khoa, Tổ trưởng DACUM", "Phase 1", "Đã hoàn thành", "Không có (Đòi code thêm)", "Không có (Đòi code thêm)", "Cao (P1)", "DacumWorkflowEngine & DelegationModal"
        ],
        [
            "TASK-07", "1. Quản lý Công việc", "Giao diện Kanban & Bộ lọc Đa chiều",
            "Xem công việc theo dạng bảng thẻ Kanban (Kéo thả chuyển trạng thái) hoặc Dạng bảng chi tiết. Bộ lọc thông minh theo phòng ban, trạng thái, độ ưu tiên, người phụ trách.",
            "Tất cả nhân sự", "Phase 1", "Đã hoàn thành", "Có sẵn", "Có sẵn", "Trung bình (P2)", "TaskKanbanBoard & SimplifiedTaskFilterBar"
        ],
        [
            "TASK-08", "1. Quản lý Công việc", "Cơ chế Lưu trữ CSDL PostgreSQL",
            "Hiện thực hóa schema lưu trữ toàn bộ dữ liệu công việc, nhật ký phân công, người phối hợp vào PostgreSQL qua Prisma ORM thay thế mock data hiện tại.",
            "Hệ thống / Backend", "Phase 1", "Đang phát triển", "Có sẵn (MariaDB)", "Có sẵn (SQL Server)", "Cao (P1)", "Cần hoàn thiện prisma schema migration"
        ],

        # MOD-02: Quản lý Văn bản & Công văn
        [
            "DOC-01", "2. Quản lý Văn bản", "Tiếp nhận & Vào sổ Văn bản Đến",
            "Tiếp nhận công văn từ bưu điện, email công vụ, scan văn bản giấy. Cấp số đến tự động, trích yếu, ngày ban hành, nơi gửi, đính kèm tệp PDF văn bản gốc.",
            "Văn thư trường, Chánh Văn phòng", "Phase 2", "Chưa phát triển", "Có sẵn", "Có sẵn", "Cao (P1)", "Theo Thông tư 02/2019/TT-BNV"
        ],
        [
            "DOC-02", "2. Quản lý Văn bản", "Quy trình Bút phê & Phân phối Văn bản",
            "Văn thư trình Lãnh đạo / Chánh Văn phòng ➔ Lãnh đạo ghi bút phê điện tử (Chỉ đạo xử lý, hạn hoàn thành) ➔ Tự động chuyển việc về Phòng/Khoa chủ trì và phối hợp.",
            "BGH, Chánh VP, Trưởng phòng/khoa", "Phase 2", "Chưa phát triển", "Có sẵn", "Có sẵn", "Cao (P1)", "Liên kết tự động tạo Task trong Task Hub"
        ],
        [
            "DOC-03", "2. Quản lý Văn bản", "Quản lý Dự thảo & Luân chuyển Văn bản Đi",
            "Chuyên viên/Giảng viên soạn thảo dự thảo công văn, quyết định ➔ Luân chuyển các cấp đóng góp ý kiến ➔ Lưu vết lịch sử chỉnh sửa (Redline) qua từng phiên bản.",
            "Chuyên viên, Lãnh đạo duyệt", "Phase 2", "Chưa phát triển", "Có sẵn", "Có sẵn", "Cao (P1)", "Hỗ trợ xem trực tuyến file PDF/DOCX"
        ],
        [
            "DOC-04", "2. Quản lý Văn bản", "Ban hành Văn bản Đi & Đóng số",
            "Sau khi Lãnh đạo ký duyệt, Văn thư cấp số văn bản đi chính thức, đóng dấu mộc (hoặc dấu số), lưu trữ vào sổ văn bản đi và phát hành nội bộ hoặc gửi ra ngoài.",
            "Văn thư trường, BGH", "Phase 2", "Chưa phát triển", "Có sẵn", "Có sẵn", "Cao (P1)", "Quy định thể thức chuẩn NĐ 30/2020/NĐ-CP"
        ],
        [
            "DOC-05", "2. Quản lý Văn bản", "Quản lý Văn bản Nội bộ (Thông báo, Quyết định)",
            "Phân loại riêng các văn bản chỉ có hiệu lực nội bộ trường (Thông báo học vụ, Quyết định bổ nhiệm, Quy chế chi tiêu nội bộ). Phân quyền truy cập theo từng đối tượng.",
            "Toàn thể cán bộ, giảng viên", "Phase 2", "Chưa phát triển", "Có sẵn", "Có sẵn", "Trung bình (P2)", "Phân loại theo Thư mục & Quyền hạn"
        ],
        [
            "DOC-06", "2. Quản lý Văn bản", "In Sổ Văn bản theo Chuẩn Nghị định 30",
            "Tự động kết xuất và in sổ đăng ký văn bản đến, sổ đăng ký văn bản đi, sổ đăng ký chỉ đạo điều hành đúng mẫu quy định của Cục Văn thư và Lưu trữ Nhà nước.",
            "Văn thư trường", "Phase 2", "Chưa phát triển", "Có sẵn", "Có sẵn", "Trung bình (P2)", "Xuất file Excel/PDF định dạng sẵn"
        ],
        [
            "DOC-07", "2. Quản lý Văn bản", "Sổ Quản lý Thư chuyển phát EMS",
            "Số hóa sổ nhận thư bảo đảm, thư chuyển phát nhanh đến trường. Khi nhập thư vào hệ thống, tự động gửi thông báo đến cá nhân người nhận để bấm xác nhận đã lấy thư.",
            "Văn thư, Cán bộ nhận thư", "Phase 2", "Chưa phát triển", "Chưa có", "Có sẵn", "Thấp (P3)", "Tính năng tiện ích theo E-HSMT"
        ],

        # MOD-03: Trình ký & Ký số Điện tử
        [
            "SIGN-01", "3. Trình ký & Ký số", "Thiết lập Quy trình Trình ký Động",
            "Cho phép Quản trị tạo các luồng trình ký linh hoạt theo đơn vị: Trình ký tuần tự (Step-by-step), trình ký song song, hoặc rẽ nhánh tùy theo giá trị/loại văn bản.",
            "Quản trị viên, Trưởng đơn vị", "Phase 2", "Chưa phát triển", "Có sẵn", "Có sẵn", "Cao (P1)", "Workflow Engine hỗ trợ sơ đồ trạng thái"
        ],
        [
            "SIGN-02", "3. Trình ký & Ký số", "Phân quyền Luồng Đảng - Chính quyền - Đoàn thể",
            "Tách biệt độc lập luồng trình ký của Khối Chính quyền (Hiệu trưởng), Khối Đảng ủy (Bí thư), Khối Công đoàn trên cùng một tài khoản người dùng duy nhất.",
            "Đảng ủy, BGH, Công đoàn", "Phase 2", "Chưa phát triển", "Hạn chế", "Có sẵn", "Cao (P1)", "Đặc thù bắt buộc trong E-HSMT trường công"
        ],
        [
            "SIGN-03", "3. Trình ký & Ký số", "Lập & Theo dõi Phiếu trình Điện tử",
            "Chuyên viên tạo Phiếu trình giải quyết công việc, đính kèm tờ trình và tài liệu liên quan, theo dõi phiếu đang ở giai đoạn nào, cấp nào đang giữ.",
            "Chuyên viên, Lãnh đạo các cấp", "Phase 2", "Chưa phát triển", "Có sẵn", "Có sẵn", "Cao (P1)", "Audit trail ghi lại từng giây phê duyệt"
        ],
        [
            "SIGN-04", "3. Trình ký & Ký số", "Chức năng Ký nháy Điện tử",
            "Cho phép Trưởng bộ môn, Phó phòng, Trưởng khoa ký nháy xác nhận tính đúng đắn của văn bản trước khi đẩy lên Lãnh đạo cấp cao hơn ký chính.",
            "Cấp quản lý trung gian", "Phase 2", "Chưa phát triển", "Có sẵn", "Module thêm 100tr", "Cao (P1)", "Chèn ảnh chữ ký nháy + Metadata kiểm tra"
        ],
        [
            "SIGN-05", "3. Trình ký & Ký số", "Ký số Chính thức & Đóng dấu Mộc (HSM/CA)",
            "Tích hợp Chữ ký số công vụ (Ban Cơ yếu) hoặc Dịch vụ chữ ký số từ xa SmartCA (VNPT/Viettel). Ký số hợp chuẩn PKCS#7 / PAdES vào file PDF có giá trị pháp lý.",
            "Ban Giám hiệu, Văn thư đóng mộc", "Phase 2", "Chưa phát triển", "Tích hợp VNPT", "Module thêm 100tr", "Cao (P1)", "OpenSSL / Node.js node-signpdf / VNPT SDK"
        ],
        [
            "SIGN-06", "3. Trình ký & Ký số", "Ký duyệt trên Di động (Sinh trắc học / PIN)",
            "Lãnh đạo đi công tác có thể mở điện thoại, xem trước văn bản và duyệt ký số bằng vân tay / FaceID hoặc mã PIN bảo mật 2 lớp OTP.",
            "Ban Giám hiệu", "Phase 2", "Chưa phát triển", "Có sẵn app", "Có sẵn app", "Cao (P1)", "WebAuthn / App Native Integration"
        ],
        [
            "SIGN-07", "3. Trình ký & Ký số", "Báo cáo Thống kê Thời gian Duyệt (SLA)",
            "Thống kê thời gian xử lý phiếu trình của từng đơn vị/cá nhân, tỷ lệ đúng hạn/trễ hạn, phát hiện khâu ngâm hồ sơ quá quy định.",
            "BGH, Thanh tra đào tạo", "Phase 2", "Chưa phát triển", "Có sẵn", "Có sẵn", "Trung bình (P2)", "Báo cáo biểu đồ cột / xuất Excel"
        ],

        # MOD-04: Lịch cơ quan & Điều phối Phòng họp
        [
            "CAL-01", "4. Quản lý Lịch", "Lịch Tuần Công tác Cơ quan",
            "Đăng ký và tổng hợp lịch công tác tuần của Ban Giám hiệu và các Phòng/Khoa. Hiển thị rõ: Thứ, ngày, giờ, người chủ trì, nội dung, thành phần, địa điểm.",
            "BGH, Văn phòng trường, Toàn trường", "Phase 1", "Đã hoàn thành", "Có sẵn", "Có sẵn", "Cao (P1)", "Đã có CalendarMonthView & AcademicCalendar"
        ],
        [
            "CAL-02", "4. Quản lý Lịch", "Đăng ký & Điều phối Phòng họp (Chống trùng)",
            "Đăng ký sử dụng phòng họp (Hội trường lớn, Phòng họp A, B...). Hệ thống tự động kiểm tra trùng giờ/trùng phòng; Phòng Hành chính duyệt cấp phòng.",
            "Cán bộ đăng ký, Phòng Hành chính", "Phase 1", "Chưa phát triển", "Có sẵn", "Có sẵn", "Cao (P1)", "Cần thuật toán chống xung đột tài nguyên"
        ],
        [
            "CAL-03", "4. Quản lý Lịch", "Lịch Xe Công tác & Điều xe",
            "Đăng ký nhu cầu xe công vụ đưa đón cán bộ đi hội nghị, công tác tuyển sinh, đưa sinh viên đi thực tập. Duyệt lệnh điều xe và quản lý tài xế.",
            "Đơn vị đề xuất, Đội xe, Hành chính", "Phase 3", "Chưa phát triển", "Gói xe riêng", "Có sẵn", "Trung bình (P2)", "Tính năng tiện ích theo VSS PortalOffice"
        ],
        [
            "CAL-04", "4. Quản lý Lịch", "Chế độ Trình chiếu TV Sảnh Đón tiếp",
            "Giao diện Fullscreen chuyên dụng tự động hiển thị lịch họp 2-3 ngày liên tiếp trên màn hình LED/TV tại sảnh chính đón tiếp đại biểu và giáo viên.",
            "Văn phòng trường, Khách đến trường", "Phase 1", "Chưa phát triển", "Chưa có", "Có sẵn", "Trung bình (P2)", "Màn hình Kiosk mode tự động làm mới"
        ],
        [
            "CAL-05", "4. Quản lý Lịch", "Xuất Lịch Tuần ra File Word / In ấn",
            "Bấm 1 nút tự động xuất toàn bộ lịch tuần ra file Word (.docx) đúng theo thể thức văn bản hành chính của trường để in phát hành bản giấy.",
            "Văn phòng trường", "Phase 1", "Đang phát triển", "Chưa có", "Có sẵn", "Cao (P1)", "Dùng thư viện docx-templates"
        ],
        [
            "CAL-06", "4. Quản lý Lịch", "Nhắc Lịch tự động qua In-App & Email/SMS",
            "Tự động gửi thông báo in-app và email trước 15-30 phút cho toàn bộ thành phần tham gia cuộc họp kèm tài liệu họp đính kèm.",
            "Người tham gia cuộc họp", "Phase 1", "Chưa phát triển", "Có sẵn", "SMS Brandname", "Trung bình (P2)", "Cron Job & Notification Engine"
        ],

        # MOD-05: Kho Tài liệu số & Biểu mẫu dùng chung
        [
            "REP-01", "5. Kho Tài liệu số", "Quản lý Cây Thư mục Phân quyền Chi tiết",
            "Cây thư mục lưu trữ tài liệu phân quyền nhiều cấp (Toàn trường, Phòng ban, Bộ môn, Dự án). Kiểm soát quyền: Xem, Tải về, Sửa, Xóa đến từng cá nhân.",
            "Toàn thể nhân sự", "Phase 2", "Chưa phát triển", "Có sẵn", "Có sẵn", "Cao (P1)", "Storage backend MinIO / S3 tương thích"
        ],
        [
            "REP-02", "5. Kho Tài liệu số", "Quản lý Phiên bản & Lịch sử Soát xét",
            "Tự động lưu trữ các version (v1.0, v1.1...) khi tài liệu được cập nhật. Cảnh báo định kỳ khi các văn bản quy chế, chương trình đào tạo sắp hết hiệu lực.",
            "Trưởng đơn vị, Ban Pháp chế", "Phase 2", "Chưa phát triển", "Có sẵn", "Có sẵn", "Trung bình (P2)", "Versioning pattern & Audit trail"
        ],
        [
            "REP-03", "5. Kho Tài liệu số", "Đóng dấu Bản quyền (Watermark PDF)",
            "Khi người dùng tải tài liệu mật/nội bộ, hệ thống tự động chèn chìm họ tên, email, thời gian tải lên từng trang PDF để chống rò rỉ thông tin ra ngoài.",
            "Hệ thống tự động", "Phase 2", "Chưa phát triển", "Có sẵn", "Có sẵn", "Cao (P1)", "Dùng pdf-lib hoặc LibreOffice để render watermark"
        ],
        [
            "REP-04", "5. Kho Tài liệu số", "Nhận dạng Chữ viết OCR Văn bản Scan",
            "Tự động quét và nhận dạng chữ tiếng Việt từ file scan/ảnh chụp (sử dụng Tesseract OCR) để hỗ trợ tìm kiếm toàn văn (Full-text Search) nội dung tài liệu.",
            "Văn thư, Người tra cứu", "Phase 3", "Chưa phát triển", "Có sẵn (Tesseract)", "Chưa có", "Trung bình (P2)", "Tesseract OCR / PDFTextExtractor"
        ],
        [
            "REP-05", "5. Kho Tài liệu số", "Kho Biểu mẫu & Giáo trình Dùng chung",
            "Nơi tải nhanh các mẫu tờ trình, mẫu giáo án, mẫu kế hoạch bài giảng, biên bản đánh giá rèn luyện sinh viên theo chuẩn kiểm định trường nghề.",
            "Giảng viên, Chuyên viên", "Phase 2", "Chưa phát triển", "Có sẵn", "Có sẵn", "Cao (P1)", "Danh mục biểu mẫu chuẩn hóa"
        ],

        # MOD-06: Truyền thông & Trao đổi nội bộ
        [
            "COM-01", "6. Truyền thông Nội bộ", "Tin nhắn Nội bộ Tức thời (Chat 1-1 & Nhóm)",
            "Kênh chat bảo mật nội bộ giữa các cán bộ, giảng viên thay thế Zalo cá nhân. Hỗ trợ gửi file dung lượng lớn, tìm kiếm tin nhắn, ghim thông báo quan trọng.",
            "Toàn thể nhân sự", "Phase 3", "Chưa phát triển", "Có sẵn", "Có sẵn", "Trung bình (P2)", "WebSocket / Socket.io realtime"
        ],
        [
            "COM-02", "6. Truyền thông Nội bộ", "Bảng tin tức Trường (E-News)",
            "Chuyên trang đăng tải thông báo chung, phong trào thi đua, hoạt động đoàn thể. Quy trình phê duyệt bài viết trước khi hiển thị lên trang chủ.",
            "Ban Tuyên giáo, Toàn trường", "Phase 3", "Chưa phát triển", "Có sẵn", "Có sẵn", "Thấp (P3)", "Rich Text Editor & Approval workflow"
        ],
        [
            "COM-03", "6. Truyền thông Nội bộ", "Danh bạ Điện tử Toàn trường",
            "Tra cứu thông tin liên lạc cán bộ, giảng viên: Họ tên, phòng ban, bộ môn, học hàm/học vị, số máy lẻ bàn, số di động, email trường.",
            "Toàn thể nhân sự", "Phase 1", "Đã hoàn thành", "Có sẵn", "Có sẵn", "Cao (P1)", "Đã có OrganizationTree & User Directory"
        ],
        [
            "COM-04", "6. Truyền thông Nội bộ", "Thông báo Khẩn & Popup Cảnh báo",
            "Cơ chế đẩy thông báo hỏa tốc (thông báo bão lũ, nghỉ đột xuất, việc khẩn BGH giao) hiển thị dạng Modal Popup bắt buộc người dùng xác nhận đã đọc.",
            "Ban Giám hiệu, Toàn trường", "Phase 1", "Đã hoàn thành", "Có sẵn", "Có sẵn", "Cao (P1)", "NotificationPopover & In-app Alert Center"
        ],

        # MOD-07: Quản lý Văn phòng phẩm & Vật tư
        [
            "AST-01", "7. Văn phòng phẩm & Vật tư", "Danh mục Văn phòng phẩm & Vật tư Xưởng",
            "Quản lý danh mục giấy in, bút, mực, trang thiết bị xưởng thực hành nghề kèm hình ảnh, đơn vị tính, đơn giá dự kiến và tồn kho lý thuyết.",
            "Phòng Quản trị - Thiết bị", "Phase 3", "Chưa phát triển", "Gói mở rộng", "Có sẵn", "Thấp (P3)", "CRUD danh mục tài sản tiêu hao"
        ],
        [
            "AST-02", "7. Văn phòng phẩm & Vật tư", "Quy trình Đề xuất & Phê duyệt Cấp phát",
            "Khoa/Phòng lập phiếu xin cấp phát VPP theo quý/học kỳ ➔ Trưởng khoa duyệt ➔ Phòng Quản trị duyệt ➔ Xuất kho cấp phát và ghi nhận vào sổ theo dõi.",
            "Khoa/Phòng đề xuất, QTTB", "Phase 3", "Chưa phát triển", "Gói mở rộng", "Có sẵn", "Thấp (P3)", "Form đề xuất & phê duyệt nhiều bước"
        ],
        [
            "AST-03", "7. Văn phòng phẩm & Vật tư", "Báo cáo Định mức Tiêu hao Đơn vị",
            "Thống kê chi phí văn phòng phẩm và vật tư đã cấp cho từng Khoa/Phòng trong năm, so sánh với định mức ngân sách được duyệt.",
            "BGH, Phòng Kế hoạch - Tài chính", "Phase 3", "Chưa phát triển", "Gói mở rộng", "Có sẵn", "Thấp (P3)", "Báo cáo tổng hợp chi tiêu nội bộ"
        ],

        # MOD-08: Trục liên thông & Tích hợp ngoài
        [
            "INT-01", "8. Trục liên thông & Tích hợp", "Trục Liên thông Văn bản Quốc gia / Tỉnh",
            "Kết nối API gửi/nhận công văn điện tử với Trục liên thông LGSP Tỉnh Bình Định và Trục Quốc gia theo chuẩn EdXML của Văn phòng Chính phủ.",
            "Văn thư trường, BGH", "Phase 2", "Chưa phát triển", "Tính phí cổng", "Module riêng 100tr", "Trung bình (P2)", "Kết nối khi Sở TT&TT Bình Định cấp phép"
        ],
        [
            "INT-02", "8. Trục liên thông & Tích hợp", "Đăng nhập Một lần (SSO Google Workspace)",
            "Cho phép cán bộ, giảng viên đăng nhập bằng tài khoản email trường `@qcet.edu.vn` (Google OAuth / SAML2), đồng bộ thông tin nhân sự tự động.",
            "Toàn thể nhân sự", "Phase 1", "Đã hoàn thành", "Có sẵn", "Có sẵn", "Cao (P1)", "Đã có Google Login Button & JWT Session"
        ],
        [
            "INT-03", "8. Trục liên thông & Tích hợp", "Đồng bộ Dữ liệu Đào tạo & Thời khóa biểu",
            "Cổng API mở để đồng bộ lịch giảng dạy từ phần mềm Quản lý Đào tạo vào Lịch cá nhân của giảng viên trên hệ thống E-Office.",
            "Phòng Đào tạo, Giảng viên", "Phase 3", "Chưa phát triển", "Chưa có", "Chưa có", "Trung bình (P2)", "REST API Endpoints"
        ],

        # MOD-09: Ứng dụng Di động
        [
            "MOB-01", "9. Ứng dụng Di động", "Mobile Task & Giao diện Responsive",
            "Giao diện chuẩn di động tối ưu hiển thị trên màn hình nhỏ (Smartphone/Tablet). Xem danh sách việc, nhận việc, nộp báo cáo tiến độ ngay trên điện thoại.",
            "Toàn thể nhân sự", "Phase 1", "Đã hoàn thành", "Có app native", "Có app native", "Cao (P1)", "Web Responsive chuẩn Tailwind v4"
        ],
        [
            "MOB-02", "9. Ứng dụng Di động", "Mobile Phê duyệt & Ký số Di động",
            "Lãnh đạo xem tài liệu đính kèm, bút phê công văn và thực hiện ký số trực tiếp trên thiết bị di động mà không cần mở máy tính xách tay.",
            "Ban Giám hiệu, Trưởng đơn vị", "Phase 2", "Chưa phát triển", "Có app native", "Có app native", "Cao (P1)", "Tích hợp Mobile Web PDF Viewer & Signer"
        ],
        [
            "MOB-03", "9. Ứng dụng Di động", "Đẩy Thông báo Tức thời (Push Notifications)",
            "Gửi thông báo Push Notification ra ngoài màn hình khóa điện thoại khi có công văn hỏa tốc, lịch họp thay đổi hoặc công việc bị quá hạn.",
            "Toàn thể nhân sự", "Phase 2", "Chưa phát triển", "Có app native", "Có app native", "Trung bình (P2)", "PWA Service Worker / Firebase Cloud Messaging"
        ],

        # MOD-10: Quản trị Hệ thống, Phân quyền & Bảo mật
        [
            "ADM-01", "10. Quản trị & Bảo mật", "Sơ đồ Cơ cấu Tổ chức Đa cấp",
            "Quản lý cây sơ đồ tổ chức trường: Ban Giám hiệu ➔ Các Phòng/Khoa ➔ Các Bộ môn/Tổ công tác ➔ Nhân sự trực thuộc kèm chức vụ rõ ràng.",
            "Quản trị viên, Phòng TCCB", "Phase 1", "Đã hoàn thành", "Có sẵn", "Có sẵn", "Cao (P1)", "Đã có OrganizationTree & Department models"
        ],
        [
            "ADM-02", "10. Quản trị & Bảo mật", "Phân quyền Vai trò Đa tầng (RBAC)",
            "Phân quyền ma trận vai trò: Ban Giám hiệu, Trưởng phòng/khoa, Phó phòng, Tổ trưởng bộ môn, Chuyên viên, Giảng viên, Văn thư, Quản trị hệ thống.",
            "Quản trị viên", "Phase 1", "Đã hoàn thành", "Có sẵn", "Có sẵn", "Cao (P1)", "Đã có UserRole & Permission contexts"
        ],
        [
            "ADM-03", "10. Quản trị & Bảo mật", "Nhật ký Hệ thống & Kiểm toán (Audit Logs)",
            "Ghi lại toàn bộ dấu vết lịch sử: Ai đăng nhập khi nào, ai xem/sửa/xóa tài liệu, ai phê duyệt/từ chối phiếu trình nhằm đảm bảo tính minh bạch, chống chối bỏ.",
            "Ban Giám hiệu, Quản trị viên", "Phase 2", "Chưa phát triển", "Có sẵn", "Có sẵn", "Cao (P1)", "Bảng audit_logs ghi nhận IP, Action, Timestamp"
        ],
        [
            "ADM-04", "10. Quản trị & Bảo mật", "Sao lưu Tự động & An toàn Thông tin",
            "Cơ chế tự động sao lưu dữ liệu cơ sở dữ liệu và tệp đính kèm hàng ngày lúc 23h ra ổ lưu trữ NAS hoặc Cloud. Tuân thủ cấp độ 2 An toàn thông tin.",
            "Quản trị viên / IT Trường", "Phase 2", "Chưa phát triển", "Có kịch bản", "Có kịch bản", "Cao (P1)", "Bash script backup PostgreSQL + Rsync Storage"
        ]
    ]

    for row_idx, r_data in enumerate(features_master, 4):
        status_val = r_data[6]
        priority_val = r_data[9]

        for col_idx, val in enumerate(r_data, 1):
            cell = ws2.cell(row=row_idx, column=col_idx, value=val)
            cell.border = grid_border
            cell.font = regular_font

            # Alternating fill
            if row_idx % 2 == 1:
                cell.fill = zebra_fill

            # Alignments
            if col_idx in [1, 5, 6, 7, 8, 9, 10]:
                cell.alignment = align_center
            else:
                cell.alignment = align_left

            # Status badge styling
            if col_idx == 7: # Hiện trạng QCET
                if status_val == "Đã hoàn thành":
                    cell.fill = status_done_fill
                    cell.font = status_done_font
                elif status_val == "Đang phát triển":
                    cell.fill = status_prog_fill
                    cell.font = status_prog_font
                else:
                    cell.fill = status_none_fill
                    cell.font = status_none_font

            # Priority badge styling
            if col_idx == 10: # Mức ưu tiên
                if "P1" in priority_val:
                    cell.fill = priority_high_fill
                    cell.font = priority_high_font
                elif "P2" in priority_val:
                    cell.fill = status_prog_fill
                    cell.font = status_prog_font

    # =========================================================================
    # SHEET 3: MA TRẬN SO SÁNH GIẢI PHÁP (Ma_Tran_So_Sanh_Giai_Phap)
    # =========================================================================
    ws3 = wb.create_sheet(title="Ma_Tran_So_Sanh_Giai_Phap")
    ws3.views.sheetView[0].showGridLines = True

    ws3.merge_cells("A1:E2")
    ws3["A1"] = "BẢNG SO SÁNH ĐỐI ĐẦU GIỮA CÁC GIẢI PHÁP VĂN PHÒNG ĐIỆN TỬ"
    ws3["A1"].font = title_font
    ws3["A1"].fill = navy_fill
    ws3["A1"].alignment = Alignment(horizontal="center", vertical="center")

    headers_ws3 = ["Tiêu chí So sánh", "1Office (PRO WORK)", "VSS PortalOffice 10", "QCET Tự Phát triển (Hiện tại)", "Phân tích Lợi thế cho Trường"]
    for col_idx, h in enumerate(headers_ws3, 1):
        cell = ws3.cell(row=3, column=col_idx, value=h)
        cell.font = tbl_hdr_font
        cell.fill = dark_fill
        cell.alignment = align_center
        cell.border = grid_border

    matrix_data = [
        ["1. Chi phí Bản quyền (License)", "648 triệu / 3 năm (giới hạn 300 user)", "720 triệu (mua đứt vĩnh viễn)", "0 ĐỒNG (Hoàn toàn miễn phí)", "Tiết kiệm ngay 700 - 900 triệu ngân sách đầu tư ban đầu"],
        ["2. Giới hạn Số lượng Tài khoản", "Tối đa 300 người dùng (thêm người phải mua thêm)", "Không giới hạn (Gói Unlimited)", "KHÔNG GIỚI HẠN (Phục vụ toàn bộ GV & Sinh viên)", "Dễ dàng mở rộng cho 5.000+ sinh viên/giảng viên không tốn thêm tiền"],
        ["3. Phí duy trì & Nâng cấp hàng năm", "12%/năm (~77 triệu/năm từ năm 2)", "Không có (nhưng tính phí hỗ trợ nếu lỗi)", "0 ĐỒNG (Đội ngũ IT trường chủ động)", "Không bị 'bắt làm con tin' bởi phí bảo trì định kỳ hàng năm"],
        ["4. Chi phí Bản quyền HĐH & CSDL", "Chạy Linux/Ubuntu (Miễn phí OS & DB)", "Windows Server + SQL Server (Tốn thêm 100-200tr)", "Linux + PostgreSQL / Docker (Miễn phí 100%)", "Tránh rủi ro bị phạt bản quyền phần mềm Microsoft"],
        ["5. Độ thích ứng Nghiệp vụ Trường nghề", "Kém (Đóng gói theo mô hình doanh nghiệp kinh doanh)", "Trung bình (Khung hành chính nhà nước chung chung)", "100% HOÀN HẢO (May đo theo chuẩn DACUM, trường nghề)", "Tự do chỉnh sửa quy trình đào tạo, xưởng thực hành, đồ án mà không mất phí"],
        ["6. Chi phí Chỉnh sửa Tính năng Mới", "Rất đắt (Theo man-month báo giá riêng)", "Rất đắt ('Chưa bao gồm chỉnh sửa phát sinh')", "HOÀN TOÀN MIỄN PHÍ (Code trực tiếp)", "Mọi yêu cầu từ Ban Giám hiệu được đáp ứng ngay trong vài ngày"],
        ["7. Tính Bảo mật & Toàn quyền Dữ liệu", "Lưu trên Cloud 1Office hoặc cài On-premise", "Cài On-premise tại trường", "TOÀN QUYỀN KIỂM SOÁT TẠI SERVER TRƯỜNG", "Dữ liệu mật, đề thi, nhân sự lưu tại trường, không lo rò rỉ ra ngoài"],
        ["8. Trục liên thông Văn bản Quốc gia", "Cần cấu hình kết nối API riêng", "Tính phí riêng 100.000.000 VNĐ", "TỰ CODE NỐI API MIỄN PHÍ KHI CÓ CÔNG VĂN SỞ", "Tiết kiệm trọn vẹn 100 triệu tiền mua module liên thông"]
    ]

    for row_idx, r_data in enumerate(matrix_data, 4):
        for col_idx, val in enumerate(r_data, 1):
            cell = ws3.cell(row=row_idx, column=col_idx, value=val)
            cell.border = grid_border
            cell.font = regular_font
            if row_idx % 2 == 1:
                cell.fill = zebra_fill
            if col_idx == 4:
                cell.font = bold_font
                cell.fill = PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid")
            if col_idx in [1]:
                cell.alignment = align_left
            elif col_idx in [2, 3, 4]:
                cell.alignment = align_center if len(val) < 40 else align_left
            else:
                cell.alignment = align_left

    # =========================================================================
    # SHEET 4: LỘ TRÌNH TRIỂN KHAI & BACKLOG (Lo_Trinh_Trien_Khai_Backlog)
    # =========================================================================
    ws4 = wb.create_sheet(title="Lo_Trinh_Trien_Khai_Backlog")
    ws4.views.sheetView[0].showGridLines = True

    ws4.merge_cells("A1:G2")
    ws4["A1"] = "KẾ HOẠCH PHÂN KỲ TRIỂN KHAI & DANH MỤC BACKLOG KỸ THUẬT"
    ws4["A1"].font = title_font
    ws4["A1"].fill = navy_fill
    ws4["A1"].alignment = Alignment(horizontal="center", vertical="center")

    headers_ws4 = ["Mã Sprint / Giai đoạn", "Tên Gói Công việc (Work Package)", "Chi tiết Hạng mục Cần làm", "Công nghệ Đề xuất (Tech Stack)", "Ước tính (Tuần)", "Trạng thái", "Mục tiêu Đầu ra (Deliverable)"]
    for col_idx, h in enumerate(headers_ws4, 1):
        cell = ws4.cell(row=3, column=col_idx, value=h)
        cell.font = tbl_hdr_font
        cell.fill = dark_fill
        cell.alignment = align_center
        cell.border = grid_border

    backlog_data = [
        # Giai đoạn 1
        ["PHASE 1 - SPRINT 1", "Nền tảng Quản lý Công việc", "Hoàn thiện giao diện Task Hub, Kanban, Ma trận BGH, Lọc thông minh", "Next.js 15, Tailwind v4, React 19", "2", "Đã hoàn thành", "Giao diện Task Hub & Executive Center chạy mượt mà"],
        ["PHASE 1 - SPRINT 2", "Lưu trữ CSDL Thực tế", "Tạo migration Prisma PostgreSQL lưu trữ Task, Delegation, Department vào CSDL", "Prisma ORM, PostgreSQL, Docker", "1.5", "Đang thực hiện", "Hệ thống lưu trữ vĩnh viễn không phụ thuộc Mock Data"],
        ["PHASE 1 - SPRINT 3", "Lịch Công tác & Đặt phòng", "Xây dựng form đăng ký phòng họp, thuật toán chống trùng giờ, xuất Word lịch tuần", "Next.js API, docx-templates", "2", "Sắp triển khai", "Lịch công tác tuần xuất file Word & kiểm tra phòng họp"],

        # Giai đoạn 2
        ["PHASE 2 - SPRINT 4", "Vào sổ Công văn Đến/Đi", "Xây dựng màn hình nhập sổ văn bản đến, cấp số văn bản, đính kèm tệp PDF công văn", "React Hook Form, Zod, PostgreSQL", "3", "Chưa bắt đầu", "Sổ công văn điện tử theo Nghị định 30/2020/NĐ-CP"],
        ["PHASE 2 - SPRINT 5", "Luồng Bút phê & Giao việc", "Lãnh đạo xem văn bản, ghi bút phê điện tử, tự động sinh Task phân về phòng ban", "Next.js Server Actions, UnifiedTaskHub", "2", "Chưa bắt đầu", "Văn bản đến tự động chuyển hóa thành nhiệm vụ thực thi"],
        ["PHASE 2 - SPRINT 6", "Quy trình Trình ký Động", "Thiết kế luồng trình ký tờ trình nhiều cấp (Chuyên viên -> Trưởng phòng -> BGH)", "State Machine, Prisma Workflow", "3", "Chưa bắt đầu", "Quy trình phê duyệt điện tử thay thế hoàn toàn giấy tờ"],
        ["PHASE 2 - SPRINT 7", "Tích hợp Ký số & Đóng dấu", "Tích hợp chữ ký số SmartCA / Token USB ký trực tiếp lên file PDF, chèn dấu mộc", "node-signpdf, pdf-lib, VNPT SmartCA", "3", "Chưa bắt đầu", "File PDF ký số hợp chuẩn có đầy đủ tính pháp lý"],
        ["PHASE 2 - SPRINT 8", "Kho Tài liệu & Watermark", "Cây thư mục lưu trữ tài liệu phân quyền, tự động đóng chìm watermark khi tải file", "MinIO Storage, PDF Watermark Engine", "2", "Chưa bắt đầu", "Kho tài liệu bảo mật chống chụp màn hình rò rỉ"],

        # Giai đoạn 3
        ["PHASE 3 - SPRINT 9", "Tin nhắn Nội bộ Realtime", "Xây dựng kênh chat công vụ nội bộ giữa các phòng ban và cá nhân", "Socket.io / WebSockets, Redis", "3", "Chưa bắt đầu", "Kênh trao đổi công việc thay thế Zalo cá nhân"],
        ["PHASE 3 - SPRINT 10", "Quản lý Văn phòng phẩm", "Danh mục VPP, quy trình đề xuất cấp phát vật tư thực hành xưởng nghề", "Next.js CRUD, PostgreSQL", "2", "Chưa bắt đầu", "Kiểm soát chi phí tiêu hao văn phòng phẩm"],
        ["PHASE 3 - SPRINT 11", "Đóng gói PWA & Mobile Push", "Cấu hình Progressive Web App (PWA) đẩy Push Notification ra màn hình điện thoại", "Web Push API, Service Workers", "2", "Chưa bắt đầu", "Trải nghiệm mượt mà như App Native trên iOS/Android"],
        ["PHASE 3 - SPRINT 12", "Trục liên thông LGSP Tỉnh", "Viết adapter kết nối EdXML sang Trục liên thông Sở TT&TT Bình Định", "EdXML Parser, SOAP/REST Client", "3", "Chưa bắt đầu", "Liên thông công văn điện tử trực tiếp với UBND Tỉnh"]
    ]

    for row_idx, r_data in enumerate(backlog_data, 4):
        status_val = r_data[5]
        for col_idx, val in enumerate(r_data, 1):
            cell = ws4.cell(row=row_idx, column=col_idx, value=val)
            cell.border = grid_border
            cell.font = regular_font
            if row_idx % 2 == 1:
                cell.fill = zebra_fill

            if col_idx in [1, 5, 6]:
                cell.alignment = align_center
            else:
                cell.alignment = align_left

            if col_idx == 6:
                if status_val == "Đã hoàn thành":
                    cell.fill = status_done_fill
                    cell.font = status_done_font
                elif status_val == "Đang thực hiện":
                    cell.fill = status_prog_fill
                    cell.font = status_prog_font
                else:
                    cell.fill = status_none_fill
                    cell.font = status_none_font

    # =========================================================================
    # COLUMN WIDTH AUTO-FIT & FORMATTING FOR ALL SHEETS
    # =========================================================================
    for sheet in wb.worksheets:
        for col in sheet.columns:
            max_len = 0
            col_letter = get_column_letter(col[0].column)
            # Skip title merge row in calculation
            for cell in col:
                if cell.row in [1, 2]:
                    continue
                if cell.value is not None:
                    # treat formula as modest length estimate
                    val_str = str(cell.value)
                    if val_str.startswith("="):
                        val_str = "123,456,789 VNĐ"
                    lines = val_str.split("\n")
                    for l in lines:
                        if len(l) > max_len:
                            max_len = len(l)
            # apply proportional padding with min and max bounds
            sheet.column_dimensions[col_letter].width = max(max_len + 4, 12)
            if sheet.column_dimensions[col_letter].width > 60:
                sheet.column_dimensions[col_letter].width = 60 # wrap text

    # Special adjustments for Sheet 2 (Dac_Ta_Chi_Tiet_Chuc_Nang)
    ws2.column_dimensions["A"].width = 14
    ws2.column_dimensions["B"].width = 24
    ws2.column_dimensions["C"].width = 30
    ws2.column_dimensions["D"].width = 55
    ws2.column_dimensions["E"].width = 28
    ws2.column_dimensions["F"].width = 14
    ws2.column_dimensions["G"].width = 18
    ws2.column_dimensions["H"].width = 16
    ws2.column_dimensions["I"].width = 22
    ws2.column_dimensions["J"].width = 15
    ws2.column_dimensions["K"].width = 40

    # Freeze panes
    ws1.freeze_panes = "A5"
    ws2.freeze_panes = "A4"
    ws3.freeze_panes = "A4"
    ws4.freeze_panes = "A4"

    output_path = "/Users/dnhhuy/Desktop/QCET_EOffice_Chi_Tiet_Toan_Bo_Chuc_Nang.xlsx"
    wb.save(output_path)
    print(f"Workbook successfully saved to: {output_path}")

if __name__ == "__main__":
    build_qcet_eoffice_excel()
