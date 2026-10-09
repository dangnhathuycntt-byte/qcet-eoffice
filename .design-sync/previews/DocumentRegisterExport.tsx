import React from "react";
import { DocumentRegisterExport } from "qcet-eoffice";

export function XuatSoVanBan() {
  return (
    <div style={{ width: 480, padding: 20 }}>
      <DocumentRegisterExport
        defaultRegisterType="incoming"
        totalRecords={412}
        year={2026}
        onExport={(opts) => console.log("Export options:", opts)}
      />
    </div>
  );
}
