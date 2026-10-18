/**
 * Tìm kiếm toàn cục (`GET /api/search`): nhiệm vụ trong phạm vi đọc, người dùng đang hoạt động, văn bản
 * (trừ TUYET_MAT); khớp cả dạng bỏ dấu, telex, từ viết tắt rồi chấm điểm tiếng Việt.
 */
import { prisma } from '@/lib/prisma';
import { TaskScope } from '@prisma/client';
import type { z } from 'zod';
import type { OperationalScopeSchema } from '@/contracts/common';
import {
  foldVietnamese,
  normalizeTelexQuery,
  scoreVietnameseSearch,
  QCET_ACRONYMS,
} from '@/lib/search/vietnamese-search';
import { loadAuthorizationContext } from '@/server/authorization/authorization-context-service';
import { buildTaskReadWhere } from '@/server/tasks/task-query-service';

export async function searchGlobal(
  userId: string,
  { q, limit, scope }: { q: string; limit: number; scope?: z.infer<typeof OperationalScopeSchema> }
) {
  const foldedQ = foldVietnamese(q);
  const telexQ = normalizeTelexQuery(q);
  const acronymTerms = QCET_ACRONYMS[foldedQ] || [];

  // Base query filter for tasks
  const andConditions: any[] = [];

  // Optional user-specified narrowing scope for tasks
  if (scope) {
    if (scope === 'school') {
      andConditions.push({ scope: TaskScope.SCHOOL });
    } else if (scope === 'unit') {
      andConditions.push({ scope: TaskScope.DEPARTMENT });
    } else if (scope === 'personal') {
      andConditions.push({
        OR: [
          { scope: TaskScope.INDIVIDUAL },
          { actors: { some: { userId } } },
        ],
      });
    }
  }

  if (q) {
    const taskOrConditions: any[] = [
      { title: { contains: q, mode: 'insensitive' } },
      { code: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { leadUnit: { name: { contains: q, mode: 'insensitive' } } },
      { leadUnit: { code: { contains: q, mode: 'insensitive' } } },
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
        { leadUnit: { name: { contains: term, mode: 'insensitive' } } },
        { title: { contains: term, mode: 'insensitive' } }
      );
    }

    andConditions.push({ OR: taskOrConditions });
  }

  // Canonical Task authorization (replaces legacy isAdmin + manual scope branching)
  // Note: scope=school query param is intentionally IGNORED for authorization.
  // buildTaskReadWhere() determines access based on canonical position assignments.
  const authorizationContext = await loadAuthorizationContext(userId, new Date(), { useCache: true });
  const canonicalTaskAuthWhere = buildTaskReadWhere(authorizationContext);
  if (Object.keys(canonicalTaskAuthWhere).length > 0) {
    andConditions.push(canonicalTaskAuthWhere);
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
      // Phase 9: User.department dropped — search via positionAssignments unit name
      { positionAssignments: { some: { unit: { name: { contains: q, mode: 'insensitive' } } } } },
    ];

    if (foldedQ && foldedQ !== q.toLowerCase()) {
      userOrConditions.push(
        { name: { contains: foldedQ, mode: 'insensitive' } },
        { email: { contains: foldedQ, mode: 'insensitive' } }
      );
    }

    for (const term of acronymTerms) {
      userOrConditions.push({
        positionAssignments: { some: { unit: { name: { contains: term, mode: 'insensitive' } } } },
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
  // SYSTEM_ADMIN is denied operational access; apply classification filter to all users.
  {
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
        leadUnit: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        actors: {
          select: {
            role: true,
            isPrimaryDRI: true,
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
          task.leadUnit?.name || '',
          task.leadUnit?.code || '',
        ].filter(Boolean);
        const score = Math.max(
          scoreVietnameseSearch(task.title, q, keywords),
          scoreVietnameseSearch(task.code, q),
          task.leadUnit?.name ? scoreVietnameseSearch(task.leadUnit.name, q) : 0
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
        ].filter(Boolean);
        const score = Math.max(
          scoreVietnameseSearch(user.name, q, keywords),
          user.title ? scoreVietnameseSearch(user.title, q) : 0
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

  const searchPayload = {
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
  };

  return searchPayload;
}
