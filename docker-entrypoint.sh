#!/bin/sh
set -e

echo "[QCET E-Office] Đang kiểm tra và áp dụng cập nhật CSDL (Prisma Migrate - Fail-Closed)..."
if [ -x "./node_modules/.bin/prisma" ]; then
  PRISMA_BIN="./node_modules/.bin/prisma"
else
  PRISMA_BIN="npx prisma"
fi

if ! $PRISMA_BIN migrate deploy; then
  echo "[LỖI NGHIÊM TRỌNG] Prisma migrate deploy thất bại! Dừng khởi động để bảo vệ an toàn và toàn vẹn dữ liệu hệ thống." >&2
  exit 1
fi

echo "[QCET E-Office] Áp dụng migration thành công."

echo "[QCET E-Office] Khởi động máy chủ Next.js 15 Standalone tại cổng 3000..."
exec node server.js
