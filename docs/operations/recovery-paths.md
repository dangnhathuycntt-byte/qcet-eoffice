# QCET E-Office — Recovery Paths: Signature & Delivery Failures

**Document Status**: Canonical Operational Reference  
**Scope**: Recovery procedures for digital signature and document delivery failures  
**Authority**: Quản trị mạng / Ban Giám hiệu, Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn  
**Created**: 2026-09-28  
**Related**: [Rollback & Recovery Strategy](rollback.md)

---

## 1. Overview

The outgoing document workflow (văn bản đi) has two critical external integration points that can fail:

1. **Digital Signature** — Personal signature (ký chức danh lãnh đạo) and organization seal (đóng dấu số cơ quan) via a digital certificate provider (e.g., Ban Cơ yếu Chính phủ, VNPT-CA).
2. **Delivery Gateway** — Distribution of issued documents to recipients via email, LGSP (Liên thông Giấy tờ Số), or physical dispatch tracking.

Both are provider-neutral in the current codebase: the provider has not been selected (RFC-04/RFC-05 pending), so recovery paths focus on the **application-level invariants** and the **operator actions** that are independent of provider choice.

---

## 2. Outgoing Document Workflow States

```
DRAFT → CONTENT_REVIEW → FORMAT_CHECK → AUTHORIZED_SIGN → NUMBERED →
ORGANIZATION_SIGNED → ISSUED → DELIVERED → FILED
```

Signature failures affect: `AUTHORIZED_SIGN → NUMBERED` and `NUMBERED → ORGANIZATION_SIGNED`.  
Delivery failures affect: `ISSUED → DELIVERED`.

---

## 3. Signature Failure Recovery

### 3.1 Failure Modes

| Failure | Symptoms | Root Cause |
| :--- | :--- | :--- |
| **Provider unreachable** | HTTP timeout / connection refused to CA service | Network partition, CA maintenance window, DNS failure |
| **Certificate expired** | 401/403 from CA API; `certificateMetadata.status: "EXPIRED"` | Organization or personal certificate past validity period |
| **Certificate revoked** | CA returns revocation status | Key compromise, personnel change |
| **HSM failure** | Internal server error from signing hardware | Hardware Security Module unavailable |
| **Invalid document hash** | Signature verification fails post-signing | Document modified between hash generation and signing |
| **Rate limit / quota** | 429 from CA provider | Exceeded daily signing quota |

### 3.2 Application Invariants

The system enforces these invariants regardless of provider:

1. **Atomic transaction**: `SignatureRecord` creation and `DocumentOutgoingWorkflow.status` update occur in a single Prisma `$transaction`. If the signature provider call fails *before* the transaction, the document remains at its prior state — no partial state is persisted.
2. **Separation of Duties**: Format reviewer ≠ authorized signer; authorized signer ≠ organization signer. These checks are enforced in the service layer and cannot be bypassed by retry.
3. **Idempotency guard**: `authorizedSignedAt` prevents double-signing. A retry that reaches the service layer after a successful sign will receive `InvalidTransitionError`.
4. **Audit trail**: Every successful signature creates an `AuditEvent` and an outbox event (`DOCUMENT_ORGANIZATION_SIGNED`), both within the same transaction.

### 3.3 Operator Recovery Procedures

#### Scenario A: Provider Temporarily Unavailable

**Symptoms**: API call to signing provider times out or returns 5xx.

**Recovery**:
1. The document remains at `AUTHORIZED_SIGN` (personal) or `NUMBERED` (organization). No data corruption.
2. Wait for provider recovery. Monitor provider status page or internal health dashboard.
3. Retry the signing action from the UI. The same user (or another authorized signer) can call the endpoint again.
4. **Correlation ID**: Use the `x-request-id` response header from the failed request to trace the exact failure in application logs.

```bash
# Find the failed request in structured logs
grep '"requestId":"<correlation-id>"' /var/log/qcet/app.log
```

#### Scenario B: Certificate Expired or Revoked

**Symptoms**: Provider returns certificate-status error.

**Recovery**:
1. Document remains at its current workflow state. No partial signature.
2. Contact the certificate authority to renew or re-issue the certificate.
3. Update the `certificateMetadata` in the provider adapter configuration (environment variable or secrets manager — never in source code).
4. Retry the signing action after certificate renewal.

#### Scenario C: Document Tampered Between Submissions

**Symptoms**: Post-signing hash verification fails.

**Recovery**:
1. The signing transaction did NOT commit (hash check is pre-commit).
2. Investigate whether a concurrent revision was created between the format check and signing steps.
3. If the document was legitimately revised: the correct flow is to create a new revision (`CreateDocumentRevisionSchema`), re-submit through content review and format check, then sign the new version.
4. If tampering is suspected: escalate to system administrator. The `AuditEvent` trail shows who accessed the document and when.

#### Scenario D: Rate Limit Exceeded

**Symptoms**: Provider returns 429.

**Recovery**:
1. Document remains at its current state.
2. Wait for the rate-limit window to reset (check provider documentation for reset interval).
3. Retry the signing action.
4. If systematic: review signing volume and consider requesting a quota increase from the provider.

---

## 4. Delivery Gateway Failure Recovery

### 4.1 Failure Modes

| Failure | Symptoms | Root Cause |
| :--- | :--- | :--- |
| **Email gateway down** | SMTP connection refused / timeout | Mail server outage, network partition |
| **LGSP unavailable** | LGSP API returns 5xx or timeout | Government interoperability platform maintenance |
| **Invalid recipient** | Bounce / rejection from recipient mail server | Incorrect email address, full mailbox |
| **Attachment too large** | 413 from gateway | Document file exceeds gateway size limit |
| **TLS handshake failure** | Certificate mismatch on SMTP/LGSP endpoint | Expired TLS certificate on remote end |

### 4.2 Application Invariants

1. **Delivery is a status transition, not a send**: The `ISSUED → DELIVERED` transition marks that the document was dispatched. The actual delivery mechanism is external. If the external gateway fails, the transition does NOT occur.
2. **Transaction boundary**: The `deliverDocument()` service updates workflow status, document status, and creates an audit event in a single `$transaction`. Gateway failure before this transaction leaves the document at `ISSUED`.
3. **Manual delivery fallback**: The `deliveryNotes` field in `DeliverOutgoingDocumentSchema` allows operators to record physical delivery (bưu điện, giao trực tiếp) even when electronic delivery fails.
4. **State machine guard**: `OutgoingDocumentStateMachine.assertTransition()` ensures only documents in `ISSUED` (or `ORGANIZATION_SIGNED` for direct delivery) can transition to `DELIVERED`.

### 4.3 Operator Recovery Procedures

#### Scenario A: Electronic Delivery Gateway Down

**Symptoms**: Gateway returns 5xx or connection timeout.

**Recovery**:
1. Document remains at `ISSUED`. Recipients have NOT received the document.
2. **Immediate**: Use alternative delivery channel:
   - If email failed → try LGSP (or vice versa).
   - If all electronic channels failed → print and dispatch physically.
3. Record the delivery method in `deliveryNotes` when marking as DELIVERED.
4. Monitor gateway status and retry electronic delivery for archival/confirmation purposes.

```bash
# Check delivery-related errors in recent logs
grep '"action":"OUTGOING_DOCUMENT_DELIVERED"' /var/log/qcet/app.log | tail -20
grep '"error"' /var/log/qcet/app.log | grep -i 'deliver\|smtp\|lgsp' | tail -20
```

#### Scenario B: Partial Delivery (Some Recipients Received, Some Failed)

**Symptoms**: Gateway reports mixed success/failure for multi-recipient delivery.

**Recovery**:
1. Record successful deliveries in `deliveryNotes`.
2. Re-send to failed recipients using an alternative channel.
3. Mark as `DELIVERED` only after all recipients have been reached (or operator decides partial delivery is acceptable with documented justification).
4. For compliance: the `recipientList` on the document record shows the intended recipients; `deliveryNotes` documents actual delivery outcomes.

#### Scenario C: Document Attachment Too Large

**Symptoms**: Gateway returns 413 or equivalent size-limit error.

**Recovery**:
1. Check the gateway's size limit (typically 10–25 MB for email, varies for LGSP).
2. If the document file exceeds the limit:
   - Compress the PDF if possible.
   - Split attachments if the document has multiple files.
   - Use a download link instead of inline attachment (if the gateway supports it).
3. Do NOT modify the original document — create a delivery-optimized copy.
4. Retry delivery with the optimized payload.

---

## 5. Observability & Tracing

### 5.1 Correlation ID Chain

Every request through the middleware receives an `x-request-id` header (extracted from inbound `x-request-id` / `x-correlation-id` / `x-trace-id`, or generated as UUID). This ID:

- Is forwarded to route handlers via request headers.
- Is echoed in the response `x-request-id` header.
- Is logged by `StructuredLogger.getRequestId()` in every log entry.
- Appears in `AuditEvent.requestId` for post-incident forensics.

### 5.2 Key Log Queries for Signature/Delivery Incidents

```bash
# All events for a specific document
grep '"entityId":"<document-id>"' /var/log/qcet/app.log

# Failed signature attempts
grep '"action":"signDocument\|organizationSign"' /var/log/qcet/app.log | grep '"level":"error"'

# Delivery audit trail
grep '"action":"OUTGOING_DOCUMENT_DELIVERED"' /var/log/qcet/app.log

# Trace a specific request end-to-end
grep '"requestId":"<x-request-id>"' /var/log/qcet/app.log
```

### 5.3 Health Check Integration

- **`/api/health/ready`**: Reports database, schema, storage, config, and rate-limit backend status. If the readiness probe fails, signature and delivery operations should be suspended until the underlying dependency is restored.
- **`/api/health/live`**: Reports process liveness and memory usage. A failing liveness probe indicates the application process itself needs restart.

---

## 6. Decision Matrix: Signature & Delivery Failures

| Failure Category | Immediate Action | Escalation Trigger | Recovery SLA |
| :--- | :--- | :--- | :--- |
| Provider timeout (transient) | Wait and retry | 3+ consecutive failures or > 15 min outage | 30 minutes |
| Certificate expired/revoked | Contact CA provider | Immediately — blocks all signing | 4 hours (business hours) |
| HSM failure | Contact CA provider | Immediately — blocks all signing | Per provider SLA |
| Gateway temporary outage | Switch to alternative channel | > 1 hour outage | 1 hour |
| Systematic delivery failure | Investigate root cause | Affects > 5 documents | 2 hours |
| Data integrity concern | Freeze document, audit trail review | Any suspicion of tampering | Immediate escalation to Quản trị mạng |

---

## 7. Provider-Neutral Adapter Boundary

The codebase currently uses placeholder `certificateMetadata` (e.g., `{ provider: "Ban Cơ yếu Chính phủ", status: "VALID" }`) as the provider has not been selected. When a provider is chosen:

1. Implement the adapter interface in `src/lib/integrations/` (e.g., `signature-provider.ts`, `delivery-gateway.ts`).
2. The adapter MUST:
   - Return structured error objects distinguishing transient vs. permanent failures.
   - Include the provider's correlation/transaction ID in `certificateMetadata` for cross-system tracing.
   - Respect the existing `$transaction` boundary — never commit application state before provider confirmation.
3. Update this document with provider-specific recovery steps once the adapter is live.
4. Add provider health to the `/api/health/ready` probe checks.

---

## 8. Related Documents

- [Rollback & Recovery Strategy](rollback.md) — Application-level rollback procedures
- [Data Classification](../security/data-classification.md) — Sensitivity levels for document data
- [Database Operations](../architecture/DATABASE_OPERATIONS.md) — Expand-Migrate-Contract lifecycle
- [Outgoing Document Workflow](../domain/documents.md) — Full workflow state machine documentation
