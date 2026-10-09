import React from "react";
import { Breadcrumb } from "qcet-eoffice";

export function Default() {
  return (
    <div style={{ padding: 20 }}>
      <Breadcrumb
        items={[
          { label: "Nhiệm vụ", href: "/tasks" },
          { label: "Khoa Công nghệ thông tin", href: "/tasks?unit=cntt" },
          { label: "Báo cáo giảng dạy học kỳ I" },
        ]}
      />
    </div>
  );
}
