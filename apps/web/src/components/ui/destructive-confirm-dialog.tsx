"use client";

import * as React from "react";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface DestructiveConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  /** Nhãn loại đối tượng đứng trước `entityName`, vd "Nhiệm vụ". */
  entityLabel?: string;
  entityName?: string;
  description?: string;
  /** Nội dung phụ dưới mô tả, vd danh sách các mục sắp xóa. */
  children?: React.ReactNode;
  confirmLabel?: string;
  irreversible?: boolean;
  isConfirming?: boolean;
}

export function DestructiveConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  entityLabel = "Nhiệm vụ",
  entityName,
  description,
  children,
  confirmLabel = "Xóa",
  irreversible = true,
  isConfirming = false,
}: DestructiveConfirmDialogProps) {
  const handleConfirm = async () => { await onConfirm(); };
  // Mô tả viết tiếp câu sau tên ("sẽ được lưu trữ…") thì nối bằng dấu cách; mô tả là câu mới (chữ hoa) hay không có mô tả thì
  // chấm câu sau tên, tránh "Bản ghi “x” Âm thanh… sẽ mất"
  const continuesSentence = description ? /^\p{Ll}/u.test(description) : false;
  // Focus ban đầu vào khung (không phải nút): Enter không vô tình xác nhận xóa, cũng không hiện viền focus dày trên nút Hủy.
  const panelRef = React.useRef<HTMLDivElement>(null);

  return (
    <AlertDialog.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop
          className="fixed inset-0 z-40 bg-overlay transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none"
        />
        <AlertDialog.Popup
          initialFocus={panelRef}
          className="fixed inset-0 z-40 flex items-center justify-center p-4 outline-none motion-reduce:transition-none"
        >
          {/* Gọn kiểu Linear: không icon, câu "không thể hoàn tác" là chữ phụ cùng đoạn; chỉ nút xác nhận mang màu đỏ */}
          <div ref={panelRef} tabIndex={-1} className="bg-card rounded-xl shadow-dialog border-0 max-w-sm w-full p-4 flex flex-col gap-4 outline-none">
            <div className="flex flex-col gap-1 min-w-0">
              <AlertDialog.Title className="text-sm font-semibold text-foreground">
                {title}
              </AlertDialog.Title>
              <AlertDialog.Description className="text-compact text-muted-foreground leading-relaxed">
                {entityName && (
                  <>{entityLabel}{" "}<span className="font-medium text-foreground">&ldquo;{entityName}&rdquo;</span>{continuesSentence ? " " : ". "}</>
                )}
                {description}
                {irreversible && <>{description ? " " : ""}Không thể hoàn tác.</>}
              </AlertDialog.Description>
              {children}
            </div>

            <div className="flex items-center justify-end gap-2">
              <AlertDialog.Close
                render={<Button variant="ghost" size="sm" />}
                disabled={isConfirming}
              >
                Hủy
              </AlertDialog.Close>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleConfirm}
                disabled={isConfirming}
                className={cn(isConfirming && "opacity-70")}
              >
                {isConfirming ? "Đang xử lý..." : confirmLabel}
              </Button>
            </div>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
