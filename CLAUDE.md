# QCET Work - Agent Guidelines

## Knowledge Base (Obsidian Vault = `docs/`)
Tài liệu dự án nằm trong `docs/` — mở bằng Obsidian làm vault. Khi cần hiểu nghiệp vụ hoặc kiến trúc, tra cứu tại đây trước:
- **Nghiệp vụ**: `docs/domain/` — task-management, documents, delegations, organization, permission-matrix
- **Kiến trúc**: `docs/architecture/` — authentication, navigation, API inventory, database ops
- **ADRs & RFCs**: `docs/architecture/decisions/` — các quyết định kỹ thuật đã duyệt
- **Specs**: `docs/product/specs/` — đặc tả tính năng
- **Index tổng**: `docs/Index.md` — bản đồ liên kết toàn bộ tài liệu

Dự án sử dụng hệ thống modular rules được phân tách trong `.claude/rules/`:

- **[Verification & Testing Rules](.claude/rules/verification.md)**: Nghiêm cấm chạy `next build` / `npm run build` gây crash dev server; quy định các lệnh verify thay thế (`npm run typecheck`, `npm test`, `npm run verify`).
- **[Git Workflow Policy](.claude/rules/git-workflow.md)**: Commit & push lên remote; tuyệt đối không tự ý merge vào `main` khi chưa có lệnh của người dùng.
- **[Code & Terminology Conventions](.claude/rules/conventions.md)**: Chuẩn hóa thuật ngữ tiếng Việt hành chính & sư phạm, định dạng múi giờ ICT (UTC+7).
- **[Component & Identifier Naming](.claude/rules/naming.md)**: Chuẩn hóa tên component/hook/type theo Domain+Role pattern, không dùng brand prefix bên ngoài, dùng canonical domain utilities.
- **[Dependency-First Development](.claude/rules/dependency-first.md)**: Ưu tiên tái sử dụng component/utility từ dependencies đã cài, hạn chế tự viết mới.
- **[UI Polish & Motion Rules](.claude/rules/ui-polish.md)**: Chuẩn hóa design tokens, easing, trạng thái tương tác, chuyển động có vật lý, hiệu năng và reduced motion cho frontend.
- **[Design System & Tasks Benchmark](DESIGN.md)**: Mọi thay đổi UI/UX frontend bắt buộc phải tuân thủ tuyệt đối quy chuẩn trong `DESIGN.md`. Lấy module Nhiệm vụ (Tasks / Subtasks / Task Detail) làm Golden Master Benchmark cho toàn bộ hệ thống: view switcher dạng ngang trực tiếp (`[Bảng | Kanban]`), filter breadcrumbs phẳng nhẹ nhàng (không dùng card lồng card, không divide-x hay shadow dày), bảng màu than chì trung tính monochrome (không xanh chói ở filter, không pitch-black `#000`), bộ lọc đa chọn không tự tắt (`closeOnClick={false}`), và CTA sạch (không gắn badge phím tắt rườm rà).
- **[Domain & Codebase Invariants](.claude/rules/invariants.md)**: Bất biến bắt buộc cho lib/domain, API routes, task components, và tests (hợp nhất từ các `AGENTS.md`).
