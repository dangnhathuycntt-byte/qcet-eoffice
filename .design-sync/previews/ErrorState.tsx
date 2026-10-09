import React from "react";
import { ErrorState, Button } from "qcet-eoffice";

export function KhongTimThay() {
  return <div style={{ width: 460 }}><ErrorState kind="not-found" action={<Button size="sm">Về tổng quan</Button>} /></div>;
}

export function MatKetNoi() {
  return <div style={{ width: 460 }}><ErrorState kind="offline" action={<Button size="sm" variant="secondary">Thử lại</Button>} /></div>;
}

export function HetPhien() {
  return <div style={{ width: 460 }}><ErrorState kind="session-expired" action={<Button size="sm">Đăng nhập lại</Button>} /></div>;
}
