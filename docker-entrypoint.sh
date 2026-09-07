#!/bin/sh
set -e

echo "[QCET E-Office] Đang kiểm tra và áp dụng cập nhật CSDL (Prisma Migrate)..."
if [ -x "./node_modules/.bin/prisma" ]; then
  ./node_modules/.bin/prisma migrate deploy || {
    echo "[CẢNH BÁO] Prisma migrate deploy gặp lỗi hoặc chưa có migration mới. Tiếp tục khởi động ứng dụng..."
  }
else
  npx prisma migrate deploy || {
    echo "[CẢNH BÁO] Prisma migrate deploy gặp lỗi hoặc chưa có migration mới. Tiếp tục khởi động ứng dụng..."
  }
fi

echo "[QCET E-Office] Khởi động máy chủ Next.js 15 Standalone tại cổng 3000..."
exec node server.js
