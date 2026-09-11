# Workload Medium-01: Calendar Meeting Action Propagation & Attendance Verification Hook

## Objective
Implement attendance verification schema validation and meeting quorum state checks across contract, service, and unit test layers in accordance with QCET E-Office governance requirements.

## Scope
- Permitted files:
  - `src/contracts/meeting.ts`
  - `src/lib/services/meeting-service.ts`
  - `tests/unit/meeting.test.ts`
- Prohibited files:
  - Any files outside `src/contracts/`, `src/lib/services/`, and `tests/unit/`

## Requirements
1. **Requirement 1 (Contract Definition)**:
   - In `src/contracts/meeting.ts`, export `VerifyAttendanceSchema` validating:
     * `meetingId`: uuid/cuid string
     * `participantId`: non-empty string
     * `status`: enum `AttendanceStatus` (PRESENT, ABSENT, EXCUSED, LATE)
     * `verifiedAt`: ISO datetime string
     * `verifiedBy`: non-empty string

2. **Requirement 2 (Service Quorum Validation)**:
   - In `src/lib/services/meeting-service.ts`, implement `validateMeetingQuorum(meetingId, participants)` ensuring at least 50% quorum of attendees are marked PRESENT or EXCUSED before a meeting can transition to `COMPLETED`.

3. **Requirement 3 (Unit Tests)**:
   - Provide unit tests in `tests/unit/meeting.test.ts` covering quorum rejection when attendance is below 50%, and acceptance when >= 50%.
