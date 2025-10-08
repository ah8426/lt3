-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  resource_id TEXT,
  metadata JSONB,
  ip_address TEXT,
  user_agent TEXT,
  location TEXT,
  retention_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource);
CREATE INDEX idx_audit_logs_resource_id ON audit_logs(resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_retention_until ON audit_logs(retention_until);

-- Create composite index for common queries
CREATE INDEX idx_audit_logs_user_created ON audit_logs(user_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own audit logs
CREATE POLICY "Users can view their own audit logs"
  ON audit_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Prevent users from inserting audit logs directly (only through API)
-- This is handled by the service role key in the API
CREATE POLICY "Prevent direct inserts"
  ON audit_logs
  FOR INSERT
  WITH CHECK (false);

-- Policy: Prevent users from updating audit logs
CREATE POLICY "Prevent updates"
  ON audit_logs
  FOR UPDATE
  USING (false);

-- Policy: Prevent users from deleting audit logs
CREATE POLICY "Prevent deletes"
  ON audit_logs
  FOR DELETE
  USING (false);

-- Grant service role full access (for API to insert logs)
-- This is already granted by default to service_role

-- Add comments for documentation
COMMENT ON TABLE audit_logs IS 'Audit log of all user actions for compliance and security';
COMMENT ON COLUMN audit_logs.user_id IS 'User who performed the action';
COMMENT ON COLUMN audit_logs.action IS 'Type of action performed (from AuditAction enum)';
COMMENT ON COLUMN audit_logs.resource IS 'Type of resource affected (from AuditResource enum)';
COMMENT ON COLUMN audit_logs.resource_id IS 'ID of the specific resource affected';
COMMENT ON COLUMN audit_logs.metadata IS 'Additional context about the action';
COMMENT ON COLUMN audit_logs.ip_address IS 'IP address of the user';
COMMENT ON COLUMN audit_logs.user_agent IS 'User agent string from the request';
COMMENT ON COLUMN audit_logs.location IS 'Geographic location (country code)';
COMMENT ON COLUMN audit_logs.retention_until IS 'Date until which this log must be retained (legal hold)';
COMMENT ON COLUMN audit_logs.created_at IS 'Timestamp when the action was performed';
