# Dependency-First Development

## Nguyên tắc cốt lõi
**Ưu tiên tuyệt đối** sử dụng component, hook, và utility từ các dependencies đã cài trong `package.json`. Chỉ tự viết mới khi không có giải pháp phù hợp trong hệ sinh thái hiện tại.

## Dependency Map — Khi nào dùng cái gì

### UI Components & Styling
| Nhu cầu | Dùng | KHÔNG tự viết |
|---------|------|----------------|
| Icon | `lucide-react` | SVG component thủ công |
| Class merging | `tailwind-merge` + `clsx` (`cn()` helper) | Logic merge class tự viết |
| Variant styling | `class-variance-authority` (cva) | Switch/if-else className |
| Animations | `tw-animate-css` (utility classes) | `@keyframes` thủ công cho animation có sẵn |
| Motion / transitions | `motion` (Framer Motion v13) | CSS transition phức tạp tự viết |
| Drawer / Sheet (mobile) | `vaul` | Drawer component tự viết |
| Resizable panels | `react-resizable-panels` | Resize logic tự viết |
| Headless UI primitives | `@base-ui/react` (xem danh sách bên dưới) | Tự viết headless component |

### `@base-ui/react` ^1.8.0 — Headless UI Primitives

**Import pattern**: `import { ComponentName } from "@base-ui/react/component-name"`

| Component | Mô tả | Khi nào dùng |
|-----------|-------|--------------|
| **Accordion** | Collapsible panels | FAQ, settings, expandable sections |
| **Alert Dialog** | Blocking modal | Destructive confirm, critical warnings |
| **Checkbox** / **Checkbox Group** | Form checkboxes | Multi-select, bộ lọc, form fields |
| **Collapsible** | Expand/collapse | Section visibility toggle |
| **Combobox** | Input + dropdown list | Filterable select, tag input |
| **Dialog** | Modal overlay | **DÙNG CHO MỌI MODAL** — thay createPortal thủ công |
| **Field** / **Fieldset** | Form primitives | Label, validation, error messages |
| **Menu** | Dropdown actions | Action menus, more-options dropdowns |
| **Meter** | Graphical display | Quota, capacity indicators |
| **Popover** | Floating content | Tooltips mở rộng, inline forms |
| **Progress** | Progress bar | Task progress, upload progress |
| **Radio** | Radio buttons | Single-select in forms |
| **Select** | Dropdown select | Single-value selection |
| **Slider** | Range input | Settings, filters |
| **Switch** | Toggle switch | On/off settings |
| **Tabs** | Tab panels | **DÙNG THAY custom Tabs** — tabs navigation |
| **Toggle** / **Toggle Group** | Toggle buttons | View modes, toolbar buttons |
| **Tooltip** | Hover info | Icon labels, help text |

> **Lưu ý**: Verify component có sẵn tại [base-ui.com/react/components](https://base-ui.com/react/components) trước khi dùng. `@base-ui/react` là successor chính thức của Radix UI primitives.

### Motion (`motion` ^13.2.0)

**Import chuẩn project**:
```tsx
import * as m from "motion/react-m";  // tree-shakeable components
import { AnimatePresence } from "motion/react";  // presence animations
```

**Infra sẵn có** — tái sử dụng, KHÔNG tự define:
- `src/lib/motion/tokens.ts` — `motionDuration`, `motionEase`, `motionSpring`, `motionTransition`
- `src/lib/motion/variants.ts` — `fadeVariants`, `popoverVariants`, `dialogVariants`, `sideSheetVariants`, `bottomSheetVariants`, `toastVariants`, `listItemVariants`, `staggerContainerVariants`
- `src/components/motion/motion-provider.tsx` — `LazyMotion` + `MotionConfig`

**Capabilities sẵn sàng dùng**:
| Feature | Cú pháp | Use case |
|---------|---------|----------|
| Gesture hover | `<m.div whileHover={{ scale: 1.02 }}>` | Card/button hover |
| Gesture tap | `<m.div whileTap={{ scale: 0.98 }}>` | Click feedback |
| Scroll reveal | `<m.div whileInView={{ opacity: 1 }}>` | Dashboard sections |
| Layout animation | `<m.div layout>` | List reorder, expand/collapse |
| Shared element | `<m.div layoutId="card-1">` | Card → detail transition |
| Stagger list | Dùng `staggerContainerVariants` + `listItemVariants` | Task lists, kanban columns |
| Scroll progress | `useScroll()` | Progress bar, parallax |

### `class-variance-authority` (cva) — Variant Pattern

**Dùng cho MỌI component có multiple visual states**:
```tsx
import { cva, type VariantProps } from "class-variance-authority";

const componentVariants = cva("base-classes", {
  variants: {
    variant: { default: "...", secondary: "..." },
    size: { sm: "...", md: "...", lg: "..." },
  },
  defaultVariants: { variant: "default", size: "md" },
});

interface Props extends VariantProps<typeof componentVariants> {}
```

**Đã dùng tại**: `button.tsx`, `badge.tsx`, `tabs.tsx`
**Nên mở rộng**: card, input, progress, mọi component UI mới

### Rich Text Editor (Plate.js ecosystem)
| Nhu cầu | Dùng |
|---------|------|
| Core editor | `platejs` |
| Bold, italic, heading, code, blockquote | `@platejs/basic-nodes` |
| Link | `@platejs/link` |
| List (bullet, numbered, todo) | `@platejs/list` |
| Image, video, file embed | `@platejs/media` |
| Callout blocks | `@platejs/callout` |
| Indent / outdent | `@platejs/indent` |
| Auto-formatting (markdown shortcuts) | `@platejs/autoformat` |
| Slash commands | `@platejs/slash-command` |
| Block selection | `@platejs/selection` |
| Drag-and-drop blocks | `@platejs/dnd` |
| Table | `@platejs/table` |
| Mention (@user) | `@platejs/mention` |
| Table of contents | `@platejs/toc` |
| Toggle/collapsible blocks | `@platejs/toggle` |

### Drag & Drop
| Nhu cầu | Dùng |
|---------|------|
| Sortable list / Kanban | `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` |
| Editor block DnD | `@platejs/dnd` (dùng `react-dnd` làm peer dep — **KHÔNG xóa**) |

> ⚠️ **Quan trọng**: `react-dnd` + `react-dnd-html5-backend` là **peerDependencies bắt buộc** của `@platejs/dnd ^53.3.8`. Không gỡ hai package này dù không thấy import trực tiếp trong `src/`. Xóa chúng sẽ gây lỗi runtime khi mở editor.

### Data & Backend
| Nhu cầu | Dùng |
|---------|------|
| Schema validation | `zod` (v4) |
| Database ORM | `@prisma/client` |
| Authentication | `next-auth` (v5 beta) + `@auth/prisma-adapter` |
| Password hashing | `bcryptjs` |
| JWT tokens | `jsonwebtoken` |
| QR code generation | `qrcode` |
| Push notifications | `web-push` |

### Framework
| Nhu cầu | Dùng |
|---------|------|
| Routing, SSR, API routes | `next` (v15, App Router) |
| React | `react` / `react-dom` (v19) |

## Quy tắc áp dụng

1. **Trước khi tạo component mới**, kiểm tra:
   - `@base-ui/react` có primitive phù hợp không? (xem danh sách trên, verify tại base-ui.com)
   - `lucide-react` có icon cần thiết không?
   - `vaul` đã cover drawer/sheet chưa?
   - `react-resizable-panels` có xử lý được layout resizable không?

2. **Trước khi viết modal/dialog**, dùng `@base-ui/react/dialog` hoặc `@base-ui/react/alert-dialog`:
   - **KHÔNG** dùng `createPortal` + manual scroll lock + manual ESC handler
   - Base UI Dialog cung cấp: focus trapping, scroll lock, ESC dismiss, accessibility tự động

3. **Trước khi viết animation**, kiểm tra:
   - `tw-animate-css` có class animation phù hợp không? (`animate-in`, `fade-in`, `zoom-in-*`, `slide-in-from-*`)
   - Các variants sẵn có tại `src/lib/motion/variants.ts`?
   - `motion` (Framer Motion) cho complex animation, layout animation, gesture.

4. **Trước khi viết validation logic**, dùng `zod` schema.

5. **Trước khi viết DnD**, dùng `@dnd-kit` API hiện tại (`DndContext`, `useSortable`, `DragOverlay`).

6. **Trước khi viết variant styling**, dùng `cva` pattern.

7. **Trước khi thêm dependency mới**, hỏi lại người dùng — tránh phình `node_modules` không cần thiết.

## Anti-patterns (KHÔNG LÀM)

- ❌ Tự viết `Popover`, `Tooltip`, `Dialog`, `Select`, `Menu`, `Tabs`, `Checkbox`, `Progress` → Dùng `@base-ui/react`
- ❌ Tự viết icon SVG inline → Dùng `lucide-react`
- ❌ Tự viết `cn()` utility mới → Đã có sẵn (`clsx` + `tailwind-merge`)
- ❌ Tự viết form validation bằng tay → Dùng `zod`
- ❌ Tự viết modal với `createPortal` + manual ESC/scroll lock → Dùng `@base-ui/react/dialog`
- ❌ Tự viết variant className logic (if/switch) → Dùng `cva`
- ❌ Cài thêm `framer-motion` → Đã có `motion` (cùng gói, tên mới)
- ❌ Cài thêm `@radix-ui/*` → Đã có `@base-ui/react`
- ❌ Cài thêm `@headlessui/react` → Đã có `@base-ui/react`
- ❌ Cài thêm `react-beautiful-dnd` → Đã có `@dnd-kit`
- ❌ Cài thêm `joi` / `yup` → Đã có `zod`
- ❌ Xóa `react-dnd` / `react-dnd-html5-backend` → peerDep bắt buộc của `@platejs/dnd`
