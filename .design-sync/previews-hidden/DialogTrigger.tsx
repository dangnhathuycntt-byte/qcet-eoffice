import React from 'react';
import { Dialog, DialogRoot, DialogTrigger, DialogPortal, DialogBackdrop, DialogPopup, DialogTitle, DialogDescription, DialogClose, Button } from 'qcet-eoffice';
import { X } from 'lucide-react';

export function Default() {
  return (
    <div className="w-96 rounded-2xl bg-card p-6 border-0 shadow-dialog space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground">Hộp thoại (DialogTrigger)</h3>
        <span className="p-1 text-muted-foreground"><X className="size-4" /></span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Mô tả chi tiết trong hộp thoại dialog component.
      </p>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" size="sm">Hủy</Button>
        <Button size="sm">Xác nhận</Button>
      </div>
    </div>
  );
}
