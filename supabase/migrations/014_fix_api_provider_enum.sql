-- ============================================================================
-- MIGRATION 014: FIX API PROVIDER ENUM
-- ============================================================================
-- Description: Adds 'google' to encrypted_api_provider ENUM and migrates data
-- Safe to run: Handles both ENUM and CHECK constraint scenarios
-- ============================================================================

DO $$
BEGIN
  -- Check if encrypted_api_provider is an ENUM type
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'encrypted_api_provider') THEN
    RAISE NOTICE 'Found encrypted_api_provider ENUM type';

    -- Add 'google' value to the ENUM if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'encrypted_api_provider'
      AND e.enumlabel = 'google'
    ) THEN
      RAISE NOTICE 'Adding google to encrypted_api_provider ENUM';
      ALTER TYPE encrypted_api_provider ADD VALUE 'google';
    ELSE
      RAISE NOTICE 'google value already exists in ENUM';
    END IF;

    -- Migrate any 'google-ai' values to 'google'
    IF EXISTS (
      SELECT 1 FROM public.encrypted_api_keys
      WHERE provider::text = 'google-ai'
    ) THEN
      RAISE NOTICE 'Migrating google-ai to google';

      -- Temporarily convert to text to allow updates
      ALTER TABLE public.encrypted_api_keys
        ALTER COLUMN provider TYPE TEXT;

      -- Update google-ai to google
      UPDATE public.encrypted_api_keys
      SET provider = 'google'
      WHERE provider = 'google-ai';

      -- Convert back to ENUM
      ALTER TABLE public.encrypted_api_keys
        ALTER COLUMN provider TYPE encrypted_api_provider
        USING provider::encrypted_api_provider;
    END IF;

  -- If it's a CHECK constraint instead of ENUM
  ELSIF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname LIKE '%provider%check%'
    AND conrelid = 'public.encrypted_api_keys'::regclass
  ) THEN
    RAISE NOTICE 'Found CHECK constraint on provider';

    -- Drop the old check constraint
    DECLARE
      constraint_name TEXT;
    BEGIN
      SELECT conname INTO constraint_name
      FROM pg_constraint
      WHERE conname LIKE '%provider%check%'
      AND conrelid = 'public.encrypted_api_keys'::regclass
      LIMIT 1;

      IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.encrypted_api_keys DROP CONSTRAINT %I', constraint_name);
        RAISE NOTICE 'Dropped constraint: %', constraint_name;
      END IF;
    END;

    -- Update any google-ai to google
    UPDATE public.encrypted_api_keys
    SET provider = 'google'
    WHERE provider = 'google-ai';

    -- Add new check constraint with google included
    ALTER TABLE public.encrypted_api_keys
      ADD CONSTRAINT encrypted_api_keys_provider_check
      CHECK (provider IN ('openai', 'anthropic', 'google', 'deepgram', 'assemblyai'));

  ELSE
    RAISE NOTICE 'No constraint found on provider column, adding CHECK constraint';

    -- Update any google-ai to google
    UPDATE public.encrypted_api_keys
    SET provider = 'google'
    WHERE provider = 'google-ai';

    -- Add check constraint
    ALTER TABLE public.encrypted_api_keys
      ADD CONSTRAINT encrypted_api_keys_provider_check
      CHECK (provider IN ('openai', 'anthropic', 'google', 'deepgram', 'assemblyai'));
  END IF;

  RAISE NOTICE 'Migration 014 completed: API provider ENUM fixed';
END $$;
