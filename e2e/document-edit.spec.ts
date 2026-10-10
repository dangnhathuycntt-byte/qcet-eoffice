import { expect, test, type Page } from "@playwright/test";
import { DOC_EDIT_ID } from "./fixtures";
import { buildPdf } from "./support/pdf";

const pane = (page: Page) => page.locator('[data-slot="document-quick-view"][data-mode="pane"]');

test.describe("Sửa thông tin và bổ sung tệp (văn bản có quyền sửa)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("sửa trích yếu và cơ quan ban hành: Quick View và danh sách cập nhật", async ({ page }) => {
    await page.goto(`/documents?docId=${DOC_EDIT_ID}`);
    await expect(pane(page).getByRole("heading", { name: "Văn bản E2E để sửa" })).toBeVisible();

    // Sửa thông tin nằm trong menu "Thao tác khác" của header, không còn là nút ở thân Quick View
    await expect(pane(page).getByRole("button", { name: "Sửa thông tin" })).toHaveCount(0);
    await pane(page).getByRole("button", { name: "Thao tác khác" }).click();
    await page.getByRole("menuitem", { name: "Sửa thông tin" }).click();
    const dialog = page.getByRole("dialog", { name: "Sửa thông tin văn bản" });
    await dialog.getByLabel("Trích yếu").fill("Văn bản E2E đã sửa");
    await dialog.getByLabel("Cơ quan ban hành").fill("Sở E2E");
    await dialog.getByRole("button", { name: "Lưu" }).click();

    await expect(dialog).toHaveCount(0);
    await expect(pane(page).getByRole("heading", { name: "Văn bản E2E đã sửa" })).toBeVisible();
    await expect(pane(page).getByText("Sở E2E")).toBeVisible();
    await expect(page.locator(`[data-slot="document-ledger-table"] [data-doc-id="${DOC_EDIT_ID}"]`)).toContainText("Văn bản E2E đã sửa");
  });

  test("thêm tệp từ trạng thái chưa có tệp: tệp hiện trong Quick View", async ({ page }) => {
    await page.goto(`/documents?docId=${DOC_EDIT_ID}`);
    await expect(pane(page).getByText("Chưa có tệp đính kèm")).toBeVisible();

    const chooser = page.waitForEvent("filechooser");
    await pane(page).getByRole("button", { name: "Thêm tệp" }).last().click();
    await (await chooser).setFiles({ name: "bo-sung.pdf", mimeType: "application/pdf", buffer: buildPdf([{ text: "Bổ sung" }]) });

    await expect(pane(page).getByText("bo-sung.pdf").first()).toBeVisible();
    await expect(pane(page).getByText("Chưa có tệp đính kèm")).toHaveCount(0);
  });

  test("API bổ sung tệp từ chối tệp không thuộc người dùng", async ({ page }) => {
    await page.goto("/documents");
    const status = await page.evaluate(async (id) => {
      const res = await fetch(`/api/documents/${id}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: "khong-ton-tai" }),
      });
      return res.status;
    }, DOC_EDIT_ID);
    expect(status).toBe(404);
  });
});
