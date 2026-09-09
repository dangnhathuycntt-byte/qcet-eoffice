# QCET E-Office — Authentication & Security Architecture

**Document Status**: Canonical Reference  
**Scope**: Session Lifecycle, JWT Verification, RBAC Enforcement, Security Boundaries  
**Last Updated**: 2026-09-09  

---

## 1. Core Security Invariant: Server Truth Wins

In QCET E-Office, the server session is the sole authority for authentication and authorization.
- **Client State as Ephemeral Cache**: Any user object or role stored in browser storage (`localStorage`, `sessionStorage`, React context) is treated strictly as an unverified display cache.
- **Authoritative Verification**: Every mutating API request, privileged document access, or approval action must cryptographically verify the server session token and re-validate user permissions against the database.
- **Zero Client Trust**: Server route handlers never trust role claims, user IDs, or department codes passed in HTTP request bodies or query parameters.

---

## 2. Session Model & Token Lifecycle

Authentication is implemented via signed JSON Web Tokens (JWT) managed in `src/lib/jwt-session.ts`:

### 2.1 Token Configuration
- **Cookie Name**: `qcet_session`
- **Max Age**: 30 days (`2,592,000` seconds).
- **Attributes**: `HttpOnly`, `SameSite=Lax`, `Secure` in production environments.
- **Fallback Bearer Header**: API route handlers support `Authorization: Bearer <token>` for programmatic API access and automated testing.

### 2.2 Session Payload Schema
```typescript
export interface SessionPayload {
  id: string;                                                         // Unique User ID (CUID)
  email: string;                                                      // User email
  name: string;                                                       // Full display name
  role: UserRole | "BAN_GIAM_HIEU" | "TRUONG_PHONG" | "CHUYEN_VIEN";  // Canonical role
  departmentId?: string | null;                                       // Department ID
  title?: string | null;                                              // Institutional title
}
```

### 2.3 Login & Logout Flows
1. **Login Channels**:
   - **Google Workspace OAuth** (`/api/auth/callback/google`): Institutional `@qcet.edu.vn` accounts. Verifies ID token with Google API, provisions or updates User row in Prisma.
   - **Credentials Login**: Validates password against `passwordHash` using `bcryptjs.compare`.
2. **Session Issuance**:
   - On successful authentication, `signSessionToken(payload)` signs a JWT using the server `JWT_SECRET`.
   - The token is set in the `qcet_session` HTTP-only cookie.
3. **Logout**:
   - Clears the `qcet_session` cookie by setting max age to 0.
   - Client context (`src/lib/auth-context.tsx`) flushes local in-memory state and redirects to `/login`.

---

## 3. Server-Side RBAC Enforcement

Route handlers in `src/app/api/**` enforce Role-Based Access Control (RBAC) before executing database transactions:

```typescript
// Canonical Pattern in API Handlers
const session = await getSessionFromRequest(req);
if (!session) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

// Privileged Operation Guard (e.g. Directive issuance, Executive resolution)
const isPrivileged = ["BAN_GIAM_HIEU", "ADMIN"].includes(session.role);
if (!isPrivileged) {
  return NextResponse.json({ error: "Forbidden - Yêu cầu quyền Ban Giám hiệu" }, { status: 403 });
}
```

### Institutional Role Boundaries:
- `BAN_GIAM_HIEU` & `ADMIN`: Full authority across all departments; can issue directives, reassign leads, dismiss bottlenecks, and approve school-level tasks.
- `TRUONG_DON_VI` / `TRUONG_PHONG`: Department authority; can assign department members, review deliverables for their unit, and update department tasks.
- `CHUYEN_VIEN` / `GIANG_VIEN`: Operational execution; can submit deliverables for assigned tasks and update personal progress.

---

## 4. Separation of Duties (Maker-Checker Invariant)

To uphold institutional integrity:
1. **Task Deliverables Review**:
   - Implemented in `/api/tasks/[id]/deliverables`.
   - When a staff member submits a deliverable, the handler enforces that the reviewing user must be a Department Head (`TRUONG_PHONG`), Executive (`BAN_GIAM_HIEU`), or designated supervisor.
   - **Self-Approval Ban**: The deliverable submitter cannot act as the sole approver.
2. **Directives & Resolutions**:
   - Implemented in `/api/executive/resolutions`.
   - Only users with verified `BAN_GIAM_HIEU` or `ADMIN` sessions can record binding executive directives.

---

## 5. Security Checklist for Developers

When modifying or adding authentication logic:
- [ ] Never log `JWT_SECRET`, password hashes, or session tokens.
- [ ] Never return `passwordHash` in user API responses.
- [ ] Ensure all new API handlers call `getSessionFromRequest(req)` before mutating state.
- [ ] Verify object-level ownership (BOLA/IDOR protection) when fetching or updating documents by ID.
- [ ] Disallow any demo auth bypasses in production builds (`process.env.NODE_ENV === "production"`).
