import React from "react";
import { UrgencyBadge, ConfidentialityBadge, DocumentSecurityHeader } from "qcet-eoffice";

export function DoKhanVaDoMat() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: 440, padding: 20 }}>
      <div>
        <p style={{ fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)", marginBottom: 8 }}>
          ĐỘ KHẨN (NGHỊ ĐỊNH 30/2020/NĐ-CP)
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <UrgencyBadge level="normal" />
          <UrgencyBadge level="urgent" />
          <UrgencyBadge level="very_urgent" />
          <UrgencyBadge level="express" />
        </div>
      </div>

      <div>
        <p style={{ fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)", marginBottom: 8 }}>
          ĐỘ MẬT (LUẬT BẢO VỆ BÍ MẬT NHÀ NƯỚC)
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <ConfidentialityBadge level="normal" />
          <ConfidentialityBadge level="secret" />
          <ConfidentialityBadge level="top_secret" />
          <ConfidentialityBadge level="absolute_secret" />
        </div>
      </div>

      <div>
        <p style={{ fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)", marginBottom: 8 }}>
          KẾT HỢP ĐẦU VĂN BẢN HỎA TỐC - TỐI MẬT
        </p>
        <DocumentSecurityHeader urgency="express" confidentiality="top_secret" />
      </div>
    </div>
  );
}
