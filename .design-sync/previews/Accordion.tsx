import React from "react";
import { Accordion } from "qcet-eoffice";

const faq = [
  {
    value: "qd1",
    title: "Quy định về thời hạn xử lý văn bản đến và chỉ đạo",
    content: "Các văn bản khẩn, hỏa tốc cần xử lý trong vòng 24 giờ kể từ thời điểm tiếp nhận. Văn bản thông thường được phân loại và xử lý theo kế hoạch công tác tuần của Ban Giám hiệu.",
  },
  {
    value: "qd2",
    title: "Quy trình xin phê duyệt và ký số văn bản điện tử",
    content: "Văn bản sau khi soạn thảo được chuyển qua Trưởng đơn vị kiểm tra trước khi trình Ban Giám hiệu ký số từ xa qua ứng dụng SmartCA tích hợp.",
  },
  {
    value: "qd3",
    title: "Hướng dẫn lập hồ sơ nhiệm vụ năm học 2026–2027",
    content: "Mỗi nhiệm vụ trọng tâm gắn liền với ít nhất một hồ sơ lưu trữ điện tử, tự động trích xuất mục lục theo tiêu chuẩn văn thư lưu trữ.",
  },
];

export function Default() {
  return (
    <div style={{ padding: 20, width: 520 }}>
      <Accordion items={faq} defaultValue={["qd1"]} />
    </div>
  );
}
