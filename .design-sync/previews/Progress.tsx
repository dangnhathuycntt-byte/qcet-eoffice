import React from "react";
import { Progress, ProgressLabel, ProgressValue } from "qcet-eoffice";

export function Default() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "400px" }}>
      <Progress value={65}>
        <ProgressLabel>Tiến độ nhiệm vụ</ProgressLabel>
        <ProgressValue />
      </Progress>
      <Progress value={100}>
        <ProgressLabel>Hoàn tất phê duyệt</ProgressLabel>
        <ProgressValue />
      </Progress>
      <Progress value={25}>
        <ProgressLabel>Soạn thảo dự thảo</ProgressLabel>
        <ProgressValue />
      </Progress>
    </div>
  );
}
