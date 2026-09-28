"use client";

import * as React from "react";
import * as m from "motion/react-m";
import { AnimatePresence } from "motion/react";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fadeVariants } from "@/lib/motion/variants";
import { motionTransition } from "@/lib/motion/tokens";

export interface ApprovalOverlayProps {
  open: boolean;
  onClose: () => void;
  onApprove: (comment?: string) => void;
  onReject: (reason: string) => void;
  title?: string;
  requireRejectReason?: boolean;
  loading?: boolean;
}

export function ApprovalOverlay({
  open,
  onClose,
  onApprove,
  onReject,
  title = "Phê duyệt",
  requireRejectReason = true,
  loading = false,
}: ApprovalOverlayProps) {
  const [mode, setMode] = React.useState<"idle" | "approve" | "reject">("idle");
  const [comment, setComment] = React.useState("");
  const [reason, setReason] = React.useState("");

  React.useEffect(() => {
    if (!open) {
      setMode("idle");
      setComment("");
      setReason("");
    }
  }, [open]);

  function handleApprove() {
    onApprove(comment.trim() || undefined);
  }

  function handleReject() {
    if (requireRejectReason && !reason.trim()) return;
    onReject(reason.trim());
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

                {mode === "idle" && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMode("approve")}
                      disabled={loading}
                      className="flex-1 px-3 py-2 min-h-[44px] sm:min-h-0 sm:py-2 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors active:scale-[0.98] disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      Phê duyệt
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode("reject")}
                      disabled={loading}
                      className="flex-1 px-3 py-2 min-h-[44px] sm:min-h-0 sm:py-2 rounded-lg text-xs font-medium bg-red-500/10 text-red-700 hover:bg-red-500/20 border border-red-500/20 transition-colors active:scale-[0.98] disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      Từ chối
                    </button>
                  </div>
                )}

                {mode === "approve" && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">
                        Ý kiến (không bắt buộc)
                      </label>
                      <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Nhập ý kiến phê duyệt…"
                        rows={3}
                        className="w-full rounded-lg border border-border/60 bg-muted/10 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border resize-none"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setMode("idle")}
                        className="px-3 py-2 min-h-[44px] sm:min-h-0 sm:py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-border/60 transition-colors active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        Quay lại
                      </button>
                      <button
                        type="button"
                        onClick={handleApprove}
                        disabled={loading}
                        className="px-3 py-2 min-h-[44px] sm:min-h-0 sm:py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors active:scale-[0.98] disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        {loading ? "Đang xử lý…" : "Xác nhận duyệt"}
                      </button>
                    </div>
                  </div>
                )}

                {mode === "reject" && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">
                        Lý do từ chối {requireRejectReason && <span className="text-red-500">*</span>}
                      </label>
                      <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Nhập lý do từ chối…"
                        rows={3}
                        className="w-full rounded-lg border border-border/60 bg-muted/10 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border resize-none"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setMode("idle")}
                        className="px-3 py-2 min-h-[44px] sm:min-h-0 sm:py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-border/60 transition-colors active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        Quay lại
                      </button>
                      <button
                        type="button"
                        onClick={handleReject}
                        disabled={loading || (requireRejectReason && !reason.trim())}
                        className="px-3 py-2 min-h-[44px] sm:min-h-0 sm:py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-700 hover:bg-red-500/20 border border-red-500/20 transition-colors active:scale-[0.98] disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        {loading ? "Đang xử lý…" : "Xác nhận từ chối"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </Dialog.Popup>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
