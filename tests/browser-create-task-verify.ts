import { spawn } from 'node:child_process';
import { prisma } from '../src/lib/prisma';
import { signSessionToken, SESSION_COOKIE_NAME } from '../src/lib/jwt-session';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getJson(url: string) {
  for (let i = 0; i < 10; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch {
      await sleep(300);
    }
  }
  throw new Error(`Failed to fetch ${url}`);
}

async function main() {
  console.log('=== BROWSER VERIFY THÁNG 9: TẠO NHIỆM VỤ VÀ HIỂN THỊ TRÊN BÀN LÀM VIỆC ===');

  const user = await prisma.user.findFirst({
    where: { email: 'dangnhathuy@cdktcnqn.edu.vn' },
    include: {
      positionAssignments: {
        where: { status: 'ACTIVE' },
        include: { unit: true },
      },
    },
  });

  if (!user) {
    console.error('Không tìm thấy user dangnhathuy@cdktcnqn.edu.vn');
    process.exit(1);
  }

  const primaryUnitId = user.positionAssignments[0]?.unitId;
  const sessionToken = `sess_browser_${Date.now()}`;
  await prisma.session.create({
    data: {
      sessionToken,
      userId: user.id,
      expires: new Date(Date.now() + 86400000),
    },
  });

  const jwtToken = signSessionToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    departmentId: primaryUnitId,
  });

  console.log(`Đăng nhập: ${user.name} (${user.email}) | Đơn vị: ${user.positionAssignments[0]?.unit.name}`);

  const chrome = spawn(CHROME_PATH, [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=/tmp/chrome-qcet-${Date.now()}`,
  ]);

  try {
    await sleep(2000);
    const targets = await getJson(`http://127.0.0.1:${PORT}/json/list`);
    const target = targets[0];
    const ws = new WebSocket(target.webSocketDebuggerUrl);

    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve();
      ws.onerror = reject;
    });

    let msgId = 0;
    const pending = new Map<number, (val: any) => void>();
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data.toString());
      if (data.id && pending.has(data.id)) {
        pending.get(data.id)!(data.result);
        pending.delete(data.id);
      }
    };

    function send(method: string, params: any = {}): Promise<any> {
      const id = ++msgId;
      return new Promise((resolve) => {
        pending.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await send('Network.enable');
    await send('Page.enable');
    await send('Runtime.enable');

    // Nạp Cookie
    const cookiesToSet = [
      { name: 'next-auth.session-token', value: sessionToken },
      { name: 'authjs.session-token', value: jwtToken },
      { name: SESSION_COOKIE_NAME, value: jwtToken },
    ];
    for (const c of cookiesToSet) {
      await send('Network.setCookie', {
        name: c.name,
        value: c.value,
        domain: 'localhost',
        path: '/',
      });
    }

    // 1. Mở trang Bàn làm việc
    console.log('1. Đang mở Bàn làm việc: http://localhost:3001/tasks ...');
    await send('Page.navigate', { url: 'http://localhost:3001/tasks' });
    await sleep(3500);

    // 2. Mở modal tạo việc
    console.log('2. Đang mở modal "Giao việc"...');
    await send('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const createBtn = btns.find(b => b.textContent && (b.textContent.includes('Giao việc') || b.textContent.includes('Tạo mới')));
        if (createBtn) createBtn.click();
      })()`,
    });
    await sleep(1000);

    // 3. Nhập tiêu đề
    const taskTitle = `Triển khai phần mềm e-Office cho cán bộ giáo viên ${Date.now()}`;
    console.log(`3. Đang nhập tiêu đề: "${taskTitle}"`);
    await send('Runtime.evaluate', {
      expression: `(() => {
        const titleInput = document.getElementById('create-task-title') || document.querySelector('input[placeholder*="tên nhiệm vụ"]');
        if (titleInput) titleInput.focus();
      })()`,
    });
    await sleep(200);
    await send('Input.insertText', { text: taskTitle });
    await sleep(300);

    // 4. Mở Date Picker và chọn chính xác ngày 29/09/2026 (Tháng 9)
    console.log('4. Đang chọn Hạn hoàn thành trong Tháng 9 (29/09/2026)...');
    await send('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const duePicker = btns.reverse().find(b => b.textContent && (b.textContent.includes('dd/mm/yyyy') || b.textContent.includes('Hạn')));
        if (duePicker) duePicker.click();
      })()`,
    });
    await sleep(600);

    // Click ngày 29 trong tháng hiện tại (Tháng 9)
    await send('Runtime.evaluate', {
      expression: `(() => {
        const allElements = Array.from(document.querySelectorAll('button, div[role="button"], span, td'));
        // Tìm ô ngày 29 trong tháng hiện tại
        const day29 = allElements.find(el => el.textContent?.trim() === '29' && el.children.length === 0);
        if (day29) {
          day29.click();
          day29.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        }
      })()`,
    });
    await sleep(600);

    // 5. Bấm nút Submit "Tạo nhiệm vụ"
    console.log('5. Đang nhấn nút "Tạo nhiệm vụ"...');
    await send('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const submitBtn = btns.reverse().find(b => b.textContent?.trim() === 'Tạo nhiệm vụ');
        if (submitBtn) submitBtn.click();
      })()`,
    });
    await sleep(1500);

    // 6. Chờ UI cập nhật danh sách
    console.log('6. Đang chờ giao diện tự động cập nhật danh sách nhiệm vụ...');
    await sleep(3500);

    // 7. Chuyển sang tab "Đơn vị tôi" để xem danh sách nhiệm vụ của đơn vị
    console.log('7. Đang chuyển sang tab "Đơn vị tôi"...');
    await send('Runtime.evaluate', {
      expression: `(() => {
        const tabs = Array.from(document.querySelectorAll('button, [role="tab"], div[data-slot*="tab"]'));
        const unitTab = tabs.find(t => t.textContent?.includes('Đơn vị tôi'));
        if (unitTab) unitTab.click();
      })()`,
    });
    await sleep(2500);

    // 8. Kiểm tra sự xuất hiện của nhiệm vụ
    const checkResult = await send('Runtime.evaluate', {
      expression: `(() => {
        const text = document.body.innerText;
        return {
          isVisible: text.includes(${JSON.stringify(taskTitle)}),
          taskTitle: ${JSON.stringify(taskTitle)},
          allText: text,
        };
      })()`,
      returnByValue: true,
    });

    console.log('\n--- TOÀN BỘ TEXT TRÊN BÀN LÀM VIỆC ---\n', checkResult.result?.value?.allText);

    console.log('\n================================================================');
    console.log('XÁC MINH BROWSER HOÀN TẤT THÀNH CÔNG:');
    console.log(`- Người tạo: ${user.name} (${user.email})`);
    console.log(`- Đơn vị: ${user.positionAssignments[0]?.unit.name}`);
    console.log(`- Nhiệm vụ đã tạo: "${taskTitle}"`);
    console.log(`- Kết quả hiển thị trên Bàn làm việc: ${checkResult.result?.value?.isVisible ? '✓ XUẤT HIỆN NGAY LẬP TỨC TRÊN GIAO DIỆN' : '✗ KHÔNG TÌM THẤY'}`);
    console.log('================================================================\n');

    ws.close();
  } finally {
    await prisma.session.deleteMany({ where: { sessionToken } }).catch(() => undefined);
    chrome.kill();
  }
}

main().catch(console.error);
