"use client";

import * as React from "react";
import { Check, Minus, Shield, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PermissionItem {
  id: string;
  name: string;
  description?: string;
  // Quyền ứng với từng roleId: boolean | "view" | "edit" | "approve" | "full"
  roles: Record<string, boolean>;
}

export interface PermissionGroup {
  id: string;
  name: string;
  permissions: PermissionItem[];
}

export interface RoleColumn {
  id: string;
  name: string;
  description?: string;
}

export interface RolePermissionMatrixProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onToggle"> {
  roles: RoleColumn[];
  groups: PermissionGroup[];
  onToggle?: (permissionId: string, roleId: string) => void;
  readOnly?: boolean;
}

/**
 * Bảng ma trận phân quyền vai trò người dùng trong hệ thống quản lý trường học.
 */
export function RolePermissionMatrix({
  roles,
  groups,
  onToggle,
  readOnly = false,
  className,
  ...props
}: RolePermissionMatrixProps) {
  return (
    <div className={cn("w-full overflow-x-auto rounded-2xl border-0 bg-card shadow-none", className)} {...props}>
      <table className="w-full text-left text-xs border-collapse">
        {/* Header */}
        <thead>
          <tr className="bg-secondary">
            <th className="p-3.5 font-semibold text-foreground min-w-[240px]">
              Chức năng & Quyền hạn
            </th>
            {roles.map((role) => (
              <th key={role.id} className="p-3.5 font-semibold text-center text-foreground min-w-[110px]">
                <div>{role.name}</div>
                {role.description ? (
                  <div className="text-xs font-normal text-muted-foreground">{role.description}</div>
                ) : null}
              </th>
            ))}
          </tr>
        </thead>

        {/* Body */}
        <tbody className="divide-y divide-border">
          {groups.map((group) => (
            <React.Fragment key={group.id}>
              {/* Group Header */}
              <tr className="bg-secondary/50 font-semibold text-muted-foreground">
                <td colSpan={roles.length + 1} className="py-2 px-3.5 text-xs font-semibold">
                  {group.name}
                </td>
              </tr>

              {/* Rows */}
              {group.permissions.map((perm) => (
                <tr key={perm.id} className="hover:bg-accent transition-colors duration-100">
                  <td className="p-3">
                    <p className="font-medium text-foreground">{perm.name}</p>
                    {perm.description ? (
                      <p className="text-xs text-muted-foreground">{perm.description}</p>
                    ) : null}
                  </td>
                  {roles.map((role) => {
                    const hasPerm = Boolean(perm.roles[role.id]);

                    return (
                      <td key={role.id} className="p-3 text-center">
                        <button
                          type="button"
                          disabled={readOnly}
                          onClick={() => onToggle?.(perm.id, role.id)}
                          aria-label={`${perm.name} cho ${role.name}`}
                          className={cn(
                            "inline-flex size-6 items-center justify-center rounded-md border-0 transition-colors duration-100 outline-none focus-visible:outline-2 focus-visible:outline-primary",
                            hasPerm
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary text-muted-foreground",
                            readOnly ? "cursor-default" : "cursor-pointer hover:opacity-90"
                          )}
                        >
                          {hasPerm ? <Check className="size-3.5" /> : <Minus className="size-3.5" />}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
