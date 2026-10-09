import React from 'react';
import { ChevronDown } from 'lucide-react';

export function Default() {
  return (
    <div className="w-80 rounded-xl bg-card p-3 border-0 shadow-subtle space-y-2 text-xs">
      <div className="flex items-center justify-between font-semibold text-foreground cursor-pointer">
        <span>Nhóm mở rộng (CollapsibleRoot)</span>
        <ChevronDown className="size-4 text-muted-foreground" />
      </div>
      <div className="p-2.5 rounded-lg bg-secondary text-muted-foreground">
        Nội dung bên trong phần mở gập.
      </div>
    </div>
  );
}
