# Verification & Testing Rules

## ⚠️ QUY TẮC BẮT BUỘC: TUYỆT ĐỐI KHÔNG CHẠY `next build` / `npm run build` ĐỂ VERIFY

### 1. Nguyên nhân (Dev Server Cache Conflict)
- Khi môi trường dev server (`npm run dev` / `next dev`) đang chạy, việc thực thi `next build` hoặc `npm run build` sẽ ghi đè và dọn dẹp thư mục chia sẻ `.next/`.
- Điều này gây lỗi tức thì:
  - `⨯ [Error: ENOENT: no such file or directory, open '.../.next/server/app/.../app-paths-manifest.json']`
  - Mất CSS, vỡ layout, 404 các chunk `main-app.js`, phá hỏng phiên làm việc của người dùng.

### 2. Quy chuẩn bắt buộc cho Agent
- **NGHIÊM CẤM** chạy `npm run build` hoặc `next build` trong mọi quy trình tự động kiểm thử, xác thực (verification), hoặc code review của agent/subagent.
- **CÁC LỆNH KIỂM TRA THAY THẾ BẮT BUỘC**:
  ```bash
  # 1. Kiểm tra Type-safety (không can thiệp vào .next/)
  npm run typecheck

  # 2. Kiểm tra code styling & linter
  npm run lint

  # 3. Chạy tests
  npm test                         # Toàn bộ test suite
  npm run test:changed             # Chỉ test các file thay đổi
  npx tsx --test tests/<file>.test.ts # Test cụ thể theo tính năng

  # 4. Pipeline kiểm tra đầy đủ an toàn
  npm run verify                   # typecheck + lint + test
  ```
- **Ngoại lệ duy nhất**: Chỉ chạy `npm run build` khi người dùng yêu cầu trực tiếp bằng lời (ví dụ: *"chạy production build"*).
