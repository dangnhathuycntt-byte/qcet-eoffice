# API Route Invariants

- **Mandatory Authentication**: Authenticate all protected API routes using server session tokens.

- **Server-Side Authorization**: Enforce RBAC permissions strictly on the server; never trust client-claimed roles or headers.

- **Payload Validation**: Validate all incoming mutation payloads and query parameters before execution.

- **No Production Bypasses**: Never allow demo modes, mock bypasses, or guest escalation in production environments.

- **Canonical Error Format**: Return standardized JSON error payloads with consistent HTTP status codes and error schemas.
