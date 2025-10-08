-- Add missing fields to encrypted_api_keys table to match Prisma schema
-- This migration is safe to run multiple times

-- Add new columns if they don't exist
ALTER TABLE public.encrypted_api_keys
  ADD COLUMN IF NOT EXISTS last_tested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS test_status TEXT,
  ADD COLUMN IF NOT EXISTS test_error TEXT,
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;

-- Make masked_key nullable (it was NOT NULL in original migration)
ALTER TABLE public.encrypted_api_keys
  ALTER COLUMN masked_key DROP NOT NULL;

-- Add comment
COMMENT ON TABLE public.encrypted_api_keys IS 'Encrypted API keys for third-party services (Deepgram, OpenAI, etc.)';
COMMENT ON COLUMN public.encrypted_api_keys.encrypted_key IS 'AES-256-GCM encrypted API key (format: version:nonce:ciphertext)';
COMMENT ON COLUMN public.encrypted_api_keys.masked_key IS 'Masked key for display (e.g., sk-12••••••3456)';
COMMENT ON COLUMN public.encrypted_api_keys.last_tested_at IS 'Last time the API key was tested for validity';
COMMENT ON COLUMN public.encrypted_api_keys.test_status IS 'Result of last test: success, failed, or pending';
COMMENT ON COLUMN public.encrypted_api_keys.test_error IS 'Error message from last failed test';
COMMENT ON COLUMN public.encrypted_api_keys.last_used_at IS 'Last time this API key was used';
