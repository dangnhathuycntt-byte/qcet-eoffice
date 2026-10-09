import React from "react";
import { AdministrativeHeader, DocumentFooter, DigitalSignatureStamp } from "qcet-eoffice";

export function MauVanBanHanhChinh() {
  return (
    <div style={{ width: 620, padding: 24, backgroundColor: "var(--card)", borderRadius: 16 }}>
      <AdministrativeHeader
        parentAgency="ỦY BAN NHÂN DÂN THÀNH PHỐ"
        agencyName="TRƯỜNG CĐ KT-KT QUẢNG CHÂU"
        documentNumber="Số: 128/QCET-TB"
        location="Quảng Châu"
        date={new Date("2026-10-03")}
        documentType="THÔNG BÁO"
        subject="Triển khai kế hoạch thực hiện nhiệm vụ trọng tâm học kỳ I năm học 2026 - 2027"
      />
      <div style={{ margin: "24px 0", fontSize: 14, lineHeight: 1.6, textAlign: "justify", fontFamily: "serif" }}>
        <p style={{ textIndent: 28, margin: 0 }}>
          Căn cứ Kế hoạch công tác năm học 2026 - 2027 của Ban Giám hiệu, Ban Giám hiệu yêu cầu Trưởng các đơn vị,
          phòng, ban, khoa chuyên môn khẩn trương rà soát chỉ tiêu và cập nhật tiến độ nhiệm vụ trên hệ thống e-Office.
        </p>
      </div>
      <DocumentFooter
        recipients={["Ban Giám hiệu (để b/c);", "Các phòng, khoa, đơn vị;", "Lưu: VT, PĐT."]}
        signerTitle="HIỆU TRƯỞNG"
        signerName="PGS. TS. Nguyễn Văn Nam"
        signatureStamp={
          <DigitalSignatureStamp
            signerName="PGS. TS. Nguyễn Văn Nam"
            signerPosition="Hiệu trưởng"
            signedAt={new Date("2026-10-03T09:30:00")}
            certificateAuthority="Ban Cơ yếu Chính phủ (VGCA)"
          />
        }
      />
    </div>
  );
}
