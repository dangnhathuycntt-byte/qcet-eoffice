import React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "qcet-eoffice";

export function Standard() {
  return (
    <Tabs defaultValue="tasks" style={{ maxWidth: "480px" }}>
      <TabsList>
        <TabsTrigger value="tasks">Nhiệm vụ (12)</TabsTrigger>
        <TabsTrigger value="docs">Văn bản (5)</TabsTrigger>
        <TabsTrigger value="history">Lịch sử xử lý</TabsTrigger>
      </TabsList>
      <TabsContent value="tasks" style={{ padding: "16px 0", fontSize: "14px" }}>
        Danh sách các nhiệm vụ đang được phân công trong tuần này.
      </TabsContent>
      <TabsContent value="docs" style={{ padding: "16px 0", fontSize: "14px" }}>
        Các văn bản đến và đi đang chờ ký số.
      </TabsContent>
      <TabsContent value="history" style={{ padding: "16px 0", fontSize: "14px" }}>
        Nhật ký luân chuyển hồ sơ điện tử.
      </TabsContent>
    </Tabs>
  );
}

export function LineVariant() {
  return (
    <Tabs defaultValue="all" style={{ maxWidth: "480px" }}>
      <TabsList variant="line">
        <TabsTrigger value="all">Tất cả</TabsTrigger>
        <TabsTrigger value="pending">Chờ xử lý</TabsTrigger>
        <TabsTrigger value="completed">Đã hoàn thành</TabsTrigger>
      </TabsList>
      <TabsContent value="all" style={{ padding: "16px 0", fontSize: "14px" }}>
        Hiển thị toàn bộ dữ liệu.
      </TabsContent>
    </Tabs>
  );
}
