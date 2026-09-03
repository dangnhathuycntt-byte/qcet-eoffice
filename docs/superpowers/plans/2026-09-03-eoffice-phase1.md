# E-Office Phase 1 (MVP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete, production-grade Next.js E-Office Web & Cross-Platform App covering all 36 Use Cases of Phase 1 from `Plan_EOffice.xlsx`, adopting the Warm-Paper / Terracotta editorial design system from `/Users/dnhhuy/inf_quota/dashboard`.

**Architecture:** Next.js 15 App Router with TypeScript, Tailwind CSS v4, shadcn/ui components, and Prisma ORM. Uses SQLite (local zero-config) with PostgreSQL compatibility for data persistence, JWT session authentication with RBAC (Admin, Manager, Staff, Student), Server Actions + REST APIs for mobile compatibility, and PWA manifest for multi-platform installability (iOS, Android, macOS, Desktop).

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS v4, Prisma ORM, Lucide React, Recharts, @dnd-kit (Kanban), Plus Jakarta Sans & JetBrains Mono fonts.

**Spec:** `/Users/dnhhuy/Downloads/Telegram Desktop/Plan_EOffice.xlsx` (Sheet: Phase 1 & Overview).

## Global Constraints

- Design System: Warm Paper `#F9F8F6` background (dark `#0E0D0C`), Primary `#E05D38` terracotta, card `#FFFFFF` (dark `#171614`), border `#E8E4DC` (dark `#2B2824`), font `Plus Jakarta Sans` / `Inter` / `JetBrains Mono`.
- Corner radius: `rounded-2xl` for cards, `rounded-xl` for controls and buttons.
- Cross-platform: Mobile viewport (<768px) displays Bottom Navigation Bar + TopBar; Desktop (>=768px) displays Top Floating Pill Navigation.
- Roles: `ADMIN`, `MANAGER`, `STAFF`, `STUDENT`.
- All text in UI in Vietnamese (Tiếng Việt) sesuai nghiệp vụ trường học / văn phòng QCET.

---

### Task 1: Project Scaffolding & Design System Setup

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `postcss.config.mjs`
- Create: `src/app/globals.css`
- Create: `src/app/layout.tsx`
- Create: `src/lib/utils.ts`
- Create: `src/components/theme-provider.tsx`
- Create: `src/components/ui/button.tsx`
- Create: `src/components/ui/card.tsx`
- Create: `src/components/ui/badge.tsx`
- Create: `src/components/navigation.tsx`
- Test: `tests/smoke.test.ts`

**Interfaces:**
- Consumes: None
- Produces: Base layout, Tailwind theme tokens matching `inf_quota`, responsive top header & bottom nav.

- [x] **Step 1: Write test to verify theme tokens and utility functions**
- [x] **Step 2: Initialize Next.js project dependencies in package.json**
- [x] **Step 3: Setup Tailwind CSS with warm paper palette and typography**
- [x] **Step 4: Create base UI components (Button, Card, Badge, Navigation)**
- [x] **Step 5: Run tests and verify build / typecheck passes**
- [x] **Step 6: Commit**

---

### Task 2: Database Layer & Prisma Schema with Seed Data

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/prisma.ts`
- Create: `prisma/seed.ts`
- Test: `tests/db.test.ts`

**Interfaces:**
- Consumes: Task 1 utils
- Produces: Prisma Client with models: User, Department, Task, TaskAssignee, Comment, Attachment, TaskHistory, Notification, AuditLog.

- [ ] **Step 1: Write DB connection and model validation test**
- [ ] **Step 2: Create prisma/schema.prisma with full relational models**
- [ ] **Step 3: Run prisma generate and migrations**
- [ ] **Step 4: Write prisma/seed.ts populating QCET departments and test accounts**
- [ ] **Step 5: Run seed and verify DB test passes**
- [ ] **Step 6: Commit**

---

### Task 3: Auth & RBAC Module (AUTH-01 to AUTH-07)

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/app/api/auth/login/route.ts`
- Create: `src/app/api/auth/logout/route.ts`
- Create: `src/app/api/auth/me/route.ts`
- Create: `src/app/login/page.tsx`
- Create: `src/app/profile/page.tsx`
- Create: `src/middleware.ts`
- Test: `tests/auth.test.ts`

**Interfaces:**
- Consumes: Prisma models User, AuditLog
- Produces: JWT generation, cookie session, password hashing (bcrypt), RBAC authorization guard.

- [ ] **Step 1: Write failing unit test for password hashing, JWT issue & RBAC role checks**
- [ ] **Step 2: Implement src/lib/auth.ts (JWT sign/verify, password hash/compare, audit logging)**
- [ ] **Step 3: Create Login route and responsive Login UI page**
- [ ] **Step 4: Create Profile & Password change page with Audit log display**
- [ ] **Step 5: Setup Next.js middleware protecting /tasks, /calendar, /org**
- [ ] **Step 6: Run tests and commit**

---

### Task 4: Organization Management Module (ORG-01 to ORG-05)

**Files:**
- Create: `src/app/api/departments/route.ts`
- Create: `src/app/api/departments/[id]/route.ts`
- Create: `src/app/org/page.tsx`
- Create: `src/components/org/department-tree.tsx`
- Create: `src/components/org/department-modal.tsx`
- Test: `tests/org.test.ts`

**Interfaces:**
- Consumes: Prisma Department & User models, Auth guard
- Produces: Tree-view organization component, Department CRUD APIs, assign head/members.

- [ ] **Step 1: Write test for recursive department hierarchy tree builder**
- [ ] **Step 2: Implement Department API routes with role validation (Admin only for mutations)**
- [ ] **Step 3: Build Department Tree visual component and Member list**
- [ ] **Step 4: Build Create/Edit Department modal and Assign Head modal**
- [ ] **Step 5: Run tests and commit**

---

### Task 5: Core Task Management & Kanban Board (TASK-01 to 04, 07, 09)

**Files:**
- Create: `src/app/api/tasks/route.ts`
- Create: `src/app/api/tasks/[id]/route.ts`
- Create: `src/app/tasks/page.tsx`
- Create: `src/components/tasks/task-kanban.tsx`
- Create: `src/components/tasks/task-list-table.tsx`
- Create: `src/components/tasks/task-card.tsx`
- Create: `src/components/tasks/create-task-modal.tsx`
- Test: `tests/tasks.test.ts`

**Interfaces:**
- Consumes: Prisma Task, Department, User
- Produces: Task CRUD, Kanban drag-and-drop state update, filtering (My tasks, Dept tasks, Overdue).

- [ ] **Step 1: Write test for task creation, filter query parser, and status transition**
- [ ] **Step 2: Implement Task API routes with pagination, search, status & priority filters**
- [ ] **Step 3: Build Task Kanban View with 4 columns (Cần làm, Đang làm, Chờ duyệt, Hoàn thành)**
- [ ] **Step 4: Build Task Table View with sorting and search**
- [ ] **Step 5: Build Create/Edit Task Dialog (Assign users, department, deadline, priority)**
- [ ] **Step 6: Run tests and commit**

---

### Task 6: Collaboration, Comments, Attachments & History (TASK-05, 06, 08)

**Files:**
- Create: `src/app/api/tasks/[id]/comments/route.ts`
- Create: `src/app/api/tasks/[id]/attachments/route.ts`
- Create: `src/app/tasks/[id]/page.tsx`
- Create: `src/components/tasks/task-detail-view.tsx`
- Create: `src/components/tasks/task-comments.tsx`
- Create: `src/components/tasks/task-timeline.tsx`
- Test: `tests/collaboration.test.ts`

**Interfaces:**
- Consumes: Task models, Comments, Attachments, TaskHistory
- Produces: Realtime-ready comments UI, File upload handler, visual audit history timeline.

- [ ] **Step 1: Write test for adding comment and recording TaskHistory on status update**
- [ ] **Step 2: Implement comment and attachment API endpoints**
- [ ] **Step 3: Build Task Detail Sheet/Page with status timeline and file upload list**
- [ ] **Step 4: Build interactive comment thread component**
- [ ] **Step 5: Run tests and commit**

---

### Task 7: Calendar & Scheduler Module (CAL-01 to CAL-05)

**Files:**
- Create: `src/app/api/calendar/route.ts`
- Create: `src/app/calendar/page.tsx`
- Create: `src/components/calendar/calendar-view.tsx`
- Test: `tests/calendar.test.ts`

**Interfaces:**
- Consumes: Task deadlines from Prisma
- Produces: Month/Week interactive calendar grid, click event to view task, iCal export endpoint.

- [ ] **Step 1: Write test for mapping tasks with deadlines to calendar events**
- [ ] **Step 2: Implement Calendar API route returning user tasks and department events**
- [ ] **Step 3: Implement Calendar View with month/week toggle and warm editorial styling**
- [ ] **Step 4: Add iCal / Google Calendar sync export link**
- [ ] **Step 5: Run tests and commit**

---

### Task 8: Notification System (NOTI-01 to NOTI-05)

**Files:**
- Create: `src/app/api/notifications/route.ts`
- Create: `src/app/api/notifications/[id]/read/route.ts`
- Create: `src/app/notifications/page.tsx`
- Create: `src/components/notification-dropdown.tsx`
- Create: `src/lib/notifications.ts`
- Test: `tests/notifications.test.ts`

**Interfaces:**
- Consumes: Prisma Notification model
- Produces: Notification trigger helper (on task assign, comment, deadline), In-app bell with badge, Mark-all-read.

- [ ] **Step 1: Write test for notification creation and read-status toggle**
- [ ] **Step 2: Implement Notification API routes and helper triggers in task/comment actions**
- [ ] **Step 3: Build TopBar Notification Bell dropdown with unread count ping**
- [ ] **Step 4: Build dedicated Notifications page**
- [ ] **Step 5: Run tests and commit**

---

### Task 9: Executive & Personal Dashboard (DASH-01 to DASH-03)

**Files:**
- Create: `src/app/api/dashboard/stats/route.ts`
- Create: `src/app/page.tsx`
- Create: `src/components/dashboard/metric-cards.tsx`
- Create: `src/components/dashboard/task-chart.tsx`
- Create: `src/components/dashboard/recent-activity.tsx`
- Test: `tests/dashboard.test.ts`

**Interfaces:**
- Consumes: All Task, User, Department stats
- Produces: KPI cards, Recharts status breakdown, Overdue alert banner, Recent activities.

- [ ] **Step 1: Write test for dashboard aggregation logic (total, in-progress, completed, overdue)**
- [ ] **Step 2: Implement stats API route**
- [ ] **Step 3: Build Metric Cards and Header Greeting ("Chào buổi sáng, ...") matching inf_quota**
- [ ] **Step 4: Build Recharts Task Distribution and Department Progress charts**
- [ ] **Step 5: Run tests and commit**

---

### Task 10: Mobile App Optimization & PWA (MOB-01 to MOB-05)

**Files:**
- Create: `public/manifest.json`
- Create: `src/components/mobile-bottom-nav.tsx`
- Create: `src/app/sw.ts` (Service Worker)
- Test: `tests/mobile.test.ts`

**Interfaces:**
- Consumes: All frontend routes
- Produces: PWA installable manifest, Bottom Navigation Bar on mobile screens, mobile drawer.

- [ ] **Step 1: Write test verifying PWA manifest validity and mobile viewport meta**
- [ ] **Step 2: Create public/manifest.json with app icons, colors, and standalone display**
- [ ] **Step 3: Build fixed Mobile Bottom Nav (Trang chủ, Công việc, Lịch, Thông báo, Cá nhân)**
- [ ] **Step 4: Test responsive touch layouts across iPhone/Android viewports**
- [ ] **Step 5: Run tests, build production bundle, and commit**
