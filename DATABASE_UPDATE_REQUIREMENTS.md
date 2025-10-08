# Database Update Requirements

## Overview

This document tracks which database tables need to be created/updated based on recent feature additions. Use this checklist before deploying to ensure your database is in sync with the codebase.

## ✅ Recent Updates Applied

### Session Context (10/8/2025)

The following schema changes have been made in recent commits:

1. **User ID Type Migration** - Changed all user IDs from String (cuid) to UUID
2. **Audit Logging System** - Added comprehensive audit trail
3. **Encrypted API Keys** - Enhanced with test status and usage tracking
4. **Version Control System** - Added transcript versioning
5. **Timestamp Verification** - Added cryptographic timestamp proofs (NEW)

## 📋 Database Migration Checklist

### Required Migrations (In Order):

| # | Migration File | Description | Status |
|---|---------------|-------------|--------|
| 1 | `001_initial_schema.sql` | Core tables (users, sessions, segments, matters, API keys) | ✅ Complete |
| 2 | `002_ai_usage.sql` | AI usage tracking | ✅ Complete |
| 3 | `003_add_api_key_fields.sql` | Additional API key fields | ✅ Complete |
| 4 | `create_audit_logs_table.sql` | Audit logging system | ✅ Complete |
| 5 | `004_transcript_versions.sql` | Version control system | ✅ Complete |
| 6 | `005_timestamp_proofs.sql` | Timestamp verification system | 🆕 **NEW - Apply this** |

## 🔴 Action Required

### For New Deployments:

Run all migrations in order:

```bash
# Navigate to your Supabase dashboard SQL Editor or use CLI

# 1. Initial schema
psql $DATABASE_URL < supabase/migrations/001_initial_schema.sql

# 2. AI usage tracking
psql $DATABASE_URL < supabase/migrations/002_ai_usage.sql

# 3. API key enhancements
psql $DATABASE_URL < supabase/migrations/003_add_api_key_fields.sql

# 4. Audit logging
psql $DATABASE_URL < supabase/migrations/create_audit_logs_table.sql

# 5. Version control
psql $DATABASE_URL < supabase/migrations/004_transcript_versions.sql

# 6. Timestamp verification (NEW)
psql $DATABASE_URL < supabase/migrations/005_timestamp_proofs.sql
```

### For Existing Deployments:

If you've already run migrations 1-5, only apply the new one:

```bash
# Apply timestamp verification migration
psql $DATABASE_URL < supabase/migrations/005_timestamp_proofs.sql
```

### Using Supabase Dashboard:

1. Go to **SQL Editor** in Supabase Dashboard
2. Copy contents of `supabase/migrations/005_timestamp_proofs.sql`
3. Paste and run the SQL
4. Verify table was created:
   ```sql
   SELECT * FROM public.timestamp_proofs LIMIT 1;
   ```

### Using Prisma:

**⚠️ Note:** Prisma migrations are separate from Supabase migrations. If you're using Prisma as your primary tool:

```bash
# Generate migration from schema changes
npx prisma migrate dev --name add_version_control

# Or for production
npx prisma migrate deploy
```

## 📊 Current Database State

### Tables in Prisma Schema (25 models):

✅ **Already in Supabase:**
- `profiles` (User)
- `encrypted_api_keys`
- `ai_usage`
- `sessions`
- `matters`
- `transcription_segments` (TranscriptSegment)
- `segment_edit_history`
- `audit_logs` (AuditLog) ✅
- `transcript_versions` (TranscriptVersion) ✅
- `timestamp_proofs` (TimestampProof) 🆕

❌ **Not Yet in Supabase** (Application-only models):
- `subscription_plan` (SubscriptionPlan)
- `invoice` (Invoice)
- `usage_metrics` (UsageMetrics)
- `timestamp_proof` (TimestampProof)
- `redaction` (Redaction)
- `speaker` (Speaker)
- `transcript_access_log` (TranscriptAccessLog)
- `chat_message` (ChatMessage)
- `citation` (Citation)
- `export_job` (ExportJob)
- `document_template` (DocumentTemplate)
- `generated_document` (GeneratedDocument)
- `conflict_check` (ConflictCheck)
- `backup` (Backup)
- `billable_time` (BillableTime)
- `feature_flag` (FeatureFlag)
- `system_log` (SystemLog)

> **Note:** Models marked as "Not Yet in Supabase" are either:
> 1. Planned for future implementation
> 2. Application-layer only (no database persistence needed)
> 3. Using alternative storage (e.g., object storage for backups)

## 🔍 Verification Steps

After running migrations, verify the changes:

### 1. Check Table Exists

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'transcript_versions';
```

Expected: 1 row returned

### 2. Check Indexes

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'transcript_versions';
```

Expected: 3 indexes
- `idx_transcript_versions_session_created`
- `idx_transcript_versions_changed_by_created`
- `idx_transcript_versions_session_version`

### 3. Check RLS Policies

```sql
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'transcript_versions';
```

Expected: 4 policies
- `Users can view their own session versions` (SELECT)
- `Prevent direct inserts to transcript versions` (INSERT)
- `Prevent updates to transcript versions` (UPDATE)
- `Prevent deletes of transcript versions` (DELETE)

### 4. Check Foreign Key Constraints

```sql
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_name = 'transcript_versions';
```

Expected: 1 foreign key to `sessions(id)`

### 5. Test Version Creation

```sql
-- This should work (basic insert for testing)
-- In production, use the API endpoints instead
INSERT INTO public.transcript_versions (
  session_id,
  version,
  segments,
  change_type,
  changed_by
) VALUES (
  'test_session_id',
  1,
  '[]'::jsonb,
  'manual_save',
  auth.uid()
);
```

> **Note:** In production, RLS will prevent direct inserts. Use the API endpoints instead.

## 🚨 Troubleshooting

### Migration Fails: "relation already exists"

**Problem:** Table already exists from a previous migration attempt.

**Solution:**
```sql
DROP TABLE IF EXISTS public.transcript_versions CASCADE;
-- Then re-run the migration
```

### RLS Policy Errors

**Problem:** Policies conflict with existing ones.

**Solution:** The migration includes `DROP POLICY IF EXISTS` statements, but if issues persist:
```sql
-- Drop all policies for the table
DROP POLICY IF EXISTS "Users can view their own session versions" ON public.transcript_versions;
DROP POLICY IF EXISTS "Prevent direct inserts to transcript versions" ON public.transcript_versions;
DROP POLICY IF EXISTS "Prevent updates to transcript versions" ON public.transcript_versions;
DROP POLICY IF EXISTS "Prevent deletes of transcript versions" ON public.transcript_versions;

-- Re-run migration
```

### Foreign Key Constraint Violation

**Problem:** Referenced table doesn't exist.

**Solution:** Ensure migrations are run in order:
```bash
# Check if sessions table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'sessions'
);
```

If false, run `001_initial_schema.sql` first.

## 📝 Migration History

| Date | Migration | Description | Developer |
|------|-----------|-------------|-----------|
| 2025-10-08 | 005_timestamp_proofs | Added cryptographic timestamp verification system | System |
| 2025-10-08 | 004_transcript_versions | Added version control system for transcripts | System |
| 2025-10-08 | create_audit_logs | Added audit logging with enhanced columns | System |
| 2025-10-08 | 003_add_api_key_fields | Added test_status, last_used_at to API keys | System |
| 2025-10-08 | 002_ai_usage | AI usage tracking table | System |
| 2025-10-08 | 001_initial_schema | Initial database schema | System |

## 🔄 Rollback Instructions

If you need to rollback the version control migration:

```sql
-- Remove policies
DROP POLICY IF EXISTS "Users can view their own session versions" ON public.transcript_versions;
DROP POLICY IF EXISTS "Prevent direct inserts to transcript versions" ON public.transcript_versions;
DROP POLICY IF EXISTS "Prevent updates to transcript versions" ON public.transcript_versions;
DROP POLICY IF EXISTS "Prevent deletes of transcript versions" ON public.transcript_versions;

-- Remove indexes
DROP INDEX IF EXISTS idx_transcript_versions_session_created;
DROP INDEX IF EXISTS idx_transcript_versions_changed_by_created;
DROP INDEX IF EXISTS idx_transcript_versions_session_version;

-- Remove table
DROP TABLE IF EXISTS public.transcript_versions CASCADE;
```

⚠️ **Warning:** This will permanently delete all version history data!

## 📚 Related Documentation

- [VERSION_CONTROL_IMPLEMENTATION.md](./VERSION_CONTROL_IMPLEMENTATION.md) - Complete version control system documentation
- [Prisma Schema](./prisma/schema.prisma) - Current data model definitions
- [Supabase Migrations](./supabase/migrations/) - All migration files

## 🔐 Security Considerations

All migrations include:
- ✅ Row Level Security (RLS) enabled
- ✅ Policies for data access control
- ✅ Foreign key constraints for data integrity
- ✅ Immutability controls (prevent updates/deletes)
- ✅ Proper indexing for performance

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review Supabase logs in the dashboard
3. Verify migrations ran in the correct order
4. Check for conflicting table/policy names

---

**Last Updated:** October 8, 2025
**Current Schema Version:** 005 (Timestamp Verification System)
