/**
 * Data models for Official Documents & Dispatches (Phân hệ Văn thư & Sổ văn bản)
 * Fully compliant with Decree 30/2020/ND-CP on clerical and archive operations.
 */

// Decree 30/2020/ND-CP Standard Types & backward-compatible union
export type DocumentType =
  | 'VAN_BAN_DEN'
  | 'VAN_BAN_DI'
  | 'TO_TRINH_NOI_BO'
  | 'inbox'
  | 'outbox'
  | 'submission';

export type DocumentUrgency =
  | 'THUONG'
  | 'KHAN'
  | 'THUONG_KHAN'
  | 'HOA_TOC'
  | 'normal'
  | 'urgent'
  | 'top_urgent'
  | 'flash';

export type DocumentSecurityLevel = 'THUONG' | 'MAT' | 'TOI_MAT' | 'TUYET_MAT';

export type DocumentStatus =
  | 'CHO_PHAN_CONG'
  | 'DANG_XU_LY'
  | 'CHO_PHE_DUYET'
  | 'DA_HOAN_THANH'
  | 'LUU_THEO_DOI'
  | 'pending_assignment'
  | 'processing'
  | 'delegated'
  | 'approved'
  | 'completed';

export interface DocumentAttachmentItem {
  id: string;
  documentId: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  sha256Hash?: string | null;
  isOriginal: boolean;
  createdAt?: string;
}

export interface DocumentDirectiveItem {
  id: string;
  documentId: string;
  leaderId: string;
  leaderName?: string;
  instruction: string;
  deadline?: string | null;
  /**
   * Phase 9: the directive no longer carries its own unit column. The receiving
   * unit is the lead unit of the task generated from this directive.
   */
  leadUnitId?: string | null;
  leadUnitName?: string | null;
  linkedTaskId?: string | null;
  linkedTaskCode?: string | null;
  collaboratorIds?: string | null;
  isTaskGenerated: boolean;
  createdAt?: string;
}

export interface DocumentItem {
  id: string;
  type: DocumentType;
  registrationNumber: number;
  documentYear: number;
  registeredDate: string;
  originalNumber: string;
  issuedDate: string;
  issuingAuthority: string;
  category: string;
  summary: string;
  urgency: DocumentUrgency;
  securityLevel: DocumentSecurityLevel;
  dueDate?: string | null;
  status: DocumentStatus;

  // Văn bản đi
  signerName?: string | null;
  signerTitle?: string | null;
  recipientList?: string | null;
  distributedCopies?: number | null;

  // Đơn vị chủ trì (canonical `OrganizationalUnit`, qua quy trình văn bản đến)
  leadUnitId?: string | null;
  leadUnitName?: string | null;
  leadUnitCode?: string | null;
  leadUserId?: string | null;
  leadUserName?: string | null;

  notes?: string | null;
  registeredById: string;
  registeredByName?: string | null;

  attachments?: DocumentAttachmentItem[];
  directives?: DocumentDirectiveItem[];
  incomingWorkflow?: any;
  outgoingWorkflow?: any;
  signatures?: any[];
  linkedTaskId?: string | null;

  createdAt?: string;
  updatedAt?: string;
}

// Backward-compatible interfaces for existing components and mock data
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
  signatures?: any[];
}

export interface DocumentStats {
  totalInbox: number;
  totalOutbox: number;
  totalSubmissions: number;
  urgentCount: number;
  linkedTaskCount: number;
}
