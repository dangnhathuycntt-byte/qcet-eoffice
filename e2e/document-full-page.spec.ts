import { expect, test, type Page } from "@playwright/test";
import { DOC_OUTGOING_ID, DOC_SUBMISSION_ID, docIdForFiles } from "./fixtures";

const viewer = (page: Page) => page.locator('[data-slot="document-full-page-viewer"]');
const panel = (page: Page) => page.locator("#document-info-panel");

test.describe("Full Page (PDF-first)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("văn bản đến: trình xem chiếm phần chính, panel thông tin mặc định đóng, mở bằng nút Thông tin", async ({ page }) => {
    await page.goto(`/documents/incoming/${docIdForFiles(5)}`);
    await expect(page.getByRole("heading", { level: 1, name: "Văn bản E2E 5 tệp" })).toBeVisible();
    await expect(viewer(page).locator('[data-slot="document-viewer-rail"]')).toBeVisible();
    await expect(viewer(page).locator('[data-slot="pdf-canvas"] [data-rendered="true"]').first()).toBeVisible();
    await expect(panel(page)).toBeHidden();
    const viewerBox = await viewer(page).boundingBox();
    expect(viewerBox!.width).toBeGreaterThan(900);

    await page.getByRole("button", { name: "Thông tin", exact: true }).click();
    await expect(panel(page)).toBeVisible();
    await expect(panel(page).getByText("Thuộc tính")).toBeVisible();
    // nhớ lựa chọn sau khi tải lại
    await page.reload();
    await expect(panel(page)).toBeVisible();
    await page.getByRole("button", { name: "Thông tin", exact: true }).click();
    await expect(panel(page)).toBeHidden();
  });

  test("?file= chọn tệp ban đầu; đổi tệp ghi lại URL bằng replace và giữ qua làm mới", async ({ page }) => {
    await page.goto(`/documents/incoming/${docIdForFiles(5)}?file=${docIdForFiles(5)}_att4`);
    await expect(viewer(page).locator('[data-slot="active-file-name"]')).toHaveText("tep-4.pdf");
    const historyBefore = await page.evaluate(() => history.length);
    await viewer(page).getByRole("button", { name: "Xem tệp tep-2.pdf" }).click();
    await expect(viewer(page).locator('[data-slot="active-file-name"]')).toHaveText("tep-2.pdf");
    await expect(page).toHaveURL(new RegExp(`file=${docIdForFiles(5)}_att2$`));
    expect(await page.evaluate(() => history.length)).toBe(historyBefore);
    await page.reload();
    await expect(viewer(page).locator('[data-slot="active-file-name"]')).toHaveText("tep-2.pdf");
  });

  test("nhớ zoom từng tệp qua làm mới (sessionStorage)", async ({ page }) => {
    await page.goto(`/documents/incoming/${docIdForFiles(5)}`);
    await expect(viewer(page).locator('[data-slot="pdf-canvas"] [data-rendered="true"]').first()).toBeVisible();
    await page.getByRole("button", { name: "Phóng to" }).click();
    await expect(page.getByLabel("Thu phóng 115%")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Thu phóng 115%")).toBeVisible();
  });

  test("văn bản đi dùng cùng bộ khung, có panel quy trình", async ({ page }) => {
    await page.goto(`/documents/outgoing/${DOC_OUTGOING_ID}`);
    await expect(page.getByRole("heading", { level: 1, name: "Văn bản đi E2E hai tệp" })).toBeVisible();
    await expect(viewer(page).locator('[data-slot="document-viewer-rail"]')).toBeVisible();
    await page.getByRole("button", { name: "Thông tin", exact: true }).click();
    await expect(panel(page).getByText("Quy trình xử lý")).toBeVisible();
  });

  test("/documents/[id] chuyển văn bản đến/đi về trang riêng và giữ ?file=", async ({ page }) => {
    await page.goto(`/documents/${docIdForFiles(5)}?file=${docIdForFiles(5)}_att3`);
    await expect(page).toHaveURL(new RegExp(`/documents/incoming/${docIdForFiles(5)}\\?file=${docIdForFiles(5)}_att3$`));
    await page.goto(`/documents/${DOC_OUTGOING_ID}`);
    await expect(page).toHaveURL(new RegExp(`/documents/outgoing/${DOC_OUTGOING_ID}$`));
  });

  test("tờ trình có Full Page tại /documents/[id]", async ({ page }) => {
    await page.goto(`/documents/${DOC_SUBMISSION_ID}`);
    await expect(page).toHaveURL(new RegExp(`/documents/${DOC_SUBMISSION_ID}$`));
    await expect(page.getByRole("heading", { level: 1, name: "Tờ trình E2E ba tệp" })).toBeVisible();
    await expect(viewer(page).getByRole("button", { name: "Tệp 3" })).toBeVisible();
  });

  test("văn bản không tồn tại trả 404", async ({ page }) => {
    // Trang có loading.tsx nên phản hồi đã stream trước khi notFound(): kiểm nội dung 404 của Next thay vì mã trạng thái
    await page.goto("/documents/khong-ton-tai");
    await expect(page.getByText("This page could not be found.")).toBeVisible();
    await expect(page.locator('[data-slot="document-full-page"]')).toHaveCount(0);
  });

  test("Back từ Full Page về danh sách mở lại Quick View đúng văn bản và tệp", async ({ page }) => {
    await page.goto(`/documents?docId=${docIdForFiles(5)}&file=${docIdForFiles(5)}_att2`);
    const pane = page.locator('[data-slot="document-quick-view"][data-mode="pane"]');
    await expect(pane).toBeVisible();
    await pane.getByRole("link", { name: "Mở trang đầy đủ" }).click();
    await expect(page).toHaveURL(new RegExp(`/documents/incoming/${docIdForFiles(5)}\\?file=${docIdForFiles(5)}_att2$`));
    await page.goBack();
    await expect(page.locator('[data-slot="document-quick-view"][data-mode="pane"]')).toBeVisible();
    await expect(page.locator('[data-slot="document-quick-view"] [data-slot="active-file-name"]')).toHaveText("tep-2.pdf");
  });
});

test.describe("Full Page trên màn hình hẹp", () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test("xếp dọc: tiêu đề, trình xem, rồi thông tin; không cuộn ngang", async ({ page }) => {
    await page.goto(`/documents/incoming/${docIdForFiles(1)}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator('[data-slot="pdf-canvas"] [data-rendered="true"]').first()).toBeVisible();
    await expect(panel(page)).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
