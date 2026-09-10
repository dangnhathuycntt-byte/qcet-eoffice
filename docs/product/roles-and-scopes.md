# QCET E-Office — Roles and Scopes Architecture

**Document Status**: Canonical Reference  
**Scope**: Authorization Hierarchy, Dataset Scopes, Role-to-Scope Separation  
**Last Updated**: 2026-09-09  

---

## 1. Core Principle: Role Is Not Scope

In QCET E-Office, **Role** and **Scope** are strictly decoupled orthogonal concepts:

```
┌──────��─────────────────────────────────────────────────┐
│  ROLE = Authority & Capabilities (What can I DO?)      │
│  Examples: Approve deliverables, create school tasks,  │
│            assign department members, view audit logs.  │
└────────────────────────────────────────────────────────┘
                           ≠
┌────────────────────────────────────────────────────────┐
│  SCOPE = Dataset View Filter (What am I VIEWING?)      │
│  Examples: Toàn trường (school), Đơn vị (unit),        │
│            Cá nhân (my).                               │
└────────────────────────────────────────────────────────┘
```

Changing the active Scope switches the data filter applied by `useTaskFilters` and API queries. It never alters, escalates, or revokes the user's underlying permissions.

---

## 2. Institutional Roles & Normalization Hierarchy

QCET operates under the administrative structure of a Vietnamese vocational college (Cao đẳng Công nghệ Quang Châu). The platform recognizes granular institutional titles and normalizes them into three core authorization tiers via `normalizeUserRole` in `src/hooks/use-auth-role.ts`:

### 2.1 Role Normalization Mapping

| Institutional Role / Title | Database & Alias Values | Normalized Tier | Core Authority & System Responsibilities |
|---|---|---|---|
| **Quản trị hệ thống** | `ADMIN` | `ADMIN` | System configuration, user provisioning, global auditing, emergency overrides. |
| **Ban Giám hiệu** (Hiệu trưởng, Phó Hiệu trưởng) | `BAN_GIAM_HIEU`, `BGH`, `HIEU_TRUONG`, `PHO_HIEU_TRUONG`, `EXECUTIVE` | `ADMIN` (Executive) | Institution-wide task issuance, strategic directives, final deliverable approvals, bottleneck resolutions. |
| **Trưởng đơn vị / Trưởng phòng / Trưởng khoa** | `TRUONG_DON_VI`, `TRUONG_PHONG`, `TRUONG_KHOA`, `DEPARTMENT_HEAD`, `DEAN`, `MANAGER` | `MANAGER` | Department task decomposition, member assignment, deliverable review, department progress tracking. |
| **Phó đơn vị / Phó phòng / Phó khoa** | `PHO_PHONG`, `PHO_KHOA`, `LEADER` | `MANAGER` | Delegated department task management, review assistance, team coordination. |
| **Chuyên viên** | `CHUYEN_VIEN`, `STAFF` | `STAFF` | Administrative task execution, deliverable submission, personal agenda tracking. |
| **Giảng viên** | `GIANG_VIEN`, `LECTURER` | `STAFF` | Academic task execution, curriculum development, syllabus and grade submissions. |

---

## 3. Dataset Scopes

Scopes define the breadth of records retrieved and rendered across the unified workspace and dashboard:

### 3.1 Scope Definitions
1. **School Scope (`school` - Toàn trường)**:
   - **Boundary**: All institutional tasks, official dispatches, directives, and department milestones across the entire college.
   - **Audience**: Ban Giám hiệu and Admins for high-level monitoring, bottleneck resolution, and institutional coordination.
2. **Unit Scope (`unit` - Đơn vị / Khoa / Phòng)**:
   - **Boundary**: Tasks, deliverables, and dispatches assigned to or drafted by the user's primary department (`departmentCode`).
   - **Audience**: Department heads, deputy heads, and staff members collaborating on departmental projects.
3. **Personal Scope (`my` - Cá nhân)**:
   - **Boundary**: Tasks where the authenticated user is the primary assignee (`assigneeId`), creator (`createdById`), supervisor (`supervisorId`), or designated collaborator.
   - **Audience**: All users focusing on their day-to-day workload and immediate action items.

### 3.2 Scope Permission Matrix

| Role Tier | `my` Scope | `unit` Scope | `school` Scope | Default Landed Scope |
|---|:---:|:---:|:---:|:---:|
| **Executive (`BAN_GIAM_HIEU`, `ADMIN`)** | Full Read/Write | Full Read/Write | Full Read/Write | `school` |
| **Manager (`TRUONG_DON_VI`, `PHO_PHONG`)** | Full Read/Write | Full Read/Write | Read-only Overview | `unit` |
| **Staff (`CHUYEN_VIEN`, `GIANG_VIEN`)** | Full Read/Write | Read-only Collab | Prohibited / Hidden | `my` |

---

## 4. Concrete Operational Scenarios

### Scenario A: Executive Reviewing Personal Work
- **Actor**: Dr. Nguyen (Role: `BAN_GIAM_HIEU`).
- **Action**: Switches workspace scope switcher from `school` to `my`.
- **Result**:
  - The table displays only tasks directly assigned to Dr. Nguyen.
  - **Crucial Invariant**: Dr. Nguyen's executive authority is unchanged. If Dr. Nguyen opens an action modal or accesses `/api/executive/resolutions`, the request succeeds because the server evaluates Dr. Nguyen's `BAN_GIAM_HIEU` role, not the `my` view filter.

### Scenario B: Specialist Viewing Department Workbox
- **Actor**: Nguyen Van A (Role: `CHUYEN_VIEN`, Dept: `PHONG_DAO_TAO`).
- **Action**: Views `unit` scope to see the department's exam preparation tasks.
- **Result**:
  - The table lists all tasks belonging to `PHONG_DAO_TAO`.
  - **Crucial Invariant**: Nguyen Van A cannot approve deliverables submitted by colleagues. The UI disables approval actions, and the backend `/api/tasks/[id]/deliverables` handler rejects approval requests with `403 Forbidden` because Nguyen Van A lacks the `MANAGER` or `BAN_GIAM_HIEU` role.

---

## 5. Implementation Invariants

1. **Client Guard**: The `ScopeSwitcher` component evaluates `isScopeAllowed(user.role, targetScope)` before allowing scope transitions.
2. **Server Enforcement**: API routes must accept `scope` as a query parameter for filtering, but authorization checks must inspect `session.role` and `session.departmentCode`.
3. **No Role Assumption from Scope**: Never infer a user's role from the currently active scope.
