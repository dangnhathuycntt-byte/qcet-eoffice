import { spawn } from "node:child_process";
import fs from "node:fs";

// Read cookie from /tmp/qcet_cookie.txt
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
    "--remote-debugging-port=9223",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--window-size=1440,900",
    "--user-data-dir=/tmp/chrome-screenshot-profile",
  ]);

  try {
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const targetsRes = await fetch("http://127.0.0.1:9223/json");
    const targets = await targetsRes.json();
    const pageTarget = targets.find((t) => t.type === "page") || targets[0];

    if (!pageTarget || !pageTarget.webSocketDebuggerUrl) {
      throw new Error("No page target found");
    }

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

    await new Promise((resolve) => {
      ws.onopen = resolve;
    });

    function send(method, params = {}) {
      const reqId = id++;
      return new Promise((resolve, reject) => {
        pending.set(reqId, { resolve, reject });
        ws.send(JSON.stringify({ id: reqId, method, params }));
      });
    }

    console.log("1. Enabling Network, Page, Runtime domains...");
    await send("Network.enable");
    await send("Page.enable");
    await send("Runtime.enable");

    console.log("2. Setting session cookie...");
    await send("Network.setCookie", {
      name: "qcet_session",
      value: sessionToken,
      domain: "localhost",
      path: "/",
      httpOnly: true,
    });

    console.log("3. Navigating to http://localhost:3001/tasks...");
    await send("Page.navigate", { url: "http://localhost:3001/tasks" });
    await new Promise((resolve) => setTimeout(resolve, 3500));

    console.log("4. Capturing List screen...");
    const listScreenshot = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync("/tmp/linear-qcet-tasks-list.png", Buffer.from(listScreenshot.data, "base64"));
    console.log("Saved /tmp/linear-qcet-tasks-list.png");

    console.log("5. Opening Create Task Modal via shortcut 'c'...");
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "c", code: "KeyC", text: "c" });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "c", code: "KeyC" });
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const createModalScreenshot = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync("/tmp/linear-qcet-tasks-create-modal.png", Buffer.from(createModalScreenshot.data, "base64"));
    console.log("Saved /tmp/linear-qcet-tasks-create-modal.png");

    console.log("6. Closing modal and finding first task link...");
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape" });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape" });
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Get first task id
    const evalResult = await send("Runtime.evaluate", {
      expression: 'document.querySelector("[data-task-id]")?.getAttribute("data-task-id")',
    });
    const taskId = evalResult?.result?.value;
    console.log("Found task ID:", taskId);

    if (taskId) {
      console.log(`7. Navigating to task detail http://localhost:3001/tasks/${taskId}...`);
      await send("Page.navigate", { url: `http://localhost:3001/tasks/${taskId}` });
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const detailScreenshot = await send("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync("/tmp/linear-qcet-tasks-detail.png", Buffer.from(detailScreenshot.data, "base64"));
      console.log("Saved /tmp/linear-qcet-tasks-detail.png");
    }

    ws.close();
  } finally {
    chrome.kill();
  }
}

main().catch((err) => {
  console.error("Error during screenshot capture:", err);
  process.exit(1);
});
