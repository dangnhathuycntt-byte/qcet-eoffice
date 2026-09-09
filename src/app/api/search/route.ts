import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/jwt-session";
import {
  foldVietnamese,
  normalizeTelexQuery,
  scoreVietnameseSearch,
  QCET_ACRONYMS,
} from "@/lib/search/vietnamese-search";

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

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Chưa xác thực danh tính" },
        { status: 401 }
      );
    }

    const { searchParams } = request.nextUrl;
    const q = (searchParams.get("q") || searchParams.get("query") || "").trim();
    const rawQ = q;
    const foldedQ = foldVietnamese(rawQ);
    const telexQ = normalizeTelexQuery(rawQ);
    const acronymTerms = QCET_ACRONYMS[foldedQ] || [];

    // 1. Search Tasks
    let tasksWhere: any = {};
    if (q) {
      const taskOrConditions: any[] = [
        { title: { contains: q, mode: "insensitive" } },
        { code: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { department: { name: { contains: q, mode: "insensitive" } } },
        { department: { shortName: { contains: q, mode: "insensitive" } } },
      ];

      // Add folded and telex forms
      if (foldedQ && foldedQ !== q.toLowerCase()) {
        taskOrConditions.push(
          { title: { contains: foldedQ, mode: "insensitive" } },
          { code: { contains: foldedQ, mode: "insensitive" } }
        );
      }
      if (telexQ && telexQ !== foldedQ && telexQ !== q.toLowerCase()) {
        taskOrConditions.push(
          { title: { contains: telexQ, mode: "insensitive" } }
        );
      }

      // Add acronym expansions (e.g. "cntt" -> "Khoa Công nghệ thông tin")
      for (const term of acronymTerms) {
        taskOrConditions.push(
          { department: { name: { contains: term, mode: "insensitive" } } },
          { title: { contains: term, mode: "insensitive" } }
        );
      }

      tasksWhere = { OR: taskOrConditions };
    }

    // 2. Search Users
    let usersWhere: any = { isActive: true };
    if (q) {
      const userOrConditions: any[] = [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { title: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
        { department: { name: { contains: q, mode: "insensitive" } } },
        { department: { shortName: { contains: q, mode: "insensitive" } } },
      ];

      if (foldedQ && foldedQ !== q.toLowerCase()) {
        userOrConditions.push(
          { name: { contains: foldedQ, mode: "insensitive" } },
          { email: { contains: foldedQ, mode: "insensitive" } }
        );
      }

      for (const term of acronymTerms) {
        userOrConditions.push(
          { department: { name: { contains: term, mode: "insensitive" } } }
        );
      }

      usersWhere = {
        isActive: true,
        OR: userOrConditions,
      };
    }

    const [rawTasks, rawUsers] = await Promise.all([
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
        orderBy: q ? [{ dueDate: "asc" }, { updatedAt: "desc" }] : [{ updatedAt: "desc" }],
        take: q ? 30 : 5,
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
        orderBy: { name: "asc" },
        take: q ? 20 : 5,
      }),
    ]);

    // Apply Vietnamese multi-tier scoring if query is present
    let sortedTasks = rawTasks;
    let sortedUsers = rawUsers;

    if (q) {
      sortedTasks = [...rawTasks]
        .map((task) => {
          const keywords = [
            task.code,
            task.department?.name || "",
            task.department?.shortName || "",
          ].filter(Boolean);
          const score = Math.max(
            scoreVietnameseSearch(task.title, q, keywords),
            scoreVietnameseSearch(task.code, q),
            task.department?.name ? scoreVietnameseSearch(task.department.name, q) : 0
          );
          return { task, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map((item) => item.task);

      sortedUsers = [...rawUsers]
        .map((user) => {
          const keywords = [
            user.email,
            user.phone || "",
            user.title || "",
            user.department?.name || "",
            user.department?.shortName || "",
          ].filter(Boolean);
          const score = Math.max(
            scoreVietnameseSearch(user.name, q, keywords),
            user.title ? scoreVietnameseSearch(user.title, q) : 0,
            user.department?.name ? scoreVietnameseSearch(user.department.name, q) : 0
          );
          return { user, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
        .map((item) => item.user);
    }

    const formattedTasks = sortedTasks.map((t) => ({
      ...t,
      dueDate: t.dueDate ? t.dueDate.toISOString() : "",
    }));

    return NextResponse.json({
      success: true,
      query: q,
      results: {
        tasks: formattedTasks,
        users: sortedUsers,
      },
      count: {
        tasks: formattedTasks.length,
        users: sortedUsers.length,
      },
    });
  } catch (error) {
    console.error("Lỗi tìm kiếm nhanh (Global Search):", error);
    return NextResponse.json(
      { success: false, error: "Đã xảy ra lỗi khi tìm kiếm" },
      { status: 500 }
    );
  }
}
