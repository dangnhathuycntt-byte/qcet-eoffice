/**
 * Data model for Official Documents & Dispatches (Văn bản & Quản lý Công văn)
 * Compliant with Decree 30/2020/ND-CP on clerical and archive operations.
 */

export type DocumentType = "inbox" | "outbox" | "submission";

export type DocumentUrgency = "normal" | "urgent" | "top_urgent" | "flash";

export type DocumentStatus =
  | "pending_assignment" // Chờ bút phê / phân công
  | "processing"         // Đang xử lý
  | "delegated"          // Đã liên thông giao việc
  | "approved"           // Đã ký duyệt
  | "completed";         // Đã hoàn tất & lưu trữ

export interface OfficialDocument {
  id: string;
  type: DocumentType;
  documentNumber: string;       // Số / Ký hiệu (vd: 128/TCGDNN-VP)
  issuedDate: string;           // Ngày ban hành (YYYY-MM-DD)
  receivedDate?: string;        // Ngày tiếp nhận vào sổ (YYYY-MM-DD)
  issuingAuthority: string;     // Cơ quan / Đơn vị ban hành
  summary: string;              // Trích yếu nội dung
  urgency: DocumentUrgency;     // Mức độ khẩn
  status: DocumentStatus;       // Trạng thái xử lý
  leadDepartment: string;       // Đơn vị chủ trì
  signatory: string;            // Người ký ban hành
  linkedTaskId?: string;        // Mã nhiệm vụ liên kết trong hệ thống QCET
  linkedTaskTitle?: string;     // Tên nhiệm vụ liên kết
  fileAttachment?: {
    name: string;
    size: string;
    url?: string;
  };
}

export interface DocumentStats {
  totalInbox: number;
  totalOutbox: number;
  totalSubmissions: number;
  urgentCount: number;
  linkedTaskCount: number;
}
