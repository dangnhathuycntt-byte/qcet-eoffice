import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from 'qcet-eoffice';

export function Default() {
  return (
    <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-card border-0 shadow-menu max-w-sm text-xs">
      <div className="flex items-center gap-2.5 min-w-0">
        <CheckCircle2 className="size-4 text-foreground shrink-0" />
        <span className="text-foreground font-medium truncate">Đã đổi hạn sang 05/10</span>
      </div>
      <Button variant="ghost" size="sm" className="h-7 text-xs font-medium text-primary">
        Hoàn tác
      </Button>
    </div>
  );
}
