/**
 * Kiểu kết quả tìm kiếm toàn cục (`GET /api/search`) dùng ở client.
 */
export interface SearchTaskResult {
  id: string;
  code: string;
  title: string;
  scope: string;
  status: string;
  priority: string;
  progressPercent: number;
  dueDate: string;
  academicMonth: number;
  academicYear: string;
  department?: {
    id: string;
    name: string;
    shortName: string | null;
    color: string | null;
  } | null;
  assignees: Array<{
    roleInTask: string;
    user: {
      id: string;
      name: string;
      avatarUrl: string | null;
    };
  }>;
}

export interface SearchUserResult {
  id: string;
  name: string;
  email: string;
  role: string;
  title: string | null;
  phone: string | null;
  avatarUrl: string | null;
  department?: {
    id: string;
    name: string;
    shortName: string | null;
    color: string | null;
  } | null;
}

export interface SearchDocumentResult {
  id: string;
  documentNumber?: string;
  originalNumber?: string | null;
  registrationNumber?: number | null;
  title: string;
  summary: string;
  type?: string;
  category?: string | null;
  issuingAuthority?: string | null;
  issuedDate?: string;
  status?: string;
  urgency?: string;
  leadDepartment?: {
    id: string;
    name: string;
    shortName: string | null;
  } | null;
}
