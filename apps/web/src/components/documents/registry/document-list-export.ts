/** Bảng xuất Excel (CSV) các văn bản đã chọn trên sổ, theo thứ tự trên màn hình; cùng nhãn với các cột của sổ. */
import type { OfficialDocument } from "@qcet/contracts/types/document";
import { formatLedgerDate, getLedgerStepLabel, getLedgerUrgencyTag } from "@qcet/shared/lib/documents/document-ledger-format";

const capitalize = (label: string) => label.charAt(0) + label.slice(1).toLowerCase();

/** `numberHeader`: "Số đến", "Số đi" hoặc "Số" theo sổ đang xem. */
export function documentCsvRows(docs: OfficialDocument[], numberHeader: string): string[][] {
  return [
    [numberHeader, "Số, ký hiệu", "Ngày ban hành", "Cơ quan ban hành", "Trích yếu", "Mức khẩn", "Đơn vị chủ trì", "Hạn xử lý", "Bước xử lý"],
    ...docs.map((doc) => {
      const urgency = getLedgerUrgencyTag(doc.urgency);
      return [
        doc.registrationNumber != null ? String(doc.registrationNumber).padStart(4, "0") : "",
        doc.documentNumber,
        formatLedgerDate(doc.issuedDate),
        doc.issuingAuthority,
        doc.summary,
        urgency ? capitalize(urgency.label) : "Thường",
        doc.leadDepartment && doc.leadDepartment !== "Chưa phân công" ? doc.leadDepartment : "",
        formatLedgerDate(doc.dueDate),
        getLedgerStepLabel(doc.status, doc.workflowStatus, doc.type, doc.needsRevision).label,
      ];
    }),
  ];
}
