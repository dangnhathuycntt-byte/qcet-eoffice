# QCET E-Office — Master Cutover & Production Hardening Plan

## 0. Mục tiêu

Không thêm feature lớn mới trong giai đoạn này.

Mục tiêu là chuyển dự án từ:

```text
V1 + V2 cùng chạy
+
legacy authorization
+
new authorization
+
generic PATCH
+
domain command
```

thành:

```text
UI / PWA
   ↓
Canonical Domain Command API
   ↓
AuthorizationContext V2
   ↓
Domain Service / State Machine
   ↓
Atomic Transaction
   ├── Business Data
   ├── AuditEvent
   └── OutboxEvent
   ↓
PostgreSQL
```

Sau khi hoàn thành:

```text
1 authorization engine
1 business model
1 mutation path
1 source of truth
1 migration history
1 verification pipeline
```

---

# PHASE 0 — FREEZE & BASELINE

## Mục tiêu

Không để agent tiếp tục tạo thêm kiến trúc mới trong khi V1/V2 chưa hợp nhất.

## 0.1 Chốt snapshot

Trước mỗi batch:

```bash
git status
git rev-parse HEAD
git diff --stat
```

Ghi:

```text
commit
branch
dirty files
migration version
app version
```

Không trộn kết quả test của hai snapshot khác nhau.

Báo cáo Astra cũng yêu cầu snapshot cố định trước khi coi test là bằng chứng nghiệm thu.

---

## 0.2 Đóng băng các pattern legacy

Không thêm mới:

```text
ADMIN/MANAGER/STAFF business rules

role-specific workspace

generic task workflow PATCH

generic document workflow PATCH

DacumDelegation authorization

TaskAssignee-only business logic

/?zone=* business route

/portal business implementation
```

Chỉ:

```text
bug fix
migration adapter
compatibility
```

---

## 0.3 Ghi canonical architecture

Chốt:

```text
Authorization:
AuthorizationContext V2

Organization:
OrganizationalUnit
PositionDefinition
PositionAssignment
ResponsibilityArea
PortfolioAssignment
DelegationGrant

Task responsibility:
TaskActor

Task approval:
TaskApprovalProcess
TaskApprovalStep

Document workflow:
IncomingDocumentService
OutgoingDocumentService

Audit:
AuditEvent

Async events:
OutboxEvent
```

---

# GATE 0 — SECURITY & CORRECTNESS BLOCKERS

Đây là phần phải làm **trước cả refactor architecture tiếp theo**.

---

# PHASE 1 — F01: Không được trả raw Prisma / passwordHash

## Hiện trạng

`task-query-service.ts` vẫn:

```text
subTasks
 → assignees
   → user: true
```

và route vẫn response:

```text
raw: result.raw
raw: updated
```

Astra xác định raw nested User có thể mang `passwordHash`.

## Sửa

### 1.1 HTTP response tuyệt đối không trả `raw`

Bỏ:

```text
raw
```

khỏi:

```text
GET /api/tasks/:id
PATCH /api/tasks/:id
```

Public contract chỉ trả:

```text
dto
data
pagination
availableActions
```

---

### 1.2 User relation luôn dùng explicit select

Tạo:

```ts
const PUBLIC_USER_SELECT = {
  id: true,
  name: true,
  avatarUrl: true,
}
```

Hoặc:

```text
DIRECTORY_USER_SELECT
TASK_ACTOR_USER_SELECT
AUDIT_ACTOR_SELECT
```

Không:

```ts
include: {
  user: true
}
```

ở response-producing query.

---

### 1.3 Recursive sensitive-field test

Test object response recursively không có:

```text
passwordHash
refreshToken
sessionToken
googleToken
secret
```

## DoD

```text
0 public HTTP response contains raw Prisma model
0 nested passwordHash
```

---

# PHASE 2 — F02: Task list phải authorization ở database

## Hiện trạng

`queryTasks()` hiện build `where` từ:

```text
scope
department
assignedTo
status
search
```

nhưng chưa có mandatory authorization predicate.

Astra xác định list endpoint có thể rộng hơn detail endpoint.

## Target

```text
User Context
     ↓
buildTaskReadPredicate()
     ↓
Prisma WHERE
     ↓
client filters
     ↓
COUNT
     ↓
pagination
```

## 2.1 Tạo

```text
buildTaskReadWhere(authContext)
```

Ví dụ predicate có thể bao gồm:

```text
school-level visibility theo capability

leadUnitId thuộc unit có quyền

TaskActor userId = current user

creator

reviewer

approver

delegated responsibility
```

Không dựa vào frontend scope.

---

## 2.2 Client filter chỉ thu hẹp

```text
authorization predicate
AND
requested filters
```

Không:

```text
requested filter
OR authorization
```

---

## 2.3 Bỏ `all=true` unrestricted

Interactive API:

```text
limit max 100/200
```

Export có endpoint riêng:

```text
/export
```

và authorization riêng.

---

## DoD

User đơn vị A:

```text
scope=all
search
pagination
cursor
department=B
all=true
```

vẫn không nhận Task B nếu không có quyền.

---

# PHASE 3 — F04: Aggregate ID Binding

## Hiện trạng

`requestRevision(taskA, deliverableIdB)` có thể fallback:

```text
findUnique(deliverableIdB)
```

rồi update trực tiếp.

Astra xếp đây là P1.

## Quy tắc mới

Mọi child resource phải được resolve:

```text
WHERE
  id = childId
  AND taskId = parentTaskId
```

Áp dụng:

```text
TaskDeliverable
TaskResult
TaskApprovalStep
TaskActor
TaskRelation
```

---

## 3.1 Load aggregate một lần

```text
loadTaskAggregate(taskId)
```

Không fallback global child lookup.

---

## 3.2 Update có parent condition

Nếu Prisma relation update khó thể hiện:

```text
find first where:
  id
  taskId
```

rồi update trong cùng transaction.

Approval step:

```text
step
→ process
→ taskId
```

phải match parent task.

---

## Tests

```text
Reviewer A
+
Task A
+
deliverable B
→ DENY

step B
→ DENY
```

Không được thay đổi:

```text
A
B
AuditEvent
OutboxEvent
```

---

# PHASE 4 — F05: Meeting Authorization

## Hiện trạng

Meeting hiện gần như:

```text
authenticated
→ confirm minutes
```

Astra phát hiện:

```text
listMeetings currentUserId unused
confirmMinutes no actor policy
createResolution no authority check
```



## 4.1 Tạo MeetingPolicy

Capabilities:

```text
meeting.read
meeting.create
meeting.edit_agenda
meeting.manage_participants

meeting.draft_minutes
meeting.confirm_minutes

meeting.create_resolution
meeting.publish_resolution
```

---

## 4.2 Relationships

Policy xét:

```text
organizer
chair
secretary
participant
body membership
unit membership
delegation
portfolio
```

---

## 4.3 Resolution → Task phải qua TaskCommand

Không:

```text
MeetingService
→ tx.task.create()
```

trực tiếp.

Dùng:

```text
TaskCommandService.createFromResolution()
```

để Task mới cũng được:

```text
actors
audit
outbox
authorization
code generation
```

đồng nhất.

---

# PHASE 5 — F06: Session / JWT Revocation

## Hiện trạng

JWT giữ:

```text
role
departmentId
```

và API context tin trực tiếp token.

Astra chỉ ra việc khóa account/đổi quyền DB không tự vô hiệu token cũ.

## Target

JWT chỉ chứng minh:

```text
identity
session
```

Không là nguồn business authority lâu dài.

---

## 5.1 Mỗi request sensitive load current account state

Check:

```text
user.exists
user.isActive
session.valid
tokenVersion/sessionVersion
```

---

## 5.2 Role/position authority lấy DB

Không dùng:

```text
session.role
session.departmentId
```

để quyết định cuối.

Dùng:

```text
PositionAssignment
PortfolioAssignment
DelegationGrant
```

---

## 5.3 Token/session version

Có thể thêm:

```text
User.sessionVersion
```

JWT chứa:

```text
sv
```

Nếu admin revoke:

```text
sessionVersion++
```

token cũ fail.

Hoặc Session table có:

```text
revokedAt
expiresAt
```

---

## Tests

```text
login
→ lấy token

disable user
→ API read DENY
→ API mutation DENY
```

```text
remove portfolio
→ token cũ mất quyền business
```

---

# PHASE 6 — F07: File Access Default Deny

## Hiện trạng

File route vẫn dùng:

```text
contains(relativePath)
contains(fileName)
fileName
```

và orphan file mặc định có thể được authenticated user tải.

Astra xác định đúng lỗ hổng này.

## Target

Không request file bằng raw path nữa nếu có thể.

```text
GET /api/files/:attachmentId
```

hoặc:

```text
GET /api/documents/:id/attachments/:attachmentId
```

---

## 6.1 Storage model

Attachment:

```text
id
storageKey
originalName
mimeType
size
sha256
ownerResourceId
classification
```

---

## 6.2 Resolve

```text
attachmentId
→ DB exact row
→ parent resource
→ authorize
→ exact storageKey
→ stream
```

Không tìm bằng basename.

---

## 6.3 Orphan private file

```text
no DB metadata
→ 404
```

Không phân quyền bằng filename:

```text
"mat"
"secret"
```

---

# PHASE 7 — F08: PWA cross-user cache leak

## Hiện trạng

Service Worker xét extension:

```text
.png
.jpg
.webp
...
```

trước khi loại toàn bộ API.

Astra đã mô phỏng:

```text
A load private image
→ cached
→ logout
→ B login
→ B gets A cache
```



## 7.1 Đổi thứ tự SW

Rule đầu tiên:

```text
if /api/*
  NEVER generic static cache
```

Sau đó mới:

```text
/_next/static/*
/icons/*
/fonts/*
```

---

## 7.2 Static asset allowlist

Không dùng extension rule chung.

Dùng:

```text
/_next/static/
/icons/
/logo-qcet.*
/fonts/
```

---

## 7.3 Logout purge

Logout:

```text
purge user IndexedDB
purge private cache namespace
purge mutation outbox
```

---

## 7.4 SW version migration

Khi rollout bản fix:

```text
activate
→ delete old CACHE_STATIC_NAME
```

để cache lỗi trước đó không tồn tại mãi.

---

# PHASE 8 — F15: Classification-aware Document Authorization

## Hiện trạng

`canReadDocument()` hiện không xét:

```text
securityLevel
```

Astra xác định tài liệu `THUONG` và `MAT/TOI_MAT/TUYET_MAT` hiện có thể dùng cùng logic.

## Quan trọng

Không tự thiết kế policy tài liệu mật bằng suy đoán.

Trước pilot phải được:

```text
nhà trường
văn thư
phụ trách ATTT/pháp lý
```

phê duyệt policy.

---

## Technical model

```text
PUBLIC
INTERNAL
RESTRICTED
PERSONAL_DATA
```

Nếu giữ:

```text
MAT
TOI_MAT
TUYET_MAT
```

thì nên:

```text
deny-by-default
```

cho đến khi có policy chính thức.

---

# GATE 1 — PLATFORM CORRECTNESS

---

# PHASE 9 — F09: Prisma migration history

## Blocker production

Hiện:

```text
prisma/migrations/
├── check_constraints.sql
├── constraints.sql
└── indexes.sql
```

Astra xác nhận chưa có migration history có thể tái lập.

## 9.1 Không `db push` production

Phải dựng migration chain.

---

## 9.2 Baseline DB hiện tại

Nếu production/staging DB đã tồn tại:

```text
introspect
compare
baseline
```

Sau đó mới:

```text
organization-v2
task-actor-v2
delegation-v2
document-workflow
dossier
meeting
audit-outbox
```

---

## 9.3 Physical names

Kiểm tra SQL hiện có đang dùng:

```text
TaskAssignee
taskId
```

trong khi schema map:

```text
task_assignees
task_id
```

Phải sửa về physical DB names.

---

## 9.4 Startup fail closed

Không:

```bash
prisma migrate deploy || echo warning
next start
```

Phải:

```bash
prisma migrate deploy
exec next start
```

Migration fail → deployment fail.

---

## Acceptance

### Fresh DB

```text
empty postgres
→ migrate deploy
→ seed minimal
→ test
```

### Existing DB copy

```text
pre-V2 backup
→ migrate deploy
→ parity check
```

---

# PHASE 10 — F10: Test runner đáng tin

Hiện:

```text
tsx --test tests/**/*.test.ts
```

Astra đã mô phỏng shell glob có thể bỏ hàng trăm tests ở root/deep directories.

## Target

Không dựa shell glob.

Tạo script Node:

```text
scripts/run-tests.mjs
```

recursive discover:

```text
tests/**/*.test.ts
```

bằng filesystem/glob library hoặc deterministic walker.

Output:

```text
Discovered: 412
Executed:   412
```

---

## Tách suites

```text
test:unit
test:integration
test:security
test:e2e
test:all
```

`npm test`:

```text
unit + integration + security
```

Browser E2E riêng.

---

## CI phải fail nếu test inventory mismatch

Có một test fail ở:

```text
tests/root.test.ts
tests/auth/test.ts
tests/server/api/test.ts
```

đều phải làm pipeline đỏ.

---

# PHASE 11 — F11: Atomic Optimistic Concurrency

## Hiện trạng

Route:

```text
read version
compare
```

rồi service:

```text
UPDATE WHERE id
```

Hai request có thể cùng pass.

Astra mô tả chính xác race này.

## Target

Atomic CAS:

```text
UPDATE task
WHERE id = ?
AND version = expectedVersion
SET ...
version = version + 1
```

Nếu affected rows = 0:

```text
409 CONFLICT
```

---

## Tất cả mutation aggregate phải increment version

Bao gồm:

```text
metadata edit
status transition
submit result
review
approve
reassign
deadline
```

---

# PHASE 12 — F12: Idempotency thật

## Hiện trạng

PWA gửi:

```text
Idempotency-Key
```

nhưng API chưa consume.

Astra đã xác minh helper tồn tại nhưng chưa wiring.

## Target

```text
userId
+
operation
+
idempotencyKey
+
payloadHash
```

unique.

---

## Áp dụng trước

```text
create task
submit result
create directive
create resolution
```

Approval cũng có thể idempotent.

---

## Duplicate key same payload

```text
return saved result
```

Duplicate key different payload:

```text
409 IDEMPOTENCY_CONFLICT
```

---

# PHASE 13 — F13: Document ACL trước pagination

Hiện:

```text
find documents
→ take/skip
→ route filter canRead
```

Astra đúng khi nói điều này làm page/total sai.

Target:

```text
authorization WHERE
AND filters
→ count
→ pagination
```

Cùng pattern với Task.

---

# PHASE 14 — F14: Institutional Identity

Đây không phải cosmetic bug.

Source hiện vẫn có:

```text
Trường Cao đẳng Kinh tế và Công nghệ Quảng Ninh
```

trong:

```text
manifest
layout
settings
outgoing document issuingAuthority
```

Astra xác định nó đã đi cả vào test và business data.

## Tạo institutional profile

```text
src/config/institution.ts
```

Ví dụ:

```ts
{
  officialName: "...",
  shortName: "QCET",
  code: "...",
  issuingAuthority: "...",
  address: "...",
}
```

Giá trị chính thức phải được nhà trường duyệt.

Không hard-code institution name ở nhiều file.

---

# GATE 2 — UNIFIED AUTHORIZATION V2

Sau khi Gate 0/1 ổn mới bắt đầu cutover lớn.

---

# PHASE 15 — AuthorizationContext V2

Tạo một builder duy nhất:

```text
buildAuthorizationContext(userId)
```

Load:

```text
User current state
PositionAssignments
PositionDefinitions
OrganizationalUnits

PortfolioAssignments
ResponsibilityAreas

DelegationGrants

BodyMemberships nếu cần
SystemRole
```

Không:

```text
DacumDelegation
role equivalence ADMIN/MANAGER/STAFF
```

làm business authority.

---

## 15.1 Tách System Role

```text
SYSTEM_ADMIN
```

không phải:

```text
HIEU_TRUONG
```

`request-context.ts` phải bỏ mapping:

```text
HIEU_TRUONG → ADMIN
PHO_HIEU_TRUONG → ADMIN
BAN_GIAM_HIEU → ADMIN
```

---

## 15.2 Capability Engine

```text
authorize(context, action, resource)
```

xét:

```text
position
capability
portfolio
resource relationship
organization
workflow state
classification
delegation
SoD
```

---

## 15.3 Policies legacy chỉ adapter

```text
canReadTask()
```

tạm thời gọi engine mới.

Không chứa rule riêng.

---

# GATE 3 — TASK V2 CUTOVER

---

# PHASE 16 — Chuyển UI khỏi generic Task PATCH

Generic PATCH chỉ:

```text
title
description
priority
safe dueDate change
safe metadata
```

Workflow phải:

```text
/actions/*
```

---

## 16.1 Submit

```text
POST /tasks/:id/actions/submit-result
```

---

## 16.2 Review

```text
POST /tasks/:id/actions/review
```

---

## 16.3 Revision

```text
POST /tasks/:id/actions/request-revision
```

---

## 16.4 Approve

```text
POST /tasks/:id/actions/approve
```

---

## 16.5 Reassign

```text
POST /tasks/:id/actions/reassign
```

---

## UI không map state

Không:

```text
approved → COMPLETED
revision → IN_PROGRESS
```

UI chỉ gửi intent.

Server trả state.

---

# PHASE 17 — TaskActor trở thành source of truth

Canonical:

```text
TaskActor
```

Legacy:

```text
TaskAssignee
```

chỉ compatibility.

Một DRI:

```text
partial unique / DB invariant
```

Nếu chưa drop legacy:

```text
V2 writer
→ legacy mirror adapter
```

Không dual writer độc lập.

---

# PHASE 18 — PWA Task Outbox V2

Offline queue semantic command:

```text
TASK_UPDATE_PROGRESS
TASK_SUBMIT_RESULT
```

Không generic:

```text
PATCH arbitrary JSON
```

Online-only:

```text
approve
review
reassign
delegation
signature
document issue
```

---

# GATE 4 — DOCUMENT V2 CUTOVER

---

# PHASE 19 — Khóa generic Document PATCH

Generic PATCH không được set:

```text
status
signer
issued state
document number
organization signature
```

---

# PHASE 20 — Incoming workflow

Canonical commands:

```text
register
present
direct
assign-unit
assign-person
resolve
file
archive
```

---

# PHASE 21 — Outgoing workflow

```text
draft
submit-content-review
approve-content
submit-format-check
approve-format
sign
assign-number
organization-sign
issue
file
archive
```

---

# PHASE 22 — Document version locking

Signed version:

```text
immutable
```

Edit:

```text
create next version
→ review again
→ sign again
```

---

# GATE 5 — MEETING / DOSSIER / ORGANIZATION

---

# PHASE 23 — Meeting V2

Sau khi authorization đã chuẩn:

```text
Meeting
→ Minutes
→ Resolution
→ Task
```

Task phải đi TaskCommand.

---

# PHASE 24 — Work Dossier

Hoàn thiện:

```text
OPEN
ACTIVE
CLOSED
READY_FOR_ARCHIVE
SUBMITTED
ACCEPTED
ARCHIVED
```

Mọi item phải có quyền theo dossier/resource.

---

# PHASE 25 — Organization Administration

Cần API/service cho:

```text
units
positions
assignments
responsibility areas
portfolios
delegations
bodies
memberships
```

Mọi thay đổi:

```text
effectiveFrom
effectiveTo
sourceDecision
audit
```

---

# GATE 6 — LEGACY REMOVAL

Chưa được drop model cũ trước parity.

---

# PHASE 26 — Inventory legacy reads/writes

Cho từng model:

```text
Department
TaskAssignee
DacumDelegation
DocumentDirective
ExecutiveResolution
```

ghi:

```text
READ
WRITE
DUAL WRITE
SEED
TEST ONLY
```

---

# PHASE 27 — Backfill

Viết migration:

```text
Department → OrganizationalUnit

TaskAssignee → TaskActor

DacumDelegation → DelegationGrant

DocumentDirective → V2 directive/assignment

ExecutiveResolution → MeetingResolution
```

---

# PHASE 28 — Parity checks

Ví dụ:

```text
PRIMARY_OWNER
==
TaskActor DRI primary
```

Mismatch:

```text
report
block cutover
```

---

# PHASE 29 — Stop legacy writes

Sau parity:

```text
V2 write only
```

Legacy read compatibility tạm.

Sau một release ổn định:

```text
remove
```

---

# GATE 7 — ROUTING/PWA/DEEP LINKS

Canonical routes:

```text
/
/tasks
/documents
/calendar
/org
/notifications
/settings
```

Legacy:

```text
/dashboard → /
/unit-tasks → /tasks?scope=unit

/?zone=tasks → /tasks
/?zone=calendar → /calendar
/?zone=org → /org

/portal → /
```

Không redirect ngược canonical → legacy.

---

# PHASE 30 — Action Inbox

Inbox không dựa:

```text
if ADMIN
if HEAD
```

Nó query:

```text
resources requiring action
+
authorize()
```

Item:

```text
resource
requiredAction
deadline
reasonWhyMe
href
```

Deep link:

```text
/tasks?taskId=...
/documents?documentId=...
```

hoặc route detail chính thức.

Không link route không tồn tại.

---

# GATE 8 — SOURCE CLEANUP

Chỉ cleanup mạnh sau khi cutover thành công.

---

# PHASE 31 — `.superpowers`

Hiện hàng trăm artifact agent.

Xóa tracked:

```text
review-*.diff
task-*-brief
task-*-report
task-*-review
```

Giữ:

```text
active progress tối thiểu
.gitignore
```

Git history đã là archive.

---

# PHASE 32 — Docs

Target:

```text
docs/
├── agent
├── architecture
├── domain
├── decisions
├── operations
├── product
├── security
└── plans/
    └── active
```

Superseded/completed cũ không cần tồn tại vô hạn.

---

# PHASE 33 — Source facades

Migrate imports rồi xóa re-export:

```text
dashboard/*
workspace/*
portal/*
tasks/*
```

nếu chỉ trỏ cùng implementation.

---

# PHASE 34 — `src/lib`

Migrate dần về:

```text
domain/
server/
features/
shared/
config/
storage/
telemetry/
```

Không mass move 300 file trong một commit.

---

# PHASE 35 — Components lớn

Chỉ tách khi chạm vào feature.

Priority:

```text
task-detail-side-sheet
organization-tree
create-task-modal
unified-adaptive-workspace
```

Tách responsibility, không tách chỉ vì LOC.

---

# GATE 9 — CI/CD & PRODUCTION

---

# PHASE 36 — Verify Pipeline

Mỗi PR:

```text
npm ci
prisma validate
typecheck
real lint
full test inventory
build
```

Security PR:

```text
security tests
```

DB PR:

```text
migration tests
```

---

# PHASE 37 — Deployment

Target:

```text
Git
↓
CI
↓
Docker image
↓
Registry
↓
Staging
↓
Smoke
↓
Approval
↓
Production pull
↓
migrate
↓
start
↓
readiness
```

Không chỉ “build xong rồi ghi receipt”.

---

# PHASE 38 — Observability

Theo dõi:

```text
API error rate
API p95
DB query p95
auth failures
forbidden rate
outbox backlog
push failures
PWA sync conflicts
disk
DB connections
```

---

# PHASE 39 — Backup/Restore

Trước pilot:

```text
DB backup
private file backup
restore test
```

Không coi:

```text
backup exists
```

là đủ.

---

# GATE 10 — PILOT ACCEPTANCE

Báo cáo Astra đưa ra acceptance checklist rất tốt và nên giữ nguyên tinh thần: kiểm tra quyền list/detail/search/export/download đồng nhất, không lộ sensitive fields, OCC concurrent, idempotency retry, cross-user PWA cache, workflow end-to-end và backup/restore.

---

# Test matrix bắt buộc

## Account

```text
SYSTEM_ADMIN

HIEU_TRUONG

PHO_HIEU_TRUONG
  portfolio A
  portfolio B

TRUONG_DON_VI

PHO_TRUONG
  delegated
  non delegated

VAN_THU

CHUYEN_VIEN

locked account
expired delegation
```

---

## Task

```text
create
assign
DRI
collaborator
submit
review
revision
approve
reassign
cancel
completed immutable rules
```

---

## Security

```text
cross-unit
cross-task child IDs

parent A + deliverable B

parent A + approval step B

stale JWT

technical admin business approve

DRI self approve

passwordHash recursive response scan
```

---

## Document

```text
incoming
outgoing
classification

sign
number
issue
archive

cross-unit
private download
```

---

## PWA

```text
User A
→ load private image
→ logout
→ User B
→ no A data

offline Task
→ reconnect
→ idempotent sync

old SW
→ update
→ old vulnerable caches purged
```

---

## Database

```text
Fresh DB migration

Old DB migration

OCC race

Idempotency race

partial unique DRI

sequence concurrency
```

---

# Thứ tự Sprint thực thi

## Sprint 1 — Security Boundary

```text
F01 raw/passwordHash
F02 task list ACL
F04 child aggregate binding
F07 private files
F08 SW private cache
```

**Không làm UI mới.**

---

## Sprint 2 — Identity / Authority

```text
F05 meeting policy
F06 stale JWT
F15 classification ACL

AuthorizationContext V2
remove BGH → ADMIN equivalence
```

---

## Sprint 3 — Platform Correctness

```text
F09 migrations
F10 test runner
F11 atomic OCC
F12 idempotency
F13 document query ACL
F14 institutional profile
```

---

## Sprint 4 — Task Cutover

```text
Task actions
UI migration
PWA outbox migration
TaskActor canonical
```

---

## Sprint 5 — Document Cutover

```text
incoming
outgoing
generic PATCH restrictions
version locking
archive
```

---

## Sprint 6 — Meeting/Dossier/Organization

```text
meeting
resolution → task command
dossier
org admin
delegations
```

---

## Sprint 7 — Legacy Removal

```text
backfill
parity
stop dual writes
remove compatibility
```

---

## Sprint 8 — Routing / UX Integration

```text
canonical routes
Action Inbox
Workbench
Documents
Task Workspace
```

---

## Sprint 9 — Repo Cleanup

```text
.superpowers
docs
facades
legacy tests
src/lib migration
```

---

## Sprint 10 — Production Readiness

```text
CI/CD
staging
monitoring
backup
restore
load test
security regression
pilot
```

---

# Thứ tuyệt đối KHÔNG làm giữa kế hoạch

Không:

```text
thêm role mới vào enum cũ

thêm workspace riêng cho role

tạo Authorization V3

thêm endpoint PATCH workflow khác

tạo Task V3

rewrite sang NestJS

upgrade Next major

upgrade Prisma major

microservices

Redis chỉ vì "scale"

redesign UI lần nữa trước cutover
```

---

# Definition of Done cuối cùng

Chỉ coi dự án ổn định khi:

```text
SECURITY
✓ no raw Prisma response
✓ no nested passwordHash
✓ task/document list ACL inside DB query
✓ no aggregate child-ID confusion
✓ meeting authorization
✓ stale account/token loses authority
✓ private files default deny
✓ private API never static-cached
✓ classification participates in document access

AUTHORIZATION
✓ one AuthorizationContext
✓ one authorization engine
✓ SYSTEM_ADMIN ≠ institutional leadership
✓ Position + Portfolio + Delegation are authoritative

TASK
✓ workflow mutation only through commands
✓ TaskActor canonical
✓ generic PATCH cannot bypass workflow
✓ OCC atomic
✓ idempotency active

DOCUMENT
✓ incoming workflow canonical
✓ outgoing workflow canonical
✓ generic PATCH cannot bypass state machine
✓ signed versions immutable
✓ file/archive policy correct

DATABASE
✓ real Prisma migration history
✓ fresh DB migrate works
✓ existing DB upgrade works
✓ migration failure blocks startup

PWA
✓ user A cache cannot leak to B
✓ semantic offline outbox
✓ old cache versions purged
✓ high-authority actions online only

QUALITY
✓ all test files discovered and executed
✓ typecheck passes
✓ lint passes
✓ integration passes
✓ build passes

LEGACY
✓ no business dependency on ADMIN/MANAGER/STAFF
✓ no DacumDelegation authority
✓ no TaskAssignee canonical write
✓ no generic workflow PATCH
✓ no runtime ?zone=
✓ /portal retired

OPERATIONS
✓ staging
✓ deploy reproducible
✓ observability
✓ backup
✓ restore test
✓ rollback
✓ pilot UAT
```

# North Star

Toàn hệ thống cuối cùng phải đi theo:

```text
LEGAL / INTERNAL REGULATIONS
             ↓
ORGANIZATION + POSITION
             ↓
RESPONSIBILITY PORTFOLIO
             ↓
CAPABILITY + RELATIONSHIP
             ↓
DELEGATION + WORKFLOW STATE
             ↓
AUTHORIZATION
             ↓
DOMAIN COMMAND
             ↓
TRANSACTION
             ↓
AUDIT + OUTBOX
             ↓
DATABASE
             ↓
PROJECTION / UI / PWA
```

Không quay lại:

```text
UI
→ role
→ PATCH status
→ DB
```

Đây là điểm quan trọng nhất của toàn bộ chương trình.