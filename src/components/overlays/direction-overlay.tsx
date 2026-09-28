"use client";

import * as React from "react";
import * as m from "motion/react-m";
import { AnimatePresence } from "motion/react";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { fadeVariants } from "@/lib/motion/variants";
import { motionTransition } from "@/lib/motion/tokens";

export interface DirectionOverlayProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { instruction: string; deadline?: string }) => void;
  title?: string;
  loading?: boolean;
}

export function DirectionOverlay({
  open,
  onClose,
  onSubmit,
  title = "Bút phê chỉ đạo",
  loading = false,
}: DirectionOverlayProps) {
  const [instruction, setInstruction] = React.useState("");
  const [deadline, setDeadline] = React.useState("");

  React.useEffect(() => {
    if (!open) {
      setInstruction("");
      setDeadline("");
    }
  }, [open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!instruction.trim()) return;
    onSubmit({
      instruction: instruction.trim(),
      deadline: deadline || undefined,
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal>
            <Dialog.Backdrop
              className="fixed inset-0 z-50 bg-black/40"
              render={
                <m.div
                  variants={fadeVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={motionTransition}
                />
              }
            />
            <Dialog.Popup
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              render={
                <m.div
                  variants={fadeVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={motionTransition}
                />
              }
            >
              <div className="w-full max-w-md rounded-xl border border-border/70 bg-card p-5 shadow-[var(--shadow-dropdown,0_4px_16px_rgba(0,0,0,0.08))]">
                <div className="flex items-start justify-between mb-4">
                  <Dialog.Title className="text-sm font-semibold text-foreground">
                    {title}
                  </Dialog.Title>
                  <Dialog.Close
                    className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    onClick={onClose}
                  >
                    <X className="size-4" strokeWidth={1.5} />
                  </Dialog.Close>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Nội dung bút phê <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={instruction}
                      onChange={(e) => setInstruction(e.target.value)}
                      placeholder="Nhập nội dung chỉ đạo…"
                      rows={4}
                      className="w-full rounded-lg border border-border/60 bg-muted/10 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border resize-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Hạn xử lý
                    </label>
                    <input
                      type="date"
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      className="w-full rounded-lg border border-border/60 bg-muted/10 px-3 py-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={loading}
                      className="px-3 py-2 min-h-[44px] sm:min-h-0 sm:py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-border/60 transition-colors active:scale-[0.98] disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={loading || !instruction.trim()}
                      className="px-3 py-2 min-h-[44px] sm:min-h-0 sm:py-1.5 rounded-lg text-xs font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors active:scale-[0.98] disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      {loading ? "Đang xử lý…" : "Gửi bút phê"}
                    </button>
                  </div>
                </form>
              </div>
            </Dialog.Popup>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
