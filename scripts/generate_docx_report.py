import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import nsdecls, qn

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(f'<w:tcMar {nsdecls("w")}><w:top w:w="{top}" w:type="dxa"/><w:bottom w:w="{bottom}" w:type="dxa"/><w:left w:w="{left}" w:type="dxa"/><w:right w:w="{right}" w:type="dxa"/></w:tcMar>')
    tcPr.append(tcMar)

def create_qcet_report_docx():
    doc = docx.Document()

    # Page setup - A4, margins 2cm (top/bottom/right), 2.5cm (left) chuẩn NĐ 30
    section = doc.sections[0]
    section.page_width = Inches(8.27)
    section.page_height = Inches(11.69)
    section.top_margin = Inches(0.79)
    section.bottom_margin = Inches(0.79)
    section.left_margin = Inches(0.98)
    section.right_margin = Inches(0.79)

    # Set base font
    style = doc.styles['Normal']
    font = style.font
    font.name = 'Times New Roman'
    font.size = Pt(13)
    font.color.rgb = RGBColor(0, 0, 0)

    # 1. Header (Quốc hiệu, Tên trường) - Table 2 columns
    header_table = doc.add_table(rows=1, cols=2)
    header_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    header_table.autofit = False

    cell_left = header_table.cell(0, 0)
    cell_right = header_table.cell(0, 1)
    cell_left.width = Inches(3.2)
    cell_right.width = Inches(3.5)

    p_left = cell_left.paragraphs[0]
    p_left.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_left.paragraph_format.space_after = Pt(2)
    p_left.paragraph_format.line_spacing = 1.15
    run1 = p_left.add_run("UBND TỈNH BÌNH ĐỊNH\n")
    run1.font.size = Pt(11)
    run2 = p_left.add_run("TRƯỜNG CĐ KTCN QUY NHƠN\n")
    run2.bold = True
    run2.font.size = Pt(11)
    run3 = p_left.add_run("Số:       /BC-CNTT")
    run3.italic = True
    run3.font.size = Pt(11)

    p_right = cell_right.paragraphs[0]
    p_right.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_right.paragraph_format.space_after = Pt(2)
    p_right.paragraph_format.line_spacing = 1.15
    r_qh1 = p_right.add_run("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\n")
    r_qh1.bold = True
    r_qh1.font.size = Pt(11)
    r_qh2 = p_right.add_run("Độc lập - Tự do - Hạnh phúc\n")
    r_qh2.bold = True
    r_qh2.font.size = Pt(12)
    r_qh3 = p_right.add_run("Quy Nhơn, ngày 07 tháng 09 năm 2026")
    r_qh3.italic = True
    r_qh3.font.size = Pt(11)

    doc.add_paragraph()

    # 2. Main Title
    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_after = Pt(4)
    run_t = p_title.add_run("BÁO CÁO TỔNG QUAN")
    run_t.bold = True
    run_t.font.size = Pt(15)

    p_subtitle = doc.add_paragraph()
    p_subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_subtitle.paragraph_format.space_after = Pt(18)
    run_st = p_subtitle.add_run("Phương án Tự chủ Phát triển & Triển khai Hệ thống Văn phòng điện tử\nQCET E-OFFICE (Điều hành, Quản lý Công việc & Văn bản số)")
    run_st.bold = True
    run_st.font.size = Pt(13)
    run_st.font.color.rgb = RGBColor(20, 50, 130)

    # Kính gửi
    p_kg = doc.add_paragraph()
    p_kg.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_kg.paragraph_format.space_after = Pt(14)
    r_kg = p_kg.add_run("Kính gửi: BAN GIÁM HIỆU TRƯỜNG CĐ KỸ THUẬT CÔNG NGHỆ QUY NHƠN")
    r_kg.bold = True
    r_kg.italic = True
    r_kg.font.size = Pt(12)

    def add_sec_heading(title_text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(14)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.keep_with_next = True
        r = p.add_run(title_text)
        r.bold = True
        r.font.size = Pt(13)
        r.font.color.rgb = RGBColor(15, 30, 80)
        return p

    def add_bullet(bold_prefix, text):
        p = doc.add_paragraph(style='List Bullet')
        p.paragraph_format.space_after = Pt(3)
        p.paragraph_format.line_spacing = 1.25
        r1 = p.add_run(bold_prefix)
        r1.bold = True
        p.add_run(text)
        return p

    def add_normal_p(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.line_spacing = 1.25
        p.paragraph_format.first_line_indent = Inches(0.4)
        p.add_run(text)
        return p

    # SECTION 1
    add_sec_heading("1. SỰ CẦN THIẾT & MỤC TIÊU DỰ ÁN")
    add_normal_p("Trong bối cảnh đẩy mạnh chuyển đổi số tại các cơ sở giáo dục nghề nghiệp, công tác chỉ đạo điều hành, quản lý tiến độ công việc và luân chuyển hồ sơ hành chính tại Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (QCET) đang đối mặt với một số điểm nghẽn thực tế:")
    add_bullet("Giao việc và báo cáo phân tán qua Zalo: ", "Việc điều hành hiện nay tản mát qua nhiều nhóm mạng xã hội, dễ trôi tin nhắn, khó kiểm soát thời hạn (deadline) và khó quy trách nhiệm khi công việc trễ hạn.")
    add_bullet("Thủ tục giấy tờ tốn thời gian: ", "Quy trình nộp tờ trình, xin ý kiến và ký nháy của các Phòng/Khoa vẫn mang tính thủ công, cán bộ phải di chuyển nhiều giữa các cơ sở để hoàn tất phê duyệt.")
    add_bullet("Thiếu công cụ điều hành thời gian thực: ", "Lãnh đạo trường chưa có bảng ma trận tổng hợp trực quan để nắm bắt tức thời tiến độ của từng đơn vị trong các cuộc họp giao ban đầu tuần.")
    add_normal_p("Mục tiêu của dự án là xây dựng hệ thống Văn phòng điện tử QCET E-Office 'may đo' theo đúng chuẩn trường nghề, tạo nên một không gian làm việc số duy nhất (Single Workspace) giúp minh bạch hóa tiến độ, tinh gọn tối đa thủ tục hành chính và tiết kiệm ngân sách đầu tư cho trường.")

    # SECTION 2
    add_sec_heading("2. CĂN CỨ PHÁP LÝ & TIÊU CHUẨN NHÀ NƯỚC")
    add_normal_p("Hệ thống được thiết kế bám sát các quy định pháp luật hiện hành:")
    add_bullet("Nghị định số 30/2020/NĐ-CP của Chính phủ về công tác văn thư: ", "Quy định chuẩn hóa Sổ đăng ký văn bản đến, Sổ đăng ký văn bản đi (Phụ lục IV), quy tắc cấp số tự động liên tục trong năm và chức năng in sổ đóng dấu lưu trữ.")
    add_bullet("Văn bản 01/VBHN-VPCP (Hợp nhất QĐ 42/2014/QĐ-TTg & QĐ 23/2018/QĐ-TTg của Thủ tướng Chính phủ): ", "Quy chế theo dõi, đôn đốc, kiểm tra nhiệm vụ do Lãnh đạo giao theo nguyên tắc '5 Rõ' (Rõ việc, Rõ người chủ trì, Rõ người phối hợp, Rõ hạn chót, Rõ sản phẩm đầu ra).")
    add_bullet("Nghị định số 90/2020/NĐ-CP & Nghị định số 48/2023/NĐ-CP của Chính phủ: ", "Quy định đánh giá, xếp loại chất lượng viên chức dựa trên tỷ lệ hoàn thành công việc đúng hạn, làm cơ sở khách quan cho công tác thi đua khen thưởng cuối năm.")
    add_bullet("Thông tư số 02/2019/TT-BNV của Bộ Nội vụ: ", "Quy chuẩn kỹ thuật trao đổi dữ liệu văn bản điện tử (EdXML), sẵn sàng kết nối Trục liên thông tỉnh Bình Định.")

    # SECTION 3 - FINANCIAL COMPARISON TABLE
    add_sec_heading("3. BÀI TOÁN HIỆU QUẢ TÀI CHÍNH (SO SÁNH VỚI MUA NGOÀI)")
    add_normal_p("Khảo sát thực tế chi phí từ các nhà cung cấp giải pháp thương mại đóng gói trên thị trường cho quy mô 300 người dùng:")

    tbl_fin = doc.add_table(rows=5, cols=4)
    tbl_fin.alignment = WD_TABLE_ALIGNMENT.CENTER
    fin_headers = ["Tiêu chí So sánh", "Gói 1Office (3 Năm)", "VSS PortalOffice 10", "QCET Tự Phát triển"]
    for i, h in enumerate(fin_headers):
        cell = tbl_fin.cell(0, i)
        cell.text = h
        cell.paragraphs[0].runs[0].bold = True
        cell.paragraphs[0].runs[0].font.size = Pt(11)
        cell.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
        set_cell_background(cell, "1E3A8A")
        cell.paragraphs[0].runs[0].font.color.rgb = RGBColor(255, 255, 255)
        set_cell_margins(cell, top=120, bottom=120, left=150, right=150)

    fin_rows = [
        ["Chi phí Bản quyền", "648.000.000 đ", "720.000.000 đ", "0 ĐỒNG"],
        ["Phí Cài đặt & Triển khai", "70.000.000 đ", "200.000.000 đ", "0 ĐỒNG"],
        ["Tổng Chi phí Ban đầu", "718.000.000 đ", "920.000.000 đ", "0 ĐỒNG (Tiết kiệm gần 1 tỷ)"],
        ["Đặc thù Trường nghề (DACUM)", "Không có (Đóng gói doanh nghiệp)", "Không có (Hành chính chung)", "May đo 100% theo trường"]
    ]

    for r_idx, r_data in enumerate(fin_rows, 1):
        for c_idx, val in enumerate(r_data):
            cell = tbl_fin.cell(r_idx, c_idx)
            cell.text = val
            p = cell.paragraphs[0]
            p.runs[0].font.size = Pt(10.5)
            if c_idx == 0:
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                p.runs[0].bold = True
            elif c_idx == 3:
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                p.runs[0].bold = True
                set_cell_background(cell, "DCFCE7") # Light green
            else:
                p.alignment = WD_ALIGN_PARAGRAPH.RIGHT if "đ" in val else WD_ALIGN_PARAGRAPH.CENTER
            set_cell_margins(cell, top=100, bottom=100, left=150, right=150)

    doc.add_paragraph()

    # SECTION 4
    add_sec_heading("4. HIỆN TRẠNG PHÁT TRIỂN & KẾT QUẢ ĐẠT ĐƯỢC (PHASE 1)")
    add_normal_p("Hiện tại, đội ngũ kỹ thuật nội bộ đã hoàn thành xuất sắc hơn 80% khối lượng công việc của Giai đoạn 1 (Nền tảng Quản lý & Giao việc):")
    add_bullet("Phân quyền Không gian làm việc theo vai trò (Role-based Workspace): ", "Tách biệt rõ ràng giao diện của Ban Giám hiệu, Trưởng phòng/khoa và Giảng viên/chuyên viên (Staff Focus View) giúp người dùng không bị rối mắt, chỉ nhìn thấy việc cần làm.")
    add_bullet("Ma trận Tiến độ Điều hành BGH (Department Progress Matrix): ", "Cho phép Lãnh đạo trường giám sát tức thời tỷ lệ hoàn thành, số lượng việc quá hạn của tất cả các Khoa/Phòng để chỉ đạo kịp thời.")
    add_bullet("Quy trình Ủy quyền & Nghiệp vụ DACUM đặc thù: ", "Cơ chế phân quyền linh hoạt cho các tổ trưởng chuyên môn, chủ trì thẩm định chương trình đào tạo nghề nghiệp mà các phần mềm thương mại bên ngoài không có sẵn.")
    add_bullet("Bảng Kanban & Bộ lọc tác vụ thông minh: ", "Kéo thả chuyển trạng thái công việc, lọc theo độ khẩn (Hỏa tốc, Thượng khẩn), gắn hạn chót và lưu vết trao đổi minh chứng.")

    # SECTION 5
    add_sec_heading("5. KẾ HOẠCH PHÂN KỲ TRIỂN KHAI TIẾP THEO")
    add_bullet("Giai đoạn 1 (Tháng 09/2026): ", "Hoàn tất lưu trữ CSDL PostgreSQL và triển khai thử nghiệm diện hẹp tại Phòng Đào tạo và Khoa CNTT.")
    add_bullet("Giai đoạn 2 (Tháng 10 - 11/2026): ", "Triển khai Sổ công văn Đến/Đi theo Nghị định 30/2020/NĐ-CP; Bút phê điện tử tự động sinh công việc; Quy trình nộp tờ trình online thay thế giấy tờ.")
    add_bullet("Giai đoạn 3 (Năm 2027): ", "Mở rộng tích hợp chữ ký số SmartCA/Token USB, kho biểu mẫu đóng dấu chìm Watermark bảo mật và thông báo di động.")

    # SECTION 6
    add_sec_heading("6. ĐỀ XUẤT & KIẾN NGHỊ")
    add_normal_p("Để hệ thống sớm đi vào hoạt động chính thức mang lại hiệu quả thiết thực cho nhà trường, kính đề nghị Ban Giám hiệu:")
    add_bullet("1. ", "Chấp thuận chủ trương tự chủ phát triển và triển khai hệ thống Văn phòng điện tử QCET E-Office nội bộ.")
    add_bullet("2. ", "Cho phép bố trí 01 máy chủ ảo hóa nội bộ (Ubuntu Server / Docker) để cài đặt hệ thống bảo đảm an toàn dữ liệu.")
    add_bullet("3. ", "Chỉ đạo Phòng Đào tạo, Khoa CNTT và Văn phòng trường phối hợp thử nghiệm thực tế trong 03 tuần để hoàn thiện quy trình trước khi ban hành áp dụng toàn trường.")

    # SIGNATURE BLOCK
    doc.add_paragraph()
    sig_table = doc.add_table(rows=1, cols=2)
    sig_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    sig_left = sig_table.cell(0, 0)
    sig_right = sig_table.cell(0, 1)
    sig_left.width = Inches(3.2)
    sig_right.width = Inches(3.5)

    p_sleft = sig_left.paragraphs[0]
    p_sleft.paragraph_format.line_spacing = 1.15
    p_sleft.add_run("Nơi nhận:\n").bold = True
    p_sleft.add_run("- Ban Giám hiệu (để báo cáo);\n- Các Phòng, Khoa (để phối hợp);\n- Lưu: VT, ĐT Kỹ thuật.")
    p_sleft.runs[1].font.size = Pt(11)

    p_sright = sig_right.paragraphs[0]
    p_sright.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_sright.paragraph_format.line_spacing = 1.15
    r_sr1 = p_sright.add_run("ĐẠI DIỆN ĐỘI NGŨ KỸ THUẬT\n")
    r_sr1.bold = True
    r_sr1.font.size = Pt(12)
    r_sr2 = p_sright.add_run("(Ký và ghi rõ họ tên)\n\n\n\n")
    r_sr2.italic = True
    r_sr2.font.size = Pt(11)

    output_docx = "/Users/dnhhuy/Desktop/BAO_CAO_DU_AN_QCET_EOFFICE.docx"
    doc.save(output_docx)
    print("Report docx generated at:", output_docx)

if __name__ == "__main__":
    create_qcet_report_docx()
