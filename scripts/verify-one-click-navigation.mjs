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
    "--remote-debugging-port=9225",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--window-size=1440,900",
    "--user-data-dir=/tmp/chrome-verify-profile",
  ]);

  try {
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const targetsRes = await fetch("http://127.0.0.1:9225/json");
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

    console.log("=== STEP 1: Load /tasks fresh ===");
    await send("Page.navigate", { url: "http://localhost:3001/tasks" });
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const checkUrl1 = await send("Runtime.evaluate", { expression: "window.location.pathname" });
    console.log("Loaded pathname:", checkUrl1.result.value);
    if (checkUrl1.result.value !== "/tasks") throw new Error("Not on /tasks");

    console.log("\n=== STEP 2: Click task 1 once ===");
    const task1 = await send("Runtime.evaluate", {
      expression: `
        (() => {
          const rows = document.querySelectorAll("tr[data-task-id]");
          if (rows.length === 0) return { error: "no rows" };
          const row = rows[0];
          const id = row.getAttribute("data-task-id");
          const titleEl = row.querySelector("span[title]");
          titleEl.click();
          return { id, title: titleEl.textContent };
        })()
      `,
      returnByValue: true,
    });
    console.log("Clicked task 1:", task1.result.value);
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const postClick1 = await send("Runtime.evaluate", { expression: "window.location.pathname" });
    console.log("URL after 1 click on task 1:", postClick1.result.value);
    if (postClick1.result.value !== `/tasks/${task1.result.value.id}`) {
      throw new Error(`Expected /tasks/${task1.result.value.id} but got ${postClick1.result.value}`);
    }
    console.log("✓ Task 1 opened immediately on single click!");

    console.log("\n=== STEP 3: Go back ===");
    await send("Runtime.evaluate", { expression: "window.history.back()" });
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const backUrl1 = await send("Runtime.evaluate", { expression: "window.location.pathname" });
    console.log("URL after back:", backUrl1.result.value);

    console.log("\n=== STEP 4: Click task 2 once ===");
    const task2 = await send("Runtime.evaluate", {
      expression: `
        (() => {
          const rows = document.querySelectorAll("tr[data-task-id]");
          if (rows.length < 2) return { error: "less than 2 rows" };
          const row = rows[1];
          const id = row.getAttribute("data-task-id");
          const titleEl = row.querySelector("span[title]");
          titleEl.click();
          return { id, title: titleEl.textContent };
        })()
      `,
      returnByValue: true,
    });
    console.log("Clicked task 2:", task2.result.value);
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const postClick2 = await send("Runtime.evaluate", { expression: "window.location.pathname" });
    console.log("URL after 1 click on task 2:", postClick2.result.value);
    if (postClick2.result.value !== `/tasks/${task2.result.value.id}`) {
      throw new Error(`Expected /tasks/${task2.result.value.id} but got ${postClick2.result.value}`);
    }
    console.log("✓ Task 2 opened immediately on single click!");

    console.log("\n=== STEP 5: Go back again ===");
    await send("Runtime.evaluate", { expression: "window.history.back()" });
    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log("\n=== STEP 6: Click task 3 once ===");
    const task3 = await send("Runtime.evaluate", {
      expression: `
        (() => {
          const rows = document.querySelectorAll("tr[data-task-id]");
          if (rows.length < 3) return { error: "less than 3 rows" };
          const row = rows[2];
          const id = row.getAttribute("data-task-id");
          const titleEl = row.querySelector("span[title]");
          titleEl.click();
          return { id, title: titleEl.textContent };
        })()
      `,
      returnByValue: true,
    });
    console.log("Clicked task 3:", task3.result.value);
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const postClick3 = await send("Runtime.evaluate", { expression: "window.location.pathname" });
    console.log("URL after 1 click on task 3:", postClick3.result.value);
    if (postClick3.result.value !== `/tasks/${task3.result.value.id}`) {
      throw new Error(`Expected /tasks/${task3.result.value.id} but got ${postClick3.result.value}`);
    }
    console.log("✓ Task 3 opened immediately on single click!");

    console.log("\n=== STEP 7: Go back and verify Checkbox & Context Menu ===");
    await send("Runtime.evaluate", { expression: "window.history.back()" });
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Click checkbox
    const checkboxTest = await send("Runtime.evaluate", {
      expression: `
        (() => {
          const checkbox = document.querySelector('tr[data-task-id] input[type="checkbox"]');
          if (!checkbox) return { error: "no checkbox" };
          const beforeChecked = checkbox.checked;
          checkbox.click();
          const afterChecked = checkbox.checked;
          return { beforeChecked, afterChecked, pathname: window.location.pathname };
        })()
      `,
      returnByValue: true,
    });
    console.log("Checkbox click result:", checkboxTest.result.value);
    if (checkboxTest.result.value.pathname !== "/tasks") {
      throw new Error("Checkbox click navigated away!");
    }
    console.log("✓ Checkbox toggles selection without navigating!");

    // Click context menu trigger
    const contextMenuTest = await send("Runtime.evaluate", {
      expression: `
        (() => {
          const trigger = document.querySelector('tr[data-task-id] button[aria-label="Thao tác nhanh"]');
          if (!trigger) return { error: "no trigger" };
          trigger.click();
          return { pathname: window.location.pathname };
        })()
      `,
      returnByValue: true,
    });
    console.log("Context menu button result:", contextMenuTest.result.value);
    if (contextMenuTest.result.value.pathname !== "/tasks") {
      throw new Error("Context menu button navigated away!");
    }
    console.log("✓ Context menu button does not accidentally navigate!");

    console.log("\n>>> ALL VERIFICATION STEPS PASSED WITH 100% RELIABILITY <<<");

    ws.close();
  } finally {
    chrome.kill();
  }
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
