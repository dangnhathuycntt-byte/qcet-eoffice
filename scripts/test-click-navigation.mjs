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
    "--remote-debugging-port=9224",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--window-size=1440,900",
    "--user-data-dir=/tmp/chrome-test-profile",
  ]);

  try {
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const targetsRes = await fetch("http://127.0.0.1:9224/json");
    const targets = await targetsRes.json();
    const pageTarget = targets.find((t) => t.type === "page") || targets[0];

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    let id = 1;
    const pending = new Map();

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === "Runtime.consoleAPICalled") {
        console.log("[BROWSER CONSOLE]", msg.params.type, msg.params.args.map((a) => a.value || a.description).join(" "));
      }
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
    await new Promise((resolve) => setTimeout(resolve, 3500));

    // Check initial state
    const initialUrl = await send("Runtime.evaluate", { expression: "window.location.href" });
    console.log("Initial URL:", initialUrl.result.value);

    // Let's inspect the DOM element for the first task
    const taskInfo = await send("Runtime.evaluate", {
      expression: `
        (() => {
          const row = document.querySelector("tr[data-task-id]");
          if (!row) return { error: "No row found" };
          const titleEl = row.querySelector("span[title]");
          return {
            taskId: row.getAttribute("data-task-id"),
            titleText: titleEl ? titleEl.textContent : "",
            isRowTabindex: row.getAttribute("tabindex"),
            hasInCanvasDetail: !!document.querySelector('[data-slot="in-canvas-linear-detail"]'),
          };
        })()
      `,
      returnByValue: true,
    });
    console.log("First row info:", taskInfo.result.value);

    // Now click the task title ONCE!
    console.log("Clicking the task title ONCE...");
    const clickResult = await send("Runtime.evaluate", {
      expression: `
        (() => {
          const row = document.querySelector("tr[data-task-id]");
          const titleEl = row?.querySelector("span[title]");
          if (titleEl) {
            console.log("Triggering click on titleEl:", titleEl.textContent);
            titleEl.click();
            return "Clicked titleEl";
          } else if (row) {
            row.click();
            return "Clicked row";
          }
          return "Not found";
        })()
      `,
      returnByValue: true,
    });
    console.log("Click result:", clickResult.result.value);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Now check URL and DOM
    const postClick = await send("Runtime.evaluate", {
      expression: `
        (() => {
          return {
            href: window.location.href,
            pathname: window.location.pathname,
            search: window.location.search,
            hasInCanvasDetail: !!document.querySelector('[data-slot="in-canvas-linear-detail"]'),
            selectedRowAttr: document.querySelector("tr[data-task-id]")?.getAttribute("aria-selected"),
            activeRowId: document.querySelector('[data-task-id][class*="ring"]')?.getAttribute("data-task-id"),
          };
        })()
      `,
      returnByValue: true,
    });
    console.log("Post click 1 state:", postClick.result.value);

    // Now let's see what happens if we click a second time
    console.log("Clicking a second time...");
    await send("Runtime.evaluate", {
      expression: `
        (() => {
          const row = document.querySelector("tr[data-task-id]");
          const titleEl = row?.querySelector("span[title]");
          if (titleEl) titleEl.click();
          else if (row) row.click();
        })()
      `,
    });
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const postClick2 = await send("Runtime.evaluate", {
      expression: `
        (() => {
          return {
            href: window.location.href,
            pathname: window.location.pathname,
            search: window.location.search,
            hasInCanvasDetail: !!document.querySelector('[data-slot="in-canvas-linear-detail"]'),
          };
        })()
      `,
      returnByValue: true,
    });
    console.log("Post click 2 state:", postClick2.result.value);

    ws.close();
  } finally {
    chrome.kill();
  }
}

main().catch(console.error);
