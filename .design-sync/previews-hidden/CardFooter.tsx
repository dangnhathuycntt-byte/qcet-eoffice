import React from 'react';
import { Card, CardFooter, Button } from 'qcet-eoffice';

export function Default() {
  return (
    <Card className="w-80 rounded-2xl bg-card p-4 border-0 shadow-subtle">
      <CardFooter className="p-0 flex items-center justify-end gap-2 pt-2">
        <Button variant="secondary" size="sm">Hủy</Button>
        <Button size="sm">Lưu thay đổi</Button>
      </CardFooter>
    </Card>
  );
}
