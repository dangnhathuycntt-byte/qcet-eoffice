"use client";

import * as React from "react";
import { ChevronRight, Folder, FolderOpen, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { focusRingClass } from "@/components/ui/focus-ring";

export interface TreeNode {
  id: string;
  label: string;
  icon?: React.ReactNode;
  count?: number;
  children?: TreeNode[];
  disabled?: boolean;
}

export interface DirectoryTreeProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onSelect"> {
  nodes: TreeNode[];
  selectedId?: string;
  defaultExpandedIds?: string[];
  onSelect?: (node: TreeNode) => void;
  onExpandChange?: (expandedIds: string[]) => void;
}

interface TreeItemProps {
  node: TreeNode;
  level: number;
  selectedId?: string;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelect?: (node: TreeNode) => void;
}

function TreeItem({
  node,
  level,
  selectedId,
  expandedIds,
  onToggle,
  onSelect,
}: TreeItemProps) {
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;
  const hasChildren = Boolean(node.children && node.children.length > 0);

  const handleClick = () => {
    if (hasChildren) {
      onToggle(node.id);
    }
    onSelect?.(node);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      if (hasChildren && !isExpanded) {
        e.preventDefault();
        onToggle(node.id);
      }
    } else if (e.key === "ArrowLeft") {
      if (hasChildren && isExpanded) {
        e.preventDefault();
        onToggle(node.id);
      }
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div role="treeitem" aria-expanded={hasChildren ? isExpanded : undefined} aria-selected={isSelected}>
      <div
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        style={{ paddingLeft: `${8 + level * 20}px` }}
        className={cn(
          `group flex h-8 items-center gap-1.5 rounded-lg pr-2 text-xs sm:text-sm font-medium select-none transition-colors duration-100 cursor-pointer outline-none ${focusRingClass} motion-reduce:transition-none`,
          isSelected
            ? "bg-selected text-foreground font-semibold"
            : "text-foreground hover:bg-accent",
          node.disabled && "pointer-events-none opacity-50"
        )}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.id);
            }}
            className="flex size-4 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
            aria-label={isExpanded ? "Gập" : "Mở"}
          >
            <ChevronRight
              className={cn(
                "size-3.5 transition-transform duration-150",
                isExpanded && "rotate-90"
              )}
            />
          </button>
        ) : (
          <span className="size-4 shrink-0" />
        )}

        {node.icon ? (
          node.icon
        ) : hasChildren ? (
          isExpanded ? (
            <FolderOpen className="size-4 text-muted-foreground shrink-0" />
          ) : (
            <Folder className="size-4 text-muted-foreground shrink-0" />
          )
        ) : (
          <FileText className="size-4 text-muted-foreground shrink-0" />
        )}

        <span className="truncate flex-1">{node.label}</span>

        {node.count !== undefined && (
          <span className="ml-auto text-xs font-normal tabular-nums text-muted-foreground">
            {node.count}
          </span>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div role="group" className="flex flex-col gap-0.5">
          {node.children!.map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              level={level + 1}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Cây thư mục · Hồ sơ, Cơ cấu đơn vị trường học.
 * Chuẩn QCET: Artboard System (← → mở/gập · ↑ ↓ di chuyển · thụt 20px mỗi cấp).
 */
export function DirectoryTree({
  nodes,
  selectedId,
  defaultExpandedIds = [],
  onSelect,
  onExpandChange,
  className,
  ...props
}: DirectoryTreeProps) {
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(
    () => new Set(defaultExpandedIds)
  );

  const handleToggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      onExpandChange?.(Array.from(next));
      return next;
    });
  };

  return (
    <div
      role="tree"
      className={cn("flex flex-col gap-0.5 w-full select-none", className)}
      {...props}
    >
      {nodes.map((node) => (
        <TreeItem
          key={node.id}
          node={node}
          level={0}
          selectedId={selectedId}
          expandedIds={expandedIds}
          onToggle={handleToggle}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
