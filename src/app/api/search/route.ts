import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiContext, requireAuthenticated } from '@/server/api/request-context';
import { getSessionFromRequest } from '@/lib/jwt-session';
void getSessionFromRequest;
import { apiError, apiSuccess } from '@/server/api/response';
import { ValidationError } from '@/server/api/errors';
import { extractFieldErrors } from '@/server/api/validation';
import { SearchQuerySchema } from '@/contracts/common';
import { assertRateLimit } from '@/server/security/rate-limit';
import { isAdmin } from '@/server/policies/document-policy';
import {
  foldVietnamese,
  normalizeTelexQuery,
  scoreVietnameseSearch,
  QCET_ACRONYMS,
} from '@/lib/search/vietnamese-search';
import { TaskScope } from '@prisma/client';

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

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  let requestId = 'req-search-get';
  try {
    const context = await getApiContext(request);
    requestId = context.requestId;
    requireAuthenticated(context);
    const authUser = context.user!;

    // Enforce SEARCH rate limit tier
    assertRateLimit(authUser.id, 'SEARCH');

    const searchParams = request.nextUrl.searchParams;
    const queryParams: Record<string, any> = {};
    searchParams.forEach((val, key) => {
      queryParams[key] = val;
    });

    const parseResult = SearchQuerySchema.safeParse(queryParams);
    if (!parseResult.success) {
      throw new ValidationError(
        parseResult.error.issues[0]?.message || 'Validation failed',
        extractFieldErrors(parseResult.error)
      );
    }
    const { q: rawQParam, query: rawQueryParam, limit = 20, scope } = parseResult.data;
    const q = (rawQParam || rawQueryParam || '').trim();

    const foldedQ = foldVietnamese(q);
    const telexQ = normalizeTelexQuery(q);
    const acronymTerms = QCET_ACRONYMS[foldedQ] || [];

    // Base query filter for tasks
    const andConditions: any[] = [];

    if (q) {
      const taskOrConditions: any[] = [
        { title: { contains: q, mode: 'insensitive' } },
        { code: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { department: { name: { contains: q, mode: 'insensitive' } } },
        { department: { shortName: { contains: q, mode: 'insensitive' } } },
      ];

      // Add folded and telex forms
      if (foldedQ && foldedQ !== q.toLowerCase()) {
        taskOrConditions.push(
          { title: { contains: foldedQ, mode: 'insensitive' } },
          { code: { contains: foldedQ, mode: 'insensitive' } }
        );
      }
      if (telexQ && telexQ !== foldedQ && telexQ !== q.toLowerCase()) {
        taskOrConditions.push({
          title: { contains: telexQ, mode: 'insensitive' },
        });
      }

      // Add acronym expansions (e.g. "cntt" -> "Khoa Công nghệ thông tin")
      for (const term of acronymTerms) {
        taskOrConditions.push(
          { department: { name: { contains: term, mode: 'insensitive' } } },
          { title: { contains: term, mode: 'insensitive' } }
        );
      }

      andConditions.push({ OR: taskOrConditions });
    }

    // Role and Scope authorization filter
    const userIsAdmin = isAdmin(authUser);

    if (scope === 'personal') {
      andConditions.push({
        OR: [
          { createdById: authUser.id },
          { assignees: { some: { userId: authUser.id } } },
        ],
      });
    } else if (scope === 'unit') {
      if (authUser.departmentId) {
        andConditions.push({ departmentId: authUser.departmentId });
      } else if (!userIsAdmin) {
        // User with no department can only see their own tasks in unit scope
        andConditions.push({
          OR: [
            { createdById: authUser.id },
            { assignees: { some: { userId: authUser.id } } },
          ],
        });
      }
    } else if (scope === 'school') {
      andConditions.push({ scope: TaskScope.SCHOOL });
    } else if (!userIsAdmin) {
      // Unscoped query for non-admin: restrict to assigned, created, own department, or school-wide tasks
      const permittedConditions: any[] = [
        { createdById: authUser.id },
        { assignees: { some: { userId: authUser.id } } },
        { scope: TaskScope.SCHOOL },
      ];
      if (authUser.departmentId) {
        permittedConditions.push({ departmentId: authUser.departmentId });
      }
      andConditions.push({ OR: permittedConditions });
    }

    // Phase 9 & Section 31/43: Data classification filter for tasks
    if (!userIsAdmin) {
      andConditions.push({
        dataClassification: { not: 'STATE_SECRET' as any },
      });
    }

    const tasksWhere = andConditions.length > 0 ? { AND: andConditions } : {};

    // 2. Search Users
    let usersWhere: any = { isActive: true };
    if (q) {
      const userOrConditions: any[] = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { title: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { department: { name: { contains: q, mode: 'insensitive' } } },
        { department: { shortName: { contains: q, mode: 'insensitive' } } },
      ];

      if (foldedQ && foldedQ !== q.toLowerCase()) {
        userOrConditions.push(
          { name: { contains: foldedQ, mode: 'insensitive' } },
          { email: { contains: foldedQ, mode: 'insensitive' } }
        );
      }

      for (const term of acronymTerms) {
        userOrConditions.push({
          department: { name: { contains: term, mode: 'insensitive' } },
        });
      }

      usersWhere = {
        isActive: true,
        OR: userOrConditions,
      };
    }

    // 3. Search Documents
    let documentsWhere: any = {};
    if (q) {
      const docOrConditions: any[] = [
        { summary: { contains: q, mode: "insensitive" } },
        { originalNumber: { contains: q, mode: "insensitive" } },
        { issuingAuthority: { contains: q, mode: "insensitive" } },
        { category: { contains: q, mode: "insensitive" } },
      ];

      if (foldedQ && foldedQ !== q.toLowerCase()) {
        docOrConditions.push(
          { summary: { contains: foldedQ, mode: "insensitive" } },
          { originalNumber: { contains: foldedQ, mode: "insensitive" } }
        );
      }

      for (const term of acronymTerms) {
        docOrConditions.push(
          { summary: { contains: term, mode: "insensitive" } },
          { issuingAuthority: { contains: term, mode: "insensitive" } }
        );
      }

      documentsWhere = { OR: docOrConditions };
    }

    // Phase 9 & Section 31/43: Classification filter for documents
    if (!userIsAdmin) {
      const docAndConditions: any[] = [];
      if (documentsWhere.OR) {
        docAndConditions.push(documentsWhere);
      }
      // Deny TUYET_MAT by default
      docAndConditions.push({
        securityLevel: { not: 'TUYET_MAT' as any },
      });
      documentsWhere = { AND: docAndConditions };
    }

    const [rawTasks, rawUsers, rawDocuments] = await Promise.all([
      prisma.task.findMany({
        where: tasksWhere,
        select: {
          id: true,
          code: true,
          title: true,
          scope: true,
          status: true,
          priority: true,
          progressPercent: true,
          dueDate: true,
          academicMonth: true,
          academicYear: true,
          department: {
            select: {
              id: true,
              name: true,
              shortName: true,
              color: true,
            },
          },
          assignees: {
            select: {
              roleInTask: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
        orderBy: q ? [{ dueDate: 'asc' }, { updatedAt: 'desc' }] : [{ updatedAt: 'desc' }],
        take: Math.min(limit, 50),
      }),
      prisma.user.findMany({
        where: usersWhere,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          title: true,
          phone: true,
          avatarUrl: true,
          department: {
            select: {
              id: true,
              name: true,
              shortName: true,
              color: true,
            },
          },
        },
        orderBy: { name: 'asc' },
        take: Math.min(limit, 20),
      }),
      prisma.document.findMany({
        where: documentsWhere,
        select: {
          id: true,
          originalNumber: true,
          registrationNumber: true,
          type: true,
          summary: true,
          category: true,
          issuingAuthority: true,
          issuedDate: true,
          status: true,
          urgency: true,
          leadDepartment: {
            select: {
              id: true,
              name: true,
              shortName: true,
            },
          },
        },
        orderBy: [{ issuedDate: "desc" }],
        take: q ? 20 : 5,
      }).catch(() => []),
    ]);

    // Apply Vietnamese multi-tier scoring if query is present
    let sortedTasks = rawTasks;
    let sortedUsers = rawUsers;
    let sortedDocuments = rawDocuments;

    if (q) {
      sortedTasks = [...rawTasks]
        .map((task) => {
          const keywords = [
            task.code,
            task.department?.name || '',
            task.department?.shortName || '',
          ].filter(Boolean);
          const score = Math.max(
            scoreVietnameseSearch(task.title, q, keywords),
            scoreVietnameseSearch(task.code, q),
            task.department?.name ? scoreVietnameseSearch(task.department.name, q) : 0
          );
          return { task, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, Math.min(limit, 50))
        .map((item) => item.task);

      sortedUsers = [...rawUsers]
        .map((user) => {
          const keywords = [
            user.email,
            user.phone || '',
            user.title || '',
            user.department?.name || '',
            user.department?.shortName || '',
          ].filter(Boolean);
          const score = Math.max(
            scoreVietnameseSearch(user.name, q, keywords),
            user.title ? scoreVietnameseSearch(user.title, q) : 0,
            user.department?.name ? scoreVietnameseSearch(user.department.name, q) : 0
          );
          return { user, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, Math.min(limit, 20))
        .map((item) => item.user);

      if (rawDocuments.length > 0) {
        sortedDocuments = [...rawDocuments]
          .map((doc) => {
            const keywords = [
              doc.originalNumber,
              doc.issuingAuthority,
              doc.category,
              doc.leadDepartment?.name || "",
              doc.leadDepartment?.shortName || "",
            ].filter(Boolean);
            const score = Math.max(
              scoreVietnameseSearch(doc.summary, q, keywords),
              scoreVietnameseSearch(doc.originalNumber, q),
              scoreVietnameseSearch(doc.issuingAuthority, q)
            );
            return { doc, score };
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, 10)
          .map((item) => item.doc);
      }
    }

    const formattedTasks = sortedTasks.map((t) => ({
      ...t,
      dueDate: t.dueDate ? t.dueDate.toISOString() : '',
    }));

    const formattedDocuments = sortedDocuments.map((d) => ({
      ...d,
      issuedDate: d.issuedDate ? d.issuedDate.toISOString() : "",
    }));

    return apiSuccess(
      {
        query: q,
        results: {
          tasks: formattedTasks,
          documents: formattedDocuments,
          users: sortedUsers,
        },
        count: {
          tasks: formattedTasks.length,
          documents: formattedDocuments.length,
          users: sortedUsers.length,
        },
      },
      {
        requestId,
        headers: {
          'Cache-Control': 'private, no-store',
        },
        legacyCompat: true,
      }
    );
  } catch (error) {
    return apiError(error, requestId, { legacyCompat: true });
  }
}
