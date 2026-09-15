# Git Workflow & Branching Policy

## 1. Commit & Push
- Sau khi hoàn thành và xác thực thay đổi trên nhánh làm việc (`feat/...`, `fix/...`), thực hiện commit với thông điệp rõ ràng theo chuẩn Conventional Commits.
- Đẩy nhánh lên remote (`git push -u origin <branch-name>`) để sao lưu dữ liệu.

## 2. Merge Policy (Bắt buộc)
- **TUYỆT ĐỐI KHÔNG** tự ý thực thi `git merge` hoặc gộp nhánh vào nhánh chính (`main`, `master`, v.v.).
- Chờ chỉ thị/lệnh rõ ràng từ người dùng trước khi thực hiện thao tác merge.
