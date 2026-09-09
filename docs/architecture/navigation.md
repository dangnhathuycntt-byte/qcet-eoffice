# QCET E-Office — Navigation Architecture & Route Registry

**Document Status**: Canonical Reference  
**Scope**: Canonical Route Registry, Sidebar Navigation, Mobile Bottom Bar, Role Filtering  
**Last Updated**: 2026-09-09  

---

## 1. Single Source of Navigation Truth

All routing, sidebar menus, mobile bars, breadcrumbs, and deep-link alias resolutions are driven exclusively by the canonical registry:
`src/lib/navigation/canonical-navigation-registry.ts`

Never hard-code navigation arrays, duplicate route lists, or create bespoke sidebar item structures in individual components.

---

## 2. Canonical Route Configuration Model

Each registered route conforms to the `CanonicalRouteConfig` schema:

```typescript
export interface CanonicalRouteConfig {
  id: string;                                  // Unique route identifier (e.g., 'tasks')
  href: string;                                // Canonical primary URL (e.g., '/tasks')
  label: string;                               // Full descriptive label (e.g., 'Quản lý nhiệm vụ')
  shortLabel: string;                          // Compact label for mobile (e.g., 'Nhiệm vụ')
  section: "personal" | "workspace" | "operations"; // Administrative section
  iconName: "LayoutDashboard" | "Calendar" | "CheckSquare" | "FileText" | "Building2" | "Bell" | "Settings";
  zone?: WorkspaceZone;                        // Associated workspace zone
  badgeKey?: "calendar" | "notifications" | "docsInbox" | "docsOutbox" | "docsPending";
  aliases?: string[];                          // Legacy or parameter paths mapped to this route
  mobilePlacement?: "bottom-bar" | "drawer" | "none"; // Responsive mobile target
  order: number;                               // Deterministic display order
}
```

---

## 3. Canonical Routes Matrix

| ID | Canonical Path | Section | Mobile Placement | Order | Primary Purpose |
|---|---|---|:---:|:---:|---|
| `desk` | `/` | `personal` | `bottom-bar` | 1 | Executive/Personal Workbench (`Bàn làm việc`) |
| `tasks` | `/tasks` | `workspace` | `bottom-bar` | 2 | Unified Task Workspace (`Quản lý nhiệm vụ`) |
| `documents` | `/documents` | `workspace` | `bottom-bar` | 3 | Inbound/Outbound Dispatches (`Văn bản & Công văn`) |
| `calendar` | `/calendar` | `personal` | `bottom-bar` | 4 | Academic Schedule & Meetings (`Lịch công tác`) |
| `org` | `/org` | `operations` | `drawer` | 5 | Directory & Hierarchy (`Cơ cấu & Danh bạ`) |
| `notifications` | `/notifications` | `personal` | `none` | 6 | Urgent Alerts & Reminders (`Thông báo & Nhắc việc`) |
| `settings` | `/settings` | `operations` | `drawer` | 7 | System & User Settings (`Cài đặt hệ thống`) |

---

## 4. Desktop Sidebar Navigation (`AppSidebar`)

The desktop navigation sidebar (`src/components/layout/app-sidebar.tsx`):
1. **Section Grouping**: Automatically groups items retrieved via `getSidebarNavItems()` into three clear administrative sections:
   - **Cá nhân / Hoạt động**: Personal Workbench, Calendar, Notifications.
   - **Không gian công việc**: Unified Tasks, Documents.
   - **Vận hành & Hệ thống**: Organization Directory, Settings.
2. **Active State Resolution**: Uses `getRouteByPath(pathname)` to highlight the active menu item even when navigating legacy aliases or sub-routes.
3. **Badge Coordination**: Live badges (e.g., unread notifications, pending documents) bind dynamically through `badgeKey` properties.

---

## 5. Mobile Navigation (`MobileBottomNav` & `MobileMenuDrawer`)

To prevent mobile navigation clutter, routes are partitioned by touch frequency:

### 5.1 Mobile Bottom Bar (`MobileBottomNav`)
- Renders items with `mobilePlacement === "bottom-bar"` (exactly 4 primary destinations).
- Fixed to viewport bottom with minimum 44x44px touch targets.
- Displays `shortLabel` for clean typographic presentation on narrow screens.

### 5.2 Mobile Menu Drawer (`MobileMenuDrawer`)
- Renders items with `mobilePlacement === "drawer"` (secondary operational tools).
- Accessed via the "Thêm" (More) button on mobile headers.
- Hosts Organizational Directory, Settings, and Account Sign-out.

---

## 6. Unassigned Department Handling

When a new user logs in without an assigned organizational department:
1. `isUserUnassignedDepartment(user)` evaluates true.
2. `AppSidebar` and `UnifiedAdaptiveWorkspace` display a non-blocking administrative alert.
3. The user is prompted to select their department via the profile settings or scope modal.
4. **Resilience**: Crucially, the app shell never blocks routing or renders a white screen; default fallback views allow navigation while highlighting the unassigned state.

---

## 7. Alias Resolution & Canonical Redirection

Legacy paths (e.g., `/?zone=tasks`, `/unit-tasks`, `/?view=calendar`) are preserved as aliases in `CANONICAL_ROUTES`. Navigation helpers resolve these to their canonical URL, preventing bookmark rot while maintaining a unified information architecture.
