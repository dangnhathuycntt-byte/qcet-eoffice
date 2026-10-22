/**
 * Provider bọc cả app không được đổi giá trị context ngay sau hydrate: React 19.2 hiện khung trang stream từ server theo đợt
 * (~300ms, mốc "$~"), context đổi trong lúc đó làm React bỏ HTML server và vẽ lại cả trang ở client (đo 22/10/2026 ở chi tiết
 * nhiệm vụ: 0/8 lần hydrate đúng trước khi sửa, 8/8 sau). Các test giữ những chỗ đã sửa: phiên có sẵn từ server, mật độ đọc
 * qua store ngoài React, bộ tính năng motion nạp đồng bộ.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AuthProvider, useAuth } from "../src/lib/auth-context";
import { useDisplayDensity } from "../src/components/density-provider";

function AuthProbe() {
  const { authState, isLoading, user, canMutate } = useAuth();
  return React.createElement("span", null, [authState.status, String(isLoading), user?.id ?? "-", String(canMutate)].join("|"));
}

test("AuthProvider có người dùng từ server: lần vẽ đầu đã đăng nhập, không chờ /api/auth/me", () => {
  const html = renderToStaticMarkup(
    React.createElement(AuthProvider, {
      initialUser: { id: "u1", name: "Cán bộ A", email: "a@example.test", role: "STAFF" },
      children: React.createElement(AuthProbe),
    })
  );
  assert.equal(html, "<span>authenticated|false|u1|true</span>");
});

test("AuthProvider không có phiên từ server: giữ trạng thái đang tải để client tự đọc phiên (bản lưu ngoại tuyến)", () => {
  for (const initialUser of [undefined, null]) {
    const html = renderToStaticMarkup(React.createElement(AuthProvider, { initialUser, children: React.createElement(AuthProbe) }));
    assert.equal(html, "<span>loading|true|-|false</span>");
  }
});

test("mật độ hiển thị: server và lần hydrate dùng mặc định, không lấy từ state của provider", () => {
  function DensityProbe() {
    return React.createElement("span", null, useDisplayDensity().density);
  }
  assert.equal(renderToStaticMarkup(React.createElement(DensityProbe)), "<span>comfortable</span>");
});

test("LazyMotion nạp bộ tính năng đồng bộ: tải lười dựng context mới sau hydrate", () => {
  const src = readFileSync(path.join(import.meta.dirname, "../src/components/motion/motion-provider.tsx"), "utf8");
  assert.match(src, /<LazyMotion features=\{domAnimation\}/);
  assert.doesNotMatch(src, /import\(\s*["'`]/, "features={() => import(...)} đổi giá trị LazyContext lúc tải xong, vẽ lại khung trang đang chờ hiện");
});
