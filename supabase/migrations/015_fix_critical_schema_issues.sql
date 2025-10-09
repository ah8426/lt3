-- ============================================================================
-- MIGRATION 015: FIX CRITICAL SCHEMA ISSUES
-- ============================================================================
-- Description: Fixes ENUM, unique constraints, and ensures Prisma compatibility
-- ============================================================================

-- ============================================================================
-- 1. FIX encrypted_api_provider ENUM
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Fixing encrypted_api_provider...';

  -- Check if it's an ENUM type
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'encrypted_api_provider') THEN
    RAISE NOTICE 'Found ENUM type encrypted_api_provider';

    -- Add 'google' if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'encrypted_api_provider' AND e.enumlabel = 'google'
    ) THEN
      ALTER TYPE encrypted_api_provider ADD VALUE 'google';
      RAISE NOTICE 'Added google to ENUM';
    END IF;

  ELSE
    RAISE NOTICE 'ENUM does not exist, will handle as TEXT column';
  END IF;
END $$;

-- ============================================================================
-- 2. ADD UNIQUE CONSTRAINT FOR encrypted_api_keys (user_id, provider)
-- ============================================================================

DO $$
BEGIN
  -- Drop existing constraint if it exists with different name
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'encrypted_api_keys_user_id_provider_key'
    AND conrelid = 'public.encrypted_api_keys'::regclass
  ) THEN
    ALTER TABLE public.encrypted_api_keys
      DROP CONSTRAINT encrypted_api_keys_user_id_provider_key;
    RAISE NOTICE 'Dropped old unique constraint';
  END IF;

  -- Add the constraint Prisma expects
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'encrypted_api_keys_user_id_provider_key'
    AND conrelid = 'public.encrypted_api_keys'::regclass
  ) THEN
    ALTER TABLE public.encrypted_api_keys
      ADD CONSTRAINT encrypted_api_keys_user_id_provider_key
      UNIQUE (user_id, provider);
    RAISE NOTICE 'Added unique constraint on (user_id, provider)';
  END IF;
END $$;

-- ============================================================================
-- 3. VERIFY sessions.matter_id EXISTS (should already exist from migration 001)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'sessions'
    AND column_name = 'matter_id'
  ) THEN
    RAISE EXCEPTION 'CRITICAL: sessions.matter_id column is missing!';
  ELSE
    RAISE NOTICE 'Verified: sessions.matter_id exists';
  END IF;
END $$;

-- ============================================================================
-- SUCCESS
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration 015 completed successfully';
END $$;
