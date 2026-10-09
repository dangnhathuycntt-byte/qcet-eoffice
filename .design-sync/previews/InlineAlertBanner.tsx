import React from "react";
import { InlineAlertBanner } from "qcet-eoffice";

export function CacBienThe() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, width: 520, padding: 20 }}>
      <InlineAlertBanner
        variant="info"
        title="Thông tin lưu ý"
        action={{ label: "Xem chi tiết", onClick: () => console.log("Info clicked") }}
      >
        Hệ thống sẽ bảo trì định kỳ vào 23:00 thứ Bảy tuần này để nâng cấp phân hệ ký số.
      </InlineAlertBanner>

      <InlineAlertBanner
        variant="warning"
        title="Cảnh báo hạn xử lý"
      >
        Nhiệm vụ này chỉ còn 24 giờ trước thời hạn bàn giao theo chỉ đạo của Ban Giám hiệu.
      </InlineAlertBanner>

      <InlineAlertBanner
        variant="error"
        title="Không thể hoàn tất phê duyệt"
        action={{ label: "Thử lại", onClick: () => console.log("Retry") }}
      >
        Hồ sơ thiếu tệp minh chứng kết quả nghiệm thu theo quy định của Nghị định 232.
      </InlineAlertBanner>

      <InlineAlertBanner
        variant="success"
        title="Tiếp nhận thành công"
      >
        Văn bản số 128/QCET-TB đã được vào sổ và chuyển tiếp đến các đơn vị phối hợp.
      </InlineAlertBanner>
    </div>
  );
}
