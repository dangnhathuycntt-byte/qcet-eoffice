"use client";

import * as React from "react";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Button } from "@/components/ui/button";

interface ConfirmRequest {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

type Listener = (request: ConfirmRequest & { resolve: (ok: boolean) => void }) => void;

let listener: Listener | null = null;

/**
 * Hỏi xác nhận không thuộc luồng React (hook, handler dùng chung). Trả `true` khi người dùng đồng ý.
 * Cần `ConfirmHost` được gắn ở layout; chưa gắn (hoặc chạy ngoài trình duyệt) thì trả `true` để không chặn luồng.
 */
export function confirmAction(request: ConfirmRequest): Promise<boolean> {
  if (!listener) return Promise.resolve(true);
  return new Promise((resolve) => listener?.({ ...request, resolve }));
}

export function ConfirmHost() {
  const [current, setCurrent] = React.useState<(ConfirmRequest & { resolve: (ok: boolean) => void }) | null>(null);

  React.useEffect(() => {
    listener = (request) => setCurrent((prev) => {
      prev?.resolve(false);
      return request;
    });
    return () => {
      listener = null;
    };
  }, []);

  const settle = (ok: boolean) => {
    current?.resolve(ok);
    setCurrent(null);
  };

  return (
    <AlertDialog.Root open={current !== null} onOpenChange={(open) => { if (!open) settle(false); }}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-40 bg-overlay transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none" />
        <AlertDialog.Popup className="fixed inset-0 z-40 flex items-center justify-center p-4 outline-none motion-reduce:transition-none">
          <div className="bg-card rounded-2xl shadow-dialog border-0 max-w-md w-full p-4 sm:p-6 flex flex-col gap-4">
            <div className="flex flex-col gap-1 min-w-0">
              <AlertDialog.Title className="text-sm font-semibold text-foreground">{current?.title}</AlertDialog.Title>
              {current?.description ? (
                <AlertDialog.Description className="text-xs text-muted-foreground leading-relaxed">{current.description}</AlertDialog.Description>
              ) : null}
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => settle(false)}>{current?.cancelLabel ?? "Hủy"}</Button>
              <Button type="button" onClick={() => settle(true)}>{current?.confirmLabel ?? "Đồng ý"}</Button>
            </div>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
