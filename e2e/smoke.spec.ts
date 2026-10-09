import { expect, test } from "@playwright/test";
import { docIdForFiles } from "./fixtures";

test("đăng nhập bằng phiên E2E và thấy danh sách văn bản", async ({ page }) => {
  await page.goto("/documents");
  await expect(page.getByText("Văn bản E2E 5 tệp").first()).toBeVisible();
});

test("tệp PDF của văn bản được phục vụ cho người có quyền", async ({ request }) => {
  const res = await request.get(`/api/files/documents/e2e/${docIdForFiles(1)}-1-tep-1.pdf`);
  expect(res.status()).toBe(200);
});
