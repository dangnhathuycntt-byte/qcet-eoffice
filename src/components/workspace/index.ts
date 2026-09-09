export { UnifiedAdaptiveWorkspace } from "./unified-adaptive-workspace";
export {
  ExecutiveAttentionHub,
  DepartmentAttentionHub,
  StaffAttentionHub,
} from "./components/attention-hubs";
export type {
  AttentionHubBaseProps,
  ExecutiveAttentionHubProps,
  DepartmentAttentionHubProps,
  StaffAttentionHubProps,
} from "./components/attention-hubs";
export { AdaptiveScopeHeader } from "./components/adaptive-scope-header";
export { AdaptiveMetricStrip } from "./components/adaptive-metric-strip";
export { UniversalActionQueue } from "./components/universal-action-queue";
export {
  useAdaptiveWorkspaceData,
  deriveAdaptiveWorkspaceData,
} from "./hooks/use-adaptive-workspace-data";
export type {
  WorkspaceScope,
  AdaptiveWorkspaceMetrics,
  UniversalActionQueueItems,
  UnifiedAdaptiveWorkspaceProps,
} from "./types";
