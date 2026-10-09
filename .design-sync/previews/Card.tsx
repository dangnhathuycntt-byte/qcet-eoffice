import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Button } from "qcet-eoffice";

export function Standard() {
  return (
    <Card style={{ maxWidth: "420px" }}>
      <CardHeader>
        <CardTitle>Báo cáo công tác tuần</CardTitle>
        <CardDescription>Cập nhật lần cuối: 15:30 hôm nay</CardDescription>
      </CardHeader>
      <CardContent>
        <p style={{ color: "var(--color-text-secondary)", fontSize: "14px", lineHeight: "1.5" }}>
          Đã hoàn thành 12/15 nhiệm vụ trọng tâm theo kế hoạch công tác tháng 9/2026.
        </p>
      </CardContent>
      <CardFooter style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
        <Button variant="secondary" size="sm">Chi tiết</Button>
        <Button size="sm">Xem báo cáo</Button>
      </CardFooter>
    </Card>
  );
}

export function Small() {
  return (
    <Card size="sm" style={{ maxWidth: "340px" }}>
      <CardHeader>
        <CardTitle>Chỉ số tuần</CardTitle>
        <CardDescription>Tiến độ phòng ban</CardDescription>
      </CardHeader>
      <CardContent>
        <div style={{ fontSize: "24px", fontWeight: "600", color: "var(--color-primary)" }}>94.2%</div>
      </CardContent>
    </Card>
  );
}
