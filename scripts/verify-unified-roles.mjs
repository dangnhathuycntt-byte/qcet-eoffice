import { spawn } from "node:child_process";
import fs from "node:fs";
import jwt from "jsonwebtoken";

const JWT_SECRET = "qcet_eoffice_enterprise_jwt_secret_key_2026_super_safe";

const bghToken = jwt.sign(
  {
    id: "cmtswacjw0001vidrd1r3id55",
    email: "tuongpv@cdktcnqn.edu.vn",
    name: "ThS. Phạm Văn Tường (Hiệu trưởng)",
    role: "BAN_GIAM_HIEU",
    departmentId: "BGH",
    title: "Hiệu trưởng",
  },
  JWT_SECRET,
  { expiresIn: "1d" }
);

const mgrToken = jwt.sign(
  {
    id: "cmtswack7000fvidrouguertn",
    email: "daotao@cdktcnqn.edu.vn",
    name: "Phòng Quản lý Đào tạo",
    role: "TRUONG_PHONG",
    departmentId: "P_QLDT",
    title: "Trưởng phòng Đào tạo",
  },
  JWT_SECRET,
  { expiresIn: "1d" }
);

const staffToken = jwt.sign(
  {
    id: "cmtswackg0015vidr88ji97hc",
    email: "khoipd@cdktcnqn.edu.vn",
    name: "ThS. Phan Đình Khôi (Giảng viên CNTT)",
    role: "CHUYEN_VIEN",
    departmentId: "K_CNTT",
    title: "Giảng viên CNTT",
  },
  JWT_SECRET,
  { expiresIn: "1d" }
);

async function run() {
  const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
    "--headless=new",
    "--remote-debugging-port=9229",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--window-size=1440,900",
    "--user-data-dir=/tmp/chrome-verification-roles",
  ]);

  try {
    await new Promise((r) => setTimeout(r, 1500));
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

    async function setSession(token) {
      await send("Runtime.evaluate", { expression: "try { localStorage.clear(); sessionStorage.clear(); } catch(e) {}" });
      await send("Network.setCookie", {
        name: "qcet_session",
        value: token,
        domain: "localhost",
        path: "/",
        httpOnly: true,
      });
    }

    // TEST 1: Check root "/" redirect to "/tasks" for BGH
    console.log("\n=== TEST 1: Root / redirect to /tasks ===");
    await setSession(bghToken);
    await send("Page.navigate", { url: "http://localhost:3001/" });
    await new Promise((r) => setTimeout(r, 2000));

    const currentUrlInfo = await send("Runtime.evaluate", {
      expression: "window.location.pathname",
      returnByValue: true,
    });
    console.log("Navigated to '/', current pathname:", currentUrlInfo.result.value);

    // Inspect Sidebar
    const sidebarInfo = await send("Runtime.evaluate", {
      expression: `(() => {
        const links = Array.from(document.querySelectorAll('[data-slot="app-sidebar"] a')).map(a => a.innerText.trim());
        const hasBanLamViec = links.some(l => l.includes('Bàn làm việc'));
        const hasNhiemVu = links.some(l => l.includes('Nhiệm vụ'));
        return { links: links.slice(0, 5), hasBanLamViec, hasNhiemVu };
      })()`,
      returnByValue: true,
    });
    console.log("Sidebar Check:", JSON.stringify(sidebarInfo.result.value, null, 2));

    // TEST 2: Inspect BGH Workspace Scopes & UI
    console.log("\n=== TEST 2: BGH Account Workspace ===");
    const bghWorkspace = await send("Runtime.evaluate", {
      expression: `(() => {
        const scopes = Array.from(document.querySelectorAll('[data-slot="adaptive-scope-header"] button')).map(b => b.innerText.trim().replace(/\\s+/g, ' '));
        const hasTable = Boolean(document.querySelector('table'));
        const hasSavedViews = Boolean(document.querySelector('[data-slot="saved-views-nav"]'));
        const hasSearch = Boolean(document.querySelector('input[aria-label="Tìm nhiệm vụ"]'));
        const hasFilters = Boolean(document.querySelector('button[aria-label="Bộ lọc nâng cao"]'));
        const createBtnText = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Tạo việc'))?.innerText.trim();
        return { scopes, hasTable, hasSavedViews, hasSearch, hasFilters, createBtnText };
      })()`,
      returnByValue: true,
    });
    console.log("BGH Workspace:", JSON.stringify(bghWorkspace.result.value, null, 2));

    // Check table header for "Nhiệm vụ" column
    const headerTitleInfo = await send("Runtime.evaluate", {
      expression: `(() => {
        const th = Array.from(document.querySelectorAll('thead th')).find(t => t.innerText.includes('Nhiệm vụ'));
        const hasChevronInTitleTh = Boolean(th?.querySelector('svg.lucide-chevron-right, svg.lucide-chevron-down'));
        return {
          thText: th?.innerText.trim().replace(/\\s+/g, ' '),
          hasChevronInTitleTh,
          buttonsInThCount: th ? th.querySelectorAll('button').length : 0
        };
      })()`,
      returnByValue: true,
    });
    console.log("Table Header 'Nhiệm vụ' Column Check:", JSON.stringify(headerTitleInfo.result.value, null, 2));

    // Screenshot BGH
    const shotBgh = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync("/tmp/ux-tasks-bgh.png", Buffer.from(shotBgh.data, "base64"));
    console.log("✓ Saved /tmp/ux-tasks-bgh.png");

    // TEST 3: Inspect Unit Manager Account Workspace
    console.log("\n=== TEST 3: Unit Manager (CNTT) Account Workspace ===");
    await setSession(mgrToken);
    await send("Page.navigate", { url: "http://localhost:3001/tasks" });
    await new Promise((r) => setTimeout(r, 2000));

    const mgrWorkspace = await send("Runtime.evaluate", {
      expression: `(() => {
        const scopes = Array.from(document.querySelectorAll('[data-slot="adaptive-scope-header"] button')).map(b => b.innerText.trim().replace(/\\s+/g, ' '));
        const hasTable = Boolean(document.querySelector('table'));
        const hasSavedViews = Boolean(document.querySelector('[data-slot="saved-views-nav"]'));
        const hasSearch = Boolean(document.querySelector('input[aria-label="Tìm nhiệm vụ"]'));
        const hasFilters = Boolean(document.querySelector('button[aria-label="Bộ lọc nâng cao"]'));
        const createBtnText = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Tạo việc'))?.innerText.trim();
        return { scopes, hasTable, hasSavedViews, hasSearch, hasFilters, createBtnText };
      })()`,
      returnByValue: true,
    });
    console.log("Manager Workspace:", JSON.stringify(mgrWorkspace.result.value, null, 2));

    // Screenshot Manager
    const shotMgr = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync("/tmp/ux-tasks-mgr.png", Buffer.from(shotMgr.data, "base64"));
    console.log("✓ Saved /tmp/ux-tasks-mgr.png");

    // TEST 4: Inspect Staff Account Workspace
    console.log("\n=== TEST 4: Staff (CNTT) Account Workspace ===");
    await setSession(staffToken);
    await send("Page.navigate", { url: "http://localhost:3001/tasks" });
    await new Promise((r) => setTimeout(r, 2000));

    const staffWorkspace = await send("Runtime.evaluate", {
      expression: `(() => {
        const scopes = Array.from(document.querySelectorAll('[data-slot="adaptive-scope-header"] button')).map(b => b.innerText.trim().replace(/\\s+/g, ' '));
        const hasTable = Boolean(document.querySelector('table'));
        const emptyState = document.querySelector('[data-slot="workspace-empty-state"]')?.innerText.replace(/\\s+/g, ' ').trim();
        const hasSavedViews = Boolean(document.querySelector('[data-slot="saved-views-nav"]'));
        const hasSearch = Boolean(document.querySelector('input[aria-label="Tìm nhiệm vụ"]'));
        const hasFilters = Boolean(document.querySelector('button[aria-label="Bộ lọc nâng cao"]'));
        const createBtnText = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Tạo việc'))?.innerText.trim();
        const activeScope = document.querySelector('[data-slot="adaptive-scope-header"] button[aria-selected="true"]')?.innerText.trim().replace(/\s+/g, ' ');
        return { scopes, activeScope, hasTable, emptyState, hasSavedViews, hasSearch, hasFilters, createBtnText };
      })()`,
      returnByValue: true,
    });
    console.log("Staff Workspace (Initial):", JSON.stringify(staffWorkspace.result.value, null, 2));

    // Click on unit scope for staff
    console.log("-> Clicking on Unit scope button...");
    await send("Runtime.evaluate", {
      expression: `document.querySelector('[data-slot="adaptive-scope-header"] button[data-scope="unit"]')?.click()`,
    });
    await new Promise((r) => setTimeout(r, 1000));

    const staffUnitWorkspace = await send("Runtime.evaluate", {
      expression: `(() => {
        const activeScopeAfter = document.querySelector('[data-slot="adaptive-scope-header"] button[aria-selected="true"]')?.innerText.trim().replace(/\\s+/g, ' ');
        const activeDataScope = document.querySelector('[data-active-scope]')?.getAttribute('data-active-scope');
        const hasTable = Boolean(document.querySelector('table'));
        const rows = Array.from(document.querySelectorAll('table tbody tr')).map(tr => tr.innerText.replace(/\\s+/g, ' '));
        return { activeScopeAfter, activeDataScope, hasTable, rowsCount: rows.length };
      })()`,
      returnByValue: true,
    });
    // Click back to personal scope for staff
    console.log("-> Clicking back to Personal (my) scope button...");
    await send("Runtime.evaluate", {
      expression: `document.querySelector('[data-slot="adaptive-scope-header"] button[data-scope="my"]')?.click()`,
    });
    await new Promise((r) => setTimeout(r, 1000));

    const staffPersonalWorkspace = await send("Runtime.evaluate", {
      expression: `(() => {
        const activeScopeAfter = document.querySelector('[data-slot="adaptive-scope-header"] button[aria-selected="true"]')?.innerText.trim().replace(/\\s+/g, ' ');
        const activeDataScope = document.querySelector('[data-active-scope]')?.getAttribute('data-active-scope');
        return { activeScopeAfter, activeDataScope };
      })()`,
      returnByValue: true,
    });
    console.log("Staff Workspace (After Switching Back to My Scope):", JSON.stringify(staffPersonalWorkspace.result.value, null, 2));

    // TEST 5: Account with unassigned / no department (Only 1 scope => scope switcher hidden)
    console.log("\n=== TEST 5: Account with No Department (Single Scope => Hidden Switcher) ===");
    const unassignedToken = jwt.sign(
      {
        id: "cmtwrlfk3000dvil9pzzw28zt",
        email: "spec_a_1789119565015@qcet.edu.vn",
        name: "Chuyên viên Chưa Gán Đơn Vị",
        role: "STAFF",
        departmentId: null,
      },
      JWT_SECRET,
      { expiresIn: "1d" }
    );
    await setSession(unassignedToken);
    await send("Page.navigate", { url: "http://localhost:3001/tasks" });
    await new Promise((r) => setTimeout(r, 2000));

    const unassignedWorkspace = await send("Runtime.evaluate", {
      expression: `(() => {
        const switcher = document.querySelector('[data-slot="adaptive-scope-header"]');
        const scopes = switcher ? Array.from(switcher.querySelectorAll('button')).map(b => b.innerText.trim()) : [];
        const hasSavedViews = Boolean(document.querySelector('[data-slot="saved-views-nav"]'));
        const hasSearch = Boolean(document.querySelector('input[aria-label="Tìm nhiệm vụ"]'));
        return { isSwitcherRendered: Boolean(switcher), scopesCount: scopes.length, hasSavedViews, hasSearch };
      })()`,
      returnByValue: true,
    });
    console.log("Unassigned Workspace:", JSON.stringify(unassignedWorkspace.result.value, null, 2));
  } finally {
    chrome.kill();
  }
}

run().catch(console.error);
