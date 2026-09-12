# QCET E-Office — Dashboard & Workspace Consolidation Master Plan

## 1. Mục tiêu cuối
Sau refactor, `/` phải có đúng mental model: Situation -> Action -> Context.

## 2. Kiến trúc đích
Server Components -> UserContextService -> viewScopes -> LiveDashboardData + ActionInboxService -> DashboardOverview -> AdaptiveMetricStrip + ActionInboxQueue + DepartmentAttentionSummary.

## 3. Invariants & Acceptance
- DASH-01: Exactly one macro metric strip.
- DASH-02: Exactly one personal/institutional action inbox.
- DASH-03: Role never substitutes active scope (Role Is Not Scope).
- DASH-04: No duplicated metric as secondary card.
- DASH-05: Zero denominator never presented as failed 0% progress.
- DASH-06: Empty data != healthy state.
- DASH-07: Dashboard context list max 5 items.
- DASH-08: Full analytical controls belong to drill-down surfaces.
- DASH-09: Server truth determines available scopes/actions.
