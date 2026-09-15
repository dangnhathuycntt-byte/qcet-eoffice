# QCET Work - Agent Guidelines

Dự án sử dụng hệ thống modular rules được phân tách trong `.claude/rules/`:

- **[Verification & Testing Rules](.claude/rules/verification.md)**: Nghiêm cấm chạy `next build` / `npm run build` gây crash dev server; quy định các lệnh verify thay thế (`npm run typecheck`, `npm test`, `npm run verify`).
- **[Git Workflow Policy](.claude/rules/git-workflow.md)**: Commit & push lên remote; tuyệt đối không tự ý merge vào `main` khi chưa có lệnh của người dùng.
- **[Code & Terminology Conventions](.claude/rules/conventions.md)**: Chuẩn hóa thuật ngữ tiếng Việt hành chính & sư phạm, định dạng múi giờ ICT (UTC+7).
