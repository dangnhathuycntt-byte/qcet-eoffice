import React from "react";
import { Pagination } from "qcet-eoffice";

export function Default() {
  return (
    <div style={{ padding: 20 }}>
      <Pagination page={1} pageCount={5} onPageChange={() => {}} />
    </div>
  );
}

export function Truncated() {
  return (
    <div style={{ padding: 20 }}>
      <Pagination page={8} pageCount={24} onPageChange={() => {}} aria-label="Phân trang danh sách nhiệm vụ" />
    </div>
  );
}
