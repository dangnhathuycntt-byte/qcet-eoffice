import { expect, test, type Page } from "@playwright/test";
import { DOC_LONG_ID, DOC_OUTGOING_ID, DOC_SUBMISSION_ID, docIdForFiles } from "./fixtures";

const pane = (page: Page) => page.locator('[data-slot="document-quick-view"][data-mode="pane"]');
const row = (page: Page, id: string) => page.locator(`[data-slot="document-ledger-table"] [data-doc-id="${id}"]`);
const search = (page: Page) => new URL(page.url()).searchParams;

test.describe("Quick View (pane không modal)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("mở pane từ danh sách: URL có docId, pane là region, danh sách vẫn tương tác", async ({ page }) => {
    await page.goto("/documents");
    await row(page, docIdForFiles(5)).click();
    await expect(pane(page)).toBeVisible();
    await expect(pane(page)).toHaveAttribute("role", "region");
    expect(search(page).get("docId")).toBe(docIdForFiles(5));
    await expect(page.locator('[data-slot="document-quick-view"][role="dialog"]')).toHaveCount(0);
    await expect(row(page, docIdForFiles(5))).toHaveAttribute("aria-current", "true");

    // Danh sách bên cạnh vẫn bấm được và đổi văn bản mà không dựng lại pane
    await pane(page).evaluate((el) => el.setAttribute("data-marker", "same-pane"));
    await row(page, docIdForFiles(1)).click();
    await expect.poll(() => search(page).get("docId")).toBe(docIdForFiles(1));
    await expect(pane(page)).toHaveAttribute("data-marker", "same-pane");
    await expect(pane(page).getByRole("heading", { name: "Văn bản E2E 1 tệp" })).toBeVisible();
  });

  test("lịch sử: Back đóng pane, Forward mở lại, làm mới giữ nguyên", async ({ page }) => {
    await page.goto("/documents");
    await row(page, docIdForFiles(5)).click();
    await expect(pane(page)).toBeVisible();
    await page.reload();
    await expect(pane(page)).toBeVisible();
    await page.goBack();
    await expect(pane(page)).toHaveCount(0);
    expect(search(page).get("docId")).toBeNull();
    await page.goForward();
    await expect(pane(page)).toBeVisible();
    expect(search(page).get("docId")).toBe(docIdForFiles(5));
  });

  test("đổi văn bản bằng replace: Back sau khi đổi quay về danh sách đóng pane", async ({ page }) => {
    await page.goto("/documents");
    await row(page, docIdForFiles(5)).click();
    await expect(pane(page)).toBeVisible();
    await row(page, docIdForFiles(1)).click();
    await expect.poll(() => search(page).get("docId")).toBe(docIdForFiles(1));
    await page.goBack();
    await expect(pane(page)).toHaveCount(0);
  });

  test("nút Đóng và phím Esc đóng pane, trả focus về dòng đã mở", async ({ page }) => {
    await page.goto("/documents");
    await row(page, docIdForFiles(5)).click();
    await expect(pane(page)).toBeVisible();
    await page.getByRole("button", { name: "Đóng", exact: true }).focus();
    await page.keyboard.press("Escape");
    await expect(pane(page)).toHaveCount(0);
    await expect(row(page, docIdForFiles(5))).toBeFocused();
    expect(search(page).get("docId")).toBeNull();
  });

  test("deep link tới văn bản ngoài trang đang tải vẫn mở đúng văn bản; đóng không thoát khỏi app", async ({ page }) => {
    await page.goto(`/documents?pageSize=2&docId=${DOC_LONG_ID}`);
    await expect(pane(page)).toBeVisible();
    await expect(pane(page).getByRole("heading", { name: "Văn bản E2E một tệp 60 trang" })).toBeVisible();
    await page.getByRole("button", { name: "Đóng", exact: true }).click();
    await expect(pane(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/documents\?pageSize=2$/);
  });

  test("văn bản không tồn tại hiện lỗi trong pane, không mở nhầm văn bản khác", async ({ page }) => {
    await page.goto("/documents?docId=khong-ton-tai");
    await expect(pane(page).getByRole("alert")).toContainText("không tồn tại");
    await expect(pane(page).getByRole("heading")).toHaveCount(0);
  });

  test("chọn tệp ghi file= lên URL và khôi phục sau khi làm mới", async ({ page }) => {
    await page.goto(`/documents?docId=${docIdForFiles(5)}`);
    await expect(pane(page).locator('[data-slot="active-file-name"]')).toHaveText("tep-1.pdf");
    await pane(page).getByRole("button", { name: "Tệp 5" }).click();
    await page.getByRole("option", { name: /tep-3\.pdf/ }).click();
    await expect.poll(() => search(page).get("file")).toBe(`${docIdForFiles(5)}_att3`);
    await page.reload();
    await expect(pane(page).locator('[data-slot="active-file-name"]')).toHaveText("tep-3.pdf");
  });

  test("nhóm Đã xử lý trống: nói đúng ngữ cảnh, không báo bộ lọc, có lối sang Chờ xử lý (giữ loại sổ)", async ({ page }) => {
    await page.goto("/documents?type=inbox&bucket=done");
    const empty = page.locator('[data-slot="document-ledger-table"]');
    await expect(empty.getByText("Chưa có văn bản đến đã xử lý")).toBeVisible();
    await expect(empty.getByText(/bộ lọc/)).toHaveCount(0);
    await empty.getByRole("button", { name: "Xem văn bản chờ xử lý" }).click();
    await expect.poll(() => search(page).get("bucket")).toBe("pending");
    expect(search(page).get("type")).toBe("inbox");
  });

  test("vùng đầu gọn: lưới thuộc tính có nhãn, không còn danh sách tệp trùng nút Tệp N", async ({ page }) => {
    await page.goto(`/documents?docId=${docIdForFiles(5)}`);
    const grid = pane(page).locator('[data-slot="quick-properties"]');
    await expect(grid.getByText("Trạng thái")).toBeVisible();
    await expect(pane(page).locator('[data-slot="attached-files"]')).toHaveCount(0);
    // Nhãn của lưới và dòng Nhiệm vụ cùng một cột
    const [labelBox, taskLabelBox] = await Promise.all([
      grid.getByText("Trạng thái").boundingBox(),
      pane(page).getByRole("region", { name: "Nhiệm vụ liên kết" }).getByText("Nhiệm vụ", { exact: true }).boundingBox(),
    ]);
    expect(Math.abs(labelBox!.x - taskLabelBox!.x)).toBeLessThanOrEqual(1);
  });

  test("độ rộng pane đổi bằng bàn phím, nhớ sau khi làm mới, danh sách không dưới 480px", async ({ page }) => {
    await page.goto(`/documents?docId=${docIdForFiles(1)}`);
    const handle = page.getByRole("separator", { name: "Đổi độ rộng khung chi tiết" });
    await expect(handle).toBeVisible();
    // Grip luôn hiện; vùng kéo 24px không bị thẻ cắt: điểm giữa khe và 10px trong khe/thẻ đều trúng thanh kéo
    await expect(handle.locator('[data-slot="resize-grip"]')).toBeVisible();
    const [listBox, paneBox] = await Promise.all([
      page.locator('[data-slot="document-list-card"]').boundingBox(),
      page.locator('[data-slot="document-quick-view-pane"]').boundingBox(),
    ]);
    const gapCenter = (listBox!.x + listBox!.width + paneBox!.x) / 2;
    const y = paneBox!.y + paneBox!.height / 2;
    for (const x of [gapCenter - 6, gapCenter, paneBox!.x + 8]) {
      const hit = await page.evaluate(([px, py]) => document.elementFromPoint(px, py)?.closest('[role="separator"]')?.getAttribute("aria-label") ?? null, [x, y]);
      expect(hit, `x=${x}`).toBe("Đổi độ rộng khung chi tiết");
    }
    const before = Number(await handle.getAttribute("aria-valuenow"));
    await handle.focus();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect(handle).toHaveAttribute("aria-valuenow", String(before + 40));
    await page.reload();
    await expect(page.getByRole("separator", { name: "Đổi độ rộng khung chi tiết" })).toHaveAttribute("aria-valuenow", String(before + 40));
    // kéo hết cỡ: danh sách vẫn ≥ 480px
    await page.getByRole("separator", { name: "Đổi độ rộng khung chi tiết" }).focus();
    for (let i = 0; i < 60; i++) await page.keyboard.press("ArrowLeft");
    const listWidth = await page.locator('[data-slot="document-list-card"]').evaluate((el) => el.getBoundingClientRect().width);
    expect(listWidth).toBeGreaterThanOrEqual(480);
    await page.keyboard.press("Home");
    await expect(page.getByRole("separator", { name: "Đổi độ rộng khung chi tiết" })).toHaveAttribute("aria-valuenow", "640");
  });

  test("↓/j trong danh sách khi pane mở: đổi văn bản, focus ở lại danh sách", async ({ page }) => {
    await page.goto("/documents");
    await row(page, docIdForFiles(5)).click();
    await expect(pane(page)).toBeVisible();
    await row(page, docIdForFiles(5)).focus();
    await page.keyboard.press("k");
    await expect.poll(() => search(page).get("docId")).not.toBe(docIdForFiles(5));
    await expect(page.locator(`[data-slot="document-ledger-table"] [data-doc-id]:focus`)).toHaveCount(1);
  });

  test("văn bản đi và tờ trình dùng cùng Quick View (thay hai drawer cũ)", async ({ page }) => {
    await page.goto(`/documents?docId=${DOC_OUTGOING_ID}`);
    await expect(pane(page).getByRole("heading", { name: "Văn bản đi E2E hai tệp" })).toBeVisible();
    // Quy trình xử lý nằm trong mục "Chi tiết và luân chuyển" thu gọn mặc định (SPEC §17.5C)
    await pane(page).getByRole("button", { name: "Chi tiết và luân chuyển", exact: true }).click();
    await expect(pane(page).getByText("Quy trình xử lý")).toBeVisible();
    await expect(pane(page).getByRole("link", { name: "Mở trang đầy đủ" })).toHaveAttribute("href", new RegExp(`/documents/outgoing/${DOC_OUTGOING_ID}`));
    await page.goto(`/documents?docId=${DOC_SUBMISSION_ID}`);
    await expect(pane(page).getByRole("heading", { name: "Tờ trình E2E ba tệp" })).toBeVisible();
    await pane(page).getByRole("button", { name: "Chi tiết và luân chuyển", exact: true }).click();
    await expect(pane(page).getByRole("region", { name: "Luân chuyển" })).toBeVisible();
    await expect(pane(page).getByRole("link", { name: "Mở trang đầy đủ" })).toHaveAttribute("href", new RegExp(`/documents/${DOC_SUBMISSION_ID}`));
  });

  test("mở xem không tick checkbox; chọn để thao tác hàng loạt không đổi văn bản đang xem (SPEC §17.4C)", async ({ page }) => {
    await page.goto("/documents");
    await row(page, docIdForFiles(5)).click();
    await expect(row(page, docIdForFiles(5))).toHaveAttribute("aria-current", "true");
    await expect(row(page, docIdForFiles(5))).toHaveAttribute("aria-selected", "false");
    await row(page, docIdForFiles(1)).getByRole("checkbox").click();
    await expect(row(page, docIdForFiles(1))).toHaveAttribute("aria-selected", "true");
    expect(search(page).get("docId")).toBe(docIdForFiles(5));
    await expect(row(page, docIdForFiles(5))).toHaveAttribute("aria-current", "true");
  });

  test("hàng desktop cao 40px, mở bằng Enter giữ focus ở hàng; → tới tiêu đề pane", async ({ page }) => {
    await page.goto("/documents");
    const target = row(page, docIdForFiles(5));
    expect((await target.boundingBox())!.height).toBe(40);
    // Mở pane: bảng xuống mức vừa, số ô hiện trong hàng phải bằng số cột tiêu đề (không lệch cột)
    await page.goto(`/documents?docId=${docIdForFiles(5)}`);
    const visibleCells = () => target.locator('[role="cell"]:visible').count();
    const header = page.locator('[data-slot="document-ledger-table"] [role="columnheader"]:visible');
    await expect.poll(visibleCells).toBe(await header.count());
    await page.goto("/documents");
    await target.focus();
    await page.keyboard.press("Enter");
    await expect(pane(page)).toBeVisible();
    await expect(target).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(pane(page).locator('[data-slot="document-quick-title"]')).toBeFocused();
  });

  test("header gọn: in phiếu nằm trong Thao tác khác; thuộc tính và luân chuyển trong mục Chi tiết và luân chuyển", async ({ page }) => {
    await page.goto(`/documents?docId=${docIdForFiles(5)}`);
    await expect(pane(page).getByRole("button", { name: "In phiếu văn bản" })).toHaveCount(0);
    await pane(page).getByRole("button", { name: "Thao tác khác" }).click();
    await expect(page.getByRole("menuitem", { name: "In phiếu văn bản" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menuitem", { name: "In phiếu văn bản" })).toHaveCount(0);
    await expect(pane(page)).toBeVisible();
    await expect(pane(page).getByRole("region", { name: "Luân chuyển" })).toHaveCount(0);
    await pane(page).getByRole("button", { name: "Chi tiết và luân chuyển", exact: true }).click();
    await expect(pane(page).getByRole("region", { name: "Luân chuyển" })).toBeVisible();
  });

  test("nút Mở trang đầy đủ giữ tệp đang xem", async ({ page }) => {
    await page.goto(`/documents?docId=${docIdForFiles(5)}&file=${docIdForFiles(5)}_att2`);
    await expect(pane(page).getByRole("link", { name: "Mở trang đầy đủ" })).toHaveAttribute(
      "href",
      `/documents/incoming/${docIdForFiles(5)}?file=${docIdForFiles(5)}_att2`,
    );
  });
});

test.describe("Quick View ở màn hình hẹp (overlay)", () => {
  test.use({ viewport: { width: 820, height: 900 } });

  test("workspace hẹp dùng overlay modal, đóng bằng Esc", async ({ page }) => {
    await page.goto("/documents");
    await row(page, docIdForFiles(1)).click();
    const overlay = page.locator('[data-slot="document-quick-view"][data-mode="overlay"]');
    await expect(overlay).toBeVisible();
    await expect(overlay).toHaveAttribute("role", "dialog");
    await expect(overlay).toHaveAttribute("aria-modal", "true");
    await page.keyboard.press("Escape");
    await expect(overlay).toHaveCount(0);
  });

  test("overlay: focus vào hộp thoại, Tab không ra nền, đóng trả focus về dòng (SPEC §17.7)", async ({ page }) => {
    await page.goto("/documents");
    await row(page, docIdForFiles(1)).click();
    const overlay = page.locator('[data-slot="document-quick-view"][data-mode="overlay"]');
    await expect(overlay.getByRole("button", { name: "Đóng" })).toBeFocused();
    await expect(page.locator('[data-slot="document-registry-view"] > div').first()).toHaveJSProperty("inert", true);
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      const active = await overlay.evaluate((el) => ({
        // <nextjs-portal> là thanh dev tools chỉ có khi chạy next dev, không thuộc ứng dụng
        inside: el.contains(document.activeElement) || document.activeElement === document.body || document.activeElement?.tagName === "NEXTJS-PORTAL",
        html: document.activeElement?.outerHTML.slice(0, 200),
      }));
      expect(active.inside, active.html).toBe(true);
    }
    // Esc đóng lớp trên cùng trước: tooltip của nút đang focus (nếu có), rồi mới tới overlay
    await page.keyboard.press("Escape");
    if (await overlay.count()) await page.keyboard.press("Escape");
    await expect(overlay).toHaveCount(0);
    await expect(row(page, docIdForFiles(1))).toBeFocused();
    await expect(page.locator('[data-slot="document-registry-view"] > div').first()).toHaveJSProperty("inert", false);
  });
});

test.describe("Rail ở cửa sổ thấp", () => {
  test.use({ viewport: { width: 1280, height: 420 } });

  test("rail thu gọn vẫn có Tệp N, tải về, toàn màn hình trong tầm nhìn (AC7)", async ({ page }) => {
    await page.goto(`/documents?docId=${docIdForFiles(5)}`);
    await expect(pane(page)).toBeVisible();
    const rail = pane(page).locator('[data-slot="document-viewer-rail"]');
    await pane(page).locator('[data-slot="document-quick-body"]').evaluate((el) => (el.scrollTop = el.scrollHeight));
    await expect(rail).toBeVisible();
    await expect(rail).toHaveAttribute("data-compact", "true");
    const body = await pane(page).locator('[data-slot="document-quick-body"]').boundingBox();
    // Cuộn tới viewer để rail bám đầu vùng cuộn, rồi mọi nút thiết yếu phải nằm trong vùng nhìn thấy
    await pane(page).locator('[data-slot="document-quick-body"]').evaluate((el) => (el.scrollTop = el.scrollHeight));
    for (const name of ["Tải về", "Xem toàn màn hình", "Tìm trong tệp"]) {
      const box = await rail.getByRole("button", { name }).boundingBox();
      expect(box!.y + box!.height, name).toBeLessThanOrEqual(body!.y + body!.height);
    }
    await expect(pane(page).getByRole("button", { name: "Tệp 5" })).toBeVisible();
  });
});

test.describe("Vị trí cuộn danh sách", () => {
  test.use({ viewport: { width: 1440, height: 420 } });

  test("quay lại từ Full Page giữ vị trí cuộn của danh sách", async ({ page }) => {
    await page.goto("/documents");
    const region = page.locator('[data-slot="document-list-region"]');
    await expect(row(page, docIdForFiles(1))).toBeAttached();
    // Hàng 32px nên danh sách ngắn hơn trước: cuộn xuống hết cỡ thay vì một giá trị cố định
    await region.evaluate((el) => (el.scrollTop = el.scrollHeight));
    await expect.poll(() => region.evaluate((el) => el.scrollTop)).toBeGreaterThan(40);
    const before = await region.evaluate((el) => el.scrollTop);
    await page.waitForTimeout(400);
    await page.goto(`/documents/incoming/${docIdForFiles(5)}`);
    await expect(page.locator('[data-slot="document-full-page"]')).toBeVisible();
    await page.goBack();
    await expect(row(page, docIdForFiles(1))).toBeAttached();
    await expect.poll(() => region.evaluate((el) => el.scrollTop)).toBe(before);
  });
});
