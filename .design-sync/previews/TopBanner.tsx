import React from "react";
import { TopBanner } from "qcet-eoffice";

export function Default() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <TopBanner onDismiss={() => {}}>
        Hệ thống sẽ bảo trì định kỳ vào lúc 23:00 Chủ Nhật.
      </TopBanner>
      <TopBanner variant="warning" onDismiss={() => {}}>
        Phiên đăng nhập của bạn sắp hết hạn sau 5 phút nữa.
      </TopBanner>
      <TopBanner variant="destructive" onDismiss={() => {}}>
        Mất kết nối mạng Internet. Đang thử kết nối lại...
      </TopBanner>
    </div>
  );
}
