import React from 'react';
import { Card, CardContent } from 'qcet-eoffice';

export function Default() {
  return (
    <Card className="w-80 rounded-2xl bg-card p-4 border-0 shadow-subtle">
      <CardContent className="p-0 text-xs text-foreground leading-relaxed">
        Phần thân chứa nội dung chi tiết, bảng hoặc trường nhập liệu.
      </CardContent>
    </Card>
  );
}
