# Audit Logging System

A comprehensive audit logging system for tracking all user actions, ensuring compliance, and maintaining security.

## Features

- ✅ **Comprehensive Action Tracking**: Logs all user actions across the application
- ✅ **Batch Processing**: Efficient batching for high-performance logging
- ✅ **IP & Location Tracking**: Automatically captures IP address, user agent, and location
- ✅ **Read-Only Logs**: Audit logs cannot be edited or deleted by users
- ✅ **Legal Holds**: Support for retention policies and legal holds
- ✅ **Automatic Cleanup**: Configurable retention periods with automated cleanup
- ✅ **User-Friendly Viewer**: React-based UI for viewing and filtering logs
- ✅ **CSV Export**: Export audit logs for external analysis

## Architecture

### Core Components

1. **Logger** ([logger.ts](./logger.ts))
   - `logAction()` - Batched logging for performance
   - `logActionImmediate()` - Immediate logging for critical events
   - `cleanupOldLogs()` - Retention policy cleanup
   - `flushPendingLogs()` - Force flush on shutdown

2. **Types** ([types/audit.ts](../../types/audit.ts))
   - `AuditAction` - Enum of all trackable actions
   - `AuditResource` - Enum of all resource types
   - `AuditLog` - Complete audit log interface
   - `AuditLogFilter` - Query filters

3. **API Routes**
   - `GET /api/audit` - Fetch audit logs with filters
   - `POST /api/audit/cleanup` - Run retention cleanup (cron)
   - `GET /api/audit/cleanup` - Get cleanup statistics

4. **UI** ([app/(app)/settings/audit/page.tsx](../../app/(app)/settings/audit/page.tsx))
   - Table view with sorting and filtering
   - Date range picker
   - Action and resource filters
   - CSV export
   - Pagination

## Usage

### Basic Logging

```typescript
import { logAction } from '@/lib/audit/logger';
import { AuditAction, AuditResource } from '@/types/audit';

// Log a user action
await logAction({
  userId: user.id,
  action: AuditAction.SESSION_CREATE,
  resource: AuditResource.SESSION,
  resourceId: session.id,
  metadata: {
    title: session.title,
    status: session.status,
  },
});
```

### Immediate Logging (Critical Events)

```typescript
import { logActionImmediate } from '@/lib/audit/logger';

// For security-critical events that must be logged immediately
await logActionImmediate({
  userId: user.id,
  action: AuditAction.LOGIN_FAILED,
  resource: AuditResource.USER,
  metadata: {
    attempts: 3,
    reason: 'Invalid credentials',
  },
});
```

### Legal Holds

```typescript
// Set retention until a specific date
await logAction({
  userId: user.id,
  action: AuditAction.DOCUMENT_EXPORT,
  resource: AuditResource.DOCUMENT,
  resourceId: documentId,
  retentionUntil: new Date('2030-12-31'),
  metadata: {
    legalHold: true,
    caseNumber: '12345',
  },
});
```

## Integration Points

### Currently Integrated

- ✅ User authentication (login/logout)
- ✅ Session operations (create/update/delete)
- ✅ Transcript segment operations
- ✅ API key management (create/update/delete/test)

### Integration Guide

See [integration-guide.md](./integration-guide.md) for examples of:
- Settings changes
- Share link generation
- Document exports
- Custom integrations

## Database Schema

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  resource_id TEXT,
  metadata JSONB,
  ip_address TEXT,
  user_agent TEXT,
  location TEXT,
  retention_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE
);
```

### Row Level Security

- Users can **only view** their own audit logs
- Users **cannot insert, update, or delete** audit logs
- Only the service role can insert logs (via API)

## Retention Policy

### Default Retention
- **90 days** for standard logs
- **Forever** for logs with `retention_until` set

### Automated Cleanup

Set up a cron job to run cleanup daily:

1. Add `CRON_SECRET` environment variable
2. Configure Vercel cron (see [cron-setup.md](./cron-setup.md))
3. Cleanup runs daily at 2 AM UTC

### Manual Cleanup

```bash
curl -X POST https://your-domain.com/api/audit/cleanup \
  -H "Authorization: Bearer ${CRON_SECRET}"
```

## Performance Considerations

### Batching
- Logs are batched (default: 10 entries or 5 seconds)
- Reduces database writes by up to 90%
- Configurable batch size and interval

### Indexes
Optimized indexes for common queries:
- `user_id + created_at` (user timeline)
- `action` (filter by action)
- `resource` (filter by resource)
- `created_at` (date range queries)

### Scaling
For high-volume applications:
1. Increase batch size (`BATCH_SIZE` in logger.ts)
2. Consider separate audit database
3. Archive old logs to cold storage
4. Use read replicas for audit viewer

## Compliance

### Supported Standards
- **GDPR** - User data access and retention
- **HIPAA** - Healthcare data audit trails
- **SOX** - Financial data compliance
- **PCI DSS** - Payment data security

### Audit Trail Requirements
- ✅ Immutable records
- ✅ Timestamp accuracy
- ✅ User identification
- ✅ Action tracking
- ✅ Resource identification
- ✅ Context (metadata)
- ✅ IP address logging
- ✅ Retention policies

## Security

### Data Protection
- Logs stored in secure database with RLS
- No sensitive data (passwords, API keys) logged
- User IDs instead of PII
- Encrypted in transit and at rest

### Access Control
- Users see only their own logs
- No modification allowed
- Admin-only cleanup statistics
- Cron endpoint protected by secret

### Best Practices
1. Never log sensitive data
2. Use `resourceId` for traceability
3. Include meaningful metadata
4. Set retention holds for legal cases
5. Monitor cleanup statistics
6. Test retention policies in staging

## Monitoring

### Cleanup Statistics

```bash
GET /api/audit/cleanup
```

Returns:
```json
{
  "totalLogs": 150000,
  "logsWithRetentionHold": 1200,
  "logsEligibleForCleanup": 45000,
  "retentionPolicy": {
    "defaultDays": 90,
    "description": "Logs are kept for 90 days unless retention hold is set"
  }
}
```

### Alerts
Consider setting up alerts for:
- Failed cleanup runs
- Rapid growth in log volume
- Unusual action patterns
- Failed immediate logging

## Migration

Run the database migration:

```bash
supabase migration up
```

Or manually apply: [create_audit_logs_table.sql](../../supabase/migrations/create_audit_logs_table.sql)

## Testing

### Manual Testing
1. Perform actions in the app
2. Visit `/settings/audit`
3. Verify logs appear
4. Test filters and export

### Automated Testing
```typescript
// Example test
it('should log session creation', async () => {
  await logAction({
    userId: testUser.id,
    action: AuditAction.SESSION_CREATE,
    resource: AuditResource.SESSION,
    resourceId: 'test-session-id',
  });

  const logs = await fetchAuditLogs({ userId: testUser.id });
  expect(logs[0].action).toBe(AuditAction.SESSION_CREATE);
});
```

## Troubleshooting

### Logs not appearing
1. Check RLS policies are enabled
2. Verify service role key is set
3. Check batch hasn't been flushed yet
4. Look for errors in server logs

### Cleanup not running
1. Verify `CRON_SECRET` is set
2. Check Vercel cron configuration
3. Review cleanup endpoint logs
4. Ensure retention period is correct

### Performance issues
1. Check database indexes
2. Reduce batch flush interval
3. Consider archiving old logs
4. Monitor database size

## Future Enhancements

- [ ] Email notifications for critical events
- [ ] Anomaly detection (unusual patterns)
- [ ] Audit log search (full-text)
- [ ] Export to SIEM systems
- [ ] Automated compliance reports
- [ ] Audit log versioning
- [ ] Webhook notifications
- [ ] Advanced analytics dashboard

## Support

For issues or questions:
1. Check the [Integration Guide](./integration-guide.md)
2. Review [Cron Setup](./cron-setup.md)
3. Check server logs for errors
4. Verify database migration ran successfully

## License

Part of the main application license.
