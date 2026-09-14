---
paths:
  - "docs/**/*"
  - "*.md"
---
# Documentation Invariants

1. **Search Before Creating**: Always search existing docs and plans before creating new markdown files to prevent fragmentation.
2. **Document Roles**: `ARCHITECTURE.md` describes current reality; ADRs record durable decisions; Plans specify future work.
3. **Plan Lifecycle**: Plans live in `docs/plans/active/` during work. When finished or replaced, delete them — git history is the archive. Do not accumulate completed or superseded plan files in the repo.
4. **Single Active Plan**: Maintain at most one master active plan per domain (e.g., UX, Security, Data Integrity, Agent Architecture).
5. **Explicit Supersession**: When replacing an active plan, delete the old file and note the replacement in the new plan's frontmatter (`supersedes:`).
