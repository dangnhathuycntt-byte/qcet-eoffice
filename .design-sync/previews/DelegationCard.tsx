import React from "react";
import { DelegationCard } from "qcet-eoffice";

export function TheUyQuyen() {
  return (
    <div style={{ width: 480, padding: 20 }}>
      <DelegationCard
        grantor={{
          name: "PGS. TS. Nguyễn Văn Nam",
          title: "Hiệu trưởng",
        }}
        delegate={{
          name: "TS. Lê Thị Mai",
          title: "Phó Hiệu trưởng phụ trách Đào tạo",
        }}
        decisionNumber="45/QĐ-QCET"
        scope={["Ký duyệt kế hoạch đào tạo", "Phân công giảng viên", "Phê duyệt bảng điểm"]}
        startDate="01/10/2026"
        endDate="31/12/2026"
        status="active"
        onRevoke={() => console.log("Revoke delegation")}
      />
    </div>
  );
}
