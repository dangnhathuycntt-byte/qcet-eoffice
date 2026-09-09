---
paths:
  - "src/app/api/auth/**/*"
  - "src/components/auth/**/*"
  - "src/lib/auth*"
  - "src/context/**/*"
---
# Auth & Security Invariants

1. **Server Session Truth**: The server session is the sole authority for authentication. Cached state in localStorage or cookies is purely UI cache.
2. **Role Isolation**: Strictly enforce user role boundaries. Role grants authority; dataset scope governs visible operational boundaries.
3. **Separation of Duties**: Workflow actions must enforce role segregation (e.g., task creator cannot act as sole approver for completion).
4. **Secret & Token Protection**: Never expose session tokens, password hashes, webhook secrets, or private keys to the client.
5. **No Insecure Bypasses**: Never add convenience auth shortcuts, hardcoded tokens, or permissive bypasses in authentication handlers.
