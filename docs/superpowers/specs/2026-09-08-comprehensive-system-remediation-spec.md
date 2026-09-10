# Specification: Comprehensive System Remediation, Security Hardening & PWA Architecture

- **Document Identifier**: QCET-SPEC-2026-SEC-PWA-001
- **System**: QCET E-Office (Hệ thống Điều hành Văn phòng Điện tử)
- **Target Organization**: Trường Cao đẳng Kỹ thuật Quy Nhơn (QCET)
- **Status**: Authoritative Technical Specification
- **Effective Date**: 2026-09-08
- **Classification**: Internal Engineering Standard

---

## 2. EXECUTIVE SUMMARY & OBJECTIVES

### 2.1 Executive Summary
QCET E-Office serves as the operational nerve center for academic governance, document lifecycle management, and task delegation at Quy Nhơn College of Engineering and Technology. Recent technical audits identified critical architectural vulnerabilities, lifecycle deadlocks, and consistency gaps across core subsystems:
1. **Broken Object-Level Authorization (BOLA/IDOR)** in document registration, directive issuance, and task management endpoints, including potential leader impersonation and unauthenticated internal network disclosure.
2. **PWA & Web Push Fragility**, characterized by `navigator.serviceWorker.ready` Promise deadlocks, aggressive local development cache unregistration, insecure VAPID key fallbacks in production, lack of RFC 8030 error-pruning mechanisms, and iOS 16.4+ standalone compatibility gaps.
3. **Workspace & Action Queue Integrity Gaps**, where administrative quick approvals bypassed DACUM audit trails, deliverable submissions allowed dummy `#` URLs, duplicated legacy table implementations fragmented maintenance, and department filtering relied on hardcoded personnel surnames.
4. **Accessibility (WCAG 2.1 AA) & Hygiene Deficits**, including contrast failures in status badges (`#FFFFFF` against `text-amber-600` and `text-emerald-600`), font fallback discrepancies, missing `#main-content` bypass landmarks on isolated routes (`/login`, `/portal`), and untracked SQLite database artifacts in version control.

This specification unifies the remediation roadmap into a single, cohesive engineering contract that hardens security, guarantees zero-deadlock PWA delivery, enforces strict accountability under Vietnamese Administrative Law (Nghị định 30/2020/ND-CP and Nghị định 232/2026/ND-CP), and establishes WCAG 2.1 AA accessibility compliance.

### 2.2 Core Objectives
- **Security & Authorization**: Enforce authenticated session binding via HTTP-only cookies and Bearer tokens for all protected `/api/**` endpoints. Prevent BOLA/IDOR by validating actor permissions against the target object's ownership hierarchy. Eliminate leader impersonation in directive generation and lock internal network metrics behind environment/role gates.
- **PWA & Push Resilience**: Eliminate Service Worker initialization hangs using bounded `Promise.race` timeouts (4000ms) with direct `getRegistration` fallbacks. Isolate development caching at the Service Worker layer rather than unregistering workers. Ensure VAPID keys are cryptographically unique in production, enable client-side key diffing/rotation, prune 404/410 endpoints, and implement circuit-breaking failure counters (`failureCount >= 5`). Guarantee iOS 16.4+ standalone PWA compatibility.
- **Workspace & DACUM Standards**: Mandate `ReviewActionDialog` for all approvals, capturing complete reviewer identities and delegation context while prohibiting self-approvals. Require validated physical files or verifiable external URLs in `SubmitDeliverableModal` with `sessionStorage` draft persistence. Consolidate duplicate table components into `src/components/tasks/cascading-task-table.tsx` and replace hardcoded name-matching with dynamic `departmentId` resolution.
- **Design System & Hygiene**: Upgrade status tokens to `text-amber-700` (5.02:1) and `text-emerald-700` (5.25:1). Bind typography tokens directly to `Be Vietnam Pro`. Anchor skip link navigation (`#main-content`) across `/login` and `/portal`. Exclude all `.db` and `.db-journal` files from Git tracking.

---

## 3. ARCHITECTURAL INVARIANTS & POLICIES

The following architectural invariants are mandatory and non-negotiable across all pull requests and code modifications:

1. **Session Binding Invariant**: No business logic within an API route handler may consume unverified client-supplied identifiers (`userId`, `registeredById`, `leaderId`) without asserting that the identifier matches the verified session identity (`session.id`) or is explicitly authorized via administrative or executive delegation rules.
2. **Deterministic Error Handling Invariant**: All API endpoints must return structured JSON conforming to RFC 7807 problem details semantics using the standard envelope `{ success: false, code: string, error: string, details?: Record<string, unknown> }`. Status code `401 Unauthorized` is reserved for missing or invalid sessions; `403 Forbidden` is reserved for verified identities lacking object-level permissions; `404 Not Found` is returned when a referenced entity does not exist.
3. **PWA Non-Blocking Invariant**: The main application thread must never await `navigator.serviceWorker.ready` indefinitely. Any lifecycle synchronization must yield or fall back within a maximum bounded window of 4000ms. Service Worker registration must remain active in development environments (`localhost`, `127.0.0.1`) while dynamic application assets bypass caching.
4. **VAPID Cryptographic Integrity Policy**: In `NODE_ENV === "production"`, the application must throw a fatal `VapidConfigurationError` on startup if `NEXT_PUBLIC_VAPID_PUBLIC_KEY` or `VAPID_PRIVATE_KEY` are missing or match hardcoded repository test keys.
5. **DACUM Accountability Policy**: Fast-track or anonymous approval mutations (`quickApprove`) are strictly prohibited. Every status transition to `COMPLETED`, `IN_PROGRESS` (revision requested), or `BLOCKED` (rejected) must record an immutable audit payload containing `reviewedById`, `reviewedByName`, `reviewedByRole`, timestamp, and any active delegation metadata.
6. **Zero-Dummy Deliverable Policy**: Submissions with `fileUrl: "#"` or empty titles are rejected at both client validation and API schema boundaries. A valid submission requires a non-empty name and either a storage-backed URI or an authenticated HTTPS/HTTP resource.
7. **Light-Only Theme Invariant**: In accordance with the QCET Administrative Standard, the user interface operates exclusively in Light Mode via the OKLCH color space. Classes targeting `dark:` and custom dark-theme toggles are strictly barred.
8. **Stateless Organizational Filtering**: Organizational filtering must resolve exclusively through relational entities (`departmentId`, `leadDepartmentId`, `coAssigneeDepartmentIds`). Name-based string heuristic filtering is prohibited.

---

## 4. DETAILED COMPONENT & API SPECIFICATIONS

### 4.1 Authentication, Authorization & BOLA/IDOR Defense

#### 4.1.1 Token Verification & Session Extraction Pipeline

```
+-------------------------------------------------------------------------+
|                       Incoming HTTP Request                             |
+-------------------------------------------------------------------------+
                                     |
                                     v
                 +---------------------------------------+
                 | Cookie: qcet_session OR               |
                 | Authorization: Bearer <jwt_token>     |
                 +---------------------------------------+
                                     |
                                     v
                       [ Extract Token String ]
                                     |
                                     +--------------------+
                                     | Token missing      | Token present
                                     v                    v
                          +--------------------+   +---------------------------+
                          | Return HTTP 401    |   | jsonwebtoken.verify()     |
                          | Unauthorized       |   | using secret JWT_SECRET   |
                          +--------------------+   +---------------------------+
                                                                  |
                                              +-------------------+-------------------+
                                              | Invalid / Expired                     | Valid signature
                                              v                                       v
                                   +--------------------+                 +---------------------------+
                                   | Return HTTP 401    |                 | Verify User.isActive in DB|
                                   | Unauthorized       |                 +---------------------------+
                                   +--------------------+                               |
                                                                        +---------------+---------------+
                                                                        | Inactive/Deleted              | Active user
                                                                        v                               v
                                                             +--------------------+       +---------------------------+
                                                             | Return HTTP 401    |       | Attach RequestContext     |
                                                             | Unauthorized       |       | Proceed to Route Handler  |
                                                             +--------------------+       +---------------------------+
```

##### TypeScript Types & Contracts (`src/lib/auth/server-session.ts`)

```typescript
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";

export const SESSION_COOKIE_NAME = "qcet_session";

export interface AuthenticatedUserSession {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  departmentId: string | null;
  title: string | null;
}

export interface ApiAuthSuccessContext {
  session: AuthenticatedUserSession;
}

export interface ApiErrorResponse {
  success: false;
  code: "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION_ERROR" | "INTERNAL_SERVER_ERROR";
  error: string;
  details?: Record<string, unknown>;
}

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === "production" && !secret) {
    throw new Error("JWT_SECRET environment variable is required in production");
  }
  return secret || "qcet_fallback_secret_key_2026";
}

export async function authenticateRequest(
  request: NextRequest
): Promise<{ session: AuthenticatedUserSession } | { errorResponse: NextResponse }> {
  let token: string | null = null;

  const cookieToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (cookieToken) {
    token = cookieToken;
  }

  if (!token) {
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    }
  }

  if (!token) {
    return {
      errorResponse: NextResponse.json(
        {
          success: false,
          code: "UNAUTHORIZED",
          error: "Yeu cau dang nhap de truy cap tai nguyen (Authentication required)",
        } satisfies ApiErrorResponse,
        { status: 401 }
      ),
    };
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as {
      id: string;
      email: string;
      name: string;
      role: UserRole;
      departmentId?: string | null;
      title?: string | null;
    };

    const dbUser = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        departmentId: true,
        title: true,
        isActive: true,
      },
    });

    if (!dbUser || !dbUser.isActive) {
      return {
        errorResponse: NextResponse.json(
          {
            success: false,
            code: "UNAUTHORIZED",
            error: "Tai khoan khong ton tai hoac da bi vo hieu hoa",
          } satisfies ApiErrorResponse,
          { status: 401 }
        ),
      };
    }

    return {
      session: {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        role: dbUser.role,
        departmentId: dbUser.departmentId,
        title: dbUser.title,
      },
    };
  } catch (_err) {
    return {
      errorResponse: NextResponse.json(
        {
          success: false,
          code: "UNAUTHORIZED",
          error: "Phien lam viec khong hop le hoac da het han",
        } satisfies ApiErrorResponse,
        { status: 401 }
      ),
    };
  }
}
```

#### 4.1.2 Document Access Control Matrix & Secure Endpoints

| Endpoint | Method | Permitted Roles | Business Constraints | Unauthorized Status |
| :--- | :--- | :--- | :--- | :--- |
| `/api/documents` | `GET` | All authenticated (`BAN_GIAM_HIEU`, `TRUONG_PHONG`, `CHUYEN_VIEN`, `VAN_THU`, `ADMIN`) | Non-executive roles restricted to non-confidential docs or docs assigned/drafted by their department | `401` / Filtered |
| `/api/documents` | `POST` | `VAN_THU`, `ADMIN`, `BAN_GIAM_HIEU` | Enters record into official register; `registeredById` forced to `session.id`; atomic sequence increment | `401` / `403` |
| `/api/documents/[id]` | `GET` | All authenticated | Security levels (`MAT`, `TOI_MAT`, `TUYET_MAT`) require BGH/ADMIN or explicit recipient department | `401` / `403` |
| `/api/documents/[id]` | `PATCH` | `VAN_THU`, `ADMIN`, `BAN_GIAM_HIEU`, `TRUONG_PHONG` | Department Head can only update `notes` and `status` if `session.departmentId === leadDepartmentId` | `401` / `403` |
| `/api/documents/[id]` | `DELETE` | `ADMIN` only | Hard delete strictly restricted to administrators; safely unlinks tasks and cleans related records | `401` / `403` |
| `/api/documents/export-excel` | `GET` | `VAN_THU`, `BAN_GIAM_HIEU`, `ADMIN`, `TRUONG_PHONG` | Export registry books (Nghị định 30/2020); Staff (`CHUYEN_VIEN`) cannot perform mass export | `401` / `403` |
| `/api/documents/download` | `GET` | All authenticated | Path traversal defense, file sandbox validation, document security clearance check, byte-range streaming | `401` / `403` / `404` |

#### 4.1.3 Task BOLA/IDOR Prevention Matrix (`/api/tasks/[id]`)

```
                    +------------------------------------+
                    | Client Request:                    |
                    | PATCH /api/tasks/:id               |
                    | (Contains session JWT & payload)   |
                    +------------------------------------+
                                      |
                                      v
                    +------------------------------------+
                    | 1. Authenticate Session            |
                    | Valid session? No -> 401           |
                    +------------------------------------+
                                      | Yes
                                      v
                    +------------------------------------+
                    | 2. Fetch Task from Database        |
                    | prisma.task.findUnique({where:{id}})|
                    +------------------------------------+
                                      |
                       +--------------+--------------+
                       | Task not found              | Task exists
                       v                             v
           +-----------------------+     +----------------------------------------+
           | Return HTTP 404       |     | 3. Evaluate Authorization Ownership    |
           | Not Found             |     | - isAdmin                              |
           +-----------------------+     | - isCreator (createdById === user.id)  |
                                         | - isAssignee (assignees.has(user.id))  |
                                         | - isDepartmentHead (manager of dept)   |
                                         +----------------------------------------+
                                                             |
                                         +-------------------+-------------------+
                                         | Fails all checks                      | Passes criteria
                                         v                                       v
                             +-----------------------+               +-----------------------+
                             | Return HTTP 403       |               | Execute Transaction   |
                             | Forbidden             |               | Return HTTP 200 OK    |
                             +-----------------------+               +-----------------------+
```

##### Ownership Matrix

| Identity / Role | Update Progress/Status | Update Title, Due Date, Priority | Update Primary Assignee | DELETE Task |
| :--- | :--- | :--- | :--- | :--- |
| `ADMIN` | Granted | Granted | Granted | Granted |
| Task Creator (`createdById === session.id`) | Granted | Granted | Granted | Granted |
| Primary Owner (`roleInTask === PRIMARY_OWNER`) | Granted | Granted | Denied | Denied (`403`) |
| Collaborator (`roleInTask === COLLABORATOR`) | Granted | Denied (`403`) | Denied (`403`) | Denied (`403`) |
| Department Head (`TRUONG_PHONG` of task dept) | Granted | Granted | Granted | Denied (`403`) |
| Other Department Staff / Non-Assignee | Denied (`403`) | Denied (`403`) | Denied (`403`) | Denied (`403`) |

##### Implementation Contract (`src/app/api/tasks/[id]/route.ts`)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest, ApiErrorResponse } from "@/lib/auth/server-session";
import { AssigneeRole, TaskStatus, TaskPriority, Prisma } from "@prisma/client";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await authenticateRequest(request);
  if ("errorResponse" in auth) return auth.errorResponse;
  const { session } = auth;
  const { id } = await context.params;

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      assignees: { select: { userId: true, roleInTask: true } },
      department: { select: { id: true } },
    },
  });

  if (!task) {
    return NextResponse.json(
      { success: false, code: "NOT_FOUND", error: "Nhiem vu khong ton tai tren he thong" } satisfies ApiErrorResponse,
      { status: 404 }
    );
  }

  const isAdmin = session.role === "ADMIN";
  const isCreator = task.createdById === session.id;
  const isExecutive = session.role === "BAN_GIAM_HIEU";
  const isAssignee = task.assignees.some((a) => a.userId === session.id);
  const isPrimaryOwner = task.assignees.some(
    (a) => a.userId === session.id && a.roleInTask === AssigneeRole.PRIMARY_OWNER
  );
  const isDepartmentHead =
    session.role === "TRUONG_PHONG" &&
    session.departmentId !== null &&
    session.departmentId === task.departmentId;

  const hasAnyEditPermission = isAdmin || isCreator || isExecutive || isAssignee || isDepartmentHead;

  if (!hasAnyEditPermission) {
    return NextResponse.json(
      { success: false, code: "FORBIDDEN", error: "Ban khong co quyen chinh sua hoac cap nhat nhiem vu nay" } satisfies ApiErrorResponse,
      { status: 403 }
    );
  }

  const body = await request.json();
  const isCollaboratorOnly = isAssignee && !isPrimaryOwner && !isCreator && !isAdmin && !isDepartmentHead && !isExecutive;

  if (isCollaboratorOnly) {
    const attemptedFields = Object.keys(body);
    const allowedCollaboratorFields = ["progressPercent", "progress", "status"];
    const hasDisallowedFields = attemptedFields.some((field) => !allowedCollaboratorFields.includes(field));

    if (hasDisallowedFields) {
      return NextResponse.json(
        { success: false, code: "FORBIDDEN", error: "Nguoi phoi hop chi co quyen cap nhat tien do va trang thai thuc hien" } satisfies ApiErrorResponse,
        { status: 403 }
      );
    }
  }

  const updateData: Prisma.TaskUpdateInput = {};

  if (body.title && !isCollaboratorOnly) updateData.title = body.title.trim();
  if (body.description !== undefined && !isCollaboratorOnly) updateData.description = body.description;
  if (body.dueDate && !isCollaboratorOnly) updateData.dueDate = new Date(body.dueDate);
  if (body.priority && !isCollaboratorOnly) updateData.priority = body.priority as TaskPriority;
  if (body.departmentId && (isAdmin || isExecutive)) updateData.department = { connect: { id: body.departmentId } };

  if (typeof body.progressPercent === "number") {
    updateData.progressPercent = Math.min(100, Math.max(0, body.progressPercent));
  }

  if (body.status) {
    updateData.status = body.status as TaskStatus;
    if (body.status === TaskStatus.COMPLETED) {
      updateData.completedAt = new Date();
      if (updateData.progressPercent === undefined) updateData.progressPercent = 100;
    } else if (task.status === TaskStatus.COMPLETED) {
      updateData.completedAt = null;
    }
  }

  const updatedTask = await prisma.$transaction(async (tx) => {
    if (body.assigneeId && !isCollaboratorOnly) {
      const existingOwner = await tx.taskAssignee.findFirst({
        where: { taskId: id, roleInTask: AssigneeRole.PRIMARY_OWNER },
      });
      if (existingOwner) {
        await tx.taskAssignee.update({
          where: { id: existingOwner.id },
          data: { userId: body.assigneeId },
        });
      } else {
        await tx.taskAssignee.create({
          data: {
            taskId: id,
            userId: body.assigneeId,
            roleInTask: AssigneeRole.PRIMARY_OWNER,
          },
        });
      }
    }

    return tx.task.update({
      where: { id },
      data: updateData,
      include: {
        department: true,
        assignees: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true, role: true } },
          },
        },
      },
    });
  });

  return NextResponse.json({ success: true, data: updatedTask });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await authenticateRequest(request);
  if ("errorResponse" in auth) return auth.errorResponse;
  const { session } = auth;
  const { id } = await context.params;

  const task = await prisma.task.findUnique({
    where: { id },
    select: { id: true, createdById: true },
  });

  if (!task) {
    return NextResponse.json(
      { success: false, code: "NOT_FOUND", error: "Nhiem vu khong ton tai tren he thong" } satisfies ApiErrorResponse,
      { status: 404 }
    );
  }

  const isAdmin = session.role === "ADMIN";
  const isCreator = task.createdById === session.id;

  if (!isAdmin && !isCreator) {
    return NextResponse.json(
      { success: false, code: "FORBIDDEN", error: "Chi nguoi tao nhiem vu hoac Quan tri vien (ADMIN) moi co quyen xoa" } satisfies ApiErrorResponse,
      { status: 403 }
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.document.updateMany({
      where: { linkedTaskId: id },
      data: { linkedTaskId: null },
    });
    await tx.taskAssignee.deleteMany({ where: { taskId: id } });
    await tx.taskDeliverable.deleteMany({ where: { taskId: id } });
    await tx.dacumDelegation.deleteMany({ where: { taskId: id } });
    await tx.executiveResolution.deleteMany({ where: { taskId: id } });
    await tx.task.delete({ where: { id } });
  });

  return NextResponse.json({ success: true, message: "Da xoa nhiem vu va toan bo quan he lien ket thanh cong" });
}
```

#### 4.1.4 Directive Pipeline Hardening (`/api/documents/[id]/directives`)

The directive pipeline previously permitted caller-supplied or fallback executive impersonation. Under the new contract:
- The caller must possess `session.role === "BAN_GIAM_HIEU"` or `session.role === "ADMIN"`. All other roles receive `403 Forbidden`.
- Fallback queries (`prisma.user.findFirst({ where: { role: 'BAN_GIAM_HIEU' } })`) are eliminated. The author ID is bound to `session.id`. Admins designating a proxy must explicitly provide a verified BGH user ID.
- Directive creation, document lifecycle advancement (`status: "DANG_XU_LY"`), and school-level task creation run in a single atomic transaction.

```typescript
// Truncated snippet from src/app/api/documents/[id]/directives/route.ts
let effectiveLeaderId = session.id;
if (isAdmin && body.leaderId && body.leaderId !== session.id) {
  const targetLeader = await prisma.user.findFirst({
    where: { id: body.leaderId, role: "BAN_GIAM_HIEU", isActive: true },
  });
  if (!targetLeader) {
    return NextResponse.json(
      { success: false, code: "VALIDATION_ERROR", error: "Nguoi lanh dao duoc chi dinh khong thuoc Ban Giam hieu" } satisfies ApiErrorResponse,
      { status: 400 }
    );
  }
  effectiveLeaderId = targetLeader.id;
}
```

#### 4.1.5 Network Diagnostics Lockdown (`/api/system/network-info`)

To prevent infrastructure reconnaissance:
1. When `process.env.NODE_ENV === "production"`, the route returns `404 Not Found` unless explicitly enabled by `ENABLE_NETWORK_INFO_DIAGNOSTICS="true"`.
2. When diagnostics are enabled in production, the endpoint enforces `authenticateRequest` and permits access strictly to `session.role === "ADMIN"`.
3. In development environments, queries from loopback interfaces are serviced without authentication.

---

### 4.2 PWA Architecture, Service Worker Lifecycle & Web Push Resilience

#### 4.2.1 Service Worker Initialization & Promise Deadlock Remediation

In standard Web APIs, `navigator.serviceWorker.ready` remains unresolved when clients are unmanaged or undergoing hard reload (`no-cache`). To prevent client lockup, all ready checks run under a `Promise.race` bounded at 4000ms.

```
                    [Initiate Push Registration]
                                 |
                                 v
                     [Notification.permission]
                     (Sync user gesture boundary)
                                 |
                                 v
                   +-----------------------------+
                   |  Promise.race (4000ms limit)|
                   +--------------+--------------+
                                  |
                 +----------------+----------------+
                 |                                 |
          [Resolved < 4000ms]              [Timeout 4000ms]
                 |                                 |
                 v                                 v
      [reg = swReadyPromise]          [Fallback: getRegistration]
                 |                                 |
                 |                    +------------+------------+
                 |                    v                         v
                 |            [Registration found]     [Registration null]
                 |                    |                         |
                 +--------------------+                         v
                                      |                    [Throw Error]
                                      v
                      [pushManager.getSubscription()]
```

##### Implementation Contract (`src/hooks/use-push-notification.ts`)

```typescript
async function getOrAwaitActiveRegistration(): Promise<ServiceWorkerRegistration> {
  if (!("serviceWorker" in navigator)) {
    throw new Error("SERVICE_WORKER_UNSUPPORTED");
  }

  let reg = await navigator.serviceWorker.getRegistration("/sw.js");
  if (!reg) {
    reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  }

  if (reg.active) {
    return reg;
  }

  const SW_READY_TIMEOUT_MS = 4000;
  const timeoutPromise = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("SW_READY_TIMEOUT"));
    }, SW_READY_TIMEOUT_MS);
    if (typeof timer === "object" && "unref" in timer) {
      (timer as unknown as { unref: () => void }).unref();
    }
  });

  try {
    return await Promise.race([navigator.serviceWorker.ready, timeoutPromise]);
  } catch (_err) {
    const fallbackReg = await navigator.serviceWorker.getRegistration("/sw.js");
    if (fallbackReg && (fallbackReg.active || fallbackReg.waiting || fallbackReg.installing)) {
      return fallbackReg;
    }
    throw new Error(`Service Worker ready resolution exceeded ${SW_READY_TIMEOUT_MS}ms without active instance.`);
  }
}
```

#### 4.2.2 Local Development Cache Isolation

The legacy inline script in `src/app/layout.tsx` that unregistered all service workers on `localhost` and `127.0.0.1` has been removed. 
- **Application Shell (`src/app/layout.tsx`)**: Contains only minimal density and theme initialization scripts.
- **Service Worker (`public/sw.js`)**: Inspects `url.hostname`. For `localhost` or `127.0.0.1`, the worker bypasses caching for `/_next/static/` chunks, preventing dev-server cache poisoning while preserving full Web Push and offline fallback testing capabilities.

#### 4.2.3 iOS 16.4+ Standalone PWA Architecture (`src/app/manifest.ts`)

Apple WebKit requires explicit app identity (`id`), scope containment (`scope`), standalone display mode, and synchronous user-gesture permission requests.

```typescript
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    scope: "/",
    start_url: "/",
    name: "QCET E-Office - He thong Dieu hanh Van phong Dien tu",
    short_name: "QCET E-Office",
    description: "He thong Quan ly va Dieu hanh Cong viec Dien tu - Truong Cao dang Ky thuat Quy Nhon",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#fbfbfb",
    theme_color: "#fbfbfb",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Tao viec moi",
        short_name: "Tao viec",
        description: "Mo nhanh hop thoai tao nhiem vu moi",
        url: "/?action=create_task",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Viec can xu ly",
        short_name: "Can xu ly",
        description: "Truy cap danh sach cong viec can xu ly",
        url: "/?zone=tasks&filter=needs_review",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Lich cong tac",
        short_name: "Lich",
        description: "Xem lich cong tac tuan va thang",
        url: "/?zone=calendar",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
```

#### 4.2.4 Web Push Protocol Compliance & VAPID Key Rotation

1. **RFC Standards Compliance**:
   - **RFC 8030**: Generic HTTP Push with `TTL: 86400` and `Urgency: high` (for urgent directives/new tasks) or `normal` (for status updates).
   - **RFC 8291**: Message payload encryption using ECDH over curve P-256 (`prime256v1`) and HMAC-SHA-256 (`aes128gcm`).
   - **RFC 8292**: VAPID application server authentication with claims `aud`, `exp` (≤ 24h), and `sub` (`mailto:admin@qcet.edu.vn`).
2. **Production Key Guard**:
   In `src/lib/push-service.ts`, `ensureVapidConfigured()` verifies that production keys are defined and not equal to fallback constants:

```typescript
export class VapidConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VapidConfigurationError";
  }
}

export function ensureVapidConfigured(): { publicKey: string; privateKey: string; subject: string } {
  const isProduction = process.env.NODE_ENV === "production";
  const envPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const envPrivateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const envSubject = process.env.VAPID_SUBJECT?.trim() || "mailto:admin@qcet.edu.vn";

  if (isProduction) {
    if (!envPublicKey || !envPrivateKey) {
      throw new VapidConfigurationError("CRITICAL: VAPID keys are missing in production environment.");
    }
    if (envPublicKey === FALLBACK_VAPID_PUBLIC_KEY || envPrivateKey === FALLBACK_VAPID_PRIVATE_KEY) {
      throw new VapidConfigurationError("CRITICAL: Insecure fallback VAPID keys detected in production.");
    }
  }

  const publicKey = envPublicKey || FALLBACK_VAPID_PUBLIC_KEY;
  const privateKey = envPrivateKey || FALLBACK_VAPID_PRIVATE_KEY;
  const subject = envSubject;

  if (!isVapidConfigured) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    isVapidConfigured = true;
  }

  return { publicKey, privateKey, subject };
}
```

3. **Client-Side Key Rotation**:
   When the server rotates its VAPID public key, client subscriptions signed with the prior key receive `401/403` from push gateways. The client compares `existingSub.options.applicationServerKey` against the server's current key:

```typescript
function areBuffersEqual(buf1: ArrayBuffer | null, buf2: ArrayBuffer | null): boolean {
  if (!buf1 || !buf2) return false;
  if (buf1.byteLength !== buf2.byteLength) return false;
  const view1 = new Uint8Array(buf1);
  const view2 = new Uint8Array(buf2);
  for (let i = 0; i < view1.length; i++) {
    if (view1[i] !== view2[i]) return false;
  }
  return true;
}
```

If keys diverge, the client calls `activeSub.unsubscribe()`, notifies the server to remove the endpoint, and acquires a fresh subscription.

#### 4.2.5 Push Subscription Lifecycle & Pruning Architecture

##### Prisma Schema Updates (`prisma/schema.prisma`)

```prisma
enum PushSubscriptionStatus {
  ACTIVE
  REVOKED
}

model PushSubscription {
  id               String                 @id @default(cuid())
  userId           String                 @map("user_id")
  endpoint         String                 @unique
  p256dh           String
  auth             String
  userAgent        String?                @map("user_agent")
  deviceType       String?                @map("device_type")
  status           PushSubscriptionStatus @default(ACTIVE)
  failureCount     Int                    @default(0) @map("failure_count")
  lastFailureCode  Int?                   @map("last_failure_code")
  createdAt        DateTime               @default(now()) @map("created_at")
  updatedAt        DateTime               @updatedAt @map("updated_at")

  user             User                   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, status])
  @@map("push_subscriptions")
}
```

##### Circuit-Breaker & Pruning Logic (`src/lib/push-service.ts`)
- **Permanent Invalidation (`404 Not Found`, `410 Gone`)**: Transition endpoint immediately to `status: "REVOKED"`.
- **Transient Failures (`429`, `500`, `502`, `503`, `504`)**: Increment `failureCount` by 1 and store `lastFailureCode`.
- **Circuit Breaker Threshold**: If `failureCount >= 5`, automatically transition to `status: "REVOKED"` with `lastFailureCode = 410`.
- **Self-Healing Recovery**: On any successful delivery (`200` or `201`), reset `failureCount = 0` and `lastFailureCode = null`.

---

### 4.3 Workspace Architecture, Action Queue & DACUM Review Pipeline

#### 4.3.1 Universal Action Queue (`UniversalActionQueue`)

The `UniversalActionQueue` enforces a strict two-lane triage architecture (`grid grid-cols-1 lg:grid-cols-2 gap-3.5`):
1. **Lane 1: Incoming Approvals (Hàng đợi Thẩm định)**:
   - Visible to authorized reviewers (`BAN_GIAM_HIEU`, Department Heads, or designated delegates).
   - Renders task code, submitter, DACUM compliance score (`complianceScore`), and deadline.
   - Action trigger: Invokes `onOpenReviewDialog(task)`. Anonymous or direct inline approval mutations are eliminated.
2. **Lane 2: My Pending Submissions (Nhiệm vụ Cần nộp Minh chứng)**:
   - Displays tasks assigned to the current user that require deliverables.
   - Highlights overdue items (`isOverdue || dueDate < today`) with `border-rose-500/30` and `tabular-nums` formatting.
   - Action trigger: Invokes `onOpenSubmitModal(task)`.

##### Interfaces & Types (`src/components/workspace/types.ts`)

```typescript
import { SchoolTask, StaffTask, UserRole } from "@/types/dashboard";

export interface ActionQueueApprovalItem {
  task: SchoolTask | StaffTask;
  submittedBy?: string;
  submittedAt?: string;
  complianceScore?: number;
  deliverableSummary?: string;
  deliverableUrl?: string;
  isDelegatedReview?: boolean;
  delegatorName?: string;
}

export interface ActionQueueSubmissionItem {
  task: StaffTask;
  dueDate?: string;
  isOverdue?: boolean;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  requiredDeliverableType?: string;
}

export interface UniversalActionQueueItems {
  pendingApprovals: ActionQueueApprovalItem[];
  myPendingSubmissions: ActionQueueSubmissionItem[];
}

export interface UniversalActionQueueProps {
  actionQueue: UniversalActionQueueItems;
  scope?: "school" | "unit" | "my";
  className?: string;
  onSelectTask: (task: SchoolTask | StaffTask) => void;
  onOpenReviewDialog: (task: SchoolTask | StaffTask) => void;
  onOpenSubmitModal: (task: StaffTask) => void;
}
```

#### 4.3.2 Review Action Dialog (`ReviewActionDialog`)

Enforces quality control and compliance with Vietnamese Administrative Law (Nghị định 232/2026/ND-CP):
- **Decision Options**:
  - `approved`: Completes the task (`COMPLETED`). Feedback note is optional.
  - `revision_requested`: Keeps the task `IN_PROGRESS` with deliverable status `REVISION_REQUESTED`. Feedback note is **mandatory** (minimum 5 characters).
  - `rejected`: Transitions the task to `BLOCKED`. Feedback note is **mandatory** (minimum 5 characters).
- **Audit Trail & Identity Binding**: Submits `reviewedById`, `reviewedByName`, `reviewedByRole`, timestamp, and delegation context (`grantorId`, `ruleId`).
- **Separation of Duties (Self-Approval Prevention)**: If `session.user.id === task.assigneeId`, the submission button is disabled with the error: *"Cán bộ không được tự phê duyệt nhiệm vụ của chính mình"*.

##### Approval State Flow

```
[User triggers Action Queue]
          |
          v Click "Thẩm định"
[Check Role & Delegation Clearance]
  |-- User === Assignee? --> Block with "Self-Approval Prohibited"
  +-- Authorized Reviewer?
          |
          v
[Open ReviewActionDialog]
  |-- Render deliverable link & preview
  |-- Render DACUM compliance score
  |-- Select Decision: Approved | Revision | Rejected
  |-- Enter feedback (Mandatory >= 5 chars for Revision/Rejected)
          |
          v Click "Xác nhận thẩm định"
[Client Validation]
          |
          v
[Form Payload with Session Identity]
  {
    taskId: task.id,
    decision: "approved" | "revision_requested" | "rejected",
    comment: string,
    reviewedById: session.id,
    reviewedByName: session.name,
    reviewedByRole: session.role,
    delegatedGrantorId?: string
  }
          |
          v
[Optimistic UI Update]
  |-- Approved: status = COMPLETED, progress = 100%
  |-- Revision: status = IN_PROGRESS, deliverable = REVISION_REQUESTED
  |-- Rejected: status = BLOCKED, rejectionReason = comment
          |
          +-- Offline? --> Store in offline mutation queue
          v Online
[Execute HTTP Mutation: PATCH /api/tasks/:id]
  |-- 200 OK: Persist mutation, show toast, remove from queue
  +-- Error: Roll back optimistic update, surface error alert
```

#### 4.3.3 Deliverable Submission Modal (`SubmitDeliverableModal`)

Eliminates dummy `#` URLs and guarantees authentic deliverable tracking:
- **Input Validation**: Requires a deliverable name (minimum 3 characters) and either an uploaded binary document (PDF, DOCX, XLSX, ZIP) or a valid HTTP/HTTPS online URL.
- **Client Draft Persistence**: Saves in-progress input to `sessionStorage` under `qcet_deliverable_draft_${taskId}` to prevent data loss on accidental dismissal or network interruption. Clears draft upon successful submission.

##### Validation Helper (`src/components/portal/submit-deliverable-modal.tsx`)

```typescript
export function validateDeliverableSubmission(
  deliverableName: string,
  url?: string
): { isValid: boolean; error?: string } {
  const trimmedName = (deliverableName || "").trim();
  const trimmedUrl = (url || "").trim();

  if (!trimmedName) {
    return {
      isValid: false,
      error: "Vui long nhap ten minh chung hoac tai len tep dinh kem.",
    };
  }

  if (trimmedUrl) {
    const isValidUrl =
      trimmedUrl.startsWith("http://") ||
      trimmedUrl.startsWith("https://") ||
      trimmedUrl.includes("drive.google.com") ||
      trimmedUrl.includes("onedrive.live.com");

    if (!isValidUrl) {
      return {
        isValid: false,
        error: "Duong dan lien ket khong dung dinh dang (can bat dau bang https:// hoac http://).",
      };
    }
  }

  return { isValid: true };
}
```

#### 4.3.4 Table Component Consolidation & Dynamic Filtering

1. **File Consolidation**:
   - `src/components/dashboard/cascading-task-table.tsx` (legacy) is deprecated and converted into a re-export proxy pointing to `src/components/tasks/cascading-task-table.tsx`.
   - All consumer imports are migrated to `@/components/tasks/cascading-task-table`.
   - After test verification, the legacy file is scheduled for permanent deletion.
2. **Dynamic Department Filtering**:
   Legacy filtering relied on hardcoded name strings (`Xuân`, `Huy`, `Thanh`, `Nam`). The consolidated table resolves departments dynamically via `departmentId` and relational metadata:

```typescript
// src/components/tasks/cascading-task-table.tsx
export function filterTasksForTable(
  tasks: SchoolTask[],
  category: TaskCategory | "ALL",
  searchQuery: string,
  department: string = "ALL"
): SchoolTask[] {
  let result = tasks;

  if (department !== "ALL") {
    const targetDept = department.trim().toUpperCase();

    result = result.filter((task) => {
      const schoolTaskLeadDept =
        task.leadDepartmentId ||
        resolveDepartmentId(task.leadDepartment, task.leadAssigneeName, task.category);

      const isLeadDeptMatch = schoolTaskLeadDept === targetDept;

      const isCoAssigneeDeptMatch = task.coAssigneeDepartmentIds
        ? task.coAssigneeDepartmentIds.includes(targetDept)
        : task.coAssignees?.some(
            (assignee) => resolveDepartmentId(undefined, assignee) === targetDept
          );

      const isSubTaskDeptMatch = task.subTasks?.some((sub) => {
        const subDept =
          sub.departmentId ||
          resolveDepartmentId(sub.department, sub.assigneeName);
        return subDept === targetDept;
      });

      return isLeadDeptMatch || isCoAssigneeDeptMatch || isSubTaskDeptMatch;
    });
  }

  if (category !== "ALL") {
    result = result.filter((task) => task.category === category);
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    result = result.filter((task) => {
      const matchTitle = task.title.toLowerCase().includes(q);
      const matchAssignee = task.leadAssigneeName.toLowerCase().includes(q);
      const matchSubTasks = task.subTasks?.some(
        (sub) =>
          sub.title.toLowerCase().includes(q) ||
          sub.assigneeName.toLowerCase().includes(q)
      );
      return matchTitle || matchAssignee || matchSubTasks;
    });
  }

  return result;
}
```

---

### 4.4 Design System Standardization, WCAG 2.1 AA & Repository Hygiene

#### 4.4.1 WCAG 2.1 AA Color Contrast Remediation (`src/lib/tokens.ts`)

| Status Token | Legacy Value | Remediated Value | Hex Code | Contrast vs #FFFFFF | WCAG 2.1 AA Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `statusColors.needsReview` | `text-amber-600` | `text-amber-700` | `#B45309` | 5.02:1 | PASS (Threshold ≥ 4.5:1) |
| `statusColors.completed` | `text-emerald-600` | `text-emerald-700` | `#047857` | 5.25:1 | PASS (Threshold ≥ 4.5:1) |

##### Updated Token Configuration (`src/lib/tokens.ts`)

```typescript
export const QCET_TOKENS = {
  statusColors: {
    needsReview: {
      classes: "bg-amber-500/10 text-amber-700 border-amber-500/20",
      text: "text-amber-700",
    },
    completed: {
      classes: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
      text: "text-emerald-700",
    },
    // ... other tokens remain unchanged
  },
  typography: {
    fontSans: "var(--font-sans), 'Be Vietnam Pro', system-ui, sans-serif",
    fontHeading: "var(--font-heading), 'Plus Jakarta Sans', system-ui, sans-serif",
    fontMono: "var(--font-mono), 'JetBrains Mono', monospace",
  },
} as const;
```

#### 4.4.2 Landmark Skip Link Target Binding

The global skip link in `src/app/layout.tsx` targets `<a href="#main-content">Chuyển đến nội dung chính</a>`. Routes `/login` and `/portal` bypass the standard `AppShell` container. To satisfy WCAG 2.1 SC 2.4.1 (Bypass Blocks):
- **`/login/page.tsx`**:
  ```tsx
  <main
    id="main-content"
    tabIndex={-1}
    role="main"
    aria-label="Trang dang nhap QCET E-Office"
    className="relative flex min-h-[100dvh] w-full flex-col justify-between bg-background selection:bg-primary/15 selection:text-primary outline-none"
  >
  ```
- **`/portal/page.tsx`**:
  ```tsx
  <main
    id="main-content"
    tabIndex={-1}
    className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-12 md:py-16 flex flex-col justify-center outline-none"
  >
  ```

#### 4.4.3 Git Repository Hygiene (`.gitignore`)

Add explicit exclusion rules for local SQLite databases and lock files to `.gitignore`:

```gitignore
# SQLite Database files & journals
*.db
*.db-journal
*.sqlite
*.sqlite-journal
dev.db
prisma/dev.db
```

---

## 5. TEST SPECIFICATIONS & VERIFICATION PLAN

### 5.1 Security Regression Test Suite (`tests/security-regression.test.ts`)

```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";

describe("Security & Access Control Regression Suite", () => {
  test("Unauthenticated request to /api/tasks/:id returns 401 Unauthorized", async () => {
    // Assert 401 code and structured RFC 7807 error payload
  });

  test("Collaborator cannot update task title, due date, or primary assignee (returns 403)", async () => {
    // Assert 403 when collaborator attempts to modify restricted fields
  });

  test("Non-assignee cannot edit or delete task (BOLA prevention returns 403)", async () => {
    // Assert 403 for unauthorized cross-department user
  });

  test("Non-BGH user cannot post directive to /api/documents/:id/directives (returns 403)", async () => {
    // Assert 403 when caller role is CHUYEN_VIEN or TRUONG_PHONG
  });

  test("Directive endpoint does not fallback to random BGH leader when leaderId is missing", async () => {
    // Assert effectiveLeaderId strictly equals session.id
  });

  test("/api/system/network-info returns 404 in production without explicit diagnostics flag", async () => {
    // Assert 404 concealment in production mode
  });
});
```

### 5.2 PWA & Web Push Test Suite (`tests/push-resilience.test.ts`)

```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";

describe("PWA & Push Resilience Suite", () => {
  test("Service Worker ready resolution does not hang beyond 4000ms", async () => {
    // Simulate delayed sw.ready promise; assert Promise.race falls back to getRegistration
  });

  test("Production push service throws VapidConfigurationError if fallback keys detected", async () => {
    // Set NODE_ENV='production' and VAPID key to fallback; assert fatal throw
  });

  test("Push dispatcher marks subscription REVOKED upon receiving 410 Gone or 404 Not Found", async () => {
    // Mock webpush rejecting with 410; assert DB record updated to status: REVOKED
  });

  test("Push dispatcher revokes subscription when failureCount accumulates to 5", async () => {
    // Simulate 5 consecutive 500 errors; assert transition to REVOKED
  });

  test("Successful push delivery resets failureCount to 0 and clears lastFailureCode", async () => {
    // Simulate success after prior failures; assert counters reset
  });

  test("Client rotates subscription when applicationServerKey mismatches active VAPID key", async () => {
    // Assert unsubscribe and re-subscription flow
  });
});
```

### 5.3 Workspace & Action Queue Test Suite (`tests/workspace-action-queue.test.ts`)

```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { validateDeliverableSubmission } from "@/components/portal/submit-deliverable-modal";
import { filterTasksForTable } from "@/components/tasks/cascading-task-table";

describe("Workspace & Action Queue Suite", () => {
  test("Deliverable submission rejects empty deliverable names", () => {
    const result = validateDeliverableSubmission("");
    assert.equal(result.isValid, false);
  });

  test("Deliverable submission rejects invalid non-HTTP URL strings like '#'", () => {
    const result = validateDeliverableSubmission("Bao cao DACUM", "#");
    assert.equal(result.isValid, false);
  });

  test("Deliverable submission accepts valid HTTPS external links", () => {
    const result = validateDeliverableSubmission("Bao cao DACUM", "https://drive.google.com/file/d/123");
    assert.equal(result.isValid, true);
  });

  test("Department filter correctly filters tasks via departmentId without hardcoded name matching", () => {
    // Provide sample tasks with varying leadDepartmentId; assert exact array filtering
  });
});
```

### 5.4 Design System & Accessibility Test Suite (`tests/theme-standardization.test.ts`)

```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { QCET_TOKENS } from "@/lib/tokens";

describe("Design System & Accessibility Standards Suite", () => {
  test("QCET_TOKENS.statusColors.needsReview satisfies WCAG 2.1 AA contrast requirements", () => {
    assert.equal(QCET_TOKENS.statusColors.needsReview.text, "text-amber-700");
    assert.ok(QCET_TOKENS.statusColors.needsReview.classes.includes("text-amber-700"));
  });

  test("QCET_TOKENS.statusColors.completed satisfies WCAG 2.1 AA contrast requirements", () => {
    assert.equal(QCET_TOKENS.statusColors.completed.text, "text-emerald-700");
    assert.ok(QCET_TOKENS.statusColors.completed.classes.includes("text-emerald-700"));
  });

  test("Typography tokens configure Be Vietnam Pro as primary sans fallback", () => {
    assert.ok(QCET_TOKENS.typography.fontSans.includes("Be Vietnam Pro"));
  });
});
```

---

## 6. STEP-BY-STEP IMPLEMENTATION ROADMAP & ACCEPTANCE CRITERIA

```
+-------------------------------------------------------------------------------+
| PHASE 1: Security Hardening & Session Binding (P0)                            |
| Tasks: authenticateRequest, BOLA checks, directive pipeline, network-info     |
+-------------------------------------------------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
| PHASE 2: PWA, Service Worker & Web Push Resilience (P0)                       |
| Tasks: SW 4000ms race, layout unregister removal, VAPID guards, 410 pruning   |
+-------------------------------------------------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
| PHASE 3: Workspace, Action Queue & Table Consolidation (P1)                   |
| Tasks: ActionQueue dialogs, deliverable modal, deprecate duplicate table      |
+-------------------------------------------------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
| PHASE 4: Design System Tokens, WCAG 2.1 AA & Git Hygiene (P1)                 |
| Tasks: Contrast updates, #main-content anchors, .gitignore sqlite rules        |
+-------------------------------------------------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
| PHASE 5: Comprehensive Verification & Regression Gate                         |
| Tasks: npm run typecheck && npm test across all test suites                   |
+-------------------------------------------------------------------------------+
```

### 6.1 Phase 1: Security Hardening & Session Binding (P0)
- **Step 1.1**: Deploy `authenticateRequest` in `src/lib/auth/server-session.ts` and apply to all routes under `src/app/api/documents/**`.
- **Step 1.2**: Implement the complete BOLA/IDOR matrix in `src/app/api/tasks/[id]/route.ts` for `PATCH` and `DELETE`.
- **Step 1.3**: Refactor `src/app/api/documents/[id]/directives/route.ts` to enforce `BAN_GIAM_HIEU` and `ADMIN` role checks and remove fallback impersonation.
- **Step 1.4**: Secure `src/app/api/system/network-info/route.ts` with environment and administrator role checks.
- **Acceptance Gate 1**: All security tests in `tests/security-regression.test.ts` pass without errors.

### 6.2 Phase 2: PWA, Service Worker & Web Push Resilience (P0)
- **Step 2.1**: Update `src/hooks/use-push-notification.ts` with the 4000ms `Promise.race` timeout guard and client-side key diffing.
- **Step 2.2**: Remove the inline worker unregister script from `src/app/layout.tsx` and configure bypass caching in `public/sw.js`.
- **Step 2.3**: Update `src/app/manifest.ts` with Apple WebKit container identifiers (`id: "/"`, `scope: "/"`).
- **Step 2.4**: Update `prisma/schema.prisma` with `PushSubscriptionStatus`, `failureCount`, and `lastFailureCode`. Run `npx prisma db push`.
- **Step 2.5**: Integrate pruning and circuit breaker logic into `src/lib/push-service.ts`.
- **Acceptance Gate 2**: Push resilience tests in `tests/push-resilience.test.ts` pass without errors.

### 6.3 Phase 3: Workspace, Action Queue & Table Consolidation (P1)
- **Step 3.1**: Integrate `ReviewActionDialog` and `SubmitDeliverableModal` into `UniversalActionQueue` and `UnifiedAdaptiveWorkspace`.
- **Step 3.2**: Enforce `validateDeliverableSubmission` to block empty deliverables and `#` URLs.
- **Step 3.3**: Convert `src/components/dashboard/cascading-task-table.tsx` into a re-export proxy pointing to `src/components/tasks/cascading-task-table.tsx`.
- **Step 3.4**: Replace name-based filtering in `src/components/tasks/cascading-task-table.tsx` with dynamic `departmentId` resolution.
- **Acceptance Gate 3**: Workspace action queue and filter tests in `tests/workspace-action-queue.test.ts` pass without errors.

### 6.4 Phase 4: Design System Tokens, WCAG 2.1 AA & Git Hygiene (P1)
- **Step 4.1**: Update `statusColors.needsReview` to `text-amber-700` and `statusColors.completed` to `text-emerald-700` in `src/lib/tokens.ts`.
- **Step 4.2**: Set `typography.fontSans` fallback to `Be Vietnam Pro` in `src/lib/tokens.ts`.
- **Step 4.3**: Add `id="main-content"` and `tabIndex={-1}` to `<main>` containers in `src/app/login/page.tsx` and `src/app/portal/page.tsx`.
- **Step 4.4**: Append SQLite database exclusions (`*.db`, `*.db-journal`, `dev.db`, `prisma/dev.db`) to `.gitignore`.
- **Acceptance Gate 4**: Design token and accessibility tests in `tests/theme-standardization.test.ts` pass without errors.

### 6.5 Phase 5: Comprehensive Verification & Regression Gate
- Run `npm run typecheck` (`tsc --noEmit`) to verify zero TypeScript errors.
- Run `npm test` (`tsx --test tests/**/*.test.ts`) to confirm all unit, integration, and security regression test suites pass.
- Verify that `git status --porcelain` contains no untracked `.db` files or orphaned build artifacts.