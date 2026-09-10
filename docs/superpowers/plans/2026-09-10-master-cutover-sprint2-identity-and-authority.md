# QCET E-Office — Master Cutover

## Sprint 2: Identity & Authority

**Target:** Gate 1 — Identity, Authorization & Classification
**Prerequisite:** Sprint 1 / Gate 0 CLOSED 100%
**Scope:** F05 + F06 + F15 + AuthorizationContext V2
**Không thuộc Sprint này:** UI redesign, Task V2 mutation cutover, Document workflow cutover, repo cleanup.

---

# 1. Goal

Chuyển hệ thống từ:

```text
JWT
 ├─ role
 ├─ departmentId
 └─ title
      ↓
role/title string checks
      ↓
business authorization
```

sang:

```text
Authenticated Session
        ↓
Current Account Validation
        ↓
AuthorizationContext V2
        ├─ PositionAssignment
        ├─ PositionDefinition
        ├─ OrganizationalUnit
        ├─ PortfolioAssignment
        ├─ ResponsibilityArea
        ├─ DelegationGrant
        ├─ BodyMembership
        └─ SystemRole
        ↓
authorize(actor, action, resource)
        ↓
ALLOW / DENY
```

Sau Sprint 2:

```text
SYSTEM_ADMIN ≠ HIEU_TRUONG
SYSTEM_ADMIN ≠ PHO_HIEU_TRUONG

Position ≠ system role

Scope switcher ≠ permission

Department membership ≠ unrestricted access

JWT claim ≠ current business authority
```

---

# 2. Invariants

## Identity

JWT/session chỉ được dùng để xác định:

```text
userId
sessionId
sessionVersion
expiry
```

Không được coi:

```text
role
departmentId
title
```

trong token là business authority cuối cùng.

---

## Authorization

Mọi quyết định business phải dựa vào trạng thái DB hiện hành:

```text
active account
active PositionAssignment
active PortfolioAssignment
active DelegationGrant
resource relationship
workflow state
classification
```

---

## System administration

`SYSTEM_ADMIN` chỉ có quyền kỹ thuật:

```text
system configuration
account administration
technical diagnostics
integration administration
```

Không tự động có:

```text
task.approve
document.direct
document.sign
meeting.confirm_minutes
meeting.create_resolution
```

---

# 3. Sprint Structure

Thực hiện theo thứ tự:

```text
Task 1 — F06 Current Session Validation
Task 2 — AuthorizationContext V2
Task 3 — Capability Catalog
Task 4 — Authorization Engine Integration
Task 5 — F05 Meeting Authorization
Task 6 — F15 Document Classification
Task 7 — Migrate transitional Task read authorization
Task 8 — Regression / adversarial tests
Task 9 — Independent security review
Task 10 — Gate closure
```

Không đảo Task 5/F15 lên trước AuthorizationContext.

---

# Task 1 — F06: Current Account & Session Validation

## Problem

Hiện API context có thể lấy:

```text
role
departmentId
```

từ JWT đã ký trước đó.

Khi:

```text
user bị khóa
role đổi
đơn vị đổi
position hết hiệu lực
delegation bị revoke
```

token cũ không nên giữ quyền cũ.

---

## 1.1 Tạo Current Session Resolver

Target:

```text
src/server/auth/
├── current-session.ts
├── current-user.ts
└── session-policy.ts
```

API:

```ts
resolveCurrentSession(request)
```

Return:

```ts
{
  sessionId,
  userId,
  user: {
    id,
    email,
    name,
    isActive
  }
}
```

Không return business role snapshot như authority.

---

## 1.2 Validate DB user mỗi request protected

Check:

```text
User exists
AND User.isActive = true
AND session not expired
AND session not revoked
```

Nếu fail:

```text
401 SESSION_INVALID
```

hoặc:

```text
401 ACCOUNT_DISABLED
```

Không tiếp tục vào business service.

---

## 1.3 Session revocation

Ưu tiên dùng Session table hiện có.

Bổ sung nếu cần:

```text
Session
├── revokedAt
├── revokedById
├── revokeReason
└── lastSeenAt
```

Nếu model Session hiện tại chưa hỗ trợ revocation.

Không nhất thiết thêm `User.sessionVersion` nếu Session table đã giải quyết tốt.

---

## 1.4 Logout

Logout phải:

```text
revoke/delete current server session
clear cookie
purge client offline state
```

Không chỉ xóa cookie.

---

## 1.5 Account change

Khi admin:

```text
disable user
```

tất cả session của user:

```text
revoked
```

Tùy policy, thay đổi PositionAssignment không bắt buộc revoke token vì authorization context được load lại từ DB mỗi request.

---

## Tests F06

### Locked account

```text
login
→ API success

set User.isActive=false

same cookie/JWT
→ GET protected API = 401
→ POST protected API = 401
```

### Changed organization

```text
user Unit A
→ login

PositionAssignment A expires
PositionAssignment B activated

same session
→ context now reflects B
```

### Revoked session

```text
session.revokedAt != null
→ DENY immediately
```

### Expired session

```text
expires < now
→ DENY
```

---

# Task 2 — AuthorizationContext V2

Đây là lõi Sprint 2.

## 2.1 Canonical location

Target:

```text
src/server/authorization/
├── authorization-context.ts
├── authorization-context-service.ts
├── authorization-engine.ts
├── capability.ts
├── resource.ts
└── errors.ts
```

Nếu `src/lib/auth/hybrid-authorization.ts` hiện chứa engine đáng giữ:

```text
migrate/reuse
```

không tạo engine thứ ba.

---

## 2.2 AuthorizationContext interface

Ví dụ:

```ts
interface AuthorizationContext {
  userId: string;

  systemRoles: SystemRole[];

  positions: ActivePositionAssignment[];

  responsibilityAreas: ResponsibilityArea[];

  portfolios: ActivePortfolioAssignment[];

  delegations: ActiveDelegationGrant[];

  bodyMemberships: ActiveBodyMembership[];

  primaryUnitIds: string[];

  generatedAt: Date;
}
```

---

## 2.3 Active means active

Filter bắt buộc:

```text
effectiveFrom <= now
AND
(effectiveTo IS NULL OR effectiveTo >= now)
AND
status = ACTIVE
```

Áp dụng:

```text
PositionAssignment
PortfolioAssignment
DelegationGrant
BodyMembership
```

Không:

```text
positionAssignments[0]
```

không sort/không xét thời hạn.

---

## 2.4 PositionAssignment

Load:

```text
PositionAssignment
→ PositionDefinition
→ OrganizationalUnit
```

Context cần biết:

```text
positionCode
positionLevel
unitId
acting status
effective dates
sourceDecision
```

---

## 2.5 PortfolioAssignment

Ví dụ:

```text
PHO_HIEU_TRUONG
+
ResponsibilityArea.TRAINING
```

không đồng nghĩa:

```text
PHO_HIEU_TRUONG
+
FINANCE
```

---

## 2.6 DelegationGrant

Canonical delegation duy nhất:

```text
DelegationGrant
```

Không sử dụng:

```text
DacumDelegation
```

cho authorization mới.

Grant phải xét:

```text
fromAssignment
toAssignment
capability
responsibilityArea
unit scope
resource scope
validFrom
validUntil
status
revokedAt
```

---

## 2.7 SystemRole

Tách:

```text
SYSTEM_ADMIN
SECURITY_ADMIN
ORG_ADMIN
```

khỏi institutional positions.

Nếu schema chưa có systemRole riêng, có thể transitional map:

```text
User.role ADMIN
→ SYSTEM_ADMIN
```

nhưng tuyệt đối không:

```text
HIEU_TRUONG → SYSTEM_ADMIN
```

---

# Task 3 — Capability Catalog

Không dùng role check trực tiếp.

## Meeting

```text
meeting.read
meeting.create
meeting.update
meeting.manage_participants
meeting.draft_minutes
meeting.confirm_minutes
meeting.create_resolution
meeting.publish_resolution
```

## Document

```text
document.read
document.read_restricted
document.register
document.direct
document.assign_unit
document.review_content
document.review_format
document.sign
document.assign_number
document.organization_sign
document.issue
document.archive
```

## Task

Sprint 2 chưa cutover mutation Task hoàn toàn, nhưng engine cần hỗ trợ:

```text
task.read
task.create
task.review
task.approve
task.reassign
task.monitor
```

để chuẩn bị Sprint sau.

---

# Task 4 — Unified Authorization Engine

Canonical call:

```ts
authorize(context, action, resource)
```

Return:

```ts
{
  allowed: boolean;
  reason: string;
  rejectionCode?: string;
  delegationUsed?: string;
  actingPositionId?: string;
  auditRecord?: ...
}
```

---

## Evaluation order

```text
1. Account/session valid?
2. Resource classification allowed?
3. Explicit technical-admin restriction?
4. Direct resource relationship?
5. Position capability?
6. Portfolio responsibility?
7. Organizational scope?
8. Valid delegation?
9. Workflow state?
10. Separation of Duties?
```

Default:

```text
DENY
```

---

## Resource model

Ví dụ Meeting:

```ts
{
  type: "meeting",
  id,
  organizerId,
  unitId,
  bodyId,
  participantIds,
  chairIds,
  secretaryIds,
  status
}
```

Document:

```ts
{
  type: "document",
  id,
  classification,
  leadUnitId,
  draftingUnitId,
  creatorId,
  registeredById,
  status
}
```

---

# Task 5 — F05: Meeting Authorization

Audit trước xác định Meeting mới authenticated nhưng chưa authorization đầy đủ. Đây là P1 trong báo cáo nguồn.

## 5.1 Read policy

User được đọc khi có ít nhất một relation hợp lệ:

```text
organizer
participant
body member
unit relation có capability
institutional authority đúng scope
valid delegation
```

Không:

```text
authenticated
→ read every meeting
```

---

## 5.2 listMeetings

`currentUserId` không được bỏ unused.

Target:

```text
authorization predicate
AND filters
→ count
→ pagination
```

Không query toàn bộ rồi filter sau.

---

## 5.3 Confirm Minutes

`meeting.confirm_minutes` chỉ ALLOW cho policy đã định.

Candidate:

```text
authorized chair
authorized institutional position
explicit delegated confirmer
```

Không mặc định secretary.

---

## 5.4 Create Resolution

Cần:

```text
meeting.create_resolution
```

và meeting phải ở state hợp lệ.

Ví dụ:

```text
MINUTES_CONFIRMED
```

trước official resolution nếu quy trình được QCET duyệt như vậy.

---

## 5.5 Resolution producing Task

MeetingService không được:

```ts
tx.task.create(...)
```

bypass Task domain.

Target:

```text
MeetingResolution
        ↓
TaskCommandService.createFromMeetingResolution()
```

Command chuẩn chịu trách nhiệm:

```text
task code
creator
lead unit
TaskActor
audit
outbox
```

---

## 5.6 Meeting routes security baseline

Các mutation routes phải đồng nhất:

```text
authentication
CSRF
Content-Type
body size
rate limit
schema validation
authorization
transaction
audit
```

---

## Tests F05

```text
outsider → list hidden
outsider → GET detail 403/404
outsider → confirm minutes DENY
participant → read ALLOW
participant → confirm DENY
secretary → draft minutes ALLOW
secretary → confirm depends policy
chair → confirm ALLOW
unauthorized user → resolution DENY
resolution before allowed state → DENY
resolution authorized → Task created by canonical command
```

---

# Task 6 — F15: Document Classification Authorization

Audit nguồn chỉ ra policy cũ chưa sử dụng `securityLevel`.

## 6.1 Không suy đoán nghiệp vụ mật

Sprint này không tự khẳng định chính sách pháp lý chi tiết.

Cần tách:

### Application classification

```text
PUBLIC
INTERNAL
RESTRICTED
PERSONAL_DATA
```

### Legacy / legal markings nếu hệ thống đang lưu

```text
THUONG
MAT
TOI_MAT
TUYET_MAT
```

Đối với nhóm chưa có policy được QCET phê duyệt:

```text
deny-by-default
```

---

## 6.2 Canonical classification function

Tạo:

```text
src/server/authorization/document-classification.ts
```

Ví dụ:

```ts
canAccessClassification(context, document)
```

Không để `document-policy.ts` tự có logic khác.

---

## 6.3 PUBLIC

Policy có thể cho authenticated school user đọc nếu đúng business rule được xác nhận.

---

## 6.4 INTERNAL

Yêu cầu ít nhất:

```text
institution membership
+
resource/org scope
```

---

## 6.5 RESTRICTED / PERSONAL_DATA

Yêu cầu:

```text
explicit relation
OR explicit capability
OR valid delegation
```

Unit membership đơn thuần không đủ.

---

## 6.6 MAT / TOI_MAT / TUYET_MAT

Sprint 2:

```text
default DENY
```

trừ policy explicit đã được phê duyệt.

Không:

```text
VAN_THU
→ automatically read everything
```

Không:

```text
SYSTEM_ADMIN
→ automatically read
```

---

## 6.7 Consistency

Classification policy phải áp dụng đồng nhất cho:

```text
GET list
GET detail
search
export
file download
notification preview
Action Inbox
```

Không chỉ detail endpoint.

---

## Tests F15

```text
same unit + INTERNAL → according to policy

same unit + RESTRICTED
without explicit relationship
→ DENY

SYSTEM_ADMIN + RESTRICTED
without business authority
→ DENY

authorized document actor
→ ALLOW

expired delegation
→ DENY

file attachment
→ same result as parent document

list/search/export
→ cannot reveal metadata/snippet of inaccessible document
```

---

# Task 7 — Remove Transitional Task Read Logic

Gate 0 F02 hiện có transitional:

```text
isSystemAdmin
isLeadership
```

Sprint 2 phải chuyển sang canonical context.

Thay:

```ts
if (isSystemAdmin || isLeadership)
```

bằng:

```text
buildTaskReadWhere(AuthorizationContext)
```

---

## Important

Không phá regression F02.

Staff vẫn không được thấy:

```text
unrelated school task
```

chỉ vì:

```text
scope = SCHOOL
```

Leadership visibility phải dựa vào:

```text
PositionAssignment
+
portfolio/capability
```

nếu đó là policy mong muốn.

---

# Task 8 — Remove Role Equivalence as Business Authority

`request-context.ts` hiện có legacy mapping.

Sprint 2:

```text
normalizeRole()
```

có thể còn dùng compatibility/UI.

Nhưng không được được import bởi business authorization mới.

Search acceptance:

```bash
rg "normalizeRole|requireRole|ROLE_EQUIVALENCE_MAP" src/server src/lib
```

Phân loại từng occurrence:

```text
AUTHENTICATION compatibility
UI display
LEGACY adapter
BUSINESS AUTHORIZATION ← phải loại
```

---

# Task 9 — AuthorizationContext API

`GET /api/me/context`

nên sử dụng chính:

```text
AuthorizationContextService
```

không dựng context độc lập.

Response DTO:

```json
{
  "identity": {},
  "activeAssignments": [],
  "responsibilityAreas": [],
  "delegations": [],
  "viewScopes": [],
  "technicalCapabilities": []
}
```

Lưu ý:

> response chỉ phục vụ UI. Server mutation luôn gọi authorization engine lại.

Không tin:

```text
client.availableActions
```

khi mutation.

---

# Task 10 — availableActions

Resource DTO có thể trả:

```json
{
  "availableActions": [
    "meeting.read",
    "meeting.confirm_minutes"
  ]
}
```

Nhưng phải tính bằng cùng engine:

```text
authorize()
```

Không viết một matrix riêng ở frontend.

---

# Task 11 — Audit Authorization Decisions

Các mutation authority-sensitive nên ghi:

```text
actorUserId
actingPositionAssignmentId
delegationGrantId
action
resourceType
resourceId
requestId
result
```

Business AuditEvent vẫn ưu tiên ghi successful mutation.

Security deny có thể log structured security event, tránh spam DB nếu cần.

---

# Task 12 — Cache Strategy cho AuthorizationContext

Không cache quá lâu.

Sprint đầu tiên ưu tiên correctness:

```text
per-request context
```

Sau này mới cache.

Nếu cache:

```text
short TTL
+
invalidate on:
PositionAssignment update
Portfolio update
Delegation revoke
User disable
```

Không premature optimization.

---

# 4. Files Expected to Change

Core:

```text
src/server/api/request-context.ts

src/server/authorization/*
src/lib/auth/hybrid-authorization.ts

src/server/services/user-context-service.ts

src/server/services/meeting-service.ts
src/app/api/meetings/**

src/server/policies/document-policy.ts
src/app/api/documents/**
src/app/api/files/[...path]/route.ts

src/server/tasks/task-query-service.ts

src/app/api/me/context/route.ts

prisma/schema.prisma          # only if session revocation fields required
```

Tests:

```text
tests/security/session-revocation.test.ts
tests/security/authorization-context-v2.test.ts
tests/security/meeting-authorization.test.ts
tests/security/document-classification.test.ts
tests/security/task-read-v2-parity.test.ts
```

---

# 5. Do NOT Touch

Trừ khi bắt buộc để compile:

```text
Task UI
Task command workflow
PWA redesign
Document outgoing workflow redesign
organization UI
dashboard redesign
.superpowers cleanup
route cleanup
large component refactors
```

Mục tiêu là diff Sprint 2 nhỏ và audit được.

---

# 6. Implementation Order

## Batch A — Session Authority

```text
F06
current session resolver
active account check
revocation
tests
```

Gate:

```text
typecheck
session tests
```

---

## Batch B — AuthorizationContext

```text
context interfaces
DB loader
active-time filtering
portfolio
delegation
system role
```

Gate:

```text
authorization-context tests
```

---

## Batch C — Engine Integration

```text
hybrid engine canonicalization
remove business role mapping
me/context
Task read predicate migration
```

Gate:

```text
Gate0 regression
+
Task read parity tests
```

---

## Batch D — Meeting

```text
list/read policy
minutes policy
resolution policy
task command integration
```

Gate:

```text
Meeting tests
```

---

## Batch E — Document Classification

```text
classification policy
list/detail
file consistency
search/export checks where applicable
```

Gate:

```text
Document classification tests
```

---

## Batch F — Adversarial Review

Independent reviewer must specifically attack:

```text
stale JWT
expired assignment
expired delegation
revoked delegation
System Admin business actions
cross-unit meeting
unauthorized resolution
restricted document
restricted attachment
list/detail mismatch
```

---

# 7. Mandatory Test Matrix

## Identity

| Case                           | Expected                       |
| ------------------------------ | ------------------------------ |
| Active account + valid session | ALLOW authentication           |
| Disabled account               | 401                            |
| Revoked session                | 401                            |
| Expired session                | 401                            |
| Position expired after login   | Old authority disappears       |
| Delegation revoked after login | Delegated authority disappears |

---

## System admin separation

| User              | Action                  | Expected |
| ----------------- | ----------------------- | -------- |
| SYSTEM_ADMIN      | system config           | ALLOW    |
| SYSTEM_ADMIN only | confirm meeting minutes | DENY     |
| SYSTEM_ADMIN only | sign official document  | DENY     |
| SYSTEM_ADMIN only | restricted HR document  | DENY     |

---

## Leadership

| Context                                              | Expected                    |
| ---------------------------------------------------- | --------------------------- |
| Principal + valid institutional position             | capability-based            |
| VP + training portfolio → training resource          | capability-based ALLOW      |
| VP + training portfolio → unrelated finance resource | DENY unless other authority |
| Expired acting appointment                           | DENY                        |
| Valid explicit delegation                            | ALLOW within grant          |
| Expired delegation                                   | DENY                        |

---

## Meeting

| Case                                         | Expected     |
| -------------------------------------------- | ------------ |
| Organizer read                               | ALLOW        |
| Participant read                             | ALLOW        |
| Outsider read                                | DENY         |
| Secretary draft minutes                      | policy ALLOW |
| Secretary confirm minutes without capability | DENY         |
| Authorized chair confirms                    | ALLOW        |
| Outsider creates resolution                  | DENY         |
| Resolution before valid state                | DENY         |

---

## Documents

| Case                             | Expected                |
| -------------------------------- | ----------------------- |
| PUBLIC                           | configured policy       |
| INTERNAL same authorized scope   | ALLOW                   |
| RESTRICTED unrelated unit member | DENY                    |
| RESTRICTED explicit actor        | ALLOW                   |
| SYSTEM_ADMIN only                | DENY                    |
| Restricted attachment            | same policy as document |
| Unauthorized list/search         | zero metadata leak      |

---

# 8. Regression Requirements

Sprint 1 must remain green:

```bash
npm run test:gate0
```

Must still report:

```text
19 pass
0 fail
```

or higher if tests expanded.

Sprint 2 specific:

```bash
npm run test:sprint2
```

Recommended script should execute only isolated security/integration tests first.

---

# 9. Test DB Safety

Any Sprint 2 integration test writing DB must reuse Gate 0 invariant:

```text
QCET_ALLOW_DB_TESTS=1
AND
NODE_ENV=test
AND
localhost/127.0.0.1
AND
database name ending test/_test
AND
not known cloud/production
```

Do not duplicate guard manually in every file.

Extract:

```text
tests/helpers/require-isolated-test-db.ts
```

Gate 0 test should migrate to same helper afterward only if behavior remains identical.

---

# 10. Verification

Per batch:

```bash
npm run typecheck
```

Relevant tests.

Final Sprint 2:

```bash
npm run test:gate0
npm run test:sprint2
npm run typecheck
npm run lint
npm test
npm run build
```

Because F10 is now fixed, `npm test` is allowed as full recursive runner.

Output final inventory:

```text
Discovered test files: N
Executed test files: N
```

must match.

---

# 11. Security Review Checklist

Reviewer must confirm:

```text
[ ] No business decision trusts stale role from JWT
[ ] Disabled user blocked globally
[ ] Revoked session blocked globally
[ ] Active assignments filtered by effective dates
[ ] Portfolio restrictions actually applied
[ ] DelegationGrant is canonical
[ ] Expired/revoked delegation denied
[ ] SYSTEM_ADMIN has no implicit institutional authority
[ ] Meeting list/detail/action policies consistent
[ ] Resolution cannot bypass Task command
[ ] Document security classification participates in read authorization
[ ] Restricted document metadata does not leak in list/search/export
[ ] File download enforces parent classification
[ ] Gate 0 remains green
```

---

# 12. Definition of Done

Sprint 2 is CLOSED only when:

```text
IDENTITY
✓ Current DB account state checked
✓ Disabled accounts immediately lose API access
✓ Revoked/expired sessions rejected
✓ JWT role/title no longer authoritative

AUTHORIZATION
✓ One AuthorizationContext builder
✓ One authorize() engine
✓ PositionAssignment active dates honored
✓ PortfolioAssignment honored
✓ ResponsibilityArea honored
✓ DelegationGrant canonical
✓ Expired/revoked delegation denied
✓ SYSTEM_ADMIN separated from institutional authority

MEETING
✓ list has ACL at DB/query level
✓ detail authorized
✓ confirm minutes authorized
✓ resolution authorized
✓ state machine respected
✓ resulting Task created through canonical Task command

DOCUMENT
✓ classification included in authorization
✓ RESTRICTED default deny
✓ MAT/TOI_MAT/TUYET_MAT default deny until approved policy
✓ list/detail/file consistent

REGRESSION
✓ Gate 0 still passes
✓ Sprint 2 tests pass
✓ typecheck passes
✓ lint passes
✓ complete recursive test runner passes
✓ production build passes
```

---

# 13. Explicit Non-Goals

Sprint 2 does NOT complete:

```text
Task workflow V2 cutover
Document outgoing/incoming command cutover
OCC F11
Idempotency F12
Prisma migration F09
Document pagination F13 if not already required by classification work
Institution profile F14
legacy DB model removal
UI consolidation
repo cleanup
```

Các mục này thuộc Sprint tiếp theo.

---

# 14. Exit Architecture

Kết quả cuối Sprint 2:

```text
Browser / PWA
      ↓
Session Cookie
      ↓
CurrentSessionResolver
      ↓
Active User
      ↓
AuthorizationContextService
      ├── Positions
      ├── Units
      ├── Portfolios
      ├── Responsibility Areas
      ├── Delegations
      └── System Roles
      ↓
AuthorizationEngine
      ↓
 ┌───────────┬────────────┬───────────┐
 │   Task    │  Meeting   │ Document  │
 └───────────┴────────────┴───────────┘
      ↓
Domain Commands
      ↓
Transaction + Audit + Outbox
```

Sprint 2 thành công khi toàn hệ thống bắt đầu trả lời câu hỏi:

> “Người này có được phép làm hành động này, trên tài nguyên này, tại thời điểm này hay không?”

bằng **một AuthorizationContext duy nhất**, thay vì suy luận từ chuỗi role/title.
