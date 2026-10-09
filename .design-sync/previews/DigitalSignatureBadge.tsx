import React from "react";
import { DigitalSignatureBadge, DigitalSignatureStamp, RemoteSigningFlow } from "qcet-eoffice";

export function TrangThaiChuKySo() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: 440, padding: 20 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <DigitalSignatureBadge status="valid" />
        <DigitalSignatureBadge status="pending" />
        <DigitalSignatureBadge status="invalid" />
        <DigitalSignatureBadge status="expired" />
      </div>

      <DigitalSignatureStamp
        signerName="PGS. TS. Nguyễn Văn Nam"
        signerPosition="Hiệu trưởng"
        organization="Trường CĐ KT-KT Quảng Châu"
        signedAt={new Date("2026-10-03T09:30:00")}
        certificateAuthority="Ban Cơ yếu Chính phủ (VGCA)"
        hashSha256="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
      />
    </div>
  );
}

export function TrinhKyTuXa() {
  return (
    <div style={{ width: 460, padding: 20 }}>
      <RemoteSigningFlow
        documentTitle="Thông báo kế hoạch chuyên môn HK1"
        documentNumber="128/QCET-TB"
        onSign={(provider) => console.log("Sign via", provider)}
      />
    </div>
  );
}
