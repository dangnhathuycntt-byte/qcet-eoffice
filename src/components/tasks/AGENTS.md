# Task Component Invariants

- **Canonical Workspace & Table**: Use `UnifiedAdaptiveWorkspace` and `ModularCascadingTaskTable` exclusively; never create duplicate workspaces or parallel tables.

- **Role Is Not Scope**: Disentangle authority from dataset view. Scope (`school`, `unit`, `personal`) filters records; user role controls permissions.

- **Preserve Hierarchy**: Maintain parent/subtask semantics and cascading relationships during filtering, grouping, and mutations.

- **Single Toolbar**: Reuse the canonical task toolbar; never introduce duplicate filter controls or search boxes.

- **State Synchronization**: Filter state, badge counters, table views, and URL query parameters must stay in exact agreement.
