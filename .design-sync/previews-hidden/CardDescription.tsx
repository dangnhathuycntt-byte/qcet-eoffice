import React from 'react';
import { Card, CardHeader, CardDescription } from 'qcet-eoffice';

export function Default() {
  return (
    <Card className="w-80 rounded-2xl bg-card p-4 border-0 shadow-subtle">
      <CardHeader className="p-0">
        <CardDescription className="text-xs text-muted-foreground leading-relaxed">
          Mô tả phụ giải thích ngữ cảnh của thẻ này cho người dùng.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
