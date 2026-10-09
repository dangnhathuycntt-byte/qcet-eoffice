import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from 'qcet-eoffice';

export function Default() {
  return (
    <Card className="w-80 rounded-2xl bg-card p-4 border-0 shadow-subtle">
      <CardHeader className="p-0 space-y-1">
        <CardTitle className="text-sm font-semibold text-foreground">Tiêu đề phần đầu</CardTitle>
        <CardDescription className="text-xs text-muted-foreground">Mô tả chi tiết trong CardHeader</CardDescription>
      </CardHeader>
    </Card>
  );
}
