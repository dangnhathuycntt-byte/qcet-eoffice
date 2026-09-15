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
    "--remote-debugging-port=9226",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--window-size=1440,900",
    "--user-data-dir=/tmp/chrome-screenshot-anti-slop",
  ]);

  try {
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const targetsRes = await fetch("http://127.0.0.1:9226/json");
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

    console.log("Navigating to http://localhost:3001/tasks...");
    await send("Page.navigate", { url: "http://localhost:3001/tasks" });
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // 1. Capture table list
    console.log("1. Capturing tasks list with de-slop updates...");
    const listShot = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync("/tmp/anti-slop-tasks-list.png", Buffer.from(listShot.data, "base64"));
    console.log("Saved /tmp/anti-slop-tasks-list.png");

    // 2. Open Filter Popover and capture
    console.log("2. Opening Filter popover...");
    await send("Runtime.evaluate", {
      expression: `document.querySelector('button[aria-label="Bộ lọc nâng cao"]')?.click()`,
    });
    await new Promise((resolve) => setTimeout(resolve, 500));
    const filterShot = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync("/tmp/anti-slop-filter-popover.png", Buffer.from(filterShot.data, "base64"));
    console.log("Saved /tmp/anti-slop-filter-popover.png");

    // Close Filter Popover
    await send("Runtime.evaluate", {
      expression: `document.querySelector('button[aria-label="Đóng bộ lọc"]')?.click()`,
    });
    await new Promise((resolve) => setTimeout(resolve, 300));

    // 3. Open Display Popover and capture
    console.log("3. Opening Display popover...");
    await send("Runtime.evaluate", {
      expression: `document.querySelector('button[aria-label="Tùy chọn hiển thị"]')?.click()`,
    });
    await new Promise((resolve) => setTimeout(resolve, 500));
    const displayShot = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync("/tmp/anti-slop-display-popover.png", Buffer.from(displayShot.data, "base64"));
    console.log("Saved /tmp/anti-slop-display-popover.png");

    ws.close();
  } finally {
    chrome.kill();
  }
}

main().catch(console.error);
