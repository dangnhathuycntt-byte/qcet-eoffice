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
    await pane(page).getByRole("button", { name: "Xem tệp tep-3.pdf" }).click();
    await expect.poll(() => search(page).get("file")).toBe(`${docIdForFiles(5)}_att3`);
    await page.reload();
    await expect(pane(page).locator('[data-slot="active-file-name"]')).toHaveText("tep-3.pdf");
  });

  test("danh sách tệp: mở khi ≤ 5 tệp, thu gọn khi nhiều hơn, nhớ lựa chọn", async ({ page }) => {
    await page.goto(`/documents?docId=${docIdForFiles(5)}`);
    const list = pane(page).locator('[data-slot="attached-files"]');
    await expect(list.getByRole("button", { name: /tep-2\.pdf/ })).toBeVisible();
    await page.goto(`/documents?docId=${docIdForFiles(12)}`);
    await expect(pane(page).locator('[data-slot="attached-files"]')).toBeVisible();
    await expect(pane(page).locator('[data-slot="attached-files"]').getByRole("button", { name: /tep-2\.pdf/ })).toHaveCount(0);
    await pane(page).locator('[data-slot="attached-files"]').getByRole("button", { name: /Tệp đính kèm/ }).click();
    await expect(pane(page).locator('[data-slot="attached-files"]').getByRole("button", { name: /tep-2\.pdf/ })).toBeVisible();
    await page.goto(`/documents?docId=${docIdForFiles(5)}`);
    await expect(pane(page).locator('[data-slot="attached-files"]').getByRole("button", { name: /tep-2\.pdf/ })).toBeVisible();
  });

  test("độ rộng pane đổi bằng bàn phím, nhớ sau khi làm mới, danh sách không dưới 480px", async ({ page }) => {
    await page.goto(`/documents?docId=${docIdForFiles(1)}`);
    const handle = page.getByRole("separator", { name: "Đổi độ rộng khung chi tiết" });
    await expect(handle).toBeVisible();
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
    const listWidth = await page.locator('[data-slot="document-list-region"]').evaluate((el) => el.getBoundingClientRect().width);
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
    await expect(pane(page).getByText("Quy trình xử lý")).toBeVisible();
    await expect(pane(page).getByRole("link", { name: "Mở trang đầy đủ" })).toHaveAttribute("href", new RegExp(`/documents/outgoing/${DOC_OUTGOING_ID}`));
    await page.goto(`/documents?docId=${DOC_SUBMISSION_ID}`);
    await expect(pane(page).getByRole("heading", { name: "Tờ trình E2E ba tệp" })).toBeVisible();
    await expect(pane(page).getByText("Luân chuyển và lịch sử")).toBeVisible();
    await expect(pane(page).getByRole("link", { name: "Mở trang đầy đủ" })).toHaveAttribute("href", new RegExp(`/documents/${DOC_SUBMISSION_ID}`));
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
});

test.describe("Vị trí cuộn danh sách", () => {
  test.use({ viewport: { width: 1440, height: 420 } });

  test("quay lại từ Full Page giữ vị trí cuộn của danh sách", async ({ page }) => {
    await page.goto("/documents");
    const region = page.locator('[data-slot="document-list-region"]');
    await expect(row(page, docIdForFiles(1))).toBeAttached();
    await region.evaluate((el) => (el.scrollTop = 200));
    await expect.poll(() => region.evaluate((el) => el.scrollTop)).toBeGreaterThan(100);
    const before = await region.evaluate((el) => el.scrollTop);
    await page.waitForTimeout(400);
    await page.goto(`/documents/incoming/${docIdForFiles(5)}`);
    await expect(page.locator('[data-slot="document-full-page"]')).toBeVisible();
    await page.goBack();
    await expect(row(page, docIdForFiles(1))).toBeAttached();
    await expect.poll(() => region.evaluate((el) => el.scrollTop)).toBe(before);
  });
});
