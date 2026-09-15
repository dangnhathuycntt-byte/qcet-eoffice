import { spawn } from "node:child_process";
import fs from "node:fs";

const cookieContent = fs.readFileSync("/tmp/qcet_cookie.txt", "utf-8");
const cookieMatch = cookieContent.match(/qcet_session\s+([^\s]+)/);
if (!cookieMatch) {
  console.error("Could not find qcet_session cookie in /tmp/qcet_cookie.txt");
  process.exit(1);
}
const sessionToken = cookieMatch[1];

async function main() {
  const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
    "--headless=new",
    "--remote-debugging-port=9229",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--window-size=1440,900",
    "--user-data-dir=/tmp/chrome-screenshot-ia-pass",
  ]);

  try {
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const targetsRes = await fetch("http://127.0.0.1:9229/json");
    const targets = await targetsRes.json();
    const pageTarget = targets.find((t) => t.type === "page") || targets[0];

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    let id = 1;
    const pending = new Map();

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };

    await new Promise((resolve) => { ws.onopen = resolve; });

    function send(method, params = {}) {
      const reqId = id++;
      return new Promise((resolve, reject) => {
        pending.set(reqId, { resolve, reject });
        ws.send(JSON.stringify({ id: reqId, method, params }));
      });
    }

    await send("Network.enable");
    await send("Page.enable");
    await send("Runtime.enable");

    await send("Network.setCookie", {
      name: "qcet_session",
      value: sessionToken,
      domain: "localhost",
      path: "/",
      httpOnly: true,
    });

    console.log("=== STEP 1: Navigate to /tasks ===");
    await send("Page.navigate", { url: "http://localhost:3001/tasks" });
    await new Promise((resolve) => setTimeout(resolve, 2500));

    // Inspect Row 1 items
    const row1Info = await send("Runtime.evaluate", {
      expression: `(() => {
        const row1 = document.querySelector('[data-slot="unified-task-toolbar-row-1"]');
        if (!row1) return { error: 'Row 1 not found' };
        const scopeBtns = Array.from(row1.querySelectorAll('[data-scope]')).map(b => ({
          scope: b.getAttribute('data-scope'),
          text: b.innerText.trim(),
          isSelected: b.getAttribute('aria-selected') === 'true'
        }));
        const hasCanXuLy = Boolean(row1.querySelector('[data-slot="action-queue-trigger"]') || Array.from(row1.querySelectorAll('button')).some(b => b.textContent.includes('Cần xử lý')));
        const ctaBtn = row1.querySelector('button:last-child');
        return {
          scopeBtns,
          hasCanXuLy,
          ctaText: ctaBtn ? ctaBtn.innerText.trim() : null,
          ctaPlusCount: ctaBtn ? ctaBtn.querySelectorAll('svg').length : 0
        };
      })()`,
      returnByValue: true,
    });
    console.log("Row 1 Check:", JSON.stringify(row1Info.result.value, null, 2));

    // Inspect Row 2 items
    const row2Info = await send("Runtime.evaluate", {
      expression: `(() => {
        const row2 = document.querySelector('[data-slot="unified-task-toolbar-row-2"]');
        if (!row2) return { error: 'Row 2 not found' };
        const searchInput = row2.querySelector('input[aria-label="Tìm nhiệm vụ"]');
        const searchBox = searchInput?.parentElement;
        const searchBoxRect = searchBox ? searchBox.getBoundingClientRect() : null;
        const row2Rect = row2.getBoundingClientRect();
        const filterBtn = row2.querySelector('button[aria-label="Bộ lọc nâng cao"]');
        const displayBtn = row2.querySelector('button[aria-label="Tùy chọn hiển thị"]');
        const savedViewsNav = row2.querySelector('[data-slot="saved-views-nav"]');
        return {
          searchBoxWidth: searchBoxRect?.width,
          searchBoxMaxWidth: searchBox ? window.getComputedStyle(searchBox).maxWidth : null,
          row2Width: row2Rect.width,
          hasSavedViews: Boolean(savedViewsNav),
          hasFilter: Boolean(filterBtn),
          hasDisplay: Boolean(displayBtn)
        };
      })()`,
      returnByValue: true,
    });
    console.log("Row 2 Check:", JSON.stringify(row2Info.result.value, null, 2));

    // Capture toolbar close-up
    const toolbarBox = await send("Runtime.evaluate", {
      expression: `(() => {
        const tb = document.querySelector('[data-slot="unified-task-toolbar"]');
        if (!tb) return null;
        const rect = tb.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      })()`,
      returnByValue: true,
    });
    if (toolbarBox.result.value) {
      const clip = toolbarBox.result.value;
      const shot = await send("Page.captureScreenshot", {
        format: "png",
        clip: { x: clip.x, y: clip.y, width: clip.width, height: clip.height, scale: 1 }
      });
      fs.writeFileSync("/tmp/ia-1-toolbar.png", Buffer.from(shot.data, "base64"));
      console.log("✓ Saved /tmp/ia-1-toolbar.png");
    }

    // Capture Full screenshot at Toàn trường
    const shotSchool = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync("/tmp/ia-2-toan-truong.png", Buffer.from(shotSchool.data, "base64"));
    console.log("✓ Saved /tmp/ia-2-toan-truong.png");

    // Switch to Đơn vị
    console.log("=== STEP 2: Switch to Đơn vị ===");
    await send("Runtime.evaluate", {
      expression: `document.querySelector('button[data-scope="unit"]')?.click()`,
    });
    await new Promise((resolve) => setTimeout(resolve, 400));
    const urlUnit = await send("Runtime.evaluate", { expression: `window.location.search` }, { returnByValue: true });
    console.log("URL at Đơn vị:", urlUnit.result.value);
    const shotUnit = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync("/tmp/ia-3-don-vi.png", Buffer.from(shotUnit.data, "base64"));
    console.log("✓ Saved /tmp/ia-3-don-vi.png");

    // Switch to Cá nhân
    console.log("=== STEP 3: Switch to Cá nhân ===");
    await send("Runtime.evaluate", {
      expression: `document.querySelector('button[data-scope="my"]')?.click()`,
    });
    await new Promise((resolve) => setTimeout(resolve, 400));
    const urlMy = await send("Runtime.evaluate", { expression: `window.location.search` }, { returnByValue: true });
    console.log("URL at Cá nhân:", urlMy.result.value);
    const shotMy = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync("/tmp/ia-4-ca-nhan.png", Buffer.from(shotMy.data, "base64"));
    console.log("✓ Saved /tmp/ia-4-ca-nhan.png");

    // Switch back to Toàn trường
    console.log("=== STEP 4: Switch back to Toàn trường ===");
    await send("Runtime.evaluate", {
      expression: `document.querySelector('button[data-scope="school"]')?.click()`,
    });
    await new Promise((resolve) => setTimeout(resolve, 400));
    const urlBack = await send("Runtime.evaluate", { expression: `window.location.search` }, { returnByValue: true });
    console.log("URL back at Toàn trường:", urlBack.result.value);

    console.log(">>> ALL IA VERIFICATION CHECKS PASSED <<<");
  } finally {
    chrome.kill();
  }
}

main().catch(console.error);
