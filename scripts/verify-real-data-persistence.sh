#!/usr/bin/env bash
set -e

echo "=== 1. KIỂM TRA POSTGRESQL CONNECTION & ROW COUNTS ==="
if command -v psql >/dev/null 2>&1; then
  psql -U dnhhuy -d qcet_eoffice -c "
    SELECT 'Users' as Table, count(*) from users
    UNION ALL
    SELECT 'Departments', count(*) from departments
    UNION ALL
    SELECT 'Tasks', count(*) from tasks
    UNION ALL
    SELECT 'Documents', count(*) from documents;
  "
else
  node -e '
    const { PrismaClient } = require("@prisma/client");
    const prisma = new PrismaClient();
    async function main() {
      const users = await prisma.user.count();
      const depts = await prisma.department.count();
      const tasks = await prisma.task.count();
      const docs = await prisma.document.count();
      console.log("Users:", users);
      console.log("Departments:", depts);
      console.log("Tasks:", tasks);
      console.log("Documents:", docs);
      await prisma.$disconnect();
    }
    main();
  '
fi

echo "=== 2. KIỂM TRA TYPECHECK ==="
npm run typecheck

echo "=== 3. KIỂM TRA FULL TEST SUITE ==="
npm test

echo "=== 4. CHỤP ANH XAC MINH TRUC QUAN GIAO DIEN (PORT 3001) ==="
CHROME_BIN="${CHROME_BIN:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
OUTPUT_DIR="/tmp/qcet-screenshots/real-data"
mkdir -p "$OUTPUT_DIR"

"$CHROME_BIN" --headless --disable-gpu --window-size=1440,1200 --screenshot="$OUTPUT_DIR/real-data-desktop.png" "http://localhost:3001"
"$CHROME_BIN" --headless --disable-gpu --window-size=1440,2200 --screenshot="$OUTPUT_DIR/real-data-tasks.png" "http://localhost:3001?zone=tasks"
"$CHROME_BIN" --headless --disable-gpu --window-size=1440,2000 --screenshot="$OUTPUT_DIR/real-data-documents.png" "http://localhost:3001?zone=documents"

echo "=== 5. XAC MINH CAC TAP TIN ANH DA TAO ==="
for img in "$OUTPUT_DIR/real-data-desktop.png" "$OUTPUT_DIR/real-data-tasks.png" "$OUTPUT_DIR/real-data-documents.png"; do
  if [ -s "$img" ]; then
    echo "Tep $img ton tai (kich thuoc: $(wc -c < "$img" | tr -d ' ') bytes)"
  else
    echo "Loi: Khong tim thay hoac tep rong: $img" >&2
    exit 1
  fi
done

echo "Kiem tra hoan tat. Anh luu tai $OUTPUT_DIR"
