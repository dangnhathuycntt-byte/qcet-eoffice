# QCET E-Office - Hướng Dẫn & Quy Tắc Kỹ Thuật (Engineering Rules)

## 1. Quy Tắc Build & Tránh Xung Đột Cache Dev (CRITICAL)

### Vấn đề cốt lõi (Root Cause)
Khi đang chạy `npm run dev` (phục vụ `localhost:3001`), nếu tiến trình khác chạy `npm run build` (`next build`), Next.js sẽ **xóa sạch và ghi đè** thư mục `.next/` bằng các production hashed chunks (`391d3fa973ab9ce6.css`, `main-app-*.js`).
Hậu quả:
- Dev server trong bộ nhớ RAM bị mất các dev chunks động (`main-app.js`, `app/layout.css?v=...`).
- Trình duyệt gọi các asset này bị trả về **404 Not Found**.
- Trang web bị rớt về dạng thô không có CSS (màn hình đen, link màu tím gạch chân, nút hiển thị vỡ, mất toàn bộ Tailwind styling).
- `npm run build` vẫn báo thành công (exit 0) vì quá trình build độc lập thành công, nhưng lại gây "nhiễm độc" (cache poisoning) cho dev server đang chạy.

### Quy tắc bất di bất dịch (Build Rules):
1. **Không chạy `next build` đè lên `.next` khi `next dev` đang chạy:**
   - Trong lúc dev server đang chạy, để kiểm tra tính đúng đắn của code và kiểu dữ liệu, hãy dùng:
     ```bash
     npm run typecheck   # tsc --noEmit
     npm test            # tsx --test tests/**/*.test.ts
     ```
2. **Nếu bắt buộc chạy `npm run build` để test SSR/Production:**
   - Phải dừng dev server trước khi build, HOẶC:
   - Sau khi build xong phải dọn cache và khởi động lại dev server:
     ```bash
     rm -rf .next && npm run dev -- -p 3001
     ```
3. **Quy trình cứu hộ khi giao diện bị unstyled (Recovery Step):**
   ```bash
   kill -9 $(lsof -ti:3001) 2>/dev/null || true
   rm -rf .next
   npm run dev -- -p 3001
   ```
   Sau đó bấm `Cmd + Shift + R` (hoặc `Ctrl + Shift + R`) trên trình duyệt để xóa cache client.

---

## 2. Kiến Trúc CSS & Styling (Tailwind CSS v4)

- Dự án sử dụng **Tailwind CSS v4** cùng `@tailwindcss/postcss`.
- Điểm vào duy nhất: `src/app/globals.css` với `@import "tailwindcss";` và `@theme inline { ... }`.
- Không tạo hoặc thêm `tailwind.config.js` cũ vì sẽ gây xung đột với bộ phân giải của Tailwind v4.
- Luôn kiểm tra biến màu và token trong `globals.css` (OKLCH color space cho cả Light và Dark mode).

---

## 3. Quy Trình Kiểm Tra & Triển Khai (Quality Assurance)

Trước khi xác nhận hoàn thành bất kỳ tính năng nào:
1. `npm run typecheck` - Đảm bảo không có lỗi TypeScript.
2. `npm test` - Đảm bảo toàn bộ unit tests và integration tests đều xanh.
3. Kiểm tra dev preview (Browser Preview) để xác thực visual layout, CSS rendering và responsive design.
