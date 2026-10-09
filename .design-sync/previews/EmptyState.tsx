import React from "react";
import { EmptyState, Button } from "qcet-eoffice";
import { ClipboardList, SearchX } from "lucide-react";

export function NoTasks() {
  return (
    <div style={{ width: 420 }}>
      <EmptyState
        icon={<ClipboardList />}
        title="Chưa có nhiệm vụ nào"
        description="Nhiệm vụ được giao cho bạn sẽ xuất hiện ở đây."
        action={<Button size="sm">Tạo nhiệm vụ</Button>}
      />
    </div>
  );
}

export function NoResults() {
  return (
    <div style={{ width: 420 }}>
      <EmptyState
        icon={<SearchX />}
        title="Không tìm thấy kết quả"
        description="Thử bỏ bớt bộ lọc hoặc đổi từ khóa tìm kiếm."
        action={<Button size="sm" variant="secondary">Xóa bộ lọc</Button>}
      />
    </div>
  );
}
