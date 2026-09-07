import type { SchoolBottleneckItem } from "./workspace";

export type ExecutiveResolutionType =
  | "EXTEND_DEADLINE"
  | "REASSIGN"
  | "DEMAND_EXPLANATION"
  | "DIRECT_DIRECTIVE";

export interface ExecutiveResolutionPayload {
  taskId: string;
  type: ExecutiveResolutionType;
  extensionDays?: 3 | 7;
  newAssigneeName?: string;
  directiveNote?: string;
}

export interface ExecutiveResolutionResult {
  updatedBottlenecks: SchoolBottleneckItem[];
  resolvedItem: SchoolBottleneckItem | undefined;
  actionSummary: string;
}
