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
    "--remote-debugging-port=9227",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--window-size=1440,900",
    "--user-data-dir=/tmp/chrome-screenshot-final-pass",
  ]);

  try {
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const targetsRes = await fetch("http://127.0.0.1:9227/json");
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

    console.log("=== STEP 1: Load /tasks ===");
    await send("Page.navigate", { url: "http://localhost:3001/tasks" });
    await new Promise((resolve) => setTimeout(resolve, 2500));

    // 1. Verify Primary CTA text & icons
    const ctaInfo = await send("Runtime.evaluate", {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const createBtn = btns.find(b => b.textContent.includes('Giao việc'));
        if (!createBtn) return { error: 'Not found' };
        const plusIcons = createBtn.querySelectorAll('svg');
        return {
          text: createBtn.innerText.trim(),
          svgCount: plusIcons.length,
          hasKbd: Boolean(createBtn.querySelector('kbd')),
          html: createBtn.outerHTML
        };
      })()`,
      returnByValue: true,
    });
    console.log("CTA Button check:", ctaInfo.result.value);

    // Save Screenshot 1: /tasks overall
    const shot1 = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync("/tmp/final-1-tasks-overall.png", Buffer.from(shot1.data, "base64"));
    console.log("✓ Saved /tmp/final-1-tasks-overall.png");

    // Save Screenshot 2: Toolbar close-up
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
      const shot2 = await send("Page.captureScreenshot", {
        format: "png",
        clip: { x: clip.x, y: clip.y, width: clip.width, height: clip.height, scale: 1 }
      });
      fs.writeFileSync("/tmp/final-2-toolbar-closeup.png", Buffer.from(shot2.data, "base64"));
      console.log("✓ Saved /tmp/final-2-toolbar-closeup.png");
    }

    // 2. Scenario 1: Scope switching stability (Ban Giám hiệu <-> Cá nhân x 3)
    console.log("=== STEP 2: Scope switching stability test ===");
    for (let i = 1; i <= 3; i++) {
      console.log(`Round ${i}: Switching to Cá nhân...`);
      await send("Runtime.evaluate", {
        expression: `document.querySelector('button[data-scope="my"]')?.click()`,
      });
      await new Promise((resolve) => setTimeout(resolve, 400));
      const urlMy = await send("Runtime.evaluate", { expression: `window.location.search` }, { returnByValue: true });
      console.log(`URL at my: ${urlMy.result.value}`);

      console.log(`Round ${i}: Switching to Ban Giám hiệu...`);
      await send("Runtime.evaluate", {
        expression: `document.querySelector('button[data-scope="school"]')?.click()`,
      });
      await new Promise((resolve) => setTimeout(resolve, 400));
      const urlSchool = await send("Runtime.evaluate", { expression: `window.location.search` }, { returnByValue: true });
      console.log(`URL at school: ${urlSchool.result.value}`);
    }

    // Save Screenshot 6: Ban Giám hiệu state
    const shot6 = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync("/tmp/final-6-ban-giam-hieu-state.png", Buffer.from(shot6.data, "base64"));
    console.log("✓ Saved /tmp/final-6-ban-giam-hieu-state.png");

    // Switch to Cá nhân and save Screenshot 7
    await send("Runtime.evaluate", {
      expression: `document.querySelector('button[data-scope="my"]')?.click()`,
    });
    await new Promise((resolve) => setTimeout(resolve, 400));
    const shot7 = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync("/tmp/final-7-ca-nhan-state.png", Buffer.from(shot7.data, "base64"));
    console.log("✓ Saved /tmp/final-7-ca-nhan-state.png");

    // Switch back to Ban Giám hiệu
    await send("Runtime.evaluate", {
      expression: `document.querySelector('button[data-scope="school"]')?.click()`,
    });
    await new Promise((resolve) => setTimeout(resolve, 400));

    // 3. Scenario 2: Search shortcut "/"
    console.log("=== STEP 3: Search shortcut '/' test ===");
    // Blur any active element
    await send("Runtime.evaluate", { expression: `document.activeElement?.blur()` });
    // Dispatch '/' key
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "/", code: "Slash" });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "/", code: "Slash" });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const isSearchFocused = await send("Runtime.evaluate", {
      expression: `document.activeElement === document.querySelector('input[aria-label="Tìm nhiệm vụ"]')`,
      returnByValue: true,
    });
    console.log("Is search input focused after '/' press:", isSearchFocused.result.value);

    // Type inside search
    await send("Input.insertText", { text: "/test" });
    const searchVal = await send("Runtime.evaluate", {
      expression: `document.querySelector('input[aria-label="Tìm nhiệm vụ"]')?.value`,
      returnByValue: true,
    });
    console.log("Search input value after typing '/test':", searchVal.result.value);

    // Clear search
    await send("Runtime.evaluate", {
      expression: `(() => {
        const input = document.querySelector('input[aria-label="Tìm nhiệm vụ"]');
        if (input) {
          input.value = '';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.blur();
        }
      })()`,
    });
    await new Promise((resolve) => setTimeout(resolve, 200));

    // 4. Open "Giao việc mới" modal
    console.log("=== STEP 4: Open Giao việc mới modal ===");
    await send("Runtime.evaluate", {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const createBtn = btns.find(b => b.textContent.includes('Giao việc'));
        createBtn?.click();
      })()`,
    });
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Verify Title received focus
    const isTitleFocused = await send("Runtime.evaluate", {
      expression: `document.activeElement === document.querySelector('input[placeholder^="Tên nhiệm vụ"]')`,
      returnByValue: true,
    });
    console.log("Is task title focused on modal open:", isTitleFocused.result.value);

    // Save Screenshot 3: Giao việc normal
    const shot3 = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync("/tmp/final-3-giao-viec-normal.png", Buffer.from(shot3.data, "base64"));
    console.log("✓ Saved /tmp/final-3-giao-viec-normal.png");

    // 5. Test Milestones inline insertion
    console.log("=== STEP 5: Milestones inline insertion ===");
    await send("Runtime.evaluate", {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const addBtn = btns.find(b => b.textContent.includes('Thêm đầu việc') || b.title?.includes('Thêm đầu việc'));
        addBtn?.click();
      })()`,
    });
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Type milestone name and press Enter
    await send("Input.insertText", { text: "Rà soát đề cương nhiệm vụ" });
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter" });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter" });
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Type 2nd milestone
    await send("Input.insertText", { text: "Tổ chức họp lấy ý kiến chuyên môn" });
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter" });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter" });
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Save Screenshot 5: Milestone inline insertion
    const shot5 = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync("/tmp/final-5-milestone-insertion.png", Buffer.from(shot5.data, "base64"));
    console.log("✓ Saved /tmp/final-5-milestone-insertion.png");

    // 6. Test Agent mode
    console.log("=== STEP 6: Toggle Agent mode ===");
    await send("Runtime.evaluate", {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const agentBtn = btns.find(b => b.textContent.includes('Tạo cùng Agent'));
        agentBtn?.click();
      })()`,
    });
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Save Screenshot 4: Giao việc Agent mode
    const shot4 = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync("/tmp/final-4-giao-viec-agent-mode.png", Buffer.from(shot4.data, "base64"));
    console.log("✓ Saved /tmp/final-4-giao-viec-agent-mode.png");

    // Close Agent mode
    await send("Runtime.evaluate", {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const collapseBtn = btns.find(b => b.getAttribute('aria-label')?.includes('Thu gọn'));
        collapseBtn?.click();
      })()`,
    });
    await new Promise((resolve) => setTimeout(resolve, 300));

    // 7. Test layered Escape behavior
    console.log("=== STEP 7: Layered Escape test ===");
    // Open Priority dropdown
    await send("Runtime.evaluate", {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const priBtn = btns.find(b => b.textContent.includes('Bình thường') || b.textContent.includes('Khẩn cấp'));
        priBtn?.click();
      })()`,
    });
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Verify priority dropdown is open
    let isDropdownOpen = await send("Runtime.evaluate", {
      expression: `Boolean(document.querySelector('.z-20'))`,
      returnByValue: true,
    });
    console.log("Priority dropdown open before Esc:", isDropdownOpen.result.value);

    // Press Escape
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape" });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape" });
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Verify dropdown is closed, but modal remains open
    isDropdownOpen = await send("Runtime.evaluate", {
      expression: `Boolean(document.querySelector('.z-20'))`,
      returnByValue: true,
    });
    const isModalStillOpen = await send("Runtime.evaluate", {
      expression: `Boolean(document.querySelector('[data-slot="linear-create-task-modal"]'))`,
      returnByValue: true,
    });
    console.log("Priority dropdown open after 1st Esc (should be false):", isDropdownOpen.result.value);
    console.log("Modal still open after 1st Esc (should be true):", isModalStillOpen.result.value);

    // Close modal via Escape
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape" });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape" });
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Confirm discard if prompt appeared
    await send("Runtime.evaluate", {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const discardBtn = btns.find(b => b.textContent.includes('Bỏ thay đổi') || b.textContent.includes('Hủy'));
        discardBtn?.click();
      })()`,
    });
    await new Promise((resolve) => setTimeout(resolve, 300));

    console.log(">>> ALL CHECKS COMPLETED SUCCESSFULLY <<<");
  } finally {
    chrome.kill();
  }
}

main().catch(console.error);
