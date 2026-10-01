# QCET · hướng dẫn thiết kế

Trước khi sửa UI, đọc `docs/qcet-design-nen-tang-nhiem-vu/FOUNDATIONS.md` và các bảng gốc liên quan trong `project/`, `shots/`. Đây là bộ Nền tảng & thành phần người dùng chọn làm gốc; `INDEX.md` chỉ đường tới từng bảng.

- Bám font, kích thước, khoảng cách, màu, ảnh và trạng thái của bảng tương ứng. Dùng token và component chung; không tự thêm biến thể không có nguồn.
- Các điểm mâu thuẫn trong `FOUNDATIONS.md` chưa phải quyết định đã chốt. Không tự suy ra bảng mới hơn, không sửa nghiệp vụ từ ví dụ trong artifact.
- Hướng dẫn trực tiếp của người dùng và quyết định đã duyệt cho phạm vi cụ thể có ưu tiên. Khôi phục tài liệu không cho phép tự áp dụng lại page đã revert.
- Đối chiếu hình ở viewport phù hợp và kiểm tra hành vi bàn phím, responsive, loading/error khi sửa phần liên quan.

## Cách giải quyết vấn đề

Với vấn đề không đơn giản: phân rã thành phần, xem xét phương án thay thế, kiểm tra giả định và trường hợp biên; giải thích lý do kiến trúc khi đề xuất hoặc thực hiện thay đổi.
