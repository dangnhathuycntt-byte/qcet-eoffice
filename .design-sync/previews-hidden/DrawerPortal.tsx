import React from 'react';
import { Button } from 'qcet-eoffice';
import { X } from 'lucide-react';

export function Default() {
  return (
    <div className="w-80 rounded-2xl bg-card p-4 border-0 shadow-dropdown space-y-3">
      <div className="flex items-center justify-between border-b pb-2.5 border-border/40">
        <h3 className="text-sm font-semibold text-foreground">Ngăn kéo (DrawerPortal)</h3>
        <span className="p-1 text-muted-foreground"><X className="size-4" /></span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Nội dung panel chi tiết trượt từ bên phải.
      </p>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" size="sm">Đóng</Button>
      </div>
    </div>
  );
}
