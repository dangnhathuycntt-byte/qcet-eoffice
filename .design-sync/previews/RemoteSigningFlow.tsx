import React from "react";
import { RemoteSigningFlow } from "qcet-eoffice";

export function KyTuXaSmartCA() {
  return (
    <div style={{ width: 460, padding: 20 }}>
      <RemoteSigningFlow
        documentTitle="Quyết định ban hành quy chế đào tạo tín chỉ 2026 - 2027"
        documentNumber="156/QĐ-QCET"
        onSign={(provider) => console.log("Sign via", provider)}
      />
    </div>
  );
}
