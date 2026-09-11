# Workload Small-01: Academic Calendar Boundary Helper Correction

## Objective
Enhance and fix edge-case handling in `src/lib/academic-calendar.ts` for boundary dates (specifically the 24th and 25th day transitions) and ensure robust support for ISO datetime strings with timezone offsets.

## Scope
- Permitted files: `src/lib/academic-calendar.ts`, `tests/unit/academic-calendar.test.ts`
- Prohibited files: Any files outside `src/lib/academic-calendar.ts` and `tests/unit/`

## Requirements
1. **Requirement 1 (Boundary Inclusivity)**:
   - Ensure `getAcademicMonthInfo(date)` correctly maps both the start date (`YYYY-MM-25`) and end date (`YYYY-MM-24`) inclusively across month boundaries.
   - When a datetime string containing timezone offset (e.g. `2026-08-25T00:00:00+07:00`) is supplied, it must evaluate in the local ICT context without shifting to previous day due to UTC conversion.

2. **Requirement 2 (Validation & Export)**:
   - Export helper `isOperationalMonthBoundary(date: Date | string): { isStart: boolean; isEnd: boolean }`.
   - Unit tests covering 2026-08-24 (previous cycle end), 2026-08-25 (new cycle start), and leap-year February transitions.
