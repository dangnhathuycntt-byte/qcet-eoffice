/**
 * Kiểu kết quả tìm kiếm toàn cục (`GET /api/search`), khớp payload của `searchGlobal`.
 */
export interface SearchTaskResult {
  id: string;
  code: string;
  title: string;
  scope: string;
  status: string;
  priority: string;
  progressPercent: number;
  /** ISO 8601 */
  dueDate: string;
  academicMonth: number;
  academicYear: string;
  leadUnit: {
    id: string;
    name: string;
    code: string;
  } | null;
  actors: Array<{
    role: string;
    isPrimaryDRI: boolean;
    /** null với tác nhân là đơn vị */
    user: {
      id: string;
      name: string;
      avatarUrl: string | null;
    } | null;
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
}

export interface SearchDocumentResult {
  id: string;
  originalNumber: string;
  registrationNumber: number;
  type: string;
  summary: string;
  category: string;
  issuingAuthority: string;
  /** ISO 8601 */
  issuedDate: string;
  status: string;
  urgency: string;
}

export interface GlobalSearchPayload {
  query: string;
  results: {
    tasks: SearchTaskResult[];
    documents: SearchDocumentResult[];
    users: SearchUserResult[];
  };
  count: {
    tasks: number;
    documents: number;
    users: number;
  };
}
