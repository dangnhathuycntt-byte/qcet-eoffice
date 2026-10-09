import { expect, test, type Page } from "@playwright/test";

async function openDocument(page: Page, summary: string) {
  await page.goto("/documents");
  await page.getByText(summary).first().click();
  await expect(page.locator('[data-slot="document-file-viewer-root"]')).toBeVisible();
}

const renderedPages = (page: Page) => page.locator('[data-slot="pdf-canvas"] [data-rendered="true"]');

test.describe("Trình xem PDF nhiều tệp", () => {
  // Rail dọc cao ~330px: cần khung đủ cao để mọi nút nằm trong tầm nhìn khi mới mở
  test.use({ viewport: { width: 1280, height: 1000 } });

  test("PDF 60 trang chỉ dựng cửa sổ trang quanh khung nhìn", async ({ page }) => {
    await openDocument(page, "Văn bản E2E một tệp 60 trang");
    await expect(page.locator('[data-slot="pdf-canvas"][data-page-count="60"]')).toBeVisible();
    await expect(renderedPages(page).first()).toBeVisible();
    expect(await page.locator('[data-slot="pdf-canvas"] [data-rendered]').count()).toBe(60);
    expect(await renderedPages(page).count()).toBeLessThanOrEqual(8);
    expect(await page.locator('[data-slot="pdf-canvas"] canvas').count()).toBeLessThanOrEqual(8);
  });

  test("nhảy trang qua rail và hiện trang hiện tại", async ({ page }) => {
    await openDocument(page, "Văn bản E2E một tệp 60 trang");
    await expect(page.locator('[data-slot="pdf-canvas"][data-page-count="60"]')).toBeVisible();
    await page.getByRole("button", { name: /^Trang 1 trên 60/ }).click();
    await page.getByRole("textbox", { name: "Số trang" }).fill("40");
    await page.getByRole("button", { name: "Đi", exact: true }).click();
    await expect(page.locator('[data-slot="pdf-canvas"] [data-rendered="true"][data-page-number="40"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /^Trang 40 trên 60/ })).toBeVisible();
    expect(await renderedPages(page).count()).toBeLessThanOrEqual(8);
  });

  test("12 tệp: nút Tệp 12, chọn tệp đổi nội dung và tên tệp, không có vạch", async ({ page }) => {
    await openDocument(page, "Văn bản E2E 12 tệp");
    await expect(page.getByRole("button", { name: "Tệp 12" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Xem tệp / })).toHaveCount(0);
    await expect(page.locator('[data-slot="active-file-name"]')).toHaveText("tep-1.pdf");
    await page.getByRole("button", { name: "Tệp 12" }).click();
    await page.getByRole("option", { name: /tep-7\.pdf/ }).click();
    await expect(page.locator('[data-slot="active-file-name"]')).toHaveText("tep-7.pdf");
    await expect(page.locator('[data-slot="document-file-viewer-root"]')).toHaveAttribute("data-active-file-id", /_att7$/);
  });

  test("5 tệp: vạch từng tệp; đổi tệp rồi quay lại khôi phục zoom", async ({ page }) => {
    await openDocument(page, "Văn bản E2E 5 tệp");
    await expect(page.getByRole("button", { name: /^Xem tệp / })).toHaveCount(5);
    await page.getByRole("button", { name: "Phóng to" }).click();
    await expect(page.getByLabel("Thu phóng 115%")).toBeVisible();
    await page.getByRole("button", { name: "Xem tệp tep-3.pdf" }).click();
    await expect(page.getByLabel("Thu phóng 100%")).toBeVisible();
    await page.getByRole("button", { name: "Xem tệp tep-1.pdf" }).click();
    await expect(page.getByLabel("Thu phóng 115%")).toBeVisible();
  });

  test("tìm kiếm trong tệp chạy trên toàn bộ trang, kể cả trang chưa dựng", async ({ page }) => {
    await openDocument(page, "Văn bản E2E một tệp 60 trang");
    await expect(page.locator('[data-slot="pdf-canvas"][data-page-count="60"]')).toBeVisible();
    await page.getByRole("button", { name: "Tìm trong tệp" }).click();
    await page.getByLabel("Từ khóa cần tìm").fill("Trang 55");
    await expect(page.getByText("1/1")).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-slot="pdf-canvas"] [data-rendered="true"][data-page-number="55"]')).toBeVisible();
  });

  test("tệp PDF hỏng hiện lỗi có Thử lại và Tải về, không làm sập trang", async ({ page }) => {
    await openDocument(page, "Văn bản E2E tệp đa dạng khổ giấy");
    await page.getByRole("button", { name: /^Tệp 6/ }).click();
    await page.getByRole("option", { name: /hong\.pdf/ }).click();
    await expect(page.locator('[data-slot="pdf-canvas"] [role="alert"]')).toContainText(/PDF|hiển thị/);
    await expect(page.getByRole("button", { name: "Thử lại" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Tải về" })).toBeVisible();
  });

  test("các khổ giấy khác nhau có placeholder đúng tỉ lệ", async ({ page }) => {
    await openDocument(page, "Văn bản E2E tệp đa dạng khổ giấy");
    await page.getByRole("button", { name: /^Tệp 6/ }).click();
    await page.getByRole("option", { name: /kho-la\.pdf/ }).click();
    const box = page.locator('[data-slot="pdf-canvas"] [data-rendered][data-page-number="1"]');
    await expect(box).toBeVisible();
    const size = await box.boundingBox();
    expect(size).not.toBeNull();
    expect(size!.height / size!.width).toBeGreaterThan(3.5);
  });
});

test.describe("Toàn màn hình (Fullscreen API)", () => {
  test.use({ viewport: { width: 1280, height: 1000 } });

  test("phóng to đúng phần tử trình xem, giữ tệp/zoom/trang và thoát được", async ({ page }) => {
    await openDocument(page, "Văn bản E2E 5 tệp");
    await expect(page.locator('[data-slot="pdf-canvas"][data-page-count]')).toBeVisible();
    await page.getByRole("button", { name: "Phóng to" }).click();
    await page.getByRole("button", { name: "Xem toàn màn hình" }).click();
    await expect.poll(() => page.evaluate(() => document.fullscreenElement?.getAttribute("data-slot") ?? null)).toBe("document-file-viewer");
    // Không remount: vẫn cùng tệp và mức thu phóng
    await expect(page.locator('[data-slot="active-file-name"]')).toHaveText("tep-1.pdf");
    await expect(page.getByLabel("Thu phóng 115%")).toBeVisible();
    await page.getByRole("button", { name: "Thoát toàn màn hình" }).click();
    await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
    await expect(page.getByLabel("Thu phóng 115%")).toBeVisible();
  });
});
