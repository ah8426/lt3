-- Migration: Create timestamp_proofs table for cryptographic timestamp verification
-- Version: 005
-- Date: 2025-10-08
-- Description: Adds timestamp proof storage for tamper-evident transcript verification

-- Create timestamp_proofs table
CREATE TABLE IF NOT EXISTS public.timestamp_proofs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  segment_id TEXT NOT NULL UNIQUE,
  session_id TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  timestamp_source TEXT NOT NULL CHECK (timestamp_source IN ('ntp', 'local')),
  nonce TEXT NOT NULL,
  signature TEXT NOT NULL,

  -- NTP server details
  ntp_server TEXT,
  ntp_offset_ms INTEGER,
  ntp_round_trip_ms INTEGER,

  -- RFC 3161 TSA (future enhancement)
  rfc3161_token TEXT,

  -- Verification tracking
  is_verified BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ,
  verified_by UUID,
  verification_method TEXT,
  verification_errors JSONB,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Foreign keys
  CONSTRAINT fk_segment FOREIGN KEY (segment_id) REFERENCES public.transcription_segments(id) ON DELETE CASCADE,
  CONSTRAINT fk_session FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_verified_by FOREIGN KEY (verified_by) REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_timestamp_proofs_segment
  ON public.timestamp_proofs(segment_id);

CREATE INDEX IF NOT EXISTS idx_timestamp_proofs_session
  ON public.timestamp_proofs(session_id);

CREATE INDEX IF NOT EXISTS idx_timestamp_proofs_timestamp
  ON public.timestamp_proofs(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_timestamp_proofs_verified
  ON public.timestamp_proofs(is_verified, verified_at);

CREATE INDEX IF NOT EXISTS idx_timestamp_proofs_source
  ON public.timestamp_proofs(timestamp_source);

CREATE INDEX IF NOT EXISTS idx_timestamp_proofs_created
  ON public.timestamp_proofs(created_at DESC);

-- Create composite index for chain verification
CREATE INDEX IF NOT EXISTS idx_timestamp_proofs_session_timestamp
  ON public.timestamp_proofs(session_id, timestamp);

-- Enable Row Level Security
ALTER TABLE public.timestamp_proofs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view timestamp proofs for their sessions" ON public.timestamp_proofs;
DROP POLICY IF EXISTS "Service role can manage timestamp proofs" ON public.timestamp_proofs;
DROP POLICY IF EXISTS "Users can create timestamp proofs for their sessions" ON public.timestamp_proofs;
DROP POLICY IF EXISTS "Prevent direct updates to timestamp proofs" ON public.timestamp_proofs;
DROP POLICY IF EXISTS "Prevent direct deletes of timestamp proofs" ON public.timestamp_proofs;

-- RLS Policies

-- 1. Users can view timestamp proofs for their own sessions
CREATE POLICY "Users can view timestamp proofs for their sessions"
  ON public.timestamp_proofs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = timestamp_proofs.session_id
      AND s.user_id = (SELECT auth.uid())
    )
  );

-- 2. Service role (API) can create timestamp proofs
CREATE POLICY "Users can create timestamp proofs for their sessions"
  ON public.timestamp_proofs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = timestamp_proofs.session_id
      AND s.user_id = (SELECT auth.uid())
    )
  );

-- 3. Prevent direct updates to timestamp proofs (immutability)
-- Only verification fields can be updated via specific functions
CREATE POLICY "Prevent direct updates to timestamp proofs"
  ON public.timestamp_proofs
  FOR UPDATE
  USING (false)
  WITH CHECK (false);

-- 4. Prevent direct deletes (cascade only via segment/session deletion)
CREATE POLICY "Prevent direct deletes of timestamp proofs"
  ON public.timestamp_proofs
  FOR DELETE
  USING (false);

-- 5. Service role can manage all operations (for API routes)
CREATE POLICY "Service role can manage timestamp proofs"
  ON public.timestamp_proofs
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- Create function to update verification status
CREATE OR REPLACE FUNCTION public.verify_timestamp_proof(
  proof_id TEXT,
  verifier_id UUID,
  verification_success BOOLEAN,
  verification_errors JSONB DEFAULT NULL
)
RETURNS public.timestamp_proofs
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result public.timestamp_proofs;
BEGIN
  -- Verify user has access to this proof
  IF NOT EXISTS (
    SELECT 1 FROM public.timestamp_proofs tp
    JOIN public.sessions s ON s.id = tp.session_id
    WHERE tp.id = proof_id
    AND s.user_id = verifier_id
  ) THEN
    RAISE EXCEPTION 'Access denied to timestamp proof';
  END IF;

  -- Update verification status
  UPDATE public.timestamp_proofs
  SET
    is_verified = verification_success,
    verified_at = NOW(),
    verified_by = verifier_id,
    verification_method = 'manual',
    verification_errors = verify_timestamp_proof.verification_errors,
    updated_at = NOW()
  WHERE id = proof_id
  RETURNING * INTO result;

  RETURN result;
END;
$$;

-- Create function to get chain of custody for a session
CREATE OR REPLACE FUNCTION public.get_timestamp_chain(
  target_session_id TEXT
)
RETURNS TABLE (
  proof_id TEXT,
  segment_id TEXT,
  timestamp TIMESTAMPTZ,
  timestamp_source TEXT,
  content_hash TEXT,
  signature TEXT,
  is_verified BOOLEAN,
  chain_position INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify user has access to this session
  IF NOT EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id = target_session_id
    AND s.user_id = (SELECT auth.uid())
  ) THEN
    RAISE EXCEPTION 'Access denied to session';
  END IF;

  -- Return chain in timestamp order
  RETURN QUERY
  SELECT
    tp.id,
    tp.segment_id,
    tp.timestamp,
    tp.timestamp_source,
    tp.content_hash,
    tp.signature,
    tp.is_verified,
    ROW_NUMBER() OVER (ORDER BY tp.timestamp)::INTEGER as chain_position
  FROM public.timestamp_proofs tp
  WHERE tp.session_id = target_session_id
  ORDER BY tp.timestamp;
END;
$$;

-- Create function to bulk create timestamp proofs
CREATE OR REPLACE FUNCTION public.create_timestamp_proofs_batch(
  proofs JSONB
)
RETURNS SETOF public.timestamp_proofs
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  proof JSONB;
  result public.timestamp_proofs;
BEGIN
  FOR proof IN SELECT * FROM jsonb_array_elements(proofs)
  LOOP
    -- Verify user has access to the session
    IF NOT EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = (proof->>'session_id')::TEXT
      AND s.user_id = (SELECT auth.uid())
    ) THEN
      RAISE EXCEPTION 'Access denied to session: %', proof->>'session_id';
    END IF;

    -- Insert proof
    INSERT INTO public.timestamp_proofs (
      segment_id,
      session_id,
      content_hash,
      timestamp,
      timestamp_source,
      nonce,
      signature,
      ntp_server,
      ntp_offset_ms,
      ntp_round_trip_ms
    ) VALUES (
      (proof->>'segment_id')::TEXT,
      (proof->>'session_id')::TEXT,
      (proof->>'content_hash')::TEXT,
      (proof->>'timestamp')::TIMESTAMPTZ,
      (proof->>'timestamp_source')::TEXT,
      (proof->>'nonce')::TEXT,
      (proof->>'signature')::TEXT,
      (proof->>'ntp_server')::TEXT,
      (proof->>'ntp_offset_ms')::INTEGER,
      (proof->>'ntp_round_trip_ms')::INTEGER
    )
    RETURNING * INTO result;

    RETURN NEXT result;
  END LOOP;
END;
$$;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.update_timestamp_proofs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS timestamp_proofs_updated_at ON public.timestamp_proofs;

CREATE TRIGGER timestamp_proofs_updated_at
  BEFORE UPDATE ON public.timestamp_proofs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_timestamp_proofs_updated_at();

-- Add helpful comments
COMMENT ON TABLE public.timestamp_proofs IS 'Cryptographic timestamp proofs for transcript segments';
COMMENT ON COLUMN public.timestamp_proofs.content_hash IS 'SHA-256 hash of segment content';
COMMENT ON COLUMN public.timestamp_proofs.nonce IS 'Cryptographic nonce for uniqueness';
COMMENT ON COLUMN public.timestamp_proofs.signature IS 'Proof signature for tamper detection';
COMMENT ON COLUMN public.timestamp_proofs.timestamp_source IS 'Source of timestamp: ntp (trusted) or local (fallback)';
COMMENT ON COLUMN public.timestamp_proofs.is_verified IS 'Whether proof has been verified';
COMMENT ON FUNCTION public.verify_timestamp_proof IS 'Update verification status of a timestamp proof';
COMMENT ON FUNCTION public.get_timestamp_chain IS 'Get chain of custody for a session';
COMMENT ON FUNCTION public.create_timestamp_proofs_batch IS 'Bulk create timestamp proofs for multiple segments';

-- Grant necessary permissions
GRANT SELECT ON public.timestamp_proofs TO authenticated;
GRANT INSERT ON public.timestamp_proofs TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_timestamp_proof TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_timestamp_chain TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_timestamp_proofs_batch TO authenticated;

-- Verification query to ensure table was created
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'timestamp_proofs'
  ) THEN
    RAISE NOTICE 'SUCCESS: timestamp_proofs table created successfully';
  ELSE
    RAISE EXCEPTION 'FAILED: timestamp_proofs table was not created';
  END IF;
END $$;
