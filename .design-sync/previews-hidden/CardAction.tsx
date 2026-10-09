import React from 'react';
import { Card, CardHeader, CardTitle, CardAction, Badge } from 'qcet-eoffice';

export function Default() {
  return (
    <Card className="w-80 rounded-2xl bg-card p-4 border-0 shadow-subtle">
      <CardHeader className="p-0 flex items-center justify-between">
        <CardTitle className="text-sm font-semibold text-foreground">Tổng hợp báo cáo</CardTitle>
        <CardAction>
          <Badge variant="secondary">Chờ duyệt</Badge>
        </CardAction>
      </CardHeader>
    </Card>
  );
}
