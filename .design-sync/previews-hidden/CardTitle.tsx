import React from 'react';
import { Card, CardHeader, CardTitle } from 'qcet-eoffice';

export function Default() {
  return (
    <Card className="w-80 rounded-2xl bg-card p-4 border-0 shadow-subtle">
      <CardHeader className="p-0">
        <CardTitle className="text-base font-semibold text-foreground">Tiêu đề nhiệm vụ chính</CardTitle>
      </CardHeader>
    </Card>
  );
}
