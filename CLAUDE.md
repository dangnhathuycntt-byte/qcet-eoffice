# QCET Work - Agent Guidelines

Dự án sử dụng hệ thống modular rules được phân tách trong `.claude/rules/`:

- **[Verification & Testing Rules](.claude/rules/verification.md)**: Nghiêm cấm chạy `next build` / `npm run build` gây crash dev server; quy định các lệnh verify thay thế (`npm run typecheck`, `npm test`, `npm run verify`).
- **[Git Workflow Policy](.claude/rules/git-workflow.md)**: Commit & push lên remote; tuyệt đối không tự ý merge vào `main` khi chưa có lệnh của người dùng.
- **[Code & Terminology Conventions](.claude/rules/conventions.md)**: Chuẩn hóa thuật ngữ tiếng Việt hành chính & sư phạm, định dạng múi giờ ICT (UTC+7).
- **[Component & Identifier Naming](.claude/rules/naming.md)**: Chuẩn hóa tên component/hook/type theo Domain+Role pattern, không dùng brand prefix bên ngoài, dùng canonical domain utilities.
- **[Dependency-First Development](.claude/rules/dependency-first.md)**: Ưu tiên tái sử dụng component/utility từ dependencies đã cài, hạn chế tự viết mới.
- **[UI Polish & Motion Rules](.claude/rules/ui-polish.md)**: Chuẩn hóa design tokens, easing, trạng thái tương tác, chuyển động có vật lý, hiệu năng và reduced motion cho frontend.
