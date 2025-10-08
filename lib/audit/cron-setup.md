# Audit Log Retention Policy Setup

## Automated Cleanup with Vercel Cron Jobs

### 1. Set Environment Variable

Add the following environment variable to your Vercel project (or `.env.local`):

```bash
CRON_SECRET=your-secure-random-string-here
```

Generate a secure random string:
```bash
openssl rand -base64 32
```

### 2. Create Vercel Cron Configuration

Create or update `vercel.json` in your project root:

```json
{
  "crons": [
    {
      "path": "/api/audit/cleanup",
      "schedule": "0 2 * * *"
    }
  ]
}
```

This runs the cleanup daily at 2 AM UTC.

### 3. Deploy to Vercel

The cron job will automatically be configured on your next deployment to Vercel.

## Alternative: Manual Cleanup

You can manually trigger cleanup by making a POST request:

```bash
curl -X POST https://your-domain.com/api/audit/cleanup \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json"
```

With custom retention period:
```bash
curl -X POST "https://your-domain.com/api/audit/cleanup?retentionDays=180" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json"
```

## Monitoring Cleanup

Check cleanup statistics:

```bash
curl https://your-domain.com/api/audit/cleanup \
  -H "Authorization: Bearer ${YOUR_AUTH_TOKEN}"
```

This returns:
- Total number of audit logs
- Number of logs with retention holds (won't be deleted)
- Number of logs eligible for cleanup

## Retention Policy

### Default Retention
- **Standard logs**: 90 days
- **Logs with retention hold**: Never deleted automatically

### Setting Retention Holds

When logging critical actions that must be retained:

```typescript
await logAction({
  userId: user.id,
  action: AuditAction.SESSION_DELETE,
  resource: AuditResource.SESSION,
  resourceId: sessionId,
  retentionUntil: new Date('2030-12-31'), // Keep until this date
  metadata: {
    legalHold: true,
    caseNumber: '12345',
  },
});
```

### Compliance Recommendations

- **GDPR**: Retain logs for audit purposes (typically 90 days)
- **HIPAA**: Retain for 6 years minimum (2190 days)
- **SOX**: Retain for 7 years (2555 days)
- **Legal holds**: Set `retentionUntil` date as needed

## Database Considerations

The cleanup operation:
- Only deletes logs where `retention_until` IS NULL
- Runs in a single transaction
- Uses soft deletes (actually hard deletes old records)
- Does not affect logs with retention holds

## Performance

For large audit log tables:
1. Ensure index on `created_at` column
2. Ensure index on `retention_until` column
3. Consider batching deletes if you have millions of records

## Backup Strategy

Before implementing automated cleanup:
1. Set up database backups
2. Test cleanup on staging environment
3. Monitor cleanup runs for errors
4. Consider archiving old logs to cold storage before deletion
