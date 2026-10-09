import React from "react";
import { Textarea } from "qcet-eoffice";

export function Default() {
  return (
    <div style={{ maxWidth: "420px" }}>
      <Textarea placeholder="Nhập nội dung ý kiến đóng góp hoặc ghi chú..." />
    </div>
  );
}

export function WithCharacterCount() {
  return (
    <div style={{ maxWidth: "420px" }}>
      <Textarea
        showCount
        maxCharacters={200}
        defaultValue="Kính g��i Ban Giám hiệu đề xuất phương án cải tiến quy trình xử lý văn bản điện tử."
      />
    </div>
  );
}

export function AutoResize() {
  return (
    <div style={{ maxWidth: "420px" }}>
      <Textarea
        autoResize
        placeholder="Ô nhập tự động co giãn theo chiều cao nội dung..."
      />
    </div>
  );
}
