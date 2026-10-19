# QCET Outline icons

30 icon SVG vẽ mới theo ảnh tham khảo của người dùng: đơn sắc, nét mảnh, góc mềm; không sao chép logo/app của ảnh.

Grid24, stroke1.5, linecap/linejoin round; dùng ở16/20/24px. Không thêm nền chip hay màu trạng thái. SVG dùng currentColor; nếu dùng qua img thì mặc định đen, dùng component React để nhận màu theo giao diện.

React: `import { QcetIcon } from "@/components/icons"` rồi `<QcetIcon name="dashboard" size={20} />`. Icon cạnh chữ để decorative; icon đứng riêng cần aria-label hoặc title, nút chứa icon cần accessible name.

Tên và geometry nằm trong `src/components/icons/qcet-outline-paths.ts`; SVG tương ứng trong thư mục này. Chưa thay icon đang dùng trên sidebar/page. Không sửa các ảnh/logo hiện có.
