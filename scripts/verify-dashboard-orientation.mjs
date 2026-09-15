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
    "--user-data-dir=/tmp/chrome-screenshot-dashboard-orientation",
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

    console.log("=== STEP 1: Navigate to / (Bàn làm việc) ===");
    await send("Page.navigate", { url: "http://localhost:3001/" });
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Inspect Bàn làm việc
    const dashboardInfo = await send("Runtime.evaluate", {
      expression: `(() => {
        const pageTitle = document.querySelector('h1')?.innerText.trim();
        const createBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Tạo nhiệm vụ'))?.innerText.trim();
        const scopeButtons = Array.from(document.querySelectorAll('[role="tablist"] button')).map(b => b.innerText.trim());
        const sections = Array.from(document.querySelectorAll('section h2')).map(h => h.innerText.trim());
        const attentionLinks = Array.from(document.querySelectorAll('[data-slot="section-attention"] a')).map(a => a.innerText.replace(/\\s+/g, ' ').trim());
        const hasTaskSearch = Boolean(document.querySelector('input[placeholder*="Tìm"], input[aria-label*="Tìm"]'));
        const hasKpiTiles = Boolean(document.querySelector('[data-slot="tier-1-verdict-toolbar"], [data-slot="dashboard-situation-strip"]'));
        const hasProgressControls = Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('+10%') || b.innerText.includes('+25%'));

        return {
          pageTitle,
          createBtn,
          scopeButtons,
          sections,
          attentionItemsCount: attentionLinks.length,
          firstAttentionItem: attentionLinks[0],
          hasTaskSearch,
          hasKpiTiles,
          hasProgressControls
        };
      })()`,
      returnByValue: true,
    });
    console.log("Dashboard Inspection:", JSON.stringify(dashboardInfo.result.value, null, 2));

    // Capture main table screenshot
    const shotMain = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync("/tmp/ux-dashboard-orientation.png", Buffer.from(shotMain.data, "base64"));
    console.log("✓ Saved /tmp/ux-dashboard-orientation.png");

    console.log(">>> DASHBOARD ORIENTATION VERIFICATION COMPLETED <<<");
  } finally {
    chrome.kill();
  }
}

main().catch(console.error);
