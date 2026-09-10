---
paths:
  - "docs/**/*"
  - "*.md"
---
# Documentation Invariants

1. **Search Before Creating**: Always search existing docs and plans before creating new markdown files to prevent fragmentation.
2. **Document Roles**: `ARCHITECTURE.md` describes current reality; ADRs record durable decisions; Plans specify future work.
3. **Plan Lifecycle**: Plans live in `docs/plans/active/` during work, move to `completed/` upon finish, or `superseded/` when replaced.
4. **Single Active Plan**: Maintain at most one master active plan per domain (e.g., UX, Security, Data Integrity, Agent Architecture).
5. **Explicit Supersession**: When replacing a document, explicitly record frontmatter metadata (`superseded_by:` or `supersedes:`).
