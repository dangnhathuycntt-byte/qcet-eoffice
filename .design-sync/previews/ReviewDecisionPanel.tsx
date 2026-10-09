import React from "react";
import { ReviewDecisionPanel } from "qcet-eoffice";

export function YKienNguoiDuyet() {
  return (
    <div style={{ width: 560, padding: 20 }}>
      <ReviewDecisionPanel
        documentTitle="Tờ trình về việc phê duyệt kế hoạch tuyển sinh hệ chính quy năm 2026"
        documentNumber="89/TTr-PĐT"
        onSubmit={(decision) => console.log("Decision submitted:", decision)}
        onCancel={() => console.log("Cancelled")}
      />
    </div>
  );
}
