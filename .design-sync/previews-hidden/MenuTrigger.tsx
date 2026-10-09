import React from 'react';
import { Check } from 'lucide-react';

export function Default() {
  return (
    <div className="w-56 p-1.5 rounded-xl bg-popover border-0 shadow-dropdown space-y-1 text-xs">
      <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
        Tùy chọn (MenuTrigger)
      </div>
      <div className="px-2.5 py-1.5 rounded-lg bg-accent text-accent-foreground font-medium flex items-center justify-between">
        <span>Mục đang chọn</span>
        <Check className="size-3.5 text-primary" />
      </div>
      <div className="px-2.5 py-1.5 rounded-lg text-foreground hover:bg-muted cursor-pointer">
        <span>Mục thông thường</span>
      </div>
    </div>
  );
}
