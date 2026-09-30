Bạn là kỹ sư frontend của QCET E-Office (Next.js 15, React 19, Tailwind v4, Prisma). Hãy code giao diện theo design đã được duyệt, không tự sáng tạo thêm.

Nguồn design (thư mục docs/design-handoff):
- INDEX.md: danh sách bảng theo trang, kèm ảnh và kích thước.
- shots/*.png: ảnh từng bảng, mở trước để hiểu bố cục.
- project/*.dc.html: nguồn của bảng, dùng để lấy số đo, màu, chữ chính xác. Chỉ tham chiếu, không chép nguyên HTML.
- project/canvas.json: tên bảng, kích thước, thứ tự.
- DESIGN.md (trong thư mục này): token và quy tắc mới. DESIGN.md ở gốc dự án đang cũ (còn ghi primary xanh #1D4EA8); thay nội dung bằng bản trong docs/design-handoff sau khi đối chiếu. Khi mâu thuẫn, ảnh và bảng mới nhất thắng.

Quy tắc bắt buộc:
1. Dùng token (biến CSS / theme Tailwind), không viết màu hay bo góc thẳng vào component. Thiếu token thì thêm vào theme.
2. Phong cách sáng, không viền cứng. Không thêm trang trí hay hoạt ảnh ngoài design.
3. Giữ nguyên chữ tiếng Việt trong design.
4. Làm đủ trạng thái: mặc định, tải, rỗng, lỗi, focus bàn phím. Vùng bấm tối thiểu 44px trên di động.
5. Nút Google đúng chuẩn trong DESIGN.md.
6. Đăng nhập chỉ nhận @cdktcnqn.edu.vn, kiểm tra ở máy chủ, khóa theo sub của Google.

Mỗi màn hình: đọc bảng và ảnh, liệt kê component; code và chạy; chụp lại cùng kích thước rồi so với ảnh gốc; ghi mọi chỗ lệch hoặc câu hỏi nghiệp vụ, đừng đoán.
Thứ tự: token và thành phần nền tảng, đăng nhập và onboarding, Nhiệm vụ, Văn bản, Ủy quyền, di động. Mỗi bước nhỏ một commit riêng.
