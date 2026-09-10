---
paths:
  - "src/app/api/**/*"
  - "src/lib/server/**/*"
---
# Backend API Invariants

1. **Authentication Required**: Authenticate all protected API routes using server session checks before executing business logic.
2. **Server-Side Authorization**: Enforce RBAC on the server. Never trust role, department, or permissions sent in client requests.
3. **Payload Validation**: Validate and sanitize all mutation payloads (POST, PUT, PATCH) before database persistence.
4. **Canonical Error Shape**: API error responses must adhere strictly to `{ error: string, code?: string }` with proper HTTP status codes.
5. **No Production Guest Bypass**: Never permit guest, demo, or unauthenticated developer mock fallbacks in production endpoints.
6. **Information Leak Prevention**: Never expose database internals, stack traces, raw error dumps, or secrets in API responses.
