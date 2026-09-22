"use client";

import * as React from "react";
import { QCET_ORG_UNITS } from "@/lib/org/org-structure";
import { useDepartmentList } from "@/hooks/use-department-list";
import {
  buildDepartmentNodes,
  type DepartmentNode,
} from "@/components/org/organization-tree";

/**
 * Shared hook that merges QCET_ORG_UNITS (static config) with API personnel
 * data to produce `DepartmentNode[]`. This is the single-source replacement
 * for the old `QCET_DEPARTMENTS` constant.
 *
 * Consumers that previously imported QCET_DEPARTMENTS should use this hook
 * instead.
 */
export function useOrgDepartments(): {
  departments: DepartmentNode[];
  isLoading: boolean;
} {
  const { departments: apiDepts, isLoading } = useDepartmentList({
    includePersonnel: true,
  });

  const departments = React.useMemo(
    () => buildDepartmentNodes(QCET_ORG_UNITS, apiDepts),
    [apiDepts],
  );

  return { departments, isLoading };
}
