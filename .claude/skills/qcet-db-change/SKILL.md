---
name: qcet-db-change
description: "Procedure for safe database schema changes, Prisma migrations, SQL inspection, backward compatibility checks, and seed synchronization in QCET E-Office."
---

# QCET Database Change Procedure (`qcet-db-change`)

This skill defines the mandatory, safe procedure for changing the Prisma schema and applying migrations in QCET E-Office. Follow every step sequentially to prevent data loss, production downtime, and broken types.

---

## Step 1: Schema Review (`prisma/schema.prisma`)

1. **Naming Conventions**:
   - Model names: `PascalCase` (e.g. `Task`, `Department`, `UserActivity`).
   - Field names: `camelCase` (e.g. `createdAt`, `departmentId`, `assignedToId`).
   - Enum names: `PascalCase` with `SCREAMING_SNAKE_CASE` values (e.g. `enum TaskStatus { TODO, IN_PROGRESS, COMPLETED }`).
2. **Relationships & Foreign Keys**:
   - Explicit relation fields: `@relation(fields: [departmentId], references: [id], onDelete: SetNull)`.
   - Choose the appropriate cascade behavior:
     - `onDelete: Cascade` only for strict ownership (e.g. `TaskAttachment` owned by `Task`).
     - `onDelete: SetNull` or `Restrict` for structural entities (e.g. `Department`, `User`).
3. **Indexes**:
   - Add `@@index([tenantId])`, `@@index([departmentId])`, `@@index([assignedToId])`, `@@index([status, dueDate])` for frequently queried filter combinations.

---

## Step 2: Create Migration Draft (Do Not Apply Directly)

Generate the migration SQL file without applying it to the database immediately:

```bash
npx prisma migrate dev --create-only --name <descriptive_migration_name>
```

*Example*:
```bash
npx prisma migrate dev --create-only --name add_task_subtask_hierarchy
```

This creates a new folder in `prisma/migrations/<timestamp>_<name>/migration.sql`.

---

## Step 3: Inspect Generated SQL Migration

Open and inspect the generated `migration.sql` file:

- [ ] **No Destructive Table Drops**: Check that existing tables containing live data are NOT dropped (`DROP TABLE`).
- [ ] **No Unsafe Column Drops**: Check that existing columns are not inadvertently dropped without data migration or renaming.
- [ ] **NOT NULL Constraints on Existing Tables**:
  - Adding a `NOT NULL` column without a `DEFAULT` value to an existing table with rows will fail.
  - Fix: Provide a `DEFAULT` value, make the column optional (`?`), or execute a two-phase migration (add optional -> backfill data -> set not null).
- [ ] **Index Creation Safety**:
  - Verify indexes are created cleanly with appropriate naming conventions.

---

## Step 4: Verify Backward Compatibility

Assess whether the currently deployed application code will continue to function while the migration is being applied:

1. **Additive Changes**:
   - Adding optional fields or new tables is backward-compatible.
2. **Field Renames**:
   - Never rename a column directly in production without a two-step migration (add new column -> synchronize writes -> remove old column).
3. **Default Values**:
   - Ensure newly added required fields have valid defaults for existing records.

---

## Step 5: Apply Migration & Generate Prisma Client

1. **Apply the migration:**
   ```bash
   npx prisma migrate dev
   ```
2. **Regenerate Prisma Client types:**
   ```bash
   npx prisma generate
   ```

---

## Step 6: Update Seed Data & Test Factories (`prisma/seed.ts`)

1. If schema changes introduced new mandatory fields, relations, or enums:
   - Update `prisma/seed.ts` with valid sample data.
   - Update any test factories or mock data in `tests/`.
2. **Verify seed execution:**
   ```bash
   npx prisma db seed
   ```

---

## Step 7: Verification & Regression Testing

Verify the application and type system are completely healthy:

1. **Typecheck:**
   ```bash
   npm run typecheck
   ```
2. **Run tests:**
   ```bash
   npm test
   ```
3. **Commit migration:**
   Ensure both `prisma/schema.prisma` and the new `prisma/migrations/` directory are staged and committed together.
