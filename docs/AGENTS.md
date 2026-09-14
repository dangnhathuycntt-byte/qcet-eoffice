# Documentation Invariants

- **Search Before Adding**: Search existing docs before adding new ones to prevent knowledge fragmentation.

- **Single Active Plan**: Maintain at most one master active plan per domain in `docs/plans/active/`.

- **Delete Finished Plans**: When a plan is complete or superseded, delete it. Git history is the archive — do not accumulate `completed/` or `superseded/` directories.

- **Durable Decisions in ADRs**: Record structural and architectural choices in Architecture Decision Records.
