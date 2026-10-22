"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Archive, Building2 } from "lucide-react";
import type { OfficialDocument } from "@qcet/contracts/types/document";
import { getDocumentHref } from "@qcet/shared/lib/documents/document-view-model";
import { isAssistantEligibleDocument } from "@qcet/shared/domain/assistant/assistant-document-eligibility";
import { TaskIconCopy, TaskIconLink, TaskIconView } from "@qcet/shared/lib/icons/task-icons";
import { AgentIcon } from "@/components/icons/agent-icon";
import { askAssistantInDock } from "@/components/assistant/assistant-model";
import { MenuActionItem, MenuContent, MenuRoot, MenuSeparator } from "@/components/ui/menu";
import { useFeedback } from "@/components/ui/feedback-layer";
import { useAuth } from "@/lib/auth-context";
import { useRuntimeFeature } from "@/lib/runtime-features";
import { canBulkAssignLeadUnit, type BulkActionType } from "./document-bulk-toolbar";

/** Điểm chuột phải, hoặc phần tử (nút "⋯", dòng đang có tiêu điểm khi mở bằng phím Menu/Shift+F10). */
export type DocumentMenuAnchor = { x: number; y: number } | HTMLElement;

export interface DocumentRowMenuProps {
  doc: OfficialDocument | null;
  anchor: DocumentMenuAnchor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpen: (doc: OfficialDocument) => void;
  /** Giao đơn vị / Lưu hồ sơ cho riêng văn bản này: cùng hộp thoại của thanh thao tác hàng loạt. */
  onAction: (type: BulkActionType, doc: OfficialDocument) => void;
}

const icon = "size-4 text-muted-foreground";

/**
 * Menu thao tác một văn bản trên sổ (chuột phải, "⋯", phím Menu/Shift+F10), cùng kiểu menu chuột phải của bảng Nhiệm vụ.
 * Giao đơn vị chỉ có ở văn bản đến cho người có quyền bút phê (cùng nguồn quyền với thanh hàng loạt); máy chủ vẫn kiểm
 * quyền và trạng thái từng văn bản. "Hỏi Trợ lý" chỉ khi Trợ lý được đọc văn bản (độ mật Thường, không ghi chú hạn chế).
 */
export function DocumentRowMenu({ doc, anchor, open, onOpenChange, onOpen, onAction }: DocumentRowMenuProps) {
  const router = useRouter();
  const feedback = useFeedback();
  const { user } = useAuth();
  const assistantOn = useRuntimeFeature("assistant", open);
  const canAssignUnit = canBulkAssignLeadUnit((user as { dbRole?: string } | null)?.dbRole);

  const positionAnchor = React.useMemo(() => {
    if (!anchor || anchor instanceof HTMLElement) return anchor ?? undefined;
    return { getBoundingClientRect: () => new DOMRect(anchor.x, anchor.y, 0, 0) };
  }, [anchor]);

  if (!doc) return null;

  const copy = async (text: string, done: string) => {
    try {
      await navigator.clipboard.writeText(text);
      feedback.notifySuccess(done);
    } catch {
      feedback.notifyError("Không sao chép được");
    }
  };

  const askAssistant = () => {
    if (!askAssistantInDock({ type: "document", id: doc.id })) {
      router.push(`/assistant?context=${encodeURIComponent(`document:${doc.id}`)}`);
    }
  };

  const title = doc.summary || doc.documentNumber || "Văn bản";
  const showAssign = doc.type === "inbox" && canAssignUnit;

  return (
    <MenuRoot open={open} onOpenChange={onOpenChange}>
      <MenuContent anchor={positionAnchor} mobileSheet sheetTitle={title} aria-label={`Thao tác văn bản ${title}`} positionerClassName="z-50" className="w-56">
        <MenuActionItem leading={<TaskIconView className={icon} />} shortcut="Enter" onClick={() => onOpen(doc)}>
          Xem nhanh
        </MenuActionItem>
        {showAssign ? (
          <MenuActionItem leading={<Building2 className={icon} />} onClick={() => onAction("assign-unit", doc)}>
            Giao đơn vị chủ trì…
          </MenuActionItem>
        ) : null}
        <MenuActionItem leading={<Archive className={icon} />} onClick={() => onAction("file", doc)}>
          Lưu hồ sơ…
        </MenuActionItem>
        <MenuSeparator />
        <MenuActionItem
          leading={<TaskIconLink className={icon} />}
          onClick={() => void copy(`${window.location.origin}${getDocumentHref(doc.id)}`, "Đã sao chép liên kết")}
        >
          Sao chép liên kết
        </MenuActionItem>
        {doc.documentNumber ? (
          <MenuActionItem leading={<TaskIconCopy className={icon} />} onClick={() => void copy(doc.documentNumber, "Đã sao chép số, ký hiệu")}>
            Sao chép số, ký hiệu
          </MenuActionItem>
        ) : null}
        {assistantOn && isAssistantEligibleDocument(doc) ? (
          <MenuActionItem leading={<AgentIcon className={icon} />} onClick={askAssistant}>
            Hỏi Trợ lý
          </MenuActionItem>
        ) : null}
      </MenuContent>
    </MenuRoot>
  );
}
