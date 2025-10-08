-- Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  matter_id TEXT,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  resource_id TEXT,
  client_name TEXT,
  old_value JSONB,
  new_value JSONB,
  change_reason TEXT,
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  location TEXT,
  retention_until TIMESTAMP WITH TIME ZONE,
  is_privileged BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id_created ON public.audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_session_id_created ON public.audit_logs(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_matter_id_created ON public.audit_logs(matter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_resource ON public.audit_logs(action, resource);
CREATE INDEX IF NOT EXISTS idx_audit_logs_client_name_created ON public.audit_logs(client_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_retention_until ON public.audit_logs(retention_until);

-- Enable Row Level Security
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own audit logs
CREATE POLICY "Users can view their own audit logs"
  ON public.audit_logs
  FOR SELECT
  USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = user_id);

-- Policy: Prevent users from inserting audit logs directly (only through API)
CREATE POLICY "Prevent direct inserts"
  ON public.audit_logs
  FOR INSERT
  WITH CHECK (false);

-- Policy: Prevent users from updating audit logs
CREATE POLICY "Prevent updates"
  ON public.audit_logs
  FOR UPDATE
  USING (false);

-- Policy: Prevent users from deleting audit logs
CREATE POLICY "Prevent deletes"
  ON public.audit_logs
  FOR DELETE
  USING (false);

-- Add comments for documentation
COMMENT ON TABLE public.audit_logs IS 'Audit log of all user actions for compliance and security';
COMMENT ON COLUMN public.audit_logs.user_id IS 'User who performed the action';
COMMENT ON COLUMN public.audit_logs.action IS 'Type of action performed (from AuditAction enum)';
COMMENT ON COLUMN public.audit_logs.resource IS 'Type of resource affected (from AuditResource enum)';
COMMENT ON COLUMN public.audit_logs.resource_id IS 'ID of the specific resource affected';
COMMENT ON COLUMN public.audit_logs.metadata IS 'Additional context about the action';
COMMENT ON COLUMN public.audit_logs.ip_address IS 'IP address of the user';
COMMENT ON COLUMN public.audit_logs.user_agent IS 'User agent string from the request';
COMMENT ON COLUMN public.audit_logs.location IS 'Geographic location (country code)';
COMMENT ON COLUMN public.audit_logs.retention_until IS 'Date until which this log must be retained (legal hold)';
COMMENT ON COLUMN public.audit_logs.created_at IS 'Timestamp when the action was performed';
