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
    "--user-data-dir=/tmp/chrome-screenshot-ux-pass",
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
      return new Promise((resolve) => {
        pending.set(reqId, { resolve, reject: (err) => resolve({ error: err }) });
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

    // 1. Inspect Table Headers & Rows
    const tableInfo = await send("Runtime.evaluate", {
      expression: `(() => {
        const headers = Array.from(document.querySelectorAll('thead th')).map(th => th.innerText.trim());
        const firstRow = document.querySelector('tbody tr[data-task-id]');
        const hasBoxIcon = Boolean(firstRow?.querySelector('svg.lucide-box'));
        const statuses = Array.from(document.querySelectorAll('tbody tr[data-task-id] td:nth-child(3)')).slice(0, 10).map(td => td.innerText.trim());
        const taskCodes = Array.from(document.querySelectorAll('tbody tr[data-task-id] td:nth-child(2) span.font-mono')).slice(0, 5).map(s => s.innerText.trim());
        const hasChuaLam = Array.from(document.querySelectorAll('tbody tr')).some(tr => tr.innerText.includes('Chưa làm'));
        return {
          headers,
          hasBoxIcon,
          statuses,
          taskCodes,
          hasChuaLam
        };
      })()`,
      returnByValue: true,
    });
    console.log("Table Inspection:", JSON.stringify(tableInfo.result.value, null, 2));

    // Capture main table screenshot
    const shotMain = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync("/tmp/ux-1-table.png", Buffer.from(shotMain.data, "base64"));
    console.log("✓ Saved /tmp/ux-1-table.png");

    // 2. Open Filter Popover & Inspect
    console.log("=== STEP 2: Open Filter Popover ===");
    await send("Runtime.evaluate", {
      expression: `document.querySelector('button[aria-label="Bộ lọc nâng cao"]')?.click()`,
    });
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Click on Trạng thái inside popover to open custom dropdown
    await send("Runtime.evaluate", {
      expression: `(() => {
        const rows = document.querySelectorAll('[role="dialog"][aria-label="Bộ lọc nâng cao"] .divide-y > div');
        if (rows[0]) rows[0].querySelector('div')?.click();
      })()`,
    });
    await new Promise((resolve) => setTimeout(resolve, 400));

    const popoverInfo = await send("Runtime.evaluate", {
      expression: `(() => {
        const popover = document.querySelector('[role="dialog"][aria-label="Bộ lọc nâng cao"]');
        if (!popover) return { error: 'Popover not open' };
        const statusMenu = popover.querySelector('.absolute');
        const statusOptions = statusMenu ? Array.from(statusMenu.querySelectorAll('button')).map(b => b.innerText.trim()) : [];
        return {
          isOpen: true,
          statusOptions
        };
      })()`,
      returnByValue: true,
    });
    console.log("Popover Inspection:", JSON.stringify(popoverInfo.result.value, null, 2));

    const shotFilter = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync("/tmp/ux-2-filter.png", Buffer.from(shotFilter.data, "base64"));
    console.log("✓ Saved /tmp/ux-2-filter.png");

    // 3. Test Search Typing
    console.log("=== STEP 3: Test Search Input ===");
    await send("Runtime.evaluate", {
      expression: `(() => {
        const input = document.querySelector('input[aria-label="Tìm nhiệm vụ"]');
        if (input) {
          input.focus();
          input.value = "Công đoàn";
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      })()`,
    });
    await new Promise((resolve) => setTimeout(resolve, 600));

    const searchInfo = await send("Runtime.evaluate", {
      expression: `(() => {
        const rows = Array.from(document.querySelectorAll('tbody tr[data-task-id]'));
        const input = document.querySelector('input[aria-label="Tìm nhiệm vụ"]');
        return {
          inputValue: input?.value,
          matchingRowsCount: rows.length,
          url: window.location.search
        };
      })()`,
      returnByValue: true,
    });
    console.log("Search Inspection:", JSON.stringify(searchInfo.result.value, null, 2));

    const shotSearch = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync("/tmp/ux-3-search.png", Buffer.from(shotSearch.data, "base64"));
    console.log("✓ Saved /tmp/ux-3-search.png");

    console.log(">>> ALL UX VERIFICATIONS COMPLETED <<<");
  } finally {
    chrome.kill();
  }
}

main().catch(console.error);
